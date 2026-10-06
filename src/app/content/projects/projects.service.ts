import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma, Project } from '../../../generated/prisma/client.js';
import { MarkdownService } from '../../markdown/markdown.service.js';
import { assertComplete, publish, unpublish } from '../common/publishable.js';
import type { Lang } from '../common/lang.js';
import { assertSlugFree, assertUrlSlugFree } from '../common/slug.js';
import {
  BILINGUAL_FIELDS,
  isTranslated,
  localize,
  Localized,
} from '../common/translation.js';
import { ProjectDto } from './dto/projects.dto.js';

// Besides title and slug (always required by the DTO).
const REQUIRED_TO_PUBLISH = ['description', 'image'] as const;
// Newest publication first; id breaks ties (rows backfilled together).
const BY_PUBLICATION: Prisma.ProjectOrderByWithRelationInput[] = [
  { publishedAt: 'desc' },
  { id: 'desc' },
];

const FIELDS = BILINGUAL_FIELDS.projects;
type LocalizedProject = Localized<Project, (typeof FIELDS)[number]>;

// Public reads carry `slug` and `slugEs` so the web can build both URLs.
export type ProjectSummary = Omit<LocalizedProject, 'body'>;
export type ProjectDetail = LocalizedProject & { bodyHtml: string };
export type AdminProject = Project & { translated: boolean };

function toData(dto: ProjectDto) {
  return {
    slug: dto.slug,
    slugEs: dto.slugEs ?? null,
    title: dto.title,
    titleEs: dto.titleEs ?? null,
    description: dto.description ?? null,
    descriptionEs: dto.descriptionEs ?? null,
    image: dto.image ?? null,
    tags: dto.tags ?? [],
    link: dto.link ?? null,
    github: dto.github ?? null,
    body: dto.body ?? null,
    bodyEs: dto.bodyEs ?? null,
  };
}

// The body is read to decide whether the project is translated (RF-149) and
// dropped from the summary.
function toSummary(project: Project, lang: Lang): ProjectSummary {
  const { body: _body, ...summary } = localize(project, FIELDS, lang);
  return summary;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly markdown: MarkdownService,
  ) {}

  // Public: published projects only, without the (large) body.
  async listPublished(
    limit?: number,
    lang: Lang = 'en',
  ): Promise<ProjectSummary[]> {
    const projects = await this.prisma.project.findMany({
      where: { status: 'published' },
      orderBy: BY_PUBLICATION,
      take: limit,
    });
    return projects.map((project) => toSummary(project, lang));
  }

  // Admin: drafts first (never published ones on top), then published.
  async listAll(): Promise<AdminProject[]> {
    const projects = await this.prisma.project.findMany({
      orderBy: [
        { status: 'asc' },
        { publishedAt: { sort: 'desc', nulls: 'first' } },
        { id: 'desc' },
      ],
    });
    return projects.map((project) => ({
      ...project,
      translated: isTranslated(project, FIELDS),
    }));
  }

  // The body is rendered from the language shown (RF-153, RF-158).
  async findPublishedBySlug(
    slug: string,
    lang: Lang = 'en',
  ): Promise<ProjectDetail> {
    const project =
      lang === 'es'
        ? await this.findPublishedBySpanishSlug(slug)
        : await this.prisma.project.findUnique({ where: { slug } });
    if (!project || project.status !== 'published') {
      throw new NotFoundException('Not found.');
    }
    const localized = localize(project, FIELDS, lang);
    const bodyHtml = localized.body
      ? this.markdown.render(localized.body).html
      : '';
    return { ...localized, bodyHtml };
  }

  async create(dto: ProjectDto): Promise<Project> {
    await assertSlugFree(this.prisma.project, dto.slug);
    await assertUrlSlugFree(this.prisma.project, dto);
    return this.prisma.project.create({
      data: { ...toData(dto), status: 'draft' },
    });
  }

  async update(id: number, dto: ProjectDto): Promise<Project> {
    const existing = await this.findById(id);
    await assertSlugFree(this.prisma.project, dto.slug, id);
    await assertUrlSlugFree(this.prisma.project, dto, id);
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

  // RF-169, RF-175: the Spanish URL slug (slugEs, or slug without one) first;
  // otherwise the English slug of a project that has a Spanish one, returned
  // with both slugs so the web can redirect to the Spanish URL.
  private async findPublishedBySpanishSlug(
    slug: string,
  ): Promise<Project | null> {
    const published = { status: 'published' as const };
    return (
      (await this.prisma.project.findFirst({
        where: { ...published, OR: [{ slugEs: slug }, { slugEs: null, slug }] },
      })) ??
      (await this.prisma.project.findFirst({
        where: { ...published, slug, slugEs: { not: null } },
      }))
    );
  }

  private async findById(id: number): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Not found.');
    return project;
  }
}
