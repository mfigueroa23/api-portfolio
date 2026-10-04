import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Post, Prisma } from '../../../generated/prisma/client.js';
import { MarkdownService, TocEntry } from '../../markdown/markdown.service.js';
import { assertComplete, publish, unpublish } from '../common/publishable.js';
import { assertSlugFree } from '../common/slug.js';
import { PostDto } from './dto/post.dto.js';

const PAGE_SIZE = 10;
const FEED_SIZE = 20;
// Besides title and slug (always required by the DTO).
const REQUIRED_TO_PUBLISH = ['title', 'slug', 'summary', 'body'] as const;
const BY_PUBLICATION: Prisma.PostOrderByWithRelationInput[] = [
  { publishedAt: 'desc' },
  { id: 'desc' },
];
const PUBLISHED = { status: 'published' as const };

export type PostSummary = Omit<Post, 'body'> & { readingMinutes: number };
export type PostDetail = Post & {
  bodyHtml: string;
  toc: TocEntry[];
  readingMinutes: number;
};
export interface PostPage {
  items: PostSummary[];
  page: number;
  totalPages: number;
  total: number;
  // Display name of the filtered tag, or null without a filter.
  tag: string | null;
}

// The key a tag is compared and linked by: lowercase, spaces as hyphens.
export function tagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-');
}

// Trims tags and drops repeats that differ only in case or spacing, keeping
// the first spelling for display.
export function normalizeTags(raw: string[] | undefined): {
  tags: string[];
  tagKeys: string[];
} {
  const tags: string[] = [];
  const tagKeys: string[] = [];
  for (const tag of raw ?? []) {
    const trimmed = tag.trim();
    const key = tagKey(trimmed);
    if (!key || tagKeys.includes(key)) continue;
    tags.push(trimmed);
    tagKeys.push(key);
  }
  return { tags, tagKeys };
}

function toData(dto: PostDto) {
  return {
    title: dto.title,
    slug: dto.slug,
    summary: dto.summary ?? null,
    coverUrl: dto.coverUrl ?? null,
    ...normalizeTags(dto.tags),
    body: dto.body ?? null,
    references: (dto.references ?? []).map(({ title, url }) => ({
      title,
      url,
    })),
  };
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly markdown: MarkdownService,
  ) {}

  // Public listing: 10 per page, newest first. A page past the last one or a
  // tag without published posts is 404; page 1 of an empty blog is not.
  async listPublished(query: {
    page: number;
    tag?: string;
  }): Promise<PostPage> {
    const key = query.tag === undefined ? undefined : tagKey(query.tag);
    const where: Prisma.PostWhereInput = key
      ? { ...PUBLISHED, tagKeys: { has: key } }
      : PUBLISHED;
    const total = await this.prisma.post.count({ where });
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (
      (key !== undefined && total === 0) ||
      query.page > Math.max(totalPages, 1)
    ) {
      throw new NotFoundException('Not found.');
    }
    const posts = await this.prisma.post.findMany({
      where,
      orderBy: BY_PUBLICATION,
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    const first = posts[0];
    const tag =
      key && first ? (first.tags[first.tagKeys.indexOf(key)] ?? key) : null;
    return {
      items: posts.map((post) => this.toSummary(post)),
      page: query.page,
      totalPages,
      total,
      tag,
    };
  }

  async feed(): Promise<PostSummary[]> {
    const posts = await this.prisma.post.findMany({
      where: PUBLISHED,
      orderBy: BY_PUBLICATION,
      take: FEED_SIZE,
    });
    return posts.map((post) => this.toSummary(post));
  }

  // Admin: drafts first (never published ones on top), then published.
  listAll(): Promise<Post[]> {
    return this.prisma.post.findMany({
      orderBy: [
        { status: 'asc' },
        { publishedAt: { sort: 'desc', nulls: 'first' } },
        { id: 'desc' },
      ],
    });
  }

  async findPublishedBySlug(slug: string): Promise<PostDetail> {
    const post = await this.prisma.post.findUnique({ where: { slug } });
    if (!post || post.status !== 'published') {
      throw new NotFoundException('Not found.');
    }
    const { html, toc, readingMinutes } = this.markdown.render(post.body ?? '');
    return { ...post, bodyHtml: html, toc, readingMinutes };
  }

  async create(dto: PostDto): Promise<Post> {
    await assertSlugFree(this.prisma.post, dto.slug);
    return this.prisma.post.create({
      data: { ...toData(dto), status: 'draft' },
    });
  }

  async update(id: number, dto: PostDto): Promise<Post> {
    const existing = await this.findById(id);
    await assertSlugFree(this.prisma.post, dto.slug, id);
    const data = toData(dto);
    if (existing.status === 'published') {
      assertComplete(data, REQUIRED_TO_PUBLISH);
    }
    return this.prisma.post.update({ where: { id }, data });
  }

  async publish(id: number): Promise<Post> {
    const existing = await this.findById(id);
    assertComplete(existing, REQUIRED_TO_PUBLISH);
    return this.prisma.post.update({ where: { id }, data: publish(existing) });
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  unpublish(id: number): Promise<Post> {
    return this.prisma.post.update({ where: { id }, data: unpublish() });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.post.delete({ where: { id } });
  }

  private toSummary({ body, ...post }: Post): PostSummary {
    return {
      ...post,
      readingMinutes: this.markdown.render(body ?? '').readingMinutes,
    };
  }

  private async findById(id: number): Promise<Post> {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Not found.');
    return post;
  }
}
