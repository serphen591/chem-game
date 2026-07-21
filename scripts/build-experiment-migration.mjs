import { readFile, writeFile } from 'node:fs/promises';

const experiments = JSON.parse(await readFile(new URL('../data/experiments.json', import.meta.url), 'utf8'));
const quote = (value) => value == null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const difficulty = (item) => item.chapter === 'B1' || item.chapter === 'B2' ? 1 : item.chapter === 'X1' ? 2 : 3;

const values = experiments.map((item) => `  (${[
  quote(item.code), quote(item.module), quote(item.chapter), quote(item.title), difficulty(item), 337,
  quote(item.reactantFeatures || null), quote(item.productFeatures || null), quote(item.phenomenon || null),
  json({ detail: item.detail })
].join(', ')})`).join(',\n');

const sql = `-- 由 data/experiments.json 生成，仅包含公开实验目录，不包含学生或教师数据。\n\ninsert into public.experiments(\n  code, module, chapter, title, difficulty, version,\n  reactant_features, product_features, phenomenon, metadata\n) values\n${values}\non conflict (code) do update set\n  module = excluded.module,\n  chapter = excluded.chapter,\n  title = excluded.title,\n  difficulty = excluded.difficulty,\n  version = excluded.version,\n  reactant_features = excluded.reactant_features,\n  product_features = excluded.product_features,\n  phenomenon = excluded.phenomenon,\n  metadata = excluded.metadata,\n  active = true,\n  updated_at = now();\n`;

await writeFile(new URL('../supabase/migrations/202607210002_seed_experiments.sql', import.meta.url), sql, 'utf8');
console.log(`已生成 ${experiments.length} 条公开实验目录迁移。`);

