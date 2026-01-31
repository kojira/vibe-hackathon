/**
 * 暗号化ユーティリティ
 * Discord ID + パスワード から Nostr 秘密鍵を生成
 */

import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

const SALT = 'vibe-theme-generator-v1';
const ITERATIONS = 100000;

/**
 * Discord ID + パスワードから決定論的にNostr秘密鍵を生成
 * PBKDF2風の鍵導出（簡易版）
 */
export function generatePrivateKey(discordId: string, password: string): string {
  // 入力の正規化
  const input = `${discordId}:${password}:${SALT}`;
  
  // 反復ハッシュで計算コストを上げる（ブルートフォース対策）
  let hash: Uint8Array = sha256(input);
  for (let i = 0; i < ITERATIONS; i++) {
    hash = sha256(hash);
  }
  
  return bytesToHex(hash);
}

/**
 * パスワードの強度チェック
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'パスワードは8文字以上必要です' };
  }
  
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: 'パスワードには英字と数字を含めてください' };
  }
  
  return { valid: true };
}
