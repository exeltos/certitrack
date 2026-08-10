-- Phase 37 read/test queries. Run only in a disposable/local test database after migrations.

-- Inspect notification preferences
select organization_id,user_id,email_enabled,expiry_warning_days
from public.notification_preferences
order by created_at desc;

-- Inspect certificate expiry state
select id,organization_id,title,expiry_date,(expiry_date-current_date) as days_remaining
from public.certificates
where deleted_at is null and expiry_date is not null
order by expiry_date;

-- Service/admin test only:
-- select * from public.ct_generate_expiry_notifications(current_date);

select type,severity,title,entity_id,dedupe_key,created_at
from public.notifications
order by created_at desc
limit 50;

select template_key,recipient_email,status,attempts,dedupe_key,created_at
from public.email_outbox
order by created_at desc
limit 50;

-- Idempotency check:
-- Running ct_generate_expiry_notifications twice for the same date must not increase
-- rows with the same user_id/dedupe_key or email_outbox.dedupe_key.
