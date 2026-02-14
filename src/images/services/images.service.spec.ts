import { ImageRepository, ImageStatus } from '@images-api/shared/images';
import { ImageProcessingQueue } from '@images-api/shared/images/queues';
import { StorageConfig, StorageProvider } from '@images-api/shared/storage';
import { getQueueToken } from '@nestjs/bullmq';
import { Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { ImagesService } from './images.service';
import { SSEService } from './sse.service';

jest.mock('file-type');

describe('ImagesService', () => {
  let service: ImagesService;
  let mockLogger: jest.Mocked<Logger>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockQueue: jest.Mocked<Queue>;
  let mockRepository: jest.Mocked<ImageRepository>;
  let mockSSEService: jest.Mocked<SSEService>;

  const mockImage = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Image',
    originalWidth: 800,
    originalHeight: 600,
    processedWidth: null,
    processedHeight: null,
    originalFileId: '123e4567-e89b-12d3-a456-426614174001',
    processedFileId: null,
    status: ImageStatus.PROCESSING,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockFile = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    fileName: 'test.jpg',
    fileSize: BigInt(1024),
    mimeType: 'image/jpeg',
    url: '/uploads/test.jpg',
    checksum: 'abc123',
    storageProvider: StorageProvider.LOCAL,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockImageWithFile = {
    ...mockImage,
    originalFile: mockFile,
  };

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'storage.maxFileSize') return 10485760; // 10MB
        return undefined;
      }),
    } as any;

    mockQueue = {
      add: jest.fn(),
    } as any;

    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdWithFile: jest.fn(),
      findByOriginalFileIdAndProcessedDimensions: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    } as any;

    mockSSEService = {
      emitImageEvent: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImagesService,
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getQueueToken(ImageProcessingQueue),
          useValue: mockQueue,
        },
        {
          provide: ImageRepository,
          useValue: mockRepository,
        },
        {
          provide: StorageConfig,
          useValue: mockConfigService,
        },
        {
          provide: SSEService,
          useValue: mockSSEService,
        },
      ],
    }).compile();

    service = module.get<ImagesService>(ImagesService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return image when found', async () => {
      mockRepository.findByIdWithFile.mockResolvedValue(mockImageWithFile);

      const result = await service.findById(mockImage.id);

      expect(mockRepository.findByIdWithFile).toHaveBeenCalledWith(mockImage.id);
      expect(result).toMatchObject({
        id: mockImage.id,
        title: mockImage.title,
        url: mockFile.url,
      });
    });

    it('should throw NotFoundException when image not found', async () => {
      mockRepository.findByIdWithFile.mockResolvedValue(null);

      await expect(service.findById(mockImage.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    const mockPaginatedResult = {
      items: [mockImageWithFile],
      hasNext: true,
      hasPrev: false,
    };

    it('should return paginated images', async () => {
      mockRepository.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await service.findAll({});

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result.data).toBeDefined();
      expect(result.hasNext).toBe(true);
    });
  });
});
