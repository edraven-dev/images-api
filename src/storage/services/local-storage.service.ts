import type { File, StorageService } from '@images-api/shared/storage';
import { calculateChecksum, FileRepository, StorageConfig, StorageProvider } from '@images-api/shared/storage';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor(
    @Inject(StorageConfig)
    private readonly config: StorageConfig,
    @Inject(FileRepository)
    private readonly fileRepository: FileRepository,
  ) {
    this.basePath = config.localStorage.basePath;
    this.baseUrl = config.localStorage.baseUrl;
  }

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
      const checksum = calculateChecksum(buffer);

      // Check if file with same checksum already exists in LOCAL storage
      const existingFile = await this.fileRepository.findByChecksum(checksum, StorageProvider.LOCAL);
      if (existingFile) {
        this.logger.log(
          `File with checksum ${checksum} already exists in LOCAL storage, returning existing file: ${existingFile.id}`,
        );
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
        storageProvider: StorageProvider.LOCAL,
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
   * Obtain a file from local storage.
   */
  async obtainFile(url: string): Promise<Buffer> {
    try {
      // Extract filename from URL
      const fileName = path.basename(url);
      const filePath = this.getFilePath(fileName);

      // Read file from disk
      const buffer = await fs.readFile(filePath);

      this.logger.log(`File obtained successfully: ${fileName}`);

      return buffer;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to obtain file from ${url}: ${err.message}`, err.stack);
      throw new StorageError('Failed to obtain file', StorageErrorCode.OBTAIN_FAILED, err);
    }
  }

  /**
   * Find a file by its checksum.
   */
  async findByChecksum(checksum: string): Promise<File | null> {
    return this.fileRepository.findByChecksum(checksum, StorageProvider.LOCAL);
  }

  /**
   * Get the full file system path for a file.
   */
  private getFilePath(fileName: string): string {
    return path.join(this.basePath, fileName);
  }

  /**
   * Get the public URL for a file.
   */
  private getFileUrl(fileName: string): string {
    return `${this.baseUrl}/${fileName}`;
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
