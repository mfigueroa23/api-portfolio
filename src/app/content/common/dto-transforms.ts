import { Transform } from 'class-transformer';

// Forms send '' for a field left empty; optional fields store it as null.
export function EmptyToNull(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    value === '' ? null : value,
  );
}

// Absolute http(s) URLs only (no javascript:, data: or relative paths).
export const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
};
