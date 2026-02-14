import { StorageConfig } from '@images-api/shared/storage';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServeStaticModule as NestServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    NestServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const storageConfig = configService.getOrThrow<StorageConfig>('storage');

        // Extract URL path from baseUrl (e.g., "http://localhost:3000/uploads" -> "/uploads")
        const baseUrl = new URL(storageConfig.localStorage.baseUrl);
        const serveRoot = baseUrl.pathname;

        return [
          {
            rootPath: join(process.cwd(), storageConfig.localStorage.basePath),
            serveRoot,
            serveStaticOptions: {
              index: false, // Don't serve index.html
            },
          },
        ];
      },
    }),
  ],
  exports: [NestServeStaticModule],
})
export class ServeStaticModule {}
