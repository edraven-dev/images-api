import type { File, StorageService } from '@images-api/shared/storage';
import { FileRepository, FileStatus, StorageConfig } from '@images-api/shared/storage';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageError, StorageErrorCode } from '../errors/storage.error';

/**
 * Local filesystem storage implementation.
 * Stores files in a configurable directory with random UUID-based filenames.
 */
@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);

  constructor(
    @Inject(StorageConfig)
    private readonly config: StorageConfig,
    @Inject(FileRepository)
    private readonly fileRepository: FileRepository,
  ) {}

  /**
   * Upload a file to local storage and return its entity with metadata.
   * Checks for existing files with the same checksum to avoid duplicates.
   * Generates a random UUID-based filename with appropriate extension.
   */
  async upload(buffer: Buffer): Promise<File> {
    try {
      // Validate file size
      if (this.config.maxFileSize > 0 && buffer.length > this.config.maxFileSize) {
        throw new StorageError(
          `File size ${buffer.length} bytes exceeds maximum allowed size of ${this.config.maxFileSize} bytes`,
          StorageErrorCode.FILE_TOO_LARGE,
        );
      }

      // Calculate checksum first to check for duplicates
      const checksum = this.calculateChecksum(buffer);

      // Check if file with same checksum already exists
      const existingFile = await this.fileRepository.findByChecksum(checksum);
      if (existingFile) {
        this.logger.log(`File with checksum ${checksum} already exists, returning existing file: ${existingFile.id}`);
        return existingFile;
      }

      // Generate unique file ID and detect file type
      const fileId = randomUUID();
      const fileType = await this.detectFileType(buffer);
      const fileName = `${fileId}.${fileType.extension}`;
      const fileSize = BigInt(buffer.length);

      // Determine storage path
      const filePath = this.getFilePath(fileName);

      // Ensure directory exists
      const directory = path.dirname(filePath);
      await fs.mkdir(directory, { recursive: true });

      // Write file to disk
      await fs.writeFile(filePath, buffer);

      // Construct URL
      const url = this.getFileUrl(fileName);

      // Save file metadata to database
      const file = await this.fileRepository.create({
        id: fileId,
        fileName,
        fileSize,
        mimeType: fileType.mimeType,
        checksum,
        url,
        status: FileStatus.COMPLETED,
      });

      this.logger.log(`File uploaded successfully: ${fileId}`);

      return file;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      const err = error as Error;
      this.logger.error(`Failed to upload file: ${err.message}`, err.stack);
      throw new StorageError('Failed to upload file', StorageErrorCode.UPLOAD_FAILED, err);
    }
  }

  /**
   * Get the full file system path for a file.
   */
  private getFilePath(fileName: string): string {
    return path.join(this.config.basePath, fileName);
  }

  /**
   * Get the public URL for a file.
   */
  private getFileUrl(fileName: string): string {
    return `${this.config.baseUrl}/${fileName}`;
  }

  /**
   * Calculate SHA-256 checksum of file buffer.
   */
  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Detect file type from buffer.
   * Throws error if file type cannot be determined.
   */
  private async detectFileType(buffer: Buffer): Promise<{ mimeType: string; extension: string }> {
    const result = await fileTypeFromBuffer(buffer);

    if (!result || !result.mime || !result.ext) {
      throw new StorageError(
        'Unable to detect file type. File format not supported or invalid.',
        StorageErrorCode.UNSUPPORTED_FILE_TYPE,
      );
    }

    return {
      mimeType: result.mime,
      extension: result.ext,
    };
  }
}
