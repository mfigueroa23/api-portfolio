import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Project } from '../../../generated/prisma/client.js';
import { ProjectDto } from './dto/projects.dto.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // Display order set by the owner; id breaks ties so the order is stable.
  list(): Promise<Project[]> {
    return this.prisma.project.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  }

  create(dto: ProjectDto): Promise<Project> {
    return this.prisma.project.create({ data: dto });
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  update(id: number, dto: ProjectDto): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }
}
