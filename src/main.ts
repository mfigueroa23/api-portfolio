import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module.js';

// Locally DATABASE_URL and PORT come from .env; in Docker and Kubernetes they
// are already in the environment and the file does not exist.
if (existsSync('.env')) {
  process.loadEnvFile();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
