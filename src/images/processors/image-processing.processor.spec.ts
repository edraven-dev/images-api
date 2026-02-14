import { ImageStatus } from '@images-api/shared/images';
import { ImageProcessingJob, ImageProcessingResult } from '@images-api/shared/images/queues';
import { StorageService } from '@images-api/shared/storage';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ImageProcessingService } from '../services/image-processing.service';
import { ImagesService } from '../services/images.service';
import { ImageEventType, SSEService } from '../services/sse.service';
import { ImageProcessingProcessor } from './image-processing.processor';

describe('ImageProcessingProcessor', () => {
  let processor: ImageProcessingProcessor;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockImageProcessingService: jest.Mocked<ImageProcessingService>;
  let mockImagesService: jest.Mocked<ImagesService>;
  let mockSSEService: jest.Mocked<SSEService>;

  const mockImageId = '123e4567-e89b-12d3-a456-426614174000';
  const mockFileUrl = 'https://storage.example.com/original.jpg';
  const mockProcessedFileUrl = 'https://storage.example.com/processed.jpg';
  const mockFileId = 'file-123';
  const mockProcessedFileId = 'file-456';

  beforeEach(async () => {
    mockStorageService = {
      obtainFile: jest.fn(),
      upload: jest.fn(),
    } as any;

    mockImageProcessingService = {
      processImage: jest.fn(),
    } as any;

    mockImagesService = {
      getImageWithOriginalFile: jest.fn(),
      updateImageProcessingResult: jest.fn(),
    } as any;

    mockSSEService = {
      sendEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageProcessingProcessor,
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: ImageProcessingService,
          useValue: mockImageProcessingService,
        },
        {
          provide: ImagesService,
          useValue: mockImagesService,
        },
        {
          provide: SSEService,
          useValue: mockSSEService,
        },
      ],
    }).compile();

    processor = module.get<ImageProcessingProcessor>(ImageProcessingProcessor);
    jest.clearAllMocks();

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should successfully process an image and return result', async () => {
      const job = {
        data: {
          imageId: mockImageId,
          title: 'Test Image',
          targetWidth: 800,
          targetHeight: 600,
        },
      } as Job<ImageProcessingJob>;

      const mockOriginalBuffer = Buffer.from('original-image-data');
      const mockProcessedBuffer = Buffer.from('processed-image-data');

      mockImagesService.getImageWithOriginalFile.mockResolvedValue({
        image: {
          id: mockImageId,
          title: 'Test Image',
          originalWidth: 1920,
          originalHeight: 1080,
          processedWidth: null,
          processedHeight: null,
          originalFileId: mockFileId,
          processedFileId: null,
          status: ImageStatus.PROCESSING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        originalFile: {
          id: mockFileId,
          url: mockFileUrl,
          checksum: 'abc123',
          fileSize: BigInt(1024),
          fileName: 'original.jpg',
          mimeType: 'image/jpeg',
          storageProvider: 'LOCAL' as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      mockStorageService.obtainFile.mockResolvedValue(mockOriginalBuffer);

      mockImageProcessingService.processImage.mockResolvedValue({
        buffer: mockProcessedBuffer,
        width: 800,
        height: 600,
        mimeType: 'image/jpeg',
      });

      mockStorageService.upload.mockResolvedValue({
        id: mockProcessedFileId,
        url: mockProcessedFileUrl,
        checksum: 'def456',
        fileSize: BigInt(512),
        fileName: 'processed.jpg',
        mimeType: 'image/jpeg',
        storageProvider: 'LOCAL' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await processor.process(job);

      expect(mockImagesService.getImageWithOriginalFile).toHaveBeenCalledWith(mockImageId);
      expect(mockStorageService.obtainFile).toHaveBeenCalledWith(mockFileUrl);
      expect(mockImageProcessingService.processImage).toHaveBeenCalledWith(mockOriginalBuffer, 800, 600);
      expect(mockStorageService.upload).toHaveBeenCalledWith(mockProcessedBuffer);

      expect(result).toEqual({
        processedFileId: mockProcessedFileId,
        processedWidth: 800,
        processedHeight: 600,
        url: mockProcessedFileUrl,
      });
    });

    it('should handle processing with undefined target dimensions', async () => {
      const job = {
        data: {
          imageId: mockImageId,
          title: 'Test Image',
          targetWidth: undefined,
          targetHeight: undefined,
        },
      } as Job<ImageProcessingJob>;

      const mockOriginalBuffer = Buffer.from('original-image-data');
      const mockProcessedBuffer = Buffer.from('processed-image-data');

      mockImagesService.getImageWithOriginalFile.mockResolvedValue({
        image: {
          id: mockImageId,
          title: 'Test Image',
          originalWidth: 1920,
          originalHeight: 1080,
          processedWidth: null,
          processedHeight: null,
          originalFileId: mockFileId,
          processedFileId: null,
          status: ImageStatus.PROCESSING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        originalFile: {
          id: mockFileId,
          url: mockFileUrl,
          checksum: 'abc123',
          fileSize: BigInt(1024),
          fileName: 'original.jpg',
          mimeType: 'image/jpeg',
          storageProvider: 'LOCAL' as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      mockStorageService.obtainFile.mockResolvedValue(mockOriginalBuffer);

      mockImageProcessingService.processImage.mockResolvedValue({
        buffer: mockProcessedBuffer,
        width: 1920,
        height: 1080,
        mimeType: 'image/jpeg',
      });

      mockStorageService.upload.mockResolvedValue({
        id: mockProcessedFileId,
        url: mockProcessedFileUrl,
        checksum: 'def456',
        fileSize: BigInt(512),
        fileName: 'processed.jpg',
        mimeType: 'image/jpeg',
        storageProvider: 'LOCAL' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await processor.process(job);

      expect(mockImageProcessingService.processImage).toHaveBeenCalledWith(mockOriginalBuffer, undefined, undefined);
      expect(result).toEqual({
        processedFileId: mockProcessedFileId,
        processedWidth: 1920,
        processedHeight: 1080,
        url: mockProcessedFileUrl,
      });
    });
  });

  describe('onCompleted', () => {
    it('should update image and send SSE event on successful completion', async () => {
      const job = {
        data: {
          imageId: mockImageId,
          title: 'Test Image',
          targetWidth: 800,
          targetHeight: 600,
        },
        returnvalue: {
          processedFileId: mockProcessedFileId,
          processedWidth: 800,
          processedHeight: 600,
          url: mockProcessedFileUrl,
        },
      } as Job<ImageProcessingJob, ImageProcessingResult>;

      await processor.onCompleted(job);

      expect(mockImagesService.updateImageProcessingResult).toHaveBeenCalledWith(mockImageId, {
        processedFileId: mockProcessedFileId,
        processedWidth: 800,
        processedHeight: 600,
        status: ImageStatus.STORED,
      });

      expect(mockSSEService.sendEvent).toHaveBeenCalledWith(mockImageId, {
        type: ImageEventType.COMPLETED,
        imageId: mockImageId,
        message: 'Image processed successfully',
        url: mockProcessedFileUrl,
      });
    });

    it('should handle SSE event sending failure gracefully', async () => {
      const job = {
        data: {
          imageId: mockImageId,
          title: 'Test Image',
          targetWidth: 800,
          targetHeight: 600,
        },
        returnvalue: {
          processedFileId: mockProcessedFileId,
          processedWidth: 800,
          processedHeight: 600,
          url: mockProcessedFileUrl,
        },
      } as Job<ImageProcessingJob, ImageProcessingResult>;

      const sseError = new Error('SSE connection failed');
      mockSSEService.sendEvent.mockRejectedValue(sseError);

      await processor.onCompleted(job);

      expect(mockImagesService.updateImageProcessingResult).toHaveBeenCalled();
      expect(mockSSEService.sendEvent).toHaveBeenCalled();
      // Should not throw error, just log it
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to send SSE event for image ${mockImageId}`),
        expect.anything(),
      );
    });
  });

  describe('onFailed', () => {
    it('should update image status and send failure event when job fails', async () => {
      const error = new Error('Processing failed');
      const job = {
        data: {
          imageId: mockImageId,
          title: 'Test Image',
          targetWidth: 800,
          targetHeight: 600,
        },
      } as Job<ImageProcessingJob>;

      await processor.onFailed(job, error);

      expect(mockImagesService.updateImageProcessingResult).toHaveBeenCalledWith(mockImageId, {
        status: ImageStatus.FAILED,
      });

      expect(mockSSEService.sendEvent).toHaveBeenCalledWith(mockImageId, {
        type: ImageEventType.FAILED,
        imageId: mockImageId,
        message: 'Processing failed',
      });
    });

    it('should handle undefined job gracefully', async () => {
      const error = new Error('Unknown error');

      await processor.onFailed(undefined, error);

      expect(mockImagesService.updateImageProcessingResult).not.toHaveBeenCalled();
      expect(mockSSEService.sendEvent).not.toHaveBeenCalled();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Job failed without job data'),
        expect.anything(),
      );
    });

    it('should use default error message when error message is empty', async () => {
      const error = new Error();
      error.message = '';

      const job = {
        data: {
          imageId: mockImageId,
          title: 'Test Image',
          targetWidth: 800,
          targetHeight: 600,
        },
      } as Job<ImageProcessingJob>;

      await processor.onFailed(job, error);

      expect(mockSSEService.sendEvent).toHaveBeenCalledWith(mockImageId, {
        type: ImageEventType.FAILED,
        imageId: mockImageId,
        message: 'Image processing failed',
      });
    });

    it('should handle SSE event sending failure gracefully on failure', async () => {
      const error = new Error('Processing failed');
      const sseError = new Error('SSE connection failed');

      const job = {
        data: {
          imageId: mockImageId,
          title: 'Test Image',
          targetWidth: 800,
          targetHeight: 600,
        },
      } as Job<ImageProcessingJob>;

      mockSSEService.sendEvent.mockRejectedValue(sseError);

      await processor.onFailed(job, error);

      expect(mockImagesService.updateImageProcessingResult).toHaveBeenCalled();
      expect(mockSSEService.sendEvent).toHaveBeenCalled();
      // Should not throw error, just log it
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to send SSE event for image ${mockImageId}`),
        expect.anything(),
      );
    });
  });
});
