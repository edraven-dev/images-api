import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { SSEService } from '../services/sse.service';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockSSEService: jest.Mocked<SSEService>;

  const mockImageId = '123e4567-e89b-12d3-a456-426614174000';

  beforeAll(async () => {
    mockSSEService = {
      addClient: jest.fn(),
      removeClient: jest.fn(),
      sendEvent: jest.fn(),
      getClientCount: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: SSEService,
          useValue: mockSSEService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('imageEvents', () => {
    let mockResponse: jest.Mocked<Response>;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn().mockReturnThis(),
      } as any;
    });

    it('should set SSE headers on the response', () => {
      controller.imageEvents(mockImageId, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    });

    it('should register the client with SSEService', () => {
      controller.imageEvents(mockImageId, mockResponse);

      expect(mockSSEService.addClient).toHaveBeenCalledWith(mockImageId, mockResponse);
    });

    it('should register a close handler on the response', () => {
      controller.imageEvents(mockImageId, mockResponse);

      expect(mockResponse.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should send keep-alive comments at 15 second intervals', () => {
      jest.useFakeTimers();
      try {
        controller.imageEvents(mockImageId, mockResponse);

        expect(mockResponse.write).not.toHaveBeenCalled();

        jest.advanceTimersByTime(15000);
        expect(mockResponse.write).toHaveBeenCalledWith(':keep-alive\n\n');

        jest.advanceTimersByTime(15000);
        expect(mockResponse.write).toHaveBeenCalledTimes(2);
      } finally {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      }
    });

    it('should clear keep-alive interval on close', () => {
      jest.useFakeTimers();
      try {
        let closeHandler: () => void = () => {};
        mockResponse.on.mockImplementation((event: string, handler: () => void) => {
          if (event === 'close') closeHandler = handler;
          return mockResponse;
        });

        controller.imageEvents(mockImageId, mockResponse);

        // Trigger close
        closeHandler();

        // Advance timers - keep-alive should no longer fire
        jest.advanceTimersByTime(30000);
        expect(mockResponse.write).not.toHaveBeenCalled();
      } finally {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      }
    });

    it('should clear keep-alive interval if write throws', () => {
      jest.useFakeTimers();
      try {
        mockResponse.write.mockImplementation(() => {
          throw new Error('Connection reset');
        });

        controller.imageEvents(mockImageId, mockResponse);

        // First keep-alive throws
        jest.advanceTimersByTime(15000);
        expect(mockResponse.write).toHaveBeenCalledTimes(1);

        // Interval should be cleared, no more writes
        mockResponse.write.mockClear();
        jest.advanceTimersByTime(15000);
        expect(mockResponse.write).not.toHaveBeenCalled();
      } finally {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      }
    });
  });
});
