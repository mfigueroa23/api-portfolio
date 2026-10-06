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

// Owner create (POST /content/testimonials). No position: a created item is
// always placed first (Spec 004 RF-82, RF-85). Validation runs on writes only,
// so quotes over 500 characters saved before Spec 004 stay until edited.
export class CreateTestimonialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  quote: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  author: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  role: string;

  // Optional photo; the web shows the author's initials without one.
  @EmptyToNull()
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(500)
  avatar?: string | null;
}

// Owner edit (PUT …/:id) and approval (POST …/:id/approve): the form values,
// plus the display position of an approved item.
export class UpdateTestimonialDto extends CreateTestimonialDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
