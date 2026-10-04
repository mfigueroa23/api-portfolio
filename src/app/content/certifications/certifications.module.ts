import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { CertificationsController } from './certifications.controller.js';
import { CertificationsService } from './certifications.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CertificationsController],
  providers: [CertificationsService],
})
export class CertificationsModule {}
