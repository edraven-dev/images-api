/**
 * File upload status
 */
export enum FileStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * File entity representing an uploaded file.
 */
export interface File {
  /**
   * Unique identifier (UUID)
   */
  id: string;

  /**
   * Original file name
   */
  fileName: string;

  /**
   * File size in bytes
   */
  fileSize: bigint;

  /**
   * Validated MIME type
   */
  mimeType: string;

  /**
   * SHA-256 checksum for integrity verification and deduplication
   */
  checksum: string;

  /**
   * Publicly accessible URL
   */
  url: string;

  /**
   * Upload/processing status
   */
  status: FileStatus;

  /**
   * Timestamp when the file was created
   */
  createdAt: Date;

  /**
   * Timestamp when the file was last updated
   */
  updatedAt: Date;
}

/**
 * Data required to create a new file record
 */
export interface CreateFileDto {
  readonly id: string;
  readonly fileName: string;
  readonly fileSize: bigint;
  readonly mimeType: string;
  readonly checksum: string;
  readonly url: string;
  readonly status?: FileStatus;
}

/**
 * Data for updating an existing file record
 */
export interface UpdateFileDto {
  readonly fileName?: string;
  readonly fileSize?: bigint;
  readonly mimeType?: string;
  readonly url?: string;
  readonly status?: FileStatus;
}
