import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  FormControl,
  InputLabel,
  Select,
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
  Divider,
  Stack,
  CircularProgress,
  useTheme
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import { alpha } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Print as PrintIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { mvsSearchFieldSx } from '../../theme/daeheungLayout';
import { ewayBillService } from '../../services/api';
import PromptDialog from '../../components/Common/PromptDialog';
import { usePromptDialog } from '../../hooks/usePromptDialog';


const eWayBillFilterSelectSx = {
  borderRadius: '8px',
  bgcolor: '#FFFFFF',
  height: 40,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
};

interface EWayBillItem {
  id: number;
  itemName: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
}

function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function deepCamelCase(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (input instanceof Date) return input;
  if (Array.isArray(input)) {
    return input.map((el) => deepCamelCase(el));
  }
  if (typeof input === 'object' && input !== null && input.constructor === Object) {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      out[toCamelCaseKey(k)] = deepCamelCase(obj[k]);
    }
    return out;
  }
  return input;
}

interface EWayBill {
  id: number;
  ewayBillNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplyType: 'outward' | 'inward';
  subSupplyType: string;
  documentType: 'invoice' | 'credit_note' | 'debit_note' | 'bill_of_supply';
  documentNumber: string;
  documentDate: string;
  fromGstin: string;
  fromName: string;
  fromAddress: string;
  fromPincode: string;
  fromState: string;
  toGstin: string;
  toName: string;
  toAddress: string;
  toPincode: string;
  toState: string;
  transportMode: 'road' | 'rail' | 'air' | 'ship';
  vehicleNumber?: string;
  vehicleType?: string;
  transporterId?: string;
  transporterName?: string;
  transporterDocNumber?: string;
  transporterDocDate?: string;
  distance: number;
  items: EWayBillItem[];
  totalValue: number;
  totalTaxAmount: number;
  totalAmount: number;
  status: 'draft' | 'generated' | 'active' | 'expired' | 'cancelled' | 'rejected';
  generatedAt?: string;
  validUntil?: string;
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  /** API 응답 매핑용 (선택) */
  fromStateCode?: number;
  toStateCode?: number;
  /** 인도 GSTN 공식 E-Way Bill 번호(GST_EWAY_MODE=live 발급 성공 시) */
  gstnEwayBillNo?: string;
  gstnValidUpto?: string;
  gstnLastError?: string;
}

type EWayBillFormValues = {
  invoice_number: string;
  invoice_date: string;
  supply_type: 'outward' | 'inward';
  sub_supply_type: string;
  document_type: 'invoice' | 'credit_note' | 'debit_note' | 'bill_of_supply';
  from_gstin: string;
  from_name: string;
  from_address: string;
  from_pincode: string;
  from_state: string;
  from_state_code: string;
  to_gstin: string;
  to_name: string;
  to_address: string;
  to_pincode: string;
  to_state: string;
  to_state_code: string;
  transport_mode: 'road' | 'rail' | 'air' | 'ship';
  vehicle_number: string;
  distance: string;
  notes: string;
  item_name: string;
  hsn_code: string;
  quantity: string;
  unit_price: string;
};

function getInitialFormValues(): EWayBillFormValues {
  const today = new Date().toISOString().split('T')[0];
  return {
    invoice_number: '',
    invoice_date: today,
    supply_type: 'outward',
    sub_supply_type: 'supply',
    document_type: 'invoice',
    from_gstin: '',
    from_name: '',
    from_address: '',
    from_pincode: '',
    from_state: '',
    from_state_code: '29',
    to_gstin: '',
    to_name: '',
    to_address: '',
    to_pincode: '',
    to_state: '',
    to_state_code: '29',
    transport_mode: 'road',
    vehicle_number: '',
    distance: '0',
    notes: '',
    item_name: '',
    hsn_code: '998314',
    quantity: '1',
    unit_price: '0'
  };
}

function mapBillToForm(b: EWayBill): EWayBillFormValues {
  const first = b.items?.[0];
  const invDate = (b.invoiceDate || '').slice(0, 10);
  return {
    invoice_number: b.invoiceNumber || '',
    invoice_date: invDate || new Date().toISOString().split('T')[0],
    supply_type: b.supplyType,
    sub_supply_type: b.subSupplyType || 'supply',
    document_type: b.documentType || 'invoice',
    from_gstin: b.fromGstin || '',
    from_name: b.fromName || '',
    from_address: b.fromAddress || '',
    from_pincode: b.fromPincode || '',
    from_state: b.fromState || '',
    from_state_code: String(b.fromStateCode ?? 29),
    to_gstin: b.toGstin || '',
    to_name: b.toName || '',
    to_address: b.toAddress || '',
    to_pincode: b.toPincode || '',
    to_state: b.toState || '',
    to_state_code: String(b.toStateCode ?? 29),
    transport_mode: b.transportMode || 'road',
    vehicle_number: b.vehicleNumber || '',
    distance: String(b.distance ?? 0),
    notes: b.notes || '',
    item_name: first?.itemName || '',
    hsn_code: first?.hsnCode || '998314',
    quantity: String(first?.quantity ?? 1),
    unit_price: String(first?.unitPrice ?? 0)
  };
}

function buildEWayBillApiPayload(form: EWayBillFormValues): Record<string, unknown> {
  const qty = Math.max(0.0001, parseFloat(form.quantity) || 1);
  const unitPrice = parseFloat(form.unit_price) || 0;
  const inv = form.invoice_number.trim();
  const docDate = form.invoice_date;
  return {
    invoice_number: inv,
    invoice_date: docDate,
    supply_type: form.supply_type,
    sub_supply_type: form.sub_supply_type || 'supply',
    document_type: form.document_type,
    document_number: inv,
    document_date: docDate,
    from_gstin: form.from_gstin.trim(),
    from_name: form.from_name.trim(),
    from_address: form.from_address.trim(),
    from_pincode: form.from_pincode.trim(),
    from_state: form.from_state.trim(),
    from_state_code: parseInt(form.from_state_code, 10) || 0,
    to_gstin: form.to_gstin.trim() || undefined,
    to_name: form.to_name.trim(),
    to_address: form.to_address.trim(),
    to_pincode: form.to_pincode.trim(),
    to_state: form.to_state.trim(),
    to_state_code: parseInt(form.to_state_code, 10) || 0,
    transport_mode: form.transport_mode,
    vehicle_number: form.vehicle_number.trim() || undefined,
    distance: parseFloat(form.distance) || 0,
    notes: form.notes.trim() || undefined,
    items: [
      {
        item_name: form.item_name.trim() || 'Goods',
        hsn_code: form.hsn_code.trim() || '998314',
        quantity: qty,
        unit: 'PCS',
        unit_price: unitPrice,
        cgst_rate: 0,
        cgst_amount: 0,
        sgst_rate: 0,
        sgst_amount: 0,
        igst_rate: 0,
        igst_amount: 0
      }
    ]
  };
}

function validateEWayBillForm(form: EWayBillFormValues): boolean {
  if (!form.invoice_number.trim()) return false;
  if (!form.from_gstin.trim() || form.from_gstin.trim().length < 15) return false;
  if (!form.from_name.trim() || !form.from_address.trim() || !form.from_pincode.trim() || !form.from_state.trim()) return false;
  if (!form.to_name.trim() || !form.to_address.trim() || !form.to_pincode.trim() || !form.to_state.trim()) return false;
  return true;
}

const EWayBillComponent: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    dialogState: promptDialogState,
    showPrompt,
    handleConfirm: handlePromptConfirm,
    handleCancel: handlePromptCancel
  } = usePromptDialog();
  const [filteredEwayBills, setFilteredEwayBills] = useState<EWayBill[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [dialogForm, setDialogForm] = useState<EWayBillFormValues>(() => getInitialFormValues());
  const [selectedEwayBill, setSelectedEwayBill] = useState<EWayBill | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'view'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supplyTypeFilter, setSupplyTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [allEwayBills, setAllEwayBills] = useState<EWayBill[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const statCardSx = useMemo(
    () => ({
      borderRadius: '8px',
      border: `1px solid ${alpha(theme.palette.text.primary, 0.06)}`,
      boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
      bgcolor: theme.palette.background.paper,
    }),
    [theme]
  );
  const shellCardSx = useMemo(
    () => ({
      mb: 3,
      borderRadius: '8px',
      border: `1px solid ${alpha(theme.palette.text.primary, 0.06)}`,
      boxShadow: '0 2px 20px rgba(0,0,0,0.05)',
      overflow: 'hidden',
    }),
    [theme]
  );
  // 샘플 데이터
  const sampleData = useMemo<EWayBill[]>(() => [
    {
      id: 1,
      ewayBillNumber: 'EWB-2024-001',
      invoiceNumber: 'INV-2024-001',
      invoiceDate: '2024-01-20',
      supplyType: 'outward',
      subSupplyType: 'supply',
      documentType: 'invoice',
      documentNumber: 'INV-2024-001',
      documentDate: '2024-01-20',
      fromGstin: '29ABCDE1234F1Z5',
      fromName: 'MVS Solutions',
      fromAddress: '서울시 서초구 서초대로 456',
      fromPincode: '06592',
      fromState: '서울특별시',
      toGstin: '29FGHIJ5678K9L0',
      toName: 'ABC 회사',
      toAddress: '서울시 강남구 테헤란로 123',
      toPincode: '06141',
      toState: '서울특별시',
      transportMode: 'road',
      vehicleNumber: '서울12가3456',
      vehicleType: 'truck',
      transporterId: 'TRP001',
      transporterName: '한국물류',
      transporterDocNumber: 'TRP-2024-001',
      transporterDocDate: '2024-01-20',
      distance: 15,
      items: [
        {
          id: 1,
          itemName: '소프트웨어 라이선스',
          hsnCode: '998314',
          quantity: 1,
          unitPrice: 1000000,
          totalValue: 1000000,
          cgstRate: 9,
          cgstAmount: 90000,
          sgstRate: 9,
          sgstAmount: 90000,
          igstRate: 0,
          igstAmount: 0,
          totalTaxAmount: 180000,
          totalAmount: 1180000
        }
      ],
      totalValue: 1000000,
      totalTaxAmount: 180000,
      totalAmount: 1180000,
      status: 'active',
      generatedAt: '2024-01-20 10:30:00',
      validUntil: '2024-01-27 10:30:00',
      generatedBy: '김개발',
      createdAt: '2024-01-20 10:00:00',
      updatedAt: '2024-01-20 10:30:00',
      notes: '정기 라이선스 배송'
    },
    {
      id: 2,
      ewayBillNumber: 'EWB-2024-002',
      invoiceNumber: 'INV-2024-002',
      invoiceDate: '2024-01-22',
      supplyType: 'outward',
      subSupplyType: 'supply',
      documentType: 'invoice',
      documentNumber: 'INV-2024-002',
      documentDate: '2024-01-22',
      fromGstin: '29ABCDE1234F1Z5',
      fromName: 'MVS Solutions',
      fromAddress: '서울시 서초구 서초대로 456',
      fromPincode: '06592',
      fromState: '서울특별시',
      toGstin: '29MNOPQ9012R3S4',
      toName: 'XYZ 기업',
      toAddress: '경기도 성남시 분당구 판교로 789',
      toPincode: '13494',
      toState: '경기도',
      transportMode: 'road',
      vehicleNumber: '경기34나7890',
      vehicleType: 'van',
      transporterId: 'TRP002',
      transporterName: '빠른배송',
      transporterDocNumber: 'TRP-2024-002',
      transporterDocDate: '2024-01-22',
      distance: 45,
      items: [
        {
          id: 2,
          itemName: 'IT 장비',
          hsnCode: '8471',
          quantity: 2,
          unitPrice: 500000,
          totalValue: 1000000,
          cgstRate: 0,
          cgstAmount: 0,
          sgstRate: 0,
          sgstAmount: 0,
          igstRate: 18,
          igstAmount: 180000,
          totalTaxAmount: 180000,
          totalAmount: 1180000
        }
      ],
      totalValue: 1000000,
      totalTaxAmount: 180000,
      totalAmount: 1180000,
      status: 'generated',
      generatedAt: '2024-01-22 14:15:00',
      validUntil: '2024-01-29 14:15:00',
      generatedBy: '이프론트',
      createdAt: '2024-01-22 14:00:00',
      updatedAt: '2024-01-22 14:15:00',
      notes: 'IT 장비 배송'
    }
  ], []);

  const loadEwayBillData = useCallback(async () => {
    try {
      const response = await ewayBillService.getEWayBills({ page, limit: itemsPerPage });
      if (response.success && response.data) {
        const bills = Array.isArray(response.data) ? response.data : response.data.items || [];
        setAllEwayBills(
          bills.map((b: unknown) => deepCamelCase(b) as EWayBill)
        );
      } else {
        // API 실패 시 샘플 데이터 사용
        setAllEwayBills(sampleData);
      }
    } catch {
      // API 실패 시 샘플 데이터 사용
      setAllEwayBills(sampleData);
    }
  }, [itemsPerPage, page, sampleData]);

  const filterEwayBills = useCallback(() => {
    let filtered = allEwayBills;

    if (searchTerm) {
      filtered = filtered.filter(ewayBill =>
        (ewayBill.ewayBillNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ewayBill.gstnEwayBillNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        ewayBill.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ewayBill.fromName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ewayBill.toName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ewayBill.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(ewayBill => ewayBill.status === statusFilter);
    }

    if (supplyTypeFilter) {
      filtered = filtered.filter(ewayBill => ewayBill.supplyType === supplyTypeFilter);
    }

    setFilteredEwayBills(filtered);
  }, [allEwayBills, searchTerm, statusFilter, supplyTypeFilter]);

  useEffect(() => {
    loadEwayBillData();
  }, [loadEwayBillData]);

  useEffect(() => {
    filterEwayBills();
  }, [filterEwayBills]);

  const getStatusChip = (status: string) => {
    const labels: Record<string, string> = {
      draft: t('eWayBillManagement.status.draft'),
      generated: t('eWayBillManagement.status.generated'),
      active: t('eWayBillManagement.status.active'),
      expired: t('eWayBillManagement.status.expired'),
      cancelled: t('eWayBillManagement.status.cancelled'),
      rejected: t('eWayBillManagement.status.rejected'),
    };
    const label = labels[status] || t('eWayBillManagement.status.unknown');
    const chipSx = { fontWeight: 500, borderRadius: '8px' } as const;
    switch (status) {
      case 'draft':
        return <Chip label={label} color="default" size="small" sx={chipSx} />;
      case 'generated':
        return <Chip label={label} color="info" size="small" variant="outlined" sx={chipSx} />;
      case 'active':
        return <Chip label={label} color="success" size="small" variant="outlined" sx={chipSx} />;
      case 'expired':
        return <Chip label={label} color="warning" size="small" variant="outlined" sx={chipSx} />;
      case 'cancelled':
        return <Chip label={label} color="error" size="small" variant="outlined" sx={chipSx} />;
      case 'rejected':
        return <Chip label={label} color="error" size="small" variant="outlined" sx={chipSx} />;
      default:
        return <Chip label={label} color="default" size="small" sx={chipSx} />;
    }
  };

  const getSupplyTypeLabel = (type: string) => {
    if (type === 'outward') return t('eWayBillManagement.supply.outward');
    if (type === 'inward') return t('eWayBillManagement.supply.inward');
    return t('eWayBillManagement.supply.unknown');
  };

  const getTransportModeLabel = (mode: string) => {
    const key = `eWayBillManagement.transportMode.${mode}` as const;
    if (mode === 'road' || mode === 'rail' || mode === 'air' || mode === 'ship') {
      return t(key as 'eWayBillManagement.transportMode.road');
    }
    return t('eWayBillManagement.transportMode.unknown');
  };

  const handleViewEwayBill = (ewayBill: EWayBill) => {
    setSelectedEwayBill(ewayBill);
    setViewMode('view');
  };

  const handleEditEwayBill = (ewayBill: EWayBill) => {
    setSelectedEwayBill(ewayBill);
    setOpenDialog(true);
  };

  const handleOpenCreate = () => {
    setSelectedEwayBill(null);
    setOpenDialog(true);
  };

  useEffect(() => {
    if (!openDialog) return;
    if (selectedEwayBill) {
      setDialogForm(mapBillToForm(selectedEwayBill));
    } else {
      setDialogForm(getInitialFormValues());
    }
  }, [openDialog, selectedEwayBill]);

  const handleCloseDialog = useCallback(() => {
    if (dialogSubmitting) return;
    setOpenDialog(false);
    setSelectedEwayBill(null);
    setDialogForm(getInitialFormValues());
  }, [dialogSubmitting]);

  const handleSubmitDialog = async () => {
    if (!validateEWayBillForm(dialogForm)) {
      setError(t('eWayBillManagement.dialog.validationRequired'));
      return;
    }
    setDialogSubmitting(true);
    setError('');
    try {
      const payload = buildEWayBillApiPayload(dialogForm);
      if (selectedEwayBill) {
        const res = await ewayBillService.updateEWayBill(selectedEwayBill.id, payload);
        if (res.success) {
          setSuccess(t('eWayBillManagement.dialog.updateSuccess'));
          setOpenDialog(false);
          setSelectedEwayBill(null);
          setDialogForm(getInitialFormValues());
          await loadEwayBillData();
        } else {
          setError((res as { message?: string }).message || t('eWayBillManagement.errors.createEWayBill'));
        }
      } else {
        const res = await ewayBillService.createEWayBill(payload);
        if (res.success) {
          setSuccess(t('eWayBillManagement.dialog.createSuccess'));
          setOpenDialog(false);
          setSelectedEwayBill(null);
          setDialogForm(getInitialFormValues());
          await loadEwayBillData();
        } else {
          setError((res as { message?: string }).message || t('eWayBillManagement.errors.createEWayBill'));
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || t('eWayBillManagement.errors.createEWayBill'));
    } finally {
      setDialogSubmitting(false);
    }
  };

  const openDeleteDialog = (id: number) => {
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    if (deleteSubmitting) return;
    setDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  };

  const confirmDeleteEwayBill = async () => {
    if (deleteTargetId == null) return;
    setDeleteSubmitting(true);
    try {
      await ewayBillService.deleteEWayBill(deleteTargetId);
      setSuccess('E-Way Bill이 성공적으로 삭제되었습니다.');
      setAllEwayBills((prev) => prev.filter((bill) => bill.id !== deleteTargetId));
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
      await loadEwayBillData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const deleteTargetBill =
    deleteTargetId != null ? allEwayBills.find((b) => b.id === deleteTargetId) : undefined;

  const handleGenerateEwayBill = async (id: number) => {
    try {
      const response = await ewayBillService.generateEWayBill(id);
      if (response.success) {
        setSuccess('E-Way Bill이 성공적으로 생성되었습니다.');
        loadEwayBillData();
      } else {
        setError((response as { message?: string }).message || 'E-Way Bill 생성에 실패했습니다.');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'E-Way Bill 생성 중 오류가 발생했습니다.');
    }
  };

  const handleCancelEwayBill = (id: number) => {
    showPrompt(
      '취소 사유를 입력하세요.',
      (reason) => {
        void (async () => {
          try {
            const response = await ewayBillService.cancelEWayBill(id, reason);
            if (response.success) {
              setSuccess('E-Way Bill이 취소되었습니다.');
              loadEwayBillData();
            }
          } catch (error: any) {
            setError(error.response?.data?.message || 'E-Way Bill 취소 중 오류가 발생했습니다.');
          }
        })();
      },
      {
        title: 'E-Way Bill 취소',
        label: '취소 사유',
        multiline: true,
        minRows: 2,
        confirmText: t('common.confirm'),
        cancelText: t('common.cancel')
      }
    );
  };

  const totalBills = allEwayBills.length;
  const activeBills = allEwayBills.filter(ewayBill => ewayBill.status === 'active').length;
  const expiredBills = allEwayBills.filter(ewayBill => ewayBill.status === 'expired').length;
  const totalValue = allEwayBills.reduce((sum, ewayBill) => sum + ewayBill.totalValue, 0);

  const paginatedEwayBills = filteredEwayBills.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  if (viewMode === 'view' && selectedEwayBill) {
    return (
      <>
      <Box sx={{ ...mvsPageRootSx }}>
        <DaeheungPageHeader
          title={t('eWayBillManagement.detail.title')}
          actions={
            <Button
              variant="outlined"
              onClick={() => setViewMode('list')}
              sx={{ textTransform: 'none', borderRadius: '8px' }}
            >
              {t('eWayBillManagement.detail.backToList')}
            </Button>
          }
        />

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
              <Box>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  E-Way Bill #{selectedEwayBill.ewayBillNumber}
                </Typography>
                {selectedEwayBill.gstnEwayBillNo && (
                  <Typography variant="body2" color="success.main" fontWeight="600" gutterBottom>
                    GSTN E-Way Bill No. {selectedEwayBill.gstnEwayBillNo}
                  </Typography>
                )}
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  인보이스: {selectedEwayBill.invoiceNumber} | 날짜: {selectedEwayBill.invoiceDate}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  {getStatusChip(selectedEwayBill.status)}
                  <Chip label={getSupplyTypeLabel(selectedEwayBill.supplyType)} color="primary" size="small" />
                </Box>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h4" color="primary.main">
                  Rs. {selectedEwayBill.totalAmount.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  총 금액
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* 송장/입장 정보 */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>송장/입장 정보</Typography>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 2 
              }}>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    발송처
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    {selectedEwayBill.fromName}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    GSTIN: {selectedEwayBill.fromGstin}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    {selectedEwayBill.fromAddress}
                  </Typography>
                  <Typography variant="body2">
                    {selectedEwayBill.fromPincode} {selectedEwayBill.fromState}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    수신처
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    {selectedEwayBill.toName}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    GSTIN: {selectedEwayBill.toGstin}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    {selectedEwayBill.toAddress}
                  </Typography>
                  <Typography variant="body2">
                    {selectedEwayBill.toPincode} {selectedEwayBill.toState}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* 운송 정보 */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>운송 정보</Typography>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 2 
              }}>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>운송 수단:</strong> {getTransportModeLabel(selectedEwayBill.transportMode)}
                  </Typography>
                  {selectedEwayBill.vehicleNumber && (
                    <Typography variant="body2" gutterBottom>
                      <strong>차량 번호:</strong> {selectedEwayBill.vehicleNumber}
                    </Typography>
                  )}
                  {selectedEwayBill.vehicleType && (
                    <Typography variant="body2" gutterBottom>
                      <strong>차량 유형:</strong> {selectedEwayBill.vehicleType}
                    </Typography>
                  )}
                  <Typography variant="body2" gutterBottom>
                    <strong>거리:</strong> {selectedEwayBill.distance} km
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  {selectedEwayBill.transporterName && (
                    <Typography variant="body2" gutterBottom>
                      <strong>운송업체:</strong> {selectedEwayBill.transporterName}
                    </Typography>
                  )}
                  {selectedEwayBill.transporterId && (
                    <Typography variant="body2" gutterBottom>
                      <strong>운송업체 ID:</strong> {selectedEwayBill.transporterId}
                    </Typography>
                  )}
                  {selectedEwayBill.transporterDocNumber && (
                    <Typography variant="body2" gutterBottom>
                      <strong>운송 문서:</strong> {selectedEwayBill.transporterDocNumber}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* 상품 정보 */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>상품 정보</Typography>
              <TableContainer>
                <Table>
                  <TableHead
                    sx={{
                      bgcolor: 'background.paper',
                      '& .MuiTableCell-head': {
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        textTransform: 'none',
                        letterSpacing: 'normal',
                        borderBottom: '2px solid',
                        borderColor: 'primary.main',
                        py: 1.25
                      }
                    }}
                  >
                    <TableRow>
                      <TableCell>상품명</TableCell>
                      <TableCell>HSN 코드</TableCell>
                      <TableCell>수량</TableCell>
                      <TableCell>단가</TableCell>
                      <TableCell>금액</TableCell>
                      <TableCell>세금</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedEwayBill.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell>{item.hsnCode}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>Rs. {item.unitPrice.toLocaleString()}</TableCell>
                        <TableCell>Rs. {item.totalValue.toLocaleString()}</TableCell>
                        <TableCell>Rs. {item.totalTaxAmount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* 상태 정보 */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>상태 정보</Typography>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 2 
              }}>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>생성일:</strong> {selectedEwayBill.generatedAt || '-'}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>유효기간:</strong> {selectedEwayBill.validUntil || '-'}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>생성자:</strong> {selectedEwayBill.generatedBy}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>총 상품가액:</strong> Rs. {selectedEwayBill.totalValue.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>총 세금:</strong> Rs. {selectedEwayBill.totalTaxAmount.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>총 금액:</strong> Rs. {selectedEwayBill.totalAmount.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* 메모 */}
            {selectedEwayBill.notes && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>메모</Typography>
                <Card sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body1">
                    {selectedEwayBill.notes}
                  </Typography>
                </Card>
              </Box>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => handleEditEwayBill(selectedEwayBill)}
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
              {selectedEwayBill.status === 'draft' && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => handleGenerateEwayBill(selectedEwayBill.id)}
                >
                  생성
                </Button>
              )}
              {selectedEwayBill.status === 'active' && (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => handleCancelEwayBill(selectedEwayBill.id)}
                >
                  취소
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>
      <PromptDialog
        open={promptDialogState.open}
        title={promptDialogState.title}
        message={promptDialogState.message}
        label={promptDialogState.label}
        defaultValue={promptDialogState.defaultValue}
        placeholder={promptDialogState.placeholder}
        multiline={promptDialogState.multiline}
        minRows={promptDialogState.minRows}
        confirmText={promptDialogState.confirmText}
        cancelText={promptDialogState.cancelText}
        required={promptDialogState.required}
        onConfirm={handlePromptConfirm}
        onCancel={handlePromptCancel}
      />
      </>
    );
  }

  return (
    <>
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('eWayBillManagement.title')}
        actions={
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{ textTransform: 'none', borderRadius: '8px', px: 2 }}
          >
            {t('eWayBillManagement.actions.createEWayBill')}
          </Button>
        }
      />

      {/* 통계 카드 */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 2.5,
        mb: 3,
      }}>
        <Card elevation={0} sx={statCardSx}>
          <CardContent sx={{ py: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }} gutterBottom display="block">
              {t('eWayBillManagement.analytics.totalEWayBills')}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
              {totalBills}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={statCardSx}>
          <CardContent sx={{ py: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }} gutterBottom display="block">
              {t('eWayBillManagement.analytics.activeEWayBills')}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.03em', color: 'success.main' }}>
              {activeBills}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={statCardSx}>
          <CardContent sx={{ py: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }} gutterBottom display="block">
              {t('eWayBillManagement.analytics.expiredEWayBills')}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.03em', color: 'warning.main' }}>
              {expiredBills}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={statCardSx}>
          <CardContent sx={{ py: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }} gutterBottom display="block">
              {t('eWayBillManagement.analytics.totalItemValue')}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
              Rs. {totalValue.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 필터 및 검색 */}
      <Card elevation={0} sx={shellCardSx}>
        <CardContent sx={{ py: 2.5 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr 1fr' },
              gap: 2,
              alignItems: 'flex-end',
              ...mvsSearchFieldSx,
            }}
          >
            <TextField
              fullWidth
              size="small"
              label={t('eWayBillManagement.filters.search')}
              placeholder={t('eWayBillManagement.filters.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  height: 40,
                  '& .MuiOutlinedInput-input': { py: 0 },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              size="small"
              select
              label={t('eWayBillManagement.filters.status')}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{
                displayEmpty: true,
                renderValue: (selected) => {
                  if (selected === '' || selected == null) return t('eWayBillManagement.filters.all');
                  const statusLabels: Record<string, string> = {
                    draft: t('eWayBillManagement.status.draft'),
                    generated: t('eWayBillManagement.status.generated'),
                    active: t('eWayBillManagement.status.active'),
                    expired: t('eWayBillManagement.status.expired'),
                    cancelled: t('eWayBillManagement.status.cancelled'),
                    rejected: t('eWayBillManagement.status.rejected'),
                  };
                  return statusLabels[String(selected)] ?? String(selected);
                },
              }}
              sx={eWayBillFilterSelectSx}
            >
              <MenuItem value="">{t('eWayBillManagement.filters.all')}</MenuItem>
              <MenuItem value="draft">{t('eWayBillManagement.status.draft')}</MenuItem>
              <MenuItem value="generated">{t('eWayBillManagement.status.generated')}</MenuItem>
              <MenuItem value="active">{t('eWayBillManagement.status.active')}</MenuItem>
              <MenuItem value="expired">{t('eWayBillManagement.status.expired')}</MenuItem>
              <MenuItem value="cancelled">{t('eWayBillManagement.status.cancelled')}</MenuItem>
              <MenuItem value="rejected">{t('eWayBillManagement.status.rejected')}</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              select
              label={t('eWayBillManagement.filters.supplyType')}
              value={supplyTypeFilter}
              onChange={(e) => setSupplyTypeFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{
                displayEmpty: true,
                renderValue: (selected) => {
                  if (selected === '' || selected == null) return t('eWayBillManagement.filters.all');
                  const supplyLabels: Record<string, string> = {
                    outward: t('eWayBillManagement.supply.outward'),
                    inward: t('eWayBillManagement.supply.inward'),
                  };
                  return supplyLabels[String(selected)] ?? String(selected);
                },
              }}
              sx={eWayBillFilterSelectSx}
            >
              <MenuItem value="">{t('eWayBillManagement.filters.all')}</MenuItem>
              <MenuItem value="outward">{t('eWayBillManagement.supply.outward')}</MenuItem>
              <MenuItem value="inward">{t('eWayBillManagement.supply.inward')}</MenuItem>
            </TextField>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setSupplyTypeFilter('');
              }}
              sx={{
                height: 40,
                whiteSpace: 'nowrap',
                minWidth: 'fit-content',
                px: 2,
                borderRadius: '8px',
                textTransform: 'none',
              }}
            >
              {t('eWayBillManagement.actions.reset')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* E-Way Bill 목록 테이블 */}
      <Card elevation={0} sx={shellCardSx}>
        <Box sx={{ px: 2.5, pt: 2.5, pb: 1 }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
            {t('eWayBillManagement.tabs.list')}
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead
              sx={{
                bgcolor: alpha(theme.palette.text.primary, 0.03),
                '& .MuiTableCell-head': {
                  color: 'text.secondary',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  letterSpacing: '0.04em',
                  textTransform: 'none',
                  borderBottom: '1px solid',
                  borderColor: alpha(theme.palette.text.primary, 0.08),
                  py: 1.25,
                },
                '& .MuiTableCell-head:last-of-type': {
                  textAlign: 'center',
                },
              }}
            >
              <TableRow>
                <TableCell>{t('eWayBillManagement.listTable.eWayBillInfo')}</TableCell>
                <TableCell>{t('eWayBillManagement.listTable.supply')}</TableCell>
                <TableCell>{t('eWayBillManagement.listTable.from')}</TableCell>
                <TableCell>{t('eWayBillManagement.listTable.to')}</TableCell>
                <TableCell>{t('eWayBillManagement.listTable.transport')}</TableCell>
                <TableCell>{t('eWayBillManagement.listTable.amount')}</TableCell>
                <TableCell>{t('eWayBillManagement.listTable.status')}</TableCell>
                <TableCell>{t('eWayBillManagement.listTable.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedEwayBills.map((ewayBill) => (
                <TableRow key={ewayBill.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {ewayBill.ewayBillNumber}
                      </Typography>
                      {ewayBill.gstnEwayBillNo && (
                        <Typography variant="caption" color="success.main" display="block">
                          GSTN: {ewayBill.gstnEwayBillNo}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {ewayBill.invoiceNumber}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={getSupplyTypeLabel(ewayBill.supplyType)} size="small" variant="outlined" sx={{ fontWeight: 500, borderRadius: '8px' }} />
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {ewayBill.fromName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ewayBill.fromState}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {ewayBill.toName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ewayBill.toState}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {getTransportModeLabel(ewayBill.transportMode)}
                      </Typography>
                      {ewayBill.vehicleNumber && (
                        <Typography variant="caption" color="text.secondary">
                          {ewayBill.vehicleNumber}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      Rs. {ewayBill.totalAmount.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(ewayBill.status)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title={t('eWayBillManagement.actions.view')}>
                        <IconButton size="small" onClick={() => handleViewEwayBill(ewayBill)} sx={{ borderRadius: '10px' }}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('eWayBillManagement.actions.edit')}>
                        <IconButton size="small" onClick={() => handleEditEwayBill(ewayBill)} sx={{ borderRadius: '10px' }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {ewayBill.status === 'draft' && (
                        <Tooltip title={t('eWayBillManagement.actions.generate')}>
                          <IconButton
                            size="small"
                            onClick={() => handleGenerateEwayBill(ewayBill.id)}
                            color="success"
                            sx={{ borderRadius: '10px' }}
                          >
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {ewayBill.status === 'active' && (
                        <Tooltip title={t('eWayBillManagement.actions.cancelBill')}>
                          <IconButton
                            size="small"
                            onClick={() => handleCancelEwayBill(ewayBill.id)}
                            color="error"
                            sx={{ borderRadius: '10px' }}
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={t('eWayBillManagement.actions.delete')}>
                        <IconButton size="small" onClick={() => openDeleteDialog(ewayBill.id)} sx={{ borderRadius: '10px' }}>
                          <DeleteIcon fontSize="small" />
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
            count={Math.ceil(filteredEwayBills.length / itemsPerPage)}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      </Card>

      {/* 삭제 확인 */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleCloseDeleteDialog}
        aria-labelledby="delete-eway-dialog-title"
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider'
          }
        }}
      >
        <DialogTitle
          id="delete-eway-dialog-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            pb: 1,
            fontWeight: 600
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: 'error.main',
              color: 'error.contrastText',
              opacity: 0.95
            }}
          >
            <DeleteIcon fontSize="small" />
          </Box>
          E-Way Bill 삭제
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography variant="body1" color="text.primary">
            이 E-Way Bill을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.
          </Typography>
          {deleteTargetBill && (
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                문서 번호
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {deleteTargetBill.ewayBillNumber}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                인보이스
              </Typography>
              <Typography variant="body2">{deleteTargetBill.invoiceNumber}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={handleCloseDeleteDialog}
            disabled={deleteSubmitting}
            sx={{ minWidth: 88 }}
          >
            취소
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void confirmDeleteEwayBill()}
            disabled={deleteSubmitting}
            disableElevation
            sx={{ minWidth: 88 }}
          >
            {deleteSubmitting ? <CircularProgress size={22} color="inherit" /> : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* E-Way Bill 생성/수정 다이얼로그 */}
      <Dialog
        open={openDialog}
        onClose={() => {
          if (dialogSubmitting) return;
          handleCloseDialog();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedEwayBill ? t('eWayBillManagement.dialog.editTitle') : t('eWayBillManagement.dialog.createTitle')}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('eWayBillManagement.dialog.hintRequired')}
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                required
                fullWidth
                size="small"
                label={t('eWayBillManagement.dialog.invoiceNumber')}
                value={dialogForm.invoice_number}
                onChange={(e) => setDialogForm((f) => ({ ...f, invoice_number: e.target.value }))}
              />
              <TextField
                required
                fullWidth
                size="small"
                type="date"
                label={t('eWayBillManagement.dialog.invoiceDate')}
                value={dialogForm.invoice_date}
                onChange={(e) => setDialogForm((f) => ({ ...f, invoice_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <FormControl fullWidth size="small">
              <InputLabel>{t('eWayBillManagement.dialog.supplyType')}</InputLabel>
              <Select
                label={t('eWayBillManagement.dialog.supplyType')}
                value={dialogForm.supply_type}
                onChange={(e) =>
                  setDialogForm((f) => ({ ...f, supply_type: e.target.value as 'outward' | 'inward' }))
                }
              >
                <MenuItem value="outward">Outward</MenuItem>
                <MenuItem value="inward">Inward</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="subtitle2" color="primary">
              {t('eWayBillManagement.detail.fromAddress', '출발지')} / Supplier
            </Typography>
            <TextField
              required
              fullWidth
              size="small"
              label={t('eWayBillManagement.dialog.fromGstin')}
              value={dialogForm.from_gstin}
              onChange={(e) => setDialogForm((f) => ({ ...f, from_gstin: e.target.value }))}
              helperText="15 chars (India GSTIN)"
            />
            <TextField
              required
              fullWidth
              size="small"
              label={t('eWayBillManagement.dialog.fromName')}
              value={dialogForm.from_name}
              onChange={(e) => setDialogForm((f) => ({ ...f, from_name: e.target.value }))}
            />
            <TextField
              required
              fullWidth
              size="small"
              multiline
              minRows={2}
              label={t('eWayBillManagement.dialog.supplierAddress')}
              value={dialogForm.from_address}
              onChange={(e) => setDialogForm((f) => ({ ...f, from_address: e.target.value }))}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                required
                fullWidth
                size="small"
                label={t('eWayBillManagement.dialog.fromPincode')}
                value={dialogForm.from_pincode}
                onChange={(e) => setDialogForm((f) => ({ ...f, from_pincode: e.target.value }))}
              />
              <TextField
                required
                fullWidth
                size="small"
                label={t('eWayBillManagement.dialog.fromState')}
                value={dialogForm.from_state}
                onChange={(e) => setDialogForm((f) => ({ ...f, from_state: e.target.value }))}
              />
              <TextField
                required
                fullWidth
                size="small"
                type="number"
                label={t('eWayBillManagement.dialog.fromStateCode')}
                value={dialogForm.from_state_code}
                onChange={(e) => setDialogForm((f) => ({ ...f, from_state_code: e.target.value }))}
              />
            </Stack>
            <Typography variant="subtitle2" color="primary">
              {t('eWayBillManagement.detail.toAddress', '도착지')} / Recipient
            </Typography>
            <TextField
              fullWidth
              size="small"
              label={t('eWayBillManagement.dialog.toGstin')}
              value={dialogForm.to_gstin}
              onChange={(e) => setDialogForm((f) => ({ ...f, to_gstin: e.target.value }))}
            />
            <TextField
              required
              fullWidth
              size="small"
              label={t('eWayBillManagement.dialog.toName')}
              value={dialogForm.to_name}
              onChange={(e) => setDialogForm((f) => ({ ...f, to_name: e.target.value }))}
            />
            <TextField
              required
              fullWidth
              size="small"
              multiline
              minRows={2}
              label={t('eWayBillManagement.dialog.recipientAddress')}
              value={dialogForm.to_address}
              onChange={(e) => setDialogForm((f) => ({ ...f, to_address: e.target.value }))}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                required
                fullWidth
                size="small"
                label={t('eWayBillManagement.dialog.toPincode')}
                value={dialogForm.to_pincode}
                onChange={(e) => setDialogForm((f) => ({ ...f, to_pincode: e.target.value }))}
              />
              <TextField
                required
                fullWidth
                size="small"
                label={t('eWayBillManagement.dialog.toState')}
                value={dialogForm.to_state}
                onChange={(e) => setDialogForm((f) => ({ ...f, to_state: e.target.value }))}
              />
              <TextField
                required
                fullWidth
                size="small"
                type="number"
                label={t('eWayBillManagement.dialog.toStateCode')}
                value={dialogForm.to_state_code}
                onChange={(e) => setDialogForm((f) => ({ ...f, to_state_code: e.target.value }))}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Transport</InputLabel>
                <Select
                  label="Transport"
                  value={dialogForm.transport_mode}
                  onChange={(e) =>
                    setDialogForm((f) => ({
                      ...f,
                      transport_mode: e.target.value as EWayBillFormValues['transport_mode']
                    }))
                  }
                >
                  <MenuItem value="road">Road</MenuItem>
                  <MenuItem value="rail">Rail</MenuItem>
                  <MenuItem value="air">Air</MenuItem>
                  <MenuItem value="ship">Ship</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                size="small"
                label={t('eWayBillManagement.dialog.vehicleNumber')}
                value={dialogForm.vehicle_number}
                onChange={(e) => setDialogForm((f) => ({ ...f, vehicle_number: e.target.value }))}
              />
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t('eWayBillManagement.dialog.distanceKm')}
                value={dialogForm.distance}
                onChange={(e) => setDialogForm((f) => ({ ...f, distance: e.target.value }))}
              />
            </Stack>
            <Typography variant="subtitle2" color="primary">
              {t('eWayBillManagement.detail.goodsList', '품목')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                size="small"
                label={t('eWayBillManagement.dialog.itemName')}
                value={dialogForm.item_name}
                onChange={(e) => setDialogForm((f) => ({ ...f, item_name: e.target.value }))}
              />
              <TextField
                fullWidth
                size="small"
                label={t('eWayBillManagement.dialog.hsnCode')}
                value={dialogForm.hsn_code}
                onChange={(e) => setDialogForm((f) => ({ ...f, hsn_code: e.target.value }))}
              />
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t('eWayBillManagement.dialog.quantity')}
                value={dialogForm.quantity}
                onChange={(e) => setDialogForm((f) => ({ ...f, quantity: e.target.value }))}
              />
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t('eWayBillManagement.dialog.unitPrice')}
                value={dialogForm.unit_price}
                onChange={(e) => setDialogForm((f) => ({ ...f, unit_price: e.target.value }))}
              />
            </Stack>
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              label={t('eWayBillManagement.dialog.notes')}
              value={dialogForm.notes}
              onChange={(e) => setDialogForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} disabled={dialogSubmitting}>
            {t('eWayBillManagement.dialog.cancelButton')}
          </Button>
          <Button variant="contained" onClick={() => void handleSubmitDialog()} disabled={dialogSubmitting}>
            {dialogSubmitting ? (
              <CircularProgress size={22} color="inherit" />
            ) : selectedEwayBill ? (
              t('eWayBillManagement.dialog.submitUpdate')
            ) : (
              t('eWayBillManagement.dialog.submitCreate')
            )}
          </Button>
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
    </Box>
    <PromptDialog
      open={promptDialogState.open}
      title={promptDialogState.title}
      message={promptDialogState.message}
      label={promptDialogState.label}
      defaultValue={promptDialogState.defaultValue}
      placeholder={promptDialogState.placeholder}
      multiline={promptDialogState.multiline}
      minRows={promptDialogState.minRows}
      confirmText={promptDialogState.confirmText}
      cancelText={promptDialogState.cancelText}
      required={promptDialogState.required}
      onConfirm={handlePromptConfirm}
      onCancel={handlePromptCancel}
    />
    </>
  );
};

export default EWayBillComponent;
