const parsePort = (value: string | undefined): number => {
  if (!value) return 3000;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 3000 : parsed;
};

const parseDatabase = (value: string | undefined): string => {
  if (!value) {
    console.error('ERROR: DATABASE_URL environment variable is not defined');
    console.error('Please set DATABASE_URL in your .env file');
    process.exit(1);
  }

  // Validate basic PostgreSQL connection string format
  const isValidFormat = /^postgresql:\/\/.+/.test(value);
  if (!isValidFormat) {
    console.error('ERROR: DATABASE_URL is not a valid PostgreSQL connection string');
    console.error('Expected format: postgresql://user:password@host:port/database');
    process.exit(1);
  }

  return value;
};

const parseFileSize = (value: string | undefined): number => {
  if (!value) return 10 * 1024 * 1024; // Default 10MB

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 10 * 1024 * 1024 : parsed;
};

const parseStorageConfig = () => {
  const basePath = process.env.STORAGE_BASE_PATH || './uploads';
  const baseUrl = process.env.STORAGE_BASE_URL;

  if (!baseUrl) {
    console.error('ERROR: STORAGE_BASE_URL environment variable is not defined');
    console.error('Please set STORAGE_BASE_URL in your .env file');
    console.error('Example: STORAGE_BASE_URL=http://localhost:3000/uploads');
    process.exit(1);
  }

  return {
    basePath,
    baseUrl,
    maxFileSize: parseFileSize(process.env.STORAGE_MAX_FILE_SIZE),
  };
};

export default () => ({
  port: parsePort(process.env.PORT),
  databaseUrl: parseDatabase(process.env.DATABASE_URL),
  storage: parseStorageConfig(),
});
