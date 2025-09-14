-- Insert classes for the school system
INSERT INTO public.classes (name, teacher_name, capacity) VALUES
-- Nursery Classes
('Nursery 1', 'Mrs. Sarah Johnson', 20),
('Nursery 2', 'Mrs. Mary Adams', 20),
('Nursery 3', 'Mrs. Grace Wilson', 20),

-- Primary Classes
('Class 1', 'Mrs. Jennifer Brown', 25),
('Class 2', 'Mrs. Linda Davis', 25),
('Class 3', 'Mr. Michael Miller', 25),
('Class 4', 'Mrs. Patricia Garcia', 25),
('Class 5', 'Mr. Robert Rodriguez', 25),
('Class 6', 'Mrs. Susan Martinez', 25),

-- Junior Secondary School
('JSS 1', 'Mr. David Anderson', 30),
('JSS 2', 'Mrs. Nancy Thomas', 30),
('JSS 3', 'Mr. Christopher Jackson', 30),

-- Senior Secondary School
('SSS 1', 'Mrs. Karen White', 30),
('SSS 2', 'Mr. Mark Harris', 30),
('SSS 3', 'Mrs. Lisa Clark', 30);

-- Create subjects for different class levels
INSERT INTO public.subjects (name, code, class_id) 
SELECT 
    subject_data.name,
    subject_data.code,
    c.id
FROM (
    VALUES 
    -- Nursery subjects
    ('English Language', 'ENG'),
    ('Mathematics', 'MATH'),
    ('Basic Science', 'BSC'),
    ('Social Studies', 'SS'),
    ('Creative Arts', 'CA'),
    ('Physical Education', 'PE')
) AS subject_data(name, code)
CROSS JOIN public.classes c
WHERE c.name LIKE 'Nursery%' OR c.name LIKE 'Class%';

-- Add more subjects for JSS and SSS
INSERT INTO public.subjects (name, code, class_id)
SELECT 
    subject_data.name,
    subject_data.code,
    c.id
FROM (
    VALUES 
    ('English Language', 'ENG'),
    ('Mathematics', 'MATH'),
    ('Biology', 'BIO'),
    ('Chemistry', 'CHEM'),
    ('Physics', 'PHY'),
    ('Geography', 'GEO'),
    ('History', 'HIST'),
    ('Civic Education', 'CE'),
    ('Economics', 'ECON'),
    ('Agricultural Science', 'AGRIC'),
    ('Technical Drawing', 'TD'),
    ('Computer Studies', 'CS')
) AS subject_data(name, code)
CROSS JOIN public.classes c
WHERE c.name LIKE 'JSS%' OR c.name LIKE 'SSS%';

-- Create fee structures for different class levels
INSERT INTO public.fee_structures (class_id, term, amount, academic_year, description)
SELECT 
    c.id,
    term_data.term,
    CASE 
        WHEN c.name LIKE 'Nursery%' THEN 15000
        WHEN c.name LIKE 'Class%' THEN 20000
        WHEN c.name LIKE 'JSS%' THEN 25000
        WHEN c.name LIKE 'SSS%' THEN 30000
    END as amount,
    '2024/2025',
    CONCAT(term_data.term, ' term fees for ', c.name)
FROM public.classes c
CROSS JOIN (
    VALUES 
    ('first'::term),
    ('second'::term),
    ('third'::term)
) AS term_data(term);

-- Create attendance notification settings table
CREATE TABLE IF NOT EXISTS public.attendance_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id UUID NOT NULL,
    notification_time TIME NOT NULL DEFAULT '14:00:00',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on attendance_notifications
ALTER TABLE public.attendance_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for attendance_notifications
CREATE POLICY "Authenticated users can view attendance notifications" 
ON public.attendance_notifications 
FOR SELECT 
USING (true);

CREATE POLICY "Staff can manage attendance notifications" 
ON public.attendance_notifications 
FOR ALL 
USING (has_role(auth.uid(), 'staff'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

-- Insert default notification settings for all classes
INSERT INTO public.attendance_notifications (class_id, notification_time, is_enabled)
SELECT id, '14:00:00', true FROM public.classes;

-- Create trigger for attendance_notifications updated_at
CREATE TRIGGER update_attendance_notifications_updated_at
BEFORE UPDATE ON public.attendance_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();