-- 化学实验台 Supabase 后端基础
-- 只保存账号 ID、实验员昵称和学习事件；真实姓名、学号不属于本迁移的必填数据。

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_alias text not null check (char_length(display_alias) between 1 and 40),
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6,12}$'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'left')),
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table if not exists public.class_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classrooms(id) on delete cascade,
  experiment_code text not null,
  difficulty smallint check (difficulty between 1 and 3),
  due_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (class_id, experiment_code)
);

create table if not exists public.experiments (
  code text primary key,
  module text not null check (module in ('inorganic', 'organic', 'comprehensive', 'quick')),
  chapter text,
  title text not null,
  difficulty smallint not null default 1 check (difficulty between 1 and 3),
  version integer not null default 1,
  reactant_features text,
  product_features text,
  phenomenon text,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.experiment_attempts (
  id text primary key check (char_length(id) between 8 and 160),
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classrooms(id) on delete set null,
  experiment_code text not null,
  module text,
  difficulty smallint check (difficulty between 1 and 3),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  completion_mode text check (completion_mode in ('independent', 'hint', 'answer')),
  total_errors integer not null default 0 check (total_errors >= 0),
  max_step_errors smallint not null default 0 check (max_step_errors between 0 and 3),
  answer_revealed_count integer not null default 0 check (answer_revealed_count >= 0),
  needs_redo boolean not null default false,
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  app_version text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.step_events (
  event_id text primary key check (char_length(event_id) between 8 and 180),
  attempt_id text references public.experiment_attempts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classrooms(id) on delete set null,
  experiment_code text,
  session_id text,
  event_type text not null check (event_type in (
    'attempt_started', 'attempt_abandoned', 'step_error', 'hint_opened',
    'answer_revealed', 'step_completed', 'attempt_completed'
  )),
  step_key text,
  stage text,
  step_error_count smallint check (step_error_count is null or step_error_count between 0 and 3),
  severity text check (severity is null or severity in ('green', 'orange', 'red')),
  tags text[] not null default '{}',
  expected jsonb,
  actual jsonb,
  message text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create table if not exists public.step_results (
  attempt_id text not null references public.experiment_attempts(id) on delete cascade,
  step_key text not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classrooms(id) on delete set null,
  experiment_code text not null,
  stage text,
  error_count smallint not null default 0 check (error_count between 0 and 3),
  severity text check (severity is null or severity in ('green', 'orange', 'red')),
  tags text[] not null default '{}',
  rating text,
  answer_revealed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, step_key)
);

create table if not exists public.teacher_interventions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  tag text check (tag is null or tag in (
    '反应物混淆', '仪器用途混淆', '现象混淆',
    '方程式物质错误', '配平错误', '步骤顺序错误'
  )),
  status text not null default 'open' check (status in ('open', 'resolved')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists class_members_student_idx on public.class_members(student_id, status);
create index if not exists assignments_class_idx on public.class_assignments(class_id, experiment_code);
create index if not exists attempts_student_idx on public.experiment_attempts(student_id, completed_at desc);
create index if not exists attempts_class_idx on public.experiment_attempts(class_id, completed_at desc);
create index if not exists attempts_experiment_idx on public.experiment_attempts(experiment_code, status);
create index if not exists step_events_attempt_idx on public.step_events(attempt_id, occurred_at);
create index if not exists step_events_class_idx on public.step_events(class_id, event_type, occurred_at desc);
create index if not exists step_events_tags_idx on public.step_events using gin(tags);
create index if not exists step_results_student_idx on public.step_results(student_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
drop trigger if exists classrooms_touch_updated_at on public.classrooms;
create trigger classrooms_touch_updated_at before update on public.classrooms
for each row execute function public.touch_updated_at();
drop trigger if exists attempts_touch_updated_at on public.experiment_attempts;
create trigger attempts_touch_updated_at before update on public.experiment_attempts
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alias text;
begin
  v_alias := left(nullif(trim(new.raw_user_meta_data ->> 'display_alias'), ''), 40);
  if v_alias is null then v_alias := '实验员-' || right(new.id::text, 6); end if;
  insert into public.profiles(id, display_alias, role)
  values (new.id, v_alias, 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_teacher(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and role in ('teacher', 'admin')
  );
$$;

create or replace function public.teacher_owns_class(p_class_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classrooms c
    join public.profiles p on p.id = p_user_id
    where c.id = p_class_id and (c.teacher_id = p_user_id or p.role = 'admin')
  );
$$;

create or replace function public.teacher_can_view_student(p_student_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_members cm
    join public.classrooms c on c.id = cm.class_id
    join public.profiles p on p.id = p_user_id
    where cm.student_id = p_student_id
      and cm.status = 'active'
      and (c.teacher_id = p_user_id or p.role = 'admin')
  );
$$;

create or replace function public.merge_knowledge_tags(p_left text[], p_right text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct tag order by tag), '{}'::text[])
  from unnest(coalesce(p_left, '{}'::text[]) || coalesce(p_right, '{}'::text[])) as tag
  where tag = any(array[
    '反应物混淆', '仪器用途混淆', '现象混淆',
    '方程式物质错误', '配平错误', '步骤顺序错误'
  ]::text[]);
$$;

create or replace function public.safe_integer(p_value text, p_default integer default 0)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::integer;
exception when others then
  return p_default;
end;
$$;

create or replace function public.safe_bigint(p_value text, p_default bigint default 0)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::bigint;
exception when others then
  return p_default;
end;
$$;

create or replace function public.safe_timestamp(p_value text, p_default timestamptz default now())
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  return p_value::timestamptz;
exception when others then
  return p_default;
end;
$$;

alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.class_members enable row level security;
alter table public.class_assignments enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_attempts enable row level security;
alter table public.step_events enable row level security;
alter table public.step_results enable row level security;
alter table public.teacher_interventions enable row level security;

drop policy if exists profiles_read_scope on public.profiles;
create policy profiles_read_scope on public.profiles for select to authenticated
using (id = auth.uid() or public.teacher_can_view_student(id));

drop policy if exists classrooms_read_scope on public.classrooms;
create policy classrooms_read_scope on public.classrooms for select to authenticated
using (
  teacher_id = auth.uid()
  or exists (
    select 1 from public.class_members cm
    where cm.class_id = classrooms.id and cm.student_id = auth.uid() and cm.status = 'active'
  )
);

drop policy if exists class_members_read_scope on public.class_members;
create policy class_members_read_scope on public.class_members for select to authenticated
using (student_id = auth.uid() or public.teacher_owns_class(class_id));

drop policy if exists assignments_read_scope on public.class_assignments;
create policy assignments_read_scope on public.class_assignments for select to authenticated
using (
  public.teacher_owns_class(class_id)
  or exists (
    select 1 from public.class_members cm
    where cm.class_id = class_assignments.class_id and cm.student_id = auth.uid() and cm.status = 'active'
  )
);

drop policy if exists experiments_read_authenticated on public.experiments;
create policy experiments_read_authenticated on public.experiments for select to authenticated using (active);

drop policy if exists attempts_read_scope on public.experiment_attempts;
create policy attempts_read_scope on public.experiment_attempts for select to authenticated
using (student_id = auth.uid() or (class_id is not null and public.teacher_owns_class(class_id)));

drop policy if exists step_events_read_scope on public.step_events;
create policy step_events_read_scope on public.step_events for select to authenticated
using (student_id = auth.uid() or (class_id is not null and public.teacher_owns_class(class_id)));

drop policy if exists step_results_read_scope on public.step_results;
create policy step_results_read_scope on public.step_results for select to authenticated
using (student_id = auth.uid() or (class_id is not null and public.teacher_owns_class(class_id)));

drop policy if exists interventions_read_scope on public.teacher_interventions;
create policy interventions_read_scope on public.teacher_interventions for select to authenticated
using (student_id = auth.uid() or public.teacher_owns_class(class_id));

revoke all on all tables in schema public from anon;
revoke insert, update, delete on all tables in schema public from authenticated;
grant select on public.profiles, public.classrooms, public.class_members, public.class_assignments,
  public.experiments, public.experiment_attempts, public.step_events, public.step_results,
  public.teacher_interventions to authenticated;

create or replace function public.get_my_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'display_alias', p.display_alias,
      'role', p.role
    ),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'class_id', c.id,
        'class_name', c.name,
        'invite_code', c.invite_code,
        'joined_at', cm.joined_at
      ) order by cm.joined_at desc)
      from public.class_members cm
      join public.classrooms c on c.id = cm.class_id
      where cm.student_id = auth.uid() and cm.status = 'active' and not c.archived
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.create_class(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.classrooms;
  v_code text;
begin
  if auth.uid() is null or not public.is_teacher(auth.uid()) then
    raise exception 'teacher role required' using errcode = '42501';
  end if;
  if char_length(trim(p_name)) not between 1 and 80 then raise exception 'invalid class name'; end if;
  loop
    v_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
    exit when not exists (select 1 from public.classrooms where invite_code = v_code);
  end loop;
  insert into public.classrooms(teacher_id, name, invite_code)
  values (auth.uid(), trim(p_name), v_code)
  returning * into v_class;
  return to_jsonb(v_class);
end;
$$;

create or replace function public.join_class(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.classrooms;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into v_class from public.classrooms
  where invite_code = upper(trim(p_invite_code)) and not archived;
  if v_class.id is null then raise exception 'class not found'; end if;
  insert into public.class_members(class_id, student_id, status)
  values (v_class.id, auth.uid(), 'active')
  on conflict (class_id, student_id) do update set status = 'active', joined_at = now();
  return jsonb_build_object('class_id', v_class.id, 'class_name', v_class.name, 'invite_code', v_class.invite_code);
end;
$$;

create or replace function public.teacher_list_classes()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc), '[]'::jsonb)
  from (
    select c.id, c.name, c.invite_code, c.archived, c.created_at,
      count(cm.student_id) filter (where cm.status = 'active')::integer as student_count
    from public.classrooms c
    left join public.class_members cm on cm.class_id = c.id
    where public.teacher_owns_class(c.id)
    group by c.id
  ) row_data;
$$;

create or replace function public.assign_experiment(p_class_id uuid, p_experiment_code text, p_difficulty integer default null, p_due_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.class_assignments;
begin
  if not public.teacher_owns_class(p_class_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.class_assignments(class_id, experiment_code, difficulty, due_at, created_by)
  values (p_class_id, left(trim(p_experiment_code), 40), p_difficulty, p_due_at, auth.uid())
  on conflict (class_id, experiment_code) do update
    set difficulty = excluded.difficulty, due_at = excluded.due_at
  returning * into v_assignment;
  return to_jsonb(v_assignment);
end;
$$;

create or replace function public.ingest_learning_events(p_client_version text, p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_class_id uuid;
  v_event jsonb;
  v_event_id text;
  v_event_type text;
  v_attempt_id text;
  v_experiment_code text;
  v_step_key text;
  v_stage text;
  v_occurred_at timestamptz;
  v_error_count integer;
  v_severity text;
  v_tags text[];
  v_rows integer;
  v_accepted integer := 0;
  v_duplicates integer := 0;
  v_rejected integer := 0;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_events) <> 'array' then raise exception 'events must be an array'; end if;
  if jsonb_array_length(p_events) > 200 then raise exception 'too many events'; end if;

  select cm.class_id into v_class_id
  from public.class_members cm
  join public.classrooms c on c.id = cm.class_id
  where cm.student_id = v_user and cm.status = 'active' and not c.archived
  order by cm.joined_at desc limit 1;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    v_event_id := left(coalesce(v_event ->> 'eventId', ''), 180);
    v_event_type := left(coalesce(v_event ->> 'eventType', ''), 40);
    v_attempt_id := nullif(left(coalesce(v_event ->> 'attemptId', ''), 160), '');
    v_experiment_code := nullif(left(coalesce(v_event ->> 'experimentCode', ''), 40), '');
    v_step_key := nullif(left(coalesce(v_event ->> 'stepKey', ''), 100), '');
    v_stage := nullif(left(coalesce(v_event ->> 'stage', ''), 60), '');
    v_occurred_at := public.safe_timestamp(v_event ->> 'occurredAt', now());
    v_error_count := greatest(0, least(3, public.safe_integer(v_event ->> 'stepErrorCount', 0)));
    v_severity := case when v_error_count = 1 then 'green' when v_error_count = 2 then 'orange' when v_error_count >= 3 then 'red' else null end;
    select coalesce(array_agg(distinct tag order by tag), '{}'::text[])
    into v_tags
    from jsonb_array_elements_text(
      case when jsonb_typeof(v_event -> 'tags') = 'array' then v_event -> 'tags' else '[]'::jsonb end
    ) tag
    where tag = any(array[
      '反应物混淆', '仪器用途混淆', '现象混淆',
      '方程式物质错误', '配平错误', '步骤顺序错误'
    ]::text[]);

    if v_event_type = 'identity_updated' then
      v_accepted := v_accepted + 1;
      continue;
    end if;
    if char_length(v_event_id) < 8 or v_event_type <> all(array[
      'attempt_started', 'attempt_abandoned', 'step_error', 'hint_opened',
      'answer_revealed', 'step_completed', 'attempt_completed'
    ]::text[]) then
      v_rejected := v_rejected + 1;
      continue;
    end if;
    if v_attempt_id is null or v_experiment_code is null then
      v_rejected := v_rejected + 1;
      continue;
    end if;

    insert into public.experiment_attempts(
      id, student_id, class_id, experiment_code, module, difficulty,
      app_version, started_at, last_activity_at
    ) values (
      v_attempt_id, v_user, v_class_id, v_experiment_code,
      nullif(left(coalesce(v_event ->> 'module', ''), 30), ''),
      nullif(greatest(0, least(3, public.safe_integer(v_event ->> 'difficulty', 0))), 0),
      left(coalesce(p_client_version, v_event ->> 'appVersion', ''), 80),
      v_occurred_at, v_occurred_at
    )
    on conflict (id) do update set
      last_activity_at = greatest(public.experiment_attempts.last_activity_at, excluded.last_activity_at),
      class_id = coalesce(public.experiment_attempts.class_id, excluded.class_id)
    where public.experiment_attempts.student_id = v_user;

    if not exists (
      select 1 from public.experiment_attempts
      where id = v_attempt_id and student_id = v_user
    ) then
      v_rejected := v_rejected + 1;
      continue;
    end if;

    insert into public.step_events(
      event_id, attempt_id, student_id, class_id, experiment_code, session_id,
      event_type, step_key, stage, step_error_count, severity, tags,
      expected, actual, message, payload, occurred_at
    ) values (
      v_event_id, v_attempt_id, v_user, v_class_id, v_experiment_code,
      nullif(left(coalesce(v_event ->> 'sessionId', ''), 180), ''),
      v_event_type, v_step_key, v_stage,
      case when v_event_type in ('step_error', 'step_completed', 'answer_revealed') then v_error_count else null end,
      case when v_event_type in ('step_error', 'step_completed', 'answer_revealed') then v_severity else null end,
      v_tags,
      case when jsonb_typeof(v_event -> 'expected') in ('object', 'array') then v_event -> 'expected' else null end,
      case when jsonb_typeof(v_event -> 'actual') in ('object', 'array') then v_event -> 'actual' else null end,
      nullif(left(coalesce(v_event ->> 'message', ''), 500), ''),
      v_event - array['identity', 'displayName', 'email', 'studentId', 'classId'],
      v_occurred_at
    ) on conflict (event_id) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      v_duplicates := v_duplicates + 1;
      continue;
    end if;
    v_accepted := v_accepted + 1;

    if v_event_type = 'step_error' then
      update public.experiment_attempts set
        total_errors = total_errors + 1,
        max_step_errors = greatest(max_step_errors, v_error_count),
        needs_redo = needs_redo or v_error_count >= 3,
        last_activity_at = v_occurred_at
      where id = v_attempt_id and student_id = v_user;
      insert into public.step_results(
        attempt_id, step_key, student_id, class_id, experiment_code, stage,
        error_count, severity, tags, updated_at
      ) values (
        v_attempt_id, coalesce(v_step_key, 'unknown'), v_user, v_class_id,
        v_experiment_code, v_stage, v_error_count, v_severity, v_tags, v_occurred_at
      ) on conflict (attempt_id, step_key) do update set
        error_count = greatest(public.step_results.error_count, excluded.error_count),
        severity = case
          when greatest(public.step_results.error_count, excluded.error_count) >= 3 then 'red'
          when greatest(public.step_results.error_count, excluded.error_count) = 2 then 'orange'
          else 'green'
        end,
        tags = public.merge_knowledge_tags(public.step_results.tags, excluded.tags),
        updated_at = greatest(public.step_results.updated_at, excluded.updated_at);
    elsif v_event_type = 'answer_revealed' then
      update public.experiment_attempts set
        answer_revealed_count = answer_revealed_count + 1,
        max_step_errors = greatest(max_step_errors, 3), needs_redo = true,
        last_activity_at = v_occurred_at
      where id = v_attempt_id and student_id = v_user;
      insert into public.step_results(
        attempt_id, step_key, student_id, class_id, experiment_code, stage,
        error_count, severity, tags, answer_revealed, updated_at
      ) values (
        v_attempt_id, coalesce(v_step_key, 'unknown'), v_user, v_class_id,
        v_experiment_code, v_stage, 3, 'red', v_tags, true, v_occurred_at
      ) on conflict (attempt_id, step_key) do update set
        error_count = 3, severity = 'red', answer_revealed = true,
        tags = public.merge_knowledge_tags(public.step_results.tags, excluded.tags),
        updated_at = greatest(public.step_results.updated_at, excluded.updated_at);
    elsif v_event_type = 'step_completed' then
      insert into public.step_results(
        attempt_id, step_key, student_id, class_id, experiment_code, stage,
        error_count, severity, tags, rating, answer_revealed, completed_at, updated_at
      ) values (
        v_attempt_id, coalesce(v_step_key, 'unknown'), v_user, v_class_id,
        v_experiment_code, v_stage, v_error_count, v_severity, v_tags,
        nullif(left(coalesce(v_event ->> 'rating', ''), 20), ''),
        coalesce((v_event ->> 'answerRevealed')::boolean, false), v_occurred_at, v_occurred_at
      ) on conflict (attempt_id, step_key) do update set
        error_count = greatest(public.step_results.error_count, excluded.error_count),
        severity = case
          when greatest(public.step_results.error_count, excluded.error_count) >= 3 then 'red'
          when greatest(public.step_results.error_count, excluded.error_count) = 2 then 'orange'
          when greatest(public.step_results.error_count, excluded.error_count) = 1 then 'green'
          else null
        end,
        tags = public.merge_knowledge_tags(public.step_results.tags, excluded.tags),
        rating = excluded.rating,
        answer_revealed = public.step_results.answer_revealed or excluded.answer_revealed,
        completed_at = excluded.completed_at,
        updated_at = greatest(public.step_results.updated_at, excluded.updated_at);
    elsif v_event_type = 'attempt_completed' then
      update public.experiment_attempts a set
        status = 'completed',
        completed_at = v_occurred_at,
        duration_ms = greatest(0, public.safe_bigint(v_event ->> 'durationMs', 0)),
        total_errors = (select count(*) from public.step_events e where e.attempt_id = v_attempt_id and e.event_type = 'step_error'),
        max_step_errors = coalesce((select max(r.error_count) from public.step_results r where r.attempt_id = v_attempt_id), 0),
        answer_revealed_count = (select count(*) from public.step_events e where e.attempt_id = v_attempt_id and e.event_type = 'answer_revealed'),
        needs_redo = exists (select 1 from public.step_results r where r.attempt_id = v_attempt_id and (r.error_count >= 3 or r.answer_revealed)),
        completion_mode = case
          when exists (select 1 from public.step_events e where e.attempt_id = v_attempt_id and e.event_type = 'answer_revealed') then 'answer'
          when exists (select 1 from public.step_events e where e.attempt_id = v_attempt_id and e.event_type = 'hint_opened') then 'hint'
          else 'independent'
        end,
        last_activity_at = v_occurred_at
      where a.id = v_attempt_id and a.student_id = v_user;
    elsif v_event_type = 'attempt_abandoned' then
      update public.experiment_attempts set
        status = 'abandoned',
        duration_ms = greatest(0, public.safe_bigint(v_event ->> 'durationMs', 0)),
        last_activity_at = v_occurred_at
      where id = v_attempt_id and student_id = v_user and status <> 'completed';
    end if;
  end loop;

  return jsonb_build_object('accepted', v_accepted, 'duplicates', v_duplicates, 'rejected', v_rejected);
end;
$$;

create or replace function public.teacher_class_overview(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total_students integer;
  v_assignment_count integer;
  v_completed_units integer;
  v_participant_students integer;
  v_completed_attempts integer;
  v_answer_attempts integer;
  v_tags jsonb;
  v_common jsonb;
  v_recent jsonb;
begin
  if not public.teacher_owns_class(p_class_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select count(*) into v_total_students from public.class_members where class_id = p_class_id and status = 'active';
  select count(*) into v_assignment_count from public.class_assignments where class_id = p_class_id;
  select count(distinct student_id) into v_participant_students
  from public.experiment_attempts where class_id = p_class_id and status = 'completed';
  select count(*) into v_completed_attempts
  from public.experiment_attempts where class_id = p_class_id and status = 'completed';
  select count(*) into v_answer_attempts
  from public.experiment_attempts where class_id = p_class_id and status = 'completed' and answer_revealed_count > 0;
  select count(*) into v_completed_units from (
    select distinct a.student_id, a.experiment_code
    from public.experiment_attempts a
    join public.class_assignments ca on ca.class_id = a.class_id and ca.experiment_code = a.experiment_code
    where a.class_id = p_class_id and a.status = 'completed'
  ) completed;

  select coalesce(jsonb_agg(row_data.data order by row_data.tag), '[]'::jsonb) into v_tags
  from (
    select tag, jsonb_build_object(
      'tag', tag,
      'green', count(*) filter (where e.severity = 'green'),
      'orange', count(*) filter (where e.severity = 'orange'),
      'red', count(*) filter (where e.severity = 'red'),
      'total', count(*)
    ) as data
    from public.step_events e
    cross join lateral unnest(e.tags) tag
    where e.class_id = p_class_id and e.event_type = 'step_error'
    group by tag
  ) row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) into v_common
  from (
    select tag, e.stage, e.step_key, e.actual, count(*)::integer as occurrences
    from public.step_events e
    cross join lateral unnest(e.tags) tag
    where e.class_id = p_class_id and e.event_type = 'step_error'
    group by tag, e.stage, e.step_key, e.actual
    order by occurrences desc
    limit 12
  ) row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.last_activity_at desc), '[]'::jsonb) into v_recent
  from (
    select a.id as attempt_id, a.student_id, p.display_alias, a.experiment_code,
      coalesce(x.title, a.experiment_code) as experiment_title, a.status,
      a.completion_mode, a.total_errors, a.max_step_errors, a.answer_revealed_count,
      a.needs_redo, a.duration_ms, a.last_activity_at
    from public.experiment_attempts a
    join public.profiles p on p.id = a.student_id
    left join public.experiments x on x.code = a.experiment_code
    where a.class_id = p_class_id
    order by a.last_activity_at desc
    limit 30
  ) row_data;

  return jsonb_build_object(
    'class', (select jsonb_build_object('id', id, 'name', name, 'invite_code', invite_code) from public.classrooms where id = p_class_id),
    'student_count', v_total_students,
    'assignment_count', v_assignment_count,
    'completed_attempts', v_completed_attempts,
    'needs_redo_attempts', (select count(*) from public.experiment_attempts where class_id = p_class_id and needs_redo),
    'completion_basis', case when v_assignment_count > 0 then 'assignments' else 'participation' end,
    'completion_rate', case
      when v_total_students = 0 then 0
      when v_assignment_count > 0 then round(100.0 * v_completed_units / greatest(1, v_total_students * v_assignment_count), 1)
      else round(100.0 * v_participant_students / v_total_students, 1)
    end,
    'answer_reveal_rate', case when v_completed_attempts = 0 then 0 else round(100.0 * v_answer_attempts / v_completed_attempts, 1) end,
    'tag_distribution', v_tags,
    'common_errors', v_common,
    'recent_attempts', v_recent
  );
end;
$$;

create or replace function public.teacher_class_students(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.teacher_owns_class(p_class_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.display_alias), '[]'::jsonb)
  into v_result
  from (
      select p.id as student_id, p.display_alias, cm.joined_at,
        count(distinct a.id) filter (where a.status = 'completed')::integer as completed_count,
        count(distinct a.id) filter (where a.completion_mode = 'answer')::integer as answer_completed_count,
        count(distinct a.id) filter (where a.needs_redo)::integer as needs_redo_count,
        count(e.event_id) filter (where e.severity = 'red')::integer as red_error_count,
        greatest(max(a.last_activity_at), cm.joined_at) as last_active_at
      from public.class_members cm
      join public.profiles p on p.id = cm.student_id
      left join public.experiment_attempts a on a.class_id = cm.class_id and a.student_id = cm.student_id
      left join public.step_events e on e.attempt_id = a.id and e.event_type = 'step_error'
      where cm.class_id = p_class_id and cm.status = 'active'
      group by p.id, p.display_alias, cm.joined_at
  ) row_data;
  return v_result;
end;
$$;

create or replace function public.teacher_attempt_replay(p_attempt_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_attempt public.experiment_attempts;
  v_events jsonb;
begin
  select * into v_attempt from public.experiment_attempts where id = p_attempt_id;
  if v_attempt.id is null or v_attempt.class_id is null or not public.teacher_owns_class(v_attempt.class_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', e.event_id, 'event_type', e.event_type, 'step_key', e.step_key,
    'stage', e.stage, 'step_error_count', e.step_error_count, 'severity', e.severity,
    'tags', e.tags, 'expected', e.expected, 'actual', e.actual,
    'message', e.message, 'payload', e.payload, 'occurred_at', e.occurred_at
  ) order by e.occurred_at, e.received_at), '[]'::jsonb)
  into v_events from public.step_events e where e.attempt_id = p_attempt_id;
  return jsonb_build_object('attempt', to_jsonb(v_attempt), 'events', v_events);
end;
$$;

create or replace function public.student_recommendations(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_redo jsonb;
  v_tags jsonb;
begin
  if auth.uid() <> p_student_id and not public.teacher_can_view_student(p_student_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(latest) order by latest.completed_at desc), '[]'::jsonb) into v_redo
  from (
    select distinct on (a.experiment_code) a.experiment_code,
      coalesce(x.title, a.experiment_code) as title, a.needs_redo,
      a.max_step_errors, a.completed_at
    from public.experiment_attempts a
    left join public.experiments x on x.code = a.experiment_code
    where a.student_id = p_student_id and a.status = 'completed'
    order by a.experiment_code, a.completed_at desc nulls last
  ) latest where latest.needs_redo;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.experiment_count desc), '[]'::jsonb) into v_tags
  from (
    select tag, count(*)::integer as error_count,
      count(distinct e.experiment_code)::integer as experiment_count,
      count(*) filter (where e.severity = 'red')::integer as red_count,
      (count(distinct e.experiment_code) >= 3 or count(*) filter (where e.severity = 'red') > 0) as teacher_attention
    from public.step_events e
    cross join lateral unnest(e.tags) tag
    where e.student_id = p_student_id and e.event_type = 'step_error'
    group by tag
    having count(*) > 0
  ) row_data;
  return jsonb_build_object('redo_experiments', v_redo, 'knowledge_tags', v_tags);
end;
$$;

revoke all on function public.get_my_context() from public, anon;
revoke all on function public.create_class(text) from public, anon;
revoke all on function public.join_class(text) from public, anon;
revoke all on function public.teacher_list_classes() from public, anon;
revoke all on function public.assign_experiment(uuid, text, integer, timestamptz) from public, anon;
revoke all on function public.ingest_learning_events(text, jsonb) from public, anon;
revoke all on function public.teacher_class_overview(uuid) from public, anon;
revoke all on function public.teacher_class_students(uuid) from public, anon;
revoke all on function public.teacher_attempt_replay(text) from public, anon;
revoke all on function public.student_recommendations(uuid) from public, anon;

grant execute on function public.get_my_context() to authenticated;
grant execute on function public.create_class(text) to authenticated;
grant execute on function public.join_class(text) to authenticated;
grant execute on function public.teacher_list_classes() to authenticated;
grant execute on function public.assign_experiment(uuid, text, integer, timestamptz) to authenticated;
grant execute on function public.ingest_learning_events(text, jsonb) to authenticated;
grant execute on function public.teacher_class_overview(uuid) to authenticated;
grant execute on function public.teacher_class_students(uuid) to authenticated;
grant execute on function public.teacher_attempt_replay(text) to authenticated;
grant execute on function public.student_recommendations(uuid) to authenticated;
