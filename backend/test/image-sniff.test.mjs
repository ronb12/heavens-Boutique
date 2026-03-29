import test from 'node:test';
import assert from 'node:assert/strict';
import { isProbablyImage, sniffContentType } from '../lib/imageSniff.js';

/** 1×1 transparent PNG */
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('sniffContentType recognizes minimal PNG', () => {
  const buf = Buffer.from(TINY_PNG_B64, 'base64');
  assert.equal(sniffContentType(buf), 'image/png');
  assert.equal(isProbablyImage(buf), true);
});

test('sniffContentType recognizes JPEG SOI', () => {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(sniffContentType(buf), 'image/jpeg');
  assert.equal(isProbablyImage(buf), true);
});

test('non-image rejected', () => {
  const buf = Buffer.from('not an image at all', 'utf8');
  assert.equal(isProbablyImage(buf), false);
  assert.equal(sniffContentType(buf), 'application/octet-stream');
});
