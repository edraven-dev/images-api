// Mock sharp module first - using var to allow hoisting
const mockSharp = jest.fn();
jest.mock('sharp', () => mockSharp);

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ImageProcessingService } from './image-processing.service';

// Create mock functions
const mockMetadata = jest.fn();
const mockResize = jest.fn();
const mockToBuffer = jest.fn();

// Mock sharp instances
const createMockSharpInstance = () => ({
  metadata: mockMetadata,
  resize: mockResize,
  toBuffer: mockToBuffer,
});

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageProcessingService],
    }).compile();

    service = module.get<ImageProcessingService>(ImageProcessingService);
    jest.clearAllMocks();

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processImage', () => {
    it('should process image with both width and height', async () => {
      const mockBuffer = Buffer.from('test-image-data');
      const mockProcessedBuffer = Buffer.from('processed-image-data');

      let callCount = 0;
      mockSharp.mockImplementation(() => {
        callCount++;
        const instance = createMockSharpInstance();

        if (callCount === 1) {
          // First call: original buffer
          instance.metadata.mockResolvedValue({
            width: 1920,
            height: 1080,
            format: 'jpeg',
          });
          instance.resize.mockReturnValue(instance);
          instance.toBuffer.mockResolvedValue(mockProcessedBuffer);
        } else {
          // Second call: processed buffer for final metadata
          instance.metadata.mockResolvedValue({
            width: 800,
            height: 600,
            format: 'jpeg',
          });
        }

        return instance;
      });

      const result = await service.processImage(mockBuffer, 800, 600);

      expect(mockSharp).toHaveBeenCalledTimes(2);
      expect(mockSharp).toHaveBeenNthCalledWith(1, mockBuffer);
      expect(mockSharp).toHaveBeenNthCalledWith(2, mockProcessedBuffer);
      expect(mockResize).toHaveBeenCalledWith(800, 600, {
        fit: 'fill',
      });
      expect(result).toEqual({
        buffer: mockProcessedBuffer,
        width: 800,
        height: 600,
        mimeType: 'image/jpeg',
      });
    });

    it('should process image with only width', async () => {
      const mockBuffer = Buffer.from('test-image-data');
      const mockProcessedBuffer = Buffer.from('processed-image-data');

      let callCount = 0;
      mockSharp.mockImplementation(() => {
        callCount++;
        const instance = createMockSharpInstance();

        if (callCount === 1) {
          instance.metadata.mockResolvedValue({
            width: 1920,
            height: 1080,
            format: 'png',
          });
          instance.resize.mockReturnValue(instance);
          instance.toBuffer.mockResolvedValue(mockProcessedBuffer);
        } else {
          instance.metadata.mockResolvedValue({
            width: 800,
            height: 1080,
            format: 'png',
          });
        }

        return instance;
      });

      const result = await service.processImage(mockBuffer, 800);

      expect(mockResize).toHaveBeenCalledWith(800, undefined, {
        fit: 'fill',
      });
      expect(result).toEqual({
        buffer: mockProcessedBuffer,
        width: 800,
        height: 1080,
        mimeType: 'image/png',
      });
    });

    it('should process image without resizing when no dimensions provided', async () => {
      const mockBuffer = Buffer.from('test-image-data');
      const mockProcessedBuffer = Buffer.from('processed-image-data');

      let callCount = 0;
      mockSharp.mockImplementation(() => {
        callCount++;
        const instance = createMockSharpInstance();

        if (callCount === 1) {
          instance.metadata.mockResolvedValue({
            width: 1920,
            height: 1080,
            format: 'jpeg',
          });
          instance.resize.mockReturnValue(instance);
          instance.toBuffer.mockResolvedValue(mockProcessedBuffer);
        } else {
          instance.metadata.mockResolvedValue({
            width: 1920,
            height: 1080,
            format: 'jpeg',
          });
        }

        return instance;
      });

      const result = await service.processImage(mockBuffer);

      expect(mockResize).not.toHaveBeenCalled();
      expect(result).toEqual({
        buffer: mockProcessedBuffer,
        width: 1920,
        height: 1080,
        mimeType: 'image/jpeg',
      });
    });

    it('should throw error when original metadata is missing dimensions', async () => {
      const mockBuffer = Buffer.from('invalid-image-data');

      mockSharp.mockImplementation(() => {
        const instance = createMockSharpInstance();
        instance.metadata.mockResolvedValue({
          format: 'jpeg',
        });
        return instance;
      });

      await expect(service.processImage(mockBuffer, 800, 600)).rejects.toThrow(
        'Unable to extract original image dimensions',
      );
    });

    it('should throw error when processed metadata is missing dimensions', async () => {
      const mockBuffer = Buffer.from('test-image-data');
      const mockProcessedBuffer = Buffer.from('processed-image-data');

      let callCount = 0;
      mockSharp.mockImplementation(() => {
        callCount++;
        const instance = createMockSharpInstance();

        if (callCount === 1) {
          instance.metadata.mockResolvedValue({
            width: 1920,
            height: 1080,
            format: 'jpeg',
          });
          instance.resize.mockReturnValue(instance);
          instance.toBuffer.mockResolvedValue(mockProcessedBuffer);
        } else {
          // Processed buffer has invalid metadata
          instance.metadata.mockResolvedValue({
            format: 'jpeg',
          });
        }

        return instance;
      });

      await expect(service.processImage(mockBuffer, 800, 600)).rejects.toThrow(
        'Unable to extract processed image dimensions',
      );
    });

    it('should handle webp format correctly', async () => {
      const mockBuffer = Buffer.from('test-image-data');
      const mockProcessedBuffer = Buffer.from('processed-image-data');

      let callCount = 0;
      mockSharp.mockImplementation(() => {
        callCount++;
        const instance = createMockSharpInstance();

        if (callCount === 1) {
          instance.metadata.mockResolvedValue({
            width: 1920,
            height: 1080,
            format: 'webp',
          });
          instance.resize.mockReturnValue(instance);
          instance.toBuffer.mockResolvedValue(mockProcessedBuffer);
        } else {
          instance.metadata.mockResolvedValue({
            width: 800,
            height: 600,
            format: 'webp',
          });
        }

        return instance;
      });

      const result = await service.processImage(mockBuffer, 800, 600);

      expect(result.mimeType).toBe('image/webp');
    });
  });

  describe('getImageDimensions', () => {
    it('should extract image dimensions successfully', async () => {
      const mockBuffer = Buffer.from('test-image-data');

      mockSharp.mockImplementation(() => {
        const instance = createMockSharpInstance();
        instance.metadata.mockResolvedValue({
          width: 1920,
          height: 1080,
          format: 'jpeg',
        });
        return instance;
      });

      const result = await service.getImageDimensions(mockBuffer);

      expect(mockSharp).toHaveBeenCalledWith(mockBuffer);
      expect(result).toEqual({ width: 1920, height: 1080 });
    });

    it('should throw error when dimensions are missing', async () => {
      const mockBuffer = Buffer.from('invalid-image-data');

      mockSharp.mockImplementation(() => {
        const instance = createMockSharpInstance();
        instance.metadata.mockResolvedValue({
          format: 'jpeg',
        });
        return instance;
      });

      await expect(service.getImageDimensions(mockBuffer)).rejects.toThrow('Unable to extract image dimensions');
    });

    it('should handle sharp errors gracefully', async () => {
      const mockBuffer = Buffer.from('corrupted-data');

      mockSharp.mockImplementation(() => {
        const instance = createMockSharpInstance();
        instance.metadata.mockRejectedValue(new Error('Corrupted image'));
        return instance;
      });

      await expect(service.getImageDimensions(mockBuffer)).rejects.toThrow(
        'Failed to extract image dimensions: Corrupted image',
      );
    });
  });

  describe('formatToMimeType', () => {
    it('should convert jpeg format to mime type', () => {
      const result = service['formatToMimeType']('jpeg');
      expect(result).toBe('image/jpeg');
    });

    it('should convert png format to mime type', () => {
      const result = service['formatToMimeType']('png');
      expect(result).toBe('image/png');
    });

    it('should convert webp format to mime type', () => {
      const result = service['formatToMimeType']('webp');
      expect(result).toBe('image/webp');
    });

    it('should return image/jpeg for unknown formats', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = service['formatToMimeType']('unknown' as any);
      expect(result).toBe('image/jpeg');
    });
  });
});
