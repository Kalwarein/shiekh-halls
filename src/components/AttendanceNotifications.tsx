import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Bell, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface AttendanceNotification {
  id: string;
  class_id: string;
  notification_time: string;
  is_enabled: boolean;
  classes?: {
    name: string;
  };
}

interface AttendanceStatus {
  class_id: string;
  class_name: string;
  has_attendance_today: boolean;
  student_count: number;
  attendance_count: number;
}

export function AttendanceNotifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notification settings
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['attendance-notifications'],
    queryFn: async () => {
      // For now, since attendance_notifications table may not exist yet, 
      // let's just return empty array and focus on the core functionality
      return [] as AttendanceNotification[];
    },
  });

  // Check today's attendance status
  const { data: attendanceStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['attendance-status-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Get all classes with their student counts and today's attendance
      const { data: classData, error } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          students!inner(id),
          attendance!left(
            id,
            attendance_date,
            student_id
          )
        `)
        .eq('attendance.attendance_date', today);

      if (error) throw error;

      const status: AttendanceStatus[] = classData.map((cls: any) => {
        const studentCount = cls.students?.length || 0;
        const attendanceRecords = cls.attendance?.filter((att: any) => 
          att.attendance_date === today
        ) || [];
        
        return {
          class_id: cls.id,
          class_name: cls.name,
          has_attendance_today: attendanceRecords.length > 0,
          student_count: studentCount,
          attendance_count: attendanceRecords.length,
        };
      });

      return status;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update notification settings
  const updateNotificationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AttendanceNotification> }) => {
      const { error } = await supabase
        .from('attendance_notifications')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-notifications'] });
      toast({
        title: 'Settings Updated',
        description: 'Notification settings have been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update notification settings.',
        variant: 'destructive',
      });
    },
  });

  const handleTimeChange = (id: string, time: string) => {
    updateNotificationMutation.mutate({
      id,
      data: { notification_time: time },
    });
  };

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    updateNotificationMutation.mutate({
      id,
      data: { is_enabled: enabled },
    });
  };

  const missedAttendanceClasses = attendanceStatus?.filter(
    status => !status.has_attendance_today && status.student_count > 0
  ) || [];

  if (notificationsLoading || statusLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Attendance Alerts */}
      {missedAttendanceClasses.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Missing Attendance Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                The following classes haven't taken attendance today:
              </p>
              <div className="grid gap-2">
                {missedAttendanceClasses.map((cls) => (
                  <div
                    key={cls.class_id}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{cls.class_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {cls.student_count} students
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        window.location.href = `/attendance?class=${cls.class_id}`;
                      }}
                    >
                      Take Attendance
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Attendance Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {notifications?.map((notification) => (
              <div
                key={notification.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{notification.classes?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Daily attendance reminder
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <Input
                      type="time"
                      value={notification.notification_time}
                      onChange={(e) => handleTimeChange(notification.id, e.target.value)}
                      className="w-24"
                      disabled={!notification.is_enabled}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={notification.is_enabled}
                      onCheckedChange={(checked) => 
                        handleToggleEnabled(notification.id, checked)
                      }
                    />
                    <Label className="text-sm">
                      {notification.is_enabled ? 'On' : 'Off'}
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Today's Attendance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {attendanceStatus?.map((status) => (
              <div
                key={status.class_id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  status.has_attendance_today 
                    ? 'bg-success/5 border-success/20' 
                    : 'bg-muted/50'
                }`}
              >
                <div>
                  <p className="font-medium">{status.class_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {status.attendance_count} / {status.student_count} recorded
                  </p>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  status.has_attendance_today ? 'bg-success' : 'bg-muted-foreground'
                }`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}