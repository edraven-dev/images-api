/**
 * Image response DTO for API responses
 */
export interface ImageResponseDto {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Publicly accessible URL
   */
  url: string;

  /**
   * Image title
   */
  title: string;

  /**
   * Image width in pixels
   */
  width: number;

  /**
   * Image height in pixels
   */
  height: number;

  /**
   * Creation timestamp
   */
  createdAt: Date;
}

/**
 * Paginated response for image lists
 */
export interface PaginatedImageResponse {
  /**
   * Array of images
   */
  data: ImageResponseDto[];

  /**
   * Cursor for next page (Base64 encoded timestamp)
   */
  nextCursor: string | null;

  /**
   * Cursor for previous page (Base64 encoded timestamp)
   */
  prevCursor: string | null;

  /**
   * Total count of items in current page
   */
  count: number;

  /**
   * Whether there are more items after this page
   */
  hasNext: boolean;

  /**
   * Whether there are more items before this page
   */
  hasPrev: boolean;
}
