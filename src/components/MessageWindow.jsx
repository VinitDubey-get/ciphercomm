import React, { useEffect, useRef } from 'react'
import { useWeb3 } from '../context/Web3context';

const MessageWindow = () => {
  const { messages = [], address: myAddress } = useWeb3();
  const endOfMessagesRef = useRef(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = ts => {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  }

  return (
    <div className="message-window">
      {(messages || []).map((msg) => {
        const senderId = String(msg.sender || '');
        const isMe = myAddress && senderId.toLowerCase() === String(myAddress).toLowerCase();
        return (
          <div key={msg.id} className={`msg-row ${isMe ? 'me' : 'them'} fade-in`}>
            {!isMe && <div className="avatar">{(senderId || '').slice(2, 6).toUpperCase()}</div>}
            <div className="bubble">
              <div className="bubble-content">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    {msg.isFileType ? (
                      <div className="file-preview">
                        <div className="file-thumb">
                          {msg.dataUrl && typeof msg.dataUrl === 'string' && msg.dataUrl.startsWith('data:image') ? (
                            <img src={msg.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={msg.name} />
                          ) : (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12V8z"></path></svg>
                          )}
                        </div>
                        <div className="file-meta">
                          <div className="file-name">{msg.name || 'file'}</div>
                          <div className="file-actions">
                            {msg.isDownloadable && msg.dataUrl ? (
                              <a className="btn primary" href={msg.dataUrl} download={msg.name || 'download'}>Download</a>
                            ) : (
                              <button className="btn">Fetching...</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <div className="ts">{formatTime(msg.ts)}</div>
                </div>
              </div>
            </div>
            {isMe && <div className="avatar" style={{ opacity: 0.9 }}>{(senderId || '').slice(2, 6).toUpperCase()}</div>}
          </div>
        )
      })}
      <div ref={endOfMessagesRef} />
    </div>
  )
}

export default MessageWindow