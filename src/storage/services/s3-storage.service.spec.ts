import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { File } from '@images-api/shared/storage';
import { FileRepository, StorageConfig, StorageProvider } from '@images-api/shared/storage';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StorageError, StorageErrorCode } from '../errors/storage.error';
import { S3StorageService } from './s3-storage.service';

// Mock the shared calculateChecksum helper
jest.mock('@images-api/shared/storage', () => ({
  ...jest.requireActual('@images-api/shared/storage'),
  calculateChecksum: jest.fn(),
}));

// Mock Logger instance methods while preserving static methods
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);

// Mock AWS SDK S3Client
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
}));

jest.mock('crypto', () => ({
  ...jest.requireActual<typeof import('crypto')>('crypto'),
  randomUUID: jest.fn(),
}));

jest.mock('file-type');

import { calculateChecksum } from '@images-api/shared/storage';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

describe('S3StorageService', () => {
  let service: S3StorageService;
  let fileRepository: jest.Mocked<FileRepository>;
  let s3ClientInstance: { send: jest.Mock };
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
      provider: StorageProvider.S3,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      localStorage: {
        basePath: '',
        baseUrl: '',
      },
      s3: {
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        endpointDomain: 'amazonaws.com',
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3StorageService,
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

    service = module.get<S3StorageService>(S3StorageService);
    fileRepository = module.get(FileRepository);

    // Get the mocked S3Client instance
    s3ClientInstance = (S3Client as jest.Mock).mock.results[0].value;
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
      (calculateChecksum as jest.Mock).mockReturnValue(mockChecksum);

      // Mock S3 upload to succeed by default
      s3ClientInstance.send.mockResolvedValue({});
    });

    it('should successfully upload a new file to S3', async () => {
      fileRepository.findByChecksum.mockResolvedValue(null);
      const expectedFile: File = {
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: `https://test-bucket.s3.us-east-1.amazonaws.com/${mockUuid}.jpg`,
        storageProvider: StorageProvider.S3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fileRepository.create.mockResolvedValue(expectedFile);

      const result = await service.upload(mockBuffer);

      expect(fileRepository.findByChecksum).toHaveBeenCalledWith(mockChecksum, StorageProvider.S3);
      expect(s3ClientInstance.send).toHaveBeenCalled();
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: `${mockUuid}.jpg`,
        Body: mockBuffer,
        ContentType: 'image/jpeg',
        Metadata: {
          checksum: mockChecksum,
          originalSize: mockBuffer.length.toString(),
        },
      });
      expect(fileRepository.create).toHaveBeenCalledWith({
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: `https://test-bucket.s3.us-east-1.amazonaws.com/${mockUuid}.jpg`,
        storageProvider: StorageProvider.S3,
      });
      expect(result).toEqual(expectedFile);
    });

    it('should return existing file if checksum matches', async () => {
      const existingFile: File = {
        id: 'existing-id',
        fileName: 'existing-file.jpg',
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: 'https://test-bucket.s3.us-east-1.amazonaws.com/existing-file.jpg',
        storageProvider: StorageProvider.S3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fileRepository.findByChecksum.mockResolvedValue(existingFile);

      const result = await service.upload(mockBuffer);

      expect(fileRepository.findByChecksum).toHaveBeenCalledWith(mockChecksum, StorageProvider.S3);
      expect(s3ClientInstance.send).not.toHaveBeenCalled();
      expect(fileRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingFile);
    });

    it('should throw FILE_TOO_LARGE error when file size exceeds maxFileSize', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      await expect(service.upload(largeBuffer)).rejects.toThrow(StorageError);
      await expect(service.upload(largeBuffer)).rejects.toMatchObject({
        code: StorageErrorCode.FILE_TOO_LARGE,
      });

      expect(fileRepository.findByChecksum).not.toHaveBeenCalled();
      expect(s3ClientInstance.send).not.toHaveBeenCalled();
    });

    it('should throw UNSUPPORTED_FILE_TYPE error when file type is null', async () => {
      fileRepository.findByChecksum.mockResolvedValue(null);
      (fileTypeFromBuffer as jest.Mock).mockResolvedValue(null);

      await expect(service.upload(mockBuffer)).rejects.toThrow(StorageError);
      await expect(service.upload(mockBuffer)).rejects.toMatchObject({
        code: StorageErrorCode.UNSUPPORTED_FILE_TYPE,
        message: 'Unable to detect file type',
      });

      expect(s3ClientInstance.send).not.toHaveBeenCalled();
      expect(fileRepository.create).not.toHaveBeenCalled();
    });

    it('should throw UNSUPPORTED_FILE_TYPE error when file type has no mime', async () => {
      fileRepository.findByChecksum.mockResolvedValue(null);
      (fileTypeFromBuffer as jest.Mock).mockResolvedValue({ mime: null, ext: 'jpg' });

      await expect(service.upload(mockBuffer)).rejects.toThrow(StorageError);
      await expect(service.upload(mockBuffer)).rejects.toMatchObject({
        code: StorageErrorCode.UNSUPPORTED_FILE_TYPE,
        message: 'File type has no mime type',
      });

      expect(s3ClientInstance.send).not.toHaveBeenCalled();
      expect(fileRepository.create).not.toHaveBeenCalled();
    });

    it('should throw UNSUPPORTED_FILE_TYPE error when file type has no extension', async () => {
      fileRepository.findByChecksum.mockResolvedValue(null);
      (fileTypeFromBuffer as jest.Mock).mockResolvedValue({ mime: 'image/jpeg', ext: null });

      await expect(service.upload(mockBuffer)).rejects.toThrow(StorageError);
      await expect(service.upload(mockBuffer)).rejects.toMatchObject({
        code: StorageErrorCode.UNSUPPORTED_FILE_TYPE,
        message: 'File type has no extension',
      });

      expect(s3ClientInstance.send).not.toHaveBeenCalled();
      expect(fileRepository.create).not.toHaveBeenCalled();
    });

    it('should throw UPLOAD_FAILED error when S3 upload fails', async () => {
      fileRepository.findByChecksum.mockResolvedValue(null);
      const s3Error = new Error('S3 upload failed');
      s3ClientInstance.send.mockRejectedValue(s3Error);

      await expect(service.upload(mockBuffer)).rejects.toThrow(StorageError);
      await expect(service.upload(mockBuffer)).rejects.toMatchObject({
        code: StorageErrorCode.UPLOAD_FAILED,
        message: 'Failed to upload file',
      });

      expect(fileRepository.create).not.toHaveBeenCalled();
    });

    it('should calculate checksum using SHA-256', async () => {
      fileRepository.findByChecksum.mockResolvedValue(null);
      (calculateChecksum as jest.Mock).mockReturnValue(mockChecksum);

      const expectedFile: File = {
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: `https://s3.us-east-1.amazonaws.com/${mockUuid}.jpg`,
        storageProvider: StorageProvider.S3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fileRepository.create.mockResolvedValue(expectedFile);

      await service.upload(mockBuffer);

      expect(calculateChecksum).toHaveBeenCalledWith(mockBuffer);
      expect(fileRepository.findByChecksum).toHaveBeenCalledWith(mockChecksum, StorageProvider.S3);
    });

    it('should generate correct S3 URL for the uploaded file', async () => {
      fileRepository.findByChecksum.mockResolvedValue(null);
      const expectedFile: File = {
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: `https://test-bucket.s3.us-east-1.amazonaws.com/${mockUuid}.jpg`,
        storageProvider: StorageProvider.S3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fileRepository.create.mockResolvedValue(expectedFile);

      const result = await service.upload(mockBuffer);

      expect(result.url).toBe(`https://test-bucket.s3.us-east-1.amazonaws.com/${mockUuid}.jpg`);
      expect(fileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `https://test-bucket.s3.us-east-1.amazonaws.com/${mockUuid}.jpg`,
        }),
      );
    });

    it('should store file metadata with correct S3 provider', async () => {
      fileRepository.findByChecksum.mockResolvedValue(null);
      const expectedFile: File = {
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: `https://test-bucket.s3.us-east-1.amazonaws.com/${mockUuid}.jpg`,
        storageProvider: StorageProvider.S3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fileRepository.create.mockResolvedValue(expectedFile);

      await service.upload(mockBuffer);

      expect(fileRepository.create).toHaveBeenCalledWith({
        id: mockUuid,
        fileName: `${mockUuid}.jpg`,
        fileSize: BigInt(mockBuffer.length),
        mimeType: 'image/jpeg',
        checksum: mockChecksum,
        url: `https://test-bucket.s3.us-east-1.amazonaws.com/${mockUuid}.jpg`,
        storageProvider: StorageProvider.S3,
      });
    });
  });
});
