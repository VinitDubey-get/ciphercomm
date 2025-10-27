import React,{useEffect,useRef} from 'react'
import { useWeb3 } from '../context/Web3context';

const MessageWindow = () => {

  // ensure we always have an array to map over (protect against accidental state overwrite)
  const {messages = []}=useWeb3();
  

  const endOfMessagesRef=useRef(null);

  const scrollToBottom=()=>{
    endOfMessagesRef.current?.scrollIntoView({behavior:'smooth'});
  }

  useEffect(()=>{
    scrollToBottom();
  },[messages]);

  return (
    <div className="message-window">
      {(messages || []).map((msg) => (
        // Key should be unique - msg.id (Date.now()) should work
        <div key={msg.id} className={`message ${msg.sender}`}>
          <p>
            {msg.text}
            
            {/* --- START: Day 8 Verification Display --- */}
            {/* Only show verification status for INCOMING messages */}
            {/* No per-message verification UI — verification occurs only when chat is finalized */}
            {/* --- END: Day 8 Verification Display --- */}

          </p>
        </div>
      ))}
      <div ref={endOfMessagesRef} />
    </div>
  )
}

export default MessageWindow