import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, GraduationCap, DollarSign, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/currency';
import { useAcademicYear } from '@/hooks/useAcademicYear';

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedYearId } = useAcademicYear();

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      if (!id) throw new Error('Student ID is required');
      const { data, error } = await supabase.from('students').select('*, classes (id, name)').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['student-payments', id, selectedYearId],
    queryFn: async () => {
      if (!id) return [];
      let query = supabase.from('fee_payments').select('*').eq('student_id', id).order('payment_date', { ascending: false });
      if (selectedYearId) query = query.eq('academic_year_id', selectedYearId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: feeStructure } = useQuery({
    queryKey: ['student-fee-structure', student?.class_id, selectedYearId],
    queryFn: async () => {
      if (!student?.class_id || !selectedYearId) return null;
      const { data, error } = await supabase.from('fee_structures').select('*').eq('class_id', student.class_id).eq('academic_year_id', selectedYearId).eq('is_active', true).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!student?.class_id && !!selectedYearId
  });

  const { data: attendanceSummary } = useQuery({
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

  const { data: grades = [] } = useQuery({
    queryKey: ['student-grades', id, selectedYearId],
    queryFn: async () => {
      if (!id) return [];
      let query = supabase.from('report_cards').select('*, subjects (name, code)').eq('student_id', id).order('term');
      if (selectedYearId) query = query.eq('academic_year_id', selectedYearId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  if (studentLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1"><div className="h-96 bg-muted animate-pulse rounded-lg" /></div>
          <div className="lg:col-span-2"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>
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

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const totalFee = feeStructure ? Number(feeStructure.total_fee || feeStructure.amount || 0) : 0;
  const balance = totalFee - totalPaid;
  const attendancePercentage = attendanceSummary?.total ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100) : 0;
  const totalScore = grades.reduce((sum, g) => sum + Number(g.score || 0), 0);
  const avgScore = grades.length > 0 ? Math.round(totalScore / grades.length) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800 border-0">Active</Badge>;
      case 'transferred': return <Badge className="bg-yellow-100 text-yellow-800 border-0">Transferred</Badge>;
      case 'graduated': return <Badge className="bg-blue-100 text-blue-800 border-0">Graduated</Badge>;
      default: return <Badge className="bg-green-100 text-green-800 border-0">Active</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/students')}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{student.full_name}</h1>
          <p className="text-muted-foreground">{student.admission_number} • {(student.classes as any)?.name}</p>
        </div>
        {getStatusBadge(student.status || 'active')}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Student Info */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1 space-y-4">
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
              <div className="space-y-3 text-sm">
                {student.gender && <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /><span className="capitalize">{student.gender}</span></div>}
                {student.date_of_birth && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /><span>{new Date(student.date_of_birth).toLocaleDateString()}</span></div>}
                <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-muted-foreground" /><span>{(student.classes as any)?.name}</span></div>
                {student.parent_phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span>{student.parent_phone}</span></div>}
                {student.parent_email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span>{student.parent_email}</span></div>}
                {student.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /><span>{student.address}</span></div>}
              </div>
              {student.parent_name && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-1">Parent/Guardian</p>
                  <p className="text-sm text-muted-foreground">{student.parent_name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="card-premium">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg. Score</span>
                <span className="font-bold text-lg">{avgScore}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Attendance</span>
                <span className="font-bold text-lg">{attendancePercentage}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Balance</span>
                <span className={`font-bold text-lg ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(balance)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right - Tabs */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2">
          <Tabs defaultValue="results" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="finance">Finance</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>

            <TabsContent value="results">
              <Card className="card-premium">
                <CardHeader><CardTitle>Academic Results</CardTitle></CardHeader>
                <CardContent>
                  {grades.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No results recorded</p>
                  ) : (
                    <div className="space-y-4">
                      <Table>
                        <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Term</TableHead><TableHead>Score</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {grades.map(g => (
                            <TableRow key={g.id}>
                              <TableCell className="font-medium">{(g.subjects as any)?.name}</TableCell>
                              <TableCell className="capitalize">{g.term} Term</TableCell>
                              <TableCell className="font-bold">{g.score}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="p-4 bg-muted/30 rounded-lg grid grid-cols-3 gap-4 text-center">
                        <div><p className="text-sm text-muted-foreground">Subjects</p><p className="text-xl font-bold">{grades.length}</p></div>
                        <div><p className="text-sm text-muted-foreground">Total</p><p className="text-xl font-bold">{totalScore}</p></div>
                        <div><p className="text-sm text-muted-foreground">Average</p><p className="text-xl font-bold">{avgScore}%</p></div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="finance">
              <Card className="card-premium">
                <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
                <CardContent>
                  {totalFee > 0 && (
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="p-3 bg-muted/30 rounded-lg text-center"><p className="text-xs text-muted-foreground">Total Fee</p><p className="font-bold">{formatCurrency(totalFee)}</p></div>
                      <div className="p-3 bg-muted/30 rounded-lg text-center"><p className="text-xs text-muted-foreground">Paid</p><p className="font-bold text-green-600">{formatCurrency(totalPaid)}</p></div>
                      <div className="p-3 bg-muted/30 rounded-lg text-center"><p className="text-xs text-muted-foreground">Balance</p><p className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(balance)}</p></div>
                    </div>
                  )}
                  {payments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No payments recorded</p>
                  ) : (
                    <div className="space-y-3">
                      {payments.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{formatCurrency(Number(p.amount_paid))}</p>
                            <p className="text-sm text-muted-foreground">{new Date(p.payment_date).toLocaleDateString()} • {p.payment_method}</p>
                          </div>
                          <Badge variant={p.status === 'paid' ? 'default' : 'secondary'}>{p.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance">
              <Card className="card-premium">
                <CardHeader><CardTitle>Attendance Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div><p className="text-2xl font-bold text-green-600">{attendanceSummary?.present || 0}</p><p className="text-sm text-muted-foreground">Present</p></div>
                    <div><p className="text-2xl font-bold text-red-600">{attendanceSummary?.absent || 0}</p><p className="text-sm text-muted-foreground">Absent</p></div>
                    <div><p className="text-2xl font-bold text-blue-600">{attendancePercentage}%</p><p className="text-sm text-muted-foreground">Rate</p></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card><CardContent className="p-4"><div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-600" /><div><p className="text-sm text-muted-foreground">Total Paid</p><p className="text-xl font-bold">{formatCurrency(totalPaid)}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" /><div><p className="text-sm text-muted-foreground">Attendance</p><p className="text-xl font-bold">{attendancePercentage}%</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-2"><FileText className="w-5 h-5 text-purple-600" /><div><p className="text-sm text-muted-foreground">Avg Score</p><p className="text-xl font-bold">{avgScore}%</p></div></div></CardContent></Card>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
