import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Search, DollarSign, CreditCard, AlertTriangle, User } from 'lucide-react';
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
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { FinanceEntry } from '@/components/forms/FinanceEntry';
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

interface FeePayment {
  id: string;
  student_id: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
  status: string;
  notes?: string;
  students?: Student;
  fee_structures?: {
    amount: number;
    term: string;
    academic_year: string;
  };
}

export default function Finance() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showFinanceEntry, setShowFinanceEntry] = useState(false);
  const { toast } = useToast();

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
      
      if (error) {
        console.error('Error fetching students:', error);
        throw error;
      }
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

  // Fetch fee payments with related data
  const { data: payments = [], isLoading: paymentsLoading, refetch } = useQuery({
    queryKey: ['fee-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_payments')
        .select(`
          *,
          students (
            id,
            full_name,
            admission_number,
            class_id,
            classes (
              name
            )
          ),
          fee_structures (
            amount,
            term,
            academic_year
          )
        `)
        .order('payment_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching payments:', error);
        throw error;
      }
      return data as FeePayment[];
    }
  });

  const filteredPayments = payments.filter(payment => {
    const studentName = payment.students?.full_name || '';
    const studentAdmission = payment.students?.admission_number || '';
    const className = payment.students?.classes?.name || '';
    
    const matchesSearch = studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         studentAdmission.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || className === selectedClass;
    const matchesStatus = selectedStatus === 'all' || payment.status === selectedStatus;
    return matchesSearch && matchesClass && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate summary data
  const totalFees = payments.reduce((sum, payment) => 
    sum + (payment.fee_structures?.amount || 0), 0);
  const amountPaid = payments.reduce((sum, payment) => 
    sum + payment.amount_paid, 0);
  const outstanding = totalFees - amountPaid;

  const summaryData = [
    { title: 'Total Fees', value: formatCurrency(totalFees), icon: DollarSign, color: 'text-primary' },
    { title: 'Amount Paid', value: formatCurrency(amountPaid), icon: CreditCard, color: 'text-green-600' },
    { title: 'Outstanding', value: formatCurrency(outstanding), icon: AlertTriangle, color: 'text-red-600' },
  ];

  // Calculate status distribution
  const statusCounts = payments.reduce((acc, payment) => {
    acc[payment.status] = (acc[payment.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const total = payments.length || 1;
  const statusData = [
    { name: 'Paid', value: Math.round(((statusCounts.paid || 0) / total) * 100), color: '#10B981' },
    { name: 'Pending', value: Math.round(((statusCounts.pending || 0) / total) * 100), color: '#F59E0B' },
    { name: 'Overdue', value: Math.round(((statusCounts.overdue || 0) / total) * 100), color: '#EF4444' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'overdue': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };


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
                {selectedStudent.full_name}
              </h1>
              <p className="text-muted-foreground">
                {selectedStudent.admission_number} • {selectedStudent.classes?.name}
              </p>
            </div>
          </div>
          
          <Button 
            onClick={() => setShowFinanceEntry(true)}
            className="btn-gold shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </motion.div>

        {showFinanceEntry && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <FinanceEntry 
              onSuccess={() => {
                setShowFinanceEntry(false);
                refetch();
                toast({
                  title: "Success",
                  description: "Payment recorded successfully",
                });
              }}
            />
          </motion.div>
        )}

        {/* Student Payment History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>
                All payments for {selectedStudent.full_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments
                        .filter(p => p.student_id === selectedStudent.id)
                        .map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {new Date(payment.payment_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(payment.amount_paid)}
                          </TableCell>
                          <TableCell>{payment.payment_method}</TableCell>
                          <TableCell>{payment.receipt_number || '-'}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-md text-sm font-medium capitalize ${getStatusColor(payment.status)}`}>
                              {payment.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Finance</h1>
          <p className="text-muted-foreground">Track fees, payments, and financial records</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button 
            onClick={() => setShowFinanceEntry(true)}
            className="btn-gold w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </motion.div>

      {showFinanceEntry && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <FinanceEntry 
            onSuccess={() => {
              setShowFinanceEntry(false);
              refetch();
              toast({
                title: "Success",
                description: "Payment recorded successfully",
              });
            }}
          />
        </motion.div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {summaryData.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="card-premium">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {item.title}
                </CardTitle>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-xl lg:text-2xl font-bold">{item.value}</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Status Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Payment Status</CardTitle>
              <CardDescription>Distribution of payment statuses</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="space-y-2 mt-4">
                {statusData.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      ></div>
                      <span className="text-sm">{entry.name}</span>
                    </div>
                    <span className="text-sm font-medium">{entry.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      </div>

      {/* Payments Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="card-premium">
          <CardHeader>
            <CardTitle>Fee Payments</CardTitle>
            <CardDescription>
              {filteredPayments.length} payment records found
            </CardDescription>
          </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No payment records found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Mobile view */}
                  <div className="block lg:hidden space-y-4">
                    {filteredPayments.map((payment, index) => (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 border rounded-lg space-y-3 hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedStudent(payment.students!)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{payment.students?.full_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {payment.students?.admission_number}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-md text-sm font-medium capitalize ${getStatusColor(payment.status)}`}>
                            {payment.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Amount Paid</p>
                            <p className="font-medium">{formatCurrency(payment.amount_paid)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Date</p>
                            <p>{new Date(payment.payment_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Desktop view */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Fee Amount</TableHead>
                          <TableHead>Amount Paid</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Payment Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayments.map((payment, index) => (
                          <motion.tr
                            key={payment.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="hover:bg-muted/50"
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{payment.students?.full_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {payment.students?.admission_number}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                                {payment.students?.classes?.name}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(payment.fee_structures?.amount || 0)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(payment.amount_paid)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency((payment.fee_structures?.amount || 0) - payment.amount_paid)}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-md text-sm font-medium capitalize ${getStatusColor(payment.status)}`}>
                                {payment.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{payment.payment_method || '-'}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedStudent(payment.students!)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}