import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, Check, X, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AttendanceEntryProps {
  onSuccess: () => void;
}

export function AttendanceEntry({ onSuccess }: AttendanceEntryProps) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('');
  const [dailyDescription, setDailyDescription] = useState('');
  const [attendance, setAttendance] = useState<{ [key: string]: boolean }>({});
  const [remarks, setRemarks] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch classes
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

  // Fetch students for selected class
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, admission_number')
        .eq('class_id', selectedClass)
        .order('full_name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClass
  });

  // Check existing attendance for the date
  const { data: existingAttendance } = useQuery({
    queryKey: ['attendance', selectedDate, selectedClass],
    queryFn: async () => {
      if (!selectedClass || !selectedDate) return [];
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('attendance_date', selectedDate)
        .in('student_id', students?.map(s => s.id) || []);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClass && !!selectedDate && !!students
  });

  // Initialize attendance when students or existing attendance changes
  React.useEffect(() => {
    if (students) {
      const newAttendance: { [key: string]: boolean } = {};
      const newRemarks: { [key: string]: string } = {};
      
      students.forEach(student => {
        const existing = existingAttendance?.find(a => a.student_id === student.id);
        newAttendance[student.id] = existing ? existing.is_present : true;
        newRemarks[student.id] = existing ? existing.remarks || '' : '';
      });
      
      setAttendance(newAttendance);
      setRemarks(newRemarks);
    }
  }, [students, existingAttendance]);

  // Save attendance mutation
  const saveAttendance = useMutation({
    mutationFn: async () => {
      if (!students || !selectedDate) return;

      // Delete existing attendance for this date and class
      await supabase
        .from('attendance')
        .delete()
        .eq('attendance_date', selectedDate)
        .in('student_id', students.map(s => s.id));

      // Insert new attendance records
      const attendanceRecords = students.map(student => ({
        student_id: student.id,
        attendance_date: selectedDate,
        is_present: attendance[student.id] || false,
        remarks: remarks[student.id] || null
      }));

      const { error } = await supabase
        .from('attendance')
        .insert(attendanceRecords);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Success!',
        description: 'Attendance has been saved successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save attendance',
        variant: 'destructive',
      });
    }
  });

  const handleAttendanceChange = (studentId: string, isPresent: boolean) => {
    setAttendance(prev => ({ ...prev, [studentId]: isPresent }));
  };

  const handleRemarkChange = (studentId: string, remark: string) => {
    setRemarks(prev => ({ ...prev, [studentId]: remark }));
  };

  const markAllPresent = () => {
    if (!students) return;
    const newAttendance: { [key: string]: boolean } = {};
    students.forEach(student => {
      newAttendance[student.id] = true;
    });
    setAttendance(newAttendance);
  };

  const markAllAbsent = () => {
    if (!students) return;
    const newAttendance: { [key: string]: boolean } = {};
    students.forEach(student => {
      newAttendance[student.id] = false;
    });
    setAttendance(newAttendance);
  };

  const absentCount = students ? students.filter(s => !attendance[s.id]).length : 0;
  const presentCount = students ? students.filter(s => attendance[s.id]).length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Date and Class Selection */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Attendance Entry
          </CardTitle>
          <CardDescription>
            Select date and class to mark attendance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class">Class</Label>
              {classesLoading ? (
                <div className="h-10 bg-muted animate-pulse rounded-md"></div>
              ) : (
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
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
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Daily Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description for the day (e.g., Sports event, Field trip)"
              value={dailyDescription}
              onChange={(e) => setDailyDescription(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Student Attendance */}
      {selectedClass && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="card-premium">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Mark Attendance
                  </CardTitle>
                  <CardDescription>
                    Present: {presentCount} | Absent: {absentCount}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={markAllPresent}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    All Present
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={markAllAbsent}
                  >
                    <X className="w-4 h-4 mr-1" />
                    All Absent
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {studentsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg"></div>
                  ))}
                </div>
              ) : students?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No students found in this class
                </p>
              ) : (
                <div className="space-y-4">
                  {students?.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-4 p-4 rounded-lg border"
                    >
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={student.id}
                          checked={attendance[student.id] || false}
                          onCheckedChange={(checked) => 
                            handleAttendanceChange(student.id, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={student.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Present
                        </label>
                      </div>
                      
                      <div className="flex-1">
                        <p className="font-medium">{student.full_name}</p>
                        <p className="text-sm text-muted-foreground">{student.admission_number}</p>
                      </div>
                      
                      <div className="flex-1 max-w-md">
                        <Input
                          placeholder="Remarks (optional)"
                          value={remarks[student.id] || ''}
                          onChange={(e) => handleRemarkChange(student.id, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {students && students.length > 0 && (
                <div className="flex justify-end space-x-4 pt-6">
                  <Button type="button" variant="outline" onClick={onSuccess}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => saveAttendance.mutate()}
                    className="btn-gold"
                    disabled={saveAttendance.isPending}
                  >
                    {saveAttendance.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Attendance
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

// Add React import at the top if not already present
import React from 'react';