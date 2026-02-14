import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { SSEService } from './sse.service';

describe('SSEService', () => {
  let service: SSEService;

  const mockImageId = '123e4567-e89b-12d3-a456-426614174000';

  const createMockResponse = (): jest.Mocked<Response> =>
    ({
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SSEService],
    }).compile();

    service = module.get<SSEService>(SSEService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('addClient', () => {
    it('should add a client for the given image id', () => {
      const response = createMockResponse();

      service.addClient(mockImageId, response);

      expect(service.getClientCount(mockImageId)).toBe(1);
    });

    it('should support multiple clients for the same image id', () => {
      const response1 = createMockResponse();
      const response2 = createMockResponse();

      service.addClient(mockImageId, response1);
      service.addClient(mockImageId, response2);

      expect(service.getClientCount(mockImageId)).toBe(2);
    });

    it('should register close handler on the response', () => {
      const response = createMockResponse();

      service.addClient(mockImageId, response);

      expect(response.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should remove client when close handler is called', () => {
      const response = createMockResponse();
      let closeHandler: () => void = () => {};
      response.on.mockImplementation((event: string, handler: () => void) => {
        if (event === 'close') closeHandler = handler;
        return response;
      });

      service.addClient(mockImageId, response);
      expect(service.getClientCount(mockImageId)).toBe(1);

      closeHandler();
      expect(service.getClientCount(mockImageId)).toBe(0);
    });
  });

  describe('removeClient', () => {
    it('should remove a specific client', () => {
      const response1 = createMockResponse();
      const response2 = createMockResponse();

      service.addClient(mockImageId, response1);
      service.addClient(mockImageId, response2);
      expect(service.getClientCount(mockImageId)).toBe(2);

      service.removeClient(mockImageId, response1);
      expect(service.getClientCount(mockImageId)).toBe(1);
    });

    it('should clean up image entry when last client is removed', () => {
      const response = createMockResponse();

      service.addClient(mockImageId, response);
      service.removeClient(mockImageId, response);

      expect(service.getClientCount(mockImageId)).toBe(0);
    });

    it('should handle removing a client for unknown image id', () => {
      const response = createMockResponse();

      expect(() => service.removeClient('non-existent-id', response)).not.toThrow();
    });
  });

  describe('sendEvent', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should send event data to all connected clients', async () => {
      const response1 = createMockResponse();
      const response2 = createMockResponse();

      service.addClient(mockImageId, response1);
      service.addClient(mockImageId, response2);

      const eventData = {
        type: 'completed' as const,
        imageId: mockImageId,
        message: 'Image is ready',
        url: 'https://example.com/image.jpg',
      };

      const sendPromise = service.sendEvent(mockImageId, eventData);
      jest.advanceTimersByTime(30000);
      await sendPromise;

      const expectedPayload = `data: ${JSON.stringify(eventData)}\n\n`;
      expect(response1.write).toHaveBeenCalledWith(expectedPayload);
      expect(response2.write).toHaveBeenCalledWith(expectedPayload);
    });

    it('should not throw when no clients are listening', async () => {
      const sendPromise = service.sendEvent(mockImageId, {
        type: 'completed',
        imageId: mockImageId,
        message: 'Image is ready',
      });

      jest.advanceTimersByTime(30000);
      await expect(sendPromise).resolves.toBeUndefined();
    });

    it('should clean up clients after sending a completed event', async () => {
      const response = createMockResponse();
      service.addClient(mockImageId, response);

      const sendPromise = service.sendEvent(mockImageId, {
        type: 'completed',
        imageId: mockImageId,
        message: 'Image is ready',
      });

      jest.advanceTimersByTime(30000);
      await sendPromise;

      expect(response.end).toHaveBeenCalled();
      expect(service.getClientCount(mockImageId)).toBe(0);
    });

    it('should clean up clients after sending a failed event', async () => {
      const response = createMockResponse();
      service.addClient(mockImageId, response);

      const sendPromise = service.sendEvent(mockImageId, {
        type: 'failed',
        imageId: mockImageId,
        message: 'Processing failed',
      });

      jest.advanceTimersByTime(30000);
      await sendPromise;

      expect(response.end).toHaveBeenCalled();
      expect(service.getClientCount(mockImageId)).toBe(0);
    });

    it('should remove client if write throws an error', async () => {
      const response = createMockResponse();
      response.write.mockImplementation(() => {
        throw new Error('Connection reset');
      });

      service.addClient(mockImageId, response);

      const sendPromise = service.sendEvent(mockImageId, {
        type: 'completed',
        imageId: mockImageId,
        message: 'Image is ready',
      });

      jest.advanceTimersByTime(30000);
      await sendPromise;

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('Connection reset'));
    });

    it('should wait 30 seconds before sending event', async () => {
      const response = createMockResponse();
      service.addClient(mockImageId, response);

      const sendPromise = service.sendEvent(mockImageId, {
        type: 'completed',
        imageId: mockImageId,
      });

      // Before the timeout elapses, write should not have been called
      jest.advanceTimersByTime(29999);
      expect(response.write).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      await sendPromise;
      expect(response.write).toHaveBeenCalled();
    });
  });

  describe('getClientCount', () => {
    it('should return 0 for unknown image id', () => {
      expect(service.getClientCount('non-existent-id')).toBe(0);
    });

    it('should return correct count', () => {
      const response1 = createMockResponse();
      const response2 = createMockResponse();

      service.addClient(mockImageId, response1);
      service.addClient(mockImageId, response2);

      expect(service.getClientCount(mockImageId)).toBe(2);
    });
  });

  describe('getTotalClientCount', () => {
    it('should return 0 when no clients are connected', () => {
      expect(service.getTotalClientCount()).toBe(0);
    });

    it('should return total count across all image ids', () => {
      const otherId = '223e4567-e89b-12d3-a456-426614174001';
      const response1 = createMockResponse();
      const response2 = createMockResponse();
      const response3 = createMockResponse();

      service.addClient(mockImageId, response1);
      service.addClient(mockImageId, response2);
      service.addClient(otherId, response3);

      expect(service.getTotalClientCount()).toBe(3);
    });
  });
});
