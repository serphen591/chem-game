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

revoke all on function public.teacher_attempt_replay(text) from public, anon;
grant execute on function public.teacher_attempt_replay(text) to authenticated;
