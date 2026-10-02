import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { CorsOriginsService } from './cors/cors-origins.service.js';

// Flattens class-validator errors into { field: [messages] }, using dotted
// paths for nested properties.
function toFields(
  errors: ValidationError[],
  parent = '',
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) fields[path] = Object.values(error.constraints);
    Object.assign(fields, toFields(error.children ?? [], path));
  }
  return fields;
}

// Shared by main.ts and the e2e tests so both run the same HTTP pipeline.
export function setupApp(app: INestApplication): void {
  const corsOrigins = app.get(CorsOriginsService);
  app.enableCors({
    // Checked against the cors_origin table on every request. A missing or
    // non-enabled origin (and a request without Origin, e.g. curl or the web
    // prerender) gets no CORS headers but is still served.
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, false);
        return;
      }
      void corsOrigins
        .isAllowed(origin)
        .then((allowed) => callback(null, allowed));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          error: 'Validation failed.',
          fields: toFields(errors),
        }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
