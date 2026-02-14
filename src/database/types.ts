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
  storage_provider: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type Image = {
  id: string;
  title: string;
  original_width: number;
  original_height: number;
  processed_width: number | null;
  processed_height: number | null;
  original_file_id: string;
  processed_file_id: string | null;
  status: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type DB = {
  files: File;
  images: Image;
};
