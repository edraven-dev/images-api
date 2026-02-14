import { ImageProcessingFailedEvent, ImageStoredEvent } from '@images-api/shared/images/events';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { SSEService } from './sse.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockSSEService: jest.Mocked<SSEService>;

  const mockImageId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUrl = 'https://example.com/image.jpg';

  beforeEach(async () => {
    mockSSEService = {
      sendEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: SSEService,
          useValue: mockSSEService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleImageStored', () => {
    it('should send completed SSE event with image url', () => {
      const event = new ImageStoredEvent(mockImageId, mockUrl);

      service.handleImageStored(event);

      expect(mockSSEService.sendEvent).toHaveBeenCalledWith(mockImageId, {
        type: 'completed',
        imageId: mockImageId,
        message: 'Image is ready',
        url: mockUrl,
      });
    });

    it('should log the event', () => {
      const event = new ImageStoredEvent(mockImageId, mockUrl);

      service.handleImageStored(event);

      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining(mockImageId));
    });

    it('should handle SSE send failure gracefully', async () => {
      const sseError = new Error('SSE connection failed');
      mockSSEService.sendEvent.mockRejectedValue(sseError);

      const event = new ImageStoredEvent(mockImageId, mockUrl);

      service.handleImageStored(event);

      // Wait for the catch handler to execute
      await new Promise((resolve) => process.nextTick(resolve));

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to send SSE event for image ${mockImageId}`),
        expect.anything(),
      );
    });
  });

  describe('handleImageProcessingFailed', () => {
    it('should send failed SSE event with error message', () => {
      const event = new ImageProcessingFailedEvent(mockImageId, 'Processing failed');

      service.handleImageProcessingFailed(event);

      expect(mockSSEService.sendEvent).toHaveBeenCalledWith(mockImageId, {
        type: 'failed',
        imageId: mockImageId,
        message: 'Processing failed',
      });
    });

    it('should log the event', () => {
      const event = new ImageProcessingFailedEvent(mockImageId, 'Processing failed');

      service.handleImageProcessingFailed(event);

      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining(mockImageId));
    });

    it('should handle SSE send failure gracefully', async () => {
      const sseError = new Error('SSE connection failed');
      mockSSEService.sendEvent.mockRejectedValue(sseError);

      const event = new ImageProcessingFailedEvent(mockImageId, 'Processing failed');

      service.handleImageProcessingFailed(event);

      // Wait for the catch handler to execute
      await new Promise((resolve) => process.nextTick(resolve));

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to send SSE event for image ${mockImageId}`),
        expect.anything(),
      );
    });
  });
});
