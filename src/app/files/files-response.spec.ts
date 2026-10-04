import { fileHeaders } from './files-response.js';

describe('fileHeaders', () => {
  it('serves the exact type with headers that keep scripts from running', () => {
    expect(fileHeaders({ mime: 'image/svg+xml', name: 'logo.svg' })).toEqual({
      'Content-Type': 'image/svg+xml',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      'Content-Disposition': "inline; filename*=UTF-8''logo.svg",
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
  });

  it('encodes any name safely in Content-Disposition', () => {
    const headers = fileHeaders({
      mime: 'application/pdf',
      name: `Año "final" (v2)'s.pdf\r\nX: y`,
    });

    expect(headers['Content-Disposition']).toBe(
      "inline; filename*=UTF-8''A%C3%B1o%20%22final%22%20%28v2%29%27s.pdf%0D%0AX%3A%20y",
    );
  });
});
