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
     
  
    useEffect(() => {
      // Create a contract instance usable for reads (provider) and writes (signer).
      // This lets receivers (who may not have a signer) still call view functions
      // such as verifyHash.
      const signerOrProvider = web3Data.signer || web3Data.provider;

      if (!signerOrProvider) {
        // clear contract when neither provider nor signer is available
        setWeb3Data(prev => ({ ...prev, contract: null }));
        return;
      }

      try {
        const contractInstance = new ethers.Contract(
          contractAdress,
          contractABI,
          signerOrProvider
        );

        setWeb3Data((prev) => ({ ...prev, contract: contractInstance }));
        console.log('Contract instance created (provider/signer)', !!web3Data.signer, contractInstance);
      } catch (e) {
        console.error('Failed to create contract instance', e);
        setWeb3Data(prev => ({ ...prev, contract: null }));
      }

    }, [web3Data.signer, web3Data.provider]);

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