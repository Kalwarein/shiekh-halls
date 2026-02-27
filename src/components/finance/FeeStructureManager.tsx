import { useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { formatCurrency } from '@/lib/currency';

interface FeeStructureForm {
  classId: string;
  tuitionFee: string;
  examFee: string;
  otherFee: string;
}

export function FeeStructureManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedYearId, academicYears } = useAcademicYear();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FeeStructureForm>({ classId: '', tuitionFee: '', examFee: '', otherFee: '' });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: feeStructures = [], isLoading } = useQuery({
    queryKey: ['fee-structures-managed', selectedYearId],
    queryFn: async () => {
      let query = supabase.from('fee_structures').select('*, classes (name)').order('created_at', { ascending: false });
      if (selectedYearId) query = query.eq('academic_year_id', selectedYearId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const resetForm = () => {
    setForm({ classId: '', tuitionFee: '', examFee: '', otherFee: '' });
    setEditingId(null);
    setIsOpen(false);
  };

  const handleSave = async () => {
    if (!form.classId || !selectedYearId) {
      toast({ title: 'Error', description: 'Please select a class and ensure an academic year is active.', variant: 'destructive' });
      return;
    }

    const tuition = parseFloat(form.tuitionFee) || 0;
    const exam = parseFloat(form.examFee) || 0;
    const other = parseFloat(form.otherFee) || 0;
    const total = tuition + exam + other;

    if (total <= 0) {
      toast({ title: 'Error', description: 'Total fee must be greater than zero.', variant: 'destructive' });
      return;
    }

    try {
      // Check for duplicate (same class + academic year)
      if (!editingId) {
        const { data: existing } = await supabase
          .from('fee_structures')
          .select('id')
          .eq('class_id', form.classId)
          .eq('academic_year_id', selectedYearId)
          .eq('is_active', true)
          .limit(1);
        
        if (existing && existing.length > 0) {
          toast({ title: 'Duplicate', description: 'A fee structure already exists for this class and academic year.', variant: 'destructive' });
          return;
        }
      }

      const payload = {
        class_id: form.classId,
        academic_year_id: selectedYearId,
        tuition_fee: tuition,
        exam_fee: exam,
        other_fee: other,
        total_fee: total,
        amount: total,
        fee_type: 'annual',
        is_active: true,
      };

      if (editingId) {
        const { error } = await supabase.from('fee_structures').update(payload).eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Updated', description: 'Fee structure updated successfully.' });
      } else {
        const { error } = await supabase.from('fee_structures').insert(payload);
        if (error) throw error;
        toast({ title: 'Created', description: 'Fee structure created successfully.' });
      }

      queryClient.invalidateQueries({ queryKey: ['fee-structures-managed'] });
      resetForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (fs: any) => {
    setForm({
      classId: fs.class_id,
      tuitionFee: String(fs.tuition_fee || 0),
      examFee: String(fs.exam_fee || 0),
      otherFee: String(fs.other_fee || 0),
    });
    setEditingId(fs.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('fee_structures').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['fee-structures-managed'] });
      toast({ title: 'Removed', description: 'Fee structure deactivated.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const totalFee = (parseFloat(form.tuitionFee) || 0) + (parseFloat(form.examFee) || 0) + (parseFloat(form.otherFee) || 0);

  return (
    <Card className="card-premium">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Fee Structure Management</CardTitle>
          <CardDescription>Define fee breakdown per class for the selected academic year</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="btn-gold"><Plus className="w-4 h-4 mr-2" />Add Fee Structure</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'Create'} Fee Structure</DialogTitle>
              <DialogDescription>Define fees for a class in the current academic year</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tuition Fee (Le)</Label>
                <Input type="number" min="0" value={form.tuitionFee} onChange={(e) => setForm({ ...form, tuitionFee: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Exam Fee (Le)</Label>
                <Input type="number" min="0" value={form.examFee} onChange={(e) => setForm({ ...form, examFee: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Other Charges (Le)</Label>
                <Input type="number" min="0" value={form.otherFee} onChange={(e) => setForm({ ...form, otherFee: e.target.value })} placeholder="0" />
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Fee</p>
                <p className="text-xl font-bold">{formatCurrency(totalFee)}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button className="btn-gold" onClick={handleSave}>{editingId ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : feeStructures.filter(fs => fs.is_active).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No fee structures created for this academic year.</p>
            <p className="text-sm text-muted-foreground mt-1">Create one to start recording payments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Tuition</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Other</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeStructures.filter(fs => fs.is_active).map(fs => (
                  <TableRow key={fs.id}>
                    <TableCell className="font-medium">{(fs.classes as any)?.name}</TableCell>
                    <TableCell>{formatCurrency(fs.tuition_fee || 0)}</TableCell>
                    <TableCell>{formatCurrency(fs.exam_fee || 0)}</TableCell>
                    <TableCell>{formatCurrency(fs.other_fee || 0)}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(fs.total_fee || 0)}</TableCell>
                    <TableCell><Badge className="bg-green-100 text-green-800 border-0">Active</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(fs)}><Edit2 className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(fs.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
