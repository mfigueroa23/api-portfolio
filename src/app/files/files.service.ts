import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TOO_LARGE } from '../common/middlewares/raw-body.middleware.js';
import { PrismaService } from '../database/prisma.service.js';
import type { FileKind } from './dto/files-query.dto.js';
import { FileMime, sniff } from './utils/file-type-sniffer.js';

const MIB = 1024 * 1024;
const IMAGE_LIMIT_BYTES = 5 * MIB;
const PDF_LIMIT_BYTES = 10 * MIB;
const MAX_NAME_LENGTH = 200;
const PAGE_SIZE = 50;
const DEFAULT_PUBLIC_URL = 'https://api.figueroa-sanchez.com';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_TYPES: FileMime[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

export interface FileMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: Date;
  url: string;
}

export interface FilePage {
  items: FileMeta[];
  page: number;
  totalPages: number;
  total: number;
}

export interface StoredFile {
  data: Buffer;
  mime: string;
  name: string;
}

// Absolute so stored URLs work from the web, the panel and the feed. Not a
// secret: the env variable only overrides it for local runs.
export function apiPublicUrl(): string {
  return (process.env.API_PUBLIC_URL || DEFAULT_PUBLIC_URL).replace(/\/+$/, '');
}

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async store(
    name: string,
    body: Buffer | typeof TOO_LARGE,
  ): Promise<FileMeta> {
    if (body === TOO_LARGE) throw new BadRequestException('File too large.');
    const mime = sniff(body);
    if (!mime) throw new BadRequestException('Unsupported file type.');
    const limit =
      mime === 'application/pdf' ? PDF_LIMIT_BYTES : IMAGE_LIMIT_BYTES;
    if (body.length > limit) throw new BadRequestException('File too large.');

    const file = await this.prisma.file.create({
      data: {
        // Cut by code points so a surrogate pair is never split.
        name: Array.from(name).slice(0, MAX_NAME_LENGTH).join(''),
        mime,
        size: body.length,
        data: new Uint8Array(body),
      },
      omit: { data: true },
    });
    return this.toMeta(file);
  }

  // Newest first, 50 per page; the bytes are never loaded for a listing.
  async list(page: number, kind?: FileKind): Promise<FilePage> {
    const where = kind
      ? { mime: kind === 'pdf' ? 'application/pdf' : { in: IMAGE_TYPES } }
      : {};
    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        omit: { data: true },
      }),
      this.prisma.file.count({ where }),
    ]);
    return {
      items: files.map((file) => this.toMeta(file)),
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
      total,
    };
  }

  async read(id: string): Promise<StoredFile> {
    const file = UUID_PATTERN.test(id)
      ? await this.prisma.file.findUnique({ where: { id } })
      : null;
    if (!file) throw new NotFoundException('Not found.');
    return { data: Buffer.from(file.data), mime: file.mime, name: file.name };
  }

  async urlOf(id: string): Promise<string> {
    const file = UUID_PATTERN.test(id)
      ? await this.prisma.file.findUnique({
          where: { id },
          omit: { data: true },
        })
      : null;
    if (!file) throw new NotFoundException('Not found.');
    return this.urlFor(file.id);
  }

  async remove(id: string): Promise<void> {
    const { count } = UUID_PATTERN.test(id)
      ? await this.prisma.file.deleteMany({ where: { id } })
      : { count: 0 };
    if (count === 0) throw new NotFoundException('Not found.');
  }

  private urlFor(id: string): string {
    return `${apiPublicUrl()}/files/${id}`;
  }

  private toMeta(file: Omit<FileMeta, 'url'>): FileMeta {
    const { id, name, mime, size, createdAt } = file;
    return { id, name, mime, size, createdAt, url: this.urlFor(id) };
  }
}
