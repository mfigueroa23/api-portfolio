export type FileMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp'
  | 'image/svg+xml'
  | 'application/pdf';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

function startsWith(
  bytes: Buffer,
  signature: number[] | string,
  at = 0,
): boolean {
  const expected =
    typeof signature === 'string'
      ? Buffer.from(signature, 'latin1')
      : Buffer.from(signature);
  return (
    bytes.length >= at + expected.length &&
    bytes.subarray(at, at + expected.length).equals(expected)
  );
}

// Sticky: they match only at lastIndex, so each test stays linear.
const WHITESPACE = /\s*/y;
const DOCTYPE = /<!DOCTYPE/iy;

// Index just past `end`, searched from `from`; -1 when it never appears.
function after(text: string, end: string, from: number): number {
  const at = text.indexOf(end, from);
  return at < 0 ? -1 : at + end.length;
}

// Index just past the `>` that closes a doctype, skipping its [internal
// subset]; -1 when the doctype is left open.
function doctypeEnd(text: string, from: number): number {
  for (let at = from; at < text.length; at++) {
    if (text[at] === '>') return at + 1;
    if (text[at] === '[') {
      at = text.indexOf(']', at + 1);
      if (at < 0) return -1;
    }
  }
  return -1;
}

// Index where the root element of an XML document starts, past what may
// precede it: whitespace, the XML declaration, comments, processing
// instructions and the doctype; -1 when one of them is left open. Scanned
// in one pass instead of with a regex so an upload cannot make it backtrack.
function rootStart(text: string): number {
  let at = 0;
  while (at >= 0) {
    WHITESPACE.lastIndex = at;
    WHITESPACE.test(text);
    at = WHITESPACE.lastIndex;
    DOCTYPE.lastIndex = at;
    if (text.startsWith('<?', at)) at = after(text, '?>', at + 2);
    else if (text.startsWith('<!--', at)) at = after(text, '-->', at + 4);
    else if (DOCTYPE.test(text)) at = doctypeEnd(text, DOCTYPE.lastIndex);
    else return at;
  }
  return -1;
}

function isSvg(bytes: Buffer): boolean {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  if (text.startsWith('﻿')) text = text.slice(1);
  const at = rootStart(text);
  return at >= 0 && /^<svg[\s>/]/.test(text.slice(at));
}

// Detects the type from the content only (magic bytes); the file name and the
// request Content-Type are never trusted. Anything else is refused.
export function sniff(bytes: Buffer): FileMime | null {
  if (startsWith(bytes, PNG)) return 'image/png';
  if (startsWith(bytes, JPEG)) return 'image/jpeg';
  if (startsWith(bytes, 'GIF87a') || startsWith(bytes, 'GIF89a')) {
    return 'image/gif';
  }
  if (startsWith(bytes, 'RIFF') && startsWith(bytes, 'WEBP', 8)) {
    return 'image/webp';
  }
  if (startsWith(bytes, '%PDF-')) return 'application/pdf';
  if (isSvg(bytes)) return 'image/svg+xml';
  return null;
}
