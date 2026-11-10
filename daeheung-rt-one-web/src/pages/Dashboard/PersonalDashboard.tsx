import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Notifications as NotificationsIcon,
  Star as StarIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useStore } from '../../store';
import { api } from '../../services/api';

// 타입 정의
interface UserStats {
  activeTasks: number;
  completedTasks: number;
  pendingApprovals: number;
  weeklyData: Array<{
    day: string;
    tasks: number;
    completed: number;
    efficiency: number;
  }>;
  monthlyData: Array<{
    month: string;
    tasks: number;
    completed: number;
    efficiency: number;
  }>;
  categoryData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    status: string;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    timestamp: string;
    read: boolean;
  }>;
  favoriteMenus: Array<{
    id: string;
    name: string;
    route: string;
    icon: string;
    description: string;
  }>;
  personalSettings: {
    theme: 'light' | 'dark';
    language: 'ko' | 'en';
    notifications: boolean;
    emailAlerts: boolean;
    smsAlerts: boolean;
  };
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string;
  assignedBy: string;
  progress: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

const PersonalDashboard: React.FC = () => {
  const { user } = useStore();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openSettings, setOpenSettings] = useState(false);
  const [openTaskDialog, setOpenTaskDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // 데이터 로드
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [statsResponse, tasksResponse, notificationsResponse] = await Promise.all([
          api.get('/dashboard/personal-stats'),
          api.get('/tasks/recent'),
          api.get('/notifications/personal')
        ]);

        if (statsResponse.data.success) {
          setUserStats(statsResponse.data.data);
        }
        if (tasksResponse.data.success) {
          setRecentTasks(tasksResponse.data.data);
        }
        if (notificationsResponse.data.success) {
          setNotifications(notificationsResponse.data.data);
        }
      } catch {
        setError('대시보드 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // 작업 상태 업데이트
  const handleTaskStatusUpdate = async (taskId: string, status: string) => {
    try {
      await api.put(`/tasks/${taskId}/status`, { status });
      setRecentTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: status as any } : task
      ));
    } catch {
      /* ignore */
    }
  };

  // 알림 읽음 처리
  const handleNotificationRead = async (notificationId: string) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications(prev => prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      ));
    } catch {
      /* ignore */
    }
  };

  // 설정 저장
  const handleSettingsSave = async (settings: any) => {
    try {
      await api.put('/user/settings', settings);
      setUserStats(prev => prev ? { ...prev, personalSettings: settings } : null);
      setOpenSettings(false);
    } catch {
      /* ignore */
    }
  };

  // 작업 상세 보기
  const handleTaskView = (task: Task) => {
    setSelectedTask(task);
    setOpenTaskDialog(true);
  };


  if (loading) {
    return (
      <Box sx={{ py: 8, px: 0, textAlign: 'center' }}>
        <Typography>로딩 중...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DashboardIcon color="primary" />
          개인 대시보드
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {user?.username}님의 업무 현황과 개인 통계를 확인하세요.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(4, 1fr)'
        },
        gap: 3,
        px: 3,
        pb: 3
      }}>
        {/* 개인 업무 현황 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon color="primary" />
              내 업무 현황
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">진행 중인 업무</Typography>
                <Typography variant="h6" color="primary.main">
                  {userStats?.activeTasks || 0}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">완료된 업무</Typography>
                <Typography variant="h6" color="success.main">
                  {userStats?.completedTasks || 0}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">결재 대기</Typography>
                <Typography variant="h6" color="warning.main">
                  {userStats?.pendingApprovals || 0}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* 최근 작업 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon color="primary" />
              최근 작업
            </Typography>
            <List dense>
              {recentTasks.slice(0, 5).map((task) => (
                <ListItem key={task.id} sx={{ px: 0 }}>
                  <ListItemIcon>
                    <AssignmentIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={task.title}
                    secondary={`${task.status} • ${task.dueDate}`}
                    onClick={() => handleTaskView(task)}
                    sx={{ cursor: 'pointer' }}
                  />
                  <Chip
                    label={task.status}
                    size="small"
                    color={task.status === 'completed' ? 'success' : 'default'}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        {/* 개인 통계 차트 */}
        <Card sx={{ gridColumn: 'span 2' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon color="primary" />
              주간 업무 통계
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userStats?.weeklyData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="tasks" stroke="#8884d8" strokeWidth={2} />
                <Line type="monotone" dataKey="completed" stroke="#82ca9d" strokeWidth={2} />
                <Line type="monotone" dataKey="efficiency" stroke="#ffc658" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 업무 분류 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StarIcon color="primary" />
              업무 분류
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={userStats?.categoryData || []}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {(userStats?.categoryData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 알림 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationsIcon color="primary" />
              알림
            </Typography>
            <List dense>
              {notifications.slice(0, 5).map((notification) => (
                <ListItem key={notification.id} sx={{ px: 0 }}>
                  <ListItemIcon>
                    <NotificationsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={notification.title}
                    secondary={notification.message}
                    onClick={() => handleNotificationRead(notification.id)}
                    sx={{ cursor: 'pointer' }}
                  />
                  <Chip
                    label={notification.type}
                    size="small"
                    color={notification.type === 'error' ? 'error' : 'default'}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        {/* 즐겨찾기 메뉴 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StarIcon color="primary" />
              즐겨찾기 메뉴
            </Typography>
            <List dense>
              {userStats?.favoriteMenus?.slice(0, 5).map((menu) => (
                <ListItem key={menu.id} sx={{ px: 0 }}>
                  <ListItemIcon>
                    <StarIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={menu.name}
                    secondary={menu.description}
                    onClick={() => window.location.href = menu.route}
                    sx={{ cursor: 'pointer' }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        {/* 개인 설정 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon color="primary" />
              개인 설정
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">테마</Typography>
                <Chip label={userStats?.personalSettings?.theme || 'light'} size="small" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">언어</Typography>
                <Chip label={userStats?.personalSettings?.language || 'ko'} size="small" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">알림</Typography>
                <Chip 
                  label={userStats?.personalSettings?.notifications ? 'ON' : 'OFF'} 
                  size="small" 
                  color={userStats?.personalSettings?.notifications ? 'success' : 'default'}
                />
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setOpenSettings(true)}
                startIcon={<SettingsIcon />}
              >
                설정 변경
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* 설정 다이얼로그 */}
      <Dialog open={openSettings} onClose={() => setOpenSettings(false)} maxWidth="md" fullWidth>
        <DialogTitle>개인 설정</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>테마</InputLabel>
              <Select
                value={userStats?.personalSettings?.theme || 'light'}
                onChange={(e) => setUserStats(prev => prev ? {
                  ...prev,
                  personalSettings: { ...prev.personalSettings, theme: e.target.value }
                } : null)}
              >
                <MenuItem value="light">라이트</MenuItem>
                <MenuItem value="dark">다크</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>언어</InputLabel>
              <Select
                value={userStats?.personalSettings?.language || 'ko'}
                onChange={(e) => setUserStats(prev => prev ? {
                  ...prev,
                  personalSettings: { ...prev.personalSettings, language: e.target.value }
                } : null)}
              >
                <MenuItem value="ko">한국어</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="subtitle2">알림 설정</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2">알림</Typography>
                <Chip 
                  label={userStats?.personalSettings?.notifications ? 'ON' : 'OFF'} 
                  size="small" 
                  color={userStats?.personalSettings?.notifications ? 'success' : 'default'}
                  onClick={() => setUserStats(prev => prev ? {
                    ...prev,
                    personalSettings: { ...prev.personalSettings, notifications: !prev.personalSettings.notifications }
                  } : null)}
                  sx={{ cursor: 'pointer' }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2">이메일 알림</Typography>
                <Chip 
                  label={userStats?.personalSettings?.emailAlerts ? 'ON' : 'OFF'} 
                  size="small" 
                  color={userStats?.personalSettings?.emailAlerts ? 'success' : 'default'}
                  onClick={() => setUserStats(prev => prev ? {
                    ...prev,
                    personalSettings: { ...prev.personalSettings, emailAlerts: !prev.personalSettings.emailAlerts }
                  } : null)}
                  sx={{ cursor: 'pointer' }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2">SMS 알림</Typography>
                <Chip 
                  label={userStats?.personalSettings?.smsAlerts ? 'ON' : 'OFF'} 
                  size="small" 
                  color={userStats?.personalSettings?.smsAlerts ? 'success' : 'default'}
                  onClick={() => setUserStats(prev => prev ? {
                    ...prev,
                    personalSettings: { ...prev.personalSettings, smsAlerts: !prev.personalSettings.smsAlerts }
                  } : null)}
                  sx={{ cursor: 'pointer' }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSettings(false)}>취소</Button>
          <Button onClick={() => handleSettingsSave(userStats?.personalSettings)} variant="contained">
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* 작업 상세 다이얼로그 */}
      <Dialog open={openTaskDialog} onClose={() => setOpenTaskDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>작업 상세</DialogTitle>
        <DialogContent>
          {selectedTask && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Typography variant="h6">{selectedTask.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedTask.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Chip label={selectedTask.status} size="small" />
                <Chip label={selectedTask.priority} size="small" />
                <Chip label={selectedTask.dueDate} size="small" />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2">진행률</Typography>
                <LinearProgress variant="determinate" value={selectedTask.progress} />
                <Typography variant="body2">{selectedTask.progress}%</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2">태그</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {selectedTask.tags.map((tag, index) => (
                    <Chip key={index} label={tag} size="small" />
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTaskDialog(false)}>닫기</Button>
          <Button 
            onClick={() => handleTaskStatusUpdate(selectedTask?.id || '', 'completed')} 
            variant="contained"
            disabled={selectedTask?.status === 'completed'}
          >
            완료 처리
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PersonalDashboard;
