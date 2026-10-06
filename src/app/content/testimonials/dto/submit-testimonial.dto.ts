import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { EMAIL_PATTERN } from '../../../common/validation/email.js';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

// Name and role reach the email subject and reply-to, so they must be one line.
const SINGLE_LINE = /^[^\r\n]*$/;
// Rejects names made only of emoji, symbols or invisible characters.
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

// Public submission of POST /testimonials. Every failure is answered with one
// generic message by the controller's pipe, so no per-field messages here.
export class SubmitTestimonialDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  @Matches(SINGLE_LINE)
  @Matches(LETTER_OR_DIGIT)
  name: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  @Matches(SINGLE_LINE)
  @Matches(LETTER_OR_DIGIT)
  role: string;

  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(EMAIL_PATTERN)
  email: string;

  @Transform(trim)
  @IsString()
  @Length(1, 500)
  testimonial: string;

  // Honeypot: handled by HoneypotInterceptor before validation; declared here
  // only so `whitelist` keeps it.
  @IsOptional()
  website?: unknown;
}
