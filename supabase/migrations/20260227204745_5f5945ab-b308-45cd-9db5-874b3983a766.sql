
-- Add new columns to fee_structures for structured fee breakdown
ALTER TABLE public.fee_structures 
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id),
  ADD COLUMN IF NOT EXISTS tuition_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exam_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add gender and status columns to students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
