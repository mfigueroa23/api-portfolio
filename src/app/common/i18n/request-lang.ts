import type { Request } from 'express';
import { langOf, type Lang } from '../../content/common/lang.js';

// The page language of a form submission comes in the query string (plan
// D19): it is known before the rate limit and the JSON parser run, so even a
// 429 or a malformed body can be answered in Spanish. Anything but "es" is
// English (RF-181).
export function requestLang(req: Request): Lang {
  return langOf(req.query as { lang?: unknown } | undefined);
}
