import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNotIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_BODY_LENGTH } from '../../../markdown/dto/render-markdown.dto.js';
import { EmptyToNull, HTTP_URL_OPTIONS } from '../../common/dto-transforms.js';
import {
  RESERVED_PROJECT_SLUGS,
  SLUG_FORMAT_MESSAGE,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
} from '../../common/slug.js';

// Used for create and for update (PUT replaces the whole item). A draft only
// needs slug and title; description and image are required to publish (checked
// by the service). Unknown fields, `position` included, are stripped by the
// global ValidationPipe.
export class ProjectDto {
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: SLUG_FORMAT_MESSAGE })
  @IsNotIn(RESERVED_PROJECT_SLUGS, {
    message: `slug cannot be ${RESERVED_PROJECT_SLUGS.join(' or ')}`,
  })
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  tags?: string[];

  @EmptyToNull()
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(500)
  link?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(500)
  github?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BODY_LENGTH)
  body?: string | null;
}

export class ListProjectsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
