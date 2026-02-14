import { ImageRepository } from '@images-api/shared/images';
import { ImageProcessingQueue } from '@images-api/shared/images/queues';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { ImagesController } from './controllers/images.controller';
import { ImageProcessingProcessor } from './processors/image-processing.processor';
import { SqlImageRepository } from './repositories/sql-image.repository';
import { ImageProcessingService } from './services/image-processing.service';
import { ImagesService } from './services/images.service';
import { SSEService } from './services/sse.service';
import { UploadImageService } from './services/upload-image.service';

/**
 * Module for image management.
 * Handles upload, processing, storage, and querying of images.
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: ImageProcessingQueue,
    }),
    StorageModule,
  ],
  controllers: [ImagesController],
  providers: [
    ImagesService,
    UploadImageService,
    ImageProcessingService,
    SSEService,
    ImageProcessingProcessor,
    {
      provide: ImageRepository,
      useClass: SqlImageRepository,
    },
  ],
})
export class ImagesModule {}
