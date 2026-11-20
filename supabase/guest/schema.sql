create schema ww_guest;
revoke all on schema ww_guest from public, anon, authenticated;
grant usage on schema ww_guest to service_role;

create unlogged table ww_guest.challenges (
  id uuid primary key, mail text not null, proof text not null,
  expires timestamptz not null default now() + interval '10 minutes',
  attempts smallint not null default 0
);
create unlogged table ww_guest.requests (
  mail text not null, network text not null, sent timestamptz not null default now()
);
create unlogged table ww_guest.sessions (
  token text primary key, mail text not null, idle_until timestamptz not null,
  ends timestamptz not null default now() + interval '4 hours'
);
alter table ww_guest.challenges enable row level security;
alter table ww_guest.requests enable row level security;
alter table ww_guest.sessions enable row level security;
grant select,insert,update,delete on all tables in schema ww_guest to service_role;

create function public.ww_guest_issue(p_id uuid, p_mail text, p_network text, p_proof text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(590236109);
  if exists(select from ww_guest.requests where mail=p_mail and sent > now()-interval '1 minute')
    or (select count(*) from ww_guest.requests where mail=p_mail and sent > now()-interval '1 hour') >= 5
    or (select count(*) from ww_guest.requests where network=p_network and sent > now()-interval '1 hour') >= 15
    or (select count(*) from ww_guest.requests where sent > now()-interval '24 hours') >= 80 then
    return false;
  end if;
  insert into ww_guest.requests(mail,network) values(p_mail,p_network);
  insert into ww_guest.challenges(id,mail,proof) values(p_id,p_mail,p_proof);
  return true;
end $$;

create function public.ww_guest_discard(p_id uuid, p_mail text) returns void
language sql security invoker set search_path='' as $$
  delete from ww_guest.challenges where id=p_id and mail=p_mail;
$$;

create function public.ww_guest_verify(p_id uuid,p_mail text,p_proof text,p_token text)
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare c ww_guest.challenges; until_time timestamptz := now() + interval '30 minutes';
begin
  select * into c from ww_guest.challenges where id=p_id and mail=p_mail for update;
  if not found or c.expires <= now() or c.attempts >= 5 then return null; end if;
  if c.proof <> p_proof then
    update ww_guest.challenges set attempts=attempts+1 where id=p_id;
    return null;
  end if;
  delete from ww_guest.challenges where id=p_id;
  insert into ww_guest.sessions(token,mail,idle_until) values(p_token,p_mail,until_time);
  return until_time;
end $$;

create function public.ww_guest_session(p_token text,p_mail text,p_end boolean)
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare until_time timestamptz;
begin
  if p_end then
    delete from ww_guest.sessions where token=p_token and mail=p_mail and idle_until > now() and ends > now()
      returning idle_until into until_time;
  else
    update ww_guest.sessions set idle_until=least(now()+interval '30 minutes',ends)
      where token=p_token and mail=p_mail and idle_until > now() and ends > now() returning idle_until into until_time;
  end if;
  return until_time;
end $$;

revoke all on function public.ww_guest_issue(uuid,text,text,text), public.ww_guest_discard(uuid,text),
  public.ww_guest_verify(uuid,text,text,text), public.ww_guest_session(text,text,boolean) from public,anon,authenticated;
grant execute on function public.ww_guest_issue(uuid,text,text,text), public.ww_guest_discard(uuid,text),
  public.ww_guest_verify(uuid,text,text,text), public.ww_guest_session(text,text,boolean) to service_role;

create extension if not exists pg_cron;
select cron.schedule('ww-guest-expiry','*/5 * * * *',$job$
  delete from ww_guest.challenges where expires <= now() or attempts >= 5;
  delete from ww_guest.sessions where idle_until <= now() or ends <= now();
  delete from ww_guest.requests where sent <= now()-interval '24 hours';
$job$);
