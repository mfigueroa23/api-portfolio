import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

// Used for create and for update (PUT replaces the whole item). Limits match
// the column sizes; unknown fields are stripped by the global ValidationPipe.
export class TechnologyDto {
  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
