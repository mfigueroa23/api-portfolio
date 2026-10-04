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

  it('refuses an empty body and truncated signatures', () => {
    expect(sniff(Buffer.alloc(0))).toBeNull();
    expect(sniff(samples.png.subarray(0, 4))).toBeNull();
    expect(sniff(Buffer.from('RIFF\x00\x00\x00\x00WAVE', 'latin1'))).toBeNull();
  });
});
