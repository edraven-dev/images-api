import { createHash } from 'crypto';

/**
 * Calculate SHA-256 checksum of a buffer.
 * Used for file deduplication and integrity verification.
 *
 * @param buffer - The buffer to calculate checksum for
 * @returns Hexadecimal string representation of SHA-256 hash
 */
export function calculateChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
