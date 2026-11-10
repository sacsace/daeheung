import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Alert,
  Snackbar,
  InputAdornment,
  Divider,
  Pagination
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sms as SmsIcon,
  Send as SendIcon,
  Print as PrintIcon } from '@mui/icons-material';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

interface SMS {
  id: number;
  recipient: string;
  recipientPhone: string;
  content: string;
  status: 'draft' | 'scheduled' | 'sent' | 'delivered' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  type: 'individual' | 'group' | 'broadcast';
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
  createdBy: string;
  cost: number;
  characterCount: number;
}

const SAMPLE_SMS: SMS[] = [
  {
    id: 1,
    recipient: '김고객',
    recipientPhone: '010-1234-5678',
    content: '안녕하세요. 주문하신 상품이 배송되었습니다. 감사합니다.',
    status: 'delivered',
    priority: 'normal',
    type: 'individual',
    sentAt: '2024-01-15 14:30:00',
    deliveredAt: '2024-01-15 14:30:15',
    createdAt: '2024-01-15 14:25:00',
    createdBy: '배송팀',
    cost: 20,
    characterCount: 45
  },
  {
    id: 2,
    recipient: '전체 직원',
    recipientPhone: '그룹 발송',
    content: '내일 회의가 오후 3시로 변경되었습니다. 참석 부탁드립니다.',
    status: 'sent',
    priority: 'high',
    type: 'group',
    sentAt: '2024-01-14 16:20:00',
    createdAt: '2024-01-14 16:15:00',
    createdBy: '관리자',
    cost: 200,
    characterCount: 38
  },
  {
    id: 3,
    recipient: '이손님',
    recipientPhone: '010-2345-6789',
    content: '결제가 완료되었습니다. 영수증을 확인해 주세요.',
    status: 'scheduled',
    priority: 'normal',
    type: 'individual',
    scheduledAt: '2024-01-16 09:00:00',
    createdAt: '2024-01-13 10:30:00',
    createdBy: '결제팀',
    cost: 20,
    characterCount: 28
  },
  {
    id: 4,
    recipient: '박VIP',
    recipientPhone: '010-3456-7890',
    content: 'VIP 고객님께 특별 할인 혜택을 제공합니다.',
    status: 'failed',
    priority: 'urgent',
    type: 'individual',
    createdAt: '2024-01-12 15:45:00',
    createdBy: '마케팅팀',
    cost: 0,
    characterCount: 25
  }
];

const SMSManagement: React.FC = () => {
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const [smsList, setSmsList] = useState<SMS[]>([]);
  const [filteredSms, setFilteredSms] = useState<SMS[]>([]);
  const [, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedSms, setSelectedSms] = useState<SMS | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'view'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(15);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSmsList(SAMPLE_SMS);
    } catch {
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const filterSMS = useCallback(() => {
    let filtered = smsList;

    if (searchTerm) {
      filtered = filtered.filter(sms =>
        sms.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sms.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sms.recipientPhone.includes(searchTerm)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(sms => sms.status === statusFilter);
    }

    if (typeFilter) {
      filtered = filtered.filter(sms => sms.type === typeFilter);
    }

    setFilteredSms(filtered);
  }, [smsList, searchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    filterSMS();
  }, [filterSMS]);

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'draft':
        return <Chip label="임시저장" color="default" size="small" />;
      case 'scheduled':
        return <Chip label="예약됨" color="info" size="small" />;
      case 'sent':
        return <Chip label="발송됨" color="warning" size="small" />;
      case 'delivered':
        return <Chip label="전달됨" color="success" size="small" />;
      case 'failed':
        return <Chip label="실패" color="error" size="small" />;
      default:
        return <Chip label="알 수 없음" color="default" size="small" />;
    }
  };

  const getPriorityChip = (priority: string) => {
    switch (priority) {
      case 'low':
        return <Chip label="낮음" color="default" size="small" />;
      case 'normal':
        return <Chip label="보통" color="info" size="small" />;
      case 'high':
        return <Chip label="높음" color="warning" size="small" />;
      case 'urgent':
        return <Chip label="긴급" color="error" size="small" />;
      default:
        return <Chip label="알 수 없음" color="default" size="small" />;
    }
  };

  const getTypeChip = (type: string) => {
    switch (type) {
      case 'individual':
        return <Chip label="개별" color="primary" size="small" />;
      case 'group':
        return <Chip label="그룹" color="secondary" size="small" />;
      case 'broadcast':
        return <Chip label="방송" color="info" size="small" />;
      default:
        return <Chip label="알 수 없음" color="default" size="small" />;
    }
  };

  const handleViewSMS = (sms: SMS) => {
    setSelectedSms(sms);
    setViewMode('view');
  };

  const handleDeleteSMS = (id: number) => {
    showConfirm(
      '정말로 이 SMS를 삭제하시겠습니까?',
      () => {
        try {
          setSmsList((prev) => prev.filter((sms) => sms.id !== id));
          setSuccess('SMS가 성공적으로 삭제되었습니다.');
        } catch {
          setError('삭제 중 오류가 발생했습니다.');
        }
      },
      { title: '삭제 확인', confirmColor: 'error', confirmText: '삭제', cancelText: '취소' }
    );
  };

  const handleResendSMS = (id: number) => {
    setSmsList(prev =>
      prev.map(sms =>
        sms.id === id 
          ? { 
              ...sms, 
              status: 'sent' as const,
              sentAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
            } 
          : sms
      )
    );
    setSuccess('SMS가 재발송되었습니다.');
  };

  const totalSMS = smsList.length;
  const sentSMS = smsList.filter(sms => sms.status === 'sent' || sms.status === 'delivered').length;
  const scheduledSMS = smsList.filter(sms => sms.status === 'scheduled').length;
  const totalCost = smsList.reduce((sum, sms) => sum + sms.cost, 0);

  const paginatedSMS = filteredSms.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  if (viewMode === 'view' && selectedSms) {
    return (
      <Box sx={{ ...mvsPageRootSx }}>
        <DaeheungPageHeader
          title="SMS 상세"
          icon={<SmsIcon />}
          actions={
            <Button variant="outlined" onClick={() => setViewMode('list')}>
              목록으로
            </Button>
          }
        />

        <Card>
          <CardContent>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                SMS 상세 정보
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {getStatusChip(selectedSms.status)}
                {getPriorityChip(selectedSms.priority)}
                {getTypeChip(selectedSms.type)}
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom>수신자 정보</Typography>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body1" fontWeight="bold">
                    {selectedSms.recipient}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSms.recipientPhone}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom>발송 정보</Typography>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">
                    작성자: {selectedSms.createdBy}
                  </Typography>
                  <Typography variant="body2">
                    작성일: {selectedSms.createdAt}
                  </Typography>
                  {selectedSms.sentAt && (
                    <Typography variant="body2">
                      발송일: {selectedSms.sentAt}
                    </Typography>
                  )}
                  {selectedSms.deliveredAt && (
                    <Typography variant="body2">
                      전달일: {selectedSms.deliveredAt}
                    </Typography>
                  )}
                </Box>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="h6" gutterBottom>SMS 내용</Typography>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                    {selectedSms.content}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom>비용 정보</Typography>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">
                    문자 수: {selectedSms.characterCount}자
                  </Typography>
                  <Typography variant="body2">
                    비용: ₹{selectedSms.cost}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 3 }}>
              {selectedSms.status === 'failed' && (
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={() => handleResendSMS(selectedSms.id)}
                >
                  재발송
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
              >
                인쇄
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title="SMS 관리"
        icon={<SmsIcon />}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={{ borderRadius: 2 }}
          >
            SMS 작성
          </Button>
        }
      />

      {/* 통계 카드 */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 2, 
        mb: 3 
      }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              총 SMS
            </Typography>
            <Typography variant="h4" color="primary.main">
              {totalSMS}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              발송 완료
            </Typography>
            <Typography variant="h4" color="success.main">
              {sentSMS}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              예약 발송
            </Typography>
            <Typography variant="h4" color="warning.main">
              {scheduledSMS}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              총 비용
            </Typography>
            <Typography variant="h4" color="info.main">
              ₹{totalCost}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 필터 및 검색 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr 1fr' },
            gap: 2, 
            alignItems: 'center' 
          }}>
            <TextField
              fullWidth
              size="small"
              label="검색"
              placeholder="수신자, 내용, 전화번호 검색"
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
              <MenuItem value="">전체</MenuItem>
              <MenuItem value="draft">임시저장</MenuItem>
              <MenuItem value="scheduled">예약됨</MenuItem>
              <MenuItem value="sent">발송됨</MenuItem>
              <MenuItem value="delivered">전달됨</MenuItem>
              <MenuItem value="failed">실패</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              select
              label="유형"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">전체</MenuItem>
              <MenuItem value="individual">개별</MenuItem>
              <MenuItem value="group">그룹</MenuItem>
              <MenuItem value="broadcast">방송</MenuItem>
            </TextField>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setTypeFilter('');
              }}
            >
              초기화
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* SMS 목록 테이블 */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>수신자</TableCell>
                <TableCell>전화번호</TableCell>
                <TableCell>내용</TableCell>
                <TableCell>유형</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>우선순위</TableCell>
                <TableCell>발송일</TableCell>
                <TableCell>비용</TableCell>
                <TableCell>작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedSMS.map((sms) => (
                <TableRow key={sms.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {sms.recipient}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {sms.recipientPhone}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 200
                      }}
                    >
                      {sms.content}
                    </Typography>
                  </TableCell>
                  <TableCell>{getTypeChip(sms.type)}</TableCell>
                  <TableCell>{getStatusChip(sms.status)}</TableCell>
                  <TableCell>{getPriorityChip(sms.priority)}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {sms.sentAt || sms.scheduledAt || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      ₹{sms.cost}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="보기">
                        <IconButton size="small" onClick={() => handleViewSMS(sms)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      {sms.status === 'failed' && (
                        <Tooltip title="재발송">
                          <IconButton 
                            size="small" 
                            onClick={() => handleResendSMS(sms.id)}
                            color="success"
                          >
                            <SendIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="삭제">
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteSMS(sms.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 페이지네이션 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination
            count={Math.ceil(filteredSms.length / itemsPerPage)}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      </Card>

      {/* SMS 작성 다이얼로그 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          SMS 작성
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              SMS 정보를 입력해주세요.
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              SMS 작성 기능은 개발 중입니다.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>취소</Button>
          <Button variant="contained">작성</Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
      >
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
      >
        <Alert onClose={() => setSuccess('')} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        confirmColor={dialogState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
};

export default SMSManagement;