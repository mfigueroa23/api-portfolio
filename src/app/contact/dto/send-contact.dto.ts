import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { EMAIL_PATTERN } from '../../common/validation/email.js';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SendContactDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name: string;

  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(EMAIL_PATTERN)
  email: string;

  @Transform(trim)
  @IsString()
  @Length(1, 5000)
  message: string;

  // Honeypot: handled by HoneypotInterceptor before validation; declared here
  // only so `whitelist` keeps it.
  @IsOptional()
  website?: unknown;
}
