import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/ui.css'
import App from './App.jsx'

import { Web3Provider } from './context/Web3context.jsx'
import { Buffer } from 'buffer';
window.Buffer = Buffer;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Web3Provider>
      <App />
    </Web3Provider>
    
  </StrictMode>,
)
