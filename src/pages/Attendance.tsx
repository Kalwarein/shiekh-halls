import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Save, BarChart3, Users, User, Clock, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { AttendanceNotifications } from '@/components/AttendanceNotifications';

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  class_id: string;
  classes?: {
    name: string;
  };
}

interface AttendanceRecord {
  student_id: string;
  is_present: boolean;
  remarks?: string;
}

export default function Attendance() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch classes
  const { data: classes = [], isLoading: classesLoading } = useQuery({
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

  // Auto-select first class when classes load
  useEffect(() => {
    if (classes.length > 0 && !selectedClass) {
      setSelectedClass(classes[0].id);
    }
  }, [classes, selectedClass]);

  // Fetch students for selected class
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students-by-class', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          full_name,
          admission_number,
          class_id,
          classes (
            name
          )
        `)
        .eq('class_id', selectedClass)
        .order('full_name');
      
      if (error) throw error;
      return data as Student[];
    },
    enabled: !!selectedClass
  });

  // Fetch existing attendance for selected date and class
  const { data: existingAttendance = [], refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance', selectedClass, selectedDate],
    queryFn: async () => {
      if (!selectedClass || !selectedDate) return [];
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('attendance_date', selectedDate)
        .in('student_id', students.map(s => s.id));
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClass && !!selectedDate && students.length > 0
  });

  // Fetch attendance statistics
  const { data: attendanceStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['attendance-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          student_id,
          is_present,
          students (
            classes (
              name
            )
          )
        `)
        .gte('attendance_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      
      if (error) throw error;
      
      // Group by class and calculate percentages
      const classStats = data.reduce((acc, record) => {
        const className = record.students?.classes?.name;
        if (!className) return acc;
        
        if (!acc[className]) {
          acc[className] = { present: 0, total: 0 };
        }
        
        acc[className].total++;
        if (record.is_present) {
          acc[className].present++;
        }
        
        return acc;
      }, {} as Record<string, { present: number; total: number }>);
      
      return Object.entries(classStats).map(([className, stats]) => ({
        class: className,
        percentage: Math.round((stats.present / stats.total) * 100)
      }));
    }
  });

  // Initialize attendance from existing records
  useEffect(() => {
    if (existingAttendance.length > 0) {
      const attendanceMap: Record<string, AttendanceRecord> = {};
      const remarksMap: Record<string, string> = {};
      
      existingAttendance.forEach(record => {
        attendanceMap[record.student_id] = {
          student_id: record.student_id,
          is_present: record.is_present,
          remarks: record.remarks
        };
        if (record.remarks) {
          remarksMap[record.student_id] = record.remarks;
        }
      });
      
      setAttendance(attendanceMap);
      setRemarks(remarksMap);
    } else {
      setAttendance({});
      setRemarks({});
    }
  }, [existingAttendance]);

  // Save attendance mutation
  const saveAttendanceMutation = useMutation({
    mutationFn: async () => {
      const attendanceRecords = Object.values(attendance).map(record => ({
        student_id: record.student_id,
        attendance_date: selectedDate,
        is_present: record.is_present,
        remarks: remarks[record.student_id] || null,
        marked_by: null
      }));

      // Delete existing records for this date and class
      const studentIds = students.map(s => s.id);
      await supabase
        .from('attendance')
        .delete()
        .eq('attendance_date', selectedDate)
        .in('student_id', studentIds);

      // Insert new records
      const { error } = await supabase
        .from('attendance')
        .insert(attendanceRecords);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
      toast({
        title: "Success",
        description: "Attendance saved successfully",
      });
    },
    onError: (error) => {
      console.error('Error saving attendance:', error);
      toast({
        title: "Error",
        description: "Failed to save attendance",
        variant: "destructive",
      });
    }
  });

  const handleAttendanceChange = (studentId: string, isPresent: boolean) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        student_id: studentId,
        is_present: isPresent,
      }
    }));
  };

  const handleRemarksChange = (studentId: string, remarksText: string) => {
    setRemarks(prev => ({
      ...prev,
      [studentId]: remarksText
    }));
  };

  const handleSaveAttendance = () => {
    if (Object.keys(attendance).length === 0) {
      toast({
        title: "No Changes",
        description: "Please mark attendance for at least one student",
        variant: "destructive",
      });
      return;
    }
    
    saveAttendanceMutation.mutate();
  };

  const presentCount = Object.values(attendance).filter(record => record.is_present).length;
  const totalStudents = students.length;
  const attendancePercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || '';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold tracking-tight">Attendance Management</h1>
        <p className="text-muted-foreground">
          Track and manage student attendance efficiently with notifications and insights.
        </p>
      </motion.div>

      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Take Attendance
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-6">

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="space-y-2">
          <Label htmlFor="class">Select Class</Label>
          {classesLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Select Date</Label>
          <Input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-2">
          <Button 
            onClick={handleSaveAttendance} 
            className="btn-gold w-full"
            disabled={saveAttendanceMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveAttendanceMutation.isPending ? 'Saving...' : 'Save Attendance'}
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {studentsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{totalStudents}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present Today</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{presentCount}</div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{attendancePercentage}%</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Marking */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Mark Attendance - {selectedClassName}
              </CardTitle>
              <CardDescription>
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {studentsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-8">
                  <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {selectedClass ? 'No students found in this class' : 'Please select a class'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {students.map((student, index) => (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 border rounded-lg hover:bg-muted/50 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{student.full_name}</p>
                            <p className="text-sm text-muted-foreground">{student.admission_number}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`present-${student.id}`}
                            checked={attendance[student.id]?.is_present || false}
                            onCheckedChange={(checked) => 
                              handleAttendanceChange(student.id, checked as boolean)
                            }
                          />
                          <Label htmlFor={`present-${student.id}`}>Present</Label>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`remarks-${student.id}`} className="text-xs">
                          Remarks (optional)
                        </Label>
                        <Input
                          id={`remarks-${student.id}`}
                          placeholder="Add remarks..."
                          value={remarks[student.id] || ''}
                          onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Attendance Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Class Attendance Overview</CardTitle>
              <CardDescription>Average attendance by class (Last 30 days)</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : attendanceStats.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No attendance data available</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="class" 
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Bar 
                      dataKey="percentage" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
        </TabsContent>

        <TabsContent value="notifications">
          <AttendanceNotifications />
        </TabsContent>
      </Tabs>
    </div>
  );
}