import type { Request } from 'express';

// The API is only reachable through the Cloudflare tunnel, and Cloudflare
// overwrites CF-Connecting-IP with the visitor's address, so it is trusted over
// req.ip (which is the tunnel or ingress address in production).
export function clientIp(req: Request): string {
  const header = req.headers['cf-connecting-ip'];
  const fromCloudflare = (Array.isArray(header) ? header[0] : header)?.trim();
  return fromCloudflare || req.ip || 'unknown';
}
