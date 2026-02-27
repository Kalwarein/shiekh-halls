import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Search, DollarSign, CreditCard, AlertTriangle, User, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { FinanceEntry } from '@/components/forms/FinanceEntry';
import { FeeStructureManager } from '@/components/finance/FeeStructureManager';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { formatCurrency } from '@/lib/currency';

export default function Finance() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [showFinanceEntry, setShowFinanceEntry] = useState(false);
  const { toast } = useToast();
  const { selectedYearId } = useAcademicYear();

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: payments = [], isLoading: paymentsLoading, refetch } = useQuery({
    queryKey: ['fee-payments', selectedYearId],
    queryFn: async () => {
      let query = supabase.from('fee_payments').select(`*, students (id, full_name, admission_number, class_id, classes (name)), fee_structures (amount, total_fee, tuition_fee, exam_fee, other_fee)`).order('payment_date', { ascending: false });
      if (selectedYearId) query = query.eq('academic_year_id', selectedYearId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // Get fee structures for balance calculation
  const { data: feeStructures = [] } = useQuery({
    queryKey: ['fee-structures-all', selectedYearId],
    queryFn: async () => {
      let query = supabase.from('fee_structures').select('*, classes (name)').eq('is_active', true);
      if (selectedYearId) query = query.eq('academic_year_id', selectedYearId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const filteredPayments = payments.filter(payment => {
    const studentName = (payment.students as any)?.full_name || '';
    const studentAdmission = (payment.students as any)?.admission_number || '';
    const className = (payment.students as any)?.classes?.name || '';
    const matchesSearch = studentName.toLowerCase().includes(searchQuery.toLowerCase()) || studentAdmission.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || className === selectedClass;
    return matchesSearch && matchesClass;
  });

  const amountPaid = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const totalExpected = feeStructures.reduce((sum, fs) => sum + Number(fs.total_fee || fs.amount || 0), 0);
  const outstanding = totalExpected > amountPaid ? totalExpected - amountPaid : 0;

  const summaryData = [
    { title: 'Total Expected', value: formatCurrency(totalExpected), icon: DollarSign, color: 'text-primary' },
    { title: 'Amount Collected', value: formatCurrency(amountPaid), icon: CreditCard, color: 'text-green-600' },
    { title: 'Outstanding', value: formatCurrency(outstanding), icon: AlertTriangle, color: 'text-red-600' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'overdue': return 'text-red-600 bg-red-50';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Finance</h1>
          <p className="text-muted-foreground">Track fees, payments, and financial records</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto"><Download className="w-4 h-4 mr-2" />Export</Button>
          <Button onClick={() => setShowFinanceEntry(true)} className="btn-gold w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" />Record Payment</Button>
        </div>
      </motion.div>

      {showFinanceEntry && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <FinanceEntry onSuccess={() => { setShowFinanceEntry(false); refetch(); }} />
        </motion.div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {summaryData.map((item, index) => (
          <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
            <Card className="card-premium">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </CardHeader>
              <CardContent>{paymentsLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-xl lg:text-2xl font-bold">{item.value}</div>}</CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payments"><CreditCard className="w-4 h-4 mr-2" />Payments</TabsTrigger>
          <TabsTrigger value="fee-structures"><Settings2 className="w-4 h-4 mr-2" />Fee Structures</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger><SelectValue placeholder="Filter by class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(cls => <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Payments Table */}
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Payment Records</CardTitle>
              <CardDescription>{filteredPayments.length} records found</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
              ) : filteredPayments.length === 0 ? (
                <div className="text-center py-8"><p className="text-muted-foreground">No payment records found</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Amount Paid</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{(payment.students as any)?.full_name}</p>
                              <p className="text-sm text-muted-foreground">{(payment.students as any)?.admission_number}</p>
                            </div>
                          </TableCell>
                          <TableCell><span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">{(payment.students as any)?.classes?.name}</span></TableCell>
                          <TableCell className="font-medium">{formatCurrency(Number(payment.amount_paid))}</TableCell>
                          <TableCell>{payment.payment_method || '-'}</TableCell>
                          <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                          <TableCell>{payment.receipt_number || '-'}</TableCell>
                          <TableCell><span className={`px-2 py-1 rounded-md text-sm font-medium capitalize ${getStatusColor(payment.status || 'pending')}`}>{payment.status}</span></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fee-structures">
          <FeeStructureManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
