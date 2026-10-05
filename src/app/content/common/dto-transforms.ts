import { Transform } from 'class-transformer';

// Forms send '' for a field left empty; optional fields store it as null.
export function EmptyToNull(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    value === '' ? null : value,
  );
}

// Absolute http(s) URLs only (no javascript:, data: or relative paths). A TLD
// is not required so file URLs of a local API (http://localhost:3000) work.
export const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};
