import { FileRepository, StorageConfig, StorageService } from '@images-api/shared/storage';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SqlFileRepository } from './repositories/sql-file.repository';
import { LocalStorageService } from './services/local-storage.service';

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
      useClass: LocalStorageService,
    },
  ],
})
export class StorageModule {}
