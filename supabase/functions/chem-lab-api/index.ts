import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const DEFAULT_ORIGINS = 'https://serphen591.github.io,http://localhost:8080,http://127.0.0.1:8080';
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') || DEFAULT_ORIGINS)
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
);

type JsonRecord = Record<string, unknown>;

function corsHeaders(request: Request) {
  const origin = (request.headers.get('origin') || '').replace(/\/$/, '');
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://serphen591.github.io';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(request: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function routePath(url: URL) {
  const marker = '/chem-lab-api';
  const index = url.pathname.indexOf(marker);
  const route = index >= 0 ? url.pathname.slice(index + marker.length) : url.pathname;
  return route || '/';
}

async function readBody(request: Request): Promise<JsonRecord> {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 1_000_000) throw new Error('请求内容过大。');
  try { return await request.json(); } catch (_) { throw new Error('请求 JSON 无效。'); }
}

function dbFailure(request: Request, error: { message?: string; code?: string } | null) {
  const forbidden = error?.code === '42501' || /forbidden|teacher role|required/i.test(error?.message || '');
  return json(request, { error: forbidden ? '没有访问权限。' : (error?.message || '数据库请求失败。') }, forbidden ? 403 : 400);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json(request, { error: '服务端 Supabase 环境未配置。' }, 500);

  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json(request, { error: '请先登录。' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } }
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(authorization.slice(7));
  if (authError || !authData.user) return json(request, { error: '登录状态已失效。' }, 401);

  const url = new URL(request.url);
  const route = routePath(url);

  try {
    if (request.method === 'GET' && route === '/me') {
      const { data, error } = await supabase.rpc('get_my_context');
      return error ? dbFailure(request, error) : json(request, data);
    }

    if (request.method === 'GET' && route === '/student/replays') {
      const limit = Math.max(1, Math.min(30, Number(url.searchParams.get('limit') || 10)));
      const { data, error } = await supabase
        .from('experiment_attempts')
        .select('id,experiment_code,module,difficulty,status,completion_mode,total_errors,max_step_errors,needs_redo,duration_ms,started_at,completed_at')
        .eq('student_id', authData.user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(limit);
      return error ? dbFailure(request, error) : json(request, data || []);
    }

    const studentReplayMatch = route.match(/^\/student\/attempts\/([^/]+)\/replay$/);
    if (request.method === 'GET' && studentReplayMatch) {
      const attemptId = decodeURIComponent(studentReplayMatch[1]);
      const { data: attempt, error: attemptError } = await supabase
        .from('experiment_attempts')
        .select('id,experiment_code,module,difficulty,status,completion_mode,total_errors,max_step_errors,needs_redo,duration_ms,started_at,completed_at')
        .eq('id', attemptId)
        .eq('student_id', authData.user.id)
        .maybeSingle();
      if (attemptError) return dbFailure(request, attemptError);
      if (!attempt) return json(request, { error: '没有找到该实验回放。' }, 404);
      const { data: events, error: eventsError } = await supabase
        .from('step_events')
        .select('event_id,event_type,step_key,stage,step_error_count,severity,tags,expected,actual,message,payload,occurred_at')
        .eq('attempt_id', attemptId)
        .eq('student_id', authData.user.id)
        .order('occurred_at', { ascending: true });
      return eventsError ? dbFailure(request, eventsError) : json(request, { attempt, events: events || [] });
    }

    if (request.method === 'POST' && route === '/events/batch') {
      const body = await readBody(request);
      const events = Array.isArray(body.events) ? body.events.slice(0, 200) : [];
      const sanitizedEvents = events.map((raw) => {
        const event = raw && typeof raw === 'object' ? { ...(raw as JsonRecord) } : {};
        for (const key of ['identity', 'displayName', 'email', 'studentId', 'classId']) delete event[key];
        return event;
      });
      const { data, error } = await supabase.rpc('ingest_learning_events', {
        p_client_version: String(body.clientVersion || '').slice(0, 80),
        p_events: sanitizedEvents
      });
      return error ? dbFailure(request, error) : json(request, { ok: true, ...data });
    }

    if (request.method === 'POST' && route === '/classes/join') {
      const body = await readBody(request);
      const { data, error } = await supabase.rpc('join_class', { p_invite_code: String(body.inviteCode || '') });
      return error ? dbFailure(request, error) : json(request, data, 201);
    }

    if (request.method === 'GET' && route === '/teacher/classes') {
      const { data, error } = await supabase.rpc('teacher_list_classes');
      return error ? dbFailure(request, error) : json(request, data);
    }

    if (request.method === 'POST' && route === '/teacher/classes') {
      const body = await readBody(request);
      const { data, error } = await supabase.rpc('create_class', { p_name: String(body.name || '') });
      return error ? dbFailure(request, error) : json(request, data, 201);
    }

    const overviewMatch = route.match(/^\/teacher\/classes\/([0-9a-f-]+)\/overview$/i);
    if (request.method === 'GET' && overviewMatch) {
      const { data, error } = await supabase.rpc('teacher_class_overview', { p_class_id: overviewMatch[1] });
      return error ? dbFailure(request, error) : json(request, data);
    }

    const studentsMatch = route.match(/^\/teacher\/classes\/([0-9a-f-]+)\/students$/i);
    if (request.method === 'GET' && studentsMatch) {
      const { data, error } = await supabase.rpc('teacher_class_students', { p_class_id: studentsMatch[1] });
      return error ? dbFailure(request, error) : json(request, data);
    }

    const assignmentMatch = route.match(/^\/teacher\/classes\/([0-9a-f-]+)\/assignments$/i);
    if (request.method === 'POST' && assignmentMatch) {
      const body = await readBody(request);
      const { data, error } = await supabase.rpc('assign_experiment', {
        p_class_id: assignmentMatch[1],
        p_experiment_code: String(body.experimentCode || ''),
        p_difficulty: body.difficulty == null ? null : Number(body.difficulty),
        p_due_at: body.dueAt || null
      });
      return error ? dbFailure(request, error) : json(request, data, 201);
    }

    const replayMatch = route.match(/^\/teacher\/attempts\/([^/]+)\/replay$/);
    if (request.method === 'GET' && replayMatch) {
      const { data, error } = await supabase.rpc('teacher_attempt_replay', { p_attempt_id: decodeURIComponent(replayMatch[1]) });
      return error ? dbFailure(request, error) : json(request, data);
    }

    const recommendationMatch = route.match(/^\/teacher\/students\/([0-9a-f-]+)\/recommendations$/i);
    if (request.method === 'GET' && recommendationMatch) {
      const { data, error } = await supabase.rpc('student_recommendations', { p_student_id: recommendationMatch[1] });
      return error ? dbFailure(request, error) : json(request, data);
    }

    return json(request, { error: '接口不存在。' }, 404);
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : '服务器处理失败。' }, 400);
  }
});
