import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * DTO for uploading an image
 */
export class UploadImageDto {
  @ApiProperty({
    description: 'Image title',
    example: 'Beautiful sunset',
  })
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  readonly title: string;

  @ApiProperty({
    description: 'Target width in pixels.',
    example: 800,
    minimum: 1,
    maximum: 10000,
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  @Type(() => Number)
  readonly width: number;

  @ApiProperty({
    description: 'Target height in pixels.',
    example: 600,
    minimum: 1,
    maximum: 10000,
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  @Type(() => Number)
  readonly height: number;
}
