import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database/database.service';
import { SqlImageRepository } from './sql-image.repository';

describe('SqlImageRepository', () => {
  let repository: SqlImageRepository;
  let mockLogger: jest.Mocked<Logger>;
  let mockDatabaseService: any;

  const mockImage = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Image',
    original_width: 800,
    original_height: 600,
    processed_width: null,
    processed_height: null,
    original_file_id: '123e4567-e89b-12d3-a456-426614174001',
    processed_file_id: null,
    status: 'processing',
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-01T00:00:00Z'),
  };

  const mockFile = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    file_name: 'test.jpg',
    mime_type: 'image/jpeg',
    file_size: '1024',
    checksum: 'abc123',
    url: '/uploads/test.jpg',
    storage_provider: 'LOCAL',
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    const mockQueryBuilder = {
      selectFrom: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      selectAll: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      insertInto: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      returningAll: jest.fn().mockReturnThis(),
      updateTable: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      deleteFrom: jest.fn().mockReturnThis(),
      executeTakeFirst: jest.fn(),
      executeTakeFirstOrThrow: jest.fn(),
      execute: jest.fn(),
    };

    mockDatabaseService = {
      db: mockQueryBuilder,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqlImageRepository,
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    repository = module.get<SqlImageRepository>(SqlImageRepository);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new image', async () => {
      mockDatabaseService.db.executeTakeFirstOrThrow.mockResolvedValue(mockImage);

      const dto = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Image',
        originalWidth: 800,
        originalHeight: 600,
        originalFileId: '123e4567-e89b-12d3-a456-426614174001',
      };

      const result = await repository.create(dto);

      expect(mockDatabaseService.db.insertInto).toHaveBeenCalledWith('images');
      expect(mockDatabaseService.db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: dto.id,
          title: dto.title,
          original_width: dto.originalWidth,
          original_height: dto.originalHeight,
          original_file_id: dto.originalFileId,
        }),
      );
      expect(mockDatabaseService.db.returningAll).toHaveBeenCalled();
      expect(mockDatabaseService.db.executeTakeFirstOrThrow).toHaveBeenCalled();
      expect(result).toEqual({
        id: mockImage.id,
        title: mockImage.title,
        originalWidth: mockImage.original_width,
        originalHeight: mockImage.original_height,
        processedWidth: mockImage.processed_width,
        processedHeight: mockImage.processed_height,
        originalFileId: mockImage.original_file_id,
        processedFileId: null,
        status: 'processing',
        createdAt: mockImage.created_at,
        updatedAt: mockImage.updated_at,
      });
    });

    it('should create image with empty originalFileId', async () => {
      const imageWithoutFile = { ...mockImage, original_file_id: '' };
      mockDatabaseService.db.executeTakeFirstOrThrow.mockResolvedValue(imageWithoutFile);

      const dto = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Image',
        originalWidth: 0,
        originalHeight: 0,
        originalFileId: '',
      };

      const result = await repository.create(dto);

      expect(mockDatabaseService.db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: dto.id,
          title: dto.title,
          original_width: dto.originalWidth,
          original_height: dto.originalHeight,
          original_file_id: '',
        }),
      );
      expect(result.originalFileId).toBe('');
      expect(result.processedFileId).toBe(null);
      expect(result.status).toBe('processing');
    });
  });

  describe('findById', () => {
    it('should return image when found', async () => {
      mockDatabaseService.db.executeTakeFirst.mockResolvedValue(mockImage);

      const result = await repository.findById(mockImage.id);

      expect(mockDatabaseService.db.selectFrom).toHaveBeenCalledWith('images');
      expect(mockDatabaseService.db.where).toHaveBeenCalledWith('id', '=', mockImage.id);
      expect(mockDatabaseService.db.executeTakeFirst).toHaveBeenCalled();
      expect(result).toEqual({
        id: mockImage.id,
        title: mockImage.title,
        originalWidth: mockImage.original_width,
        originalHeight: mockImage.original_height,
        processedWidth: mockImage.processed_width,
        processedHeight: mockImage.processed_height,
        originalFileId: mockImage.original_file_id,
        processedFileId: mockImage.processed_file_id,
        status: mockImage.status,
        createdAt: mockImage.created_at,
        updatedAt: mockImage.updated_at,
      });
    });

    it('should return null when image not found', async () => {
      mockDatabaseService.db.executeTakeFirst.mockResolvedValue(undefined);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithFile', () => {
    it('should return image with file when found', async () => {
      const mockResult = {
        id: mockImage.id,
        title: mockImage.title,
        original_width: mockImage.original_width,
        original_height: mockImage.original_height,
        processed_width: mockImage.processed_width,
        processed_height: mockImage.processed_height,
        original_file_id: mockImage.original_file_id,
        processed_file_id: mockImage.processed_file_id,
        status: mockImage.status,
        created_at: mockImage.created_at,
        updated_at: mockImage.updated_at,
        original_file_name: mockFile.file_name,
        original_mime_type: mockFile.mime_type,
        original_file_size: mockFile.file_size,
        original_checksum: mockFile.checksum,
        original_url: mockFile.url,
        original_storage_provider: mockFile.storage_provider,
        original_file_created_at: mockFile.created_at,
        original_file_updated_at: mockFile.updated_at,
        processed_file_id_val: null,
        processed_file_name: null,
        processed_file_size: null,
        processed_mime_type: null,
        processed_url: null,
        processed_checksum: null,
        processed_storage_provider: null,
        processed_file_created_at: null,
        processed_file_updated_at: null,
      };

      mockDatabaseService.db.executeTakeFirst.mockResolvedValue(mockResult);

      const result = await repository.findByIdWithFile(mockImage.id);

      expect(mockDatabaseService.db.selectFrom).toHaveBeenCalledWith('images');
      expect(mockDatabaseService.db.innerJoin).toHaveBeenCalledWith(
        'files as original_files',
        'images.original_file_id',
        'original_files.id',
      );
      expect(mockDatabaseService.db.leftJoin).toHaveBeenCalledWith(
        'files as processed_files',
        'images.processed_file_id',
        'processed_files.id',
      );
      expect(mockDatabaseService.db.where).toHaveBeenCalledWith('images.id', '=', mockImage.id);
      expect(result).toEqual({
        id: mockImage.id,
        title: mockImage.title,
        originalWidth: mockImage.original_width,
        originalHeight: mockImage.original_height,
        processedWidth: mockImage.processed_width,
        processedHeight: mockImage.processed_height,
        originalFileId: mockImage.original_file_id,
        processedFileId: mockImage.processed_file_id,
        status: mockImage.status,
        createdAt: mockImage.created_at,
        updatedAt: mockImage.updated_at,
        originalFile: {
          id: mockImage.original_file_id,
          fileName: mockFile.file_name,
          mimeType: mockFile.mime_type,
          fileSize: BigInt(mockFile.file_size),
          checksum: mockFile.checksum,
          url: mockFile.url,
          storageProvider: mockFile.storage_provider,
          createdAt: mockFile.created_at,
          updatedAt: mockFile.updated_at,
        },
      });
    });

    it('should return null when image not found', async () => {
      mockDatabaseService.db.executeTakeFirst.mockResolvedValue(undefined);

      const result = await repository.findByIdWithFile('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByOriginalFileIdAndProcessedDimensions', () => {
    it('should return image when found by original file ID and processed dimensions', async () => {
      mockDatabaseService.db.executeTakeFirst.mockResolvedValue(mockImage);

      const result = await repository.findByOriginalFileIdAndProcessedDimensions(mockImage.original_file_id, 800, 600);

      expect(mockDatabaseService.db.where).toHaveBeenCalledWith('original_file_id', '=', mockImage.original_file_id);
      expect(mockDatabaseService.db.where).toHaveBeenCalledWith('processed_width', '=', 800);
      expect(mockDatabaseService.db.where).toHaveBeenCalledWith('processed_height', '=', 600);
      expect(result).toEqual({
        id: mockImage.id,
        title: mockImage.title,
        originalWidth: mockImage.original_width,
        originalHeight: mockImage.original_height,
        processedWidth: mockImage.processed_width,
        processedHeight: mockImage.processed_height,
        originalFileId: mockImage.original_file_id,
        processedFileId: mockImage.processed_file_id,
        status: mockImage.status,
        createdAt: mockImage.created_at,
        updatedAt: mockImage.updated_at,
      });
    });

    it('should return null when image not found', async () => {
      mockDatabaseService.db.executeTakeFirst.mockResolvedValue(undefined);

      const result = await repository.findByOriginalFileIdAndProcessedDimensions('non-existent-file-id', 800, 600);

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    const mockImageWithFileRow = {
      id: mockImage.id,
      title: mockImage.title,
      original_width: mockImage.original_width,
      original_height: mockImage.original_height,
      processed_width: mockImage.processed_width,
      processed_height: mockImage.processed_height,
      original_file_id: mockImage.original_file_id,
      processed_file_id: mockImage.processed_file_id,
      status: mockImage.status,
      created_at: mockImage.created_at,
      updated_at: mockImage.updated_at,
      original_file_name: mockFile.file_name,
      original_mime_type: mockFile.mime_type,
      original_file_size: mockFile.file_size,
      original_checksum: mockFile.checksum,
      original_url: mockFile.url,
      original_storage_provider: mockFile.storage_provider,
      original_file_created_at: mockFile.created_at,
      original_file_updated_at: mockFile.updated_at,
      processed_file_id_val: null,
      processed_file_name: null,
      processed_file_size: null,
      processed_mime_type: null,
      processed_url: null,
      processed_checksum: null,
      processed_storage_provider: null,
      processed_file_created_at: null,
      processed_file_updated_at: null,
    };

    it('should return paginated results with default options (next direction)', async () => {
      mockDatabaseService.db.execute.mockResolvedValue([mockImageWithFileRow]);

      const result = await repository.findAll({ limit: 20, direction: 'next' });

      expect(mockDatabaseService.db.selectFrom).toHaveBeenCalledWith('images');
      expect(mockDatabaseService.db.orderBy).toHaveBeenCalledWith('images.created_at', 'desc');
      expect(mockDatabaseService.db.limit).toHaveBeenCalledWith(21);
      expect(result.items).toHaveLength(1);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });

    it('should return results with title filter', async () => {
      mockDatabaseService.db.execute.mockResolvedValue([mockImageWithFileRow]);

      await repository.findAll({
        limit: 20,
        direction: 'next',
        title: 'test',
      });

      expect(mockDatabaseService.db.where).toHaveBeenCalledWith('images.title', 'ilike', '%test%');
    });

    it('should return results with cursor for next direction', async () => {
      const cursor = new Date('2025-01-02T00:00:00Z');
      mockDatabaseService.db.execute.mockResolvedValue([mockImageWithFileRow]);

      await repository.findAll({
        limit: 20,
        direction: 'next',
        cursor,
      });

      expect(mockDatabaseService.db.where).toHaveBeenCalledWith('images.created_at', '<', cursor);
      expect(mockDatabaseService.db.orderBy).toHaveBeenCalledWith('images.created_at', 'desc');
    });

    it('should return results with cursor for prev direction', async () => {
      const cursor = new Date('2025-01-02T00:00:00Z');
      mockDatabaseService.db.execute.mockResolvedValue([mockImageWithFileRow]);

      await repository.findAll({
        limit: 20,
        direction: 'prev',
        cursor,
      });

      expect(mockDatabaseService.db.where).toHaveBeenCalledWith('images.created_at', '>', cursor);
      expect(mockDatabaseService.db.orderBy).toHaveBeenCalledWith('images.created_at', 'asc');
    });

    it('should detect hasNext when there are more results', async () => {
      const results = Array(21).fill(mockImageWithFileRow);
      mockDatabaseService.db.execute.mockResolvedValue(results);

      const result = await repository.findAll({ limit: 20, direction: 'next' });

      expect(result.items).toHaveLength(20);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(false);
    });

    it('should detect hasPrev when there are more results in prev direction', async () => {
      const results = Array(21).fill(mockImageWithFileRow);
      mockDatabaseService.db.execute.mockResolvedValue(results);

      const result = await repository.findAll({ limit: 20, direction: 'prev' });

      expect(result.items).toHaveLength(20);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(true);
    });

    it('should return empty results when no images found', async () => {
      mockDatabaseService.db.execute.mockResolvedValue([]);

      const result = await repository.findAll({ limit: 20, direction: 'next' });

      expect(result.items).toHaveLength(0);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });
  });

  describe('update', () => {
    it('should update image successfully', async () => {
      const updatedImage = { ...mockImage, title: 'Updated Title' };
      mockDatabaseService.db.executeTakeFirstOrThrow.mockResolvedValue(updatedImage);

      const result = await repository.update(mockImage.id, {
        title: 'Updated Title',
      });

      expect(mockDatabaseService.db.updateTable).toHaveBeenCalledWith('images');
      expect(mockDatabaseService.db.set).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title',
          updated_at: expect.any(Date),
        }),
      );
      expect(mockDatabaseService.db.where).toHaveBeenCalledWith('id', '=', mockImage.id);
      expect(result).toEqual({
        id: updatedImage.id,
        title: 'Updated Title',
        originalWidth: updatedImage.original_width,
        originalHeight: updatedImage.original_height,
        processedWidth: updatedImage.processed_width,
        processedHeight: updatedImage.processed_height,
        originalFileId: updatedImage.original_file_id,
        processedFileId: updatedImage.processed_file_id,
        status: updatedImage.status,
        createdAt: updatedImage.created_at,
        updatedAt: updatedImage.updated_at,
      });
    });

    it('should update dimensions and originalFileId', async () => {
      const updatedImage = {
        ...mockImage,
        processed_width: 1920,
        processed_height: 1080,
        original_file_id: 'new-file-id',
      };
      mockDatabaseService.db.executeTakeFirstOrThrow.mockResolvedValue(updatedImage);

      const result = await repository.update(mockImage.id, {
        processedWidth: 1920,
        processedHeight: 1080,
        originalFileId: 'new-file-id',
      });

      expect(mockDatabaseService.db.set).toHaveBeenCalledWith(
        expect.objectContaining({
          processed_width: 1920,
          processed_height: 1080,
          original_file_id: 'new-file-id',
          updated_at: expect.any(Date),
        }),
      );
      expect(result).toEqual({
        id: updatedImage.id,
        title: updatedImage.title,
        originalWidth: mockImage.original_width,
        originalHeight: mockImage.original_height,
        processedWidth: 1920,
        processedHeight: 1080,
        originalFileId: 'new-file-id',
        processedFileId: updatedImage.processed_file_id,
        status: updatedImage.status,
        createdAt: updatedImage.created_at,
        updatedAt: updatedImage.updated_at,
      });
    });

    it('should throw when image not found', async () => {
      mockDatabaseService.db.executeTakeFirstOrThrow.mockRejectedValue(new Error('No result'));

      await expect(
        repository.update('non-existent-id', {
          title: 'Updated',
        }),
      ).rejects.toThrow();
    });
  });
});
