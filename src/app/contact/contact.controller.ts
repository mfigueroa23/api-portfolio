import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { translate } from '../common/i18n/messages.js';
import {
  HoneypotInterceptor,
  HoneypotReply,
} from '../common/interceptors/honeypot.interceptor.js';
import {
  CONTACT_INVALID_MESSAGE,
  CONTACT_SUCCESS_MESSAGE,
} from './contact.constants.js';
import { LangQueryDto, langOf } from '../content/common/lang.js';
import { ContactService } from './contact.service.js';
import { SendContactDto } from './dto/send-contact.dto.js';
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
  @HoneypotReply(CONTACT_SUCCESS_MESSAGE)
  async send(
    @Body(contactValidationPipe) message: ContactMessage,
    @Query() query?: LangQueryDto,
  ): Promise<{ message: string }> {
    // The page's language (`?lang=es`): Spanish answer, "Language" line.
    const lang = langOf(query);
    await this.contact.send(message, lang);
    return { message: translate(CONTACT_SUCCESS_MESSAGE, lang) };
  }
}
