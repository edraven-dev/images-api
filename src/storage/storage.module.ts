import { FileRepository, StorageConfig, StorageProvider, StorageService } from '@images-api/shared/storage';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SqlFileRepository } from './repositories/sql-file.repository';
import { LocalStorageService } from './services/local-storage.service';
import { S3StorageService } from './services/s3-storage.service';

@Module({
  providers: [
    {
      provide: StorageConfig,
      useFactory: (configService: ConfigService): StorageConfig => configService.getOrThrow<StorageConfig>('storage'),
      inject: [ConfigService],
    },
    {
      provide: FileRepository,
      useClass: SqlFileRepository,
    },
    {
      provide: StorageService,
      useFactory: (config: StorageConfig, fileRepository: FileRepository): StorageService => {
        switch (config.provider) {
          case StorageProvider.LOCAL:
            return new LocalStorageService(config, fileRepository);
          case StorageProvider.S3:
            return new S3StorageService(config, fileRepository);
          default:
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Unsupported storage provider: ${config.provider}`);
        }
      },
      inject: [StorageConfig, FileRepository],
    },
  ],
  exports: [StorageConfig, StorageService],
})
export class StorageModule {}
