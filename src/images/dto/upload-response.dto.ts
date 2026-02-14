import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for image upload.
 * Returns only the image ID for tracking via SSE.
 */
export class UploadResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the uploaded image',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  readonly id: string;
}
