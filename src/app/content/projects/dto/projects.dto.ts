import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// Used for create and for update (PUT replaces the whole item). Limits match
// the column sizes; unknown fields are stripped by the global ValidationPipe.
export class ProjectDto {
  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  image: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  tags: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  link: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  github: string;
}
