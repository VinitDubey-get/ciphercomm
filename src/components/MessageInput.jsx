import React,{useState} from 'react'
import { useWeb3 } from '../context/Web3context.jsx';
import { ethers } from 'ethers';
import ethCrypto from 'eth-crypto';
import { stableStringify } from '../utils/stableStringify.js';

const MessageInput = () => {
  const { conn, contract, chatKeys, friendPublicKey, setWeb3Data } = useWeb3();
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

      // send encrypted payload to peer
      conn.send({
        type: 'message',
        payload: cipherObj
      });

      // update local messages UI (no on-chain verification per-message)
      const newMessage={
        id:Date.now(),
        sender:'me',
        text:message,
        verified:false
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