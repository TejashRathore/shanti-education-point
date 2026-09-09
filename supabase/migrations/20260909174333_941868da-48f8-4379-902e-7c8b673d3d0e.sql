
-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  class_level INT CHECK (class_level BETWEEN 1 AND 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, class_level)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'class_level', '')::int
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- study materials
CREATE TABLE public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_level INT NOT NULL CHECK (class_level BETWEEN 1 AND 12),
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('pdf','video')),
  url TEXT NOT NULL,
  duration_minutes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials_select_authenticated" ON public.materials FOR SELECT TO authenticated USING (true);
CREATE INDEX materials_class_subject_idx ON public.materials (class_level, subject);

-- chat threads
CREATE TABLE public.chat_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "threads_own" ON public.chat_threads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER chat_threads_updated_at BEFORE UPDATE ON public.chat_threads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_own" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX chat_messages_thread_idx ON public.chat_messages (thread_id, created_at);

-- sample content
INSERT INTO public.materials (class_level, subject, title, description, kind, url, duration_minutes) VALUES
(1,'Mathematics','Numbers 1 to 100 Workbook','Practice sheets for counting, number names and simple addition.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(1,'English','Alphabet and Phonics Reader','Letter sounds with picture words for early readers.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(1,'Mathematics','Counting Fun with Objects','Animated lesson on counting groups of objects.','video','https://www.youtube.com/watch?v=DR-cfDsHCGA',9),
(2,'Mathematics','Addition and Subtraction Practice','Two digit sums with and without carrying.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(2,'EVS','Plants Around Us','Notes on parts of a plant and their uses.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(2,'English','Story Time: The Thirsty Crow','Read-along video with comprehension questions.','video','https://www.youtube.com/watch?v=1TDcRQ0hFqA',7),
(3,'Mathematics','Multiplication Tables 2 to 12','Printable tables with timed practice drills.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(3,'Science','Living and Non-living Things','Chapter notes with activity ideas.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(3,'Mathematics','Understanding Multiplication','Visual explanation using arrays and groups.','video','https://www.youtube.com/watch?v=FJ5qLWP3Fqo',11),
(4,'Mathematics','Fractions Made Easy','Worksheet set on halves, thirds and quarters.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(4,'Social Studies','Our Country India','Maps, states and capitals revision notes.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(4,'Science','States of Matter','Solid, liquid and gas explained with experiments.','video','https://www.youtube.com/watch?v=nkzstgcSDcU',12),
(5,'Mathematics','Decimals and Place Value','Step by step notes with 40 solved examples.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(5,'English','Grammar Essentials: Tenses','Rules and exercises on past, present and future.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(5,'Mathematics','Working with Decimals','Board style lesson on decimal operations.','video','https://www.youtube.com/watch?v=lIRSN7osZBk',14),
(6,'Mathematics','Integers and Number Line','Complete chapter with practice questions.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(6,'Science','Food and Its Components','Nutrients, deficiency diseases and balanced diet.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(6,'Mathematics','Introduction to Algebra','Understanding variables and expressions.','video','https://www.youtube.com/watch?v=NybHckSEQBI',16),
(7,'Mathematics','Simple Equations','Solving linear equations in one variable.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(7,'Science','Heat and Temperature','Conduction, convection and radiation notes.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(7,'Science','Acids, Bases and Salts','Lab demonstration with indicators.','video','https://www.youtube.com/watch?v=fsWc3IAjk_A',15),
(8,'Mathematics','Squares, Cubes and Roots','Shortcut methods and 60 practice sums.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(8,'Science','Force, Friction and Pressure','Chapter notes with numerical problems.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(8,'Mathematics','Linear Equations Explained','Solved examples for board style questions.','video','https://www.youtube.com/watch?v=Ft2_QtXAnh8',18),
(9,'Mathematics','Polynomials Complete Notes','Factor theorem, remainder theorem and identities.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(9,'Science','Motion and Laws of Motion','Derivations plus 50 numericals with answers.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(9,'Mathematics','Coordinate Geometry Basics','Plotting points and distance formula.','video','https://www.youtube.com/watch?v=VhNkWdLGpmA',20),
(10,'Mathematics','Quadratic Equations Master Notes','All methods with previous year questions.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(10,'Science','Chemical Reactions and Equations','Balancing, types and everyday chemistry.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(10,'Mathematics','Trigonometry Crash Course','Ratios, identities and height and distance sums.','video','https://www.youtube.com/watch?v=PUB0TaZ7bhA',22),
(11,'Mathematics','Sets, Relations and Functions','Detailed theory with solved illustrations.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(11,'Physics','Kinematics and Vectors','Concept notes with graphs and problems.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(11,'Chemistry','Mole Concept Simplified','Stoichiometry worked out step by step.','video','https://www.youtube.com/watch?v=Ru4EIfWs7Wo',24),
(12,'Mathematics','Calculus: Limits and Derivatives','Formula sheet with 80 solved problems.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(12,'Physics','Current Electricity','Circuits, Kirchhoff laws and numericals.','pdf','https://www.africau.edu/images/default/sample.pdf',NULL),
(12,'Mathematics','Integration Techniques','Substitution, by parts and partial fractions.','video','https://www.youtube.com/watch?v=o75AqTInKDU',26);
