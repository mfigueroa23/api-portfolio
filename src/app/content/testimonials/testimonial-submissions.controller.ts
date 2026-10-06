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
  HoneypotInterceptor,
  HoneypotReply,
} from '../../common/interceptors/honeypot.interceptor.js';
import { SubmitTestimonialDto } from './dto/submit-testimonial.dto.js';
import type { TestimonialSubmission } from './interfaces/testimonial-submission.interface.js';
import {
  TESTIMONIAL_INVALID_MESSAGE,
  TESTIMONIAL_SUCCESS_MESSAGE,
} from './testimonials.constants.js';
import { TestimonialsService } from './testimonials.service.js';

// Like the contact form: one generic message for every validation failure
// (including a malformed body, which JsonBodyMiddleware leaves undefined). The
// parameter is typed with an interface so the global ValidationPipe skips it.
const submissionValidationPipe = new ValidationPipe({
  expectedType: SubmitTestimonialDto,
  whitelist: true,
  transform: true,
  exceptionFactory: () => new BadRequestException(TESTIMONIAL_INVALID_MESSAGE),
});

// Public submissions live apart from /content/testimonials, which stays
// "public reads, owner writes" (plan D6). Rate limited in AppModule.
@Controller('testimonials')
export class TestimonialSubmissionsController {
  constructor(private readonly service: TestimonialsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(HoneypotInterceptor)
  @HoneypotReply(TESTIMONIAL_SUCCESS_MESSAGE)
  async submit(
    @Body(submissionValidationPipe) submission: TestimonialSubmission,
  ): Promise<{ message: string }> {
    // English-only until Spec 004 phase 3 adds `?lang`.
    await this.service.submit(submission, 'en');
    return { message: TESTIMONIAL_SUCCESS_MESSAGE };
  }
}
