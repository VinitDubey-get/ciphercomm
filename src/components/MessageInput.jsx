import React, { useState, useRef } from 'react'
import { useWeb3 } from '../context/Web3context.jsx';
import { sendFile } from '../utils/fileTransfer.js';
import ethCrypto from 'eth-crypto';
import { stableStringify } from '../utils/stableStringify.js';

const MessageInput = () => {
  const { conn, chatKeys, friendPublicKey, setWeb3Data, contract, address, pinata, uploadToIpfs, sendMessage } = useWeb3();
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSendMessage = async () => {
    if (!message) return;
    if (!conn || !friendPublicKey) {
      console.warn('Missing conn or friendPublicKey; cannot send');
      return;
    }

    try {
      // encrypt the message with recipient public key
      const cipherObj = await ethCrypto.encryptWithPublicKey(friendPublicKey, message);
      const serialized = stableStringify(cipherObj);
      console.log('Sender: serialized cipher', serialized);

      const now = Date.now();
      const outgoing = {
        type: 'message',
        id: now,
        ts: now,
        sender: String(address || ''),
        payload: cipherObj
      };

      // send over PeerJS
      conn.send(outgoing);

      // optimistic UI update
      const newMessage = {
        id: now,
        ts: now,
        sender: String(address || ''),
        text: message,
        payload: cipherObj,
        verified: false
      };
      setWeb3Data((prev) => ({ ...prev, messages: [...prev.messages, newMessage] }));
      setMessage('');
    } catch (err) {
      console.error('Send message failed', err);
    }
  }

  const handleAttachClick = () => {
    if (isUploading) return;
    if (!uploadToIpfs && !pinata) return alert('Storage client not configured (check Web3context)');
    fileInputRef.current && fileInputRef.current.click();
  };

  const handleFileChange = async (ev) => {
    const file = ev?.target?.files?.[0];
    if (!file) return;
    if (!conn) { alert('You are not connected to a peer.'); return; }
    if (!uploadToIpfs && !pinata) { alert('Storage client not available.'); return; }

    setIsUploading(true);
    setUploadProgress(6);
    try {
      const uploadHelper = uploadToIpfs || (pinata ? (f, name) => pinata.pinFileToIPFS(f, { pinataMetadata: { name } }) : null);
      await sendFile({ file, conn, uploadToIpfs: uploadHelper, friendPublicKey, setWeb3Data, address, progressCb: (p) => setUploadProgress(p) });
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 650);
    } catch (err) {
      console.error('File upload failed', err);
      alert('File upload failed: ' + (err.message || err));
      setUploadProgress(0);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsUploading(false);
    }
  };

  return (
    <div className="composer">
      <button className="attach-btn" aria-label="Attach file" title="Attach file" onClick={handleAttachClick}>
        {/* paperclip / attachment icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21.44 11.05l-8.49 8.49a4.5 4.5 0 0 1-6.36-6.36l8.49-8.49a3.25 3.25 0 1 1 4.6 4.6l-8.49 8.49a1.5 1.5 0 0 1-2.12-2.12l7.07-7.07" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />

      <div className="input">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message or drop a file..." onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} style={{ width: '100%', minHeight: 44, background: 'transparent', border: 0, color: 'inherit', resize: 'none' }} />
        {uploadProgress > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="progress"><i style={{ width: `${uploadProgress}%` }} /></div>
          </div>
        )}
      </div>

      <button className="btn primary" onClick={handleSendMessage} aria-label="Send message">Send</button>
    </div>
  )
}

export default MessageInput