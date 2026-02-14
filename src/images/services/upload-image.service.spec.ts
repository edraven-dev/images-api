/* eslint-disable @typescript-eslint/no-unsafe-argument */
// Mock file-type before imports
jest.mock('file-type');

import { ImageStatus } from '@images-api/shared/images';
import { ImageProcessingQueue } from '@images-api/shared/images/queues';
import { StorageConfig, StorageService } from '@images-api/shared/storage';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, Logger, PayloadTooLargeException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { fileTypeFromBuffer } from 'file-type';
import { ImageProcessingService } from './image-processing.service';
import { ImagesService } from './images.service';
import { UploadImageService } from './upload-image.service';

describe('UploadImageService', () => {
  let service: UploadImageService;
  let mockImagesService: jest.Mocked<ImagesService>;
  let mockQueue: jest.Mocked<Queue>;
  let mockStorageConfig: StorageConfig;
  let mockStorageService: jest.Mocked<any>;
  let mockImageProcessingService: jest.Mocked<ImageProcessingService>;

  const mockMulterFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('test-image-data'),
    size: 1024,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  const mockFile = {
    id: 'file-123',
    fileName: 'test.jpg',
    fileSize: BigInt(1024),
    mimeType: 'image/jpeg',
    url: 'https://storage.example.com/test.jpg',
    checksum: 'abc123checksum',
    storageProvider: 'LOCAL' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockImage = {
    id: 'image-123',
    title: 'Test Image',
    originalWidth: 1920,
    originalHeight: 1080,
    processedWidth: 800,
    processedHeight: 600,
    originalFileId: 'file-123',
    processedFileId: 'processed-file-123',
    status: ImageStatus.STORED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockImagesService = {
      createImage: jest.fn(),
      findByOriginalFileIdAndProcessedDimensions: jest.fn(),
    } as any;

    mockQueue = {
      add: jest.fn(),
    } as any;

    mockStorageConfig = {
      maxFileSize: 10485760, // 10MB
    } as any;

    mockStorageService = {
      upload: jest.fn(),
      findByChecksum: jest.fn(),
    };

    mockImageProcessingService = {
      getImageDimensions: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadImageService,
        {
          provide: ImagesService,
          useValue: mockImagesService,
        },
        {
          provide: getQueueToken(ImageProcessingQueue),
          useValue: mockQueue,
        },
        {
          provide: StorageConfig,
          useValue: mockStorageConfig,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: ImageProcessingService,
          useValue: mockImageProcessingService,
        },
      ],
    }).compile();

    service = module.get<UploadImageService>(UploadImageService);

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    describe('validation', () => {
      it('should throw BadRequestException for invalid file type', async () => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue({
          mime: 'application/pdf',
          ext: 'pdf',
        });

        await expect(
          service.upload(mockMulterFile, {
            title: 'Test',
            width: 800,
            height: 600,
          }),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.upload(mockMulterFile, {
            title: 'Test',
            width: 800,
            height: 600,
          }),
        ).rejects.toThrow('Invalid file type. Only JPG, PNG, and WebP images are allowed.');
      });

      it('should throw BadRequestException when file type is undefined', async () => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue(null);

        await expect(
          service.upload(mockMulterFile, {
            title: 'Test',
            width: 800,
            height: 600,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw PayloadTooLargeException when file exceeds max size', async () => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue({
          mime: 'image/jpeg',
          ext: 'jpg',
        });

        const largeFile = {
          ...mockMulterFile,
          buffer: Buffer.alloc(20 * 1024 * 1024), // 20MB
        };

        await expect(
          service.upload(largeFile, {
            title: 'Test',
            width: 800,
            height: 600,
          }),
        ).rejects.toThrow(PayloadTooLargeException);
      });

      it('should accept valid JPEG files', async () => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue({
          mime: 'image/jpeg',
          ext: 'jpg',
        });

        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 800,
          height: 600,
        });

        mockStorageService.findByChecksum.mockResolvedValue(null);
        mockStorageService.upload.mockResolvedValue(mockFile);
        mockImagesService.createImage.mockResolvedValue(mockImage as any);

        const result = await service.upload(mockMulterFile, {
          title: 'Test',
          width: 800,
          height: 600,
        });

        expect(result).toHaveProperty('id');
        expect(fileTypeFromBuffer).toHaveBeenCalledWith(mockMulterFile.buffer);
      });

      it('should accept valid PNG files', async () => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue({
          mime: 'image/png',
          ext: 'png',
        });

        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 800,
          height: 600,
        });

        mockStorageService.findByChecksum.mockResolvedValue(null);
        mockStorageService.upload.mockResolvedValue(mockFile);
        mockImagesService.createImage.mockResolvedValue(mockImage as any);

        const result = await service.upload(mockMulterFile, {
          title: 'Test',
          width: 800,
          height: 600,
        });

        expect(result).toHaveProperty('id');
      });

      it('should accept valid WebP files', async () => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue({
          mime: 'image/webp',
          ext: 'webp',
        });

        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 800,
          height: 600,
        });

        mockStorageService.findByChecksum.mockResolvedValue(null);
        mockStorageService.upload.mockResolvedValue(mockFile);
        mockImagesService.createImage.mockResolvedValue(mockImage as any);

        const result = await service.upload(mockMulterFile, {
          title: 'Test',
          width: 800,
          height: 600,
        });

        expect(result).toHaveProperty('id');
      });
    });

    describe('new file upload', () => {
      beforeEach(() => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue({
          mime: 'image/jpeg',
          ext: 'jpg',
        });

        mockStorageService.findByChecksum.mockResolvedValue(null);
      });

      it('should upload new file and create STORED image when dimensions match', async () => {
        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 800,
          height: 600,
        });

        mockStorageService.upload.mockResolvedValue(mockFile);
        mockImagesService.createImage.mockResolvedValue(mockImage as any);

        const result = await service.upload(mockMulterFile, {
          title: 'Test Image',
          width: 800,
          height: 600,
        });

        expect(result).toHaveProperty('id');
        expect(mockStorageService.upload).toHaveBeenCalledWith(mockMulterFile.buffer);
        expect(mockImagesService.createImage).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Image',
            originalWidth: 800,
            originalHeight: 600,
            processedWidth: 800,
            processedHeight: 600,
            status: ImageStatus.STORED,
            originalFileId: mockFile.id,
            processedFileId: mockFile.id,
          }),
        );
        expect(mockQueue.add).not.toHaveBeenCalled();
      });

      it('should upload new file and create PROCESSING image when dimensions do not match', async () => {
        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 1920,
          height: 1080,
        });

        mockStorageService.upload.mockResolvedValue(mockFile);
        mockImagesService.createImage.mockResolvedValue(mockImage as any);

        const result = await service.upload(mockMulterFile, {
          title: 'Test Image',
          width: 800,
          height: 600,
        });

        expect(result).toHaveProperty('id');
        expect(mockStorageService.upload).toHaveBeenCalledWith(mockMulterFile.buffer);
        expect(mockImagesService.createImage).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Image',
            originalWidth: 1920,
            originalHeight: 1080,
            status: ImageStatus.PROCESSING,
            originalFileId: mockFile.id,
          }),
        );
        expect(mockQueue.add).toHaveBeenCalledWith(
          'process-image',
          expect.objectContaining({
            imageId: expect.any(String),
            title: 'Test Image',
            targetWidth: 800,
            targetHeight: 600,
          }),
        );
      });
    });

    describe('existing file upload (deduplication)', () => {
      beforeEach(() => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue({
          mime: 'image/jpeg',
          ext: 'jpg',
        });

        mockStorageService.findByChecksum.mockResolvedValue(mockFile);
      });

      it('should reuse existing file and create STORED image when dimensions match', async () => {
        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 800,
          height: 600,
        });

        mockImagesService.createImage.mockResolvedValue(mockImage as any);

        const result = await service.upload(mockMulterFile, {
          title: 'Duplicate Image',
          width: 800,
          height: 600,
        });

        expect(result).toHaveProperty('id');
        expect(mockStorageService.upload).not.toHaveBeenCalled();
        expect(mockImagesService.createImage).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Duplicate Image',
            originalWidth: 800,
            originalHeight: 600,
            processedWidth: 800,
            processedHeight: 600,
            status: ImageStatus.STORED,
            originalFileId: mockFile.id,
            processedFileId: mockFile.id,
          }),
        );
        expect(mockQueue.add).not.toHaveBeenCalled();
      });

      it('should reuse existing file and existing processed image when matching dimensions found', async () => {
        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 1920,
          height: 1080,
        });

        mockImagesService.findByOriginalFileIdAndProcessedDimensions.mockResolvedValue(mockImage);
        mockImagesService.createImage.mockResolvedValue(mockImage as any);

        const result = await service.upload(mockMulterFile, {
          title: 'Another Image',
          width: 800,
          height: 600,
        });

        expect(result).toHaveProperty('id');
        expect(mockStorageService.upload).not.toHaveBeenCalled();
        expect(mockImagesService.findByOriginalFileIdAndProcessedDimensions).toHaveBeenCalledWith(
          mockFile.id,
          800,
          600,
        );
        expect(mockImagesService.createImage).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Another Image',
            originalWidth: 1920,
            originalHeight: 1080,
            processedWidth: mockImage.processedWidth,
            processedHeight: mockImage.processedHeight,
            status: ImageStatus.STORED,
            originalFileId: mockFile.id,
            processedFileId: mockImage.processedFileId,
          }),
        );
        expect(mockQueue.add).not.toHaveBeenCalled();
      });

      it('should reuse existing file but create PROCESSING image when no matching processed dimensions', async () => {
        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 1920,
          height: 1080,
        });

        mockImagesService.findByOriginalFileIdAndProcessedDimensions.mockResolvedValue(null);
        mockImagesService.createImage.mockResolvedValue(mockImage as any);

        const result = await service.upload(mockMulterFile, {
          title: 'New Dimensions',
          width: 1024,
          height: 768,
        });

        expect(result).toHaveProperty('id');
        expect(mockStorageService.upload).not.toHaveBeenCalled();
        expect(mockImagesService.findByOriginalFileIdAndProcessedDimensions).toHaveBeenCalledWith(
          mockFile.id,
          1024,
          768,
        );
        expect(mockImagesService.createImage).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Dimensions',
            originalWidth: 1920,
            originalHeight: 1080,
            status: ImageStatus.PROCESSING,
            originalFileId: mockFile.id,
          }),
        );
        expect(mockQueue.add).toHaveBeenCalledWith(
          'process-image',
          expect.objectContaining({
            imageId: expect.any(String),
            title: 'New Dimensions',
            targetWidth: 1024,
            targetHeight: 768,
          }),
        );
      });
    });

    describe('checksum calculation', () => {
      it('should calculate checksum and use it for deduplication', async () => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue({
          mime: 'image/jpeg',
          ext: 'jpg',
        });

        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 800,
          height: 600,
        });

        mockStorageService.findByChecksum.mockResolvedValue(null);
        mockStorageService.upload.mockResolvedValue(mockFile);
        mockImagesService.createImage.mockResolvedValue(mockImage as any);

        await service.upload(mockMulterFile, {
          title: 'Test',
          width: 800,
          height: 600,
        });

        expect(mockStorageService.findByChecksum).toHaveBeenCalledWith(expect.any(String));
      });
    });

    describe('dimension extraction', () => {
      it('should extract dimensions from the uploaded buffer', async () => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue({
          mime: 'image/jpeg',
          ext: 'jpg',
        });

        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 1920,
          height: 1080,
        });

        mockStorageService.findByChecksum.mockResolvedValue(null);
        mockStorageService.upload.mockResolvedValue(mockFile);
        mockImagesService.createImage.mockResolvedValue(mockImage as any);

        await service.upload(mockMulterFile, {
          title: 'Test',
          width: 800,
          height: 600,
        });

        expect(mockImageProcessingService.getImageDimensions).toHaveBeenCalledWith(mockMulterFile.buffer);
      });
    });

    describe('queue job creation', () => {
      beforeEach(() => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue({
          mime: 'image/jpeg',
          ext: 'jpg',
        });

        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 1920,
          height: 1080,
        });

        mockStorageService.findByChecksum.mockResolvedValue(null);
        mockStorageService.upload.mockResolvedValue(mockFile);
        mockImagesService.createImage.mockResolvedValue(mockImage as any);
      });

      it('should queue processing job with correct parameters', async () => {
        await service.upload(mockMulterFile, {
          title: 'Processing Test',
          width: 800,
          height: 600,
        });

        expect(mockQueue.add).toHaveBeenCalledWith(
          'process-image',
          expect.objectContaining({
            imageId: expect.any(String),
            title: 'Processing Test',
            targetWidth: 800,
            targetHeight: 600,
          }),
        );
      });
    });

    describe('edge cases', () => {
      beforeEach(() => {
        (fileTypeFromBuffer as jest.Mock).mockResolvedValue({
          mime: 'image/jpeg',
          ext: 'jpg',
        });
      });

      it('should handle file size of 0 when maxFileSize is 0 (unlimited)', async () => {
        mockStorageConfig.maxFileSize = 0;

        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 800,
          height: 600,
        });

        const hugeFile = {
          ...mockMulterFile,
          buffer: Buffer.alloc(100 * 1024 * 1024), // 100MB
        };

        mockStorageService.findByChecksum.mockResolvedValue(null);
        mockStorageService.upload.mockResolvedValue(mockFile);
        mockImagesService.createImage.mockResolvedValue(mockImage as any);

        const result = await service.upload(hugeFile, {
          title: 'Huge File',
          width: 800,
          height: 600,
        });

        expect(result).toHaveProperty('id');
      });

      it('should generate unique image IDs for each upload', async () => {
        mockImageProcessingService.getImageDimensions.mockResolvedValue({
          width: 800,
          height: 600,
        });

        mockStorageService.findByChecksum.mockResolvedValue(null);
        mockStorageService.upload.mockResolvedValue(mockFile);

        const createdIds: string[] = [];
        mockImagesService.createImage.mockImplementation((data: any) => {
          createdIds.push(data.id);
          return Promise.resolve(mockImage as any);
        });

        await service.upload(mockMulterFile, { title: 'Image 1', width: 800, height: 600 });
        await service.upload(mockMulterFile, { title: 'Image 2', width: 800, height: 600 });

        expect(createdIds[0]).not.toBe(createdIds[1]);
        expect(createdIds).toHaveLength(2);
      });
    });
  });
});
