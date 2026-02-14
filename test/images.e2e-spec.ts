/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// Enable manual mocks
jest.mock('file-type');

// Mock BullMQ module to prevent Redis connection
jest.mock('@nestjs/bullmq', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Inject } = require('@nestjs/common');
  return {
    BullModule: {
      forRootAsync: jest.fn().mockReturnValue({
        module: class MockBullModule {},
        providers: [],
        exports: [],
      }),
      registerQueue: jest.fn().mockReturnValue({
        module: class MockBullQueueModule {},
        providers: [],
        exports: [],
      }),
    },
    getQueueToken: jest.fn((name: string) => `BullQueue_${name}`),
    InjectQueue: jest.fn((name: string) => Inject(`BullQueue_${name}`)),
    Processor: jest.fn(() => (target: any) => target),
    OnWorkerEvent: jest.fn(() => () => undefined),
    WorkerHost: class WorkerHost {},
  };
});

/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  ImageRepository,
  ImageStatus,
  ImageWithFile,
  PaginatedResult,
  PaginationOptions,
} from '@images-api/shared/images';
import { ImageProcessingQueue } from '@images-api/shared/images/queues';
import { File, StorageConfig, StorageProvider, StorageService } from '@images-api/shared/storage';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { ImagesController } from '../src/images/controllers/images.controller';
import { ImageProcessingService } from '../src/images/services/image-processing.service';
import { ImagesService } from '../src/images/services/images.service';
import { UploadImageService } from '../src/images/services/upload-image.service';
import { createTestJPEG } from './helpers/test-images';

// Mock data store
const mockImages = new Map<string, any>();
const mockFiles = new Map<string, File>();

// Mock BullMQ Queue
const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  close: jest.fn().mockResolvedValue(undefined),
  getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
};

// Mock ImageRepository
const mockImageRepository: Partial<ImageRepository> = {
  create: jest.fn().mockImplementation((data) => {
    const image = {
      id: data.id,
      title: data.title,
      originalWidth: data.originalWidth,
      originalHeight: data.originalHeight,
      processedWidth: data.processedWidth,
      processedHeight: data.processedHeight,
      originalFileId: data.originalFileId,
      processedFileId: data.processedFileId,
      status: data.status || ImageStatus.PROCESSING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockImages.set(image.id, image);
    return image;
  }),
  findById: jest.fn().mockImplementation((id: string) => mockImages.get(id) || null),
  findByIdWithFile: jest.fn().mockImplementation((id: string) => {
    const image = mockImages.get(id);
    if (!image) return null;

    const originalFile = mockFiles.get(image.originalFileId);
    const processedFile = image.processedFileId ? mockFiles.get(image.processedFileId) : undefined;

    if (!originalFile) return null;

    return {
      ...image,
      originalFile,
      processedFile,
    } as ImageWithFile;
  }),
  findByOriginalFileIdAndProcessedDimensions: jest
    .fn()
    .mockImplementation((originalFileId: string, processedWidth: number, processedHeight: number) => {
      const images = Array.from(mockImages.values());
      return (
        images.find(
          (img) =>
            img.originalFileId === originalFileId &&
            img.processedWidth === processedWidth &&
            img.processedHeight === processedHeight,
        ) || null
      );
    }),
  findAll: jest.fn().mockImplementation((options: PaginationOptions): Promise<PaginatedResult<ImageWithFile>> => {
    let images = Array.from(mockImages.values());

    // Filter by title if provided
    if (options.title) {
      images = images.filter((img) => img.title.toLowerCase().includes(options.title!.toLowerCase()));
    }

    // Sort by createdAt
    images.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Filter by cursor if provided
    if (options.cursor) {
      if (options.direction === 'prev') {
        images = images.filter((img) => img.createdAt > options.cursor!);
      } else {
        images = images.filter((img) => img.createdAt < options.cursor!);
      }
    }

    const limit = options.limit || 20;
    const items = images.slice(0, limit);

    // Map to ImageWithFile
    const itemsWithFiles: ImageWithFile[] = items
      .map((img) => {
        const originalFile = mockFiles.get(img.originalFileId);
        if (!originalFile) return null;

        const processedFile = img.processedFileId ? mockFiles.get(img.processedFileId) : undefined;

        return {
          ...img,
          originalFile,
          processedFile,
        } as ImageWithFile;
      })
      .filter((item): item is ImageWithFile => item !== null);

    return new Promise((resolve) =>
      resolve({
        items: itemsWithFiles,
        hasNext: images.length > limit,
        hasPrev: false, // Simplified for mock
      }),
    );
  }),
  update: jest.fn().mockImplementation((id: string, data) => {
    const image = mockImages.get(id);
    if (image) {
      const updated = { ...image, ...data, updatedAt: new Date() };
      mockImages.set(id, updated);
      return updated;
    }
    return null;
  }),
};

// Mock StorageService
const mockStorageService: Partial<StorageService> = {
  upload: jest.fn().mockImplementation((buffer: Buffer) => {
    const file: File = {
      id: uuidv4(),
      fileName: `${uuidv4()}.jpg`,
      url: `https://images-api-recruit-task.s3.eu-central-003.backblazeb2.com/${uuidv4()}.jpg`,
      mimeType: 'image/jpeg',
      fileSize: BigInt(buffer.length),
      checksum: 'mock-checksum',
      storageProvider: StorageProvider.S3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFiles.set(file.id, file);
    return file;
  }),
  obtainFile: jest.fn().mockImplementation(() => {
    return createTestJPEG();
  }),
  findByChecksum: jest.fn().mockResolvedValue(null),
};

// Mock StorageConfig
const mockStorageConfig: StorageConfig = {
  provider: StorageProvider.LOCAL,
  maxFileSize: 10 * 1024 * 1024,
  localStorage: {
    basePath: './uploads',
    baseUrl: 'http://localhost:3000/uploads',
  },
  s3: {
    bucket: '',
    region: '',
    accessKeyId: '',
    secretAccessKey: '',
    endpointDomain: '',
  },
};

describe('ImagesController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [
        ImagesService,
        UploadImageService,
        ImageProcessingService,
        EventEmitter2,
        {
          provide: ImageRepository,
          useValue: mockImageRepository,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: StorageConfig,
          useValue: mockStorageConfig,
        },
        {
          provide: getQueueToken(ImageProcessingQueue),
          useValue: mockQueue,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same global prefix and validation pipe as in main.ts
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 10000);

  beforeEach(() => {
    // Clear mock data between tests
    mockImages.clear();
    mockFiles.clear();
    jest.clearAllMocks();
  });

  describe('POST /api/images (upload)', () => {
    it('should upload a new image successfully', async () => {
      const testImageBuffer = createTestJPEG();

      const response = await request(app.getHttpServer())
        .post('/api/images')
        .field('title', 'Test Image')
        .field('width', '800')
        .field('height', '600')
        .attach('file', testImageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(202); // ACCEPTED status

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should reject upload without file', async () => {
      await request(app.getHttpServer())
        .post('/api/images')
        .field('title', 'Test Image')
        .field('width', '800')
        .field('height', '600')
        .expect(400);
    });

    it('should reject upload with invalid title (empty)', async () => {
      const testImageBuffer = createTestJPEG();

      await request(app.getHttpServer())
        .post('/api/images')
        .field('title', '')
        .field('width', '800')
        .field('height', '600')
        .attach('file', testImageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('should reject upload with invalid width (string)', async () => {
      const testImageBuffer = createTestJPEG();

      await request(app.getHttpServer())
        .post('/api/images')
        .field('title', 'Test Image')
        .field('width', 'invalid')
        .field('height', '600')
        .attach('file', testImageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('should reject upload with width too small', async () => {
      const testImageBuffer = createTestJPEG();

      await request(app.getHttpServer())
        .post('/api/images')
        .field('title', 'Test Image')
        .field('width', '0')
        .field('height', '600')
        .attach('file', testImageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('should reject upload with width too large', async () => {
      const testImageBuffer = createTestJPEG();

      await request(app.getHttpServer())
        .post('/api/images')
        .field('title', 'Test Image')
        .field('width', '10001')
        .field('height', '600')
        .attach('file', testImageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('should reject upload with height too small', async () => {
      const testImageBuffer = createTestJPEG();

      await request(app.getHttpServer())
        .post('/api/images')
        .field('title', 'Test Image')
        .field('width', '800')
        .field('height', '0')
        .attach('file', testImageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('should reject upload with height too large', async () => {
      const testImageBuffer = createTestJPEG();

      await request(app.getHttpServer())
        .post('/api/images')
        .field('title', 'Test Image')
        .field('width', '800')
        .field('height', '10001')
        .attach('file', testImageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('should reject upload with title too long', async () => {
      const testImageBuffer = createTestJPEG();
      const longTitle = 'a'.repeat(256);

      await request(app.getHttpServer())
        .post('/api/images')
        .field('title', longTitle)
        .field('width', '800')
        .field('height', '600')
        .attach('file', testImageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('should reject upload with missing required fields', async () => {
      const testImageBuffer = createTestJPEG();

      await request(app.getHttpServer())
        .post('/api/images')
        .field('title', 'Test Image')
        // Missing width and height
        .attach('file', testImageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });
  });

  describe('GET /api/images (list)', () => {
    it('should list images with default pagination', async () => {
      const response = await request(app.getHttpServer()).get('/api/images').expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('hasNext');
      expect(response.body).toHaveProperty('hasPrev');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('nextCursor');
      expect(response.body).toHaveProperty('prevCursor');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should list images with custom limit', async () => {
      const response = await request(app.getHttpServer()).get('/api/images').query({ limit: 5 }).expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should filter images by title', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/images')
        .query({ title: 'E2E Test Image' })
        .expect(200);

      expect(response.body.data).toBeDefined();
      if (response.body.data.length > 0) {
        expect(response.body.data.some((img: any) => img.title.includes('E2E Test Image'))).toBe(true);
      }
    });

    it('should support cursor-based pagination (next direction)', async () => {
      const firstResponse = await request(app.getHttpServer()).get('/api/images').query({ limit: 1 }).expect(200);

      if (firstResponse.body.data.length > 0 && firstResponse.body.hasNext) {
        const cursor = firstResponse.body.nextCursor;

        const secondResponse = await request(app.getHttpServer())
          .get('/api/images')
          .query({ limit: 1, cursor, direction: 'next' })
          .expect(200);

        expect(secondResponse.body.data).toBeDefined();
      }
    });

    it('should support cursor-based pagination (prev direction)', async () => {
      const firstResponse = await request(app.getHttpServer()).get('/api/images').query({ limit: 1 }).expect(200);

      if (firstResponse.body.data.length > 0 && firstResponse.body.hasNext) {
        const cursor = firstResponse.body.nextCursor;

        // Get next page
        const secondResponse = await request(app.getHttpServer())
          .get('/api/images')
          .query({ limit: 1, cursor, direction: 'next' })
          .expect(200);

        if (secondResponse.body.data.length > 0 && secondResponse.body.hasPrev) {
          const prevCursor = secondResponse.body.prevCursor;

          // Go back using prev direction
          const thirdResponse = await request(app.getHttpServer())
            .get('/api/images')
            .query({ limit: 1, cursor: prevCursor, direction: 'prev' })
            .expect(200);

          expect(thirdResponse.body.data).toBeDefined();
        }
      }
    });

    it('should reject invalid limit (too small)', async () => {
      await request(app.getHttpServer()).get('/api/images').query({ limit: 0 }).expect(400);
    });

    it('should reject invalid limit (too large)', async () => {
      await request(app.getHttpServer()).get('/api/images').query({ limit: 101 }).expect(400);
    });

    it('should reject invalid direction value', async () => {
      await request(app.getHttpServer()).get('/api/images').query({ direction: 'invalid' }).expect(400);
    });

    it('should handle empty results gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/images')
        .query({ title: 'NonExistentImageTitle_12345' })
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data).toEqual([]);
      expect(response.body.hasNext).toBe(false);
      expect(response.body.hasPrev).toBe(false);
    });
  });

  describe('GET /api/images/:id (get by id)', () => {
    let createdImageId: string;

    beforeEach(async () => {
      // Create a test image to retrieve (runs after outer beforeEach clears data)
      const testImageBuffer = createTestJPEG();

      const response = await request(app.getHttpServer())
        .post('/api/images')
        .field('title', 'E2E Test Image for Get By ID')
        .field('width', '800')
        .field('height', '600')
        .attach('file', testImageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(202);

      createdImageId = response.body.id;
    });

    it('should get an image by valid ID', async () => {
      const response = await request(app.getHttpServer()).get(`/api/images/${createdImageId}`).expect(200);

      expect(response.body).toHaveProperty('id', createdImageId);
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('width');
      expect(response.body).toHaveProperty('height');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should return 404 for non-existent image', async () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

      await request(app.getHttpServer()).get(`/api/images/${nonExistentId}`).expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer()).get('/api/images/invalid-uuid').expect(400);
    });

    it('should return 400 for UUID v1 instead of v4', async () => {
      const uuidV1 = '550e8400-e29b-11d4-a716-446655440000'; // v1 UUID

      await request(app.getHttpServer()).get(`/api/images/${uuidV1}`).expect(400);
    });

    it('should validate response structure', async () => {
      const response = await request(app.getHttpServer()).get(`/api/images/${createdImageId}`).expect(200);

      // Validate basic image properties
      expect(response.body.id).toBe(createdImageId);
      expect(typeof response.body.title).toBe('string');
      expect(typeof response.body.url).toBe('string');
      expect(typeof response.body.width).toBe('number');
      expect(typeof response.body.height).toBe('number');
      expect(response.body.width).toBeGreaterThan(0);
      expect(response.body.height).toBeGreaterThan(0);
    });

    it('should return properly formatted createdAt timestamp', async () => {
      const response = await request(app.getHttpServer()).get(`/api/images/${createdImageId}`).expect(200);

      expect(response.body.createdAt).toBeDefined();
      expect(new Date(response.body.createdAt).toString()).not.toBe('Invalid Date');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full upload and retrieve workflow', async () => {
      // 1. Upload image
      const testImageBuffer = createTestJPEG();

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/images')
        .field('title', 'Workflow Test Image')
        .field('width', '1024')
        .field('height', '768')
        .attach('file', testImageBuffer, {
          filename: 'workflow.jpg',
          contentType: 'image/jpeg',
        })
        .expect(202);

      const imageId = uploadResponse.body.id;
      expect(imageId).toBeDefined();

      // 2. Retrieve image
      const getResponse = await request(app.getHttpServer()).get(`/api/images/${imageId}`).expect(200);

      expect(getResponse.body.id).toBe(imageId);
      expect(getResponse.body.title).toBe('Workflow Test Image');

      // 3. Verify it appears in list
      const listResponse = await request(app.getHttpServer())
        .get('/api/images')
        .query({ title: 'Workflow Test' })
        .expect(200);

      expect(listResponse.body.data).toBeDefined();
      const foundImage = listResponse.body.data.find((img: any) => img.id === imageId);
      expect(foundImage).toBeDefined();
    });

    it('should handle multiple concurrent uploads', async () => {
      const uploads = Array.from({ length: 3 }, (_, i) =>
        request(app.getHttpServer())
          .post('/api/images')
          .field('title', `Concurrent Upload ${i + 1}`)
          .field('width', '800')
          .field('height', '600')
          .attach('file', createTestJPEG(), {
            filename: `concurrent-${i}.jpg`,
            contentType: 'image/jpeg',
          }),
      );

      const responses = await Promise.all(uploads);

      responses.forEach((response) => {
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
      });

      // All IDs should be unique
      const ids = responses.map((r) => r.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Error handling', () => {
    it('should return proper error format for validation errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/images')
        .field('title', '')
        .field('width', 'invalid')
        .field('height', 'invalid')
        .attach('file', createTestJPEG(), {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should handle malformed requests gracefully', async () => {
      await request(app.getHttpServer()).post('/api/images').send({ invalid: 'data' }).expect(400);
    });
  });
});
