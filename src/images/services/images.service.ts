import {
  CreateImageInput,
  Image,
  ImageRepository,
  ImageStatus,
  ImageWithFile,
  ImageWithOriginalFile,
  UpdateImageDto,
} from '@images-api/shared/images';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ImageResponseDto, PaginatedImageResponseDto } from '../dto/image-response.dto';
import { ListImagesQueryDto } from '../dto/list-images-query.dto';
import { ImageEventType, SSEService } from './sse.service';

/**
 * Service for managing images.
 * Handles querying and response mapping.
 */
@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    @Inject(ImageRepository)
    private readonly imageRepository: ImageRepository,
    private readonly sseService: SSEService,
  ) {}

  /**
   * Find image by ID.
   */
  async findById(id: string): Promise<ImageResponseDto> {
    const image = await this.imageRepository.findByIdWithFile(id);

    if (!image) {
      throw new NotFoundException(`Image with ID ${id} not found`);
    }

    return this.mapToResponseDto(image);
  }

  /**
   * Find all images with pagination and filtering.
   */
  async findAll(query: ListImagesQueryDto): Promise<PaginatedImageResponseDto> {
    // Decode cursor if provided
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : undefined;

    // Fetch images
    const result = await this.imageRepository.findAll({
      cursor,
      direction: query.direction,
      limit: query.limit,
      title: query.title,
    });

    // Map to response DTOs
    const data = result.items.map((image) => this.mapToResponseDto(image));

    // Generate cursors
    const nextCursor = result.hasNext && data.length > 0 ? this.encodeCursor(data[data.length - 1].createdAt) : null;

    const prevCursor = result.hasPrev && data.length > 0 ? this.encodeCursor(data[0].createdAt) : null;

    return {
      data,
      nextCursor,
      prevCursor,
      count: data.length,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
    };
  }

  /**
   * Get image entity with original file for internal processing.
   * Used by processor to fetch image data.
   */
  async getImageWithOriginalFile(id: string): Promise<ImageWithOriginalFile> {
    const imageWithFile = await this.imageRepository.findByIdWithFile(id);

    if (!imageWithFile) {
      throw new NotFoundException(`Image with ID ${id} not found`);
    }

    return {
      image: {
        id: imageWithFile.id,
        title: imageWithFile.title,
        originalWidth: imageWithFile.originalWidth,
        originalHeight: imageWithFile.originalHeight,
        processedWidth: imageWithFile.processedWidth,
        processedHeight: imageWithFile.processedHeight,
        originalFileId: imageWithFile.originalFileId,
        processedFileId: imageWithFile.processedFileId,
        status: imageWithFile.status,
        createdAt: imageWithFile.createdAt,
        updatedAt: imageWithFile.updatedAt,
      },
      originalFile: imageWithFile.originalFile,
    };
  }

  /**
   * Update image processing result.
   * Used by processor to update image after processing.
   */
  async updateImageProcessingResult(id: string, data: UpdateImageDto): Promise<void> {
    await this.imageRepository.update(id, data);
  }

  /**
   * Find existing processed image with specific dimensions.
   * Used by upload service to check for deduplication.
   */
  async findByOriginalFileIdAndProcessedDimensions(
    originalFileId: string,
    width: number,
    height: number,
  ): Promise<Image | null> {
    const existingImage = await this.imageRepository.findByOriginalFileIdAndProcessedDimensions(
      originalFileId,
      width,
      height,
    );

    if (
      existingImage &&
      existingImage.status === ImageStatus.STORED &&
      existingImage.processedFileId &&
      existingImage.processedWidth === width &&
      existingImage.processedHeight === height
    ) {
      return existingImage;
    }

    return null;
  }

  /**
   * Create an image with the specified status.
   * If status is STORED, sends SSE event immediately to notify clients.
   * If status is PROCESSING, events will be sent later by the processor.
   */
  async createImage(data: CreateImageInput): Promise<Image> {
    const image = await this.imageRepository.create(data);

    // Send SSE event immediately for stored images
    if (data.status === ImageStatus.STORED) {
      const imageWithFile = await this.imageRepository.findByIdWithFile(image.id);
      if (imageWithFile?.processedFile) {
        this.sseService
          .sendEvent(image.id, {
            type: ImageEventType.COMPLETED,
            imageId: image.id,
            message: 'Image is ready',
            url: imageWithFile.processedFile.url,
          })
          .catch((err) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            this.logger.error(`Failed to send SSE event for image ${image.id}: ${err.message}`, err.stack);
          });
      }
    }

    return image;
  }

  /**
   * Map ImageWithFile to ImageResponseDto.
   */
  private mapToResponseDto(image: ImageWithFile): ImageResponseDto {
    return {
      id: image.id,
      url: image.processedFile?.url || image.originalFile.url,
      title: image.title,
      width: image.processedWidth ?? image.originalWidth,
      height: image.processedHeight ?? image.originalHeight,
      createdAt: image.createdAt,
    };
  }

  /**
   * Encode cursor to Base64.
   */
  private encodeCursor(date: Date): string {
    return Buffer.from(date.toISOString()).toString('base64');
  }

  /**
   * Decode cursor from Base64.
   */
  private decodeCursor(cursor: string): Date {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      return new Date(decoded);
    } catch {
      throw new Error('Invalid cursor format');
    }
  }
}
