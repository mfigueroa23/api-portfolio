import { Module } from '@nestjs/common';
import { BrevoClient } from './clients/brevo.client.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({
  controllers: [ContactController],
  providers: [ContactService, BrevoClient],
})
export class ContactModule {}
