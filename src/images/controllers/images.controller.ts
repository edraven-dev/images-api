import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ImageResponseDto, PaginatedImageResponseDto } from '../dto/image-response.dto';
import { ListImagesQueryDto } from '../dto/list-images-query.dto';
import { UploadImageDto } from '../dto/upload-image.dto';
import { UploadResponseDto } from '../dto/upload-response.dto';
import { ImagesService } from '../services/images.service';
import { UploadImageService } from '../services/upload-image.service';

/**
 * Controller for image management endpoints.
 */
@ApiTags('images')
@Controller('images')
export class ImagesController {
  private readonly logger = new Logger(ImagesController.name);

  constructor(
    private readonly imagesService: ImagesService,
    private readonly uploadImageService: UploadImageService,
  ) {}

  /**
   * Upload a new image.
   * Image will be processed asynchronously. Use SSE endpoint to track progress.
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload an image',
    description:
      'Upload an image file with resize parameters. Processing happens asynchronously. ' +
      'Use GET /notifications/images/events/:id to receive real-time updates about processing status.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiExtraModels(UploadImageDto)
  @ApiBody({
    schema: {
      type: 'object',
      allOf: [
        { $ref: getSchemaPath(UploadImageDto) },
        {
          type: 'object',
          required: ['file'],
          properties: {
            file: {
              type: 'string',
              format: 'binary',
              description: 'Image file (JPG, PNG, or WebP)',
            },
          },
        },
      ],
    },
  })
  @ApiAcceptedResponse({
    description:
      'Image upload initiated. Processing happens asynchronously. Use the returned ID to listen to SSE events for completion.',
    type: UploadResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request (missing file, invalid file type, etc.)' })
  @ApiPayloadTooLargeResponse({ description: 'File size exceeds maximum allowed size' })
  @HttpCode(HttpStatus.ACCEPTED)
  uploadImage(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadImageDto): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    this.logger.log(`Received image upload request: ${dto.title}`);
    return this.uploadImageService.upload(file, dto);
  }

  /**
   * List images with pagination and filtering.
   */
  @Get()
  @ApiOperation({
    summary: 'List images',
    description:
      'Get a paginated list of images with optional title filtering. ' +
      'Supports cursor-based bidirectional pagination.',
  })
  @ApiOkResponse({ description: 'List of images with pagination metadata', type: PaginatedImageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  listImages(@Query() query: ListImagesQueryDto): Promise<PaginatedImageResponseDto> {
    this.logger.log(`List images request: ${JSON.stringify(query)}`);
    return this.imagesService.findAll(query);
  }

  /**
   * Get a single image by ID.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get image by ID',
    description: 'Retrieve a single image with its details by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Image unique identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({ description: 'Image found', type: ImageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid ID format' })
  @ApiNotFoundResponse({ description: 'Image not found' })
  getImage(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ImageResponseDto> {
    this.logger.log(`Get image request: ${id}`);
    return this.imagesService.findById(id);
  }
}
