#!/usr/bin/env node

/**
 * JWT RSA Key Pair Generator
 *
 * Generates RSA 2048-bit key pair for JWT RS256 signing
 * Output keys can be added to .env.local
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateKeyPair() {
  console.log('Generating RSA 2048-bit key pair for JWT RS256...\n');

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Convert newlines to escaped newlines for environment variables
  const privateKeyEscaped = privateKey.replace(/\n/g, '\\n');
  const publicKeyEscaped = publicKey.replace(/\n/g, '\\n');

  console.log('=== ADD THESE TO .env.local ===\n');
  console.log(`JWT_PRIVATE_KEY="${privateKeyEscaped}"\n`);
  console.log(`JWT_PUBLIC_KEY="${publicKeyEscaped}"\n`);
  console.log('================================\n');

  // Optional: Save to files for reference
  const keysDir = path.join(__dirname, '..', '.keys');
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  fs.writeFileSync(path.join(keysDir, 'private.pem'), privateKey);
  fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey);
  console.log('Keys also saved to .keys/ directory for reference');
  console.log('⚠️  IMPORTANT: Add these keys to .env.local, not to version control!\n');
}

generateKeyPair();
