// A 256-bit difference hash: it survives re-saving, resizing and small crops, and changes little
// when small details such as a view count change.
const SIZE = 16;
export async function imageFingerprint(image: Buffer) {
  // Loaded here so a missing native binary only skips fingerprinting and cannot stop the API from starting.
  const { default: sharp } = await import('sharp');
  const { data } = await sharp(image).rotate().flatten({ background: '#ffffff' }).greyscale().resize(SIZE + 1, SIZE, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let hex = '';
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x += 4) {
      let nibble = 0;
      for (let bit = 0; bit < 4; bit++) nibble = (nibble << 1) | (data[y * (SIZE + 1) + x + bit] > data[y * (SIZE + 1) + x + bit + 1] ? 1 : 0);
      hex += nibble.toString(16);
    }
  }
  return hex;
}

export function fingerprintDistance(a: string, b: string) {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < a.length; index++) {
    let difference = parseInt(a[index], 16) ^ parseInt(b[index], 16);
    while (difference) { distance += difference & 1; difference >>= 1; }
  }
  return distance;
}

type Reading = { fingerprint: string; views?: number; handle?: string };

// Measured on sample screenshots: re-saved copies sit up to about 38 bits from the original and
// unrelated images about 95. Honest promoters posting the same creative can sit under 10, closer
// than a re-saved copy, so looking alike is never enough. The value read from the image must also
// match: two honest posts rarely share an exact view count, while a copy always does.
const MAX_DISTANCE = 40;
export function isNearDuplicate(current: Reading, other: Reading) {
  if (fingerprintDistance(current.fingerprint, other.fingerprint) > MAX_DISTANCE) return false;
  if (current.views !== undefined && other.views !== undefined) return current.views === other.views;
  return Boolean(current.views === undefined && other.views === undefined && current.handle && current.handle.toLowerCase() === other.handle?.toLowerCase());
}
