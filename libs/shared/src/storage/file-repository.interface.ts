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
   * Find a file by its checksum.
   * @param checksum - File checksum (SHA-256)
   * @returns Promise resolving to the file or null if not found
   */
  findByChecksum(checksum: string): Promise<File | null>;
}

export const FileRepository = Symbol('FileRepository');
