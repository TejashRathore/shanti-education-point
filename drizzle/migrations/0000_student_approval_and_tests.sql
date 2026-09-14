-- 1. Student approval gate
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- existing accounts keep their access
UPDATE public.profiles SET approval_status = 'approved', approved_at = now() WHERE approval_status = 'pending';

CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, class_level, approval_status, approved_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'class_level', '')::int,
    CASE WHEN lower(NEW.email) = 'p79152939@gmail.com' THEN 'approved' ELSE 'pending' END,
    CASE WHEN lower(NEW.email) = 'p79152939@gmail.com' THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'p79152939@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;

-- 2. Tests
CREATE TABLE public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  class_level integer NOT NULL,
  subject text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes integer,
  published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tests TO authenticated;
GRANT ALL ON public.tests TO service_role;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tests_select_authenticated ON public.tests FOR SELECT TO authenticated USING (true);
CREATE POLICY tests_admin_all ON public.tests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER tests_updated_at BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'mcq',
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_option integer,
  marks integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_questions TO authenticated;
GRANT ALL ON public.test_questions TO service_role;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
-- correct answers stay hidden from students; papers are served by a server function
CREATE POLICY test_questions_admin_all ON public.test_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX test_questions_test_idx ON public.test_questions (test_id, position);

CREATE TABLE public.test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  auto_score integer NOT NULL DEFAULT 0,
  manual_score integer NOT NULL DEFAULT 0,
  total_marks integer NOT NULL DEFAULT 0,
  fully_graded boolean NOT NULL DEFAULT false,
  UNIQUE (test_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.test_attempts TO authenticated;
GRANT ALL ON public.test_attempts TO service_role;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY attempts_select_own_or_admin ON public.test_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY attempts_admin_update ON public.test_attempts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.test_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
  selected_option integer,
  written_text text NOT NULL DEFAULT '',
  awarded_marks integer NOT NULL DEFAULT 0,
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.test_answers TO authenticated;
GRANT ALL ON public.test_answers TO service_role;
ALTER TABLE public.test_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY answers_select_own_or_admin ON public.test_answers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid())
  );
CREATE POLICY answers_admin_update ON public.test_answers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX test_answers_attempt_idx ON public.test_answers (attempt_id);