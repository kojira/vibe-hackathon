/**
 * Cloudflare Workers - Discord OAuth認証
 * 
 * Discord OAuthを処理し、JWTトークンを発行する
 */

interface Env {
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name: string | null;
}

interface TokenPayload {
  discordId: string;
  username: string;
  avatar: string | null;
  exp: number;
  iat: number;
}

// Base64URL エンコード
function base64UrlEncode(data: string): string {
  return btoa(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// HMAC-SHA256 署名
async function sign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

// JWT生成
async function createJWT(payload: TokenPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(`${encodedHeader}.${encodedPayload}`, secret);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// CORS ヘッダー
function corsHeaders(origin: string, allowedOrigin: string): HeadersInit {
  // GitHub Pages と localhost を許可
  const isAllowed = origin === allowedOrigin || 
                    origin.startsWith('http://localhost:') ||
                    origin.startsWith('http://127.0.0.1:');
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Discord アバターURL生成
function getAvatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || env.FRONTEND_URL;

    // CORS プリフライト
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(origin, env.FRONTEND_URL),
      });
    }

    // Discord OAuth開始
    if (url.pathname === '/auth/discord') {
      const state = crypto.randomUUID();
      const redirectUri = `${url.origin}/auth/discord/callback`;
      
      const params = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'identify',
        state: state,
      });

      // stateをcookieに保存（CSRF対策）
      const response = Response.redirect(
        `https://discord.com/api/oauth2/authorize?${params}`,
        302
      );
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `https://discord.com/api/oauth2/authorize?${params}`,
          'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
        },
      });
    }

    // Discord OAuthコールバック
    if (url.pathname === '/auth/discord/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        return Response.redirect(`${env.FRONTEND_URL}?error=${error}`, 302);
      }

      if (!code) {
        return Response.redirect(`${env.FRONTEND_URL}?error=no_code`, 302);
      }

      // stateの検証
      const cookies = request.headers.get('Cookie') || '';
      const storedState = cookies.match(/oauth_state=([^;]+)/)?.[1];
      
      if (state !== storedState) {
        return Response.redirect(`${env.FRONTEND_URL}?error=invalid_state`, 302);
      }

      try {
        // アクセストークン取得
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: env.DISCORD_CLIENT_ID,
            client_secret: env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `${url.origin}/auth/discord/callback`,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('Token error:', errorText);
          return Response.redirect(`${env.FRONTEND_URL}?error=token_failed`, 302);
        }

        const tokenData = await tokenResponse.json() as { access_token: string };

        // ユーザー情報取得
        const userResponse = await fetch('https://discord.com/api/users/@me', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        });

        if (!userResponse.ok) {
          return Response.redirect(`${env.FRONTEND_URL}?error=user_fetch_failed`, 302);
        }

        const user = await userResponse.json() as DiscordUser;

        // JWT生成
        const now = Math.floor(Date.now() / 1000);
        const payload: TokenPayload = {
          discordId: user.id,
          username: user.global_name || user.username,
          avatar: getAvatarUrl(user),
          iat: now,
          exp: now + 60 * 60 * 24 * 7, // 7日間有効
        };

        const jwt = await createJWT(payload, env.JWT_SECRET);

        // フロントエンドにリダイレクト（JWTをフラグメントで渡す）
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${env.FRONTEND_URL}#token=${jwt}`,
            'Set-Cookie': 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/',
          },
        });

      } catch (error) {
        console.error('OAuth error:', error);
        return Response.redirect(`${env.FRONTEND_URL}?error=oauth_failed`, 302);
      }
    }

    // JWT検証エンドポイント
    if (url.pathname === '/auth/verify' && request.method === 'POST') {
      try {
        const body = await request.json() as { token: string };
        const token = body.token;

        if (!token) {
          return new Response(JSON.stringify({ valid: false, error: 'No token' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders(origin, env.FRONTEND_URL),
            },
          });
        }

        // JWT検証
        const parts = token.split('.');
        if (parts.length !== 3) {
          return new Response(JSON.stringify({ valid: false, error: 'Invalid token format' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders(origin, env.FRONTEND_URL),
            },
          });
        }

        const [header, payload, signature] = parts;
        const expectedSignature = await sign(`${header}.${payload}`, env.JWT_SECRET);

        if (signature !== expectedSignature) {
          return new Response(JSON.stringify({ valid: false, error: 'Invalid signature' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders(origin, env.FRONTEND_URL),
            },
          });
        }

        const decodedPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as TokenPayload;

        // 有効期限チェック
        if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
          return new Response(JSON.stringify({ valid: false, error: 'Token expired' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders(origin, env.FRONTEND_URL),
            },
          });
        }

        return new Response(JSON.stringify({
          valid: true,
          user: {
            discordId: decodedPayload.discordId,
            username: decodedPayload.username,
            avatar: decodedPayload.avatar,
          },
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin, env.FRONTEND_URL),
          },
        });

      } catch (error) {
        return new Response(JSON.stringify({ valid: false, error: 'Verification failed' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin, env.FRONTEND_URL),
          },
        });
      }
    }

    // ヘルスチェック
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin, env.FRONTEND_URL),
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
