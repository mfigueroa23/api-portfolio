import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { EmptyToNull, HTTP_URL_OPTIONS } from '../../common/dto-transforms.js';

// Fields shared by create and edit. Validation runs on writes only, so quotes
// over 500 characters saved before Spec 004 stay until edited. Spanish
// versions are optional and have their English field's limit.
abstract class TestimonialFieldsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  author: string;

  // Optional photo; the web shows the author's initials without one.
  @EmptyToNull()
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(500)
  avatar?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  quoteEs?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  roleEs?: string | null;
}

// Owner create (POST /content/testimonials): public at once, so the English
// quote and role are required. No position: a created item is always placed
// first (Spec 004 RF-82, RF-85).
export class CreateTestimonialDto extends TestimonialFieldsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  quote: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  role: string;
}

// Owner edit (PUT …/:id) and approval (POST …/:id/approve). The English quote
// and role may be empty so a pending Spanish submission can be saved; the
// service requires them to approve and on approved items (RF-67).
export class UpdateTestimonialDto extends TestimonialFieldsDto {
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  quote?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  role?: string | null;

  // Display position of an approved item.
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
