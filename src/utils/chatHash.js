import { ethers } from 'ethers';
import { stableStringify } from './stableStringify.js';

// Compute a deterministic hash for the entire chat using the encrypted payloads.
// Each message must include a `payload` object (the eth-crypto cipher) and metadata.
export function computeChatHash(messages = []) {
  if (!Array.isArray(messages)) return null;

  const normalized = messages
    .map((m) => {
      const id = m.id || 0;
      const ts = m.ts || m.id || 0;
      const sender = String(m.sender || '');
      const p = m.payload || {};
      const cipher = {
        ciphertext: String(p.ciphertext || p.cipher || ''),
        iv: String(p.iv || ''),
        ephemPublicKey: String(p.ephemPublicKey || p.ephemeralPublicKey || ''),
        mac: String(p.mac || '')
      };
      return { id, ts, sender, cipher };
    })
    // sort by timestamp then id for deterministic ordering
    .sort((a, b) => (a.ts - b.ts) || (a.id - b.id));

  const serialized = stableStringify(normalized);
  return ethers.keccak256(ethers.toUtf8Bytes(serialized));
}
