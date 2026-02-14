import type { ColumnType } from 'kysely';
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U> ? ColumnType<S, I | undefined, U> : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type File = {
  id: string;
  file_name: string;
  file_size: string;
  mime_type: string;
  checksum: string;
  url: string;
  status: Generated<string>;
  storage_provider: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type DB = {
  files: File;
};
