import React,{useEffect} from 'react'
import PeerConnector from './PeerConnector'
import MessageInput from './MessageInput'
import MessageWindow from './MessageWindow'

import { useWeb3 } from '../context/Web3context'
import * as ethCrypto from 'eth-crypto'
import {Peer} from 'peerjs'

import { ethers } from 'ethers'

const Chat = () => {
  const {signer,setWeb3Data}=useWeb3();

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
    <div className='chat-window'>
      <PeerConnector></PeerConnector>
      <MessageWindow />
      <MessageInput />
    </div>
  )
}

export default Chat