import { ProcessedImageResult } from '@images-api/shared/images/queues';
import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';

/**
 * Service for processing images using Sharp.
 * Handles resizing, format conversion, and metadata extraction.
 */
@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  /**
   * Process an image: resize if dimensions provided, otherwise keep original.
   * Returns processed buffer with final dimensions and MIME type.
   */
  async processImage(buffer: Buffer, targetWidth?: number, targetHeight?: number): Promise<ProcessedImageResult> {
    const pipeline = sharp(buffer);
    const originalMetadata = await this.extractAndValidateMetadata(pipeline, 'original');

    const processedPipeline = this.applyResizeIfNeeded(pipeline, targetWidth, targetHeight, originalMetadata);
    const processedBuffer = await processedPipeline.toBuffer();

    return this.buildProcessedResult(processedBuffer, originalMetadata);
  }

  /**
   * Extract and validate metadata from Sharp pipeline.
   */
  private async extractAndValidateMetadata(pipeline: sharp.Sharp, context: string): Promise<sharp.Metadata> {
    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error(`Unable to extract ${context} image dimensions`);
    }

    this.logger.log(`${context} image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
    return metadata;
  }

  /**
   * Apply resize transformation if target dimensions are provided.
   */
  private applyResizeIfNeeded(
    pipeline: sharp.Sharp,
    targetWidth?: number,
    targetHeight?: number,
    originalMetadata?: sharp.Metadata,
  ): sharp.Sharp {
    if (!targetWidth && !targetHeight) {
      return pipeline;
    }

    this.logger.log(
      `Resizing from ${originalMetadata?.width}x${originalMetadata?.height} to ${targetWidth || 'auto'}x${targetHeight || 'auto'}`,
    );

    return pipeline.resize(targetWidth, targetHeight, {
      fit: 'fill', // Stretch to exact dimensions without preserving aspect ratio
    });
  }

  /**
   * Build the final processed result with metadata.
   */
  private async buildProcessedResult(
    processedBuffer: Buffer,
    originalMetadata: sharp.Metadata,
  ): Promise<ProcessedImageResult> {
    const finalMetadata = await this.extractAndValidateMetadata(sharp(processedBuffer), 'processed');
    const mimeType = this.formatToMimeType(finalMetadata.format || originalMetadata.format || 'jpeg');

    this.logger.log(`Image processed successfully: ${finalMetadata.width}x${finalMetadata.height}, ${mimeType}`);

    return {
      buffer: processedBuffer,
      width: finalMetadata.width,
      height: finalMetadata.height,
      mimeType,
    };
  }

  /**
   * Extract image dimensions without processing.
   */
  async getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to extract image dimensions');
      }

      return {
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to extract image dimensions: ${err.message}`, err.stack);
      throw new Error(`Failed to extract image dimensions: ${err.message}`);
    }
  }

  /**
   * Convert Sharp format to MIME type.
   */
  private formatToMimeType(format: string): string {
    const formatMap: Record<string, string> = {
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      tiff: 'image/tiff',
      svg: 'image/svg+xml',
    };

    return formatMap[format.toLowerCase()] || 'image/jpeg';
  }
}
