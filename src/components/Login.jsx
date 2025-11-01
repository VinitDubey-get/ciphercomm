import React from 'react'
import {ethers} from 'ethers';
import { useWeb3 } from '../context/Web3context';
import logo from '../assets/logo.svg';

const Login = () => {

  const {setWeb3Data}=useWeb3();

  const connectWallet=async()=>{
    // check if user has MetaMask installed (window.ethereum)
    if(window.ethereum){
      try{
        const provider=new ethers.BrowserProvider(window.ethereum);

        const signer=await provider.getSigner();

        const address=await signer.getAddress();

  // merge the new values into existing web3Data so we don't drop other fields
  setWeb3Data((prev) => ({ ...prev, provider, signer, address }));

        console.log("Connected",{signer,address});
      }
      catch(err){
        console.error("Failed to connect wallet",err);
        alert("Failed to connect wallet. see console for details");
      }
      
    }
    else{
        alert("Please install Metamask")
      }
  };





  return (
    <div className='login-container'>
      <img src={logo} alt="CipherComm logo" className="logo" />
      <h1 className="title">CipherComm</h1>
      <p>A decentralized, E2EE chat App</p>
      {/* Connect wallet button */}
      <button onClick={connectWallet}>Connect MetaMask</button>
    </div>
  )
}

export default Login;