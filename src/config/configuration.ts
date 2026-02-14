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

export default () => ({
  PORT: parsePort(process.env.PORT),
  DATABASE_URL: parseDatabase(process.env.DATABASE_URL),
});
