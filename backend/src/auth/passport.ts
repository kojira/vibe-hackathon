import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';

// Discord OAuthユーザー型
export interface DiscordUser {
  discordId: string;
  username: string;
  discriminator?: string;
  avatar?: string;
}

// Passportの設定
export function setupPassport() {
  // Discord OAuth設定が無い場合はスキップ
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    console.warn('Discord OAuth credentials not configured. OAuth will not work.');
    return;
  }

  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:4000/auth/discord/callback',
    scope: ['identify'],
  }, (_accessToken, _refreshToken, profile, done) => {
    // Discordユーザー情報を返す
    const user: DiscordUser = {
      discordId: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      avatar: profile.avatar ?? undefined,
    };
    return done(null, user);
  }));

  // シリアライズ/デシリアライズ（セッションストアには保存しない）
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: DiscordUser, done) => {
    done(null, user);
  });
}

export { passport };
