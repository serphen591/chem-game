import { readFile } from 'node:fs/promises';

const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
if (!url || !serviceKey) {
  throw new Error('请仅在本机环境变量中设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。');
}

const experiments = JSON.parse(await readFile(new URL('../data/experiments.json', import.meta.url), 'utf8'));
const rows = experiments.map((item) => ({
  code: item.code,
  module: item.module,
  chapter: item.chapter,
  title: item.title,
  difficulty: item.chapter === 'B1' || item.chapter === 'B2' ? 1 : item.chapter === 'X1' ? 2 : 3,
  version: 337,
  reactant_features: item.reactantFeatures || null,
  product_features: item.productFeatures || null,
  phenomenon: item.phenomenon || null,
  metadata: { detail: item.detail }
}));

for (let offset = 0; offset < rows.length; offset += 100) {
  const response = await fetch(`${url}/rest/v1/experiments?on_conflict=code`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows.slice(offset, offset + 100))
  });
  if (!response.ok) throw new Error(`同步失败（${response.status}）：${await response.text()}`);
  console.log(`已同步 ${Math.min(offset + 100, rows.length)} / ${rows.length}`);
}

