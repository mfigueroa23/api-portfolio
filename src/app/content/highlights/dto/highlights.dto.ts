import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EmptyToNull } from '../../common/dto-transforms.js';

// Used for create and for update (PUT replaces the whole item). Limits match
// the column sizes; each optional `<field>Es` (Spanish) has its English
// field's limit; unknown fields are stripped by the global ValidationPipe.
export class HighlightDto {
  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  icon: string;

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
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descriptionEs?: string | null;
}
