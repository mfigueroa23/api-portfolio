import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TOO_LARGE } from '../common/middlewares/raw-body.middleware.js';
import {
  ListFilesQueryDto,
  UploadFileQueryDto,
} from './dto/files-query.dto.js';
import { FileReferencesService } from './file-references.service.js';
import type { FileReference } from './file-references.service.js';
import { fileHeaders } from './files-response.js';
import { FilesService } from './files.service.js';
import type { FileMeta, FilePage } from './files.service.js';

// Uploads arrive as the raw request body (read by RawBodyMiddleware) with the
// display name in the query. Reading a file is public; the rest is the owner's.
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly fileReferences: FileReferencesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  upload(
    @Query() query: UploadFileQueryDto,
    @Req() req: Request,
  ): Promise<FileMeta> {
    return this.files.store(query.name, req.body as Buffer | typeof TOO_LARGE);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query() query: ListFilesQueryDto): Promise<FilePage> {
    return this.files.list(query.page ?? 1, query.type);
  }

  @Get(':id')
  async read(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const file = await this.files.read(id);
    res.set(fileHeaders(file)).send(file.data);
  }

  @Get(':id/references')
  @UseGuards(JwtAuthGuard)
  async references(@Param('id') id: string): Promise<FileReference[]> {
    return this.fileReferences.find(await this.files.urlOf(id));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.files.remove(id);
  }
}
