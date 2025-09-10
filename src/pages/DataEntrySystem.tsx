import { motion } from 'framer-motion';
import { Users, DollarSign, Calendar, GraduationCap, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { StudentForm } from '@/components/forms/StudentForm';
import { FinanceEntry } from '@/components/forms/FinanceEntry';
import { AttendanceEntry } from '@/components/forms/AttendanceEntry';

type ActiveModule = 'overview' | 'students' | 'finance' | 'attendance' | 'reports';

export default function DataEntrySystem() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('overview');

  const modules = [
    {
      id: 'students' as ActiveModule,
      title: 'Student Management',
      description: 'Add new students, update profiles, manage class assignments',
      icon: Users,
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'finance' as ActiveModule,
      title: 'Finance Management',
      description: 'Record payments, track fees, manage financial records',
      icon: DollarSign,
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'attendance' as ActiveModule,
      title: 'Attendance Entry',
      description: 'Mark daily attendance, track absences, add notes',
      icon: Calendar,
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'reports' as ActiveModule,
      title: 'Report Cards',
      description: 'Manage grades, generate reports, track academic progress',
      icon: GraduationCap,
      color: 'from-orange-500 to-orange-600'
    }
  ];

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'students':
        return <StudentForm onSuccess={() => setActiveModule('overview')} />;
      case 'finance':
        return <FinanceEntry onSuccess={() => setActiveModule('overview')} />;
      case 'attendance':
        return <AttendanceEntry onSuccess={() => setActiveModule('overview')} />;
      case 'reports':
        return (
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Report Cards Management</CardTitle>
              <CardDescription>Grade management system coming soon...</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => setActiveModule('overview')}>
                Back to Overview
              </Button>
            </CardContent>
          </Card>
        );
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modules.map((module, index) => (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className="card-premium cursor-pointer hover:shadow-lg transition-all duration-300 group"
                  onClick={() => setActiveModule(module.id)}
                >
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-r ${module.color} text-white group-hover:scale-110 transition-transform duration-300`}>
                        <module.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{module.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {module.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full btn-gold group-hover:shadow-md transition-shadow">
                      <Plus className="w-4 h-4 mr-2" />
                      Start Entry
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">Data Entry System</h1>
          <p className="text-muted-foreground">
            {activeModule === 'overview' 
              ? 'Select a module to start entering data'
              : `${modules.find(m => m.id === activeModule)?.title} Entry`
            }
          </p>
        </div>
        
        {activeModule !== 'overview' && (
          <Button 
            variant="outline" 
            onClick={() => setActiveModule('overview')}
          >
            Back to Overview
          </Button>
        )}
      </motion.div>

      <motion.div
        key={activeModule}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {renderActiveModule()}
      </motion.div>
    </div>
  );
}