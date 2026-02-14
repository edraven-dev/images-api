import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * DTO for listing images with pagination and filtering
 */
export class ListImagesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter images by title (partial match, case-insensitive)',
    example: 'sunset',
  })
  @IsString()
  @IsOptional()
  readonly title?: string;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (Base64 encoded timestamp)',
    example: 'MjAyNC0wMS0xNVQxMjowMDowMC4wMDBa',
  })
  @IsString()
  @IsOptional()
  readonly cursor?: string;

  @ApiPropertyOptional({
    description: 'Pagination direction',
    enum: ['next', 'prev'],
    example: 'next',
    default: 'next',
  })
  @IsEnum(['next', 'prev'])
  @IsOptional()
  readonly direction?: 'next' | 'prev' = 'next';

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  readonly limit?: number = 20;
}
