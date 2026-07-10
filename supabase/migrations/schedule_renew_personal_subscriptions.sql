create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  current_job_id bigint;
begin
  for current_job_id in
    select jobid
    from cron.job
    where jobname = 'renew-personal-subscriptions-every-15-minutes'
  loop
    perform cron.unschedule(current_job_id);
  end loop;

  perform cron.schedule(
    'renew-personal-subscriptions-every-15-minutes',
    '*/15 * * * *',
    $job$
      select
        net.http_post(
          url := 'https://cdtouwfxwuhnlzqhcagy.supabase.co/functions/v1/renew-personal-subscriptions',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', 'a2b069e19dc849538d3ca529e0b2bc5296c368245dba4e319ba112e1ae08b2ec'
          ),
          body := jsonb_build_object(
            'limit', 25
          )
        );
    $job$
  );
end
$$;
