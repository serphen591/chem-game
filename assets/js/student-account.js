(() => {
  'use strict';
  const client = window.ChemLabSupabase;
  if (!client) return;

  let context = null;
  const root = document.createElement('div');
  root.id = 'student-account-root';
  root.innerHTML = `
    <button class="account-fab" id="account-fab" type="button" aria-haspopup="dialog">本地模式</button>
    <div class="account-modal" id="account-modal" hidden>
      <div class="account-card" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button class="account-close" id="account-close" type="button" aria-label="关闭">×</button>
        <p class="account-kicker">CHEM LAB CLOUD</p>
        <h2 id="account-title">学习数据同步</h2>
        <div id="account-body"></div>
        <p class="account-message" id="account-message" aria-live="polite"></p>
      </div>
    </div>`;
  document.body.appendChild(root);

  const fab = root.querySelector('#account-fab');
  const modal = root.querySelector('#account-modal');
  const body = root.querySelector('#account-body');
  const message = root.querySelector('#account-message');

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const setMessage = (text, kind = '') => { message.textContent = text || ''; message.dataset.kind = kind; };
  const replayEventNames = {attempt_started:'开始实验',step_error:'步骤出错',answer_revealed:'公开答案',step_completed:'完成步骤',attempt_completed:'完成实验',attempt_abandoned:'退出实验',hint_opened:'查看提示'};
  const formatReplayTime = (value) => { const date = new Date(value || 0); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); };
  const syncFailureText = (result) => {
    if (result?.reason === 'auth-required') return '登录状态已过期，请退出后重新登录。';
    if (result?.reason === 'timeout') return '同步请求超时，请检查网络后重试。';
    if (result?.reason === 'sync-disabled') return '云端同步配置尚未启用。';
    return `同步失败${result?.error ? `：${result.error}。` : '，请检查网络后重试。'}记录仍安全保存在本机。`;
  };

  function experimentTitle(code) {
    const item = (window.CHEM_LAB_EXPERIMENTS || []).find((entry) => entry.code === code);
    return item?.title || code || '实验';
  }

  function replayItems() {
    const local = window.ChemLabConnection?.getLocalReplays?.(10) || [];
    const cloud = Array.isArray(context?.replays) ? context.replays : [];
    const merged = new Map();
    cloud.forEach((item) => merged.set(item.id, { attemptId:item.id, experimentCode:item.experiment_code, experimentTitle:experimentTitle(item.experiment_code), completedAt:item.completed_at, cloudSaved:true, localSaved:false, events:[] }));
    local.forEach((item) => merged.set(item.attemptId, { ...(merged.get(item.attemptId) || {}), ...item, cloudSaved:Boolean(item.cloudSyncedAt || merged.get(item.attemptId)?.cloudSaved), localSaved:true }));
    return [...merged.values()].filter((item) => item.completedAt).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))).slice(0, 10);
  }

  function replayTimeline(events, fallback = {}) {
    const errors = (events || []).filter((event) => (event.eventType || event.event_type) === 'step_error');
    return errors.map((event) => {
      const stepKey = event.stepKey || event.step_key || event.stage || '';
      const count = Number(event.stepErrorCount || event.step_error_count || 1);
      const evidence = window.ChemLabReplayEvidence?.eventEvidence(event, fallback) || {};
      const analysis = evidence.analysis || { title:'本步骤判断有误', reason:event.message || '错误步骤已记录。', suggestion:'对照正确目标重新完成本步骤。' };
      const image = evidence.snapshot?.dataUrl || '';
      return `<article class="student-error-evidence" data-severity="${esc(event.severity || '')}"><div class="student-evidence-head"><span>第 ${count} 次错误 · ${esc(stepKey)}</span><small>${esc(formatReplayTime(event.occurredAt || event.occurred_at))}</small></div>${image ? `<img src="${esc(image)}" alt="${esc(stepKey)}错误发生时的实验界面截图">` : ''}<div class="student-cause"><strong>${esc(analysis.title)}</strong><p>${esc(analysis.reason)}</p><div><b>下一次这样做</b>${esc(analysis.suggestion)}</div></div></article>`;
    }).join('') || '<div class="student-replay-perfect"><strong>本次实验没有错误截图</strong><p>所有关键步骤均未触发错误记录。</p></div>';
  }

  async function showStudentReplay(attemptId) {
    const detail = body.querySelector('#student-replay-detail');
    if (!detail) return;
    detail.hidden = false; detail.innerHTML = '<p class="student-replay-empty">正在读取关键回放…</p>';
    try {
      const local = window.ChemLabConnection?.getLocalReplay?.(attemptId);
      const data = local?.events?.length ? { attempt:{ experiment_code:local.experimentCode }, events:local.events } : await client.api(`/student/attempts/${encodeURIComponent(attemptId)}/replay`);
      const code=data.attempt?.experiment_code || local?.experimentCode,title=experimentTitle(code);
      detail.innerHTML = `<div class="student-replay-detail-head"><div><strong>${esc(title)}</strong><small>只回放做错的界面，并给出针对性错因分析</small></div><button type="button" id="student-replay-close">收起</button></div><div class="student-replay-timeline">${replayTimeline(data.events || [],{experimentCode:code,experimentTitle:title})}</div>`;
      detail.querySelector('#student-replay-close').onclick = () => { detail.hidden = true; detail.innerHTML = ''; };
    } catch (error) { detail.innerHTML = `<p class="student-replay-empty">${esc(error.message || '暂时无法读取回放。')}</p>`; }
  }

  function authMarkup(mode = 'login') {
    const register = mode === 'register';
    body.innerHTML = `
      <div class="account-tabs">
        <button data-auth-tab="login" aria-pressed="${!register}">登录</button>
        <button data-auth-tab="register" aria-pressed="${register}">注册</button>
      </div>
      <form id="auth-form">
        ${register ? '<label>实验员昵称<input name="alias" maxlength="40" required placeholder="例如：绿焰小队07"></label>' : ''}
        <label>登录邮箱<input name="email" type="email" autocomplete="email" required></label>
        <label>密码<input name="password" type="password" minlength="8" autocomplete="current-password" required></label>
        <button class="account-primary" type="submit">${register ? '创建学生账户' : '登录并同步'}</button>
      </form>
      <p class="privacy-note">邮箱和做题记录只发送到已配置的 Supabase 项目，不写入 GitHub 仓库。</p>`;
    body.querySelectorAll('[data-auth-tab]').forEach((button) => button.onclick = () => authMarkup(button.dataset.authTab));
    body.querySelector('#auth-form').onsubmit = async (event) => {
      event.preventDefault(); setMessage('正在连接…');
      const data = new FormData(event.currentTarget);
      try {
        if (register) {
          const result = await client.signUp(data.get('email'), data.get('password'), data.get('alias'));
          if (!result?.access_token) {
            setMessage('账户已创建，请先按邮箱中的确认邮件完成验证。', 'success');
            return;
          }
        } else await client.signIn(data.get('email'), data.get('password'));
        await loadContext(); renderAccount(); setMessage('登录成功，离线记录正在补传。', 'success');
      } catch (error) { setMessage(error.message || '登录失败。', 'error'); }
    };
  }

  function accountMarkup() {
    const profile = context?.profile || {};
    const memberships = Array.isArray(context?.memberships) ? context.memberships : [];
    const replays = replayItems();
    body.innerHTML = `
      <section class="account-summary">
        <span class="account-avatar">化</span>
        <div><strong>${esc(profile.display_alias || '实验员')}</strong><small>${memberships.length ? `已加入 ${memberships.length} 个班级` : '尚未加入班级'}</small></div>
      </section>
      <div class="membership-list">${memberships.map((item) => `<span><b>${esc(item.class_name)}</b><small>${esc(item.invite_code)}</small></span>`).join('') || '<p>输入教师提供的班级邀请码，之后的实验记录会归入该班级。</p>'}</div>
      <section class="student-replays">
        <div class="student-replays-head"><div><strong>关键回放</strong><small>实验完成后本机保存，并立即同步到云端</small></div><span>${replays.length}</span></div>
        <div class="student-replay-list">${replays.map((item) => `<button type="button" data-student-replay="${esc(item.attemptId)}"><span><strong>${esc(item.experimentCode)} · ${esc(item.experimentTitle || experimentTitle(item.experimentCode))}</strong><small>${esc(formatReplayTime(item.completedAt))}</small></span><i data-saved="${item.cloudSaved ? 'cloud' : 'local'}">${item.cloudSaved ? '云端已保存' : '本机待同步'}</i></button>`).join('') || '<p class="student-replay-empty">完成第一个实验后，这里会保存关键步骤。</p>'}</div>
        <div id="student-replay-detail" hidden></div>
      </section>
      <form id="join-class-form" class="join-form">
        <input name="inviteCode" maxlength="16" required placeholder="班级邀请码">
        <button class="account-primary" type="submit">加入班级</button>
      </form>
      <div class="account-actions">
        <button id="sync-now" type="button">立即同步</button>
        ${profile.role === 'teacher' || profile.role === 'admin' ? '<a href="./teacher/">进入教师端</a>' : ''}
        <button id="account-signout" type="button">退出</button>
      </div>`;
    body.querySelectorAll('[data-student-replay]').forEach((button) => button.onclick = () => showStudentReplay(button.dataset.studentReplay));
    body.querySelector('#join-class-form').onsubmit = async (event) => {
      event.preventDefault(); setMessage('正在加入班级…');
      try {
        const code = new FormData(event.currentTarget).get('inviteCode');
        await client.api('/classes/join', { method: 'POST', body: JSON.stringify({ inviteCode: code }) });
        await loadContext(); renderAccount(); setMessage('已加入班级。', 'success');
      } catch (error) { setMessage(error.message || '邀请码无效。', 'error'); }
    };
    body.querySelector('#sync-now').onclick = async () => {
      setMessage('正在上传离线记录…');
      const result = await window.ChemLabConnection?.syncNow();
      if (result?.ok) { await loadContext(); renderAccount(); }
      setMessage(result?.ok ? `同步完成，已上传 ${result.sent || 0} 条记录。` : syncFailureText(result), result?.ok ? 'success' : 'error');
    };
    body.querySelector('#account-signout').onclick = async () => { await client.signOut(); context = null; renderAccount(); };
  }

  function renderAccount() {
    setMessage('');
    if (!client.configured) {
      fab.textContent = '本地模式';
      body.innerHTML = '<div class="account-unconfigured"><strong>Supabase 尚未连接</strong><p>当前游戏仍可离线使用。管理员配置项目 URL 和 publishable key 后，登录、班级与教师端会自动启用。</p></div>';
      return;
    }
    if (!client.session) { fab.textContent = '学生登录'; authMarkup('login'); return; }
    fab.textContent = context?.profile?.display_alias || '同步账户';
    accountMarkup();
  }

  async function loadContext() {
    if (!client.session) return null;
    const [result, replays] = await Promise.all([client.api('/me'), client.api('/student/replays?limit=10').catch(() => [])]);
    context = { ...result, replays };
    const firstClass = result.memberships?.[0];
    window.ChemLabConnection?.setStudentIdentity({
      studentId: result.profile?.id,
      classId: firstClass?.class_id || null,
      displayName: result.profile?.display_alias || null
    }, client.session.access_token);
    await window.ChemLabConnection?.syncNow();
    return context;
  }

  fab.onclick = () => { modal.hidden = false; renderAccount(); };
  root.querySelector('#account-close').onclick = () => { modal.hidden = true; };
  modal.onclick = (event) => { if (event.target === modal) modal.hidden = true; };
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') modal.hidden = true; });

  client.restore().then(async (session) => {
    if (session) try { await loadContext(); } catch (_) {}
    renderAccount();
  });
})();
