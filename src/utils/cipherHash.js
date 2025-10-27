import { ethers } from 'ethers';
import { stableStringify } from './stableStringify.js';

// Normalize a value to a hex-prefixed string when possible.
function _normalizeToHex(value) {
  if (typeof value !== 'string') return null;
  // already 0x hex
  if (value.startsWith('0x') && /^[0-9a-fA-F]+$/.test(value.slice(2))) return value;
  // plain hex
  if (/^[0-9a-fA-F]+$/.test(value)) return '0x' + value;
  // base64
  if (/^[A-Za-z0-9+/=]+$/.test(value)) {
    try {
      const buf = Buffer.from(value, 'base64');
      return ethers.hexlify(buf);
    } catch (e) {
      // fall through
    }
  }
  // fallback: hexlify utf8
  try {
    return ethers.hexlify(ethers.toUtf8Bytes(value));
  } catch (e) {
    return null;
  }
}

// Robust canonical hash: build a normalized object of the expected fields
// with hex-prefixed values, stable-stringify it, then keccak256 the utf8 bytes.
export function computeCipherHash(cipherObj) {
  if (!cipherObj) return null;

  const normalized = {};
  if (cipherObj.ciphertext) normalized.ciphertext = _normalizeToHex(cipherObj.ciphertext);
  if (cipherObj.iv) normalized.iv = _normalizeToHex(cipherObj.iv);
  if (cipherObj.ephemPublicKey) normalized.ephemPublicKey = _normalizeToHex(cipherObj.ephemPublicKey);
  if (cipherObj.ephemeralPublicKey) normalized.ephemeralPublicKey = _normalizeToHex(cipherObj.ephemeralPublicKey);
  if (cipherObj.mac) normalized.mac = _normalizeToHex(cipherObj.mac);

  // remove null values
  Object.keys(normalized).forEach(k => { if (!normalized[k]) delete normalized[k]; });

  if (Object.keys(normalized).length === 0) {
    console.warn('computeCipherHash: no valid normalized fields', cipherObj);
    return null;
  }

  try {
    const serialized = stableStringify(normalized);
    // debug log trimmed
    console.debug('computeCipherHash: normalized', serialized.slice(0, 120));
    return ethers.keccak256(ethers.toUtf8Bytes(serialized));
  } catch (e) {
    console.error('computeCipherHash: failed to stable-stringify/hash', e, cipherObj);
    return null;
  }
}
