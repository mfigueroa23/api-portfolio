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
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_BODY_LENGTH } from '../../../markdown/dto/render-markdown.dto.js';
import { EmptyToNull, HTTP_URL_OPTIONS } from '../../common/dto-transforms.js';
import { LangQueryDto } from '../../common/lang.js';
import {
  RESERVED_POST_SLUGS,
  SLUG_ES_FORMAT_MESSAGE,
  SLUG_FORMAT_MESSAGE,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
} from '../../common/slug.js';

// Letters (any script), digits, spaces and hyphens; compared ignoring case.
export const TAG_PATTERN = /^[\p{L}\p{N} -]{1,30}$/u;

export class PostReferenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleEs?: string | null;

  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(500)
  url: string;
}

// Used for create and for update (PUT replaces the whole post). A draft only
// needs title and slug; summary and body are required to publish (checked by
// the service).
export class PostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleEs?: string | null;

  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: SLUG_FORMAT_MESSAGE })
  @IsNotIn(RESERVED_POST_SLUGS, {
    message: `slug cannot be ${RESERVED_POST_SLUGS.join(' or ')}`,
  })
  slug: string;

  // Spanish URL slug; same format and reserved words as `slug`, accepted
  // without a Spanish title (RF-166–RF-168).
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: SLUG_ES_FORMAT_MESSAGE })
  @IsNotIn(RESERVED_POST_SLUGS, {
    message: `slugEs cannot be ${RESERVED_POST_SLUGS.join(' or ')}`,
  })
  slugEs?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  summaryEs?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(500)
  coverUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(TAG_PATTERN, {
    each: true,
    message: 'each tag must have 1 to 30 letters, digits, spaces or hyphens',
  })
  tags?: string[];

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BODY_LENGTH)
  body?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BODY_LENGTH)
  bodyEs?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PostReferenceDto)
  references?: PostReferenceDto[];
}

export class ListPostsQueryDto extends LangQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  // A tag key (lowercase, spaces as hyphens); compared ignoring case.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tag?: string;
}
