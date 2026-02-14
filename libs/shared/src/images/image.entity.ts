import { File } from '../storage/file.entity';

/**
 * Image processing status
 */
export enum ImageStatus {
  PROCESSING = 'PROCESSING',
  STORED = 'STORED',
  FAILED = 'FAILED',
}

/**
 * Image entity
 */
export interface Image {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Image title
   */
  title: string;

  /**
   * Original image width in pixels
   */
  originalWidth: number;

  /**
   * Original image height in pixels
   */
  originalHeight: number;

  /**
   * Processed image width in pixels (nullable if not yet processed)
   */
  processedWidth: number | null;

  /**
   * Processed image height in pixels (nullable if not yet processed)
   */
  processedHeight: number | null;

  /**
   * Reference to the original file entity
   */
  originalFileId: string;

  /**
   * Reference to the processed file entity (optional)
   */
  processedFileId: string | null;

  /**
   * Processing status
   */
  status: ImageStatus;

  /**
   * Creation timestamp
   */
  createdAt: Date;

  /**
   * Last update timestamp
   */
  updatedAt: Date;
}

/**
 * Image with file details
 */
export interface ImageWithFile extends Image {
  originalFile: File;
  processedFile?: File;
}

/**
 * Create image DTO
 */
export interface CreateImageDto {
  readonly id: string;
  readonly title: string;
  readonly originalWidth: number;
  readonly processedWidth?: number;
  readonly processedHeight?: number;
  readonly originalHeight: number;
  readonly originalFileId: string;
  readonly processedFileId?: string;
  readonly status?: ImageStatus;
}

/**
 * Update image DTO
 */
export interface UpdateImageDto {
  readonly title?: string;
  readonly originalWidth?: number;
  readonly originalHeight?: number;
  readonly processedWidth?: number;
  readonly processedHeight?: number;
  readonly originalFileId?: string;
  readonly processedFileId?: string;
  readonly status?: ImageStatus;
}

/**
 * Create image input type with discriminated union based on status
 */
export type CreateImageInput = {
  id: string;
  title: string;
  originalWidth: number;
  originalHeight: number;
  originalFileId: string;
} & (
  | {
      status: ImageStatus.STORED;
      processedWidth: number;
      processedHeight: number;
      processedFileId: string;
    }
  | {
      status: ImageStatus.PROCESSING;
      processedWidth?: undefined;
      processedHeight?: undefined;
      processedFileId?: undefined;
    }
);

/**
 * Image with original file for processing
 */
export interface ImageWithOriginalFile {
  image: Image;
  originalFile: File;
}
