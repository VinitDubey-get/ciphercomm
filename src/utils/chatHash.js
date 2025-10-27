import { ethers } from 'ethers';
import { stableStringify } from './stableStringify.js';

// Compute a deterministic hash for the entire chat messages array.
// We normalize messages to an array of objects with the ordered fields
// [id, sender, text] sorted by id (timestamp) to ensure both peers
// produce the same canonical representation.
export function computeChatHash(messages = []) {
  if (!Array.isArray(messages)) return null;

  const normalized = messages
    .map((m) => ({ id: m.id || 0, sender: m.sender || '', text: m.text || '' }))
    .sort((a, b) => (a.id - b.id));

  const serialized = stableStringify(normalized);
  return ethers.keccak256(ethers.toUtf8Bytes(serialized));
}
