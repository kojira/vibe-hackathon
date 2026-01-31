/**
 * 認証コンテキスト（Nostr対応版）
 * 
 * 認証フロー:
 * 1. Discord OAuthでログイン（Cloudflare Workers経由）
 * 2. パスワードを入力してNostr秘密鍵を生成
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  startDiscordAuth,
  extractTokenFromUrl,
  verifyToken,
  saveAuthState as saveAuth,
  loadAuthState,
  setupNostrKeys,
  logout as authLogout,
  hasTokenButNoKeys,
  getStoredUser,
  type UserInfo,
} from '../lib/auth';
import { validatePassword } from '../lib/crypto';

interface AuthState {
  passOk: boolean;      // パスワード設定済み（Nostr鍵生成済み）
  loggedIn: boolean;    // Discord認証済み
  isAdmin: boolean;     // 管理者フラグ
  user: UserInfo | null;
  privateKey: string | null;
  publicKey: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  checkAuth: () => Promise<void>;
  submitPassword: (password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  loginWithDiscord: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    passOk: false,
    loggedIn: false,
    isAdmin: false,
    user: null,
    privateKey: null,
    publicKey: null,
    loading: true,
  });

  // 初期化時にURLからトークンをチェック
  useEffect(() => {
    const initAuth = async () => {
      // URLフラグメントからトークンを取得（Discord OAuth コールバック後）
      const tokenFromUrl = extractTokenFromUrl();
      
      if (tokenFromUrl) {
        // 新しいトークンを検証
        const userInfo = await verifyToken(tokenFromUrl);
        if (userInfo) {
          saveAuth(tokenFromUrl, userInfo);
          setState(prev => ({
            ...prev,
            loggedIn: true,
            user: userInfo,
            loading: false,
          }));
          return;
        }
      }

      // ローカルストレージから認証状態を復元
      const savedAuth = loadAuthState();
      
      if (savedAuth.isAuthenticated) {
        setState({
          passOk: true,
          loggedIn: true,
          isAdmin: false, // TODO: 管理者判定
          user: savedAuth.user,
          privateKey: savedAuth.privateKey,
          publicKey: savedAuth.publicKey,
          loading: false,
        });
      } else if (hasTokenButNoKeys()) {
        // トークンはあるがパスワード未設定
        const user = getStoredUser();
        setState(prev => ({
          ...prev,
          loggedIn: true,
          user,
          loading: false,
        }));
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    initAuth();
  }, []);

  const checkAuth = useCallback(async () => {
    const savedAuth = loadAuthState();
    
    if (savedAuth.isAuthenticated) {
      setState({
        passOk: true,
        loggedIn: true,
        isAdmin: false,
        user: savedAuth.user,
        privateKey: savedAuth.privateKey,
        publicKey: savedAuth.publicKey,
        loading: false,
      });
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // パスワードを設定してNostr鍵を生成
  const submitPassword = useCallback(async (password: string): Promise<{ ok: boolean; error?: string }> => {
    const user = state.user;
    
    if (!user) {
      return { ok: false, error: 'まずDiscordでログインしてください' };
    }

    // パスワード検証
    const validation = validatePassword(password);
    if (!validation.valid) {
      return { ok: false, error: validation.message };
    }

    try {
      // Discord ID + パスワードからNostr鍵を生成
      const keys = setupNostrKeys(user.discordId, password);
      
      if (keys) {
        setState(prev => ({
          ...prev,
          passOk: true,
          privateKey: keys.privateKey,
          publicKey: keys.publicKey,
        }));
        return { ok: true };
      }
      
      return { ok: false, error: '鍵の生成に失敗しました' };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }, [state.user]);

  const logout = useCallback(() => {
    authLogout();
    setState({
      passOk: false,
      loggedIn: false,
      isAdmin: false,
      user: null,
      privateKey: null,
      publicKey: null,
      loading: false,
    });
  }, []);

  const loginWithDiscord = useCallback(() => {
    startDiscordAuth();
  }, []);

  // 互換性のためのエイリアス
  const submitPassphrase = submitPassword;

  return (
    <AuthContext.Provider value={{
      ...state,
      checkAuth,
      submitPassword,
      submitPassphrase, // 互換性のため
      logout,
      loginWithDiscord,
    } as AuthContextType}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
