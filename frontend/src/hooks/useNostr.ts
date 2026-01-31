/**
 * useNostr フック
 * useSocket の Nostr 版置き換え
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getNostrClient,
  subscribeEvents,
  subscribePresentations,
  subscribeRatings,
  subscribeRealtime,
  createEvent as createNostrEvent,
  createPresentation as createNostrPresentation,
  submitRating as submitNostrRating,
  closeConnection,
  type VibeEvent,
  type RatingAxis,
} from '../lib/nostr';
import { loadAuthState, type UserInfo } from '../lib/auth';

// 既存のインターフェースとの互換性のため
export interface Presentation {
  id: string;
  discordId: string;
  username: string;
  avatar: string | null;
  title: string;
  description: string | null;
  createdAt: string;
}

export interface Rating {
  id: string;
  liveId: string | null;
  presentationId: string | null;
  judgeId: string;
  judgeName: string;
  scores: Record<string, number>;
  comment?: string | null;
  submittedAt: string;
}

interface AuthState {
  passOk: boolean;
  loggedIn: boolean;
  isAdmin: boolean;
  user: {
    discordId: string;
    username: string;
  } | null;
}

export function useNostr() {
  const [connected, setConnected] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<VibeEvent | null>(null);
  const [events, setEvents] = useState<VibeEvent[]>([]);
  const [ratingAxes, setRatingAxes] = useState<RatingAxis[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [submitted] = useState(false); // 互換性のため（Nostrモードでは未使用）
  const [presentationSubmitted, setPresentationSubmitted] = useState<Record<string, boolean>>({});
  const [ratings, setRatings] = useState<Map<string, Rating[]>>(new Map());
  
  const privateKeyRef = useRef<string | null>(null);
  const publicKeyRef = useRef<string | null>(null);
  const userRef = useRef<UserInfo | null>(null);
  
  // 認証状態の読み込み
  useEffect(() => {
    const auth = loadAuthState();
    
    if (auth.isAuthenticated && auth.user && auth.privateKey && auth.publicKey) {
      privateKeyRef.current = auth.privateKey;
      publicKeyRef.current = auth.publicKey;
      userRef.current = auth.user;
      
      setAuthState({
        passOk: true,
        loggedIn: true,
        isAdmin: false, // Nostrでは別途管理が必要
        user: {
          discordId: auth.user.discordId,
          username: auth.user.username,
        },
      });
    }
  }, []);

  // Nostr 接続
  useEffect(() => {
    try {
      getNostrClient();
      setConnected(true);
    } catch (error) {
      console.error('Failed to connect to Nostr:', error);
      setConnected(false);
    }

    return () => {
      closeConnection();
    };
  }, []);

  // イベント購読
  useEffect(() => {
    if (!connected) return;

    const unsubscribe = subscribeEvents((vibeEvents) => {
      setEvents(vibeEvents);
      
      // 最新のイベントをカレントとして設定
      if (vibeEvents.length > 0) {
        const sorted = [...vibeEvents].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setCurrentEvent(sorted[0]);
        
        // 最新イベントの評価軸を設定
        if (sorted[0].ratingAxes) {
          setRatingAxes(sorted[0].ratingAxes);
        }
      }
    });

    return unsubscribe;
  }, [connected]);

  // 現在のイベントのプレゼンテーション購読
  useEffect(() => {
    if (!connected || !currentEvent) return;

    const unsubscribe = subscribePresentations(currentEvent.id, (nostrPresentations) => {
      // Nostr形式を既存形式に変換
      const converted: Presentation[] = nostrPresentations.map((p) => ({
        id: p.id,
        discordId: p.presenterPubkey, // 実際はpubkeyだが互換性のため
        username: p.presenterName,
        avatar: p.presenterAvatar,
        title: p.title,
        description: p.description,
        createdAt: p.createdAt,
      }));
      setPresentations(converted);
    });

    return unsubscribe;
  }, [connected, currentEvent?.id]);

  // リアルタイム更新購読
  useEffect(() => {
    if (!connected) return;

    const unsubscribe = subscribeRealtime((event) => {
      // イベント種別によって状態を更新
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      
      if (dTag?.startsWith('vibe:presentation:')) {
        // プレゼンテーション更新時はリロード
        if (currentEvent) {
          subscribePresentations(currentEvent.id, (nostrPresentations) => {
            const converted: Presentation[] = nostrPresentations.map((p) => ({
              id: p.id,
              discordId: p.presenterPubkey,
              username: p.presenterName,
              avatar: p.presenterAvatar,
              title: p.title,
              description: p.description,
              createdAt: p.createdAt,
            }));
            setPresentations(converted);
          });
        }
      }
    });

    return unsubscribe;
  }, [connected, currentEvent?.id]);

  // イベント作成
  const createVibeEvent = useCallback(async (
    title: string,
    description: string,
    passphrase: string,
    axes: RatingAxis[]
  ): Promise<{ ok: boolean; eventId?: string; reason?: string }> => {
    if (!privateKeyRef.current) {
      return { ok: false, reason: '認証が必要です' };
    }

    try {
      const eventId = await createNostrEvent(privateKeyRef.current, {
        title,
        description,
        passphrase,
        ratingAxes: axes,
        resultsPublished: false,
      });
      return { ok: true, eventId };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  }, []);

  // プレゼンテーション登録
  const registerPresentation = useCallback(async (
    title: string,
    description?: string
  ): Promise<{ ok: boolean; reason?: string }> => {
    if (!privateKeyRef.current || !userRef.current || !currentEvent) {
      return { ok: false, reason: '認証またはイベント選択が必要です' };
    }

    try {
      await createNostrPresentation(privateKeyRef.current, {
        eventId: currentEvent.id,
        title,
        description: description || '',
        presenterName: userRef.current.username,
        presenterAvatar: userRef.current.avatar,
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  }, [currentEvent?.id]);

  // 審査投稿
  const submitPresentationRating = useCallback(async (
    presentationId: string,
    scores: Record<string, number>,
    comment?: string
  ): Promise<{ ok: boolean; reason?: string }> => {
    if (!privateKeyRef.current || !userRef.current) {
      return { ok: false, reason: '認証が必要です' };
    }

    try {
      await submitNostrRating(privateKeyRef.current, {
        presentationId,
        scores,
        comment: comment || '',
        judgeName: userRef.current.username,
      });
      
      setPresentationSubmitted(prev => ({ ...prev, [presentationId]: true }));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  }, []);

  // プレゼンテーションの審査一覧取得
  const getPresentationRatings = useCallback(async (
    presentationId: string
  ): Promise<Rating[]> => {
    return new Promise((resolve) => {
      const unsubscribe = subscribeRatings(presentationId, (nostrRatings) => {
        const converted: Rating[] = nostrRatings.map((r) => ({
          id: r.id,
          liveId: null,
          presentationId: r.presentationId,
          judgeId: r.judgePubkey,
          judgeName: r.judgeName,
          scores: r.scores,
          comment: r.comment,
          submittedAt: r.submittedAt,
        }));
        
        setRatings(prev => new Map(prev).set(presentationId, converted));
        resolve(converted);
        
        // 購読解除
        setTimeout(() => unsubscribe(), 100);
      });

      // タイムアウト
      setTimeout(() => {
        unsubscribe();
        resolve(ratings.get(presentationId) || []);
      }, 5000);
    });
  }, [ratings]);

  // 審査済みチェック
  const checkPresentationSubmitted = useCallback(async (presentationId: string) => {
    if (!publicKeyRef.current) return;

    const presentationRatings = await getPresentationRatings(presentationId);
    const hasRated = presentationRatings.some(
      r => r.judgeId === publicKeyRef.current
    );
    
    setPresentationSubmitted(prev => ({ ...prev, [presentationId]: hasRated }));
  }, [getPresentationRatings]);

  // イベント一覧取得
  const getEvents = useCallback(() => {
    // 既に購読しているので状態を返す
    return events;
  }, [events]);

  // イベント選択
  const selectEvent = useCallback((eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setCurrentEvent(event);
      if (event.ratingAxes) {
        setRatingAxes(event.ratingAxes);
      }
    }
  }, [events]);

  // プレゼンテーション一覧取得
  const getPresentations = useCallback(() => {
    // 既に購読しているので状態を返す
    return presentations;
  }, [presentations]);

  // 互換性のためのダミー関数
  const setLive = useCallback(() => {
    console.warn('setLive is deprecated in Nostr mode');
  }, []);

  const endLive = useCallback(() => {
    console.warn('endLive is deprecated in Nostr mode');
  }, []);

  const submitRating = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    console.warn('submitRating is deprecated in Nostr mode, use submitPresentationRating');
    return { ok: false, reason: 'Deprecated' };
  }, []);

  const getLiveHistory = useCallback(() => {
    console.warn('getLiveHistory is deprecated in Nostr mode');
  }, []);

  const getRatings = useCallback(async (): Promise<Rating[]> => {
    console.warn('getRatings is deprecated in Nostr mode, use getPresentationRatings');
    return [];
  }, []);

  const publishResults = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    // TODO: Nostr上で結果公開フラグを更新
    console.warn('publishResults not yet implemented for Nostr');
    return { ok: false, reason: 'Not implemented' };
  }, []);

  const deleteLive = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    console.warn('deleteLive is deprecated in Nostr mode');
    return { ok: false, reason: 'Deprecated' };
  }, []);

  const deletePresentation = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    // Nostrではイベントの削除は基本的にできない
    console.warn('deletePresentation is not supported in Nostr');
    return { ok: false, reason: 'Not supported in Nostr' };
  }, []);

  return {
    connected,
    currentLive: null, // 互換性のため
    currentEvent,
    events,
    ratingAxes,
    liveHistory: [], // 互換性のため
    presentations,
    authState,
    submitted,
    presentationSubmitted,
    // 新しいAPI
    createVibeEvent,
    selectEvent,
    getEvents,
    // 互換性のあるAPI
    setLive,
    endLive,
    submitRating,
    getLiveHistory,
    getRatings,
    publishResults,
    deleteLive,
    getPresentations,
    registerPresentation,
    deletePresentation,
    submitPresentationRating,
    checkPresentationSubmitted,
    getPresentationRatings,
  };
}
