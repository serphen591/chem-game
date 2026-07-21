(() => {
  'use strict';

  const TAGS = ['反应物混淆','仪器用途混淆','现象混淆','方程式物质错误','配平错误','步骤顺序错误'];
  const ANALYSIS = {
    '反应物混淆': {
      title:'反应物与干扰项没有分清',
      reason:'选择时没有先锁定真正参加反应的物质，容易把相似药品或无关用品一起带入。',
      suggestion:'先从题目中圈出反应物和反应条件，再逐项排除只负责盛装、加热或检验的用品。'
    },
    '仪器用途混淆': {
      title:'仪器用途与实验目标不匹配',
      reason:'当前器材不能完成这一步所需的盛装、导气、加热或检验功能。',
      suggestion:'先判断本步动作是“装、导、热、检”中的哪一种，再按功能选择对应仪器。'
    },
    '现象混淆': {
      title:'没有抓住最有辨识度的现象',
      reason:'把反应前颜色、反应过程变化和最终生成物现象混在了一起。',
      suggestion:'按“原有状态→变化过程→最终现象”观察，优先确认气体、沉淀、颜色和发光发热。'
    },
    '方程式物质错误': {
      title:'反应物或生成物判断有误',
      reason:'物质所属一侧没有判断正确，说明实验现象还没有完整对应到化学式。',
      suggestion:'先根据实验确定谁被消耗、谁新生成，再把化学式分别放到反应物和生成物一侧。'
    },
    '配平错误': {
      title:'原子守恒检查不完整',
      reason:'系数调整后仍有元素在反应前后的原子总数不相等。',
      suggestion:'先配出现次数少或组成复杂的物质，最后检查每一种元素，并把系数化为最简整数比。'
    },
    '步骤顺序错误': {
      title:'实验操作先后顺序不合理',
      reason:'当前操作提前使用了后续物品，或把源物品与目标容器的方向颠倒。',
      suggestion:'先完成装置与基础物料准备，再加药、导气或点燃；每一步都确认“把谁用于谁”。'
    }
  };

  const xml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
  const compact = (value, limit = 110) => {
    if (value == null) return '未记录';
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return String(text).replace(/\s+/g, ' ').trim().slice(0, limit) || '未记录';
  };
  const wrap = (value, width = 25, lines = 3) => {
    const text = compact(value, width * lines);
    const result = [];
    for (let index = 0; index < text.length && result.length < lines; index += width) result.push(text.slice(index, index + width));
    return result;
  };
  const textLines = (value, x, y, options = {}) => {
    const rows = wrap(value, options.width || 25, options.lines || 3);
    return `<text x="${x}" y="${y}" fill="${options.color || '#263a33'}" font-size="${options.size || 17}" font-weight="${options.weight || 700}" font-family="Microsoft YaHei,PingFang SC,sans-serif">${rows.map((row, index) => `<tspan x="${x}" dy="${index ? options.gap || 25 : 0}">${xml(row)}</tspan>`).join('')}</text>`;
  };
  const toDataUrl = (svg) => {
    const bytes = new TextEncoder().encode(svg); let binary = '';
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  };

  function describe(value) {
    if (!value || typeof value !== 'object') return compact(value);
    if (Array.isArray(value.supplies)) return `用品：${value.supplies.join('、') || '未选择'}`;
    if (value.source || value.target) return `组合：${value.source || '未选择'} → ${value.target || '未选择'}`;
    if (value.phenomenon) return `现象：${value.phenomenon}`;
    if (Array.isArray(value.reactants) || Array.isArray(value.products)) return `反应物：${(value.reactants || []).join('＋') || '未选择'}；生成物：${(value.products || []).join('＋') || '未选择'}`;
    return compact(value);
  }

  function buildAnalysis(tags, details = {}, message = '') {
    const tag = (Array.isArray(tags) ? tags : []).find((item) => TAGS.includes(item)) || '反应物混淆';
    const base = ANALYSIS[tag];
    const actual = describe(details.actual);
    const reason = `${base.reason}${actual && actual !== '未记录' ? ` 当时记录：${actual}。` : ''}`;
    return { tag, title:base.title, reason, suggestion:base.suggestion, message:compact(message, 180) };
  }

  function createSnapshot(context = {}) {
    const tags = Array.isArray(context.tags) ? context.tags.filter((item) => TAGS.includes(item)) : [];
    const errorCount = Math.max(1, Math.min(3, Number(context.errorCount || context.stepErrorCount || 1)));
    const tone = ['','#36b889','#ee9b41','#df4551'][errorCount];
    const actual = describe(context.actual), expected = describe(context.expected);
    const tag = tags[0] || '待归类';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500" viewBox="0 0 900 500">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eefaf4"/><stop offset="1" stop-color="#e7f0fb"/></linearGradient><linearGradient id="bench" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f8fffb"/><stop offset="1" stop-color="#cfe7dc"/></linearGradient></defs>
      <rect width="900" height="500" rx="28" fill="url(#bg)"/>
      <rect x="24" y="22" width="852" height="66" rx="18" fill="#fff" stroke="#d7e8e0"/>
      <rect x="42" y="35" width="40" height="40" rx="12" fill="#13a879"/><text x="62" y="63" text-anchor="middle" fill="#fff" font-size="23" font-weight="900" font-family="Microsoft YaHei,sans-serif">化</text>
      ${textLines(`${context.experimentCode || '实验'} · ${context.experimentTitle || '化学实验'}`, 98, 50, {width:37,lines:1,size:18,weight:900})}
      ${textLines(context.task || context.stepKey || '错误步骤回放', 98, 74, {width:46,lines:1,size:12,color:'#667a72',weight:600})}
      <rect x="690" y="39" width="90" height="33" rx="16" fill="#e9f8f1"/><text x="735" y="61" text-anchor="middle" fill="#08785a" font-size="13" font-weight="900" font-family="Microsoft YaHei,sans-serif">${xml(context.stage || '实验步骤')}</text>
      <rect x="790" y="39" width="68" height="33" rx="16" fill="${tone}22"/><text x="824" y="61" text-anchor="middle" fill="${tone}" font-size="13" font-weight="900" font-family="Microsoft YaHei,sans-serif">错 ${errorCount}/3</text>
      <rect x="24" y="105" width="258" height="369" rx="22" fill="#fff" stroke="#d7e8e0"/>
      <text x="45" y="140" fill="#13251f" font-size="20" font-weight="900" font-family="Microsoft YaHei,sans-serif">错误发生瞬间</text>
      <rect x="45" y="156" width="190" height="32" rx="16" fill="${tone}18"/><circle cx="62" cy="172" r="6" fill="${tone}"/><text x="76" y="177" fill="${tone}" font-size="13" font-weight="900" font-family="Microsoft YaHei,sans-serif">${xml(tag)}</text>
      <text x="45" y="219" fill="#72817b" font-size="12" font-weight="800" font-family="Microsoft YaHei,sans-serif">系统提示</text>
      ${textLines(context.message || '本步骤操作不正确', 45, 246, {width:20,lines:4,size:16,color:'#c93643',weight:800,gap:26})}
      <rect x="45" y="370" width="216" height="78" rx="15" fill="#f4f8f6"/>
      <text x="61" y="395" fill="#718079" font-size="11" font-weight="800" font-family="Microsoft YaHei,sans-serif">步骤编号</text>
      ${textLines(context.stepKey || 'unknown', 61, 421, {width:21,lines:1,size:15,weight:900})}
      <rect x="300" y="105" width="576" height="369" rx="22" fill="#fff" stroke="#d7e8e0"/>
      <text x="325" y="140" fill="#13251f" font-size="20" font-weight="900" font-family="Microsoft YaHei,sans-serif">当时的实验界面</text>
      <rect x="325" y="158" width="526" height="181" rx="18" fill="url(#bench)"/>
      <rect x="345" y="181" width="486" height="58" rx="14" fill="#ffffffdd" stroke="#cfe2d9"/>
      <text x="365" y="203" fill="#718079" font-size="11" font-weight="800" font-family="Microsoft YaHei,sans-serif">学生实际操作</text>
      ${textLines(actual, 365, 227, {width:43,lines:3,size:16,weight:900,gap:24})}
      <line x1="345" y1="291" x2="831" y2="291" stroke="#62b790" stroke-width="7" stroke-linecap="round"/>
      <circle cx="390" cy="294" r="25" fill="#fff" stroke="#86cdb1" stroke-width="3"/><path d="M380 280h20v29c0 10-20 10-20 0z" fill="#a6e4cb" stroke="#3f7665" stroke-width="2"/>
      <circle cx="470" cy="294" r="25" fill="#fff" stroke="#86cdb1" stroke-width="3"/><path d="M458 282h24l-4 28h-16z" fill="#dcefeb" stroke="#3f7665" stroke-width="2"/>
      <circle cx="550" cy="294" r="25" fill="#fff" stroke="#86cdb1" stroke-width="3"/><path d="M544 277h12v31h-12z" fill="#f4c563" stroke="#8a6327" stroke-width="2"/>
      <rect x="325" y="358" width="526" height="91" rx="16" fill="#eef8f3"/>
      <text x="345" y="384" fill="#08785a" font-size="12" font-weight="900" font-family="Microsoft YaHei,sans-serif">正确目标（完成实验后解锁回看）</text>
      ${textLines(expected, 345, 412, {width:45,lines:2,size:15,weight:800,gap:23})}
    </svg>`;
    return { kind:'error-interface', mime:'image/svg+xml', width:900, height:500, dataUrl:toDataUrl(svg) };
  }

  function eventEvidence(event = {}, fallback = {}) {
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : event;
    const tags = Array.isArray(event.tags) ? event.tags : Array.isArray(payload.tags) ? payload.tags : [];
    const details = { expected:event.expected || payload.expected || null, actual:event.actual || payload.actual || null };
    const analysis = payload.analysis && typeof payload.analysis === 'object' ? payload.analysis : buildAnalysis(tags, details, event.message || payload.message || '');
    const stored = payload.snapshot && /^data:image\/svg\+xml;base64,/.test(payload.snapshot.dataUrl || '') ? payload.snapshot : null;
    const snapshot = stored || createSnapshot({
      experimentCode:payload.experimentCode || fallback.experimentCode,
      experimentTitle:payload.experimentTitle || fallback.experimentTitle,
      task:payload.task || fallback.task,
      stage:event.stage || payload.stage,
      stepKey:event.step_key || event.stepKey || payload.stepKey,
      errorCount:event.step_error_count || event.stepErrorCount || payload.stepErrorCount,
      message:event.message || payload.message,
      tags, expected:details.expected, actual:details.actual
    });
    return { tags, analysis, snapshot };
  }

  window.ChemLabReplayEvidence = Object.freeze({ TAGS:[...TAGS], buildAnalysis, createSnapshot, eventEvidence, describe });
})();
