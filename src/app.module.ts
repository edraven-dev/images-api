import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { ServeStaticModule } from './serve-static/server-static.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [ConfigModule, DatabaseModule, StorageModule, ServeStaticModule],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {}
