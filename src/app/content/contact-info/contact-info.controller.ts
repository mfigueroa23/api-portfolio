import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { ContactInfo } from '../../../generated/prisma/client.js';
import { ContactInfoDto } from './dto/contact-info.dto.js';
import { ContactInfoService } from './contact-info.service.js';

// Reading is public; writing requires the administrator's token.
@Controller('content/contact-info')
export class ContactInfoController {
  constructor(private readonly service: ContactInfoService) {}

  @Get()
  list(): Promise<ContactInfo[]> {
    return this.service.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: ContactInfoDto): Promise<ContactInfo> {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ContactInfoDto,
  ): Promise<ContactInfo> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
