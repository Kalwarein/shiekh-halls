
-- Clear dependent data first so we can replace classes
UPDATE public.students SET class_id = NULL;
DELETE FROM public.report_cards;
DELETE FROM public.attendance;
DELETE FROM public.fee_payments;
DELETE FROM public.subjects;
DELETE FROM public.classes;

-- Insert Sierra Leone class structure
INSERT INTO public.classes (name, level) VALUES
  ('Nursery 1', 'Nursery'),
  ('Nursery 2', 'Nursery'),
  ('Nursery 3', 'Nursery'),
  ('Primary 1', 'Primary'),
  ('Primary 2', 'Primary'),
  ('Primary 3', 'Primary'),
  ('Primary 4', 'Primary'),
  ('Primary 5', 'Primary'),
  ('Primary 6', 'Primary'),
  ('JSS 1', 'Junior Secondary'),
  ('JSS 2', 'Junior Secondary'),
  ('JSS 3', 'Junior Secondary'),
  ('SSS 1', 'Senior Secondary'),
  ('SSS 2', 'Senior Secondary'),
  ('SSS 3', 'Senior Secondary');
