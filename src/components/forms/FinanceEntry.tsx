import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, DollarSign, Loader2, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FinanceEntryProps {
  onSuccess: () => void;
}

export function FinanceEntry({ onSuccess }: FinanceEntryProps) {
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch students with search
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select(`
          id,
          full_name,
          admission_number,
          class_id,
          classes (name)
        `)
        .order('full_name');

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,admission_number.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Fetch fee structures
  const { data: feeStructures } = useQuery({
    queryKey: ['fee-structures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_structures')
        .select(`
          id,
          term,
          amount,
          academic_year,
          fee_type,
          classes (name)
        `)
        .order('academic_year', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Record payment mutation
  const recordPayment = useMutation({
    mutationFn: async (paymentData: {
      studentId: string;
      feeStructureId: string;
      amount: number;
      paymentMethod: string;
      receiptNumber: string;
      notes: string;
    }) => {
      const { error } = await supabase
        .from('fee_payments')
        .insert({
          student_id: paymentData.studentId,
          fee_structure_id: paymentData.feeStructureId,
          amount_paid: paymentData.amount,
          payment_method: paymentData.paymentMethod,
          receipt_number: paymentData.receiptNumber,
          notes: paymentData.notes,
          status: 'paid'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Success!',
        description: 'Payment recorded successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['fee-payments'] });
      // Reset form
      setSelectedStudent('');
      setAmount('');
      setPaymentMethod('');
      setReceiptNumber('');
      setNotes('');
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to record payment',
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStudent || !amount) {
      toast({
        title: 'Validation Error',
        description: 'Please select a student and enter an amount',
        variant: 'destructive',
      });
      return;
    }

    // For now, we'll use the first fee structure as default
    // In a real implementation, you'd let users select the appropriate fee structure
    const defaultFeeStructure = feeStructures?.[0];
    if (!defaultFeeStructure) {
      toast({
        title: 'Error',
        description: 'No fee structure found. Please set up fee structures first.',
        variant: 'destructive',
      });
      return;
    }

    recordPayment.mutate({
      studentId: selectedStudent,
      feeStructureId: defaultFeeStructure.id,
      amount: parseFloat(amount),
      paymentMethod,
      receiptNumber,
      notes
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Student Search */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Select Student
          </CardTitle>
          <CardDescription>
            Search and select a student to record payment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name or admission number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {studentsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg"></div>
                ))}
              </div>
            ) : students?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {searchQuery ? 'No students found matching your search' : 'No students found'}
              </p>
            ) : (
              students?.map((student) => (
                <div
                  key={student.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedStudent === student.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-muted-foreground'
                  }`}
                  onClick={() => setSelectedStudent(student.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{student.full_name}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{student.admission_number}</span>
                        <span>{(student.classes as any)?.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      {selectedStudent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Record Payment
              </CardTitle>
              <CardDescription>
                Enter payment details for the selected student
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount Paid *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receiptNumber">Receipt Number</Label>
                  <Input
                    id="receiptNumber"
                    placeholder="Receipt number (optional)"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <Button type="button" variant="outline" onClick={onSuccess}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="btn-gold"
                    disabled={recordPayment.isPending}
                  >
                    {recordPayment.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      'Record Payment'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}