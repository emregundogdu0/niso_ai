-- Phase 08: Attendance Schema, Tables, and Daily Summary View

CREATE SCHEMA IF NOT EXISTS attendance;

-- 1. Employee Table
CREATE TABLE IF NOT EXISTS attendance.employee (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_no TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Shift Table
CREATE TABLE IF NOT EXISTS attendance.shift (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_minutes INTEGER NOT NULL DEFAULT 15,
    is_night_shift BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Employee Shift Mapping Table
CREATE TABLE IF NOT EXISTS attendance.employee_shift (
    id SERIAL PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES attendance.employee(id) ON DELETE CASCADE,
    shift_id INTEGER NOT NULL REFERENCES attendance.shift(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL,
    valid_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_employee_shift_period UNIQUE (employee_id, shift_id, valid_from)
);

-- 4. Calendar Day Table
CREATE TABLE IF NOT EXISTS attendance.calendar_day (
    day DATE PRIMARY KEY,
    is_workday BOOLEAN NOT NULL,
    is_holiday BOOLEAN NOT NULL DEFAULT false,
    description TEXT NOT NULL DEFAULT 'İş Günü'
);

-- 5. Exception (Leaves, Remote, Sickness) Table
CREATE TABLE IF NOT EXISTS attendance.exception (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES attendance.employee(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    exception_type TEXT NOT NULL, -- 'ANNUAL_LEAVE', 'REMOTE_WORK', 'SICK_LEAVE', 'OFFICIAL_DUTY', 'MATERNITY_LEAVE'
    approved BOOLEAN NOT NULL DEFAULT true,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_employee_exception UNIQUE (employee_id, start_at, end_at, exception_type)
);

-- 6. Turnstile / Portal Event Table
CREATE TABLE IF NOT EXISTS attendance.event (
    id BIGSERIAL PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES attendance.employee(id) ON DELETE CASCADE,
    event_time TIMESTAMPTZ NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('IN', 'OUT')),
    source_device TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_attendance_event UNIQUE (employee_id, event_time, event_type)
);

CREATE INDEX IF NOT EXISTS idx_event_emp_time ON attendance.event (employee_id, event_time);
CREATE INDEX IF NOT EXISTS idx_event_time ON attendance.event (event_time);

-- 7. Daily Summary View (with night shift support and holiday/exception protection)
CREATE OR REPLACE VIEW attendance.daily_summary AS
WITH base_days AS (
    SELECT 
        c.day,
        c.is_workday,
        c.is_holiday,
        c.description AS day_description,
        e.id AS employee_id,
        e.employee_no,
        e.full_name,
        e.department,
        e.active AS employee_active,
        COALESCE(s.name, 'Gündüz Standart') AS shift_name,
        COALESCE(s.start_time, '08:30:00'::time) AS shift_start,
        COALESCE(s.end_time, '17:30:00'::time) AS shift_end,
        COALESCE(s.grace_minutes, 15) AS grace_minutes,
        COALESCE(s.is_night_shift, false) AS is_night_shift
    FROM attendance.calendar_day c
    CROSS JOIN attendance.employee e
    LEFT JOIN LATERAL (
        SELECT es.shift_id, sh.name, sh.start_time, sh.end_time, sh.grace_minutes, sh.is_night_shift
        FROM attendance.employee_shift es
        JOIN attendance.shift sh ON es.shift_id = sh.id
        WHERE es.employee_id = e.id
          AND es.valid_from <= c.day
          AND (es.valid_to IS NULL OR es.valid_to >= c.day)
        ORDER BY es.valid_from DESC
        LIMIT 1
    ) s ON true
    WHERE e.active = true
),
day_events AS (
    SELECT 
        b.day,
        b.employee_id,
        MIN(CASE WHEN ev.event_type = 'IN' THEN ev.event_time END) AS first_in,
        MAX(CASE WHEN ev.event_type = 'OUT' THEN ev.event_time END) AS last_out,
        COUNT(ev.id) AS total_events,
        COUNT(CASE WHEN ev.event_type = 'IN' THEN 1 END) AS in_count,
        COUNT(CASE WHEN ev.event_type = 'OUT' THEN 1 END) AS out_count,
        MAX(ev.source_device) AS last_device
    FROM base_days b
    LEFT JOIN attendance.event ev ON ev.employee_id = b.employee_id
      AND ev.event_time >= (
          CASE 
              WHEN b.is_night_shift THEN (b.day::text || ' 18:00:00 Europe/Istanbul')::timestamptz
              ELSE (b.day::text || ' 00:00:00 Europe/Istanbul')::timestamptz
          END
      )
      AND ev.event_time < (
          CASE 
              WHEN b.is_night_shift THEN ((b.day + INTERVAL '1 day')::date::text || ' 12:00:00 Europe/Istanbul')::timestamptz
              ELSE ((b.day + INTERVAL '1 day')::date::text || ' 04:00:00 Europe/Istanbul')::timestamptz
          END
      )
    GROUP BY b.day, b.employee_id
),
day_exceptions AS (
    SELECT 
        b.day,
        b.employee_id,
        bool_or(ex.approved) AS has_approved_exception,
        STRING_AGG(DISTINCT ex.exception_type, ', ') AS exception_types
    FROM base_days b
    LEFT JOIN attendance.exception ex ON ex.employee_id = b.employee_id
      AND ex.approved = true
      AND ex.start_at <= (b.day::text || ' 23:59:59 Europe/Istanbul')::timestamptz
      AND ex.end_at >= (b.day::text || ' 00:00:00 Europe/Istanbul')::timestamptz
    GROUP BY b.day, b.employee_id
)
SELECT 
    b.day,
    b.employee_id,
    b.employee_no,
    b.full_name,
    b.department,
    b.shift_name,
    b.shift_start,
    b.shift_end,
    b.grace_minutes,
    b.is_night_shift,
    b.is_workday,
    b.is_holiday,
    b.day_description,
    e.first_in,
    e.last_out,
    COALESCE(e.total_events, 0) AS total_events,
    COALESCE(x.has_approved_exception, false) AS has_approved_exception,
    x.exception_types,
    -- Worked Minutes
    CASE 
        WHEN e.first_in IS NOT NULL AND e.last_out IS NOT NULL AND e.last_out >= e.first_in THEN
            ROUND(EXTRACT(EPOCH FROM (e.last_out - e.first_in)) / 60)::integer
        ELSE 0
    END AS worked_minutes,
    -- Late Minutes (0 if weekend, holiday, approved exception, or on time)
    CASE 
        WHEN NOT b.is_workday OR b.is_holiday OR COALESCE(x.has_approved_exception, false) THEN 0
        WHEN e.first_in IS NULL THEN 0 -- Devamsız (LATE değil ABSENT)
        ELSE
            GREATEST(
                0,
                ROUND(
                    EXTRACT(EPOCH FROM (
                        e.first_in - 
                        ((b.day::text || ' ' || b.shift_start::text || ' Europe/Istanbul')::timestamptz + (b.grace_minutes || ' minutes')::interval)
                    )) / 60
                )::integer
            )
    END AS late_minutes,
    -- Early Exit Minutes
    CASE 
        WHEN NOT b.is_workday OR b.is_holiday OR COALESCE(x.has_approved_exception, false) THEN 0
        WHEN e.last_out IS NULL THEN 0
        ELSE
            GREATEST(
                0,
                ROUND(
                    EXTRACT(EPOCH FROM (
                        (b.day::text || ' ' || b.shift_end::text || ' Europe/Istanbul')::timestamptz - e.last_out
                    )) / 60
                )::integer
            )
    END AS early_exit_minutes,
    -- Missing Checkout Flag
    CASE 
        WHEN e.first_in IS NOT NULL AND e.last_out IS NULL THEN true
        ELSE false
    END AS missing_checkout,
    -- Status Evaluation
    CASE 
        WHEN b.is_holiday THEN 'HOLIDAY'
        WHEN NOT b.is_workday THEN 'WEEKEND'
        WHEN COALESCE(x.has_approved_exception, false) THEN 
            CASE 
                WHEN x.exception_types ILIKE '%REMOTE%' THEN 'REMOTE'
                ELSE 'ON_LEAVE'
            END
        WHEN e.first_in IS NULL THEN 'ABSENT'
        WHEN e.first_in IS NOT NULL AND e.last_out IS NULL THEN 'MISSING_CHECKOUT'
        WHEN (
            EXTRACT(EPOCH FROM (
                e.first_in - 
                ((b.day::text || ' ' || b.shift_start::text || ' Europe/Istanbul')::timestamptz + (b.grace_minutes || ' minutes')::interval)
            )) / 60
        ) > 0 THEN 'LATE'
        ELSE 'ON_TIME'
    END AS status
FROM base_days b
LEFT JOIN day_events e ON b.day = e.day AND b.employee_id = e.employee_id
LEFT JOIN day_exceptions x ON b.day = x.day AND b.employee_id = x.employee_id;
