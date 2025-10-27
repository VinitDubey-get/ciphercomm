import React, {createContext,useContext,useState,useEffect} from 'react';
import {ethers} from 'ethers';
import { contractAdress,contractABI } from '../config';


// creating the context 
// this is what components will use to find the bubble
const Web3Context=createContext(null);

// this component hold the data and wrap the app
export function Web3Provider({children}){
    // use usestate to store the wallet data
    // null is default alue 
    const [web3Data,setWeb3Data]=useState({
      provider:null,
      signer:null,
      address:null,
      chatKeys:null,
      peer:null,
      peerId:null,
      conn:null,
      friendPublicKey:null,
      messages:[],
      contract:null,
      chatFinalized: null, // { hash, txHash, confirmedBy: [addresses] }
    });
     
  
    useEffect(()=>{
      const signer = web3Data.signer;
      if (!signer) {
        // clear contract when there's no signer
        setWeb3Data(prev => ({ ...prev, contract: null }));
        return;
      }

      const contractInstance = new ethers.Contract(
        contractAdress,
        contractABI,
        signer
      );

      setWeb3Data((prev) => ({ ...prev, contract: contractInstance }));
      console.log('Contract instance created', contractInstance);

    },[web3Data.signer])

    const value={
      ...web3Data,setWeb3Data,
    }
    return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>

}

export function useWeb3(){
  const context=useContext(Web3Context);
  if(!context){
    throw new Error('useWeb3 must be used within a web3provider');
  }
  return context;
}