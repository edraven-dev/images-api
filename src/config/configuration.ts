import { StorageProvider } from '@images-api/shared/storage';

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

const parseStorageProvider = (value: string | undefined): StorageProvider => {
  const provider = (value || 'LOCAL').toUpperCase();

  if (!Object.values(StorageProvider).includes(provider as StorageProvider)) {
    console.error(`ERROR: Invalid STORAGE_PROVIDER: ${value}`);
    console.error(`Valid values are: ${Object.values(StorageProvider).join(', ')}`);
    process.exit(1);
  }

  return provider as StorageProvider;
};

const parseStorageConfig = () => {
  const provider = parseStorageProvider(process.env.STORAGE_PROVIDER);
  const maxFileSize = parseFileSize(process.env.STORAGE_MAX_FILE_SIZE);

  // Parse local storage config
  const localBasePath = process.env.STORAGE_BASE_PATH || './uploads';
  const localBaseUrl = process.env.STORAGE_BASE_URL;

  if (provider === StorageProvider.LOCAL && !localBaseUrl) {
    console.error('ERROR: STORAGE_BASE_URL environment variable is not defined');
    console.error('Please set STORAGE_BASE_URL in your .env file');
    console.error('Example: STORAGE_BASE_URL=http://localhost:3000/uploads');
    process.exit(1);
  }

  // Parse S3 config
  const s3Bucket = process.env.S3_BUCKET;
  const s3Region = process.env.S3_REGION;
  const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID;
  const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const s3EndpointDomain = process.env.S3_ENDPOINT_DOMAIN;

  if (
    provider === StorageProvider.S3 &&
    (!s3Bucket || !s3Region || !s3AccessKeyId || !s3SecretAccessKey || !s3EndpointDomain)
  ) {
    console.error(
      'ERROR: S3 storage provider requires S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_ENDPOINT_DOMAIN',
    );
    console.error('Please set these environment variables in your .env file');
    process.exit(1);
  }

  return {
    provider,
    maxFileSize,
    localStorage: {
      basePath: localBasePath,
      baseUrl: localBaseUrl || '',
    },
    s3: {
      bucket: s3Bucket || '',
      region: s3Region || '',
      accessKeyId: s3AccessKeyId || '',
      secretAccessKey: s3SecretAccessKey || '',
      endpointDomain: s3EndpointDomain || '',
    },
  };
};

export default () => ({
  port: parsePort(process.env.PORT),
  databaseUrl: parseDatabase(process.env.DATABASE_URL),
  storage: parseStorageConfig(),
});
