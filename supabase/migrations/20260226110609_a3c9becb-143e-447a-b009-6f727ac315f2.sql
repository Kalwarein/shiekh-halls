
-- 1. Create academic_years table
CREATE TABLE public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view academic_years" ON public.academic_years
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage academic_years" ON public.academic_years
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_academic_years_updated_at
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add is_active and updated_at to subjects
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add academic_year_id to tables
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id);

ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id);

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id);

ALTER TABLE public.report_cards
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id);

-- 4. Unique constraint: prevent duplicate subject grading per student/subject/term/year
ALTER TABLE public.report_cards
  ADD CONSTRAINT unique_student_subject_term_year 
  UNIQUE (student_id, subject_id, term, academic_year);

-- 5. Unique constraint: prevent duplicate subjects per class
ALTER TABLE public.subjects
  ADD CONSTRAINT unique_subject_per_class UNIQUE (name, class_id);

-- 6. Insert default academic year
INSERT INTO public.academic_years (name, is_active) VALUES ('2025-2026', true);
