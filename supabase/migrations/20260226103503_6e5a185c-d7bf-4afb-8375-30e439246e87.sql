
-- Create classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage classes" ON public.classes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  admission_number TEXT UNIQUE,
  class_id UUID REFERENCES public.classes(id),
  date_of_birth DATE,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  address TEXT,
  badges TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage students" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(code, class_id)
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage subjects" ON public.subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  is_present BOOLEAN NOT NULL DEFAULT true,
  remarks TEXT,
  marked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage attendance" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create fee_structures table
CREATE TABLE public.fee_structures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES public.classes(id),
  fee_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  term TEXT,
  academic_year TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view fee_structures" ON public.fee_structures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage fee_structures" ON public.fee_structures FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create fee_payments table
CREATE TABLE public.fee_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_structure_id UUID REFERENCES public.fee_structures(id),
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  receipt_number TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view fee_payments" ON public.fee_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage fee_payments" ON public.fee_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create report_cards table
CREATE TABLE public.report_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id),
  term TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  score NUMERIC,
  grade TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view report_cards" ON public.report_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage report_cards" ON public.report_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create attendance_notifications table
CREATE TABLE public.attendance_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view notifications" ON public.attendance_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage notifications" ON public.attendance_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_report_cards_updated_at BEFORE UPDATE ON public.report_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert seed data for classes
INSERT INTO public.classes (name, level) VALUES
  ('Nursery 1', 'Nursery'),
  ('Nursery 2', 'Nursery'),
  ('Primary 1', 'Primary'),
  ('Primary 2', 'Primary'),
  ('Primary 3', 'Primary'),
  ('Primary 4', 'Primary'),
  ('Primary 5', 'Primary'),
  ('Primary 6', 'Primary');
