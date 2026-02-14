import { Image, ImageStatus } from '@images-api/shared/images';
import { ImageProcessingJob, ImageProcessingQueue } from '@images-api/shared/images/queues';
import {
  File,
  StorageConfig,
  StorageService,
  type StorageService as IStorageService,
} from '@images-api/shared/storage';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { createHash, randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { UploadImageDto } from '../dto/upload-image.dto';
import { UploadResponseDto } from '../dto/upload-response.dto';
import { ImageProcessingService } from './image-processing.service';
import { ImagesService } from './images.service';

interface ImageDimensions {
  width: number;
  height: number;
}

interface UploadContext {
  title: string;
  requestedWidth: number;
  requestedHeight: number;
  buffer: Buffer;
  checksum: string;
  dimensions: ImageDimensions;
  dimensionsMatch: boolean;
}

/**
 * Service responsible for handling image upload operations.
 * Follows Single Responsibility Principle - only handles upload logic.
 */
@Injectable()
export class UploadImageService {
  private readonly logger = new Logger(UploadImageService.name);
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  constructor(
    private readonly imagesService: ImagesService,
    @InjectQueue(ImageProcessingQueue)
    private readonly imageQueue: Queue<ImageProcessingJob>,
    @Inject(StorageConfig)
    private readonly storageConfig: StorageConfig,
    @Inject(StorageService)
    private readonly storageService: IStorageService,
    private readonly imageProcessingService: ImageProcessingService,
  ) {}

  /**
   * Upload and process an image.
   * Orchestrates the entire upload workflow.
   */
  async upload(file: Express.Multer.File, dto: UploadImageDto): Promise<UploadResponseDto> {
    await this.validateFileType(file.buffer);
    this.validateFileSize(file.buffer.length);

    this.logger.log(`Uploading image: ${dto.title}, size: ${file.buffer.length} bytes`);

    const context = await this.prepareUploadContext(file.buffer, dto);
    const existingFile = await this.storageService.findByChecksum(context.checksum);

    if (existingFile) {
      return this.handleExistingFile(existingFile, context);
    } else {
      return this.handleNewFile(context);
    }
  }

  /**
   * Validate that the file type is supported.
   */
  private async validateFileType(buffer: Buffer): Promise<void> {
    const fileType = await fileTypeFromBuffer(buffer);

    if (!fileType || !this.allowedMimeTypes.includes(fileType.mime)) {
      throw new BadRequestException('Invalid file type. Only JPG, PNG, and WebP images are allowed.');
    }
  }

  /**
   * Validate that the file size is within limits.
   */
  private validateFileSize(size: number): void {
    if (this.storageConfig.maxFileSize > 0 && size > this.storageConfig.maxFileSize) {
      throw new PayloadTooLargeException(
        `File size ${size} bytes exceeds maximum allowed size of ${this.storageConfig.maxFileSize} bytes`,
      );
    }
  }

  /**
   * Prepare upload context with all necessary metadata.
   */
  private async prepareUploadContext(buffer: Buffer, dto: UploadImageDto): Promise<UploadContext> {
    const dimensions = await this.imageProcessingService.getImageDimensions(buffer);
    this.logger.log(`Original image dimensions: ${dimensions.width}x${dimensions.height}`);

    const checksum = createHash('sha256').update(buffer).digest('hex');
    this.logger.log(`File checksum: ${checksum}`);

    const dimensionsMatch = dimensions.width === dto.width && dimensions.height === dto.height;
    if (dimensionsMatch) {
      this.logger.log(`Requested dimensions match original dimensions. No processing needed.`);
    }

    return {
      title: dto.title,
      requestedWidth: dto.width,
      requestedHeight: dto.height,
      buffer,
      checksum,
      dimensions,
      dimensionsMatch,
    };
  }

  /**
   * Handle upload when file already exists in storage.
   */
  private async handleExistingFile(existingFile: File, context: UploadContext): Promise<UploadResponseDto> {
    this.logger.log(`File with checksum ${context.checksum} already exists: ${existingFile.id}`);

    // If dimensions match, use original as processed
    if (context.dimensionsMatch) {
      return this.createStoredImageWithSameFile(existingFile.id, context);
    }

    // Check if processed version with these dimensions exists
    const existingImage = await this.findExistingProcessedImage(
      existingFile.id,
      context.requestedWidth,
      context.requestedHeight,
    );

    if (existingImage) {
      return this.reuseExistingProcessedImage(existingFile.id, existingImage, context);
    }

    // Need to process with new dimensions
    return this.createProcessingImageWithExistingFile(existingFile.id, context);
  }

  /**
   * Handle upload when file is new and needs to be uploaded to storage.
   */
  private async handleNewFile(context: UploadContext): Promise<UploadResponseDto> {
    this.logger.log(`New file detected. Uploading to storage.`);
    const originalFile = await this.storageService.upload(context.buffer);
    this.logger.log(`Original image uploaded to storage: ${originalFile.url}`);

    // If dimensions match, use original as processed
    if (context.dimensionsMatch) {
      return this.createStoredImageWithSameFile(originalFile.id, context);
    }

    // Need to process new file
    return this.createProcessingImageWithNewFile(originalFile.id, context);
  }

  /**
   * Find existing processed image with specific dimensions.
   */
  private async findExistingProcessedImage(
    originalFileId: string,
    width: number,
    height: number,
  ): Promise<Image | null> {
    const existingImage = await this.imagesService.findByOriginalFileIdAndProcessedDimensions(
      originalFileId,
      width,
      height,
    );

    if (existingImage) {
      this.logger.log(`Found existing image with matching file and dimensions.`);
    }

    return existingImage;
  }

  /**
   * Create a stored image when original and processed files are the same.
   */
  private async createStoredImageWithSameFile(fileId: string, context: UploadContext): Promise<UploadResponseDto> {
    const imageId = randomUUID();

    await this.imagesService.createImage({
      id: imageId,
      title: context.title,
      originalWidth: context.dimensions.width,
      originalHeight: context.dimensions.height,
      status: ImageStatus.STORED,
      processedWidth: context.dimensions.width,
      processedHeight: context.dimensions.height,
      originalFileId: fileId,
      processedFileId: fileId,
    });

    this.logger.log(`Image record created with original file as processed file, status: stored`);
    return { id: imageId };
  }

  /**
   * Reuse existing processed image by creating a new image record pointing to it.
   */
  private async reuseExistingProcessedImage(
    originalFileId: string,
    existingImage: Image,
    context: UploadContext,
  ): Promise<UploadResponseDto> {
    const imageId = randomUUID();

    await this.imagesService.createImage({
      id: imageId,
      title: context.title,
      originalWidth: context.dimensions.width,
      originalHeight: context.dimensions.height,
      status: ImageStatus.STORED,
      processedWidth: existingImage.processedWidth!,
      processedHeight: existingImage.processedHeight!,
      originalFileId,
      processedFileId: existingImage.processedFileId!,
    });

    this.logger.log(`Image record created with reused files, status: stored`);
    return { id: imageId };
  }

  /**
   * Create a processing image when existing file needs new dimensions.
   */
  private async createProcessingImageWithExistingFile(
    originalFileId: string,
    context: UploadContext,
  ): Promise<UploadResponseDto> {
    this.logger.log(`File exists but no matching processed dimensions. Reusing originalFileId only.`);
    const imageId = randomUUID();

    await this.imagesService.createImage({
      id: imageId,
      title: context.title,
      originalWidth: context.dimensions.width,
      originalHeight: context.dimensions.height,
      status: ImageStatus.PROCESSING,
      originalFileId,
    });

    await this.queueProcessingJob(imageId, context);
    return { id: imageId };
  }

  /**
   * Create a processing image for a new file.
   */
  private async createProcessingImageWithNewFile(
    originalFileId: string,
    context: UploadContext,
  ): Promise<UploadResponseDto> {
    const imageId = randomUUID();

    await this.imagesService.createImage({
      id: imageId,
      title: context.title,
      originalWidth: context.dimensions.width,
      originalHeight: context.dimensions.height,
      status: ImageStatus.PROCESSING,
      originalFileId,
    });

    await this.queueProcessingJob(imageId, context);
    return { id: imageId };
  }

  /**
   * Queue a processing job for the image.
   */
  private async queueProcessingJob(imageId: string, context: UploadContext): Promise<void> {
    this.logger.log(`Image record created with status: processing`);

    await this.imageQueue.add('process-image', {
      imageId,
      title: context.title,
      targetWidth: context.requestedWidth,
      targetHeight: context.requestedHeight,
    });

    this.logger.log(`Image processing job queued for ${imageId}`);
  }
}
