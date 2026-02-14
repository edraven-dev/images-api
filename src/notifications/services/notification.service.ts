import { ImageProcessingFailedEvent, ImageStoredEvent } from '@images-api/shared/images/events';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SSEService } from './sse.service';

/**
 * Service for handling image processing events and forwarding them to SSE clients.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly sseService: SSEService) {}

  /**
   * Handle image stored event - notify SSE clients of successful processing.
   */
  @OnEvent(ImageStoredEvent.eventName)
  handleImageStored(event: ImageStoredEvent): void {
    this.logger.log(`Image stored event received for image ${event.imageId}`);

    this.sseService
      .sendEvent(event.imageId, {
        type: 'completed',
        imageId: event.imageId,
        message: 'Image is ready',
        url: event.url,
      })
      .catch((err) => {
        const error = err as Error;
        this.logger.error(`Failed to send SSE event for image ${event.imageId}: ${error.message}`, error.stack);
      });
  }

  /**
   * Handle image processing failed event - notify SSE clients of failure.
   */
  @OnEvent(ImageProcessingFailedEvent.eventName)
  handleImageProcessingFailed(event: ImageProcessingFailedEvent): void {
    this.logger.log(`Image processing failed event received for image ${event.imageId}`);

    this.sseService
      .sendEvent(event.imageId, {
        type: 'failed',
        imageId: event.imageId,
        message: event.message,
      })
      .catch((err) => {
        const error = err as Error;
        this.logger.error(`Failed to send SSE event for image ${event.imageId}: ${error.message}`, error.stack);
      });
  }
}
