import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const required = [
  'index.html',
  'config.js',
  'data/experiments.json',
  'assets/js/supabase-rest.js',
  'assets/js/student-account.js',
  'assets/js/replay-evidence.js',
  'assets/css/replay-evidence.css',
  'assets/css/interface-fixes.css',
  'teacher/index.html',
  'supabase/migrations/202607210001_chem_lab_backend.sql',
  'supabase/migrations/202607210003_error_replay_evidence.sql',
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
if (!html.includes("supabaseClient.api('/events/batch'")) throw new Error('实验事件上传没有复用 Supabase 登录客户端。');
if (!html.includes('headers.apikey=NETWORK_CONFIG.supabasePublishableKey')) throw new Error('同步降级请求缺少 Supabase apikey。');
if (!html.includes('ChemLabReplayEvidence')) throw new Error('学生端没有生成错误截图证据。');
if (!html.includes('canonicalSupplyList')) throw new Error('实验用品未启用全局标准化与去重。');
if (html.includes("'稀HCl溶液':['liquid','HCl']")) throw new Error('用品库仍保留重复的稀HCl溶液实体。');
if (!html.includes('equation-mode') || !html.includes('equation-workspace')) throw new Error('方程式拼图尚未切换为全宽工作区。');
const studentAccount = await readFile('assets/js/student-account.js', 'utf8');
const teacherDashboard = await readFile('teacher/teacher.js', 'utf8');
const replayEvidence = await readFile('assets/js/replay-evidence.js', 'utf8');
if (replayEvidence.includes('version:2') || !replayEvidence.includes('系统提示</text>') || !replayEvidence.includes('正确目标（完成实验后解锁回看）')) throw new Error('关键回放尚未还原为上一版。');
if (!studentAccount.includes('student-error-evidence')) throw new Error('学生端没有展示错误截图与错因分析。');
if (!teacherDashboard.includes('teacher-error-evidence')) throw new Error('教师端没有展示错误截图与六类知识标签。');
for (const tag of ['反应物混淆','仪器用途混淆','现象混淆','方程式物质错误','配平错误','步骤顺序错误']) {
  if (!migration.includes(tag)) throw new Error(`迁移文件缺少标签：${tag}`);
}

for (const htmlFile of ['index.html', 'teacher/index.html']) {
  const source = await readFile(htmlFile, 'utf8');
  const links = [...source.matchAll(/(?:src|href)="([^"#]+)"/g)].map((match) => match[1]);
  for (const link of links) {
    if (/^(?:https?:|mailto:|data:)/.test(link)) continue;
    const target = path.resolve(path.dirname(htmlFile), link.split(/[?#]/, 1)[0]);
    await access(target).catch(() => { throw new Error(`${htmlFile} 引用的文件不存在：${link}`); });
  }
}
console.log('项目结构、323条实验目录、六类标签与凭据边界检查通过。');
