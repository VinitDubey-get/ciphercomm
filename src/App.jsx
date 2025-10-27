import React,{useState} from 'react'
import Login from './components/Login'
import Chat from './components/Chat'
import './index.css';
import { useWeb3 } from  './context/Web3context'

const App = () => {
  const {address}=useWeb3();

  const handleLogin=()=>{
    setIsConnected(true);
  };

  return (
    <div className='app-container'>
      {/* {!isConnected ? (
        // Re-using thel ogin component 
        <div className="login-container">
          <h1>CipherComm</h1>
          <p>A decentralized, E2EE chat prototype</p>
          <button onClick={handleLogin}>Connect MetaMask </button>
        </div>
      ):(<Chat/>)} */}

      {/* if address is null show login as soona as address has a value show chat */}
      {!address ? (
        <Login/>
      ) :(<Chat/>)}

    </div>
  )
}

export default App