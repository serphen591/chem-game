import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const htmlPath = path.join(root, 'index.html');
let html = await readFile(htmlPath, 'utf8');
const marker = 'const FULL_REACTION_BANK=Array.isArray(window.CHEM_LAB_EXPERIMENTS)';

if (html.includes(marker)) {
  console.log('实验目录已经独立，无需重复提取。');
  process.exit(0);
}

const match = html.match(/    const FULL_REACTION_BANK=(\[.*?\]);\r?\n    const CATEGORY_NAMES=/s);
if (!match) throw new Error('没有找到 FULL_REACTION_BANK 数据块。');

const experiments = JSON.parse(match[1]);
const dataDir = path.join(root, 'data');
await mkdir(dataDir, { recursive: true });
await writeFile(path.join(dataDir, 'experiments.json'), `${JSON.stringify(experiments, null, 2)}\n`, 'utf8');
await writeFile(
  path.join(dataDir, 'experiments.js'),
  `window.CHEM_LAB_EXPERIMENTS=Object.freeze(${JSON.stringify(experiments)});\n`,
  'utf8'
);

html = html.replace(
  match[0],
  '    const FULL_REACTION_BANK=Array.isArray(window.CHEM_LAB_EXPERIMENTS)?window.CHEM_LAB_EXPERIMENTS:[];\n    const CATEGORY_NAMES='
);
html = html.replace(
  '  <script>\n  (()=>{',
  '  <script src="./data/experiments.js"></script>\n  <script>\n  (()=>{'
);
await writeFile(htmlPath, html, 'utf8');
console.log(`已独立提取 ${experiments.length} 条实验目录数据。`);

