import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3context';
import { computeChatHash } from '../utils/chatHash.js';
import { ethers } from 'ethers';
import { contractAdress, contractABI } from '../config';
import ethCrypto from 'eth-crypto';

function PeerConnector() {
  // 2. Get the peer and peerId from our global bubble
  const { peer, peerId, chatKeys, contract, setWeb3Data, messages, address, conn, chatFinalized } = useWeb3();
  const [friendId, setFriendId] = useState(''); // Local state for the input field
  const [finalizeState, setFinalizeState] = useState({ status: 'idle', info: null });


  const setupConnection = (conn) => {
    console.log(`connection established with ${conn.peer}`);

    setWeb3Data((prev) => ({ ...prev, conn }));

    conn.on('open', () => {
      console.log('Sending public key...');

      conn.send({
        type: 'key-exchange',
        payload: chatKeys.publicKey,
      });
    });

    // receiver handling incoming data
    conn.on('data', async (data) => {
      try {
        // handle finalize recorded notification from peer
        if (data.type === 'finalize-recorded') {
          console.log('Received finalize-recorded', data.chatHash, data.txHash);

          // compute verification using the latest messages from state (avoid stale closure)
          setWeb3Data((prev) => {
            try {
              const localHash = computeChatHash(prev.messages || []);
              const senderVerified = localHash === data.chatHash;
              console.log('Computed localHash inside updater', localHash, 'posted', data.chatHash, 'localMatchesSender?', senderVerified);

              // Async on-chain cross-check: use an IIFE because updater cannot be async
              (async () => {
                let blockchainVerified = false;
                try {
                  // Choose an address and provider to use for the on-chain check.
                  const cfgAddress = contractAdress; // from src/config.js (user-updated)
                  const provider = prev.provider || (prev.contract && (prev.contract.provider || (prev.contract.signer && prev.contract.signer.provider)));

                  if (!data.chatHash) {
                    console.warn('No chatHash provided by sender; skipping on-chain check');
                  } else if (!provider) {
                    console.warn('No provider available for on-chain check; skipping');
                  } else if (!cfgAddress) {
                    console.warn('No contract address configured; skipping on-chain check');
                  } else if (!(typeof ethers.isAddress === 'function' ? ethers.isAddress(cfgAddress) : ethers.utils.isAddress(cfgAddress))) {
                    console.warn('Configured contract address is not valid; skipping on-chain check', cfgAddress);
                  } else {
                    console.log('Cross-checking hash with blockchain using address from config:', cfgAddress);
                    const code = await provider.getCode(cfgAddress);
                    if (!code || code === '0x') {
                      console.warn(`No contract bytecode found at ${cfgAddress} on current provider; skipping on-chain verify`);
                    } else {
                      // create a read-only contract if needed
                      const readContract = (prev.contract && prev.contract.address) ? prev.contract : new ethers.Contract(cfgAddress, contractABI, provider);
                      try {
                        blockchainVerified = !!(await readContract.verifyHash(data.chatHash));
                        console.log('Blockchain verification result:', blockchainVerified);
                      } catch (innerErr) {
                        console.error('Error calling verifyHash on contract instance:', innerErr);
                      }
                    }
                  }
                } catch (e) {
                  console.error('Error reading hash from blockchain:', e);
                }

                const finalVerified = senderVerified && !!blockchainVerified;

                setWeb3Data((currentPrev) => ({
                  ...currentPrev,
                  chatFinalized: {
                    hash: data.chatHash,
                    txHash: data.txHash,
                    verifiedLocally: senderVerified,
                    verifiedOnChain: !!blockchainVerified,
                    verified: finalVerified,
                    confirmedBy: currentPrev.confirmedBy ? [...currentPrev.confirmedBy] : [currentPrev.address],
                  },
                }));
              })();

              // return previous state immediately; async IIFE will update later
              return prev;
            } catch (e) {
              console.error('Error computing local chat hash during finalize-recorded handling', e);
              return { ...prev, chatFinalized: { hash: data.chatHash, txHash: data.txHash, verified: false, confirmedBy: [prev.address] } };
            }
          });
          return;
        }

        if (data.type === 'key-exchange') {
          // handshake receive friend's key
          console.log("Received friend's public key", data.payload);

          // save it to our global state
          setWeb3Data((prev) => ({ ...prev, friendPublicKey: data.payload }));
        } else if (data.type === 'message') {
          console.log('Received encrypted message', data);

          // decrypt
          const decrypted = await ethCrypto.decryptWithPrivateKey(chatKeys.privateKey, data.payload);

          // message metadata should come from the sender so both peers use identical id/ts/sender
          const now = Date.now();
          const mid = data.id || now;
          const mts = data.ts || now;
          const msender = String(data.sender || '');

          // add the decrypted message to chat log (store encrypted payload)
          const newMessage = {
            id: mid,
            ts: mts,
            sender: msender,
            text: decrypted, // optional for UI
            payload: data.payload, // store encrypted object for finalize hashing
            verified: false,
          };
          setWeb3Data((prev) => ({
            ...prev,
            messages: [...prev.messages, newMessage],
          }));
        }
      } catch (e) {
        console.error('Decryption or verification error', e);
      }
    });

    // hadling the connection closing
    conn.on('close', () => {
      console.log('Connection Closed');
      setWeb3Data((prev) => ({ ...prev, conn: null, friendPublicKey: null }));
    });
    // handle connection errors
    conn.on('error', (err) => {
      console.error('Connection Error', err);
    });
  };

  // for outgoing connections
  const connectToPeer = () => {
    if (!peer) return alert('Peer is not initialized!');
    if (!friendId) return alert('Please enter a Friend Id');

    console.log(`Connecting to peer:${friendId}`);

    const newConn = peer.connect(friendId);
    setupConnection(newConn);
  };

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
      setWeb3Data((prev) => ({ ...prev, chatFinalized: { hash: chatHash, txHash: tx.hash, confirmedBy: [prev.address] } }));
      setFinalizeState({ status: 'recorded', info: { hash: chatHash, txHash: tx.hash } });
    } catch (e) {
      console.error('Finalize: recordHash failed', e);
      setFinalizeState({ status: 'error', info: e.message });
      alert('Failed to record chat hash on-chain: ' + e.message);
    }
  };

  // this 'useEffecti' is for incoming connections
  useEffect(() => {
    if (peer && chatKeys) {
      // listen for new connections
      const connectionHandler = (incomingConn) => {
        console.log('Incoming Connection!', incomingConn);
        setupConnection(incomingConn);
      };
      peer.on('connection', connectionHandler);

      // cleanup function: remove old listeners when the component unomounts
      return () => {
        if (peer) {
          peer.off('connection', connectionHandler);
        }
      };
    }
  }, [peer, chatKeys, setWeb3Data, contract]);


  return (
    <div className="peer-connector">
      <div className="your-id">
        {/* 6. Display the REAL Peer ID, or a loading message */}
        Your Peer ID: <strong>{peerId || 'Initializing...'}</strong>
        {/* show finalize status if available */}
        {chatFinalized && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <div>
              Finalized Hash: <code style={{ color: '#0f0' }}>{chatFinalized.hash}</code>
            </div>
            <div>
              Tx: <a href={`https://sepolia.etherscan.io/tx/${chatFinalized.txHash}`} target="_blank" rel="noreferrer" style={{ color: '#0f0' }}>{chatFinalized.txHash}</a>
            </div>
            <div>
              Verified (Local):{' '}
              {typeof chatFinalized.verifiedLocally === 'undefined'
                ? chatFinalized.verified === true
                  ? 'Yes'
                  : chatFinalized.verified === false
                  ? 'No'
                  : 'Checking...'
                : chatFinalized.verifiedLocally
                ? 'Yes'
                : 'No'}
            </div>
            <div>
              Verified (On-Chain):{' '}
              {typeof chatFinalized.verifiedOnChain === 'undefined' ? 'Checking...' : chatFinalized.verifiedOnChain ? 'Yes' : 'No'}
            </div>
            <div>Final Verified: {chatFinalized.verified ? 'Yes' : 'No'}</div>
          </div>
        )}
      </div>
      <div className="friend-id">
        <input
          type="text"
          placeholder="Enter Friend's Peer ID"
          value={friendId}
          onChange={(e) => setFriendId(e.target.value)}
        />
        <button onClick={connectToPeer}>Connect</button>
        <button onClick={proposeFinalize} style={{ marginLeft: '8px' }}>
          Finalize Chat
        </button>
      </div>
      {/* Render chat finalized info */}
      {/** show chatFinalized from global context if present **/}
      {(() => {
        const cf = typeof window !== 'undefined' && window.__WEB3_DATA__ ? window.__WEB3_DATA__.chatFinalized : null;
        // fallback: read from messages via context is already handled; instead just render from context
        return null;
      })()}
    </div>
  );
}

export default PeerConnector;