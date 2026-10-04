import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma, Project } from '../../../generated/prisma/client.js';
import { MarkdownService } from '../../markdown/markdown.service.js';
import { assertComplete, publish, unpublish } from '../common/publishable.js';
import { assertSlugFree } from '../common/slug.js';
import { ProjectDto } from './dto/projects.dto.js';

// Besides title and slug (always required by the DTO).
const REQUIRED_TO_PUBLISH = ['description', 'image'] as const;
// Newest publication first; id breaks ties (rows backfilled together).
const BY_PUBLICATION: Prisma.ProjectOrderByWithRelationInput[] = [
  { publishedAt: 'desc' },
  { id: 'desc' },
];

export type ProjectSummary = Omit<Project, 'body'>;
export type ProjectDetail = Project & { bodyHtml: string };

function toData(dto: ProjectDto) {
  return {
    slug: dto.slug,
    title: dto.title,
    description: dto.description ?? null,
    image: dto.image ?? null,
    tags: dto.tags ?? [],
    link: dto.link ?? null,
    github: dto.github ?? null,
    body: dto.body ?? null,
  };
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly markdown: MarkdownService,
  ) {}

  // Public: published projects only, without the (large) body.
  listPublished(limit?: number): Promise<ProjectSummary[]> {
    return this.prisma.project.findMany({
      where: { status: 'published' },
      orderBy: BY_PUBLICATION,
      take: limit,
      omit: { body: true },
    });
  }

  // Admin: drafts first (never published ones on top), then published.
  listAll(): Promise<Project[]> {
    return this.prisma.project.findMany({
      orderBy: [
        { status: 'asc' },
        { publishedAt: { sort: 'desc', nulls: 'first' } },
        { id: 'desc' },
      ],
    });
  }

  async findPublishedBySlug(slug: string): Promise<ProjectDetail> {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project || project.status !== 'published') {
      throw new NotFoundException('Not found.');
    }
    const bodyHtml = project.body
      ? this.markdown.render(project.body).html
      : '';
    return { ...project, bodyHtml };
  }

  async create(dto: ProjectDto): Promise<Project> {
    await assertSlugFree(this.prisma.project, dto.slug);
    return this.prisma.project.create({
      data: { ...toData(dto), status: 'draft' },
    });
  }

  async update(id: number, dto: ProjectDto): Promise<Project> {
    const existing = await this.findById(id);
    await assertSlugFree(this.prisma.project, dto.slug, id);
    const data = toData(dto);
    if (existing.status === 'published') {
      assertComplete(data, REQUIRED_TO_PUBLISH);
    }
    return this.prisma.project.update({ where: { id }, data });
  }

  async publish(id: number): Promise<Project> {
    const existing = await this.findById(id);
    assertComplete(existing, REQUIRED_TO_PUBLISH);
    return this.prisma.project.update({
      where: { id },
      data: publish(existing),
    });
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  unpublish(id: number): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data: unpublish() });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  private async findById(id: number): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Not found.');
    return project;
  }
}
