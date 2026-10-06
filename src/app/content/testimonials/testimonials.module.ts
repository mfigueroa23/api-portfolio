import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { MailModule } from '../../mail/mail.module.js';
import { TestimonialSubmissionsController } from './testimonial-submissions.controller.js';
import { TestimonialsController } from './testimonials.controller.js';
import { TestimonialsService } from './testimonials.service.js';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [TestimonialsController, TestimonialSubmissionsController],
  providers: [TestimonialsService],
})
export class TestimonialsModule {}
