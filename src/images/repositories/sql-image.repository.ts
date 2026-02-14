import {
  CreateImageDto,
  Image,
  ImageRepository,
  ImageStatus,
  ImageWithFile,
  PaginatedResult,
  PaginationOptions,
  UpdateImageDto,
} from '@images-api/shared/images';
import { StorageProvider } from '@images-api/shared/storage';
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * SQL implementation of ImageRepository using Kysely.
 * Handles image metadata persistence in PostgreSQL.
 */
@Injectable()
export class SqlImageRepository implements ImageRepository {
  private readonly logger = new Logger(SqlImageRepository.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Create a new image record in the database.
   */
  async create(data: CreateImageDto): Promise<Image> {
    const image = await this.database.db
      .insertInto('images')
      .values({
        id: data.id,
        title: data.title,
        original_width: data.originalWidth,
        original_height: data.originalHeight,
        processed_width: data.processedWidth ?? null,
        processed_height: data.processedHeight ?? null,
        original_file_id: data.originalFileId,
        processed_file_id: data.processedFileId ?? null,
        status: data.status || ImageStatus.PROCESSING,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    this.logger.log(`Image record created: ${image.id}`);

    return this.mapToImage(image);
  }

  /**
   * Find an image by its ID.
   */
  async findById(id: string): Promise<Image | null> {
    const image = await this.database.db.selectFrom('images').selectAll().where('id', '=', id).executeTakeFirst();

    return image ? this.mapToImage(image) : null;
  }

  /**
   * Find an image by its ID with file details.
   */
  async findByIdWithFile(id: string): Promise<ImageWithFile | null> {
    const result = await this.database.db
      .selectFrom('images')
      .innerJoin('files as original_files', 'images.original_file_id', 'original_files.id')
      .leftJoin('files as processed_files', 'images.processed_file_id', 'processed_files.id')
      .select([
        'images.id as id',
        'images.title as title',
        'images.original_width as original_width',
        'images.original_height as original_height',
        'images.processed_width as processed_width',
        'images.processed_height as processed_height',
        'images.original_file_id as original_file_id',
        'images.processed_file_id as processed_file_id',
        'images.status as status',
        'images.created_at as created_at',
        'images.updated_at as updated_at',
        'original_files.id as original_file_id',
        'original_files.file_name as original_file_name',
        'original_files.file_size as original_file_size',
        'original_files.mime_type as original_mime_type',
        'original_files.url as original_url',
        'original_files.checksum as original_checksum',
        'original_files.storage_provider as original_storage_provider',
        'original_files.created_at as original_file_created_at',
        'original_files.updated_at as original_file_updated_at',
        'processed_files.id as processed_file_id_val',
        'processed_files.file_name as processed_file_name',
        'processed_files.file_size as processed_file_size',
        'processed_files.mime_type as processed_mime_type',
        'processed_files.url as processed_url',
        'processed_files.checksum as processed_checksum',
        'processed_files.storage_provider as processed_storage_provider',
        'processed_files.created_at as processed_file_created_at',
        'processed_files.updated_at as processed_file_updated_at',
      ])
      .where('images.id', '=', id)
      .executeTakeFirst();

    return result ? this.mapToImageWithFile(result) : null;
  }

  /**
   * Find an image by original file ID and processed dimensions.
   */
  async findByOriginalFileIdAndProcessedDimensions(
    originalFileId: string,
    processedWidth: number,
    processedHeight: number,
  ): Promise<Image | null> {
    const image = await this.database.db
      .selectFrom('images')
      .selectAll()
      .where('original_file_id', '=', originalFileId)
      .where('processed_width', '=', processedWidth)
      .where('processed_height', '=', processedHeight)
      .executeTakeFirst();

    return image ? this.mapToImage(image) : null;
  }

  /**
   * Find all images with pagination and filtering.
   */
  async findAll(options: PaginationOptions): Promise<PaginatedResult<ImageWithFile>> {
    const { cursor, direction = 'next', limit = 20, title } = options;

    let query = this.database.db
      .selectFrom('images')
      .innerJoin('files as original_files', 'images.original_file_id', 'original_files.id')
      .leftJoin('files as processed_files', 'images.processed_file_id', 'processed_files.id')
      .select([
        'images.id as id',
        'images.title as title',
        'images.original_width as original_width',
        'images.original_height as original_height',
        'images.processed_width as processed_width',
        'images.processed_height as processed_height',
        'images.original_file_id as original_file_id',
        'images.processed_file_id as processed_file_id',
        'images.status as status',
        'images.created_at as created_at',
        'images.updated_at as updated_at',
        'original_files.id as original_file_id',
        'original_files.file_name as original_file_name',
        'original_files.file_size as original_file_size',
        'original_files.mime_type as original_mime_type',
        'original_files.url as original_url',
        'original_files.checksum as original_checksum',
        'original_files.storage_provider as original_storage_provider',
        'original_files.created_at as original_file_created_at',
        'original_files.updated_at as original_file_updated_at',
        'processed_files.id as processed_file_id_val',
        'processed_files.file_name as processed_file_name',
        'processed_files.file_size as processed_file_size',
        'processed_files.mime_type as processed_mime_type',
        'processed_files.url as processed_url',
        'processed_files.checksum as processed_checksum',
        'processed_files.storage_provider as processed_storage_provider',
        'processed_files.created_at as processed_file_created_at',
        'processed_files.updated_at as processed_file_updated_at',
      ]);

    // Apply title filter
    if (title) {
      query = query.where('images.title', 'ilike', `%${title}%`);
    }

    // Apply cursor-based pagination
    if (cursor) {
      if (direction === 'next') {
        query = query.where('images.created_at', '<', cursor);
      } else {
        query = query.where('images.created_at', '>', cursor);
      }
    }

    // Order by created_at
    if (direction === 'next') {
      query = query.orderBy('images.created_at', 'desc');
    } else {
      query = query.orderBy('images.created_at', 'asc');
    }

    // Fetch limit + 1 to check if there are more items
    const results = await query.limit(limit + 1).execute();

    // Check if there are more items
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;

    // If we're going backwards, reverse the items
    if (direction === 'prev') {
      items.reverse();
    }

    // Check for next/prev pages
    let hasNext = false;
    let hasPrev = false;

    if (direction === 'next') {
      hasNext = hasMore;
      // Check if there are previous items
      if (cursor) {
        hasPrev = true;
      }
    } else {
      hasPrev = hasMore;
      hasNext = cursor !== undefined;
    }

    return {
      items: items.map((row) => this.mapToImageWithFile(row)),
      hasNext,
      hasPrev,
    };
  }

  /**
   * Update an image record.
   */
  async update(id: string, data: UpdateImageDto): Promise<Image> {
    const image = await this.database.db
      .updateTable('images')
      .set({
        original_file_id: data.originalFileId,
        processed_file_id: data.processedFileId ?? null,
        title: data.title,
        original_width: data.originalWidth,
        original_height: data.originalHeight,
        processed_width: data.processedWidth ?? null,
        processed_height: data.processedHeight ?? null,
        status: data.status,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    this.logger.log(`Image record updated: ${id}`);

    return this.mapToImage(image);
  }

  /**
   * Map database row to Image entity.
   */
  private mapToImage(row: {
    id: string;
    title: string;
    original_width: number;
    original_height: number;
    processed_width: number | null;
    processed_height: number | null;
    original_file_id: string;
    processed_file_id: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
  }): Image {
    return {
      id: row.id,
      title: row.title,
      originalWidth: row.original_width,
      originalHeight: row.original_height,
      processedWidth: row.processed_width,
      processedHeight: row.processed_height,
      originalFileId: row.original_file_id,
      processedFileId: row.processed_file_id,
      status: row.status as ImageStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map joined database row to ImageWithFile entity.
   */
  private mapToImageWithFile(row: {
    id: string;
    title: string;
    original_width: number;
    original_height: number;
    processed_width: number | null;
    processed_height: number | null;
    original_file_id: string;
    processed_file_id: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
    original_file_name: string;
    original_file_size: string;
    original_mime_type: string;
    original_url: string;
    original_checksum: string;
    original_storage_provider: string;
    original_file_created_at: Date;
    original_file_updated_at: Date;
    processed_file_id_val: string | null;
    processed_file_name: string | null;
    processed_file_size: string | null;
    processed_mime_type: string | null;
    processed_url: string | null;
    processed_checksum: string | null;
    processed_storage_provider: string | null;
    processed_file_created_at: Date | null;
    processed_file_updated_at: Date | null;
  }): ImageWithFile {
    const result: ImageWithFile = {
      id: row.id,
      title: row.title,
      originalWidth: row.original_width,
      originalHeight: row.original_height,
      processedWidth: row.processed_width,
      processedHeight: row.processed_height,
      originalFileId: row.original_file_id,
      processedFileId: row.processed_file_id,
      status: row.status as ImageStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      originalFile: {
        id: row.original_file_id,
        fileName: row.original_file_name,
        fileSize: BigInt(row.original_file_size),
        mimeType: row.original_mime_type,
        url: row.original_url,
        checksum: row.original_checksum,
        storageProvider: row.original_storage_provider as StorageProvider,
        createdAt: row.original_file_created_at,
        updatedAt: row.original_file_updated_at,
      },
    };

    // Add processedFile if it exists
    if (row.processed_file_id_val) {
      result.processedFile = {
        id: row.processed_file_id_val,
        fileName: row.processed_file_name!,
        fileSize: BigInt(row.processed_file_size!),
        mimeType: row.processed_mime_type!,
        url: row.processed_url!,
        checksum: row.processed_checksum!,
        storageProvider: row.processed_storage_provider! as StorageProvider,
        createdAt: row.processed_file_created_at!,
        updatedAt: row.processed_file_updated_at!,
      };
    }

    return result;
  }
}
