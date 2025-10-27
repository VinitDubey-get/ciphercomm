import React, { useState,useEffect } from 'react';
import { useWeb3 } from '../context/Web3context';
import { computeChatHash } from '../utils/chatHash.js';
import { ethers } from 'ethers';
import ethCrypto from 'eth-crypto';

function PeerConnector() {
  // 2. Get the peer and peerId from our global bubble
  const { peer, peerId, chatKeys, contract, setWeb3Data, messages, address, conn } = useWeb3();
  const [friendId, setFriendId] = useState(''); // Local state for the input field
  const [finalizeState, setFinalizeState] = useState({ status: 'idle', info: null });


  const setupConnection=(conn)=>{
    console.log(`connection established with ${conn.peer}`);

    setWeb3Data((prev)=>({...prev,conn}));

    conn.on('open',()=>{
      console.log('Sending public key...');

      conn.send({
        type:'key-exchange',
        payload:chatKeys.publicKey,
      })

      
    })

    // receiver handling incoming data
    conn.on('data',async(data)=>{

      try {
        // handle finalize recorded notification from peer
        if (data.type === 'finalize-recorded') {
          console.log('Received finalize-recorded', data.chatHash, data.txHash);
          // Update local finalized state
          setWeb3Data(prev => ({ ...prev, chatFinalized: { hash: data.chatHash, txHash: data.txHash, confirmedBy: [prev.address] } }));
          return;
        }

        if (data.type === 'key-exchange') {
          // handshake receive friend's key
          console.log("Received friend's public key",data.payload);

          // save it to our global state
          setWeb3Data((prev)=>({...prev,friendPublicKey:data.payload}))
        } else if (data.type === 'message') {
          console.log('Received encrypted message', data);

          // decrypt
          const decrypted = await ethCrypto.decryptWithPrivateKey(
            chatKeys.privateKey,
            data.payload
          );

          // add the decrypted message to chat log (no per-message verification)
          const newMessage = {
            id: Date.now(),
            sender: 'them',
            text: decrypted,
            verified: false
          };
          setWeb3Data((prev)=>({
            ...prev,
            messages:[...prev.messages,newMessage]
          }));
        }
      } catch (e) {
        console.error('Decryption or verification error', e);
      }

    });

    // hadling the connection closing
    conn.on('close',()=>{
      console.log('Connection Closed')
      setWeb3Data((prev)=>({...prev,conn:null,friendPublicKey:null}));
    })
    // handle connection errors
    conn.on('error',(err)=>{
      console.error('Connection Error',err);
    })
  }

    // for outgoing connections
    const connectToPeer=()=>{
      if(!peer) return alert('Peer is not initialized!');
      if(!friendId) return alert('Please enter a Friend Id');

      console.log(`Connecting to peer:${friendId}`);

      const newConn=peer.connect(friendId);
      setupConnection(newConn);

    }

    const proposeFinalize = async () => {
      if (!conn) return alert('Not connected to a peer');
      const chatHash = computeChatHash(messages || []);
      if (!chatHash) return alert('Failed to compute chat hash (no messages?)');
      console.log('Finalizing chat and recording hash on-chain', chatHash);
      if (!contract) return alert('Blockchain contract not initialized or signer not connected');
      try {
        const tx = await contract.recordHash(chatHash);
        console.log('Finalize: transaction sent', tx.hash);
        await tx.wait();
        console.log('Finalize: transaction confirmed', tx.hash);
        // notify peer that chat was recorded
        conn.send({ type: 'finalize-recorded', chatHash, txHash: tx.hash });
        // update local state
        setWeb3Data(prev => ({ ...prev, chatFinalized: { hash: chatHash, txHash: tx.hash, confirmedBy: [prev.address] } }));
        setFinalizeState({ status: 'recorded', info: { hash: chatHash, txHash: tx.hash } });
      } catch (e) {
        console.error('Finalize: recordHash failed', e);
        setFinalizeState({ status: 'error', info: e.message });
        alert('Failed to record chat hash on-chain: ' + e.message);
      }
    };

    // this 'useEffecti' is for incoming connections
    useEffect(()=>{
      if(peer && chatKeys){
        // listen for new connections
        const connectionHandler=(incomingConn)=>{
          console.log('Incoming Connection!',incomingConn)
          setupConnection(incomingConn);
        }
        peer.on('connection',connectionHandler);
        
      
    

          // cleanup function: remove old listeners when the component unomounts 
          return ()=>{
            if(peer){
              peer.off('connection',connectionHandler);
            }
          }
        }
        
    },[peer,chatKeys,setWeb3Data,contract]);
  
  


  return (
    <div className="peer-connector">
      <div className="your-id">
        {/* 6. Display the REAL Peer ID, or a loading message */}
        Your Peer ID: <strong>{peerId || 'Initializing...'}</strong>
      </div>
      <div className="friend-id">
        <input 
          type="text" 
          placeholder="Enter Friend's Peer ID" 
          value={friendId}
          onChange={(e) => setFriendId(e.target.value)}
        />
        <button onClick={connectToPeer}>Connect</button>
        <button onClick={proposeFinalize} style={{marginLeft:'8px'}}>Finalize Chat</button>
      </div>
    </div>
  );
}

export default PeerConnector;