import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { DB } from './types';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private _db: Kysely<DB> | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const logger = new Logger(DatabaseService.name);
    const databaseUrl = this.configService.getOrThrow<string>('databaseUrl');

    this._db = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: databaseUrl,
        }),
      }),
      log(event) {
        if (event.level === 'error') {
          const error = event.error as Error;
          logger.error(`Database error: ${error.message}`, error.stack);
        } else {
          logger.debug(`Database query: ${event.query.sql}`);
          logger.debug(`Parameters: ${JSON.stringify(event.query.parameters)}`);
          logger.debug(`Query execution time: ${event.queryDurationMillis}ms`);
        }
      },
    });
  }

  async onModuleDestroy() {
    if (this._db) {
      await this._db.destroy();
    }
  }

  get db(): Kysely<DB> {
    if (!this._db) {
      throw new Error('Database not initialized');
    }
    return this._db;
  }
}
