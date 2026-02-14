import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { DB } from './types';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private _db: Kysely<DB> | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const databaseUrl = this.configService.getOrThrow<string>('DATABASE_URL');

    this._db = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: databaseUrl,
        }),
      }),
      log: ['query', 'error'],
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
