(() => {
  'use strict';
  const client = window.ChemLabSupabase;
  const loginView = document.querySelector('#login-view');
  const dashboard = document.querySelector('#dashboard');
  const main = document.querySelector('#main-content');
  const dialog = document.querySelector('#detail-dialog');
  const dialogContent = document.querySelector('#dialog-content');
  const toast = document.querySelector('#toast');
  let profile = null;
  let classes = [];
  let activeClassId = null;
  const tags = ['反应物混淆','仪器用途混淆','现象混淆','方程式物质错误','配平错误','步骤顺序错误'];

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const formatTime = (value) => value ? new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '—';
  const formatDuration = (ms) => ms == null ? '—' : `${Math.max(1, Math.round(Number(ms) / 60000))}分钟`;
  const flash = (text) => { toast.textContent = text; toast.hidden = false; setTimeout(() => { toast.hidden = true; }, 2600); };
  const completionLabel = (mode) => ({independent:'独立完成',hint:'提示后完成',answer:'答案后完成'}[mode] || '进行中');

  async function authenticate() {
    if (!client?.configured) throw new Error('尚未配置 Supabase 项目 URL 和 publishable key。');
    const session = await client.restore();
    if (!session) return false;
    const context = await client.api('/me');
    if (!['teacher','admin'].includes(context?.profile?.role)) throw new Error('这个账号还没有教师权限。');
    profile = context.profile;
    document.querySelector('#teacher-alias').textContent = profile.display_alias;
    return true;
  }

  async function enterDashboard() {
    loginView.hidden = true; dashboard.hidden = false;
    await loadClasses();
  }

  async function loadClasses() {
    classes = await client.api('/teacher/classes');
    document.querySelector('#class-count').textContent = classes.length;
    const list = document.querySelector('#class-list');
    list.innerHTML = classes.map((item) => `<button class="class-button" data-class-id="${esc(item.id)}" aria-current="${item.id === activeClassId}"><strong>${esc(item.name)}</strong><small>${esc(item.invite_code)}</small><b>${item.student_count}</b></button>`).join('') || '<p class="sidebar-note">先创建一个班级，再把邀请码发给学生。</p>';
    list.querySelectorAll('[data-class-id]').forEach((button) => button.onclick = () => selectClass(button.dataset.classId));
    if (!activeClassId && classes[0]) await selectClass(classes[0].id);
  }

  function renderTags(distribution) {
    const map = Object.fromEntries((distribution || []).map((item) => [item.tag, item]));
    return tags.map((tag) => {
      const item = map[tag] || {green:0,orange:0,red:0,total:0};
      const total = Math.max(1, Number(item.total || 0));
      return `<div class="tag-row"><strong>${tag}</strong><span class="tag-bar"><i class="green" style="width:${100*item.green/total}%"></i><i class="orange" style="width:${100*item.orange/total}%"></i><i class="red" style="width:${100*item.red/total}%"></i></span><b>${item.total}</b></div>`;
    }).join('');
  }

  function actualSummary(actual) {
    if (!actual) return '未保存具体选择';
    if (Array.isArray(actual.supplies)) return `选择：${actual.supplies.join('、')}`;
    if (actual.source || actual.target) return `${actual.source || '—'} → ${actual.target || '—'}`;
    if (actual.phenomenon) return actual.phenomenon;
    return JSON.stringify(actual).slice(0, 100);
  }

  function teacherEvidenceCard(event, attempt) {
    const evidence = window.ChemLabReplayEvidence?.eventEvidence(event, {experimentCode:attempt.experiment_code,experimentTitle:attempt.experiment_code}) || {};
    const analysis = evidence.analysis || {title:'错误步骤已记录',reason:event.message || '需要结合学生实际选择进一步判断。',suggestion:'请教师结合本步骤目标进行讲解。'};
    const eventTags = (evidence.tags || event.tags || []).filter((tag) => tags.includes(tag));
    const count = Number(event.step_error_count || 1);
    const image = evidence.snapshot?.dataUrl || '';
    return `<article class="teacher-error-evidence" data-severity="${esc(event.severity || '')}"><div class="teacher-evidence-head"><div><strong>第 ${count} 次错误 · ${esc(event.step_key || event.stage || '未知步骤')}</strong>${eventTags.map((tag) => `<span class="knowledge-tag">${esc(tag)}</span>`).join('')}</div><small>${formatTime(event.occurred_at)}</small></div>${image ? `<img src="${esc(image)}" alt="${esc(event.step_key || event.stage || '实验步骤')}错误发生时的学生界面截图">` : ''}<div class="teacher-evidence-analysis"><section><h3>${esc(analysis.title)}</h3><p>${esc(analysis.reason)}</p></section><section><h3>教学介入建议</h3><p>${esc(analysis.suggestion)}</p></section></div></article>`;
  }

  function renderOverview(overview, students) {
    const recent = overview.recent_attempts || [];
    const errors = overview.common_errors || [];
    main.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">CLASS OVERVIEW</p><h1>${esc(overview.class.name)}</h1><p>${overview.completion_basis === 'assignments' ? '按已布置实验统计完成率' : '尚未布置任务，当前显示班级参与完成率'}</p></div><span class="invite-chip">邀请码 ${esc(overview.class.invite_code)}</span></div>
      <section class="metric-grid">
        <div class="metric"><small>班级学生</small><strong>${overview.student_count}</strong></div>
        <div class="metric"><small>完成率</small><strong>${overview.completion_rate}%</strong></div>
        <div class="metric" data-tone="orange"><small>答案公开率</small><strong>${overview.answer_reveal_rate}%</strong></div>
        <div class="metric" data-tone="red"><small>待重做记录</small><strong>${overview.needs_redo_attempts}</strong></div>
      </section>
      <section class="dashboard-grid">
        <article class="panel"><div class="panel-head"><div><h2>六类知识标签</h2><p>每一步第1、2、3次错误分别为绿、橙、红</p></div><span class="legend"><b><i class="green"></i>1次</b><b><i class="orange"></i>2次</b><b><i class="red"></i>3次</b></span></div><div class="tag-list">${renderTags(overview.tag_distribution)}</div></article>
        <article class="panel"><div class="panel-head"><div><h2>最常见错点</h2><p>用于检查干扰项、提示和关卡难度</p></div></div><div class="error-list">${errors.map((item) => `<div class="error-item"><span>${esc(item.tag)}</span><p>${esc(item.step_key || item.stage || '未知步骤')} · ${esc(actualSummary(item.actual))}</p><b>${item.occurrences}</b></div>`).join('') || '<p class="sidebar-note">还没有错误记录。</p>'}</div></article>
        <article class="panel full"><div class="panel-head"><div><h2>布置实验</h2><p>有布置记录后，完成率按“学生数 × 布置实验数”计算</p></div></div><form class="assign-form" id="assign-form"><input name="experimentCode" required placeholder="实验编号，例如 B1-004"><select name="difficulty"><option value="">按题库难度</option><option value="1">基础</option><option value="2">进阶</option><option value="3">挑战</option></select><button type="submit">布置</button></form></article>
        <article class="panel full"><div class="panel-head"><div><h2>学生记录</h2><p>点击“诊断”查看待重做实验与跨关知识卡点</p></div></div><div class="table-wrap"><table><thead><tr><th>实验员</th><th>已完成</th><th>答案后完成</th><th>待重做</th><th>红色错点</th><th>最近活动</th><th></th></tr></thead><tbody>${students.map((item) => `<tr><td><strong>${esc(item.display_alias)}</strong><small>${esc(item.student_id.slice(-8))}</small></td><td>${item.completed_count}</td><td>${item.answer_completed_count}</td><td><span class="status-badge ${item.needs_redo_count ? 'red' : ''}">${item.needs_redo_count}</span></td><td>${item.red_error_count}</td><td>${formatTime(item.last_active_at)}</td><td><button class="table-button" data-student="${esc(item.student_id)}" data-student-alias="${esc(item.display_alias)}">诊断</button></td></tr>`).join('') || '<tr><td colspan="7">还没有学生加入班级。</td></tr>'}</tbody></table></div></article>
        <article class="panel full"><div class="panel-head"><div><h2>最近实验与关键回放</h2><p>按确认顺序查看每一步的期望物品、实际选择和知识标签</p></div></div><div class="table-wrap"><table><thead><tr><th>学生</th><th>实验</th><th>完成方式</th><th>错误</th><th>用时</th><th>状态</th><th></th></tr></thead><tbody>${recent.map((item) => `<tr><td>${esc(item.display_alias)}</td><td><strong>${esc(item.experiment_title)}</strong><small>${esc(item.experiment_code)}</small></td><td>${completionLabel(item.completion_mode)}</td><td>${item.total_errors}</td><td>${formatDuration(item.duration_ms)}</td><td><span class="status-badge ${item.needs_redo ? 'red' : ''}">${item.needs_redo ? '待重做' : esc(item.status)}</span></td><td><button class="table-button" data-replay="${encodeURIComponent(item.attempt_id)}">回放</button></td></tr>`).join('') || '<tr><td colspan="7">还没有实验记录。</td></tr>'}</tbody></table></div></article>
      </section>`;

    main.querySelector('#assign-form').onsubmit = async (event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      try {
        await client.api(`/teacher/classes/${activeClassId}/assignments`, {method:'POST',body:JSON.stringify({experimentCode:data.get('experimentCode'),difficulty:data.get('difficulty') ? Number(data.get('difficulty')) : null})});
        flash('实验已布置。'); await selectClass(activeClassId);
      } catch (error) { flash(error.message || '布置失败。'); }
    };
    main.querySelectorAll('[data-replay]').forEach((button) => button.onclick = () => showReplay(decodeURIComponent(button.dataset.replay)));
    main.querySelectorAll('[data-student]').forEach((button) => button.onclick = () => showRecommendations(button.dataset.student, button.dataset.studentAlias));
  }

  async function selectClass(classId) {
    activeClassId = classId;
    document.querySelectorAll('[data-class-id]').forEach((button) => button.setAttribute('aria-current', String(button.dataset.classId === classId)));
    main.innerHTML = '<section class="empty-state"><span>⌬</span><h1>正在整理班级数据…</h1></section>';
    try {
      const [overview, students] = await Promise.all([
        client.api(`/teacher/classes/${classId}/overview`),
        client.api(`/teacher/classes/${classId}/students`)
      ]);
      renderOverview(overview, students);
    } catch (error) { main.innerHTML = `<section class="empty-state"><h1>加载失败</h1><p>${esc(error.message)}</p></section>`; }
  }

  async function showReplay(attemptId) {
    dialogContent.innerHTML = '<h2>正在加载关键步骤…</h2>'; dialog.showModal();
    try {
      const data = await client.api(`/teacher/attempts/${encodeURIComponent(attemptId)}/replay`);
      const errors=(data.events || []).filter((event) => event.event_type === 'step_error');
      dialogContent.innerHTML = `<div class="dialog-title"><p class="eyebrow">ERROR EVIDENCE REPLAY</p><h2>${esc(data.attempt.experiment_code)} · 错误截图与知识标签</h2><p>只展示学生做错的界面截图；系统依据实际操作归入六类知识标签，并保留第1、2、3次错误的绿、橙、红等级。</p></div><div class="timeline">${errors.map((event) => teacherEvidenceCard(event,data.attempt)).join('') || '<div class="teacher-no-errors"><strong>本次实验没有错误截图</strong><p>学生未触发六类错误标签。</p></div>'}</div>`;
    } catch (error) { dialogContent.innerHTML = `<h2>无法读取回放</h2><p>${esc(error.message)}</p>`; }
  }

  async function showRecommendations(studentId, alias) {
    dialogContent.innerHTML = '<h2>正在生成学习诊断…</h2>'; dialog.showModal();
    try {
      const data = await client.api(`/teacher/students/${studentId}/recommendations`);
      dialogContent.innerHTML = `<div class="dialog-title"><p class="eyebrow">LEARNING DIAGNOSIS</p><h2>${esc(alias)} · 错题与待重做建议</h2><p>同一标签跨3个实验出现，或出现红色公开答案记录时，建议教师介入。</p></div><div class="recommend-grid"><section class="recommend-card"><h3>待重做实验</h3><ul>${data.redo_experiments.map((item) => `<li>${esc(item.experiment_code)} · ${esc(item.title)}（步骤最高错${item.max_step_errors}次）</li>`).join('') || '<li>暂无待重做实验</li>'}</ul></section><section class="recommend-card"><h3>知识卡点</h3><ul>${data.knowledge_tags.map((item) => `<li>${esc(item.tag)}：跨${item.experiment_count}个实验，共${item.error_count}次${item.teacher_attention ? '，建议关注' : ''}</li>`).join('') || '<li>暂无知识标签</li>'}</ul></section></div>`;
    } catch (error) { dialogContent.innerHTML = `<h2>无法生成诊断</h2><p>${esc(error.message)}</p>`; }
  }

  document.querySelector('#teacher-login-form').onsubmit = async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const message = document.querySelector('#login-message');
    message.textContent = '正在验证教师权限…'; message.dataset.kind = '';
    try { await client.signIn(data.get('email'), data.get('password')); if (await authenticate()) await enterDashboard(); }
    catch (error) { await client.signOut(); message.textContent = error.message || '登录失败。'; message.dataset.kind = 'error'; }
  };
  document.querySelector('#create-class-form').onsubmit = async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    try { const item = await client.api('/teacher/classes', {method:'POST',body:JSON.stringify({name:data.get('name')})}); event.currentTarget.reset(); activeClassId = item.id; await loadClasses(); flash('班级已创建。'); }
    catch (error) { flash(error.message || '创建失败。'); }
  };
  document.querySelector('#sign-out').onclick = async () => { await client.signOut(); location.reload(); };
  document.querySelector('#dialog-close').onclick = () => dialog.close();

  authenticate().then((ok) => { if (ok) enterDashboard(); }).catch((error) => {
    const message = document.querySelector('#login-message');
    message.textContent = error.message; message.dataset.kind = 'error';
  });
})();
