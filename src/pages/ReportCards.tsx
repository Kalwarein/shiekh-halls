import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Search, User, BookOpen, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  class_id: string;
  classes?: {
    name: string;
  };
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
  term: 'first' | 'second' | 'third';
  academic_year: string;
  score: number;
  grade: string;
  remarks?: string;
  students?: Student;
  subjects?: {
    name: string;
    code: string;
  };
}

const terms = ['first', 'second', 'third'];
const currentYear = new Date().getFullYear().toString();

export default function ReportCards() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedTerm, setSelectedTerm] = useState('first');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showGradeEntry, setShowGradeEntry] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch students with classes
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students-with-classes'],
    queryFn: async () => {
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
        .order('full_name');
      
      if (error) throw error;
      return data as Student[];
    }
  });

  // Fetch classes
  const { data: classes = [] } = useQuery({
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

  // Fetch subjects for selected student's class
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', selectedStudent?.class_id],
    queryFn: async () => {
      if (!selectedStudent?.class_id) return [];
      
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('class_id', selectedStudent.class_id)
        .order('name');
      
      if (error) throw error;
      return data as Subject[];
    },
    enabled: !!selectedStudent?.class_id
  });

  // Fetch report cards for selected student
  const { data: reportCards = [], isLoading: reportCardsLoading, refetch } = useQuery({
    queryKey: ['report-cards', selectedStudent?.id, selectedTerm, selectedYear],
    queryFn: async () => {
      if (!selectedStudent?.id) return [];
      
      const { data, error } = await supabase
        .from('report_cards')
        .select(`
          *,
          subjects (
            name,
            code
          )
        `)
        .eq('student_id', selectedStudent.id)
        .eq('term', selectedTerm as 'first' | 'second' | 'third')
        .eq('academic_year', selectedYear)
        .order('subjects(name)');
      
      if (error) throw error;
      return data as ReportCard[];
    },
    enabled: !!selectedStudent?.id
  });

  // Add/Update grade mutation
  const gradeMutation = useMutation({
    mutationFn: async (gradeData: {
      student_id: string;
      subject_id: string;
      term: string;
      academic_year: string;
      score: number;
      grade: string;
      remarks?: string;
    }) => {
      // Check if record exists
      const { data: existing } = await supabase
        .from('report_cards')
        .select('id')
        .eq('student_id', gradeData.student_id)
        .eq('subject_id', gradeData.subject_id)
        .eq('term', gradeData.term as 'first' | 'second' | 'third')
        .eq('academic_year', gradeData.academic_year)
        .single();

      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from('report_cards')
          .update({
            ...gradeData,
            term: gradeData.term as 'first' | 'second' | 'third'
          })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('report_cards')
          .insert([{
            ...gradeData,
            term: gradeData.term as 'first' | 'second' | 'third'
          }])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-cards'] });
      toast({
        title: "Success",
        description: "Grade saved successfully",
      });
    },
    onError: (error) => {
      console.error('Error saving grade:', error);
      toast({
        title: "Error",
        description: "Failed to save grade",
        variant: "destructive",
      });
    }
  });

  const calculateGrade = (score: number): string => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-600 bg-green-50';
    if (grade.startsWith('B')) return 'text-blue-600 bg-blue-50';
    if (grade.startsWith('C')) return 'text-yellow-600 bg-yellow-50';
    if (grade.startsWith('D')) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.admission_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || student.classes?.name === selectedClass;
    return matchesSearch && matchesClass;
  });

  // Student Report Card View
  if (selectedStudent) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
        >
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setSelectedStudent(null)}
              className="shrink-0"
            >
              ← Back
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {selectedStudent.full_name} - Report Card
              </h1>
              <p className="text-muted-foreground">
                {selectedStudent.admission_number} • {selectedStudent.classes?.name} • {selectedTerm.charAt(0).toUpperCase() + selectedTerm.slice(1)} Term {selectedYear}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button 
              onClick={() => setShowGradeEntry(!showGradeEntry)}
              className="btn-gold w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              {showGradeEntry ? 'Hide' : 'Add'} Grades
            </Button>
          </div>
        </motion.div>

        {/* Term and Year Selectors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Term</label>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term} value={term}>
                    {term.charAt(0).toUpperCase() + term.slice(1)} Term
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Academic Year</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2022">2022</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Grade Entry Form */}
        {showGradeEntry && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="card-premium">
              <CardHeader>
                <CardTitle>Add/Update Grades</CardTitle>
                <CardDescription>
                  Enter grades for each subject
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
                          <label className="text-sm font-medium">Score</label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={existingGrade?.score || ''}
                            id={`score-${subject.id}`}
                            placeholder="0-100"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Remarks</label>
                          <Input
                            defaultValue={existingGrade?.remarks || ''}
                            id={`remarks-${subject.id}`}
                            placeholder="Optional"
                          />
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
                                term: selectedTerm as 'first' | 'second' | 'third',
                                academic_year: selectedYear,
                                score,
                                grade: calculateGrade(score),
                                remarks: remarksInput.value || undefined,
                              });
                            } else {
                              toast({
                                title: "Invalid Score",
                                description: "Score must be between 0 and 100",
                                variant: "destructive",
                              });
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
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Report Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Academic Performance
              </CardTitle>
              <CardDescription>
                Grades for {selectedTerm.charAt(0).toUpperCase() + selectedTerm.slice(1)} Term {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportCardsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center p-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <div className="flex gap-4">
                        <Skeleton className="h-6 w-12" />
                        <Skeleton className="h-6 w-8" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : reportCards.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No grades recorded for this term</p>
                  <Button 
                    onClick={() => setShowGradeEntry(true)}
                    className="btn-gold mt-4"
                  >
                    Add Grades
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Mobile view */}
                  <div className="block sm:hidden space-y-4">
                    {reportCards.map((report) => (
                      <div key={report.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{report.subjects?.name}</h3>
                            <p className="text-sm text-muted-foreground">{report.subjects?.code}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{report.score}%</div>
                            <Badge className={`${getGradeColor(report.grade)} border-0`}>
                              {report.grade}
                            </Badge>
                          </div>
                        </div>
                        {report.remarks && (
                          <p className="text-sm text-muted-foreground italic">"{report.remarks}"</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop view */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportCards.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell className="font-medium">
                              {report.subjects?.name}
                            </TableCell>
                            <TableCell>{report.subjects?.code}</TableCell>
                            <TableCell className="font-bold text-lg">
                              {report.score}%
                            </TableCell>
                            <TableCell>
                              <Badge className={`${getGradeColor(report.grade)} border-0`}>
                                {report.grade}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {report.remarks || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary */}
                  <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                    <h3 className="font-medium mb-2">Summary</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Subjects</p>
                        <p className="font-bold text-lg">{reportCards.length}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Average Score</p>
                        <p className="font-bold text-lg">
                          {Math.round(reportCards.reduce((sum, r) => sum + r.score, 0) / reportCards.length)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Highest Score</p>
                        <p className="font-bold text-lg">
                          {Math.max(...reportCards.map(r => r.score))}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lowest Score</p>
                        <p className="font-bold text-lg">
                          {Math.min(...reportCards.map(r => r.score))}%
                        </p>
                      </div>
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

  // Student Selection View
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Report Cards</h1>
          <p className="text-muted-foreground">Select a student to view or manage their grades</p>
        </div>
        
        <Button variant="outline" className="w-full sm:w-auto">
          <Download className="w-4 h-4 mr-2" />
          Export All Reports
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.name}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Students Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="card-premium">
          <CardHeader>
            <CardTitle>Select Student</CardTitle>
            <CardDescription>
              {filteredStudents.length} students found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {studentsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8">
                <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No students found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudents.map((student, index) => (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{student.full_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {student.admission_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {student.classes?.name}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}