import { ethers } from 'ethers';
import { peerRegistryAddress, peerRegistryABI } from '../config';

// Register a peerId on-chain using a signer-connected contract instance
export async function registerPeerId(signer, peerId) {
  if (!signer) throw new Error('No signer provided');
  if (!peerRegistryAddress || !peerRegistryABI) throw new Error('PeerRegistry config missing');

  const signerAddress = await signer.getAddress();
  const reg = new ethers.Contract(peerRegistryAddress, peerRegistryABI, signer);

  // Optional: callStatic check if the value is already set to avoid unnecessary tx
  try {
    const existing = await reg.getPeerId(signerAddress).catch(() => null);
    if (existing && existing === peerId) return { status: 'already', peerId };
  } catch (e) {
    // ignore
  }

  const tx = await reg.registerPeerId(peerId);
  const receipt = await tx.wait();
  return { status: 'ok', txHash: tx.hash, receipt };
}

// Try fast view call, then fallback to scanning PeerIdUpdated events
export async function getPeerIdWithFallback(provider, readRegistryContract, targetAddress, opts = {}) {
  if (!targetAddress) throw new Error('targetAddress required');
  // normalize
  const addr = ethers.getAddress(targetAddress);

  // 1) try fast view call via readRegistryContract if present
  if (readRegistryContract && typeof readRegistryContract.getPeerId === 'function') {
    try {
      const r = await readRegistryContract.getPeerId(addr);
      if (r && r !== '') return r;
    } catch (e) {
      // continue to logs fallback
      console.warn('readRegistry.getPeerId failed, falling back to logs', e && e.message ? e.message : e);
    }
  }

  // 2) fallback to scanning events
  try {
    const prov = provider || (readRegistryContract && readRegistryContract.provider);
    if (!prov) throw new Error('No provider available for event scan');

    const iface = new ethers.Interface(peerRegistryABI);
    // compute topic0 for PeerIdUpdated(address,string,uint256)
    const topic0 = ethers.id('PeerIdUpdated(address,string,uint256)');

    const current = await prov.getBlockNumber();
    const lookback = opts.lookbackBlocks || 50000;
    const fromBlock = Math.max(0, Number(current) - lookback);
    // Request all PeerIdUpdated logs (no topic1) then filter by parsed.args.user
    const filter = { address: peerRegistryAddress, fromBlock, toBlock: 'latest', topics: [topic0] };
    const logs = await prov.getLogs(filter);
    if (!logs || logs.length === 0) return null;

    // parse logs and find the most recent entry matching the requested address
    let found = null;
    for (const l of logs) {
      try {
        const parsed = iface.parseLog(l);
        const user = String(parsed.args.user).toLowerCase();
        if (user === addr.toLowerCase()) {
          found = { peerId: parsed.args.peerId, blockNumber: l.blockNumber };
        }
      } catch (e) {
        // ignore parse errors
      }
    }
    return found ? String(found.peerId) : null;
  } catch (e) {
    console.warn('Event fallback failed', e && e.message ? e.message : e);
    return null;
  }
}

export default { registerPeerId, getPeerIdWithFallback };
