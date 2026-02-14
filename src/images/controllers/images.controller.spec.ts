import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ImagesService } from '../services/images.service';
import { UploadImageService } from '../services/upload-image.service';
import { ImagesController } from './images.controller';

describe('ImagesController', () => {
  let controller: ImagesController;
  let mockImagesService: jest.Mocked<ImagesService>;
  let mockUploadImageService: jest.Mocked<UploadImageService>;

  const mockUploadResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
  };

  const mockImageResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    url: '/uploads/test.jpg',
    title: 'Test Image',
    width: 800,
    height: 600,
    createdAt: '2025-01-01T00:00:00.000Z',
  };

  beforeAll(async () => {
    mockImagesService = {
      findById: jest.fn(),
      findAll: jest.fn(),
    } as any;

    mockUploadImageService = {
      upload: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [
        {
          provide: ImagesService,
          useValue: mockImagesService,
        },
        {
          provide: UploadImageService,
          useValue: mockUploadImageService,
        },
      ],
    }).compile();

    controller = module.get<ImagesController>(ImagesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadImage', () => {
    it('should upload image successfully', async () => {
      const uploadDto = { title: 'Test Image', width: 800, height: 600 };
      const mockFile = { buffer: Buffer.from('test') } as Express.Multer.File;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      mockUploadImageService.upload.mockResolvedValue(mockUploadResponse as any);

      const result = await controller.uploadImage(mockFile, uploadDto);

      expect(mockUploadImageService.upload).toHaveBeenCalledWith(mockFile, uploadDto);
      expect(result).toEqual(mockUploadResponse);
    });

    it('should throw BadRequestException when no file provided', () => {
      const uploadDto = { title: 'Test Image', width: 800, height: 600 };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect(() => controller.uploadImage(null as any, uploadDto)).toThrow(BadRequestException);
    });
  });

  describe('getImage', () => {
    it('should return image by ID', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      mockImagesService.findById.mockResolvedValue(mockImageResponse as any);

      const result = await controller.getImage(mockImageResponse.id);

      expect(mockImagesService.findById).toHaveBeenCalledWith(mockImageResponse.id);
      expect(result).toEqual(mockImageResponse);
    });
  });

  describe('listImages', () => {
    it('should return paginated images', async () => {
      const paginatedResult = {
        data: [mockImageResponse],
        hasNext: true,
        hasPrev: false,
        nextCursor: 'base64cursor',
        prevCursor: null,
        count: 1,
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      mockImagesService.findAll.mockResolvedValue(paginatedResult as any);

      const result = await controller.listImages({});

      expect(mockImagesService.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(paginatedResult);
    });
  });
});
