(() => {
  'use strict';

  const config = Object.freeze({
    supabaseUrl: '',
    supabasePublishableKey: '',
    ...(window.CHEM_LAB_CONFIG || {})
  });
  const SESSION_KEY = 'chemLabSupabaseSession';

  function safeJson(value, fallback = null) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function readSession() {
    try { return safeJson(localStorage.getItem(SESSION_KEY), null); } catch (_) { return null; }
  }

  function writeSession(session) {
    try {
      if (!session) localStorage.removeItem(SESSION_KEY);
      else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (_) {}
  }

  function normalizeSession(raw) {
    if (!raw || !raw.access_token) return null;
    const expiresAt = Number(raw.expires_at || 0) || Math.floor(Date.now() / 1000) + Number(raw.expires_in || 3600);
    return {
      access_token: String(raw.access_token),
      refresh_token: String(raw.refresh_token || ''),
      expires_at: expiresAt,
      token_type: 'bearer',
      user: raw.user && raw.user.id ? { id: String(raw.user.id) } : null
    };
  }

  async function parseResponse(response) {
    const text = await response.text();
    const data = text ? safeJson(text, { message: text }) : null;
    if (!response.ok) {
      const error = new Error(data?.msg || data?.message || data?.error_description || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  class SupabaseRestClient {
    constructor() {
      this.url = String(config.supabaseUrl || '').replace(/\/$/, '');
      this.key = String(config.supabasePublishableKey || '');
      this.session = readSession();
      this.refreshPromise = null;
    }

    get configured() {
      return /^https:\/\//.test(this.url) && this.key.length >= 20;
    }

    emit() {
      window.dispatchEvent(new CustomEvent('chem-lab-auth-changed', { detail: { session: this.session } }));
    }

    save(raw) {
      this.session = normalizeSession(raw);
      writeSession(this.session);
      if (window.ChemLabConnection) {
        window.ChemLabConnection.setAccessToken(this.session?.access_token || '');
      }
      this.emit();
      return this.session;
    }

    async auth(path, options = {}) {
      if (!this.configured) throw new Error('Supabase 尚未配置。');
      const response = await fetch(`${this.url}/auth/v1${path}`, {
        ...options,
        headers: {
          apikey: this.key,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      return parseResponse(response);
    }

    async signUp(email, password, displayAlias) {
      const result = await this.auth('/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: String(email).trim(),
          password: String(password),
          data: { display_alias: String(displayAlias || '').trim().slice(0, 40) }
        })
      });
      if (result?.access_token) this.save(result);
      return result;
    }

    async signIn(email, password) {
      const result = await this.auth('/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: String(email).trim(), password: String(password) })
      });
      this.save(result);
      return this.session;
    }

    async refresh() {
      if (this.refreshPromise) return this.refreshPromise;
      const token = this.session?.refresh_token;
      if (!token) return null;
      this.refreshPromise = this.auth('/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: token })
      }).then((result) => this.save(result)).catch(() => this.save(null)).finally(() => { this.refreshPromise = null; });
      return this.refreshPromise;
    }

    async restore() {
      if (!this.session) return null;
      if (Number(this.session.expires_at || 0) <= Math.floor(Date.now() / 1000) + 60) {
        return this.refresh();
      }
      window.ChemLabConnection?.setAccessToken(this.session.access_token);
      return this.session;
    }

    async signOut() {
      const token = this.session?.access_token;
      try {
        if (token) await this.auth('/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      } catch (_) {}
      this.save(null);
      window.ChemLabConnection?.clearStudentIdentity();
    }

    async api(path, options = {}, retried = false) {
      if (!this.configured) throw new Error('Supabase 尚未配置。');
      await this.restore();
      if (!this.session?.access_token) throw new Error('请先登录。');
      const base = String(config.apiBaseUrl || `${this.url}/functions/v1/chem-lab-api`).replace(/\/$/, '');
      const response = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
        ...options,
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.session.access_token}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      if (response.status === 401 && !retried && await this.refresh()) return this.api(path, options, true);
      return parseResponse(response);
    }
  }

  window.ChemLabSupabaseClient = SupabaseRestClient;
  window.ChemLabSupabase = new SupabaseRestClient();
})();

