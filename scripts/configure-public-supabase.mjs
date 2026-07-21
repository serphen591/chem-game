import { writeFile } from 'node:fs/promises';

const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) throw new Error('SUPABASE_URL 格式无效。');
if (!key.startsWith('sb_publishable_') || key.length < 30) throw new Error('必须使用 sb_publishable_ 开头的浏览器公开密钥。');

const config = {
  supabaseUrl: url,
  supabasePublishableKey: key,
  apiBaseUrl: `${url}/functions/v1/chem-lab-api`,
  apiPath: '',
  syncEnabled: true,
  appVersion: '7.3-supabase-foundation',
  requestTimeoutMs: 10000,
  queueLimit: 1200
};
await writeFile(new URL('../config.js', import.meta.url), `/* Supabase publishable key 是浏览器公开配置；RLS 负责数据权限。 */\nwindow.CHEM_LAB_CONFIG=Object.freeze(${JSON.stringify(config, null, 2)});\n`, 'utf8');
console.log(`已连接 ${url}，公开密钥前缀 ${key.slice(0, 18)}…`);

