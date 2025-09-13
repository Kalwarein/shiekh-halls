import { motion } from 'framer-motion';
import { Users, BookOpen, DollarSign, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function Dashboard() {
  // Fetch students count
  const { data: studentsCount = 0, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    }
  });

  // Fetch classes count
  const { data: classesCount = 0, isLoading: classesLoading } = useQuery({
    queryKey: ['classes-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    }
  });

  // Fetch fee payments data
  const { data: feeData, isLoading: feeLoading } = useQuery({
    queryKey: ['fee-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_payments')
        .select(`
          amount_paid,
          status,
          fee_structures (
            amount
          )
        `);
      
      if (error) throw error;
      
      const totalFees = data.reduce((sum, payment) => 
        sum + (payment.fee_structures?.amount || 0), 0);
      const amountPaid = data.reduce((sum, payment) => 
        sum + payment.amount_paid, 0);
      const outstanding = totalFees - amountPaid;

      // Calculate status distribution
      const statusCounts = data.reduce((acc, payment) => {
        acc[payment.status] = (acc[payment.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const total = data.length || 1;
      const paidPercentage = Math.round(((statusCounts.paid || 0) / total) * 100);
      const outstandingPercentage = 100 - paidPercentage;

      return {
        totalFees,
        amountPaid,
        outstanding,
        pieData: [
          { name: 'Paid', value: paidPercentage, color: '#10B981' },
          { name: 'Outstanding', value: outstandingPercentage, color: '#F59E0B' },
        ]
      };
    }
  });

  // Fetch attendance data
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance-summary'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          attendance_date,
          is_present,
          students (
            classes (
              name
            )
          )
        `)
        .gte('attendance_date', thirtyDaysAgo);
      
      if (error) throw error;
      
      // Calculate overall attendance percentage
      const totalRecords = data.length;
      const presentRecords = data.filter(record => record.is_present).length;
      const attendancePercentage = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

      // Group by class for grades chart
      const classAttendance = data.reduce((acc, record) => {
        const className = record.students?.classes?.name;
        if (!className) return acc;
        
        if (!acc[className]) {
          acc[className] = { present: 0, total: 0 };
        }
        
        acc[className].total++;
        if (record.is_present) {
          acc[className].present++;
        }
        
        return acc;
      }, {} as Record<string, { present: number; total: number }>);

      const gradesData = Object.entries(classAttendance).map(([className, stats]) => ({
        class: className.replace(/\s+/g, ' ').trim(),
        average: Math.round((stats.present / stats.total) * 100)
      })).slice(0, 6); // Limit to 6 classes

      // Generate monthly attendance trends (last 6 months)
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const monthRecords = data.filter(record => 
          record.attendance_date >= monthStart && record.attendance_date <= monthEnd
        );
        
        const monthPresent = monthRecords.filter(record => record.is_present).length;
        const monthTotal = monthRecords.length;
        const monthPercentage = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : 0;
        
        monthlyData.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          percentage: monthPercentage
        });
      }

      return {
        attendancePercentage,
        gradesData,
        monthlyData
      };
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const summaryData = [
    {
      title: 'Total Students',
      value: studentsCount.toString(),
      change: '+12%',
      icon: Users,
      color: 'text-blue-600',
      loading: studentsLoading,
    },
    {
      title: 'Total Classes',
      value: classesCount.toString(),
      change: '+2',
      icon: BookOpen,
      color: 'text-green-600',
      loading: classesLoading,
    },
    {
      title: 'Total Fees',
      value: feeData ? formatCurrency(feeData.totalFees) : '₦0',
      change: '+8%',
      icon: DollarSign,
      color: 'text-primary',
      loading: feeLoading,
    },
    {
      title: 'Avg Attendance',
      value: attendanceData ? `${attendanceData.attendancePercentage}%` : '0%',
      change: '+5%',
      icon: Calendar,
      color: 'text-purple-600',
      loading: attendanceLoading,
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to Sheikh Tais Academy Administration System
        </p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
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
                {item.loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold">{item.value}</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-600">{item.change}</span> from last month
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fee Collection Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Fee Collection Status</CardTitle>
              <CardDescription>Distribution of fee payments</CardDescription>
            </CardHeader>
            <CardContent>
              {feeLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : !feeData || feeData.pieData.every(d => d.value === 0) ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">No fee data available</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={feeData.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {feeData.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center space-x-4 mt-4">
                    {feeData.pieData.map((entry, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        ></div>
                        <span className="text-sm text-muted-foreground">
                          {entry.name}: {entry.value}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Class Performance Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Class Attendance Performance</CardTitle>
              <CardDescription>Average attendance by class</CardDescription>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : !attendanceData || attendanceData.gradesData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">No attendance data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceData.gradesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="class" 
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Bar dataKey="average" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Attendance Trends */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="card-premium">
          <CardHeader>
            <CardTitle>Attendance Trends</CardTitle>
            <CardDescription>Monthly attendance percentage</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : !attendanceData || attendanceData.monthlyData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No attendance trends available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={attendanceData.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}