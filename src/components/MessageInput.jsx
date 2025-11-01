import React,{useState,useRef} from 'react'
import { useWeb3 } from '../context/Web3context.jsx';
import { ethers } from 'ethers';
import { sendFile } from '../utils/fileTransfer.js';
import { stableStringify } from '../utils/stableStringify.js';
import ethCrypto from 'eth-crypto';

const MessageInput = () => {
  const { conn, chatKeys, friendPublicKey, setWeb3Data, contract, address, pinata, uploadToIpfs } = useWeb3();
  const [message,setMessage]=useState('');
  const fileInputRef=useRef(null);
  const [isUploading,setIsUploading]=useState(false);

  const handleSendMessage=async()=>{
    if(!conn || !contract || !friendPublicKey){
      return console.warn('Missing conn/contract/friendPublicKey');
    }

    try{
      // create deterministic cipher object
      const cipherObj = await ethCrypto.encryptWithPublicKey(friendPublicKey, message);
  // keep stringified version for debugging
  const serialized = stableStringify(cipherObj);
  console.log('Sender: serialized cipher', serialized);

      // include deterministic metadata (id/ts/sender) so both peers compute the same chat hash
      const now = Date.now();
      const outgoing = {
        type: 'message',
        id: now,
        ts: now,
        sender: String(address || ''),
        payload: cipherObj
      };
      // send encrypted payload to peer
      conn.send(outgoing);

      // update local messages UI (store encrypted payload for finalize hashing)
      const newMessage={
        id: now,
        ts: now,
        sender: String(address || ''),
        text:message,       // optional local plaintext copy
        payload: cipherObj, // encrypted object (essential)
        verified: false
      };
      setWeb3Data((prev)=>({
        ...prev,
        messages:[...prev.messages,newMessage]
      }))
      setMessage('');
    }
    catch(err){
      console.error('Send message failed', err);
    }
   
  }
  const handleAttachClick = () => {
  if (isUploading) return;
   if (!uploadToIpfs && !pinata) return alert('Storage client not configured (check Web3context)');
   // open native file picker
   fileInputRef.current && fileInputRef.current.click();
  };


  const handleFileChange = async (ev) => {
    const file = ev?.target?.files?.[0];
  if (!file) return;
  if (!conn) { alert('You are not connected to a peer.'); return; }
  if (!uploadToIpfs && !pinata) { alert('Storage client not available.'); return; }

    setIsUploading(true);
    try {
  await sendFile({ file, conn, uploadToIpfs: uploadToIpfs || (pinata ? (f, name) => pinata.pinFileToIPFS(f, { pinataMetadata: { name } }) : null), friendPublicKey, setWeb3Data, address });
    } catch (err) {
      console.error('File upload failed', err);
      alert('File upload failed: ' + (err.message || err));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsUploading(false);
    }
  };


  return (
    <div className='message-input'>
      <input type="text" placeholder='Type your encrypted message....'  value={message} onChange={(e)=>setMessage(e.target.value)}
       onKeyDown={(e)=>e.key=='Enter' &&handleSendMessage()}
      />
      <button onClick={handleSendMessage}>Send</button>

      <button onClick={handleAttachClick} disabled={isUploading}>{isUploading ? 'Uploading...' : 'Attach File'}</button>
      {/* hidden native file input */}
      <input ref={fileInputRef} type="file" onChange={handleFileChange} style={{ display: 'none' }} />
    </div>
  )
}

export default MessageInput