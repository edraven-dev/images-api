import type { File } from '@images-api/shared/storage';
import { FileRepository, FileStatus, StorageConfig } from '@images-api/shared/storage';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { promises as fs } from 'fs';
import { StorageError, StorageErrorCode } from '../errors/storage.error';
import { LocalStorageService } from './local-storage.service';

// Mock Logger instance methods while preserving static methods
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);

// Mock modules
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
  },
}));

jest.mock('crypto', () => ({
  ...jest.requireActual<typeof import('crypto')>('crypto'),
  randomUUID: jest.fn(),
}));

jest.mock('file-type');

import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  let fileRepository: jest.Mocked<FileRepository>;
  let mockConfig: StorageConfig;

  const mockFileRepository = {
    findByChecksum: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByUrl: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  beforeAll(async () => {
    mockConfig = {
      basePath: './uploads',
      baseUrl: 'http://localhost:3000/uploads',
      maxFileSize: 10 * 1024 * 1024, // 10MB
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStorageService,
        {
          provide: StorageConfig,
          useValue: mockConfig,
        },
        {
          provide: FileRepository,
          useValue: mockFileRepository,
        },
      ],
    }).compile();

    service = module.get<LocalStorageService>(LocalStorageService);
    fileRepository = module.get(FileRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    const mockBuffer = Buffer.from('test file content');
    const mockUuid = '550e8400-e29b-41d4-a716-446655440000';
    const mockChecksum = 'a'.repeat(64); // Mock SHA-256 hash
    const mockFileType = { mime: 'image/jpeg', ext: 'jpg' };

    beforeEach(() => {
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      (fileTypeFromBuffer as jest.Mock).mockResolvedValue(mockFileType);

      // Mock fs operations to succeed by default
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    });

    it('should upload a new file successfully', async () => {
      const expectedFile: File = {
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: `http://localhost:3000/uploads/${mockUuid}.jpg`,
        status: FileStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      fileRepository.findByChecksum.mockResolvedValue(null);
      fileRepository.create.mockResolvedValue(expectedFile);

      const result = await service.upload(mockBuffer);

      expect(fileRepository.findByChecksum).toHaveBeenCalledWith(expect.any(String));
      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining(mockUuid), mockBuffer);
      expect(fileRepository.create).toHaveBeenCalledWith({
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: expect.any(String),
        url: `http://localhost:3000/uploads/${mockUuid}.jpg`,
        status: FileStatus.COMPLETED,
      });
      expect(result).toEqual(expectedFile);
    });

    it('should return existing file when checksum matches', async () => {
      const existingFile: File = {
        id: 'existing-uuid',
        fileName: 'existing-file.jpg',
        fileSize: BigInt(100),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: 'http://localhost:3000/uploads/existing-file.jpg',
        status: FileStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      fileRepository.findByChecksum.mockResolvedValue(existingFile);

      const result = await service.upload(mockBuffer);

      expect(fileRepository.findByChecksum).toHaveBeenCalledWith(expect.any(String));
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(fileRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingFile);
    });

    it('should throw FILE_TOO_LARGE error when file exceeds max size', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      await expect(service.upload(largeBuffer)).rejects.toThrow(StorageError);
      await expect(service.upload(largeBuffer)).rejects.toMatchObject({
        code: StorageErrorCode.FILE_TOO_LARGE,
      });

      expect(fileRepository.findByChecksum).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should not validate file size when maxFileSize is 0', async () => {
      mockConfig.maxFileSize = 0;
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB

      const expectedFile: File = {
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(largeBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: `http://localhost:3000/uploads/${mockUuid}.jpg`,
        status: FileStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      fileRepository.findByChecksum.mockResolvedValue(null);
      fileRepository.create.mockResolvedValue(expectedFile);

      await expect(service.upload(largeBuffer)).resolves.toBeDefined();
    });

    it('should throw UNSUPPORTED_FILE_TYPE when file type cannot be detected', async () => {
      (fileTypeFromBuffer as jest.Mock).mockResolvedValue(null);

      fileRepository.findByChecksum.mockResolvedValue(null);

      await expect(service.upload(mockBuffer)).rejects.toThrow(StorageError);
      await expect(service.upload(mockBuffer)).rejects.toMatchObject({
        code: StorageErrorCode.UNSUPPORTED_FILE_TYPE,
        message: expect.stringContaining('Unable to detect file type'),
      });
    });

    it('should throw UNSUPPORTED_FILE_TYPE when mime type is missing', async () => {
      (fileTypeFromBuffer as jest.Mock).mockResolvedValue({ ext: 'jpg' });

      fileRepository.findByChecksum.mockResolvedValue(null);

      await expect(service.upload(mockBuffer)).rejects.toThrow(StorageError);
      await expect(service.upload(mockBuffer)).rejects.toMatchObject({
        code: StorageErrorCode.UNSUPPORTED_FILE_TYPE,
      });
    });

    it('should throw UNSUPPORTED_FILE_TYPE when extension is missing', async () => {
      (fileTypeFromBuffer as jest.Mock).mockResolvedValue({ mime: 'image/jpeg' });

      fileRepository.findByChecksum.mockResolvedValue(null);

      await expect(service.upload(mockBuffer)).rejects.toThrow(StorageError);
      await expect(service.upload(mockBuffer)).rejects.toMatchObject({
        code: StorageErrorCode.UNSUPPORTED_FILE_TYPE,
      });
    });

    it('should throw UPLOAD_FAILED when file write fails', async () => {
      const writeError = new Error('Disk full');
      (fs.writeFile as jest.Mock).mockRejectedValue(writeError);

      fileRepository.findByChecksum.mockResolvedValue(null);

      await expect(service.upload(mockBuffer)).rejects.toThrow(StorageError);
      await expect(service.upload(mockBuffer)).rejects.toMatchObject({
        code: StorageErrorCode.UPLOAD_FAILED,
      });
    });

    it('should create directories recursively', async () => {
      const expectedFile: File = {
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: `http://localhost:3000/uploads/${mockUuid}.jpg`,
        status: FileStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      fileRepository.findByChecksum.mockResolvedValue(null);
      fileRepository.create.mockResolvedValue(expectedFile);

      await service.upload(mockBuffer);

      expect(fs.mkdir).toHaveBeenCalledWith('uploads', {
        recursive: true,
      });
    });

    it('should generate correct file path and URL', async () => {
      const expectedFile: File = {
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: `http://localhost:3000/uploads/${mockUuid}.jpg`,
        status: FileStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      fileRepository.findByChecksum.mockResolvedValue(null);
      fileRepository.create.mockResolvedValue(expectedFile);

      await service.upload(mockBuffer);

      expect(fileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: `${mockUuid}.jpg`,
          url: `http://localhost:3000/uploads/${mockUuid}.jpg`,
        }),
      );
    });

    it('should calculate checksum correctly', async () => {
      const expectedFile: File = {
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: `http://localhost:3000/uploads/${mockUuid}.jpg`,
        status: FileStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      fileRepository.findByChecksum.mockResolvedValue(null);
      fileRepository.create.mockResolvedValue(expectedFile);

      await service.upload(mockBuffer);

      // Checksum should be a 64-character hex string (SHA-256)
      expect(fileRepository.findByChecksum).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    });
  });
});
