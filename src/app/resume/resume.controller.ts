import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { resumeHeaders } from '../files/files-response.js';
import { AssignResumeDto } from './dto/assign-resume.dto.js';
import { ResumeLangParamDto, ResumeQueryDto } from './dto/resume-lang.dto.js';
import { ResumeService } from './resume.service.js';
import type { ResumeAssignments } from './resume.service.js';

// GET /resume is the stable public URL of the current PDF (RF-19); the
// assignment routes are the owner's. Express adds the ETag, so a cached copy
// that is still current costs a 304.
@Controller('resume')
export class ResumeController {
  constructor(private readonly service: ResumeService) {}

  @Get()
  async download(
    @Query() query: ResumeQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.service.publicFile(query.lang);
    res.set(resumeHeaders(file)).send(file.data);
  }

  @Get('assignments')
  @UseGuards(JwtAuthGuard)
  assignments(): Promise<ResumeAssignments> {
    return this.service.assignments();
  }

  @Put('assignments/:lang')
  @UseGuards(JwtAuthGuard)
  assign(
    @Param() params: ResumeLangParamDto,
    @Body() dto: AssignResumeDto,
  ): Promise<ResumeAssignments> {
    return this.service.assign(params.lang, dto.fileId);
  }

  @Delete('assignments/:lang')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  clear(@Param() params: ResumeLangParamDto): Promise<void> {
    return this.service.clear(params.lang);
  }
}
