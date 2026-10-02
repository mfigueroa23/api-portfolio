import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { ContactInfoController } from './contact-info.controller.js';
import { ContactInfoService } from './contact-info.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ContactInfoController],
  providers: [ContactInfoService],
})
export class ContactInfoModule {}
