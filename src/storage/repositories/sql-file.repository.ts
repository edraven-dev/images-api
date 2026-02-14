import type { CreateFileDto, File, FileRepository } from '@images-api/shared/storage';
import { StorageProvider } from '@images-api/shared/storage';
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * SQL implementation of FileRepository using Kysely.
 * Handles file metadata persistence in PostgreSQL.
 */
@Injectable()
export class SqlFileRepository implements FileRepository {
  private readonly logger = new Logger(SqlFileRepository.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Create a new file record in the database.
   */
  async create(data: CreateFileDto): Promise<File> {
    const file = await this.database.db
      .insertInto('files')
      .values({
        id: data.id,
        file_name: data.fileName,
        file_size: data.fileSize.toString(),
        mime_type: data.mimeType,
        checksum: data.checksum,
        url: data.url,
        storage_provider: data.storageProvider,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    this.logger.log(`File record created: ${file.id}`);

    return this.mapToFile(file);
  }

  /**
   * Find a file by its ID.
   */
  async findById(id: string): Promise<File | null> {
    const file = await this.database.db.selectFrom('files').selectAll().where('id', '=', id).executeTakeFirst();

    return file ? this.mapToFile(file) : null;
  }

  /**
   * Find a file by its checksum and storage provider.
   */
  async findByChecksum(checksum: string, storageProvider: string): Promise<File | null> {
    const file = await this.database.db
      .selectFrom('files')
      .selectAll()
      .where('checksum', '=', checksum)
      .where('storage_provider', '=', storageProvider)
      .executeTakeFirst();

    return file ? this.mapToFile(file) : null;
  }

  /**
   * Map database row to File entity.
   */
  private mapToFile(row: {
    id: string;
    file_name: string;
    file_size: string;
    mime_type: string;
    checksum: string;
    url: string;
    storage_provider: string;
    created_at: Date;
    updated_at: Date;
  }): File {
    return {
      id: row.id,
      fileName: row.file_name,
      fileSize: BigInt(row.file_size),
      mimeType: row.mime_type,
      checksum: row.checksum,
      url: row.url,
      storageProvider: row.storage_provider as StorageProvider,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
