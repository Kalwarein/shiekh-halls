import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Search, User, BookOpen, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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

interface Subject {
  id: string;
  name: string;
  code: string;
  class_id: string;
}

interface ReportCard {
  id: string;
  student_id: string;
  subject_id: string;
  term: string;
  academic_year: string;
  score: number;
  grade: string;
  remarks?: string;
  subjects?: { name: string; code: string };
}

const terms = ['first', 'second', 'third'];

export default function ReportCards() {
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedTerm, setSelectedTerm] = useState('first');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showGradeEntry, setShowGradeEntry] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedYearId, academicYears } = useAcademicYear();

  const selectedYearName = academicYears.find(y => y.id === selectedYearId)?.name || '';

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch students - filtered by class selection
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students-with-classes', selectedClass],
    queryFn: async () => {
      let query = supabase.from('students').select(`id, full_name, admission_number, class_id, classes (name)`).order('full_name');
      if (selectedClass !== 'all') {
        const cls = classes.find(c => c.name === selectedClass);
        if (cls) query = query.eq('class_id', cls.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Student[];
    },
    enabled: classes.length > 0
  });

  // Fetch subjects for selected student's class
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', selectedStudent?.class_id],
    queryFn: async () => {
      if (!selectedStudent?.class_id) return [];
      const { data, error } = await supabase.from('subjects').select('*').eq('class_id', selectedStudent.class_id).eq('is_active', true).order('name');
      if (error) throw error;
      return data as Subject[];
    },
    enabled: !!selectedStudent?.class_id
  });

  // Fetch report cards for selected student
  const { data: reportCards = [], isLoading: reportCardsLoading } = useQuery({
    queryKey: ['report-cards', selectedStudent?.id, selectedTerm, selectedYearName],
    queryFn: async () => {
      if (!selectedStudent?.id || !selectedYearName) return [];
      const { data, error } = await supabase
        .from('report_cards')
        .select(`*, subjects (name, code)`)
        .eq('student_id', selectedStudent.id)
        .eq('term', selectedTerm)
        .eq('academic_year', selectedYearName);
      if (error) throw error;
      return data as ReportCard[];
    },
    enabled: !!selectedStudent?.id && !!selectedYearName
  });

  // Grade mutation - numeric only, no letter grades
  const gradeMutation = useMutation({
    mutationFn: async (gradeData: {
      student_id: string;
      subject_id: string;
      term: string;
      academic_year: string;
      score: number;
      remarks?: string;
      academic_year_id?: string;
    }) => {
      const { data: existing } = await supabase
        .from('report_cards')
        .select('id')
        .eq('student_id', gradeData.student_id)
        .eq('subject_id', gradeData.subject_id)
        .eq('term', gradeData.term)
        .eq('academic_year', gradeData.academic_year)
        .single();

      const payload = {
        student_id: gradeData.student_id,
        subject_id: gradeData.subject_id,
        term: gradeData.term,
        academic_year: gradeData.academic_year,
        score: gradeData.score,
        grade: null, // No letter grades
        remarks: gradeData.remarks || null,
        academic_year_id: gradeData.academic_year_id || null,
      };

      if (existing) {
        const { error } = await supabase.from('report_cards').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('report_cards').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-cards'] });
      toast({ title: 'Success', description: 'Score saved successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message?.includes('unique_student_subject_term_year') ? 'This subject has already been graded for this term' : 'Failed to save score', variant: 'destructive' });
    }
  });

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || student.admission_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Get subjects that haven't been graded yet
  const ungradedSubjects = subjects.filter(sub => !reportCards.find(rc => rc.subject_id === sub.id));

  // Student Report Card View
  if (selectedStudent) {
    const totalScore = reportCards.reduce((sum, r) => sum + r.score, 0);
    const averageScore = reportCards.length > 0 ? Math.round(totalScore / reportCards.length) : 0;

    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setSelectedStudent(null)} className="shrink-0">← Back</Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{selectedStudent.full_name} - Results</h1>
              <p className="text-muted-foreground">{selectedStudent.admission_number} • {selectedStudent.classes?.name} • {selectedTerm.charAt(0).toUpperCase() + selectedTerm.slice(1)} Term {selectedYearName}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto"><Download className="w-4 h-4 mr-2" />Export PDF</Button>
            <Button onClick={() => setShowGradeEntry(!showGradeEntry)} className="btn-gold w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />{showGradeEntry ? 'Hide' : 'Add'} Scores
            </Button>
          </div>
        </motion.div>

        {/* Term Selector */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Term</label>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {terms.map((term) => (<SelectItem key={term} value={term}>{term.charAt(0).toUpperCase() + term.slice(1)} Term</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Academic Year</label>
            <Input value={selectedYearName} disabled className="bg-muted" />
          </div>
        </motion.div>

        {/* Score Entry Form */}
        {showGradeEntry && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="card-premium">
              <CardHeader>
                <CardTitle>Enter Scores</CardTitle>
                <CardDescription>
                  {ungradedSubjects.length > 0
                    ? `${ungradedSubjects.length} subjects remaining to grade`
                    : 'All subjects have been graded for this term'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {subjects.map((subject) => {
                    const existingGrade = reportCards.find(rc => rc.subject_id === subject.id);
                    return (
                      <div key={subject.id} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end p-4 border rounded-lg">
                        <div>
                          <label className="text-sm font-medium">{subject.name}</label>
                          <p className="text-xs text-muted-foreground">{subject.code}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Score (0-100)</label>
                          <Input type="number" min="0" max="100" defaultValue={existingGrade?.score || ''} id={`score-${subject.id}`} placeholder="0-100" />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Remarks</label>
                          <Input defaultValue={existingGrade?.remarks || ''} id={`remarks-${subject.id}`} placeholder="Optional" />
                        </div>
                        <Button
                          onClick={() => {
                            const scoreInput = document.getElementById(`score-${subject.id}`) as HTMLInputElement;
                            const remarksInput = document.getElementById(`remarks-${subject.id}`) as HTMLInputElement;
                            const score = parseInt(scoreInput.value);
                            if (score >= 0 && score <= 100) {
                              gradeMutation.mutate({
                                student_id: selectedStudent.id,
                                subject_id: subject.id,
                                term: selectedTerm,
                                academic_year: selectedYearName,
                                score,
                                remarks: remarksInput.value || undefined,
                                academic_year_id: selectedYearId || undefined,
                              });
                            } else {
                              toast({ title: 'Invalid Score', description: 'Score must be between 0 and 100', variant: 'destructive' });
                            }
                          }}
                          disabled={gradeMutation.isPending}
                          className="btn-gold"
                        >
                          Save
                        </Button>
                      </div>
                    );
                  })}
                  {subjects.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No subjects found for this class. Add subjects in Settings first.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Results Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Award className="w-5 h-5" />Academic Performance</CardTitle>
              <CardDescription>Scores for {selectedTerm.charAt(0).toUpperCase() + selectedTerm.slice(1)} Term {selectedYearName}</CardDescription>
            </CardHeader>
            <CardContent>
              {reportCardsLoading ? (
                <div className="space-y-4">{[...Array(5)].map((_, i) => (<div key={i} className="flex justify-between items-center p-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-6 w-12" /></div>))}</div>
              ) : reportCards.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No scores recorded for this term</p>
                  <Button onClick={() => setShowGradeEntry(true)} className="btn-gold mt-4">Add Scores</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Score (%)</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportCards.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell className="font-medium">{report.subjects?.name}</TableCell>
                            <TableCell>{report.subjects?.code}</TableCell>
                            <TableCell className="font-bold text-lg">{report.score}%</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{report.remarks || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary */}
                  <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                    <h3 className="font-medium mb-2">Summary</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div><p className="text-muted-foreground">Total Subjects</p><p className="font-bold text-lg">{reportCards.length}</p></div>
                      <div><p className="text-muted-foreground">Total Score</p><p className="font-bold text-lg">{totalScore}</p></div>
                      <div><p className="text-muted-foreground">Average Score</p><p className="font-bold text-lg">{averageScore}%</p></div>
                      <div><p className="text-muted-foreground">Highest Score</p><p className="font-bold text-lg">{Math.max(...reportCards.map(r => r.score))}%</p></div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Student Selection View - Step 1: Select Class, Step 2: Select Student
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Report Cards</h1>
          <p className="text-muted-foreground">Select a class and student to view or manage scores</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Step 1: Select Class</label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((cls) => (<SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative space-y-2">
          <label className="text-sm font-medium">Step 2: Search Student</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </div>
      </motion.div>

      {/* Students Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="card-premium">
          <CardHeader>
            <CardTitle>Select Student</CardTitle>
            <CardDescription>{filteredStudents.length} students found</CardDescription>
          </CardHeader>
          <CardContent>
            {studentsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (<div key={i} className="p-4 border rounded-lg"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div></div></div>))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8"><User className="w-12 h-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">No students found</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setSelectedStudent(student)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-primary" /></div>
                      <div>
                        <h3 className="font-medium">{student.full_name}</h3>
                        <p className="text-sm text-muted-foreground">{student.admission_number}</p>
                        <p className="text-xs text-muted-foreground">{student.classes?.name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
