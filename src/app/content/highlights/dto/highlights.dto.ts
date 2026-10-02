import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

// Used for create and for update (PUT replaces the whole item). Limits match
// the column sizes; unknown fields are stripped by the global ValidationPipe.
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;
}
