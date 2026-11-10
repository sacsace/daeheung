import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
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
  Pagination,
  InputAdornment,
  Divider } from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Receipt as ReceiptIcon,
  CheckCircle as CheckCircleIcon,
  Send as SendIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

interface ProformaItem {
  id: number;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
  discountRate?: number;
  discountAmount?: number;
}

interface ProformaInvoice {
  id: number;
  proformaNumber: string;
  quotationId?: number;
  quotationNumber?: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  proformaDate: string;
  validUntil: string;
  items: ProformaItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted' | 'expired';
  currency: string;
  paymentTerms: string;
  deliveryTerms: string;
  notes?: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  convertedToInvoice?: boolean;
  invoiceId?: number;
  invoiceNumber?: string;
}

const ProformaInvoice: React.FC = () => {
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const [proformaInvoices, setProformaInvoices] = useState<ProformaInvoice[]>([]);
  const [filteredProformaInvoices, setFilteredProformaInvoices] = useState<ProformaInvoice[]>([]);
  const [, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProformaInvoice, setSelectedProformaInvoice] = useState<ProformaInvoice | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'view'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(15);

  // 샘플 데이터
  const sampleData: ProformaInvoice[] = [
    {
      id: 1,
      proformaNumber: 'PF-2024-001',
      quotationId: 1001,
      quotationNumber: 'QUO-2024-001',
      customerId: 2001,
      customerName: 'ABC 회사',
      customerEmail: 'contact@abc.com',
      customerPhone: '02-1234-5678',
      customerAddress: '서울시 강남구 테헤란로 123',
      companyName: 'MVS Solutions',
      companyAddress: '서울시 서초구 서초대로 456',
      companyPhone: '02-9876-5432',
      companyEmail: 'info@mvs3.com',
      proformaDate: '2024-01-20',
      validUntil: '2024-02-19',
      items: [
        {
          id: 1,
          itemName: 'MVS 시스템 개발',
          description: '완전한 ERP 시스템 개발',
          quantity: 1,
          unitPrice: 50000000,
          totalPrice: 50000000,
          taxRate: 10,
          taxAmount: 5000000,
          discountRate: 5,
          discountAmount: 2500000
        },
        {
          id: 2,
          itemName: '유지보수 서비스',
          description: '월간 유지보수 서비스 (12개월)',
          quantity: 12,
          unitPrice: 2000000,
          totalPrice: 24000000,
          taxRate: 10,
          taxAmount: 2400000,
          discountRate: 10,
          discountAmount: 2400000
        }
      ],
      subtotal: 74000000,
      totalDiscount: 4900000,
      totalTax: 7400000,
      totalAmount: 76500000,
      status: 'sent',
      currency: 'INR',
      paymentTerms: '계약 체결 후 30일',
      deliveryTerms: '개발 완료 후 2주 이내',
      notes: '긴급 프로젝트로 우선 처리 요청',
      attachments: ['견적서.pdf', '제안서.pdf', '계약서_초안.pdf'],
      createdAt: '2024-01-20 10:00:00',
      updatedAt: '2024-01-20 10:00:00',
      createdBy: '김개발'
    },
    {
      id: 2,
      proformaNumber: 'PF-2024-002',
      customerId: 2002,
      customerName: 'XYZ 기업',
      customerEmail: 'billing@xyz.com',
      customerPhone: '031-1111-2222',
      customerAddress: '경기도 성남시 분당구 판교로 789',
      companyName: 'MVS Solutions',
      companyAddress: '서울시 서초구 서초대로 456',
      companyPhone: '02-9876-5432',
      companyEmail: 'info@mvs3.com',
      proformaDate: '2024-01-22',
      validUntil: '2024-02-21',
      items: [
        {
          id: 3,
          itemName: '컨설팅 서비스',
          description: '시스템 구축 컨설팅 (40시간)',
          quantity: 40,
          unitPrice: 150000,
          totalPrice: 6000000,
          taxRate: 10,
          taxAmount: 600000
        }
      ],
      subtotal: 6000000,
      totalDiscount: 0,
      totalTax: 600000,
      totalAmount: 6600000,
      status: 'accepted',
      currency: 'INR',
      paymentTerms: '서비스 완료 후 15일',
      deliveryTerms: '즉시 시작 가능',
      attachments: ['컨설팅_계획서.pdf'],
      createdAt: '2024-01-22 15:30:00',
      updatedAt: '2024-01-25 09:15:00',
      createdBy: '이프론트',
      convertedToInvoice: true,
      invoiceId: 3001,
      invoiceNumber: 'INV-2024-001'
    },
    {
      id: 3,
      proformaNumber: 'PF-2024-003',
      customerId: 2003,
      customerName: 'DEF 주식회사',
      customerEmail: 'finance@def.com',
      customerPhone: '051-3333-4444',
      customerAddress: '부산시 해운대구 센텀중앙로 101',
      companyName: 'MVS Solutions',
      companyAddress: '서울시 서초구 서초대로 456',
      companyPhone: '02-9876-5432',
      companyEmail: 'info@mvs3.com',
      proformaDate: '2024-01-15',
      validUntil: '2024-02-14',
      items: [
        {
          id: 4,
          itemName: '라이선스 비용',
          description: '연간 소프트웨어 라이선스',
          quantity: 1,
          unitPrice: 5000000,
          totalPrice: 5000000,
          taxRate: 10,
          taxAmount: 500000
        }
      ],
      subtotal: 5000000,
      totalDiscount: 0,
      totalTax: 500000,
      totalAmount: 5500000,
      status: 'expired',
      currency: 'INR',
      paymentTerms: '계약 체결 후 7일',
      deliveryTerms: '계약 체결 후 1일',
      attachments: ['라이선스_안내서.pdf'],
      createdAt: '2024-01-15 09:00:00',
      updatedAt: '2024-01-15 09:00:00',
      createdBy: '박백엔드'
    }
  ];

  useEffect(() => {
    loadProformaInvoiceData();
  }, []);

  useEffect(() => {
    filterProformaInvoices();
  }, [proformaInvoices, searchTerm, statusFilter, dateFilter]);

  const loadProformaInvoiceData = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProformaInvoices(sampleData);
    } catch {
      setError('프로포마 인보이스 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const filterProformaInvoices = () => {
    let filtered = proformaInvoices;

    if (searchTerm) {
      filtered = filtered.filter(proformaInvoice =>
        proformaInvoice.proformaNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proformaInvoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proformaInvoice.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proformaInvoice.quotationNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(proformaInvoice => proformaInvoice.status === statusFilter);
    }

    if (dateFilter) {
      filtered = filtered.filter(proformaInvoice => proformaInvoice.proformaDate === dateFilter);
    }

    setFilteredProformaInvoices(filtered);
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'draft':
        return <Chip label="초안" color="default" size="small" />;
      case 'sent':
        return <Chip label="발송됨" color="info" size="small" />;
      case 'accepted':
        return <Chip label="승인됨" color="success" size="small" />;
      case 'rejected':
        return <Chip label="거부됨" color="error" size="small" />;
      case 'converted':
        return <Chip label="변환됨" color="primary" size="small" />;
      case 'expired':
        return <Chip label="만료됨" color="warning" size="small" />;
      default:
        return <Chip label="알 수 없음" color="default" size="small" />;
    }
  };

  const handleViewProformaInvoice = (proformaInvoice: ProformaInvoice) => {
    setSelectedProformaInvoice(proformaInvoice);
    setViewMode('view');
  };

  const handleEditProformaInvoice = (proformaInvoice: ProformaInvoice) => {
    setSelectedProformaInvoice(proformaInvoice);
    setOpenDialog(true);
  };

  const handleDeleteProformaInvoice = (id: number) => {
    showConfirm(
      '정말로 이 프로포마 인보이스를 삭제하시겠습니까?',
      () => {
        try {
          setProformaInvoices((prev) => prev.filter((proformaInvoice) => proformaInvoice.id !== id));
          setSuccess('프로포마 인보이스가 성공적으로 삭제되었습니다.');
        } catch {
          setError('삭제 중 오류가 발생했습니다.');
        }
      },
      { title: '삭제 확인', confirmColor: 'error', confirmText: '삭제', cancelText: '취소' }
    );
  };

  const handleConvertToInvoice = (id: number) => {
    setProformaInvoices(prev =>
      prev.map(proformaInvoice =>
        proformaInvoice.id === id 
          ? { 
              ...proformaInvoice, 
              status: 'converted' as const,
              convertedToInvoice: true,
              invoiceId: Math.floor(Math.random() * 10000) + 3000,
              invoiceNumber: `INV-2024-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
              updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
            } 
          : proformaInvoice
      )
    );
    setSuccess('프로포마 인보이스가 정식 인보이스로 변환되었습니다.');
  };

  const handleSendProformaInvoice = (id: number) => {
    setProformaInvoices(prev =>
      prev.map(proformaInvoice =>
        proformaInvoice.id === id 
          ? { 
              ...proformaInvoice, 
              status: 'sent' as const,
              updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
            } 
          : proformaInvoice
      )
    );
    setSuccess('프로포마 인보이스가 발송되었습니다.');
  };

  const totalAmount = proformaInvoices.reduce((sum, proformaInvoice) => sum + proformaInvoice.totalAmount, 0);
  const sentAmount = proformaInvoices
    .filter(proformaInvoice => proformaInvoice.status === 'sent')
    .reduce((sum, proformaInvoice) => sum + proformaInvoice.totalAmount, 0);
  const acceptedAmount = proformaInvoices
    .filter(proformaInvoice => proformaInvoice.status === 'accepted')
    .reduce((sum, proformaInvoice) => sum + proformaInvoice.totalAmount, 0);
  const convertedCount = proformaInvoices.filter(proformaInvoice => proformaInvoice.status === 'converted').length;

  const paginatedProformaInvoices = filteredProformaInvoices.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  if (viewMode === 'view' && selectedProformaInvoice) {
    return (
      <Box sx={{ ...mvsPageRootSx }}>
        <DaeheungPageHeader
          title="프포마 인보이스 상세"
          icon={<ReceiptIcon />}
          actions={
            <Button variant="outlined" onClick={() => setViewMode('list')}>
              목록으로
            </Button>
          }
        />

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
              <Box>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  프로포마 인보이스 #{selectedProformaInvoice.proformaNumber}
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  발행일: {selectedProformaInvoice.proformaDate} | 유효기간: {selectedProformaInvoice.validUntil}
                </Typography>
                {selectedProformaInvoice.quotationNumber && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    견적서: {selectedProformaInvoice.quotationNumber}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  {getStatusChip(selectedProformaInvoice.status)}
                  {selectedProformaInvoice.convertedToInvoice && (
                    <Chip label="인보이스 변환됨" color="primary" size="small" />
                  )}
                </Box>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h4" color="primary.main">
                  Rs. {selectedProformaInvoice.totalAmount.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedProformaInvoice.currency}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* 회사 정보 */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>회사 정보</Typography>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 2 
              }}>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {selectedProformaInvoice.companyName}
                  </Typography>
                  <Typography variant="body2">
                    {selectedProformaInvoice.companyAddress}
                  </Typography>
                  <Typography variant="body2">
                    전화: {selectedProformaInvoice.companyPhone}
                  </Typography>
                  <Typography variant="body2">
                    이메일: {selectedProformaInvoice.companyEmail}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {selectedProformaInvoice.customerName}
                  </Typography>
                  <Typography variant="body2">
                    {selectedProformaInvoice.customerAddress}
                  </Typography>
                  <Typography variant="body2">
                    전화: {selectedProformaInvoice.customerPhone}
                  </Typography>
                  <Typography variant="body2">
                    이메일: {selectedProformaInvoice.customerEmail}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* 프로포마 인보이스 항목 */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>프로포마 인보이스 항목</Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>상품/서비스</TableCell>
                      <TableCell>수량</TableCell>
                      <TableCell>단가</TableCell>
                      <TableCell>금액</TableCell>
                      <TableCell>할인</TableCell>
                      <TableCell>세율</TableCell>
                      <TableCell>세금</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedProformaInvoice.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {item.itemName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.description}
                          </Typography>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>Rs. {item.unitPrice.toLocaleString()}</TableCell>
                        <TableCell>Rs. {item.totalPrice.toLocaleString()}</TableCell>
                        <TableCell>
                          {item.discountAmount ? (
                            <Box>
                              <Typography variant="body2">
                                Rs. {item.discountAmount.toLocaleString()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ({item.discountRate}%)
                              </Typography>
                            </Box>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{item.taxRate}%</TableCell>
                        <TableCell>Rs. {item.taxAmount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* 요약 */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 2 
              }}>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body1" gutterBottom>
                    공급가액: Rs. {selectedProformaInvoice.subtotal.toLocaleString()}
                  </Typography>
                  {selectedProformaInvoice.totalDiscount > 0 && (
                    <Typography variant="body1" gutterBottom>
                      할인: -Rs. {selectedProformaInvoice.totalDiscount.toLocaleString()}
                    </Typography>
                  )}
                  <Typography variant="body1" gutterBottom>
                    세금: Rs. {selectedProformaInvoice.totalTax.toLocaleString()}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="h6" color="primary.main">
                    총 금액: Rs. {selectedProformaInvoice.totalAmount.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body1" gutterBottom>
                    결제 조건: {selectedProformaInvoice.paymentTerms}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    납기 조건: {selectedProformaInvoice.deliveryTerms}
                  </Typography>
                  {selectedProformaInvoice.convertedToInvoice && (
                    <Typography variant="body1" color="primary.main">
                      변환된 인보이스: {selectedProformaInvoice.invoiceNumber}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* 첨부파일 */}
            {selectedProformaInvoice.attachments.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>첨부파일</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {selectedProformaInvoice.attachments.map((file, index) => (
                    <Chip
                      key={index}
                      label={file}
                      icon={<DescriptionIcon />}
                      variant="outlined"
                      clickable
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* 메모 */}
            {selectedProformaInvoice.notes && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>메모</Typography>
                <Card sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body1">
                    {selectedProformaInvoice.notes}
                  </Typography>
                </Card>
              </Box>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => handleEditProformaInvoice(selectedProformaInvoice)}
              >
                수정
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
              >
                인쇄
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
              >
                PDF 다운로드
              </Button>
              {selectedProformaInvoice.status === 'accepted' && !selectedProformaInvoice.convertedToInvoice && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => handleConvertToInvoice(selectedProformaInvoice.id)}
                >
                  인보이스 변환
                </Button>
              )}
              {selectedProformaInvoice.status === 'draft' && (
                <Button
                  variant="contained"
                  color="info"
                  startIcon={<SendIcon />}
                  onClick={() => handleSendProformaInvoice(selectedProformaInvoice.id)}
                >
                  발송
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title="프로포마 인보이스"
        icon={<ReceiptIcon />}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={{ borderRadius: 2 }}
          >
            프로포마 인보이스 생성
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
              총 프로포마 금액
            </Typography>
            <Typography variant="h4">
              Rs. {totalAmount.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              발송된 금액
            </Typography>
            <Typography variant="h4" color="info.main">
              Rs. {sentAmount.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              승인된 금액
            </Typography>
            <Typography variant="h4" color="success.main">
              Rs. {acceptedAmount.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              변환된 인보이스
            </Typography>
            <Typography variant="h4" color="primary.main">
              {convertedCount}
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
              placeholder="프로포마 번호, 고객명, 이메일, 견적서 번호 검색"
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
              <MenuItem value="draft">초안</MenuItem>
              <MenuItem value="sent">발송됨</MenuItem>
              <MenuItem value="accepted">승인됨</MenuItem>
              <MenuItem value="rejected">거부됨</MenuItem>
              <MenuItem value="converted">변환됨</MenuItem>
              <MenuItem value="expired">만료됨</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="날짜"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setDateFilter('');
              }}
            >
              초기화
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 프로포마 인보이스 목록 테이블 */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>프로포마 정보</TableCell>
                <TableCell>고객</TableCell>
                <TableCell>견적서</TableCell>
                <TableCell>금액</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>발행일</TableCell>
                <TableCell>작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProformaInvoices.map((proformaInvoice) => (
                <TableRow key={proformaInvoice.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {proformaInvoice.proformaNumber}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        유효기간: {proformaInvoice.validUntil}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {proformaInvoice.customerName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {proformaInvoice.customerEmail}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {proformaInvoice.quotationNumber ? (
                      <Chip label={proformaInvoice.quotationNumber} color="primary" size="small" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      Rs. {proformaInvoice.totalAmount.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      {getStatusChip(proformaInvoice.status)}
                      {proformaInvoice.convertedToInvoice && (
                        <Chip label="변환됨" color="primary" size="small" sx={{ mt: 0.5 }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{proformaInvoice.proformaDate}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="보기">
                        <IconButton size="small" onClick={() => handleViewProformaInvoice(proformaInvoice)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="수정">
                        <IconButton size="small" onClick={() => handleEditProformaInvoice(proformaInvoice)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      {proformaInvoice.status === 'accepted' && !proformaInvoice.convertedToInvoice && (
                        <Tooltip title="인보이스 변환">
                          <IconButton 
                            size="small" 
                            onClick={() => handleConvertToInvoice(proformaInvoice.id)}
                            color="success"
                          >
                            <CheckCircleIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {proformaInvoice.status === 'draft' && (
                        <Tooltip title="발송">
                          <IconButton 
                            size="small" 
                            onClick={() => handleSendProformaInvoice(proformaInvoice.id)}
                            color="info"
                          >
                            <SendIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="삭제">
                        <IconButton size="small" onClick={() => handleDeleteProformaInvoice(proformaInvoice.id)}>
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
            count={Math.ceil(filteredProformaInvoices.length / itemsPerPage)}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      </Card>

      {/* 프로포마 인보이스 생성/수정 다이얼로그 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedProformaInvoice ? '프로포마 인보이스 수정' : '프로포마 인보이스 생성'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              프로포마 인보이스 정보를 입력해주세요.
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              프로포마 인보이스 생성 기능은 개발 중입니다.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>취소</Button>
          <Button variant="contained">
            {selectedProformaInvoice ? '수정' : '생성'}
          </Button>
        </DialogActions>
      </Dialog>

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
    </Box>
  );
};

export default ProformaInvoice;
