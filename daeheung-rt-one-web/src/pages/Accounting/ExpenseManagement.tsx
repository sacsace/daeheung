import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, IconButton, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, InputAdornment } from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Download as DownloadIcon, CheckCircle as ApproveIcon, Cancel as RejectIcon, Business as BusinessIcon, Person as PersonIcon, AttachMoney as MoneyIcon, CalendarToday as CalendarIcon } from '@mui/icons-material';

interface Expense {
  id: number;
  expenseNumber: string;
  employeeName: string;
  department: string;
  category: string;
  amount: number;
  requestDate: string;
  approvalDate?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  description: string;
  receiptUrl?: string;
  approver?: string;
  rejectionReason?: string;
}

const ExpenseManagement: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([
    {
      id: 1,
      expenseNumber: 'EXP-2024-001',
      employeeName: '김직원',
      department: '개발팀',
      category: '출장비',
      amount: 150000,
      requestDate: '2024-01-15',
      approvalDate: '2024-01-16',
      status: 'approved',
      description: '서울 출장 교통비 및 숙박비',
      approver: '이부장'
    },
    {
      id: 2,
      expenseNumber: 'EXP-2024-002',
      employeeName: '박사원',
      department: '마케팅팀',
      category: '회식비',
      amount: 80000,
      requestDate: '2024-01-20',
      status: 'pending',
      description: '팀 회식비'
    },
    {
      id: 3,
      expenseNumber: 'EXP-2024-003',
      employeeName: '최과장',
      department: '영업팀',
      category: '교통비',
      amount: 45000,
      requestDate: '2024-01-18',
      status: 'rejected',
      description: '택시비',
      rejectionReason: '영수증 미제출'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState<Omit<Expense, 'id'>>({
    expenseNumber: '',
    employeeName: '',
    department: '',
    category: '',
    amount: 0,
    requestDate: '',
    approvalDate: '',
    status: 'pending',
    description: '',
    receiptUrl: '',
    approver: '',
    rejectionReason: ''
  });

  const handleAdd = () => {
    setSelectedExpense(null);
    setFormData({
      expenseNumber: `EXP-${new Date().getFullYear()}-${String(expenses.length + 1).padStart(3, '0')}`,
      employeeName: '',
      department: '',
      category: '',
      amount: 0,
      requestDate: new Date().toISOString().split('T')[0],
      approvalDate: '',
      status: 'pending',
      description: '',
      receiptUrl: '',
      approver: '',
      rejectionReason: ''
    });
    setOpenDialog(true);
  };

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setFormData(expense);
    setOpenDialog(true);
  };

  const handleSave = () => {
    if (selectedExpense) {
      setExpenses(expenses.map(expense =>
        expense.id === selectedExpense.id ? { ...expense, ...formData } : expense
      ));
    } else {
      const newExpense: Expense = {
        id: expenses.length > 0 ? Math.max(...expenses.map(e => e.id)) + 1 : 1,
        ...formData
      };
      setExpenses([...expenses, newExpense]);
    }
    setOpenDialog(false);
  };

  const handleDelete = (id: number) => {
    setExpenses(expenses.filter(expense => expense.id !== id));
  };

  const handleApprove = (id: number) => {
    setExpenses(expenses.map(expense =>
      expense.id === id 
        ? { ...expense, status: 'approved' as const, approvalDate: new Date().toISOString().split('T')[0] }
        : expense
    ));
  };

  const handleReject = (id: number) => {
    setExpenses(expenses.map(expense =>
      expense.id === id 
        ? { ...expense, status: 'rejected' as const }
        : expense
    ));
  };

  const getStatusChip = (status: string) => {
    const statusConfig = {
      pending: { label: '대기', color: 'warning' as const },
      approved: { label: '승인', color: 'success' as const },
      rejected: { label: '거부', color: 'error' as const },
      paid: { label: '지급완료', color: 'info' as const }
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const getCategoryColor = (category: string) => {
    const colorConfig = {
      '출장비': 'primary',
      '회식비': 'secondary',
      '교통비': 'success',
      '사무용품': 'warning',
      '기타': 'default'
    };
    return colorConfig[category as keyof typeof colorConfig] || 'default';
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.expenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          expense.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          expense.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          expense.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || expense.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <Box sx={{ ...mvsPageRootSx, px: 2, py: 3 }}>
      <DaeheungPageHeader
        title="지출결의서"
        description="지출결의서를 관리하는 페이지입니다."
      />

      {/* 검색 및 필터 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              fullWidth
              size="small"
              label="검색"
              placeholder="결의서 번호, 직원명, 부서, 설명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ) }}
              sx={{ minWidth: 300 }}
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
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">전체 상태</MenuItem>
              <MenuItem value="pending">대기</MenuItem>
              <MenuItem value="approved">승인</MenuItem>
              <MenuItem value="rejected">거부</MenuItem>
              <MenuItem value="paid">지급완료</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              select
              label="카테고리"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">전체 카테고리</MenuItem>
              <MenuItem value="출장비">출장비</MenuItem>
              <MenuItem value="회식비">회식비</MenuItem>
              <MenuItem value="교통비">교통비</MenuItem>
              <MenuItem value="사무용품">사무용품</MenuItem>
              <MenuItem value="기타">기타</MenuItem>
            </TextField>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" startIcon={<DownloadIcon />} sx={{ mr: 1 }}>
              내보내기
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
              지출결의서 추가
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 지출결의서 목록 테이블 */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>결의서 번호</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>신청자 정보</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>카테고리</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>금액</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>신청일</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>승인일</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>상태</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredExpenses.map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                      {expense.expenseNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <PersonIcon sx={{ mr: 1, fontSize: '1rem', color: 'text.secondary' }} />
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                          {expense.employeeName}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <BusinessIcon sx={{ mr: 1, fontSize: '1rem', color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {expense.department}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={expense.category}
                      color={getCategoryColor(expense.category) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <MoneyIcon sx={{ mr: 1, fontSize: '1rem', color: 'text.secondary' }} />
                      <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                        Rs. {expense.amount.toLocaleString()}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CalendarIcon sx={{ mr: 1, fontSize: '1rem', color: 'text.secondary' }} />
                      {expense.requestDate}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {expense.approvalDate ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarIcon sx={{ mr: 1, fontSize: '1rem', color: 'text.secondary' }} />
                        {expense.approvalDate}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusChip(expense.status)}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <IconButton size="small" onClick={() => handleEdit(expense)}>
                        <EditIcon />
                      </IconButton>
                      {expense.status === 'pending' && (
                        <>
                          <IconButton size="small" onClick={() => handleApprove(expense.id)} color="success">
                            <ApproveIcon />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleReject(expense.id)} color="error">
                            <RejectIcon />
                          </IconButton>
                        </>
                      )}
                      <IconButton size="small" onClick={() => handleDelete(expense.id)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* 지출결의서 추가/수정 다이얼로그 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedExpense ? '지출결의서 수정' : '새 지출결의서 추가'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="결의서 번호"
                value={formData.expenseNumber}
                onChange={(e) => setFormData({...formData, expenseNumber: e.target.value})}
                required
              />
              <FormControl fullWidth>
                <InputLabel>상태</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                >
                  <MenuItem value="pending">대기</MenuItem>
                  <MenuItem value="approved">승인</MenuItem>
                  <MenuItem value="rejected">거부</MenuItem>
                  <MenuItem value="paid">지급완료</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="신청자명"
                value={formData.employeeName}
                onChange={(e) => setFormData({...formData, employeeName: e.target.value})}
                required
              />
              <TextField
                fullWidth
                label="부서"
                value={formData.department}
                onChange={(e) => setFormData({...formData, department: e.target.value})}
                required
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>카테고리</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                  <MenuItem value="출장비">출장비</MenuItem>
                  <MenuItem value="회식비">회식비</MenuItem>
                  <MenuItem value="교통비">교통비</MenuItem>
                  <MenuItem value="사무용품">사무용품</MenuItem>
                  <MenuItem value="기타">기타</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="금액 (INR)"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: parseInt(e.target.value) || 0})}
                required
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="신청일"
                type="date"
                value={formData.requestDate}
                onChange={(e) => setFormData({...formData, requestDate: e.target.value})}
                InputLabelProps={{ shrink: true }}
                required
              />
              <TextField
                fullWidth
                label="승인일"
                type="date"
                value={formData.approvalDate}
                onChange={(e) => setFormData({...formData, approvalDate: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <TextField
              fullWidth
              label="승인자"
              value={formData.approver}
              onChange={(e) => setFormData({...formData, approver: e.target.value})}
            />
            <TextField
              fullWidth
              label="거부 사유"
              multiline
              rows={2}
              value={formData.rejectionReason}
              onChange={(e) => setFormData({...formData, rejectionReason: e.target.value})}
            />
            <TextField
              fullWidth
              label="설명"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              required
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

export default ExpenseManagement;
