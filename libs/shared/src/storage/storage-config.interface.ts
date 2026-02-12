export interface StorageConfig {
  /**
   * Base directory for file storage (absolute or relative path)
   */
  basePath: string;

  /**
   * Base URL for serving files (e.g., 'http://localhost:3000/uploads')
   */
  baseUrl: string;

  /**
   * Maximum file size in bytes (0 = unlimited)
   */
  maxFileSize: number;
}

export const StorageConfig = Symbol('StorageConfig');
