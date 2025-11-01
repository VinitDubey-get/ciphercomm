import React,{useEffect} from 'react'
import PeerConnector from './PeerConnector'
import MessageInput from './MessageInput'
import MessageWindow from './MessageWindow'
import logo from '../assets/logo.svg'

import { useWeb3 } from '../context/Web3context'
import * as ethCrypto from 'eth-crypto'
import {Peer} from 'peerjs'

import { ethers } from 'ethers'

const Chat = () => {
  const {signer,setWeb3Data, conn, friendWallet, address }=useWeb3();

  const shortAddr = (a) => {
    if(!a) return '';
    return a.length > 12 ? `${a.slice(0,6)}...${a.slice(-4)}` : a;
  };

  useEffect(()=>{
    const initialize=async()=>{
      if(!signer){
        return;
      }
      try{
        console.log('Generating chat keys....');

        const signature=await signer.signMessage("Login to CipherComm");
        
        const privateKey=ethers.keccak256(signature);
        const publicKey=ethCrypto.publicKeyByPrivateKey(privateKey)

        const identity={privateKey,publicKey};

        console.log('Chat keys generated',identity);

        // P2P initializations
        console.log('Initializing PeerJS...');

        const newPeer=new Peer();

        newPeer.on('open',(id)=>{
          console.log('My Peer Id is : ' + id);

          setWeb3Data((prev)=>({
            ...prev,
            chatKeys:identity,
            peer:newPeer,
            peerId:id,
          }))
        })
        // set up error handling
        newPeer.on('error',(err)=>{
          console.error('PeerJS Error',err);
          
        });

      }
      catch(err){
        console.error('Initialization failed',err);
        alert('Failed to initialize. you may need to sign the message in metamask')
      }
    }
    initialize();
  },[signer]);
  return (
    <div className='chat-wrap'>

      <div className='chat-window'>
        <div className="chat-header">
          <div className="brand">
            <img src={logo} alt="CipherComm" className="logo small" />
            <strong>CipherComm</strong>
          </div>
          {/* show status-pill only when connected to a peer */}
          {/* {conn && friendWallet && (
            <div className="status-pill">
              <span className="status-dot connected" />
              <span>Connected to <span className="ts">{shortAddr(friendWallet)}</span></span>
            </div>
          )} */}
        </div>

        {/* Render PeerConnector directly below the header inside the chat window */}
        <div className="peer-area">
          <PeerConnector />
        </div>

        <MessageWindow />
        <MessageInput />
      </div>
    </div>
  )
}

export default Chat