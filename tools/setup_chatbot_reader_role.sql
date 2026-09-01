-- Create ReadOnly role chatbot_reader
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'chatbot_reader') THEN
    CREATE ROLE chatbot_reader WITH LOGIN PASSWORD 'ChatBotReadOnly2026!Sec';
  ELSE
    ALTER ROLE chatbot_reader WITH LOGIN PASSWORD 'ChatBotReadOnly2026!Sec';
  END IF;
END
$$;

REVOKE ALL ON SCHEMA public FROM chatbot_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM chatbot_reader;

GRANT USAGE ON SCHEMA attendance TO chatbot_reader;
GRANT SELECT ON attendance.daily_summary TO chatbot_reader;
GRANT SELECT ON attendance.employee TO chatbot_reader;
GRANT SELECT ON attendance.shift TO chatbot_reader;
GRANT SELECT ON attendance.calendar_day TO chatbot_reader;

REVOKE ALL ON attendance.event FROM chatbot_reader;
REVOKE ALL ON attendance.exception FROM chatbot_reader;

ALTER ROLE chatbot_reader SET default_transaction_read_only = on;
ALTER ROLE chatbot_reader SET statement_timeout = '3000ms';
ALTER ROLE chatbot_reader SET lock_timeout = '500ms';
