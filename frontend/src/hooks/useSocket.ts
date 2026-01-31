import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Presentation {
  id: string;
  discordId: string;
  username: string;
  avatar: string | null;
  title: string;
  description: string | null;
  createdAt: string;
}

interface Live {
  id: string;
  presentationId: string | null;
  title: string;
  presenter: string;
  presenterDiscordId: string | null;
  presenterAvatar: string | null;
  description: string | null;
  startedAt: string;
  endedAt: string | null;
  resultsPublished: number | null;
}

interface RatingAxis {
  id: number;
  key: string;
  label: string;
  order: number;
}

interface Rating {
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

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentLive, setCurrentLive] = useState<Live | null>(null);
  const [ratingAxes, setRatingAxes] = useState<RatingAxis[]>([]);
  const [liveHistory, setLiveHistory] = useState<Live[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [presentationSubmitted, setPresentationSubmitted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const socket = io({
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('get_current_live');
      socket.emit('get_rating_axes');
      socket.emit('get_presentations');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('auth_state', (state: AuthState) => {
      setAuthState(state);
    });

    socket.on('current_live', (data: { live: Live | null }) => {
      setCurrentLive(data.live);
      setSubmitted(false);
      if (data.live) {
        socket.emit('check_submitted', { liveId: data.live.id });
      }
    });

    socket.on('live_updated', (data: { live: Live | null }) => {
      setCurrentLive(data.live);
      setSubmitted(false);
      if (data.live) {
        socket.emit('check_submitted', { liveId: data.live.id });
      }
    });

    socket.on('rating_axes', (data: { axes: RatingAxis[] }) => {
      setRatingAxes(data.axes);
    });

    socket.on('live_history', (data: { history: Live[] }) => {
      setLiveHistory(data.history);
    });

    socket.on('submitted_status', (data: { submitted: boolean }) => {
      setSubmitted(data.submitted);
    });

    // 結果公開時にliveHistoryを更新
    socket.on('results_published', (data: { liveId: string }) => {
      setLiveHistory(prev => prev.map(live => 
        live.id === data.liveId ? { ...live, resultsPublished: 1 } : live
      ));
    });

    // LIVE削除時にliveHistoryを更新
    socket.on('live_deleted', (data: { liveId: string }) => {
      setLiveHistory(prev => prev.filter(live => live.id !== data.liveId));
    });

    // 発表登録一覧を受信
    socket.on('presentations', (data: { presentations: Presentation[] }) => {
      setPresentations(data.presentations);
    });

    // 発表登録時に一覧を更新
    socket.on('presentation_registered', (data: { presentation: Presentation }) => {
      setPresentations(prev => [data.presentation, ...prev]);
    });

    // 発表削除時に一覧を更新
    socket.on('presentation_deleted', (data: { presentationId: string }) => {
      setPresentations(prev => prev.filter(p => p.id !== data.presentationId));
    });

    // プレゼンテーション審査済み状態を受信
    socket.on('presentation_submitted_status', (data: { presentationId: string; submitted: boolean }) => {
      setPresentationSubmitted(prev => ({ ...prev, [data.presentationId]: data.submitted }));
    });

    // プレゼンテーション審査が送信されたら通知
    socket.on('presentation_rating_submitted', () => {
      // 他の人が審査した通知（必要に応じて処理）
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const setLive = useCallback((title: string, presenter: string, presentationId?: string) => {
    socketRef.current?.emit('set_live', { title, presenter, presentationId });
  }, []);

  const endLive = useCallback(() => {
    socketRef.current?.emit('end_live');
  }, []);

  const submitRating = useCallback((liveId: string, scores: Record<string, number>, comment?: string): Promise<{ ok: boolean; reason?: string }> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve({ ok: false, reason: '接続されていません' });
        return;
      }

      const handler = (data: { ok: boolean; reason?: string }) => {
        socket.off('rating_ack', handler);
        if (data.ok) {
          setSubmitted(true);
        }
        resolve(data);
      };

      socket.on('rating_ack', handler);
      socket.emit('submit_rating', { liveId, scores, comment });

      // タイムアウト
      setTimeout(() => {
        socket.off('rating_ack', handler);
        resolve({ ok: false, reason: 'タイムアウトしました' });
      }, 10000);
    });
  }, []);

  const getLiveHistory = useCallback(() => {
    socketRef.current?.emit('get_live_history');
  }, []);

  const getRatings = useCallback((liveId: string): Promise<Rating[]> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve([]);
        return;
      }

      const handler = (data: { ratings: Rating[] }) => {
        socket.off('ratings', handler);
        resolve(data.ratings);
      };

      socket.on('ratings', handler);
      socket.emit('get_ratings', { liveId });

      setTimeout(() => {
        socket.off('ratings', handler);
        resolve([]);
      }, 10000);
    });
  }, []);

  const publishResults = useCallback((liveId: string): Promise<{ ok: boolean; reason?: string }> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve({ ok: false, reason: '接続されていません' });
        return;
      }

      const handler = (data: { ok: boolean; reason?: string }) => {
        socket.off('publish_results_ack', handler);
        resolve(data);
      };

      socket.on('publish_results_ack', handler);
      socket.emit('publish_results', { liveId });

      setTimeout(() => {
        socket.off('publish_results_ack', handler);
        resolve({ ok: false, reason: 'タイムアウトしました' });
      }, 10000);
    });
  }, []);

  const deleteLive = useCallback((liveId: string): Promise<{ ok: boolean; reason?: string }> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve({ ok: false, reason: '接続されていません' });
        return;
      }

      const handler = (data: { ok: boolean; reason?: string }) => {
        socket.off('delete_live_ack', handler);
        resolve(data);
      };

      socket.on('delete_live_ack', handler);
      socket.emit('delete_live', { liveId });

      setTimeout(() => {
        socket.off('delete_live_ack', handler);
        resolve({ ok: false, reason: 'タイムアウトしました' });
      }, 10000);
    });
  }, []);

  const getPresentations = useCallback(() => {
    socketRef.current?.emit('get_presentations');
  }, []);

  const registerPresentation = useCallback((title: string, description?: string): Promise<{ ok: boolean; reason?: string }> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve({ ok: false, reason: '接続されていません' });
        return;
      }

      const handler = (data: { ok: boolean; reason?: string }) => {
        socket.off('register_presentation_ack', handler);
        resolve(data);
      };

      socket.on('register_presentation_ack', handler);
      socket.emit('register_presentation', { title, description });

      setTimeout(() => {
        socket.off('register_presentation_ack', handler);
        resolve({ ok: false, reason: 'タイムアウトしました' });
      }, 10000);
    });
  }, []);

  const deletePresentation = useCallback((presentationId: string): Promise<{ ok: boolean; reason?: string }> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve({ ok: false, reason: '接続されていません' });
        return;
      }

      const handler = (data: { ok: boolean; reason?: string }) => {
        socket.off('delete_presentation_ack', handler);
        resolve(data);
      };

      socket.on('delete_presentation_ack', handler);
      socket.emit('delete_presentation', { presentationId });

      setTimeout(() => {
        socket.off('delete_presentation_ack', handler);
        resolve({ ok: false, reason: 'タイムアウトしました' });
      }, 10000);
    });
  }, []);

  const submitPresentationRating = useCallback((presentationId: string, scores: Record<string, number>, comment?: string): Promise<{ ok: boolean; reason?: string }> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve({ ok: false, reason: '接続されていません' });
        return;
      }

      const handler = (data: { ok: boolean; reason?: string }) => {
        socket.off('presentation_rating_ack', handler);
        if (data.ok) {
          setPresentationSubmitted(prev => ({ ...prev, [presentationId]: true }));
        }
        resolve(data);
      };

      socket.on('presentation_rating_ack', handler);
      socket.emit('submit_presentation_rating', { presentationId, scores, comment });

      setTimeout(() => {
        socket.off('presentation_rating_ack', handler);
        resolve({ ok: false, reason: 'タイムアウトしました' });
      }, 10000);
    });
  }, []);

  const checkPresentationSubmitted = useCallback((presentationId: string) => {
    socketRef.current?.emit('check_presentation_submitted', { presentationId });
  }, []);

  const getPresentationRatings = useCallback((presentationId: string): Promise<Rating[]> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve([]);
        return;
      }

      const handler = (data: { presentationId: string; ratings: Rating[] }) => {
        if (data.presentationId === presentationId) {
          socket.off('presentation_ratings', handler);
          resolve(data.ratings);
        }
      };

      socket.on('presentation_ratings', handler);
      socket.emit('get_presentation_ratings', { presentationId });

      setTimeout(() => {
        socket.off('presentation_ratings', handler);
        resolve([]);
      }, 10000);
    });
  }, []);

  return {
    connected,
    currentLive,
    ratingAxes,
    liveHistory,
    presentations,
    authState,
    submitted,
    presentationSubmitted,
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
