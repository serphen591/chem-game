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
    body.innerHTML = `
      <section class="account-summary">
        <span class="account-avatar">化</span>
        <div><strong>${esc(profile.display_alias || '实验员')}</strong><small>${memberships.length ? `已加入 ${memberships.length} 个班级` : '尚未加入班级'}</small></div>
      </section>
      <div class="membership-list">${memberships.map((item) => `<span><b>${esc(item.class_name)}</b><small>${esc(item.invite_code)}</small></span>`).join('') || '<p>输入教师提供的班级邀请码，之后的实验记录会归入该班级。</p>'}</div>
      <form id="join-class-form" class="join-form">
        <input name="inviteCode" maxlength="16" required placeholder="班级邀请码">
        <button class="account-primary" type="submit">加入班级</button>
      </form>
      <div class="account-actions">
        <button id="sync-now" type="button">立即同步</button>
        ${profile.role === 'teacher' || profile.role === 'admin' ? '<a href="./teacher/">进入教师端</a>' : ''}
        <button id="account-signout" type="button">退出</button>
      </div>`;
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
      setMessage(result?.ok ? `同步完成，已上传 ${result.sent || 0} 条记录。` : '暂时无法同步，记录仍安全保存在本机。', result?.ok ? 'success' : 'error');
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
    const result = await client.api('/me');
    context = result;
    const firstClass = result.memberships?.[0];
    window.ChemLabConnection?.setStudentIdentity({
      studentId: result.profile?.id,
      classId: firstClass?.class_id || null,
      displayName: result.profile?.display_alias || null
    }, client.session.access_token);
    await window.ChemLabConnection?.syncNow();
    return result;
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

