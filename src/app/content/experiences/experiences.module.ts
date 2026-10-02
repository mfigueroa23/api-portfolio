import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { ExperiencesController } from './experiences.controller.js';
import { ExperiencesService } from './experiences.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ExperiencesController],
  providers: [ExperiencesService],
})
export class ExperiencesModule {}
