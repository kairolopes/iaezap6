/**
 * Password Hashing Utilities
 * Provides secure password hashing and verification using bcrypt
 */

import * as bcrypt from 'bcrypt';

/**
 * Bcrypt salt rounds for password hashing
 * Higher values = more secure but slower
 * 12 is a good balance between security and performance
 */
const SALT_ROUNDS = 12;

/**
 * Hashes a password using bcrypt
 *
 * @param password - The plain text password to hash
 * @returns A promise that resolves to the hashed password
 * @throws Error if password is empty or invalid
 *
 * @example
 * const hashedPassword = await hash('MyPassword123!');
 * // Store hashedPassword in database
 */
export async function hash(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  if (password.length > 72) {
    throw new Error('Password cannot exceed 72 characters (bcrypt limitation)');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    throw new Error(`Failed to hash password: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verifies a plain text password against a bcrypt hash
 *
 * @param password - The plain text password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns A promise that resolves to true if password matches, false otherwise
 * @throws Error if inputs are invalid
 *
 * @example
 * const isValid = await verify('MyPassword123!', hashedPassword);
 * if (isValid) {
 *   console.log('Password is correct');
 * }
 */
export async function verify(password: string, hash: string): Promise<boolean> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (!hash || typeof hash !== 'string') {
    throw new Error('Hash must be a non-empty string');
  }

  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    throw new Error(`Failed to verify password: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Regenerates a password hash (useful for migrating hashes to different salt rounds)
 *
 * @param oldHash - The existing bcrypt hash
 * @param plainPassword - The plain text password corresponding to the hash
 * @returns A promise that resolves to a new hash with updated salt rounds
 *
 * @example
 * const newHash = await rehash(oldHash, 'MyPassword123!');
 */
export async function rehash(oldHash: string, plainPassword: string): Promise<string> {
  // First verify the password matches the old hash
  const isValid = await verify(plainPassword, oldHash);

  if (!isValid) {
    throw new Error('Password does not match the provided hash');
  }

  // Create a new hash with current salt rounds
  return hash(plainPassword);
}
