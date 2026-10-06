-- ============================================================================
-- MINDMAZE - SUPABASE DATABASE SCHEMA & SECURITY
-- TANTRA 2026 | Presented by ENIGMA
--
-- IMPORTANT:
-- Run this script in Supabase SQL Editor before connecting the frontend.
-- It replaces the earlier MINDMAZE schema. It is intended for setup before
-- the competition goes live. Running it deletes existing MINDMAZE data.
-- ============================================================================

-- 1. Clean previous MINDMAZE objects
DROP VIEW IF EXISTS public.leaderboard_view;
DROP FUNCTION IF EXISTS public.submit_quiz_attempt(UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.submit_quiz_attempt(UUID, JSONB, INT);
DROP FUNCTION IF EXISTS public.start_quiz_session(UUID, TEXT);
DROP FUNCTION IF EXISTS public.register_participant(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.is_mindmaze_admin();
DROP TABLE IF EXISTS public.attempts CASCADE;
DROP TABLE IF EXISTS public.participants CASCADE;

-- 2. Participants
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  college TEXT NOT NULL CHECK (length(trim(college)) BETWEEN 2 AND 200),
  phone TEXT NOT NULL UNIQUE CHECK (length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 7),
  access_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  quiz_started_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Official attempts
CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID UNIQUE NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 20),
  total_questions INT NOT NULL DEFAULT 20 CHECK (total_questions = 20),
  correct_count INT NOT NULL CHECK (correct_count BETWEEN 0 AND 20),
  wrong_count INT NOT NULL CHECK (wrong_count BETWEEN 0 AND 20),
  unanswered_count INT NOT NULL CHECK (unanswered_count BETWEEN 0 AND 20),
  accuracy NUMERIC(5,2) NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  time_taken_seconds INT NOT NULL CHECK (time_taken_seconds BETWEEN 0 AND 900),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attempts_counts_sum_20 CHECK (correct_count + wrong_count + unanswered_count = 20)
);

CREATE INDEX idx_attempts_leaderboard
  ON public.attempts(score DESC, time_taken_seconds ASC);
CREATE INDEX idx_participants_phone
  ON public.participants(phone);

-- 4. Public leaderboard view: ONLY non-sensitive fields are exposed.
CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT
  DENSE_RANK() OVER (ORDER BY a.score DESC, a.time_taken_seconds ASC) AS rank,
  p.name AS participant_name,
  p.college AS participant_college,
  a.score,
  a.total_questions,
  a.accuracy,
  a.time_taken_seconds,
  a.submitted_at
FROM public.attempts AS a
JOIN public.participants AS p ON p.id = a.participant_id
ORDER BY a.score DESC, a.time_taken_seconds ASC;

-- 5. Admin check. The user's Supabase Auth app_metadata must contain role=admin.
CREATE OR REPLACE FUNCTION public.is_mindmaze_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- 6. Secure registration RPC.
-- Anonymous users can call this function but cannot SELECT the participants table.
CREATE OR REPLACE FUNCTION public.register_participant(
  p_name TEXT,
  p_college TEXT,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_token TEXT;
  v_name TEXT;
  v_college TEXT;
  v_phone TEXT;
  v_clean_phone TEXT;
BEGIN
  v_name := trim(p_name);
  v_college := trim(p_college);
  v_clean_phone := trim(p_phone);

  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Please enter a valid full name.';
  END IF;
  IF length(v_college) < 2 OR length(v_college) > 200 THEN
    RAISE EXCEPTION 'Please enter a valid college/institution.';
  END IF;
  IF length(regexp_replace(v_clean_phone, '[^0-9]', '', 'g')) < 7 THEN
    RAISE EXCEPTION 'Please enter a valid phone number.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.participants WHERE phone = v_clean_phone) THEN
    RAISE EXCEPTION 'This phone number is already registered for MINDMAZE.';
  END IF;

  INSERT INTO public.participants (name, college, phone)
  VALUES (v_name, v_college, v_clean_phone)
  RETURNING id, access_token, name, college, phone
  INTO v_id, v_token, v_name, v_college, v_phone;

  -- The token is returned ONCE to the browser that registered.
  -- It is not exposed by any public SELECT policy or leaderboard view.
  RETURN jsonb_build_object(
    'id', v_id,
    'accessToken', v_token,
    'name', v_name,
    'college', v_college,
    'phone', v_phone
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'This phone number is already registered for MINDMAZE.';
END;
$$;

-- 7. Start/resume the official server-side quiz clock.
CREATE OR REPLACE FUNCTION public.start_quiz_session(
  p_participant_id UUID,
  p_access_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
BEGIN
  SELECT quiz_started_at
  INTO v_started_at
  FROM public.participants
  WHERE id = p_participant_id AND access_token = p_access_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid participant session. Please register again.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.attempts WHERE participant_id = p_participant_id) THEN
    RAISE EXCEPTION 'Attempt already submitted. Only one official attempt is allowed.';
  END IF;

  IF v_started_at IS NULL THEN
    UPDATE public.participants
    SET quiz_started_at = now()
    WHERE id = p_participant_id AND access_token = p_access_token
    RETURNING quiz_started_at INTO v_started_at;
  END IF;

  RETURN jsonb_build_object('startedAt', v_started_at);
END;
$$;

-- 8. Secure server-side score calculator.
-- The client sends only raw answers + its private participant token.
-- The server calculates the official score AND official elapsed time.
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_participant_id UUID,
  p_access_token TEXT,
  p_user_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INT := 0;
  v_correct INT := 0;
  v_wrong INT := 0;
  v_unanswered INT := 0;
  v_total INT := 20;
  v_accuracy NUMERIC(5,2);
  v_started_at TIMESTAMPTZ;
  v_time_taken INT;
  v_existing_attempt_id UUID;
  v_result JSONB;
  v_answer_key JSONB := '{
    "1": "3 km",
    "2": "GPS",
    "3": "No Bloops are Lazzies",
    "4": "429",
    "5": "12",
    "6": "France",
    "7": "NFC",
    "8": "42",
    "9": "Machine Learning",
    "10": "Millimetre-wave frequency bands",
    "11": "Challenger Deep",
    "12": "Queue",
    "13": "12",
    "14": "Ethiopia",
    "15": "Event horizon",
    "16": "Network",
    "17": "DDoS",
    "18": "Japan",
    "19": "Silicon",
    "20": "Anode"
  }'::jsonb;
  v_q_id TEXT;
  v_user_ans TEXT;
  v_correct_ans TEXT;
BEGIN
  SELECT quiz_started_at
  INTO v_started_at
  FROM public.participants
  WHERE id = p_participant_id AND access_token = p_access_token;

  IF NOT FOUND OR v_started_at IS NULL THEN
    RAISE EXCEPTION 'Invalid participant session or quiz has not been started.';
  END IF;

  SELECT id INTO v_existing_attempt_id
  FROM public.attempts
  WHERE participant_id = p_participant_id;

  IF v_existing_attempt_id IS NOT NULL THEN
    RAISE EXCEPTION 'Attempt already submitted. Only one official attempt is allowed.';
  END IF;

  -- Server-authoritative elapsed time. The browser cannot choose a fake time.
  v_time_taken := LEAST(900, GREATEST(0,
    FLOOR(EXTRACT(EPOCH FROM (now() - v_started_at)))::INT
  ));

  -- Official answer key lives only on the server.
  FOR i IN 1..v_total LOOP
    v_q_id := i::TEXT;
    v_user_ans := p_user_answers ->> v_q_id;
    v_correct_ans := v_answer_key ->> v_q_id;

    IF v_user_ans IS NULL OR v_user_ans = '' THEN
      v_unanswered := v_unanswered + 1;
    ELSIF v_user_ans = v_correct_ans THEN
      v_score := v_score + 1;
      v_correct := v_correct + 1;
    ELSE
      v_wrong := v_wrong + 1;
    END IF;
  END LOOP;

  v_accuracy := ROUND((v_score::NUMERIC / v_total::NUMERIC) * 100, 2);

  INSERT INTO public.attempts (
    participant_id,
    score,
    total_questions,
    correct_count,
    wrong_count,
    unanswered_count,
    accuracy,
    time_taken_seconds
  ) VALUES (
    p_participant_id,
    v_score,
    v_total,
    v_correct,
    v_wrong,
    v_unanswered,
    v_accuracy,
    v_time_taken
  );

  v_result := jsonb_build_object(
    'score', v_score,
    'totalQuestions', v_total,
    'correct', v_correct,
    'wrong', v_wrong,
    'unanswered', v_unanswered,
    'accuracy', v_accuracy,
    'timeTakenSeconds', v_time_taken
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Attempt already submitted. Only one official attempt is allowed.';
END;
$$;

-- 9. RLS: tables are NEVER directly writable/readable by public participants.
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- No anon SELECT/INSERT/UPDATE/DELETE policies exist on these tables.
-- Only SECURITY DEFINER RPCs can register/start/submit.

CREATE POLICY "MINDMAZE admin participants access"
  ON public.participants
  FOR ALL TO authenticated
  USING (public.is_mindmaze_admin())
  WITH CHECK (public.is_mindmaze_admin());

CREATE POLICY "MINDMAZE admin attempts access"
  ON public.attempts
  FOR ALL TO authenticated
  USING (public.is_mindmaze_admin())
  WITH CHECK (public.is_mindmaze_admin());

-- 10. Explicit permissions.
GRANT EXECUTE ON FUNCTION public.is_mindmaze_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_participant(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_quiz_session(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(UUID, TEXT, JSONB) TO anon, authenticated;
GRANT SELECT ON public.leaderboard_view TO anon, authenticated;

-- Do not grant direct table access to anon/authenticated.
REVOKE ALL ON TABLE public.participants FROM anon, authenticated;
REVOKE ALL ON TABLE public.attempts FROM anon, authenticated;

-- Admin users can access the tables through their RLS policy.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attempts TO authenticated;
