import 'express-session';

declare module 'express-session' {
  interface SessionData {
    passOk?: boolean;
    user?: {
      discordId: string;
      username: string;
      discriminator?: string;
      avatar?: string;
    };
  }
}
