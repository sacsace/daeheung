import React, { useMemo, useState } from 'react';
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
  Button,
  TextField,
  MenuItem,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Alert,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsKpiGridSx,
  mvsMainTabsSx,
  mvsFilterBarInnerSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
} from '../../theme/daeheungLayout';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import { useMenuActionGuard } from '../../hooks/useMenuActionGuard';

const QUOTATION_LIST_MENU_ROUTES = ['/accounting/quotation', '/work/quotation', '/quotation/list', '/quotation'] as const;

const quotationFilterFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx,
} as const;

const QuotationList: React.FC = () => {
  const { t } = useTranslation();
  const menuFlags = usePageMenuPermission(QUOTATION_LIST_MENU_ROUTES);
  const createGuard = useMenuActionGuard('create', QUOTATION_LIST_MENU_ROUTES);
  const editGuard = useMenuActionGuard('edit', QUOTATION_LIST_MENU_ROUTES);
  const deleteGuard = useMenuActionGuard('delete', QUOTATION_LIST_MENU_ROUTES);
  const [quotations, setQuotations] = useState([
    {
      id: 1,
      quotationNumber: 'QUO-2024-001',
      customerName: 'ABC 전자',
      customerEmail: 'contact@abc.com',
      totalAmount: 15000000,
      status: 'sent',
      createdDate: '2024-01-15',
      validUntil: '2024-02-15',
      createdBy: '김견적',
      notes: '삼성 갤럭시 S24 견적 요청',
    },
    {
      id: 2,
      quotationNumber: 'QUO-2024-002',
      customerName: 'XYZ 스토어',
      customerEmail: 'info@xyz.com',
      totalAmount: 8500000,
      status: 'draft',
      createdDate: '2024-01-16',
      validUntil: '2024-02-16',
      createdBy: '이견적',
      notes: '아이폰 15 Pro 견적 요청',
    },
    {
      id: 3,
      quotationNumber: 'QUO-2024-003',
      customerName: 'DEF 컴퓨터',
      customerEmail: 'sales@def.com',
      totalAmount: 12000000,
      status: 'accepted',
      createdDate: '2024-01-14',
      validUntil: '2024-02-14',
      createdBy: '박견적',
      notes: 'LG 그램 17 견적 요청',
    },
  ]);

  const [listTab, setListTab] = useState<'requested' | 'pending'>('requested');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);

  const handleAdd = () => {
    if (!createGuard.guard()) return;
    setSelectedQuotation(null);
    setOpenDialog(true);
  };

  const handleEdit = (quotation: any) => {
    if (!editGuard.guard()) return;
    setSelectedQuotation(quotation);
    setOpenDialog(true);
  };

  const handleDelete = (id: number) => {
    if (!deleteGuard.guard()) return;
    setQuotations(quotations.filter((item) => item.id !== id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'default';
      case 'sent':
        return 'info';
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'error';
      case 'expired':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return '초안';
      case 'sent':
        return '발송됨';
      case 'accepted':
        return '승인됨';
      case 'rejected':
        return '거절됨';
      case 'expired':
        return '만료됨';
      default:
        return status;
    }
  };

  const listKpiStats = useMemo(
    () => ({
      total: quotations.length,
      accepted: quotations.filter((item) => item.status === 'accepted').length,
      sent: quotations.filter((item) => item.status === 'sent').length,
      draft: quotations.filter((item) => item.status === 'draft').length,
    }),
    [quotations]
  );

  const filteredQuotations = quotations.filter((quotation) => {
    const matchesSearch =
      quotation.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quotation.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || quotation.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title="견적서"
        description="견적서를 관리하고 조회하는 페이지입니다."
        mb={2}
        actions={
          <Tooltip title={createGuard.tooltipTitle} disableHoverListener={!createGuard.tooltipTitle}>
            <span style={{ display: 'inline-flex' }}>
              <Button
                variant="contained"
                disableElevation
                startIcon={<AddIcon fontSize="small" />}
                onClick={handleAdd}
                disabled={createGuard.disabled}
                sx={mvsBodyPrimaryBtnSx}
              >
                견적서 작성
              </Button>
            </span>
          </Tooltip>
        }
      />

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Tabs value={listTab} onChange={(_, v) => setListTab(v)} sx={mvsMainTabsSx}>
          <Tab value="requested" label="내가 요청한 견적서" />
          <Tab value="pending" label="승인 대기 견적서" />
        </Tabs>
      </Card>

      <Box sx={mvsKpiGridSx}>
        {[
          { label: '총 견적서', value: listKpiStats.total, color: 'text.primary' },
          { label: '승인된 견적서', value: listKpiStats.accepted, color: 'success.main' },
          { label: '발송된 견적서', value: listKpiStats.sent, color: 'info.main' },
          { label: '초안', value: listKpiStats.draft, color: 'warning.main' },
        ].map((item) => (
          <Card key={item.label} elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, letterSpacing: '0.02em' }}
              >
                {item.label}
              </Typography>
              <Typography
                variant="h5"
                sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: item.color }}
              >
                {item.value.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box
          sx={{
            ...mvsFilterBarInnerSx,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'minmax(180px, 2fr) minmax(120px, 1fr) auto',
            },
          }}
        >
          <TextField
            fullWidth
            size="small"
            label="검색"
            placeholder="견적서 번호 또는 고객명으로 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={quotationFilterFieldSx}
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
            sx={quotationFilterFieldSx}
          >
            <MenuItem value="all">전체</MenuItem>
            <MenuItem value="draft">초안</MenuItem>
            <MenuItem value="sent">발송됨</MenuItem>
            <MenuItem value="accepted">승인됨</MenuItem>
            <MenuItem value="rejected">거절됨</MenuItem>
            <MenuItem value="expired">만료됨</MenuItem>
          </TextField>
          <Button
            variant="outlined"
            startIcon={<FilterIcon sx={{ fontSize: 18 }} />}
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
            sx={{
              ...mvsBodyOutlinedBtnSx,
              height: 40,
              whiteSpace: 'nowrap',
              alignSelf: { xs: 'stretch', sm: 'flex-end' },
            }}
          >
            초기화
          </Button>
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        <TableContainer sx={mvsBodyListTableSx}>
          <Table size="small">
            <TableHead sx={mvsTableHeadHighlightSx}>
              <TableRow>
                <TableCell>견적서 번호</TableCell>
                <TableCell>고객명</TableCell>
                <TableCell>고객 이메일</TableCell>
                <TableCell align="right">총 금액</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>작성일</TableCell>
                <TableCell>유효기간</TableCell>
                <TableCell>작성자</TableCell>
                <TableCell align="center">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={mvsTableBodyRowSx}>
              {filteredQuotations.map((quotation) => (
                <TableRow key={quotation.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {quotation.quotationNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>{quotation.customerName}</TableCell>
                  <TableCell>{quotation.customerEmail}</TableCell>
                  <TableCell align="right">Rs. {quotation.totalAmount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(quotation.status)}
                      color={getStatusColor(quotation.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{quotation.createdDate}</TableCell>
                  <TableCell>{quotation.validUntil}</TableCell>
                  <TableCell>{quotation.createdBy}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={editGuard.tooltipTitle || t('common.edit')}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(quotation)}
                          disabled={editGuard.disabled}
                        >
                          <EditIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={deleteGuard.tooltipTitle || t('common.delete')}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(quotation.id)}
                          color="error"
                          disabled={deleteGuard.disabled}
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
      </Box>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedQuotation ? '견적서 상세 정보' : '새 견적서 작성'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            견적서 상세 정보를 표시하거나 새 견적서를 작성하는 폼이 여기에 표시됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} sx={mvsBodyOutlinedBtnSx}>
            닫기
          </Button>
          {selectedQuotation && (
            <Button variant="contained" disableElevation sx={mvsBodyPrimaryBtnSx}>
              수정
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuotationList;
