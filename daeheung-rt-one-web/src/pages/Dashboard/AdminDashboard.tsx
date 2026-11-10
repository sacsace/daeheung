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
  Avatar,
  Chip,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  Paper,
  IconButton,
  ListItemAvatar,
  ListItemSecondaryAction,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow } from '@mui/material';
import {
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  Notifications as NotificationsIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  Report as ReportIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Storage as StorageIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon } from '@mui/icons-material';
import { api } from '../../services/api';

// 타입 정의
interface SystemMetrics {
  activeUsers: number;
  apiRequests: number;
  errorRate: number;
  responseTime: number;
  databaseConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  networkLatency: number;
  queueSize: number;
}

interface BusinessMetrics {
  totalInvoices: number;
  totalExpenses: number;
  pendingApprovals: number;
  userActivity: Array<{
    date: string;
    activeUsers: number;
    newUsers: number;
    sessions: number;
  }>;
  costTrends: Array<{
    month: string;
    cost: number;
    revenue: number;
    profit: number;
  }>;
  efficiencyScore: number;
  departmentPerformance: Array<{
    department: string;
    score: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'permission_change' | 'security_alert' | 'data_access';
  user: string;
  description: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress: string;
  userAgent: string;
  status: 'resolved' | 'pending' | 'investigating';
}

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface UserActivity {
  id: string;
  username: string;
  role: string;
  lastLogin: string;
  status: 'online' | 'offline' | 'idle';
  ipAddress: string;
  sessionDuration: number;
  actionsCount: number;
}

const AdminDashboard: React.FC = () => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [businessMetrics, setBusinessMetrics] = useState<BusinessMetrics | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserActivity | null>(null);
  const [openAlertDialog, setOpenAlertDialog] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null);

  // 데이터 로드
  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);
      try {
        const [systemResponse, businessResponse, securityResponse, alertsResponse, usersResponse] = await Promise.all([
          api.get('/admin/system-metrics'),
          api.get('/admin/business-metrics'),
          api.get('/admin/security-events'),
          api.get('/admin/system-alerts'),
          api.get('/admin/user-activities')
        ]);

        if (systemResponse.data.success) {
          setSystemMetrics(systemResponse.data.data);
        }
        if (businessResponse.data.success) {
          setBusinessMetrics(businessResponse.data.data);
        }
        if (securityResponse.data.success) {
          setSecurityEvents(securityResponse.data.data);
        }
        if (alertsResponse.data.success) {
          setSystemAlerts(alertsResponse.data.data);
        }
        if (usersResponse.data.success) {
          setUserActivities(usersResponse.data.data);
        }
      } catch {
        setError('관리자 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  // 사용자 상태 업데이트
  const handleUserStatusUpdate = async (userId: string, status: string) => {
    try {
      await api.put(`/admin/users/${userId}/status`, { status });
      setUserActivities(prev => prev.map(user => 
        user.id === userId ? { ...user, status: status as any } : user
      ));
    } catch {
      /* ignore */
    }
  };

  // 알림 해결
  const handleAlertResolve = async (alertId: string) => {
    try {
      await api.put(`/admin/alerts/${alertId}/resolve`);
      setSystemAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, resolved: true } : alert
      ));
    } catch {
      /* ignore */
    }
  };

  // 보안 이벤트 상세 보기
  const handleSecurityEventView = (event: SecurityEvent) => {
    setSelectedAlert(event as any);
    setOpenAlertDialog(true);
  };

  // 상태 색상 반환
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'default';
      case 'idle': return 'warning';
      case 'resolved': return 'success';
      case 'pending': return 'warning';
      case 'investigating': return 'error';
      default: return 'default';
    }
  };

  // 심각도 색상 반환
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'default';
    }
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
          <AdminPanelSettingsIcon color="primary" />
          관리자 대시보드
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          시스템 현황과 보안 모니터링을 관리하세요.
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
        {/* 시스템 현황 */}
        <Card sx={{ gridColumn: 'span 2' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AnalyticsIcon color="primary" />
              시스템 현황
            </Typography>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(4, 1fr)'
              },
              gap: 3 
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary.main">
                  {systemMetrics?.activeUsers || 0}
                </Typography>
                <Typography variant="body2">활성 사용자</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {systemMetrics?.apiRequests || 0}
                </Typography>
                <Typography variant="body2">API 요청</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {systemMetrics?.errorRate || 0}%
                </Typography>
                <Typography variant="body2">에러율</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {systemMetrics?.responseTime || 0}ms
                </Typography>
                <Typography variant="body2">응답 시간</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* 시스템 리소스 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorageIcon color="primary" />
              시스템 리소스
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2">CPU 사용률</Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={systemMetrics?.cpuUsage || 0} 
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {systemMetrics?.cpuUsage || 0}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2">메모리 사용률</Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={systemMetrics?.memoryUsage || 0} 
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {systemMetrics?.memoryUsage || 0}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2">디스크 사용률</Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={systemMetrics?.diskUsage || 0} 
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {systemMetrics?.diskUsage || 0}%
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* 비즈니스 메트릭 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon color="primary" />
              비즈니스 메트릭
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">총 인보이스</Typography>
                <Typography variant="h6">{businessMetrics?.totalInvoices || 0}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">총 지출</Typography>
                <Typography variant="h6">Rs. {(businessMetrics?.totalExpenses || 0).toLocaleString()}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">승인 대기</Typography>
                <Typography variant="h6">{businessMetrics?.pendingApprovals || 0}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">효율성 점수</Typography>
                <Typography variant="h6">{businessMetrics?.efficiencyScore || 0}%</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* 보안 이벤트 */}
        <Card sx={{ gridColumn: 'span 2' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon color="primary" />
              보안 이벤트
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>이벤트</TableCell>
                    <TableCell>사용자</TableCell>
                    <TableCell>시간</TableCell>
                    <TableCell>심각도</TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell>작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {securityEvents.slice(0, 5).map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.description}</TableCell>
                      <TableCell>{event.user}</TableCell>
                      <TableCell>{event.timestamp}</TableCell>
                      <TableCell>
                        <Chip
                          label={event.severity}
                          size="small"
                          color={getSeverityColor(event.severity) as any}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={event.status}
                          size="small"
                          color={getStatusColor(event.status) as any}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleSecurityEventView(event)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* 시스템 알림 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationsIcon color="primary" />
              시스템 알림
            </Typography>
            <List dense>
              {systemAlerts.slice(0, 5).map((alert) => (
                <ListItem key={alert.id} sx={{ px: 0 }}>
                  <ListItemIcon>
                    {alert.type === 'error' ? <ErrorIcon color="error" /> :
                     alert.type === 'warning' ? <WarningIcon color="warning" /> :
                     alert.type === 'info' ? <InfoIcon color="info" /> :
                     <CheckCircleOutlineIcon color="success" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={alert.title}
                    secondary={alert.message}
                    onClick={() => setSelectedAlert(alert)}
                    sx={{ cursor: 'pointer' }}
                  />
                  <ListItemSecondaryAction>
                    <Chip
                      label={alert.priority}
                      size="small"
                      color={getSeverityColor(alert.priority) as any}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        {/* 사용자 활동 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon color="primary" />
              사용자 활동
            </Typography>
            <List dense>
              {userActivities.slice(0, 5).map((user) => (
                <ListItem key={user.id} sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {user.username.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.username}
                    secondary={`${user.role} • ${user.lastLogin}`}
                    onClick={() => setSelectedUser(user)}
                    sx={{ cursor: 'pointer' }}
                  />
                  <ListItemSecondaryAction>
                    <Chip
                      label={user.status}
                      size="small"
                      color={getStatusColor(user.status) as any}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        {/* 부서별 성과 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReportIcon color="primary" />
              부서별 성과
            </Typography>
            <List dense>
              {businessMetrics?.departmentPerformance?.map((dept, index) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemText
                    primary={dept.department}
                    secondary={`${dept.score}점`}
                  />
                  <Chip
                    label={dept.trend}
                    size="small"
                    color={dept.trend === 'up' ? 'success' : dept.trend === 'down' ? 'error' : 'default'}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Box>

      {/* 사용자 상세 다이얼로그 */}
      <Dialog open={openUserDialog} onClose={() => setOpenUserDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon color="primary" />
            {selectedUser?.username}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 64, height: 64 }}>
                  {selectedUser.username.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedUser.username}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedUser.role}
                  </Typography>
                  <Chip
                    label={selectedUser.status}
                    size="small"
                    color={getStatusColor(selectedUser.status) as any}
                  />
                </Box>
              </Box>
              
              <Divider />
              
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)'
                },
                gap: 2 
              }}>
                <Box>
                  <Typography variant="subtitle2">마지막 로그인</Typography>
                  <Typography variant="body2">{selectedUser.lastLogin}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">IP 주소</Typography>
                  <Typography variant="body2">{selectedUser.ipAddress}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">세션 지속 시간</Typography>
                  <Typography variant="body2">{selectedUser.sessionDuration}분</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">액션 수</Typography>
                  <Typography variant="body2">{selectedUser.actionsCount}</Typography>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenUserDialog(false)}>닫기</Button>
          <Button 
            variant="contained" 
            startIcon={<LockIcon />}
            onClick={() => handleUserStatusUpdate(selectedUser?.id || '', 'offline')}
          >
            세션 종료
          </Button>
        </DialogActions>
      </Dialog>

      {/* 알림 상세 다이얼로그 */}
      <Dialog open={openAlertDialog} onClose={() => setOpenAlertDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsIcon color="primary" />
            {selectedAlert?.title}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body1">{selectedAlert.message}</Typography>
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip label={selectedAlert.type} size="small" color="primary" />
                <Chip label={selectedAlert.priority} size="small" color="secondary" />
                <Chip 
                  label={selectedAlert.resolved ? '해결됨' : '미해결'} 
                  size="small" 
                  color={selectedAlert.resolved ? 'success' : 'error'}
                />
              </Box>

              <Typography variant="body2" color="text.secondary">
                발생 시간: {selectedAlert.timestamp}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAlertDialog(false)}>닫기</Button>
          {!selectedAlert?.resolved && (
            <Button 
              variant="contained" 
              onClick={() => handleAlertResolve(selectedAlert?.id || '')}
            >
              해결 처리
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDashboard;
