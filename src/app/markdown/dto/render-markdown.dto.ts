import { IsString, MaxLength } from 'class-validator';

export const MAX_BODY_LENGTH = 100_000;

export class RenderMarkdownDto {
  @IsString()
  @MaxLength(MAX_BODY_LENGTH)
  markdown: string;
}
