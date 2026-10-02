import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

export const ALLOWED_ORIGIN = 'https://marco.figueroa-sanchez.com';

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
  app.enableCors({
    // An array (not a string) makes cors echo the origin only when it matches,
    // so other origins get no Access-Control-Allow-Origin header at all.
    origin: [ALLOWED_ORIGIN],
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
