import { StorageProvider } from './file.entity';

export interface LocalStorageConfig {
  /**
   * Base directory for file storage (absolute or relative path)
   */
  basePath: string;

  /**
   * Base URL for serving files (e.g., 'http://localhost:3000/uploads')
   */
  baseUrl: string;
}

export interface S3Config {
  /**
   * AWS S3 bucket name
   */
  bucket: string;

  /**
   * AWS region (e.g., 'us-east-1')
   */
  region: string;

  /**
   * AWS access key ID
   */
  accessKeyId: string;

  /**
   * AWS secret access key
   */
  secretAccessKey: string;

  /**
   * S3-compatible endpoint domain (e.g., 'amazonaws.com', 'backblazeb2.com')
   * This will be used to construct the full endpoint URL
   */
  endpointDomain: string;
}

export interface StorageConfig {
  /**
   * Storage provider to use
   */
  provider: StorageProvider;

  /**
   * Maximum file size in bytes (0 = unlimited)
   */
  maxFileSize: number;

  /**
   * Local storage configuration
   */
  localStorage: LocalStorageConfig;

  /**
   * S3 storage configuration
   */
  s3: S3Config;
}

export const StorageConfig = Symbol('StorageConfig');
