import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const studentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  secondName: z.string().min(1, 'Second name is required'),
  thirdName: z.string().optional(),
  parentPhone1: z.string().min(1, 'Primary phone number is required'),
  parentPhone2: z.string().optional(),
  parentFirstName: z.string().min(1, 'Parent first name is required'),
  parentLastName: z.string().min(1, 'Parent last name is required'),
  parentEmail: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  classId: z.string().min(1, 'Class selection is required'),
  dateOfBirth: z.string().optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;

interface StudentFormProps {
  onSuccess: () => void;
}

export function StudentForm({ onSuccess }: StudentFormProps) {
  const [badges, setBadges] = useState<string[]>([]);
  const [newBadge, setNewBadge] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema)
  });

  const selectedClassId = watch('classId');

  const addBadge = () => {
    if (newBadge.trim() && !badges.includes(newBadge.trim())) {
      setBadges([...badges, newBadge.trim()]);
      setNewBadge('');
    }
  };

  const removeBadge = (badge: string) => {
    setBadges(badges.filter(b => b !== badge));
  };

  const onSubmit = async (data: StudentFormData) => {
    setIsSubmitting(true);
    try {
      // Generate admission number
      const { data: lastStudent } = await supabase
        .from('students')
        .select('admission_number')
        .order('created_at', { ascending: false })
        .limit(1);

      let admissionNumber = 'STA001';
      if (lastStudent && lastStudent.length > 0) {
        const lastNumber = parseInt(lastStudent[0].admission_number.slice(3));
        admissionNumber = `STA${(lastNumber + 1).toString().padStart(3, '0')}`;
      }

      // Combine names
      const fullName = `${data.firstName} ${data.secondName}${data.thirdName ? ' ' + data.thirdName : ''}`;
      const parentName = `${data.parentFirstName} ${data.parentLastName}`;

      // Insert student
      const { error } = await supabase
        .from('students')
        .insert({
          full_name: fullName,
          admission_number: admissionNumber,
          class_id: data.classId,
          parent_name: parentName,
          parent_contact: data.parentPhone1,
          parent_email: data.parentEmail || null,
          address: data.address || null,
          date_of_birth: data.dateOfBirth || null
        });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `Student ${fullName} has been added successfully with admission number ${admissionNumber}.`,
      });

      reset();
      setBadges([]);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add student',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="card-premium max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Add New Student</CardTitle>
          <CardDescription>
            Enter the student's complete information below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Student Names */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  {...register('firstName')}
                  className={errors.firstName ? 'border-red-500' : ''}
                />
                {errors.firstName && (
                  <p className="text-sm text-red-500">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondName">Second Name *</Label>
                <Input
                  id="secondName"
                  {...register('secondName')}
                  className={errors.secondName ? 'border-red-500' : ''}
                />
                {errors.secondName && (
                  <p className="text-sm text-red-500">{errors.secondName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="thirdName">Third Name</Label>
                <Input
                  id="thirdName"
                  {...register('thirdName')}
                />
              </div>
            </div>

            {/* Parent Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parentFirstName">Parent First Name *</Label>
                <Input
                  id="parentFirstName"
                  {...register('parentFirstName')}
                  className={errors.parentFirstName ? 'border-red-500' : ''}
                />
                {errors.parentFirstName && (
                  <p className="text-sm text-red-500">{errors.parentFirstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentLastName">Parent Last Name *</Label>
                <Input
                  id="parentLastName"
                  {...register('parentLastName')}
                  className={errors.parentLastName ? 'border-red-500' : ''}
                />
                {errors.parentLastName && (
                  <p className="text-sm text-red-500">{errors.parentLastName.message}</p>
                )}
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parentPhone1">Primary Phone Number *</Label>
                <Input
                  id="parentPhone1"
                  {...register('parentPhone1')}
                  className={errors.parentPhone1 ? 'border-red-500' : ''}
                />
                {errors.parentPhone1 && (
                  <p className="text-sm text-red-500">{errors.parentPhone1.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentPhone2">Secondary Phone Number</Label>
                <Input
                  id="parentPhone2"
                  {...register('parentPhone2')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentEmail">Parent Email</Label>
              <Input
                id="parentEmail"
                type="email"
                {...register('parentEmail')}
                className={errors.parentEmail ? 'border-red-500' : ''}
              />
              {errors.parentEmail && (
                <p className="text-sm text-red-500">{errors.parentEmail.message}</p>
              )}
            </div>

            {/* Student Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classId">Class *</Label>
                {classesLoading ? (
                  <div className="h-10 bg-muted animate-pulse rounded-md"></div>
                ) : (
                  <Select onValueChange={(value) => setValue('classId', value)}>
                    <SelectTrigger className={errors.classId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.classId && (
                  <p className="text-sm text-red-500">{errors.classId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  {...register('dateOfBirth')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                {...register('address')}
                rows={3}
              />
            </div>

            {/* Badges & Titles */}
            <div className="space-y-3">
              <Label>Badges & Titles</Label>
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <Badge key={badge} variant="secondary" className="flex items-center gap-1">
                    {badge}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => removeBadge(badge)}
                    />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add badge (e.g., Prefect, Head Girl, Class Rep)"
                  value={newBadge}
                  onChange={(e) => setNewBadge(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBadge())}
                />
                <Button type="button" variant="outline" onClick={addBadge}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6">
              <Button type="button" variant="outline" onClick={onSuccess}>
                Cancel
              </Button>
              <Button type="submit" className="btn-gold" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding Student...
                  </>
                ) : (
                  'Add Student'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}