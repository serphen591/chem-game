import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const required = [
  'index.html',
  'config.js',
  'data/experiments.json',
  'data/comprehensive-experiments.js',
  'assets/js/supabase-rest.js',
  'assets/js/student-account.js',
  'assets/js/replay-evidence.js',
  'assets/css/replay-evidence.css',
  'assets/css/interface-fixes.css',
  'teacher/index.html',
  'supabase/migrations/202607210001_chem_lab_backend.sql',
  'supabase/migrations/202607210003_error_replay_evidence.sql',
  'supabase/migrations/202607240001_seed_comprehensive_experiments.sql',
  'supabase/functions/chem-lab-api/index.ts'
];

for (const file of required) await readFile(file);
const html = await readFile('index.html', 'utf8');
const experiments = JSON.parse(await readFile('data/experiments.json', 'utf8'));
const comprehensiveSource = await readFile('data/comprehensive-experiments.js', 'utf8');
const comprehensiveSandbox = { window: {} };
vm.runInNewContext(comprehensiveSource, comprehensiveSandbox);
const comprehensive = comprehensiveSandbox.window.CHEM_LAB_COMPREHENSIVE?.experiments || [];
const migration = await readFile('supabase/migrations/202607210001_chem_lab_backend.sql', 'utf8');
const comprehensiveMigration = await readFile('supabase/migrations/202607240001_seed_comprehensive_experiments.sql', 'utf8');
const studentAccountCss = await readFile('assets/css/student-account.css', 'utf8');

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
if (comprehensive.length !== 22) throw new Error(`综合实验数量异常：${comprehensive.length}`);
if (new Set(comprehensive.map((item) => item.code)).size !== 22) throw new Error('综合实验代码存在重复。');
for (const item of comprehensive) {
  const nodeCount = (item.steps?.length || 0) + (item.investigation?.probes?.length || 0);
  if (nodeCount < 7) throw new Error(`${item.code} 完整流程不足7个操作/查证节点。`);
  if (!item.steps?.some((step) => /装配|准备|处理/.test(step.stage))) throw new Error(`${item.code} 缺少装置装配或实验准备。`);
  if (!item.steps?.some((step) => /检验|检查|结论|复验|回收|分离|纯度/.test(step.stage)) && !item.investigation) throw new Error(`${item.code} 缺少检验、成品检查或结论阶段。`);
}
for (const code of ['E01', 'E16']) {
  const item = comprehensive.find((entry) => entry.code === code);
  if (!item?.investigation?.probes?.some((probe) => probe.positive === false)) throw new Error(`${code} 缺少“无明显现象”阴性证据分支。`);
}
if (!html.includes('window.CHEM_LAB_EXPERIMENTS')) throw new Error('实验目录尚未从 index.html 独立出来。');
if (!html.includes('data/comprehensive-experiments.js') || !html.includes('registerComprehensiveExperiments')) throw new Error('22个综合实验尚未接入独立流程数据。');
if (!html.includes("phase==='investigate'") || !html.includes('result:probe.positive?\'positive\':\'no_observation\'')) throw new Error('未知样品尚未启用可循环查证与阴性证据记录。');
if (!html.includes('completedStep&&completedStep.id') || html.includes('stepKey=s.phase===\'combine\'?`combine.')) throw new Error('综合实验操作没有使用稳定步骤键。');
if (!html.includes('grid-template-columns:minmax(300px,1fr) minmax(0,2fr)') || !html.includes('width:min(1280px,100%)')) throw new Error('页面尚未保持1280宽度与实验主区/侧栏2:1。');
if (!html.includes('window.visualViewport') || !html.includes('--app-height') || !html.includes('orientation:landscape') || !html.includes('max-height:620px')) throw new Error('页面尚未按学习机真实可视高度启用分级横屏布局。');
if (html.includes('height:720px;min-height:720px')) throw new Error('页面仍强制720px高度，会被学习机系统栏裁切。');
if (!html.includes('text-size-adjust:100%') || !html.includes('transform:scale(.62)') || !studentAccountCss.includes('orientation:landscape')) throw new Error('学习机文字、模块图标或登录入口尚未完成紧凑适配。');
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
for (const item of comprehensive) {
  if (!comprehensiveMigration.includes(`'${item.code}'`) || !comprehensiveMigration.includes(item.title)) throw new Error(`Supabase综合实验迁移缺少 ${item.code}。`);
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
