/**
 * 認証ユーティリティ
 * Discord OAuth + Nostr 秘密鍵生成
 */

import { generatePrivateKey, validatePassword } from './crypto';
import { derivePublicKey } from './nostr';

// Workers URL（環境変数から取得）
const WORKERS_URL = import.meta.env.VITE_WORKERS_URL || 'http://localhost:8787';

// ローカルストレージキー
const STORAGE_KEYS = {
  JWT_TOKEN: 'vibe_jwt_token',
  PRIVATE_KEY: 'vibe_private_key',
  PUBLIC_KEY: 'vibe_public_key',
  USER_INFO: 'vibe_user_info',
} as const;

export interface UserInfo {
  discordId: string;
  username: string;
  avatar: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  publicKey: string | null;
  privateKey: string | null;
}

/**
 * Discord OAuth を開始
 */
export function startDiscordAuth(): void {
  window.location.href = `${WORKERS_URL}/auth/discord`;
}

/**
 * URL フラグメントから JWT トークンを取得
 */
export function extractTokenFromUrl(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/token=([^&]+)/);
  
  if (match) {
    // URLからトークンを削除
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return match[1];
  }
  
  return null;
}

/**
 * JWT トークンを検証
 */
export async function verifyToken(token: string): Promise<UserInfo | null> {
  try {
    const response = await fetch(`${WORKERS_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data.valid && data.user) {
      return data.user as UserInfo;
    }
    
    return null;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * パスワードから秘密鍵を生成・保存
 */
export function setupNostrKeys(discordId: string, password: string): { publicKey: string; privateKey: string } | null {
  const validation = validatePassword(password);
  if (!validation.valid) {
    throw new Error(validation.message);
  }
  
  const privateKey = generatePrivateKey(discordId, password);
  const publicKey = derivePublicKey(privateKey);
  
  // ローカルストレージに保存
  localStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, privateKey);
  localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, publicKey);
  
  return { publicKey, privateKey };
}

/**
 * ログイン状態を保存
 */
export function saveAuthState(token: string, user: UserInfo): void {
  localStorage.setItem(STORAGE_KEYS.JWT_TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
}

/**
 * 保存された認証状態を取得
 */
export function loadAuthState(): AuthState {
  const token = localStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
  const userJson = localStorage.getItem(STORAGE_KEYS.USER_INFO);
  const privateKey = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
  const publicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
  
  let user: UserInfo | null = null;
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch {
      user = null;
    }
  }
  
  const isAuthenticated = !!(token && user && privateKey && publicKey);
  
  return {
    isAuthenticated,
    user,
    publicKey,
    privateKey,
  };
}

/**
 * ログアウト
 */
export function logout(): void {
  localStorage.removeItem(STORAGE_KEYS.JWT_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_INFO);
  localStorage.removeItem(STORAGE_KEYS.PRIVATE_KEY);
  localStorage.removeItem(STORAGE_KEYS.PUBLIC_KEY);
}

/**
 * JWTトークンのみ保存されているか確認（パスワード未設定）
 */
export function hasTokenButNoKeys(): boolean {
  const token = localStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
  const privateKey = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
  return !!(token && !privateKey);
}

/**
 * 保存されたJWTトークンを取得
 */
export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
}

/**
 * 保存されたユーザー情報を取得
 */
export function getStoredUser(): UserInfo | null {
  const userJson = localStorage.getItem(STORAGE_KEYS.USER_INFO);
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}
