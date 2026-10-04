import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { MAX_BODY_LENGTH } from '../../../markdown/dto/render-markdown.dto.js';
import { MONTH_PATTERN } from '../../common/calendar-dates.js';
import { EmptyToNull } from '../../common/dto-transforms.js';

// Used for create and for update (PUT replaces the whole item). Limits match
// the column sizes; unknown fields are stripped by the global ValidationPipe.
export class ExperienceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  period: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  role: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  company: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  technologies: string[];

  @IsBoolean()
  current: boolean;

  // Month and year the role started (YYYY-MM); `period` stays the display text.
  @IsString()
  @Matches(MONTH_PATTERN, { message: 'startDate must be a month as YYYY-MM' })
  startDate: string;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BODY_LENGTH)
  body?: string | null;
}
