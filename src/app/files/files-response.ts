export interface ServedFile {
  mime: string;
  name: string;
}

// RFC 5987 encoding, so any name (quotes, CR/LF, accents) is a safe header value.
function encodeFileName(name: string): string {
  return encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

// Headers of GET /files/:id. The CSP sandbox and nosniff keep scripts inside
// an uploaded SVG from running when its URL is opened directly (an <img> never
// runs them); the URL never changes for a file, so it can be cached forever.
export function fileHeaders(file: ServedFile): Record<string, string> {
  return {
    'Content-Type': file.mime,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy':
      "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    'Content-Disposition': `inline; filename*=UTF-8''${encodeFileName(file.name)}`,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };
}
