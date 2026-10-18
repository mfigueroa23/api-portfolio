import { IsIn, IsOptional } from 'class-validator';
import type { Lang } from '../../content/common/lang.js';

export const RESUME_LANGS: readonly Lang[] = ['en', 'es'];

// `:lang` of the owner's routes.
export class ResumeLangParamDto {
  @IsIn(RESUME_LANGS)
  lang: Lang;
}

// `?lang=` of GET /resume. Unlike the content reads (LangQueryDto), anything
// but "en" or "es" is a 400 (RF-17, plan D8); left out means English.
export class ResumeQueryDto {
  @IsOptional()
  @IsIn(RESUME_LANGS)
  lang?: Lang;
}
