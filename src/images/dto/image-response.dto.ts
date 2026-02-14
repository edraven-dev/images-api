import { ApiProperty } from '@nestjs/swagger';

/**
 * Image response DTO for API responses
 */
export class ImageResponseDto {
  @ApiProperty({
    description: 'Image unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  readonly id: string;

  @ApiProperty({
    description: 'Publicly accessible URL',
    example: 'http://localhost:3000/uploads/550e8400-e29b-41d4-a716-446655440000.jpg',
  })
  readonly url: string;

  @ApiProperty({
    description: 'Image title',
    example: 'Beautiful sunset',
  })
  readonly title: string;

  @ApiProperty({
    description: 'Image width in pixels',
    example: 800,
  })
  readonly width: number;

  @ApiProperty({
    description: 'Image height in pixels',
    example: 600,
  })
  readonly height: number;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T12:00:00.000Z',
  })
  readonly createdAt: Date;
}

/**
 * Paginated image list response DTO
 */
export class PaginatedImageResponseDto {
  @ApiProperty({
    description: 'Array of images',
    type: [ImageResponseDto],
  })
  readonly data: ImageResponseDto[];

  @ApiProperty({
    description: 'Cursor for next page (Base64 encoded timestamp)',
    example: 'MjAyNC0wMS0xNVQxMjowMDowMC4wMDBa',
    nullable: true,
  })
  readonly nextCursor: string | null;

  @ApiProperty({
    description: 'Cursor for previous page (Base64 encoded timestamp)',
    example: 'MjAyNC0wMS0xNVQxMjowMDowMC4wMDBa',
    nullable: true,
  })
  readonly prevCursor: string | null;

  @ApiProperty({
    description: 'Number of items in current page',
    example: 20,
  })
  readonly count: number;

  @ApiProperty({
    description: 'Whether there are more items after this page',
    example: true,
  })
  readonly hasNext: boolean;

  @ApiProperty({
    description: 'Whether there are more items before this page',
    example: false,
  })
  readonly hasPrev: boolean;
}
