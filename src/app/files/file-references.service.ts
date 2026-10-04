import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export interface FileReference {
  // The panel's collection key.
  collection:
    'projects' | 'experience' | 'posts' | 'certifications' | 'testimonials';
  id: number;
  title: string;
  status?: 'draft' | 'published';
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Values a JSON column may hold, searched recursively (post references).
function textsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textsOf);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(textsOf);
  }
  return [];
}

// Finds every content item, draft or published, whose URL-bearing fields
// contain a file's URL. A single owner's content is a few hundred rows, so it
// is scanned in memory (plan D13) instead of with per-table SQL.
@Injectable()
export class FileReferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async find(url: string): Promise<FileReference[]> {
    // The URL must not continue with an id character, so `…/files/<id>x`
    // never counts as `…/files/<id>`.
    const pattern = new RegExp(`${escapeRegExp(url)}(?![0-9A-Za-z-])`);
    const uses = (...values: unknown[]) =>
      values.flatMap(textsOf).some((text) => pattern.test(text));
    const byId = { orderBy: { id: 'asc' as const } };

    const [projects, experiences, posts, certifications, testimonials] =
      await Promise.all([
        this.prisma.project.findMany(byId),
        this.prisma.experience.findMany(byId),
        this.prisma.post.findMany(byId),
        this.prisma.certification.findMany(byId),
        this.prisma.testimonial.findMany(byId),
      ]);

    return [
      ...projects
        .filter((row) => uses(row.image, row.body))
        .map((row): FileReference => ({
          collection: 'projects',
          id: row.id,
          title: row.title,
          status: row.status,
        })),
      ...experiences
        .filter((row) => uses(row.body))
        .map((row): FileReference => ({
          collection: 'experience',
          id: row.id,
          title: `${row.role} · ${row.company}`,
        })),
      ...posts
        .filter((row) => uses(row.coverUrl, row.body, row.references))
        .map((row): FileReference => ({
          collection: 'posts',
          id: row.id,
          title: row.title,
          status: row.status,
        })),
      ...certifications
        .filter((row) => uses(row.fileUrl))
        .map((row): FileReference => ({
          collection: 'certifications',
          id: row.id,
          title: row.name,
        })),
      ...testimonials
        .filter((row) => uses(row.avatar))
        .map((row): FileReference => ({
          collection: 'testimonials',
          id: row.id,
          title: row.author,
        })),
    ];
  }
}
