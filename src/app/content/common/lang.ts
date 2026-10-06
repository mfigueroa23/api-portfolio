import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export type Lang = 'en' | 'es';

// `?lang=` of the public reads. Anything other than "es" (missing, "fr", a
// repeated parameter…) means English, so the query never fails validation.
export class LangQueryDto {
  @Transform(({ value }: { value: unknown }) => (value === 'es' ? 'es' : 'en'))
  @IsOptional()
  @IsIn(['en', 'es'])
  lang?: Lang;
}

export const langOf = (query?: { lang?: unknown }): Lang =>
  query?.lang === 'es' ? 'es' : 'en';
