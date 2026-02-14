import { CreateImageDto, Image, ImageWithFile, UpdateImageDto } from './image.entity';

/**
 * Pagination options for listing images
 */
export interface PaginationOptions {
  /**
   * Cursor timestamp for pagination
   */
  cursor?: Date;

  /**
   * Direction of pagination
   */
  direction?: 'next' | 'prev';

  /**
   * Maximum number of items to return
   */
  limit?: number;

  /**
   * Filter by title (partial match)
   */
  title?: string;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  /**
   * Array of items
   */
  items: T[];

  /**
   * Whether there are more items after this page
   */
  hasNext: boolean;

  /**
   * Whether there are more items before this page
   */
  hasPrev: boolean;
}

/**
 * Image repository interface
 */
export interface ImageRepository {
  /**
   * Create a new image record
   */
  create(data: CreateImageDto): Promise<Image>;

  /**
   * Find image by ID
   */
  findById(id: string): Promise<Image | null>;

  /**
   * Find image by ID with file details
   */
  findByIdWithFile(id: string): Promise<ImageWithFile | null>;

  /**
   * Find image by original file ID and processed dimensions
   */
  findByOriginalFileIdAndProcessedDimensions(
    originalFileId: string,
    processedWidth: number,
    processedHeight: number,
  ): Promise<Image | null>;

  /**
   * Find all images with pagination
   */
  findAll(options: PaginationOptions): Promise<PaginatedResult<ImageWithFile>>;

  /**
   * Update image
   */
  update(id: string, data: UpdateImageDto): Promise<Image>;
}

/**
 * Symbol for ImageRepository dependency injection
 */
export const ImageRepository = Symbol('ImageRepository');
