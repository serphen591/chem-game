import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const required = [
  'index.html',
  'config.js',
  'data/experiments.json',
  'assets/js/supabase-rest.js',
  'assets/js/student-account.js',
  'teacher/index.html',
  'supabase/migrations/202607210001_chem_lab_backend.sql',
  'supabase/functions/chem-lab-api/index.ts'
];

for (const file of required) await readFile(file);
const html = await readFile('index.html', 'utf8');
const experiments = JSON.parse(await readFile('data/experiments.json', 'utf8'));
const migration = await readFile('supabase/migrations/202607210001_chem_lab_backend.sql', 'utf8');

const forbidden = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+/i,
  /postgres(?:ql)?:\/\/[^\s]+:[^\s]+@/i,
  /BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/i
];

const filesToScan = ['config.js', 'index.html', 'README.md'];
for (const file of filesToScan) {
  const content = await readFile(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(content)) throw new Error(`${file} 中疑似出现不应提交的凭据。`);
  }
}

if (experiments.length !== 323) throw new Error(`实验目录数量异常：${experiments.length}`);
if (!html.includes('window.CHEM_LAB_EXPERIMENTS')) throw new Error('实验目录尚未从 index.html 独立出来。');
for (const tag of ['反应物混淆','仪器用途混淆','现象混淆','方程式物质错误','配平错误','步骤顺序错误']) {
  if (!migration.includes(tag)) throw new Error(`迁移文件缺少标签：${tag}`);
}

for (const htmlFile of ['index.html', 'teacher/index.html']) {
  const source = await readFile(htmlFile, 'utf8');
  const links = [...source.matchAll(/(?:src|href)="([^"#]+)"/g)].map((match) => match[1]);
  for (const link of links) {
    if (/^(?:https?:|mailto:|data:)/.test(link)) continue;
    const target = path.resolve(path.dirname(htmlFile), link);
    await access(target).catch(() => { throw new Error(`${htmlFile} 引用的文件不存在：${link}`); });
  }
}
console.log('项目结构、323条实验目录、六类标签与凭据边界检查通过。');
