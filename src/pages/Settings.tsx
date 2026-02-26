import { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Key, Users, Database, Shield, Plus, Edit2, Trash2, Star, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    academicYears,
    activeYear,
    createYear,
    setActiveYear,
    updateYear,
    deleteYear,
  } = useAcademicYear();

  const [newYearName, setNewYearName] = useState('');
  const [editingYear, setEditingYear] = useState<{ id: string; name: string } | null>(null);
  const [isAddYearOpen, setIsAddYearOpen] = useState(false);

  // Subject management state
  const [selectedClassId, setSelectedClassId] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [editingSubject, setEditingSubject] = useState<{ id: string; name: string; code: string } | null>(null);

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch subjects for selected class
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', selectedClassId],
    queryFn: async () => {
      if (!selectedClassId) return [];
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('class_id', selectedClassId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClassId,
  });

  const handleAddYear = async () => {
    if (!newYearName.trim()) return;
    try {
      await createYear(newYearName.trim());
      setNewYearName('');
      setIsAddYearOpen(false);
      toast({ title: 'Success', description: 'Academic year added' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateYear = async () => {
    if (!editingYear) return;
    try {
      await updateYear(editingYear.id, editingYear.name);
      setEditingYear(null);
      toast({ title: 'Success', description: 'Academic year updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteYear = async (id: string) => {
    try {
      await deleteYear(id);
      toast({ title: 'Success', description: 'Academic year removed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      await setActiveYear(id);
      toast({ title: 'Success', description: 'Active academic year updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddSubject = async () => {
    if (!newSubjectName.trim() || !newSubjectCode.trim() || !selectedClassId) return;
    try {
      const { error } = await supabase.from('subjects').insert({
        name: newSubjectName.trim(),
        code: newSubjectCode.trim(),
        class_id: selectedClassId,
      });
      if (error) throw error;
      setNewSubjectName('');
      setNewSubjectCode('');
      queryClient.invalidateQueries({ queryKey: ['subjects', selectedClassId] });
      toast({ title: 'Success', description: 'Subject added' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message?.includes('unique_subject_per_class') ? 'Subject already exists in this class' : error.message, variant: 'destructive' });
    }
  };

  const handleUpdateSubject = async () => {
    if (!editingSubject) return;
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ name: editingSubject.name, code: editingSubject.code })
        .eq('id', editingSubject.id);
      if (error) throw error;
      setEditingSubject(null);
      queryClient.invalidateQueries({ queryKey: ['subjects', selectedClassId] });
      toast({ title: 'Success', description: 'Subject updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteSubject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['subjects', selectedClassId] });
      toast({ title: 'Success', description: 'Subject removed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage system settings and configuration</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs defaultValue="academic-year" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="academic-year" className="flex items-center space-x-2">
              <Star className="w-4 h-4" />
              <span>Academic Year</span>
            </TabsTrigger>
            <TabsTrigger value="subjects" className="flex items-center space-x-2">
              <Database className="w-4 h-4" />
              <span>Subjects</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>System</span>
            </TabsTrigger>
          </TabsList>

          {/* Academic Year Tab */}
          <TabsContent value="academic-year" className="space-y-4">
            <Card className="card-premium">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Academic Year Management</CardTitle>
                  <CardDescription>Create and manage academic years. The active year determines which data is shown across the system.</CardDescription>
                </div>
                <Dialog open={isAddYearOpen} onOpenChange={setIsAddYearOpen}>
                  <DialogTrigger asChild>
                    <Button className="btn-gold">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Year
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Academic Year</DialogTitle>
                      <DialogDescription>Enter the academic year name (e.g., 2025-2026)</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Year Name</Label>
                        <Input
                          placeholder="e.g., 2025-2026"
                          value={newYearName}
                          onChange={(e) => setNewYearName(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddYearOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddYear} className="btn-gold">Add Year</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {activeYear && (
                  <div className="mb-6 p-4 bg-accent/50 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium">Active Academic Year</p>
                    <p className="text-2xl font-bold text-primary">{activeYear.name}</p>
                  </div>
                )}
                <div className="space-y-3">
                  {academicYears.map((year) => (
                    <div key={year.id} className="flex items-center justify-between p-4 border rounded-lg">
                      {editingYear?.id === year.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingYear.name}
                            onChange={(e) => setEditingYear({ ...editingYear, name: e.target.value })}
                          />
                          <Button size="sm" onClick={handleUpdateYear} className="btn-gold">Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingYear(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{year.name}</span>
                            {year.is_active && (
                              <Badge className="bg-green-100 text-green-800 border-0">Active</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!year.is_active && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetActive(year.id)}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Set Active
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setEditingYear({ id: year.id, name: year.name })}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {!year.is_active && (
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteYear(year.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {academicYears.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No academic years created yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subjects Tab */}
          <TabsContent value="subjects" className="space-y-4">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle>Subject Management</CardTitle>
                <CardDescription>Add and manage subjects for each class</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Select Class</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedClassId && (
                  <>
                    {/* Add Subject Form */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-2">
                        <Label>Subject Name</Label>
                        <Input
                          placeholder="e.g., Mathematics"
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                        />
                      </div>
                      <div className="w-32 space-y-2">
                        <Label>Code</Label>
                        <Input
                          placeholder="e.g., MATH"
                          value={newSubjectCode}
                          onChange={(e) => setNewSubjectCode(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleAddSubject} className="btn-gold">
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>

                    {/* Subject List */}
                    <div className="space-y-2">
                      {subjects.map((subject) => (
                        <div key={subject.id} className="flex items-center justify-between p-3 border rounded-lg">
                          {editingSubject?.id === subject.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editingSubject.name}
                                onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                              />
                              <Input
                                value={editingSubject.code}
                                onChange={(e) => setEditingSubject({ ...editingSubject, code: e.target.value })}
                                className="w-24"
                              />
                              <Button size="sm" onClick={handleUpdateSubject} className="btn-gold">Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingSubject(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span className="font-medium">{subject.name}</span>
                                <span className="text-sm text-muted-foreground ml-2">({subject.code})</span>
                              </div>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setEditingSubject({ id: subject.id, name: subject.name, code: subject.code })}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteSubject(subject.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {subjects.length === 0 && selectedClassId && (
                        <p className="text-center text-muted-foreground py-4">No subjects added for this class yet</p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-4">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>View system details and configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">School Name</p>
                    <p className="text-sm text-muted-foreground">Sheikh Tais Academy</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">Active Academic Year</p>
                    <p className="text-sm text-muted-foreground">{activeYear?.name || 'Not set'}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">Currency</p>
                    <p className="text-sm text-muted-foreground">Le (Sierra Leone Leone)</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">Database Status</p>
                    <p className="text-sm text-green-600">Connected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
