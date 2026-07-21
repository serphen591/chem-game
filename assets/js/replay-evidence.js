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
    const safeItem = (item) => {
      const text = compact(item, 64);
      return text.length > 40 || /化学实验台|CHEM LAB|实验员|搜索题库|本题任务|选择用品/.test(text) ? '未识别物品' : text;
    };
    if (Array.isArray(value.supplies)) return `用品：${value.supplies.slice(0, 8).map(safeItem).join('、') || '未选择'}`;
    if (value.source || value.target) return `组合：${safeItem(value.source || '未选择')} → ${safeItem(value.target || '未选择')}`;
    if (value.phenomenon) return `现象：${compact(value.phenomenon, 72)}`;
    if (Array.isArray(value.reactants) || Array.isArray(value.products)) return `反应物：${(value.reactants || []).slice(0, 6).map(safeItem).join('＋') || '未选择'}；生成物：${(value.products || []).slice(0, 6).map(safeItem).join('＋') || '未选择'}`;
    if (value.coefficients && typeof value.coefficients === 'object') return `系数：${Object.values(value.coefficients).slice(0, 10).map(safeItem).join('，') || '未填写'}`;
    return compact(value, 80);
  }

  function buildAnalysis(tags, details = {}, message = '') {
    const tag = (Array.isArray(tags) ? tags : []).find((item) => TAGS.includes(item)) || '反应物混淆';
    const base = ANALYSIS[tag];
    return { tag, title:base.title, reason:base.reason, suggestion:base.suggestion, message:compact(message, 120) };
  }

  function createSnapshot(context = {}) {
    const tags = Array.isArray(context.tags) ? context.tags.filter((item) => TAGS.includes(item)) : [];
    const errorCount = Math.max(1, Math.min(3, Number(context.errorCount || context.stepErrorCount || 1)));
    const tone = ['','#36b889','#ee9b41','#df4551'][errorCount];
    const actual = describe(context.actual);
    const analysis = buildAnalysis(tags, { actual:context.actual, expected:context.expected }, context.message || '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400" viewBox="0 0 900 400">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f2fbf6"/><stop offset="1" stop-color="#edf3fb"/></linearGradient></defs>
      <rect width="900" height="400" rx="28" fill="url(#bg)"/>
      <rect x="24" y="22" width="852" height="58" rx="17" fill="#fff" stroke="#d7e8e0"/>
      <rect x="42" y="32" width="38" height="38" rx="12" fill="#13a879"/><text x="61" y="59" text-anchor="middle" fill="#fff" font-size="22" font-weight="900" font-family="Microsoft YaHei,sans-serif">化</text>
      ${textLines(`${context.experimentCode || '实验'} · ${context.experimentTitle || '化学实验'}`, 96, 57, {width:46,lines:1,size:18,weight:900})}
      <rect x="784" y="35" width="72" height="32" rx="16" fill="${tone}18"/><text x="820" y="57" text-anchor="middle" fill="${tone}" font-size="13" font-weight="900" font-family="Microsoft YaHei,sans-serif">错 ${errorCount}/3</text>
      <rect x="24" y="98" width="410" height="278" rx="22" fill="#fff" stroke="#d7e8e0"/>
      <circle cx="53" cy="130" r="8" fill="${tone}"/><text x="71" y="137" fill="#13251f" font-size="21" font-weight="900" font-family="Microsoft YaHei,sans-serif">错因分析</text>
      ${textLines(analysis.title, 48, 185, {width:25,lines:2,size:20,color:tone,weight:900,gap:28})}
      ${textLines(analysis.reason, 48, 252, {width:25,lines:4,size:16,color:'#53665f',weight:700,gap:27})}
      <rect x="452" y="98" width="424" height="278" rx="22" fill="#fff" stroke="#d7e8e0"/>
      <circle cx="481" cy="130" r="8" fill="#18a77c"/><text x="499" y="137" fill="#13251f" font-size="21" font-weight="900" font-family="Microsoft YaHei,sans-serif">实际操作</text>
      <rect x="476" y="166" width="376" height="160" rx="18" fill="#f1faf5" stroke="#cfe5da"/>
      ${textLines(actual, 500, 215, {width:30,lines:4,size:18,color:'#173c30',weight:900,gap:32})}
    </svg>`;
    return { version:2, kind:'error-interface', mime:'image/svg+xml', width:900, height:400, dataUrl:toDataUrl(svg) };
  }

  function eventEvidence(event = {}, fallback = {}) {
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : event;
    const tags = Array.isArray(event.tags) ? event.tags : Array.isArray(payload.tags) ? payload.tags : [];
    const details = { expected:event.expected || payload.expected || null, actual:event.actual || payload.actual || null };
    const stored = payload.snapshot && Number(payload.snapshot.version) >= 2 && /^data:image\/svg\+xml;base64,/.test(payload.snapshot.dataUrl || '') ? payload.snapshot : null;
    const analysis = stored && payload.analysis && typeof payload.analysis === 'object' ? payload.analysis : buildAnalysis(tags, details, event.message || payload.message || '');
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
