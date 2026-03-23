const REQUIRED_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
];

export function validateEnv(config: Record<string, unknown>) {
  for (const key of REQUIRED_KEYS) {
    if (!config[key]) {
      throw new Error(`Environment variable ${key} is required`);
    }
  }
  return config;
}
