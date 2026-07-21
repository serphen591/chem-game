import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, '_site');
const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.length >= 20;

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ['index.html', 'README.md', 'assets', 'data', 'teacher']) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}

if (configured) {
  const runtimeConfig = `window.CHEM_LAB_CONFIG=Object.freeze(${JSON.stringify({
    supabaseUrl: url,
    supabasePublishableKey: key,
    apiBaseUrl: `${url}/functions/v1/chem-lab-api`,
    apiPath: '',
    syncEnabled: true,
    appVersion: '7.5-error-evidence-replay',
    requestTimeoutMs: 10000,
    queueLimit: 1200
  }, null, 2)});\n`;
  await writeFile(path.join(output, 'config.js'), runtimeConfig, 'utf8');
} else {
  await cp(path.join(root, 'config.js'), path.join(output, 'config.js'));
}
await writeFile(path.join(output, '.nojekyll'), '', 'utf8');

const html = await readFile(path.join(output, 'index.html'), 'utf8');
if (!html.includes('assets/js/student-account.js')) {
  throw new Error('index.html 未加载学生账户模块。');
}

console.log(configured
  ? `静态站点已生成，使用 GitHub Repository Variables：${url}`
  : '静态站点已生成，使用仓库中的浏览器公开配置。');
