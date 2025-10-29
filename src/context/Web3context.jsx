import React, {createContext,useContext,useState,useEffect} from 'react';
import {ethers} from 'ethers';
import { contractAdress,contractABI, peerRegistryAddress, peerRegistryABI } from '../config';


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
      registryContract: null,
      _readRegistry: null,
      providerForReadonly: null,
      chatFinalized: null, // { hash, txHash, confirmedBy: [addresses] }
    });
     
  
    // initialize provider and signer on mount
    useEffect(() => {
      (async () => {
        try {
          let provider = null;
          let signer = null;
          let address = null;

          // Prefer window.ethereum (MetaMask) when available
          if (typeof window !== 'undefined' && window.ethereum) {
            try {
              // ethers v6 BrowserProvider wraps window.ethereum
              provider = new ethers.BrowserProvider(window.ethereum);
              // try to get accounts (won't prompt)
              const accounts = await provider.send('eth_accounts', []);
              if (accounts && accounts.length > 0) {
                signer = await provider.getSigner();
                try { address = await signer.getAddress(); } catch (e) { address = null; }
              }
            } catch (e) {
              console.warn('Failed to init BrowserProvider from window.ethereum, falling back to JsonRpcProvider', e.message || e);
              provider = null;
            }
          }

          // Fall back to a local Ganache JSON-RPC provider if no wallet provider
          if (!provider) {
            const rpc = 'http://127.0.0.1:8545';
            try {
              provider = new ethers.JsonRpcProvider(rpc);
              console.log('Initialized read-only provider for RPC:', rpc);
            } catch (e) {
              console.error('Failed to create JsonRpcProvider', e);
              provider = null;
            }
          }

          setWeb3Data(prev => ({ ...prev, provider, signer, address }));
        } catch (e) {
          console.error('Error initializing provider/signers', e);
        }
      })();
      // run once on mount
    }, []);

    // create/validate contract instance whenever provider or signer changes
    useEffect(() => {
      const signerOrProvider = web3Data.signer || web3Data.provider;

      if (!signerOrProvider) {
        setWeb3Data(prev => ({ ...prev, contract: null }));
        return;
      }

      // validate contract address
      if (!contractAdress || (typeof ethers.isAddress === 'function' ? !ethers.isAddress(contractAdress) : !ethers.utils.isAddress(contractAdress))) {
        console.warn('Configured contract address is not a valid address:', contractAdress);
        setWeb3Data(prev => ({ ...prev, contract: null }));
        return;
      }

      (async () => {
        try {
          // pick a provider to run read-only checks
          const providerForChecks = web3Data.provider || (web3Data.signer && web3Data.signer.provider) || (signerOrProvider.provider ? signerOrProvider.provider : signerOrProvider);

          if (providerForChecks) {
            try {
              const code = await providerForChecks.getCode(contractAdress);
              if (!code || code === '0x') {
                console.warn('No contract bytecode found at configured address on current provider:', contractAdress);
                setWeb3Data(prev => ({ ...prev, contract: null }));
                return;
              }
            } catch (e) {
              console.warn('Failed to getCode for contract address (continuing to create contract instance):', e.message || e);
            }
          }

          const contractInstance = new ethers.Contract(contractAdress, contractABI, signerOrProvider);

          // Create read-only registry instance (attached to a provider) and signer-connected registry if signer available
          const readProvider = web3Data.provider || (web3Data.signer && web3Data.signer.provider) || (signerOrProvider.provider ? signerOrProvider.provider : signerOrProvider);
          const readRegistryInstance = (peerRegistryAddress && readProvider) ? new ethers.Contract(peerRegistryAddress, peerRegistryABI, readProvider) : null;
          let registryInstance = null;
          try {
            registryInstance = readRegistryInstance && web3Data.signer ? readRegistryInstance.connect(web3Data.signer) : readRegistryInstance;
          } catch (e) {
            console.warn('Failed to connect registry to signer (will use read-only):', e && e.message ? e.message : e);
            registryInstance = readRegistryInstance;
          }

          setWeb3Data((prev) => ({ ...prev, contract: contractInstance, registryContract: registryInstance, _readRegistry: readRegistryInstance, providerForReadonly: readProvider }));
          console.log('Contract instance created (provider/signer). address=', contractInstance.address, 'usingSigner=', !!web3Data.signer);
        } catch (e) {
          console.error('Failed to create contract instance', e);
          setWeb3Data(prev => ({ ...prev, contract: null }));
        }
      })();

    }, [web3Data.signer, web3Data.provider]);

    // Expose helpers on window for easier debugging in the browser console.
    // We set these whenever web3Data changes so console calls work interactively.
    useEffect(() => {
      try {
        if (typeof window !== 'undefined') {
          // expose ethers for console convenience
          window.ethers = ethers;
          // expose registry ABI/address for manual inspection
          window.__PEER_REGISTRY_ABI__ = peerRegistryABI;
          window.__PEER_REGISTRY_ADDRESS__ = peerRegistryAddress;

          // create a debug helper that uses the current provider/registry to perform an eth_call
          window.__debugCallGetPeerId = async (targetAddress) => {
            try {
              const provider = web3Data.provider || (web3Data.signer && web3Data.signer.provider) || (web3Data._readRegistry && web3Data._readRegistry.provider) || null;
              const readReg = web3Data._readRegistry || null;
              if (!provider && !readReg) {
                throw new Error('No provider or readRegistry available in web3 context');
              }

              const iface = new ethers.Interface(peerRegistryABI);
              const calldata = iface.encodeFunctionData('getPeerId', [targetAddress]);
              const prov = provider || (readReg && readReg.provider);
              if (!prov || typeof prov.send !== 'function') {
                throw new Error('Provider does not support send(eth_call)');
              }
              const raw = await prov.send('eth_call', [{ to: peerRegistryAddress, data: calldata }, 'latest']);
              // attempt decode
              try {
                const decoded = iface.decodeFunctionResult('getPeerId', raw);
                return { raw, decoded };
              } catch (decErr) {
                return { raw, decodeError: decErr && decErr.message ? decErr.message : String(decErr) };
              }
            } catch (e) {
              return { error: e && e.message ? e.message : e };
            }
          };
        }
      } catch (e) {
        // ignore
      }
    }, [web3Data, peerRegistryABI, peerRegistryAddress]);

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