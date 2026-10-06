import { Module } from '@nestjs/common';
import { BrevoClient } from './brevo.client.js';
import { MailService } from './mail.service.js';

@Module({
  providers: [MailService, BrevoClient],
  exports: [MailService],
})
export class MailModule {}
