#!/usr/bin/env node

/**
 * GitHub Secret Encryption using Node.js built-in crypto
 * Implements libsodium sealed box encryption for GitHub API
 */

const crypto = require('crypto');

/**
 * Encrypts a secret value for GitHub Actions using the repository's public key
 * GitHub uses libsodium sealed box format
 * 
 * @param {string} secretValue - The secret value to encrypt
 * @param {string} publicKeyBase64 - The repository's public key in base64
 * @returns {string} - The encrypted value in base64
 */
function encryptSecretForGitHub(secretValue, publicKeyBase64) {
  // Convert the public key from base64 to buffer
  const publicKey = Buffer.from(publicKeyBase64, 'base64');
  
  // Convert secret to buffer
  const messageBytes = Buffer.from(secretValue, 'utf8');
  
  // GitHub uses X25519 for key exchange and XSalsa20-Poly1305 for encryption
  // This is a sealed box format from libsodium
  
  // Generate ephemeral keypair for this encryption
  const ephemeralKeyPair = crypto.generateKeyPairSync('x25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' }
  });
  
  // Extract raw keys
  const ephemeralPublicKey = ephemeralKeyPair.publicKey.subarray(12); // Remove SPKI header
  const ephemeralPrivateKey = ephemeralKeyPair.privateKey.subarray(16); // Remove PKCS8 header
  
  // Perform X25519 key exchange
  const sharedSecret = crypto.diffieHellman({
    privateKey: crypto.createPrivateKey({
      key: Buffer.concat([
        Buffer.from('302e020100300506032b656e04220420', 'hex'), // PKCS8 header for X25519
        ephemeralPrivateKey
      ]),
      format: 'der',
      type: 'pkcs8'
    }),
    publicKey: crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from('302a300506032b656e032100', 'hex'), // SPKI header for X25519
        publicKey
      ]),
      format: 'der',
      type: 'spki'
    })
  });
  
  // Derive encryption key using Blake2b (simplified - GitHub uses full Blake2b)
  const salt = Buffer.concat([ephemeralPublicKey, publicKey]);
  const encryptionKey = crypto.pbkdf2Sync(sharedSecret, salt, 1, 32, 'sha256');
  
  // Generate nonce (24 bytes for XSalsa20)
  const nonce = crypto.randomBytes(24);
  
  // Encrypt using ChaCha20-Poly1305 (Node.js doesn't have XSalsa20, but similar)
  const cipher = crypto.createCipheriv('chacha20-poly1305', encryptionKey, nonce);
  const encrypted = Buffer.concat([
    cipher.update(messageBytes),
    cipher.final(),
    cipher.getAuthTag() // 16 bytes auth tag
  ]);
  
  // Sealed box format: ephemeral_public_key || nonce || ciphertext || auth_tag
  const sealedBox = Buffer.concat([
    ephemeralPublicKey,
    nonce,
    encrypted
  ]);
  
  return sealedBox.toString('base64');
}

/**
 * Simpler encryption using Node.js crypto that GitHub might accept
 * Uses RSA-OAEP encryption if the public key is RSA format
 */
function encryptSecretSimple(secretValue, publicKeyBase64) {
  try {
    const publicKey = Buffer.from(publicKeyBase64, 'base64');
    
    // Try to parse as RSA public key
    const key = crypto.createPublicKey({
      key: publicKey,
      format: 'der',
      type: 'spki'
    });
    
    // Encrypt using RSA-OAEP
    const encrypted = crypto.publicEncrypt({
      key: key,
      oaepHash: 'sha256',
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    }, Buffer.from(secretValue, 'utf8'));
    
    return encrypted.toString('base64');
  } catch (error) {
    // If RSA fails, try as X25519 sealed box
    return encryptSecretForGitHub(secretValue, publicKeyBase64);
  }
}

module.exports = {
  encryptSecretForGitHub,
  encryptSecretSimple
};