import React,{useState} from 'react'
import { useWeb3 } from '../context/Web3context.jsx';
import { ethers } from 'ethers';
import ethCrypto from 'eth-crypto';
import { stableStringify } from '../utils/stableStringify.js';

const MessageInput = () => {
  const { conn, chatKeys, friendPublicKey, setWeb3Data,contract, address } = useWeb3();
  const [message,setMessage]=useState('');

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
  return (
    <div className='message-input'>
      <input type="text" placeholder='Type your encrypted message....'  value={message} onChange={(e)=>setMessage(e.target.value)}
       onKeyDown={(e)=>e.key=='Enter' &&handleSendMessage()}
      />
      <button onClick={handleSendMessage}>Send</button>
      <button>Attach File</button>
    </div>
  )
}

export default MessageInput