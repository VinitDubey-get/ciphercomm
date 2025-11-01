import ethCrypto from 'eth-crypto';
import CryptoJS from 'crypto-js';

// Handle incoming file pointer payload: { cid, key, name }
// - chatKeys: { privateKey }
// - setWeb3Data: function to update messages state
export async function handleIncomingFile(payload, chatKeys, setWeb3Data, options = {}) {
  const { cid, key: encryptedKeyObj, name } = payload || {};
  const now = Date.now();
  const placeholder = {
    id: now,
    ts: now,
    sender: 'them',
    text: `[Receiving file: "${name}" - downloading from IPFS...]`,
    isFileType: true,
  };

  // push placeholder
  setWeb3Data(prev => ({ ...prev, messages: [...prev.messages, placeholder] }));

  try {
    if (!chatKeys || !chatKeys.privateKey) throw new Error('No chat private key available to decrypt file key');

    const encKeyObj = (typeof encryptedKeyObj === 'string') ? JSON.parse(encryptedKeyObj) : encryptedKeyObj;
    const aesKey = await ethCrypto.decryptWithPrivateKey(chatKeys.privateKey, encKeyObj);

    // Try to fetch via Pinata gateway first (or via provided options.pinata), otherwise fall back to ipfs.io
    let encryptedData = null;
    try {
      if (options && options.pinata && typeof options.pinata.get === 'function') {
        // If pinata client provides a get method, attempt to use it (SDK shapes vary)
        const res = await options.pinata.get(cid);
        if (res && typeof res.arrayBuffer === 'function') {
          const buf = await res.arrayBuffer();
          encryptedData = new TextDecoder().decode(buf);
        } else if (res && typeof res.files === 'function') {
          const files = await res.files();
          if (files && files.length) encryptedData = await files[0].text();
        }
      }
    } catch (e) {
      console.warn('Pinata client fetch failed, falling back to gateway', e);
      encryptedData = null;
    }

    if (!encryptedData) {
      const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
      const resp = await fetch(gatewayUrl);
      if (!resp.ok) throw new Error(`IPFS fetch failed: ${resp.status} ${resp.statusText}`);
      encryptedData = await resp.text();
    }

    const decryptedDataUrl = CryptoJS.AES.decrypt(encryptedData, aesKey).toString(CryptoJS.enc.Utf8);
    if (!decryptedDataUrl) throw new Error('Decryption failed or produced empty result (wrong key?)');

    const downloadedMsg = {
      ...placeholder,
      text: `[File received: "${name}"]`,
      dataUrl: decryptedDataUrl,
      isDownloadable: true,
      name,
    };

    setWeb3Data(prev => ({ ...prev, messages: prev.messages.map(m => m.id === placeholder.id ? downloadedMsg : m) }));
    return downloadedMsg;
  } catch (err) {
    setWeb3Data(prev => ({ ...prev, messages: prev.messages.map(m => m.id === placeholder.id ? { ...m, text: `[Error receiving file] ${err.message}` } : m) }));
    throw err;
  }
}

// sendFile: encapsulate client-side file upload + encryption + pointer send
// params: { file, conn, ipfs, friendPublicKey, setWeb3Data, address, maxSize }
export async function sendFile({ file, conn, uploadToIpfs, friendPublicKey, setWeb3Data, address, maxSize = 50 * 1024 * 1024 }) {
  if (!file) throw new Error('No file provided');
  if (!conn) throw new Error('No peer connection available');
  if (!uploadToIpfs) throw new Error('No uploadToIpfs helper available');
  if (!friendPublicKey) throw new Error('Recipient public key not available');

  // optimistic UI placeholder
  const tempId = Date.now();
  const tempMsg = { id: tempId, ts: tempId, sender: String(address || ''), text: `[Uploading "${file.name}"]`, isFileType: true, payload: null };
  setWeb3Data(prev => ({ ...prev, messages: [...prev.messages, tempMsg] }));

  try {
    if (file.size > maxSize) throw new Error(`File exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit`);

    // 1) generate AES key (hex)
    const aesKey = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);

    // 2) read file as DataURL
    const fileDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });

    // 3) AES encrypt the DataURL string
    const encryptedData = CryptoJS.AES.encrypt(fileDataUrl, aesKey).toString();

  // 4) upload encrypted string via uploadToIpfs helper
  const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
  const result = await uploadToIpfs(blob, file.name + '.enc');
  const cid = result?.IpfsHash || result?.cid || result || String(result);

    // 5) encrypt AES key with recipient's public key
    const encryptedKeyObj = await ethCrypto.encryptWithPublicKey(friendPublicKey, aesKey);

    // 6) send pointer message (cid + encrypted key + name)
    const pointer = { type: 'file', payload: { cid, key: encryptedKeyObj, name: file.name } };
    conn.send(pointer);

    // 7) update temp message to indicate sent
    setWeb3Data(prev => ({ ...prev, messages: prev.messages.map(m => m.id === tempId ? { ...m, text: `[You sent file: "${file.name}"]`, payload: { cid, name: file.name } } : m) }));

    return { cid, name: file.name };
  } catch (err) {
    // update UI placeholder to show error
    setWeb3Data(prev => ({ ...prev, messages: prev.messages.map(m => m.id === tempId ? { ...m, text: `[Upload failed: "${file?.name || 'file'}"]` } : m) }));
    throw err;
  }
}

export default { handleIncomingFile, sendFile };
