/**
 * Nostr クライアント (rx-nostr ラッパー)
 * 
 * 指定されたリレーのみを使用:
 * - wss://r.kojira.io
 * - wss://x.kojira.io
 * - wss://yabu.me
 */

import { createRxNostr, createRxForwardReq, createRxBackwardReq, type RxNostr, type EventPacket } from 'rx-nostr';
import { verifier } from 'rx-nostr-crypto';
import { getPublicKey, finalizeEvent, type NostrEvent } from 'nostr-tools/pure';
import type { EventTemplate } from 'nostr-tools/pure';
import { hexToBytes } from '@noble/hashes/utils';

// 固定リレー（変更不可）
const RELAYS = [
  'wss://r.kojira.io',
  'wss://x.kojira.io',
  'wss://yabu.me',
] as const;

// アプリ識別タグ
const APP_TAG = 'vibe-theme-generator';

// Kind 30078: カスタムアプリデータ（NIP-78）
const KIND_APP_DATA = 30078;

let rxNostr: RxNostr | null = null;

/**
 * rx-nostr インスタンスを取得（シングルトン）
 */
export function getNostrClient(): RxNostr {
  if (!rxNostr) {
    rxNostr = createRxNostr({ verifier });
    rxNostr.setDefaultRelays(RELAYS.map(url => ({ url, read: true, write: true })));
  }
  return rxNostr;
}

/**
 * 秘密鍵から公開鍵を導出
 */
export function derivePublicKey(privateKey: string): string {
  const privKeyBytes = hexToBytes(privateKey);
  return getPublicKey(privKeyBytes);
}

/**
 * イベントに署名して送信
 */
export async function publishEvent(
  privateKey: string,
  template: EventTemplate
): Promise<void> {
  const client = getNostrClient();
  const privKeyBytes = hexToBytes(privateKey);
  const event = finalizeEvent(template, privKeyBytes);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Publish timeout'));
    }, 10000);

    client.send(event).subscribe({
      next: (packet) => {
        if (packet.ok) {
          clearTimeout(timeout);
          resolve();
        }
      },
      error: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    });
  });
}

/**
 * イベント作成ヘルパー
 */
function createAppEvent(
  dTag: string,
  content: object,
  extraTags: string[][] = []
): EventTemplate {
  return {
    kind: KIND_APP_DATA,
    tags: [
      ['d', dTag],
      ['app', APP_TAG],
      ...extraTags,
    ],
    content: JSON.stringify(content),
    created_at: Math.floor(Date.now() / 1000),
  };
}

// ============================================
// イベント（審査会）関連
// ============================================

export interface VibeEvent {
  id: string;
  title: string;
  description: string;
  passphrase: string;
  ratingAxes: RatingAxis[];
  resultsPublished: boolean;
  createdAt: string;
  creatorPubkey: string;
}

export interface RatingAxis {
  id: string;
  name: string;
  maxScore: number;
}

/**
 * イベント（審査会）を作成
 */
export async function createEvent(
  privateKey: string,
  event: Omit<VibeEvent, 'id' | 'createdAt' | 'creatorPubkey'>
): Promise<string> {
  const eventId = crypto.randomUUID();
  const dTag = `vibe:event:${eventId}`;
  
  const template = createAppEvent(dTag, {
    ...event,
    createdAt: new Date().toISOString(),
  });
  
  await publishEvent(privateKey, template);
  return eventId;
}

/**
 * イベントを取得
 */
export function subscribeEvents(
  callback: (events: VibeEvent[]) => void
): () => void {
  const client = getNostrClient();
  const events = new Map<string, VibeEvent>();
  
  const req = createRxBackwardReq();
  
  const subscription = client.use(req).subscribe({
    next: (packet: EventPacket) => {
      const event = packet.event;
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      const appTag = event.tags.find(t => t[0] === 'app')?.[1];
      
      if (appTag !== APP_TAG || !dTag?.startsWith('vibe:event:')) return;
      
      try {
        const content = JSON.parse(event.content);
        const eventId = dTag.replace('vibe:event:', '');
        
        events.set(eventId, {
          id: eventId,
          ...content,
          creatorPubkey: event.pubkey,
        });
        
        callback(Array.from(events.values()));
      } catch (e) {
        console.error('Failed to parse event:', e);
      }
    },
  });
  
  req.emit([{
    kinds: [KIND_APP_DATA],
    '#app': [APP_TAG],
    '#d': ['vibe:event:'],
  }]);
  
  return () => subscription.unsubscribe();
}

// ============================================
// プレゼンテーション関連
// ============================================

export interface Presentation {
  id: string;
  eventId: string;
  title: string;
  description: string;
  presenterPubkey: string;
  presenterName: string;
  presenterAvatar: string | null;
  createdAt: string;
}

/**
 * プレゼンテーションを登録
 */
export async function createPresentation(
  privateKey: string,
  presentation: Omit<Presentation, 'id' | 'createdAt' | 'presenterPubkey'>
): Promise<string> {
  const presentationId = crypto.randomUUID();
  const dTag = `vibe:presentation:${presentationId}`;
  
  const template = createAppEvent(
    dTag,
    {
      ...presentation,
      createdAt: new Date().toISOString(),
    },
    [['e', presentation.eventId]]
  );
  
  await publishEvent(privateKey, template);
  return presentationId;
}

/**
 * 特定イベントのプレゼンテーションを購読
 */
export function subscribePresentations(
  eventId: string,
  callback: (presentations: Presentation[]) => void
): () => void {
  const client = getNostrClient();
  const presentations = new Map<string, Presentation>();
  
  const req = createRxBackwardReq();
  
  const subscription = client.use(req).subscribe({
    next: (packet: EventPacket) => {
      const event = packet.event;
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      const appTag = event.tags.find(t => t[0] === 'app')?.[1];
      const eTag = event.tags.find(t => t[0] === 'e')?.[1];
      
      if (appTag !== APP_TAG || !dTag?.startsWith('vibe:presentation:')) return;
      if (eTag !== eventId) return;
      
      try {
        const content = JSON.parse(event.content);
        const presentationId = dTag.replace('vibe:presentation:', '');
        
        presentations.set(presentationId, {
          id: presentationId,
          eventId,
          ...content,
          presenterPubkey: event.pubkey,
        });
        
        callback(Array.from(presentations.values()));
      } catch (e) {
        console.error('Failed to parse presentation:', e);
      }
    },
  });
  
  req.emit([{
    kinds: [KIND_APP_DATA],
    '#app': [APP_TAG],
    '#e': [eventId],
  }]);
  
  return () => subscription.unsubscribe();
}

// ============================================
// 審査（レーティング）関連
// ============================================

export interface Rating {
  id: string;
  presentationId: string;
  judgePubkey: string;
  judgeName: string;
  scores: Record<string, number>;
  comment: string;
  submittedAt: string;
}

/**
 * 審査を投稿
 */
export async function submitRating(
  privateKey: string,
  rating: Omit<Rating, 'id' | 'judgePubkey' | 'submittedAt'>
): Promise<string> {
  const pubkey = derivePublicKey(privateKey);
  const ratingId = `${rating.presentationId}:${pubkey}`;
  const dTag = `vibe:rating:${ratingId}`;
  
  const template = createAppEvent(
    dTag,
    {
      ...rating,
      submittedAt: new Date().toISOString(),
    },
    [['e', rating.presentationId]]
  );
  
  await publishEvent(privateKey, template);
  return ratingId;
}

/**
 * 特定プレゼンテーションの審査を購読
 */
export function subscribeRatings(
  presentationId: string,
  callback: (ratings: Rating[]) => void
): () => void {
  const client = getNostrClient();
  const ratings = new Map<string, Rating>();
  
  const req = createRxBackwardReq();
  
  const subscription = client.use(req).subscribe({
    next: (packet: EventPacket) => {
      const event = packet.event;
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      const appTag = event.tags.find(t => t[0] === 'app')?.[1];
      const eTag = event.tags.find(t => t[0] === 'e')?.[1];
      
      if (appTag !== APP_TAG || !dTag?.startsWith('vibe:rating:')) return;
      if (eTag !== presentationId) return;
      
      try {
        const content = JSON.parse(event.content);
        const ratingId = dTag.replace('vibe:rating:', '');
        
        ratings.set(ratingId, {
          id: ratingId,
          presentationId,
          ...content,
          judgePubkey: event.pubkey,
        });
        
        callback(Array.from(ratings.values()));
      } catch (e) {
        console.error('Failed to parse rating:', e);
      }
    },
  });
  
  req.emit([{
    kinds: [KIND_APP_DATA],
    '#app': [APP_TAG],
    '#e': [presentationId],
  }]);
  
  return () => subscription.unsubscribe();
}

/**
 * ユーザーが特定プレゼンテーションを審査済みか確認
 */
export function hasUserRated(
  presentationId: string,
  userPubkey: string,
  ratings: Rating[]
): boolean {
  return ratings.some(
    r => r.presentationId === presentationId && r.judgePubkey === userPubkey
  );
}

// ============================================
// リアルタイム購読
// ============================================

/**
 * 新しいイベントをリアルタイムで購読
 */
export function subscribeRealtime(
  callback: (event: NostrEvent) => void
): () => void {
  const client = getNostrClient();
  const req = createRxForwardReq();
  
  const subscription = client.use(req).subscribe({
    next: (packet: EventPacket) => {
      const appTag = packet.event.tags.find(t => t[0] === 'app')?.[1];
      if (appTag === APP_TAG) {
        callback(packet.event);
      }
    },
  });
  
  req.emit([{
    kinds: [KIND_APP_DATA],
    '#app': [APP_TAG],
    since: Math.floor(Date.now() / 1000),
  }]);
  
  return () => subscription.unsubscribe();
}

/**
 * 接続を閉じる
 */
export function closeConnection(): void {
  if (rxNostr) {
    rxNostr.dispose();
    rxNostr = null;
  }
}
