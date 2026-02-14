/**
 * BullMQ queue name for image processing
 */
export const ImageProcessingQueue = 'image-processing';

/**
 * Job data for image processing
 */
export interface ImageProcessingJob {
  /**
   * Image ID to process
   */
  imageId: string;

  /**
   * Image title
   */
  title: string;

  /**
   * Target width (optional)
   */
  targetWidth?: number;

  /**
   * Target height (optional)
   */
  targetHeight?: number;
}

/**
 * Result of image processing
 */
export interface ProcessedImageResult {
  /**
   * Processed image buffer
   */
  buffer: Buffer;

  /**
   * Final width in pixels
   */
  width: number;

  /**
   * Final height in pixels
   */
  height: number;

  /**
   * MIME type
   */
  mimeType: string;
}

/**
 * Result returned from image processing job
 */
export interface ImageProcessingResult {
  /**
   * Processed file ID
   */
  processedFileId: string;

  /**
   * Processed image width
   */
  processedWidth: number;

  /**
   * Processed image height
   */
  processedHeight: number;

  /**
   * URL of the processed image
   */
  url: string;
}
