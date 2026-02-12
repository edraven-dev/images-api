import { Global, Module } from '@nestjs/common';
import { ConfigService, ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [configuration],
    }),
  ],
  providers: [ConfigService],
  exports: [NestConfigModule],
})
export class ConfigModule {}
