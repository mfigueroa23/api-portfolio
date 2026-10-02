import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Locally DATABASE_URL comes from .env; in Docker and Kubernetes it is already
// in the environment, so the file is optional.
if (existsSync('.env')) {
  process.loadEnvFile();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `generate` does not need a database, so an empty URL keeps it working
  // without DATABASE_URL (CI, Docker build stage).
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
