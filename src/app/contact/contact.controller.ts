import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import {
  CONTACT_INVALID_MESSAGE,
  CONTACT_SUCCESS_MESSAGE,
} from './contact.constants.js';
import { ContactService } from './contact.service.js';
import { SendContactDto } from './dto/send-contact.dto.js';
import { HoneypotInterceptor } from './interceptors/honeypot.interceptor.js';
import type { ContactMessage } from './interfaces/contact-message.interface.js';

// The contact form answers every validation failure with one generic message
// instead of the global per-field format. The parameter is typed with an
// interface so the global ValidationPipe skips it (its metatype is Object), and
// this pipe validates against SendContactDto through `expectedType`.
const contactValidationPipe = new ValidationPipe({
  expectedType: SendContactDto,
  whitelist: true,
  transform: true,
  exceptionFactory: () => new BadRequestException(CONTACT_INVALID_MESSAGE),
});

@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(HoneypotInterceptor)
  async send(
    @Body(contactValidationPipe) message: ContactMessage,
  ): Promise<{ message: string }> {
    await this.contact.send(message);
    return { message: CONTACT_SUCCESS_MESSAGE };
  }
}
