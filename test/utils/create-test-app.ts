import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app/app.module.js';
import { PrismaService } from '../../src/app/database/prisma.service.js';
import { setupApp } from '../../src/app/setup-app.js';
import { PrismaFake } from '../fakes/prisma.fake.js';

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaFake;
}

// Builds the full AppModule exactly as main.ts does, with the database replaced
// by the in-memory fake. `override` lets a suite swap further providers.
export async function createTestApp(
  override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (
    builder,
  ) => builder,
): Promise<TestApp> {
  const prisma = new PrismaFake();
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma);
  const moduleRef = await override(builder).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({
    bodyParser: false,
  });
  setupApp(app);
  await app.init();
  return { app, prisma };
}
