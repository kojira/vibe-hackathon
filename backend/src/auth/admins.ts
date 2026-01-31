import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const ADMINS_FILE = join(DATA_DIR, 'admins.json');

// 管理者一覧をロード
export function loadAdmins(): string[] {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!existsSync(ADMINS_FILE)) {
      // 初期ファイル作成
      const superAdmin = process.env.SUPER_ADMIN_DISCORD_ID;
      const initialAdmins = superAdmin ? [superAdmin] : [];
      saveAdmins(initialAdmins);
      return initialAdmins;
    }

    const data = readFileSync(ADMINS_FILE, 'utf-8');
    const admins: string[] = JSON.parse(data);

    // SUPER_ADMIN_DISCORD_ID が設定されている場合は必ず含める
    const superAdmin = process.env.SUPER_ADMIN_DISCORD_ID;
    if (superAdmin && !admins.includes(superAdmin)) {
      admins.push(superAdmin);
      saveAdmins(admins);
    }

    return admins;
  } catch (error) {
    console.error('Failed to load admins:', error);
    return [];
  }
}

// 管理者一覧を保存
export function saveAdmins(admins: string[]): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
  } catch (error) {
    console.error('Failed to save admins:', error);
    throw error;
  }
}

// 管理者かどうかをチェック
export function isAdmin(discordId: string): boolean {
  const admins = loadAdmins();
  return admins.includes(discordId);
}

// 管理者を追加
export function addAdmin(discordId: string): boolean {
  const admins = loadAdmins();
  if (admins.includes(discordId)) {
    return false; // 既に存在
  }
  admins.push(discordId);
  saveAdmins(admins);
  return true;
}

// 管理者を削除
export function removeAdmin(discordId: string): boolean {
  const admins = loadAdmins();
  const index = admins.indexOf(discordId);
  if (index === -1) {
    return false; // 存在しない
  }
  admins.splice(index, 1);
  saveAdmins(admins);
  return true;
}
