import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, GraduationCap, DollarSign, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/currency';

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      if (!id) throw new Error('Student ID is required');
      const { data, error } = await supabase
        .from('students')
        .select(`*, classes (id, name)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['student-payments', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('fee_payments')
        .select(`*, fee_structures (term, academic_year, amount, fee_type)`)
        .eq('student_id', id)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: attendanceSummary, isLoading: attendanceLoading } = useQuery({
    queryKey: ['student-attendance', id],
    queryFn: async () => {
      if (!id) return { total: 0, present: 0, absent: 0 };
      const { data, error } = await supabase.from('attendance').select('is_present').eq('student_id', id);
      if (error) throw error;
      const total = data.length;
      const present = data.filter(a => a.is_present).length;
      return { total, present, absent: total - present };
    },
    enabled: !!id
  });

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ['student-grades', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('report_cards')
        .select(`*, subjects (name, code)`)
        .eq('student_id', id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  if (studentLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-muted animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1"><div className="h-96 bg-muted animate-pulse rounded-lg"></div></div>
          <div className="lg:col-span-2 space-y-6"><div className="h-64 bg-muted animate-pulse rounded-lg"></div></div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground">Student Not Found</h2>
          <Button onClick={() => navigate('/students')} className="mt-4">Back to Students</Button>
        </div>
      </div>
    );
  }

  const totalPaid = payments?.reduce((sum, payment) => sum + Number(payment.amount_paid), 0) || 0;
  const attendancePercentage = attendanceSummary?.total ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/students')}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Students
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{student.full_name}</h1>
          <p className="text-muted-foreground">{student.admission_number} • {(student.classes as any)?.name}</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1">
          <Card className="card-premium">
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Student Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-12 h-12 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">{student.full_name}</h3>
                <p className="text-muted-foreground">{student.admission_number}</p>
              </div>
              <div className="space-y-3">
                {student.date_of_birth && (<div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{new Date(student.date_of_birth).toLocaleDateString()}</span></div>)}
                <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{(student.classes as any)?.name}</span></div>
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{student.parent_phone}</span></div>
                {student.parent_email && (<div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{student.parent_email}</span></div>)}
                {student.address && (<div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{student.address}</span></div>)}
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Parent/Guardian</p>
                <p className="text-sm text-muted-foreground">{student.parent_name}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="finance">Finance</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="grades">Grades</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card><CardContent className="p-4"><div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-600" /><div><p className="text-sm text-muted-foreground">Total Paid</p><p className="text-xl font-bold">{formatCurrency(totalPaid)}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" /><div><p className="text-sm text-muted-foreground">Attendance</p><p className="text-xl font-bold">{attendancePercentage}%</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-2"><FileText className="w-5 h-5 text-purple-600" /><div><p className="text-sm text-muted-foreground">Total Grades</p><p className="text-xl font-bold">{grades?.length || 0}</p></div></div></CardContent></Card>
              </div>
            </TabsContent>

            <TabsContent value="finance" className="space-y-4">
              <Card className="card-premium">
                <CardHeader><CardTitle>Payment History</CardTitle><CardDescription>All recorded payments</CardDescription></CardHeader>
                <CardContent>
                  {paymentsLoading ? (
                    <div className="space-y-3">{[...Array(3)].map((_, i) => (<div key={i} className="h-16 bg-muted animate-pulse rounded-lg"></div>))}</div>
                  ) : payments?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No payments recorded</p>
                  ) : (
                    <div className="space-y-3">
                      {payments?.map((payment) => (
                        <div key={payment.id} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{formatCurrency(Number(payment.amount_paid))}</p>
                            <p className="text-sm text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString()} • {payment.payment_method}</p>
                          </div>
                          <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'}>{payment.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="space-y-4">
              <Card className="card-premium">
                <CardHeader><CardTitle>Attendance Summary</CardTitle></CardHeader>
                <CardContent>
                  {attendanceLoading ? (<div className="h-32 bg-muted animate-pulse rounded-lg"></div>) : (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div><p className="text-2xl font-bold text-green-600">{attendanceSummary?.present}</p><p className="text-sm text-muted-foreground">Present</p></div>
                      <div><p className="text-2xl font-bold text-red-600">{attendanceSummary?.absent}</p><p className="text-sm text-muted-foreground">Absent</p></div>
                      <div><p className="text-2xl font-bold text-blue-600">{attendancePercentage}%</p><p className="text-sm text-muted-foreground">Percentage</p></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="grades" className="space-y-4">
              <Card className="card-premium">
                <CardHeader><CardTitle>Recent Grades</CardTitle></CardHeader>
                <CardContent>
                  {gradesLoading ? (
                    <div className="space-y-3">{[...Array(3)].map((_, i) => (<div key={i} className="h-16 bg-muted animate-pulse rounded-lg"></div>))}</div>
                  ) : grades?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No grades recorded</p>
                  ) : (
                    <div className="space-y-3">
                      {grades?.map((grade) => (
                        <div key={grade.id} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{(grade.subjects as any)?.name}</p>
                            <p className="text-sm text-muted-foreground">{grade.term} Term, {grade.academic_year}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold">{grade.score}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
