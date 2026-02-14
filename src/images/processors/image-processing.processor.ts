import { ImageStatus } from '@images-api/shared/images';
import { StorageService } from '@images-api/shared/storage';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { ImageProcessingJob, ImageProcessingQueue, ImageProcessingResult } from '@images-api/shared/images/queues';
import { ImageProcessingService } from '../services/image-processing.service';
import { ImagesService } from '../services/images.service';
import { ImageEventType, SSEService } from '../services/sse.service';

/**
 * Processor for image processing jobs.
 * Handles resizing, storage upload, and database updates.
 */
@Processor(ImageProcessingQueue)
export class ImageProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessingProcessor.name);

  constructor(
    @Inject(StorageService)
    private readonly storageService: StorageService,
    private readonly imageProcessingService: ImageProcessingService,
    private readonly imagesService: ImagesService,
    private readonly sseService: SSEService,
  ) {
    super();
  }

  /**
   * Process image processing job.
   */
  async process(job: Job<ImageProcessingJob>): Promise<ImageProcessingResult> {
    const { imageId, title, targetWidth, targetHeight } = job.data;

    this.logger.log(`Processing image ${imageId}: ${title}`);
    const { originalFile } = await this.imagesService.getImageWithOriginalFile(imageId);

    const originalBuffer = await this.storageService.obtainFile(originalFile.url);
    this.logger.log(`Original image obtained from storage: ${originalFile.url}`);

    const processed = await this.imageProcessingService.processImage(originalBuffer, targetWidth, targetHeight);
    this.logger.log(`Image processed: ${processed.width}x${processed.height}, size: ${processed.buffer.length} bytes`);

    const processedFile = await this.storageService.upload(processed.buffer);
    this.logger.log(`Processed image uploaded to storage: ${processedFile.url}`);

    return {
      processedFileId: processedFile.id,
      processedWidth: processed.width,
      processedHeight: processed.height,
      url: processedFile.url,
    };
  }

  /**
   * Handle successful job completion.
   */
  @OnWorkerEvent('completed')
  async onCompleted(job: Job<ImageProcessingJob, ImageProcessingResult>) {
    const { imageId } = job.data;
    const result = job.returnvalue;

    this.logger.log(`Image processing completed for ${imageId}`);

    await this.imagesService.updateImageProcessingResult(imageId, {
      processedFileId: result.processedFileId,
      processedWidth: result.processedWidth,
      processedHeight: result.processedHeight,
      status: ImageStatus.STORED,
    });

    this.sseService
      .sendEvent(imageId, {
        type: ImageEventType.COMPLETED,
        imageId,
        message: 'Image processed successfully',
        url: result.url,
      })
      .catch((error) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this.logger.error(`Failed to send SSE event for image ${imageId}: ${error.message}`, error.stack);
      });
  }

  /**
   * Handle job failure.
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<ImageProcessingJob> | undefined, error: Error) {
    if (!job) {
      this.logger.error(`Job failed without job data: ${error.message}`, error.stack);
      return;
    }

    const { imageId } = job.data;

    this.logger.error(`Failed to process image ${imageId}: ${error.message}`, error.stack);

    await this.imagesService.updateImageProcessingResult(imageId, {
      status: ImageStatus.FAILED,
    });

    this.sseService
      .sendEvent(imageId, {
        type: ImageEventType.FAILED,
        imageId,
        message: error.message || 'Image processing failed',
      })
      .catch((err) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this.logger.error(`Failed to send SSE event for image ${imageId}: ${err.message}`, err.stack);
      });
  }
}
