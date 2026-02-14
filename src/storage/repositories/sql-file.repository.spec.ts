import type { CreateFileDto } from '@images-api/shared/storage';
import { StorageProvider } from '@images-api/shared/storage';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database/database.service';
import { SqlFileRepository } from './sql-file.repository';

// Mock Logger instance methods while preserving static methods
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);

describe('SqlFileRepository', () => {
  let repository: SqlFileRepository;
  let mockDb: any;

  // Mock Kysely query builder
  const createMockQueryBuilder = () => {
    const mockBuilder: any = {
      selectFrom: jest.fn().mockReturnThis(),
      insertInto: jest.fn().mockReturnThis(),
      updateTable: jest.fn().mockReturnThis(),
      deleteFrom: jest.fn().mockReturnThis(),
      selectAll: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      returningAll: jest.fn().mockReturnThis(),
      executeTakeFirst: jest.fn(),
      executeTakeFirstOrThrow: jest.fn(),
      execute: jest.fn(),
    };
    return mockBuilder;
  };

  beforeAll(async () => {
    mockDb = createMockQueryBuilder();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqlFileRepository,
        {
          provide: DatabaseService,
          useValue: {
            db: mockDb,
          },
        },
      ],
    }).compile();

    repository = module.get<SqlFileRepository>(SqlFileRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new file record successfully', async () => {
      const createDto: CreateFileDto = {
        id: 'test-uuid',
        fileName: 'test-file.jpg',
        fileSize: BigInt(1024),
        mimeType: 'image/jpeg',
        checksum: 'a'.repeat(64),
        url: 'http://localhost:3000/uploads/test-file.jpg',
        storageProvider: StorageProvider.LOCAL,
      };

      const mockDbRow = {
        id: createDto.id,
        file_name: createDto.fileName,
        file_size: '1024',
        mime_type: createDto.mimeType,
        checksum: createDto.checksum,
        url: createDto.url,
        storage_provider: 'LOCAL',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.executeTakeFirstOrThrow.mockResolvedValue(mockDbRow);

      const result = await repository.create(createDto);

      expect(mockDb.insertInto).toHaveBeenCalledWith('files');
      expect(mockDb.values).toHaveBeenCalledWith({
        id: createDto.id,
        file_name: createDto.fileName,
        file_size: '1024',
        mime_type: createDto.mimeType,
        checksum: createDto.checksum,
        url: createDto.url,
        storage_provider: StorageProvider.LOCAL,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
      expect(result).toEqual({
        id: createDto.id,
        fileName: createDto.fileName,
        fileSize: BigInt(1024),
        mimeType: createDto.mimeType,
        checksum: createDto.checksum,
        url: createDto.url,
        storageProvider: StorageProvider.LOCAL,
        createdAt: mockDbRow.created_at,
        updatedAt: mockDbRow.updated_at,
      });
    });
  });

  describe('findByChecksum', () => {
    it('should return file when found by checksum', async () => {
      const checksum = 'a'.repeat(64);
      const mockDbRow = {
        id: 'test-uuid',
        file_name: 'test-file.jpg',
        file_size: '1024',
        mime_type: 'image/jpeg',
        checksum,
        url: 'http://localhost:3000/uploads/test-file.jpg',
        storage_provider: 'LOCAL',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.executeTakeFirst.mockResolvedValue(mockDbRow);

      const result = await repository.findByChecksum(checksum, StorageProvider.LOCAL);

      expect(mockDb.selectFrom).toHaveBeenCalledWith('files');
      expect(mockDb.where).toHaveBeenCalledWith('checksum', '=', checksum);
      expect(mockDb.where).toHaveBeenCalledWith('storage_provider', '=', StorageProvider.LOCAL);
      expect(result).toEqual({
        id: 'test-uuid',
        fileName: 'test-file.jpg',
        fileSize: BigInt(1024),
        mimeType: 'image/jpeg',
        checksum,
        url: 'http://localhost:3000/uploads/test-file.jpg',
        storageProvider: StorageProvider.LOCAL,
        createdAt: mockDbRow.created_at,
        updatedAt: mockDbRow.updated_at,
      });
    });

    it('should return null when file not found by checksum', async () => {
      mockDb.executeTakeFirst.mockResolvedValue(undefined);

      const result = await repository.findByChecksum('non-existent-checksum', StorageProvider.LOCAL);

      expect(result).toBeNull();
    });

    it('should not return file when checksum matches but storage provider differs', async () => {
      const checksum = 'a'.repeat(64);

      // File exists in LOCAL storage
      mockDb.executeTakeFirst.mockResolvedValue(undefined);

      // But we're searching for S3
      const result = await repository.findByChecksum(checksum, StorageProvider.S3);

      expect(mockDb.selectFrom).toHaveBeenCalledWith('files');
      expect(mockDb.where).toHaveBeenCalledWith('checksum', '=', checksum);
      expect(mockDb.where).toHaveBeenCalledWith('storage_provider', '=', StorageProvider.S3);
      expect(result).toBeNull();
    });
  });
});
