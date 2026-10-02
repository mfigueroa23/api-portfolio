import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

// Used for create and for update (PUT replaces the whole item). Limits match
// the column sizes; unknown fields are stripped by the global ValidationPipe.
export class TestimonialDto {
  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  quote: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  author: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  role: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  avatar: string;
}
