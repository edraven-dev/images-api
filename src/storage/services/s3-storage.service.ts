import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { File, StorageService } from '@images-api/shared/storage';
import { calculateChecksum, FileRepository, StorageConfig, StorageProvider } from '@images-api/shared/storage';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { StorageError, StorageErrorCode } from '../errors/storage.error';

/**
 * AWS S3 storage implementation.
 * Stores files in S3 bucket with random UUID-based filenames.
 */
@Injectable()
export class S3StorageService implements StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;

  constructor(
    @Inject(StorageConfig)
    private readonly config: StorageConfig,
    @Inject(FileRepository)
    private readonly fileRepository: FileRepository,
  ) {
    this.s3Client = new S3Client({
      endpoint: this.getEndpoint(),
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });

    this.logger.log(`S3StorageService initialized with bucket: ${this.config.s3.bucket}`);
  }

  /**
   * Upload a file to S3 and return its entity with metadata.
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

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: fileName,
        Body: buffer,
        ContentType: fileType.mimeType,
        Metadata: {
          checksum,
          originalSize: buffer.length.toString(),
        },
      });

      await this.s3Client.send(command);

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
        storageProvider: StorageProvider.S3,
      });

      this.logger.log(`File uploaded to S3 successfully: ${fileId}`);

      return file;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      const err = error as Error;
      this.logger.error(`Failed to upload file to S3: ${err.message}`, err.stack);
      throw new StorageError('Failed to upload file', StorageErrorCode.UPLOAD_FAILED, err);
    }
  }

  /**
   * Get the full S3 endpoint URL.
   */
  private getEndpoint(): string {
    return `https://s3.${this.config.s3.region}.${this.config.s3.endpointDomain}`;
  }

  /**
   * Get the full S3 URL for a file.
   */
  private getFileUrl(fileName: string): string {
    return `https://${this.config.s3.bucket}.s3.${this.config.s3.region}.${this.config.s3.endpointDomain}/${fileName}`;
  }

  /**
   * Detect file type using file-type library.
   * Throws UNSUPPORTED_FILE_TYPE error if detection fails.
   */
  private async detectFileType(buffer: Buffer): Promise<{ mimeType: string; extension: string }> {
    const fileType = await fileTypeFromBuffer(buffer);

    if (!fileType) {
      throw new StorageError('Unable to detect file type', StorageErrorCode.UNSUPPORTED_FILE_TYPE);
    }

    if (!fileType.mime) {
      throw new StorageError('File type has no mime type', StorageErrorCode.UNSUPPORTED_FILE_TYPE);
    }

    if (!fileType.ext) {
      throw new StorageError('File type has no extension', StorageErrorCode.UNSUPPORTED_FILE_TYPE);
    }

    return {
      mimeType: fileType.mime,
      extension: fileType.ext,
    };
  }
}
