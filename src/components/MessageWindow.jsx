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
          <div className="message-body">
            {/* If this message contains a downloadable/decrypted file, show a preview + download link */}
            {msg.isDownloadable && msg.dataUrl ? (
              <div className="file-attachment">
                {/* If it's an image data URL, show a small preview */}
                {typeof msg.dataUrl === 'string' && msg.dataUrl.startsWith('data:image') ? (
                  <div className="image-preview">
                    <img src={msg.dataUrl} alt={msg.name || 'image'} style={{ maxWidth: '240px', maxHeight: '240px' }} />
                  </div>
                ) : null}

                {/* Download link (works for data: and blob: URLs) */}
                <div>
                  <a href={msg.dataUrl} download={msg.name || 'file'}>
                    {msg.name ? `Download: ${msg.name}` : 'Download file'}
                  </a>
                </div>
              </div>
            ) : (
              <p>{msg.text}</p>
            )}

            {/* --- START: Day 8 Verification Display --- */}
            {/* Only show verification status for INCOMING messages */}
            {/* No per-message verification UI — verification occurs only when chat is finalized */}
            {/* --- END: Day 8 Verification Display --- */}
          </div>
        </div>
      ))}
      <div ref={endOfMessagesRef} />
    </div>
  )
}

export default MessageWindow