import type { File } from './file.entity';

/**
 * Storage service interface for file upload operations.
 * Implementations must handle file storage and return file entity with metadata.
 */
export interface StorageService {
  /**
   * Upload a file and return its entity with metadata.
   * If a file with the same checksum already exists, returns the existing file.
   * Filename is automatically generated as a UUID.
   * @param buffer - The file content as a Buffer
   * @returns Promise resolving to a File entity with metadata and URL
   */
  upload(buffer: Buffer): Promise<File>;
}

export const StorageService = Symbol('StorageService');
