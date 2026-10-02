import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

// Application secrets (brevo_api_key, jwt_secret) live in the `property` table.
// They are read on every call, without a cache, so an SQL update applies
// immediately; values must never be returned in responses or logged.
@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const property = await this.prisma.property.findUnique({ where: { key } });
    return property?.value ?? null;
  }
}
