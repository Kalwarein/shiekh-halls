import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Clock, Settings, Bell } from 'lucide-react';
import { toast } from 'sonner';

interface Class {
  id: string;
  name: string;
}

interface AttendanceNotification {
  id: string;
  class_id: string;
  notification_time: string;
  is_enabled: boolean;
}

export function AttendanceNotifications() {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [notificationTime, setNotificationTime] = useState<string>('14:00');
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [missedAttendanceClasses, setMissedAttendanceClasses] = useState<string[]>([]);

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data as Class[];
    },
  });

  // Fetch notification settings
  const { data: notifications = [] } = useQuery({
    queryKey: ['attendance-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_notifications')
        .select('*');
      
      if (error) throw error;
      return data as AttendanceNotification[];
    },
  });

  // Check for missed attendance (classes without attendance today)
  useEffect(() => {
    const checkMissedAttendance = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: attendanceToday, error } = await supabase
        .from('attendance')
        .select('student_id, students(class_id), classes(name)')
        .eq('attendance_date', today);

      if (error) {
        console.error('Error fetching attendance:', error);
        return;
      }

      // Get classes that had attendance taken today
      const classesWithAttendance = new Set(
        attendanceToday?.map(record => record.students?.class_id).filter(Boolean) || []
      );

      // Find classes without attendance
      const allClassIds = classes.map(c => c.id);
      const missedClasses = allClassIds.filter(classId => !classesWithAttendance.has(classId));
      
      setMissedAttendanceClasses(missedClasses);
    };

    if (classes.length > 0) {
      checkMissedAttendance();
      
      // Set up interval to check every hour
      const interval = setInterval(checkMissedAttendance, 60 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [classes]);

  const updateNotificationSettings = async () => {
    if (!selectedClass) {
      toast.error('Please select a class');
      return;
    }

    const existingNotification = notifications.find(n => n.class_id === selectedClass);

    try {
      if (existingNotification) {
        // Update existing notification
        const { error } = await supabase
          .from('attendance_notifications')
          .update({
            notification_time: notificationTime + ':00',
            is_enabled: isEnabled,
          })
          .eq('id', existingNotification.id);

        if (error) throw error;
      } else {
        // Create new notification
        const { error } = await supabase
          .from('attendance_notifications')
          .insert({
            class_id: selectedClass,
            notification_time: notificationTime + ':00',
            is_enabled: isEnabled,
          });

        if (error) throw error;
      }

      toast.success('Notification settings updated successfully');
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast.error('Failed to update notification settings');
    }
  };

  const getMissedClassNames = () => {
    return classes
      .filter(c => missedAttendanceClasses.includes(c.id))
      .map(c => c.name);
  };

  const currentHour = new Date().getHours();
  const shouldShowAlert = currentHour >= 14 && missedAttendanceClasses.length > 0;

  return (
    <div className="space-y-6">
      {/* Missed Attendance Alert */}
      {shouldShowAlert && (
        <Alert className="border-destructive bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">
            <strong>Attendance Missing:</strong> The following classes haven't had attendance taken today: {' '}
            <span className="font-medium">{getMissedClassNames().join(', ')}</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Notification Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Attendance Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <div className="text-2xl font-bold text-primary">{classes.length}</div>
              <div className="text-sm text-muted-foreground">Total Classes</div>
            </div>
            <div className="text-center p-4 bg-green-500/10 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {classes.length - missedAttendanceClasses.length}
              </div>
              <div className="text-sm text-muted-foreground">Attendance Taken</div>
            </div>
            <div className="text-center p-4 bg-destructive/10 rounded-lg">
              <div className="text-2xl font-bold text-destructive">{missedAttendanceClasses.length}</div>
              <div className="text-sm text-muted-foreground">Missing Attendance</div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Notification Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="class-select">Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger id="class-select">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((classItem) => (
                      <SelectItem key={classItem.id} value={classItem.id}>
                        {classItem.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notification-time" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Notification Time
                </Label>
                <input
                  id="notification-time"
                  type="time"
                  value={notificationTime}
                  onChange={(e) => setNotificationTime(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="enable-notifications">Enable Notifications</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enable-notifications"
                    checked={isEnabled}
                    onCheckedChange={setIsEnabled}
                  />
                  <Label htmlFor="enable-notifications" className="text-sm">
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </Label>
                </div>
              </div>
            </div>

            <Button onClick={updateNotificationSettings} className="w-full md:w-auto">
              Update Notification Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Settings Display */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Notification Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notifications.map((notification) => {
                const className = classes.find(c => c.id === notification.class_id)?.name || 'Unknown Class';
                return (
                  <div key={notification.id} className="p-4 border rounded-lg">
                    <h4 className="font-medium">{className}</h4>
                    <p className="text-sm text-muted-foreground">
                      Time: {notification.notification_time.slice(0, 5)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Status: {notification.is_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}