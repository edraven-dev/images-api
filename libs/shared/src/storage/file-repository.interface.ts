import type { CreateFileDto, File } from './file.entity';

/**
 * Repository interface for file persistence operations.
 */
export interface FileRepository {
  /**
   * Create a new file record.
   * @param data - File data to create
   * @returns Promise resolving to the created file
   */
  create(data: CreateFileDto): Promise<File>;

  /**
   * Find a file by its ID.
   * @param id - File ID
   * @returns Promise resolving to the file or null if not found
   */
  findById(id: string): Promise<File | null>;

  /**
   * Find a file by its checksum and storage provider.
   * @param checksum - File checksum (SHA-256)
   * @param storageProvider - Storage provider (LOCAL or S3)
   * @returns Promise resolving to the file or null if not found
   */
  findByChecksum(checksum: string, storageProvider: string): Promise<File | null>;
}

export const FileRepository = Symbol('FileRepository');
