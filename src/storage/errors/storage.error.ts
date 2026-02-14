/**
 * Custom error class for storage-related errors.
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'StorageError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export enum StorageErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  INVALID_FILE_ID = 'INVALID_FILE_ID',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  STORAGE_UNAVAILABLE = 'STORAGE_UNAVAILABLE',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
}
