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
  Tooltip,
  Alert
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';

const EMPLOYEE_MENU_ROUTES = ['/hr/users', '/hr'] as const;

const formatInrInt = (n: number) =>
  Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 });

const EmployeeManagement: React.FC = () => {
  const { t } = useTranslation();
  const menuFlags = useMenuRoutePermissionFlags(EMPLOYEE_MENU_ROUTES);
  const [employees, setEmployees] = useState([
    {
      id: 1,
      name: '김철수',
      employeeId: 'EMP001',
      department: '개발팀',
      position: '팀장',
      email: 'kim@company.com',
      phone: '010-1234-5678',
      address: '서울시 강남구',
      status: 'active',
      joinDate: '2020-01-15',
      salary: 5000000
    },
    {
      id: 2,
      name: '이영희',
      employeeId: 'EMP002',
      department: '마케팅팀',
      position: '대리',
      email: 'lee@company.com',
      phone: '010-2345-6789',
      address: '서울시 서초구',
      status: 'active',
      joinDate: '2021-03-20',
      salary: 4000000
    },
    {
      id: 3,
      name: '박민수',
      employeeId: 'EMP003',
      department: '영업팀',
      position: '과장',
      email: 'park@company.com',
      phone: '010-3456-7890',
      address: '서울시 마포구',
      status: 'inactive',
      joinDate: '2019-07-10',
      salary: 4500000
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    employeeId: '',
    department: '',
    position: '',
    email: '',
    phone: '',
    address: '',
    salary: 0
  });

  const handleAdd = () => {
    setSelectedEmployee(null);
    setFormData({
      name: '',
      employeeId: '',
      department: '',
      position: '',
      email: '',
      phone: '',
      address: '',
      salary: 0
    });
    setOpenDialog(true);
  };

  const handleEdit = (employee: any) => {
    setSelectedEmployee(employee);
    setFormData({
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department,
      position: employee.position,
      email: employee.email,
      phone: employee.phone,
      address: employee.address,
      salary: employee.salary
    });
    setOpenDialog(true);
  };

  const handleSave = () => {
    if (selectedEmployee) {
      // 수정
      setEmployees(employees.map(emp => 
        emp.id === selectedEmployee.id 
          ? { ...emp, ...formData }
          : emp
      ));
    } else {
      // 추가
      const newEmployee = {
        id: employees.length + 1,
        ...formData,
        status: 'active',
        joinDate: new Date().toISOString().split('T')[0]
      };
      setEmployees([...employees, newEmployee]);
    }
    setOpenDialog(false);
  };

  const handleDelete = (id: number) => {
    setEmployees(employees.filter(emp => emp.id !== id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'on_leave': return 'warning';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '재직중';
      case 'inactive': return '퇴사';
      case 'on_leave': return '휴직';
      default: return status;
    }
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = departmentFilter === 'all' || employee.department === departmentFilter;
    const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader title="직원 관리" />

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              총 직원 수
            </Typography>
            <Typography variant="h4" color="primary.main">
              {employees.length}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              재직중
            </Typography>
            <Typography variant="h4" color="success.main">
              {employees.filter(emp => emp.status === 'active').length}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              부서 수
            </Typography>
            <Typography variant="h4" color="info.main">
              {new Set(employees.map(emp => emp.department)).size}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              평균 연봉
            </Typography>
            <Typography variant="h4" color="warning.main">
              Rs. {formatInrInt(employees.reduce((sum, emp) => sum + emp.salary, 0) / employees.length)}
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
              placeholder="이름, 사번, 이메일로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={menuFlags.menusLoading || !menuFlags.canRead}
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
              label="부서"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              disabled={menuFlags.menusLoading || !menuFlags.canRead}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="개발팀">개발팀</MenuItem>
              <MenuItem value="마케팅팀">마케팅팀</MenuItem>
              <MenuItem value="영업팀">영업팀</MenuItem>
              <MenuItem value="경영진">경영진</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              select
              label="상태"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={menuFlags.menusLoading || !menuFlags.canRead}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="active">재직중</MenuItem>
              <MenuItem value="inactive">퇴사</MenuItem>
              <MenuItem value="on_leave">휴직</MenuItem>
            </TextField>
            <Tooltip title={t('common.menuNoCreate')} disableHoverListener={menuFlags.menusLoading || menuFlags.canCreate}>
              <span style={{ display: 'inline-flex' }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  disabled={menuFlags.menusLoading || !menuFlags.canCreate}
                  onClick={handleAdd}
                >
                  직원 추가
                </Button>
              </span>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            직원 목록 ({filteredEmployees.length}명)
          </Typography>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>직원 정보</TableCell>
                  <TableCell>부서/직책</TableCell>
                  <TableCell>연락처</TableCell>
                  <TableCell>주소</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>입사일</TableCell>
                  <TableCell>연봉</TableCell>
                  <TableCell>작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                          {employee.name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {employee.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {employee.employeeId}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {employee.department}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {employee.position}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                          <EmailIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
                          <Typography variant="caption">{employee.email}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <PhoneIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
                          <Typography variant="caption">{employee.phone}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LocationIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
                        <Typography variant="caption" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {employee.address}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(employee.status)}
                        color={getStatusColor(employee.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{employee.joinDate}</TableCell>
                    <TableCell align="right">Rs. {formatInrInt(employee.salary)}</TableCell>
                    <TableCell>
                      <Tooltip title={t('common.menuNoEdit')} disableHoverListener={menuFlags.menusLoading || menuFlags.canEdit}>
                        <span style={{ display: 'inline-flex' }}>
                          <IconButton
                            size="small"
                            disabled={menuFlags.menusLoading || !menuFlags.canEdit}
                            onClick={() => handleEdit(employee)}
                          >
                            <EditIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={t('common.menuNoDelete')} disableHoverListener={menuFlags.menusLoading || menuFlags.canDelete}>
                        <span style={{ display: 'inline-flex' }}>
                          <IconButton
                            size="small"
                            disabled={menuFlags.menusLoading || !menuFlags.canDelete}
                            onClick={() => handleDelete(employee.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* 직원 추가/수정 다이얼로그 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedEmployee ? '직원 정보 수정' : '새 직원 추가'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="이름"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
            <TextField
              fullWidth
              label="사번"
              value={formData.employeeId}
              onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
            />
            <FormControl fullWidth>
              <InputLabel>부서</InputLabel>
              <Select
                value={formData.department}
                onChange={(e) => setFormData({...formData, department: e.target.value})}
              >
                <MenuItem value="개발팀">개발팀</MenuItem>
                <MenuItem value="마케팅팀">마케팅팀</MenuItem>
                <MenuItem value="영업팀">영업팀</MenuItem>
                <MenuItem value="경영진">경영진</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="직책"
              value={formData.position}
              onChange={(e) => setFormData({...formData, position: e.target.value})}
            />
            <TextField
              fullWidth
              label="이메일"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
            <TextField
              fullWidth
              label="전화번호"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
            <TextField
              fullWidth
              label="주소"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
            <TextField
              fullWidth
              label="연봉"
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData({...formData, salary: parseInt(e.target.value) || 0})}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>취소</Button>
          <Tooltip
            title={selectedEmployee ? t('common.menuNoEdit') : t('common.menuNoCreate')}
            disableHoverListener={
              menuFlags.menusLoading ||
              (selectedEmployee ? menuFlags.canEdit : menuFlags.canCreate)
            }
          >
            <span style={{ display: 'inline-flex' }}>
              <Button
                onClick={handleSave}
                variant="contained"
                disabled={
                  menuFlags.menusLoading ||
                  (selectedEmployee ? !menuFlags.canEdit : !menuFlags.canCreate)
                }
              >
                저장
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmployeeManagement;
