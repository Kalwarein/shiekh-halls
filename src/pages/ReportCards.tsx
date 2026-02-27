import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Search, User, BookOpen, Award, Trophy, BarChart3, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYear } from '@/hooks/useAcademicYear';

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  class_id: string;
  classes?: { name: string };
}

const terms = ['first', 'second', 'third'];

export default function ReportCards() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('first');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showGradeEntry, setShowGradeEntry] = useState(false);
  const [activeTab, setActiveTab] = useState('class-leaderboard');

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedYearId, academicYears } = useAcademicYear();
  const selectedYearName = academicYears.find(y => y.id === selectedYearId)?.name || '';

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  // All report cards for selected term & year
  const { data: allReportCards = [], isLoading: reportCardsLoading } = useQuery({
    queryKey: ['all-report-cards', selectedTerm, selectedYearName],
    queryFn: async () => {
      if (!selectedYearName) return [];
      const { data, error } = await supabase
        .from('report_cards')
        .select('*, subjects (name, code), students (id, full_name, admission_number, class_id, classes (name))')
        .eq('term', selectedTerm)
        .eq('academic_year', selectedYearName);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedYearName
  });

  // Students for selected class
  const { data: classStudents = [] } = useQuery({
    queryKey: ['class-students', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      const { data, error } = await supabase.from('students').select('id, full_name, admission_number, class_id, classes (name)').eq('class_id', selectedClass).order('full_name');
      if (error) throw error;
      return data as Student[];
    },
    enabled: !!selectedClass
  });

  // Subjects for selected class
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', selectedStudent?.class_id || selectedClass],
    queryFn: async () => {
      const classId = selectedStudent?.class_id || selectedClass;
      if (!classId) return [];
      const { data, error } = await supabase.from('subjects').select('*').eq('class_id', classId).eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!(selectedStudent?.class_id || selectedClass)
  });

  // Student-specific report cards
  const { data: studentReportCards = [] } = useQuery({
    queryKey: ['student-report-cards', selectedStudent?.id, selectedTerm, selectedYearName],
    queryFn: async () => {
      if (!selectedStudent?.id || !selectedYearName) return [];
      const { data, error } = await supabase
        .from('report_cards')
        .select('*, subjects (name, code)')
        .eq('student_id', selectedStudent.id)
        .eq('term', selectedTerm)
        .eq('academic_year', selectedYearName);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedStudent?.id && !!selectedYearName
  });

  // Grade mutation
  const gradeMutation = useMutation({
    mutationFn: async (gradeData: { student_id: string; subject_id: string; term: string; academic_year: string; score: number; remarks?: string; academic_year_id?: string }) => {
      const { data: existing } = await supabase
        .from('report_cards').select('id')
        .eq('student_id', gradeData.student_id).eq('subject_id', gradeData.subject_id)
        .eq('term', gradeData.term).eq('academic_year', gradeData.academic_year).single();

      const payload = { ...gradeData, grade: null, remarks: gradeData.remarks || null, academic_year_id: gradeData.academic_year_id || null };
      if (existing) {
        const { error } = await supabase.from('report_cards').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('report_cards').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-report-cards'] });
      queryClient.invalidateQueries({ queryKey: ['all-report-cards'] });
      toast({ title: 'Success', description: 'Score saved successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: 'Failed to save score', variant: 'destructive' });
    }
  });

  // Class Leaderboard calculation
  const classLeaderboard = useMemo(() => {
    if (!selectedClass) return [];
    const classReports = allReportCards.filter(r => (r.students as any)?.class_id === selectedClass);
    const studentMap: Record<string, { student: any; totalScore: number; count: number }> = {};
    classReports.forEach(r => {
      const sid = r.student_id;
      if (!studentMap[sid]) studentMap[sid] = { student: r.students, totalScore: 0, count: 0 };
      studentMap[sid].totalScore += Number(r.score || 0);
      studentMap[sid].count++;
    });
    return Object.values(studentMap)
      .map(s => ({ ...s, average: s.count > 0 ? Math.round(s.totalScore / s.count) : 0 }))
      .sort((a, b) => b.average - a.average)
      .map((s, i, arr) => {
        // Handle tied positions
        let rank = i + 1;
        if (i > 0 && arr[i].average === arr[i - 1].average) {
          rank = (arr as any)[i - 1].rank;
        }
        (s as any).rank = rank;
        return { ...s, rank };
      });
  }, [allReportCards, selectedClass]);

  // School Leaderboard (top 10)
  const schoolLeaderboard = useMemo(() => {
    const studentMap: Record<string, { student: any; totalScore: number; count: number }> = {};
    allReportCards.forEach(r => {
      const sid = r.student_id;
      if (!studentMap[sid]) studentMap[sid] = { student: r.students, totalScore: 0, count: 0 };
      studentMap[sid].totalScore += Number(r.score || 0);
      studentMap[sid].count++;
    });
    return Object.values(studentMap)
      .map(s => ({ ...s, average: s.count > 0 ? Math.round(s.totalScore / s.count) : 0 }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 10)
      .map((s, i, arr) => {
        let rank = i + 1;
        if (i > 0 && arr[i].average === arr[i - 1].average) rank = (arr as any)[i - 1].rank;
        (s as any).rank = rank;
        return { ...s, rank };
      });
  }, [allReportCards]);

  // Subject Performance Analytics
  const subjectAnalytics = useMemo(() => {
    if (!selectedClass) return [];
    const classReports = allReportCards.filter(r => (r.students as any)?.class_id === selectedClass);
    const subjectMap: Record<string, { name: string; scores: number[] }> = {};
    classReports.forEach(r => {
      const subName = (r.subjects as any)?.name;
      if (!subName) return;
      if (!subjectMap[r.subject_id]) subjectMap[r.subject_id] = { name: subName, scores: [] };
      subjectMap[r.subject_id].scores.push(Number(r.score || 0));
    });
    return Object.values(subjectMap).map(s => ({
      name: s.name,
      average: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length),
      highest: Math.max(...s.scores),
      lowest: Math.min(...s.scores),
      count: s.scores.length
    })).sort((a, b) => b.average - a.average);
  }, [allReportCards, selectedClass]);

  // Student detail view
  if (selectedStudent) {
    const totalScore = studentReportCards.reduce((sum, r) => sum + Number(r.score || 0), 0);
    const avgScore = studentReportCards.length > 0 ? Math.round(totalScore / studentReportCards.length) : 0;
    const classPosition = classLeaderboard.findIndex(l => l.student?.id === selectedStudent.id);
    const position = classPosition >= 0 ? classLeaderboard[classPosition].rank : '-';

    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setSelectedStudent(null)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">{selectedStudent.full_name}</h1>
              <p className="text-muted-foreground">{selectedStudent.admission_number} • {selectedStudent.classes?.name} • {selectedTerm.charAt(0).toUpperCase() + selectedTerm.slice(1)} Term {selectedYearName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline"><Download className="w-4 h-4 mr-2" />Export PDF</Button>
            <Button onClick={() => setShowGradeEntry(!showGradeEntry)} className="btn-gold">
              <Plus className="w-4 h-4 mr-2" />{showGradeEntry ? 'Hide' : 'Add'} Scores
            </Button>
          </div>
        </motion.div>

        {/* Term selector */}
        <div className="flex gap-4">
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</SelectItem>)}</SelectContent>
          </Select>
          <Input value={selectedYearName} disabled className="w-48 bg-muted" />
        </div>

        {/* Score Entry */}
        {showGradeEntry && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="card-premium">
              <CardHeader>
                <CardTitle>Enter Scores</CardTitle>
                <CardDescription>{subjects.filter(s => !studentReportCards.find(r => r.subject_id === s.id)).length} subjects remaining</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {subjects.map(subject => {
                    const existing = studentReportCards.find(r => r.subject_id === subject.id);
                    return (
                      <div key={subject.id} className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end p-3 border rounded-lg">
                        <div><p className="font-medium text-sm">{subject.name}</p><p className="text-xs text-muted-foreground">{subject.code}</p></div>
                        <div><label className="text-xs text-muted-foreground">Score (0-100)</label><Input type="number" min="0" max="100" defaultValue={existing?.score || ''} id={`score-${subject.id}`} placeholder="0-100" /></div>
                        <div><label className="text-xs text-muted-foreground">Remarks</label><Input defaultValue={existing?.remarks || ''} id={`remarks-${subject.id}`} placeholder="Optional" /></div>
                        <Button size="sm" className="btn-gold" disabled={gradeMutation.isPending} onClick={() => {
                          const score = parseInt((document.getElementById(`score-${subject.id}`) as HTMLInputElement).value);
                          const remarks = (document.getElementById(`remarks-${subject.id}`) as HTMLInputElement).value;
                          if (score >= 0 && score <= 100) {
                            gradeMutation.mutate({ student_id: selectedStudent.id, subject_id: subject.id, term: selectedTerm, academic_year: selectedYearName, score, remarks: remarks || undefined, academic_year_id: selectedYearId || undefined });
                          } else {
                            toast({ title: 'Invalid', description: 'Score must be 0-100', variant: 'destructive' });
                          }
                        }}>Save</Button>
                      </div>
                    );
                  })}
                  {subjects.length === 0 && <p className="text-center text-muted-foreground py-4">No subjects found. Add subjects in Settings.</p>}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Results Table */}
        <Card className="card-premium">
          <CardHeader><CardTitle className="flex items-center gap-2"><Award className="w-5 h-5" />Results</CardTitle></CardHeader>
          <CardContent>
            {studentReportCards.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No scores recorded</p>
                <Button onClick={() => setShowGradeEntry(true)} className="btn-gold mt-4">Add Scores</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Code</TableHead><TableHead>Score (%)</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {studentReportCards.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{(r.subjects as any)?.name}</TableCell>
                        <TableCell>{(r.subjects as any)?.code}</TableCell>
                        <TableCell className="font-bold text-lg">{r.score}%</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.remarks || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-4 bg-muted/30 rounded-lg grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                  <div><p className="text-sm text-muted-foreground">Subjects</p><p className="text-xl font-bold">{studentReportCards.length}</p></div>
                  <div><p className="text-sm text-muted-foreground">Total</p><p className="text-xl font-bold">{totalScore}</p></div>
                  <div><p className="text-sm text-muted-foreground">Average</p><p className="text-xl font-bold">{avgScore}%</p></div>
                  <div><p className="text-sm text-muted-foreground">Position</p><p className="text-xl font-bold">{position}</p></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main Results Dashboard
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl lg:text-3xl font-bold">Results & Leaderboards</h1>
        <p className="text-muted-foreground">View rankings, performance analytics, and manage student results</p>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select value={selectedTerm} onValueChange={setSelectedTerm}>
          <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
          <SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>{classes.map(cls => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input value={selectedYearName} disabled className="bg-muted" />
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="class-leaderboard"><Trophy className="w-4 h-4 mr-2" />Class Ranking</TabsTrigger>
          <TabsTrigger value="school-leaderboard"><Award className="w-4 h-4 mr-2" />School Top 10</TabsTrigger>
          <TabsTrigger value="subject-analytics"><BarChart3 className="w-4 h-4 mr-2" />Subject Analytics</TabsTrigger>
        </TabsList>

        {/* Class Leaderboard */}
        <TabsContent value="class-leaderboard">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Class Leaderboard</CardTitle>
              <CardDescription>{selectedClass ? `${classes.find(c => c.id === selectedClass)?.name} - ${selectedTerm.charAt(0).toUpperCase() + selectedTerm.slice(1)} Term ${selectedYearName}` : 'Select a class to view rankings'}</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedClass ? (
                <div className="text-center py-8"><Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Select a class above to view the leaderboard</p></div>
              ) : reportCardsLoading ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : classLeaderboard.length === 0 ? (
                <div className="text-center py-8"><p className="text-muted-foreground">No results found for this class and term</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead className="w-16">Rank</TableHead><TableHead>Student</TableHead><TableHead>Total</TableHead><TableHead>Average</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {classLeaderboard.map((entry, i) => (
                      <TableRow key={entry.student?.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedStudent(entry.student)}>
                        <TableCell>
                          {entry.rank <= 3 ? (
                            <Badge className={entry.rank === 1 ? 'bg-yellow-400 text-yellow-900' : entry.rank === 2 ? 'bg-gray-300 text-gray-800' : 'bg-orange-300 text-orange-900'}>{entry.rank}</Badge>
                          ) : <span className="font-medium">{entry.rank}</span>}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.student?.full_name}</p>
                            <p className="text-sm text-muted-foreground">{entry.student?.admission_number}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{entry.totalScore}</TableCell>
                        <TableCell className="font-bold text-lg">{entry.average}%</TableCell>
                        <TableCell><Button variant="ghost" size="sm">View</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Student cards for entering results */}
          {selectedClass && (
            <Card className="card-premium mt-4">
              <CardHeader>
                <CardTitle>Enter Results</CardTitle>
                <CardDescription>Click a student to enter or view their scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {classStudents.map(student => (
                    <div key={student.id} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setSelectedStudent(student)}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-primary" /></div>
                        <div>
                          <p className="font-medium text-sm">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">{student.admission_number}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* School Leaderboard */}
        <TabsContent value="school-leaderboard">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>School Top 10</CardTitle>
              <CardDescription>Best performing students across all classes - {selectedTerm.charAt(0).toUpperCase() + selectedTerm.slice(1)} Term {selectedYearName}</CardDescription>
            </CardHeader>
            <CardContent>
              {reportCardsLoading ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : schoolLeaderboard.length === 0 ? (
                <div className="text-center py-8"><p className="text-muted-foreground">No results found</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead className="w-16">Rank</TableHead><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Average</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {schoolLeaderboard.map(entry => (
                      <TableRow key={entry.student?.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedStudent(entry.student)}>
                        <TableCell>
                          {entry.rank <= 3 ? (
                            <Badge className={entry.rank === 1 ? 'bg-yellow-400 text-yellow-900' : entry.rank === 2 ? 'bg-gray-300 text-gray-800' : 'bg-orange-300 text-orange-900'}>{entry.rank}</Badge>
                          ) : <span className="font-medium">{entry.rank}</span>}
                        </TableCell>
                        <TableCell><p className="font-medium">{entry.student?.full_name}</p></TableCell>
                        <TableCell><span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">{entry.student?.classes?.name}</span></TableCell>
                        <TableCell className="font-bold text-lg">{entry.average}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subject Analytics */}
        <TabsContent value="subject-analytics">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Subject Performance</CardTitle>
              <CardDescription>{selectedClass ? `${classes.find(c => c.id === selectedClass)?.name} - Performance by subject` : 'Select a class to view analytics'}</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedClass ? (
                <div className="text-center py-8"><BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Select a class to view subject analytics</p></div>
              ) : subjectAnalytics.length === 0 ? (
                <div className="text-center py-8"><p className="text-muted-foreground">No subject data available</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Class Average</TableHead><TableHead>Highest</TableHead><TableHead>Lowest</TableHead><TableHead>Students</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {subjectAnalytics.map(sa => (
                      <TableRow key={sa.name}>
                        <TableCell className="font-medium">{sa.name}</TableCell>
                        <TableCell className="font-bold">{sa.average}%</TableCell>
                        <TableCell className="text-green-600 font-medium">{sa.highest}%</TableCell>
                        <TableCell className="text-red-600 font-medium">{sa.lowest}%</TableCell>
                        <TableCell>{sa.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
