import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  InputAdornment,
  LinearProgress
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Schedule as ScheduleIcon,
  Flag as FlagIcon } from '@mui/icons-material';

const TaskManagement: React.FC = () => {
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: '웹사이트 리뉴얼 프로젝트',
      description: '기존 웹사이트를 모던한 디자인으로 리뉴얼',
      assignee: '김철수',
      priority: 'high',
      status: 'in_progress',
      progress: 65,
      dueDate: '2024-02-15',
      createdDate: '2024-01-01',
      tags: ['프론트엔드', '디자인']
    },
    {
      id: 2,
      title: '데이터베이스 최적화',
      description: '성능 개선을 위한 DB 쿼리 최적화 작업',
      assignee: '이영희',
      priority: 'medium',
      status: 'pending',
      progress: 0,
      dueDate: '2024-02-20',
      createdDate: '2024-01-05',
      tags: ['백엔드', '데이터베이스']
    },
    {
      id: 3,
      title: '모바일 앱 개발',
      description: 'iOS/Android 네이티브 앱 개발',
      assignee: '박민수',
      priority: 'high',
      status: 'completed',
      progress: 100,
      dueDate: '2024-01-30',
      createdDate: '2023-12-01',
      tags: ['모바일', '앱개발']
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee: '',
    priority: 'medium',
    dueDate: '',
    tags: ''
  });

  const handleAdd = () => {
    setSelectedTask(null);
    setFormData({
      title: '',
      description: '',
      assignee: '',
      priority: 'medium',
      dueDate: '',
      tags: ''
    });
    setOpenDialog(true);
  };

  const handleEdit = (task: any) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      priority: task.priority,
      dueDate: task.dueDate,
      tags: task.tags.join(', ')
    });
    setOpenDialog(true);
  };

  const handleSave = () => {
    if (selectedTask) {
      // 수정
      setTasks(tasks.map(task => 
        task.id === selectedTask.id 
          ? { 
              ...task, 
              ...formData,
              tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
            }
          : task
      ));
    } else {
      // 추가
      const newTask = {
        id: tasks.length + 1,
        ...formData,
        status: 'pending',
        progress: 0,
        createdDate: new Date().toISOString().split('T')[0],
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };
      setTasks([...tasks, newTask]);
    }
    setOpenDialog(false);
  };

  const handleDelete = (id: number) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return '높음';
      case 'medium': return '보통';
      case 'low': return '낮음';
      default: return priority;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'pending': return 'warning';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return '완료';
      case 'in_progress': return '진행중';
      case 'pending': return '대기';
      case 'cancelled': return '취소';
      default: return status;
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.assignee.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader title="업무 관리" />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              총 업무 수
            </Typography>
            <Typography variant="h4" color="primary.main">
              {tasks.length}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              완료된 업무
            </Typography>
            <Typography variant="h4" color="success.main">
              {tasks.filter(task => task.status === 'completed').length}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              진행중인 업무
            </Typography>
            <Typography variant="h4" color="info.main">
              {tasks.filter(task => task.status === 'in_progress').length}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              평균 진행률
            </Typography>
            <Typography variant="h4" color="warning.main">
              {Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)}%
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '4fr 2fr 2fr 2fr' }, gap: 2, alignItems: 'center' }}>
            <TextField
              fullWidth
              size="small"
              label="검색"
              placeholder="업무명, 설명, 담당자로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ) }}
            />
            <TextField
              fullWidth
              size="small"
              select
              label="상태"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="pending">대기</MenuItem>
              <MenuItem value="in_progress">진행중</MenuItem>
              <MenuItem value="completed">완료</MenuItem>
              <MenuItem value="cancelled">취소</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              select
              label="우선순위"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="high">높음</MenuItem>
              <MenuItem value="medium">보통</MenuItem>
              <MenuItem value="low">낮음</MenuItem>
            </TextField>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
            >
              업무 추가
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            업무 목록 ({filteredTasks.length}건)
          </Typography>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>업무 정보</TableCell>
                  <TableCell>담당자</TableCell>
                  <TableCell>우선순위</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>진행률</TableCell>
                  <TableCell>마감일</TableCell>
                  <TableCell>태그</TableCell>
                  <TableCell>작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          {task.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          maxWidth: 200
                        }}>
                          {task.description}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 1, width: 24, height: 24, bgcolor: 'primary.main' }}>
                          {task.assignee.charAt(0)}
                        </Avatar>
                        <Typography variant="body2">{task.assignee}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getPriorityLabel(task.priority)}
                        color={getPriorityColor(task.priority) as any}
                        size="small"
                        icon={<FlagIcon />}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(task.status)}
                        color={getStatusColor(task.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={task.progress}
                          sx={{ width: 60, height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption">{task.progress}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ScheduleIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
                        <Typography variant="caption">{task.dueDate}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {task.tags.map((tag, index) => (
                          <Chip
                            key={index}
                            label={tag}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(task)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(task.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* 업무 추가/수정 다이얼로그 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedTask ? '업무 수정' : '새 업무 추가'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="업무명"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
            <TextField
              fullWidth
              label="담당자"
              value={formData.assignee}
              onChange={(e) => setFormData({...formData, assignee: e.target.value})}
            />
            <TextField
              fullWidth
              label="설명"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}
            />
            <FormControl fullWidth>
              <InputLabel>우선순위</InputLabel>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
              >
                <MenuItem value="low">낮음</MenuItem>
                <MenuItem value="medium">보통</MenuItem>
                <MenuItem value="high">높음</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="마감일"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label="태그 (쉼표로 구분)"
              value={formData.tags}
              onChange={(e) => setFormData({...formData, tags: e.target.value})}
              sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>취소</Button>
          <Button onClick={handleSave} variant="contained">저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TaskManagement;
