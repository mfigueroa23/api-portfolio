import { PrismaFake } from '../../../test/fakes/prisma.fake.js';
import { PrismaService } from '../database/prisma.service.js';
import { FileReferencesService } from './file-references.service.js';

const BASE = 'https://api.figueroa-sanchez.com/files/';
const URL = `${BASE}2b1e0a4c-5d3f-4e2a-9b8c-7d6e5f4a3b2c`;
// Same id with one more character: must not count as a reference.
const NEAR_MISS = `${URL}d`;
const OTHER = `${BASE}2b1e0a4c-5d3f-4e2a-9b8c-7d6e5f4a3b2d`;

describe('FileReferencesService', () => {
  let prisma: PrismaFake;
  let service: FileReferencesService;

  beforeEach(() => {
    prisma = new PrismaFake();
    service = new FileReferencesService(prisma as unknown as PrismaService);
  });

  it('finds the URL in every collection field that can hold it, drafts included', async () => {
    await prisma.project.create({
      data: {
        slug: 'image',
        title: 'By image',
        image: URL,
        status: 'published',
      },
    });
    await prisma.project.create({
      data: { slug: 'body', title: 'By body', body: `![x](${URL})` },
    });
    await prisma.experience.create({
      data: { role: 'Engineer', company: 'Acme', body: `see ${URL}` },
    });
    await prisma.post.create({
      data: { slug: 'cover', title: 'By cover', coverUrl: URL },
    });
    await prisma.post.create({
      data: { slug: 'post-body', title: 'By post body', body: `[pdf](${URL})` },
    });
    await prisma.post.create({
      data: {
        slug: 'refs',
        title: 'By reference',
        references: [{ title: 'Spec', url: URL }],
        status: 'published',
      },
    });
    await prisma.certification.create({
      data: { name: 'AWS SAA', issuer: 'Amazon', fileUrl: URL },
    });
    await prisma.testimonial.create({
      data: { author: 'Grace Hopper', quote: 'Great.', avatar: URL },
    });

    await expect(service.find(URL)).resolves.toEqual([
      { collection: 'projects', id: 1, title: 'By image', status: 'published' },
      { collection: 'projects', id: 2, title: 'By body', status: 'draft' },
      { collection: 'experience', id: 1, title: 'Engineer · Acme' },
      { collection: 'posts', id: 1, title: 'By cover', status: 'draft' },
      { collection: 'posts', id: 2, title: 'By post body', status: 'draft' },
      {
        collection: 'posts',
        id: 3,
        title: 'By reference',
        status: 'published',
      },
      { collection: 'certifications', id: 1, title: 'AWS SAA' },
      { collection: 'testimonials', id: 1, title: 'Grace Hopper' },
    ]);
  });

  it('ignores near-miss and other file URLs', async () => {
    await prisma.project.create({
      data: { slug: 'near', title: 'Near', body: `![x](${NEAR_MISS})` },
    });
    await prisma.post.create({
      data: { slug: 'other', title: 'Other', coverUrl: OTHER },
    });
    await prisma.testimonial.create({
      data: { author: 'A', quote: 'Q', avatar: '/avatars/a.png' },
    });

    await expect(service.find(URL)).resolves.toEqual([]);
  });

  it('matches the URL followed by punctuation or a query', async () => {
    await prisma.project.create({
      data: { slug: 'q', title: 'Query', body: `<${URL}?download=1>` },
    });

    await expect(service.find(URL)).resolves.toHaveLength(1);
  });
});
