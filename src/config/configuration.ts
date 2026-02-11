const parsePort = (value: string | undefined): number => {
  if (!value) return 3000;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 3000 : parsed;
};

export default () => ({
  port: parsePort(process.env.PORT),
});
