import type { Request } from 'express';
import { clientIp } from './client-ip.js';

function req(headers: Record<string, string | string[]>, ip?: string) {
  return { headers, ip } as unknown as Request;
}

describe('clientIp', () => {
  it('prefers the CF-Connecting-IP header set by Cloudflare', () => {
    expect(
      clientIp(req({ 'cf-connecting-ip': '203.0.113.7' }, '10.0.0.5')),
    ).toBe('203.0.113.7');
  });

  it('uses the first value when the header is repeated', () => {
    expect(
      clientIp(
        req({ 'cf-connecting-ip': ['203.0.113.7', '1.1.1.1'] }, '10.0.0.5'),
      ),
    ).toBe('203.0.113.7');
  });

  it('falls back to the socket address without the header', () => {
    expect(clientIp(req({}, '10.0.0.5'))).toBe('10.0.0.5');
  });

  it('falls back to the socket address when the header is blank', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '  ' }, '10.0.0.5'))).toBe(
      '10.0.0.5',
    );
  });

  it('returns "unknown" when no address is available', () => {
    expect(clientIp(req({}))).toBe('unknown');
  });
});
