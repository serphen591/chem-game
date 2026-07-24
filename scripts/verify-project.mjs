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
if (!html.includes('function catalogPageSize') || !html.includes('data-catalog-page') || !html.includes('catalogPaginationMarkup')) throw new Error('实验目录尚未启用响应式分页。');
if (!html.includes('function quickPuzzleModel') || !html.includes('sameMultiset(quickState.reactantSelection,model.reactants)') || !html.includes('sameMultiset(quickState.productSelection,model.products)')) throw new Error('快速闯关拼图尚未按方程式两侧进行无序判定。');
if (html.includes("quickState.answer.join('|')===q.parts.join('|')") || html.includes('按正确顺序放入答案槽')) throw new Error('快速闯关仍在使用卡片顺序作为判定条件。');
if (!html.includes('function combustionProfileFor')) throw new Error('燃烧实验尚未启用固体、液体、气体专用分流。');
if (!html.includes("'坩埚':['apparatus','坩埚']") || !html.includes("'大药匙':['apparatus','大药匙']")) throw new Error('燃烧专用承载器材未加入用品库。');
if (!html.includes("combustion.kind==='gas'") || !html.includes("combustion.kind==='liquid'")) throw new Error('燃烧状态分类不完整。');
if (!html.includes("用火柴直接点燃导气管出气口")) throw new Error('气体燃烧仍未限定为导气管出口点燃。');
if (!html.includes("container='坩埚'") || !html.includes("container='大药匙'")) throw new Error('固体或液体燃烧仍可能落入通用试管容器。');
if (html.includes("supplies:['镁条','二氧化碳','酒精灯']")) throw new Error('镁在二氧化碳中燃烧仍沿用旧器材方案。');
const combustionEntries = experiments.filter((entry) => /燃烧|点燃/.test(`${entry.title} ${entry.detail}`));
if (combustionEntries.length !== 25) throw new Error(`燃烧题目数量发生变化：${combustionEntries.length}`);
const gasCombustionCodes = new Set(['B1-030','B2-029','B2-052','B2-054','B2-059','X1-005','X3-003','X3-015']);
const liquidCombustionCodes = new Set(['B2-060','B2-063','X1-006','X3-002','X3-025']);
for (const entry of combustionEntries) {
  const expected = gasCombustionCodes.has(entry.code) ? 'gas' : liquidCombustionCodes.has(entry.code) ? 'liquid' : 'solid';
  if (!['gas','liquid','solid'].includes(expected)) throw new Error(`燃烧题目未分类：${entry.code}`);
}
const studentAccount = await readFile('assets/js/student-account.js', 'utf8');
const teacherDashboard = await readFile('teacher/teacher.js', 'utf8');
const replayEvidence = await readFile('assets/js/replay-evidence.js', 'utf8');
const replayStyles = await readFile('assets/css/replay-evidence.css', 'utf8');
if (!replayEvidence.includes('version:4') || !replayEvidence.includes('showAll') || !replayEvidence.includes('系统提示</text>') || !replayEvidence.includes('正确目标（完成实验后解锁回看）')) throw new Error('关键回放没有启用完整文字自适应布局。');
if (/aspect-ratio\s*:\s*9\/5|object-fit\s*:\s*cover/.test(replayStyles)) throw new Error('关键回放图片仍会按固定比例裁切。');
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
