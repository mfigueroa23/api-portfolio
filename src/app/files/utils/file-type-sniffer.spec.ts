import { samples } from '../../../../test/fixtures/file-samples.js';
import { sniff } from './file-type-sniffer.js';

describe('sniff', () => {
  it.each([
    ['png', 'image/png'],
    ['jpeg', 'image/jpeg'],
    ['gif', 'image/gif'],
    ['gif87', 'image/gif'],
    ['webp', 'image/webp'],
    ['pdf', 'application/pdf'],
    ['svg', 'image/svg+xml'],
    ['svgWithProlog', 'image/svg+xml'],
    ['svgWithScript', 'image/svg+xml'],
  ] as const)('recognises %s as %s', (sample, mime) => {
    expect(sniff(samples[sample])).toBe(mime);
  });

  it('decides by content, so a PNG named .pdf is still a PNG', () => {
    // The name never reaches the sniffer; only the bytes do.
    expect(sniff(samples.png)).toBe('image/png');
  });

  it.each(['text', 'html', 'zip', 'svgNotUtf8', 'svgLookAlike'] as const)(
    'refuses %s',
    (sample) => {
      expect(sniff(samples[sample])).toBeNull();
    },
  );

  it('skips a lowercase doctype with an internal subset', () => {
    const svg = Buffer.from(
      '<!doctype svg [ <!ENTITY a "b"> ]>\n<svg xmlns="http://www.w3.org/2000/svg"/>',
    );
    expect(sniff(svg)).toBe('image/svg+xml');
  });

  it.each([
    ['declaration', '<?xml version="1.0"'],
    ['comment', '<!-- note'],
    ['doctype', '<!DOCTYPE svg'],
    ['internal subset', '<!DOCTYPE svg [ <!ENTITY a "b">'],
  ])('refuses a %s left open before the root', (_, prolog) => {
    expect(sniff(Buffer.from(`${prolog}<svg></svg>`))).toBeNull();
  });

  it.each([
    ['<!doctype[', '[]'],
    ['<!doctype', ']'],
    ['<?', ']><?'],
    ['<!--', '?><!--'],
    ['', '<?a?><!--b-->'],
  ])('scans %s followed by many %s in linear time', (start, repeated) => {
    const hostile = Buffer.from(start + repeated.repeat(100_000));
    const began = performance.now();
    expect(sniff(hostile)).toBeNull();
    expect(performance.now() - began).toBeLessThan(500);
  });

  it('refuses an empty body and truncated signatures', () => {
    expect(sniff(Buffer.alloc(0))).toBeNull();
    expect(sniff(samples.png.subarray(0, 4))).toBeNull();
    expect(sniff(Buffer.from('RIFF\x00\x00\x00\x00WAVE', 'latin1'))).toBeNull();
  });
});
