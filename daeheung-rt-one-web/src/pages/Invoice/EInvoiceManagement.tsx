import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Alert,
  Divider,
  Tooltip,
  Tabs,
  Tab,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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
  mvsTableBodyRowSx } from '../../theme/daeheungLayout';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  ReceiptLong as ReceiptLongIcon,
  Add as AddIcon,
  Send as SendIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Cancel as CancelIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  QrCode as QrCodeIcon,
  LocalShipping as LocalShippingIcon,
  Verified as VerifiedIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon
} from '@mui/icons-material';
import { useStore } from '../../store';
import { api, accountingService } from '../../services/api';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import {
  companySelectListboxSlotProps,
  companySelectNowrapSx,
  shortCompanyName,
} from '../../utils/companyDisplayName';
import { AxiosResponse } from 'axios';
import { useTranslation } from 'react-i18next';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import { useMenuActionGuard } from '../../hooks/useMenuActionGuard';
import {
  MenuPermissionButton,
} from '../../components/Common/MenuPermissionControls';

const E_INVOICE_MENU_ROUTES = ['/accounting/e-invoice'] as const;

const eInvoiceChipSx = {
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  '& .MuiChip-label': { px: 0.75 } } as const;

const eInvoiceActionBarSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.25,
  flexWrap: 'wrap',
  p: 0.35,
  borderRadius: '10px',
  bgcolor: '#F8FAFC',
  border: '1px solid #E2E8F0',
  '& .MuiIconButton-root': {
    width: 28,
    height: 28,
    borderRadius: '8px',
    color: 'text.secondary',
    '&:hover': {
      bgcolor: alpha('#0F172A', 0.06),
      color: 'primary.main' } } } as const;

const eInvoiceFilterFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx } as const;

// 타입 정의
interface EInvoice {
  id: string;
  invoiceNumber: string;
  irn: string; // Invoice Registration Number
  qrCode: string;
  seller: {
    id: string;
    name: string;
    gstin: string;
    address: string;
    phone: string;
    email: string;
  };
  buyer: {
    id: string;
    name: string;
    gstin: string;
    address: string;
    phone: string;
    email: string;
  };
  items: Array<{
    id: string;
    description: string;
    hsnCode: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
    cgstRate: number;
    cgstAmount: number;
    sgstRate: number;
    sgstAmount: number;
    igstRate: number;
    igstAmount: number;
    cessRate: number;
    cessAmount: number;
  }>;
  subtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  totalAmount: number;
  transactionType: 'B2B' | 'B2C' | 'Export' | 'SEZ';
  /** NIC Invoice Registration Portal 처리 상태 */
  irpStatus: 'draft' | 'submitted' | 'irn_generated' | 'failed';
  gstAckNo: string;
  gstAckDate: string;
  irpLastError: string;
  status: 'draft' | 'generated' | 'uploaded' | 'cancelled';
  issueDate: string;
  dueDate: string;
  notes: string;
  terms: string;
  proformaInvoiceId?: string;
  ewayBillId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvalStatus?: string | null;
  approverUserId?: number;
  approverName?: string;
  createdByUserId?: number;
}

interface ProformaInvoice {
  id: string;
  invoiceNumber: string;
  customer?: {
    name: string;
    gstin?: string;
    address?: string;
  };
  customer_name?: string;
  totalAmount: number;
  status: string;
  approvalStatus?: string | null;
}

const EInvoiceManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useStore();
  const menuFlags = usePageMenuPermission(E_INVOICE_MENU_ROUTES);
  const createGuard = useMenuActionGuard('create', E_INVOICE_MENU_ROUTES);
  const editGuard = useMenuActionGuard('edit', E_INVOICE_MENU_ROUTES);
  const [einvoices, setEinvoices] = useState<EInvoice[]>([]);
  const [proformaInvoices, setProformaInvoices] = useState<ProformaInvoice[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listTab, setListTab] = useState<'written' | 'pending'>('written');
  const [isCreating, setIsCreating] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedEInvoice, setSelectedEInvoice] = useState<EInvoice | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [irnLoadingId, setIrnLoadingId] = useState<string | null>(null);
  const [companyUsers, setCompanyUsers] = useState<Array<{ id: number; username: string; email: string }>>([]);

  const companyFilterOptions = useMemo(() => {
    const list = companies
      .map((c: any) => ({
        id: Number(c.id),
        name: shortCompanyName(c.name || c.company_name),
      }))
      .filter((c) => Number.isFinite(c.id) && c.id > 0 && c.name)
      .sort((a, b) => a.name.localeCompare(b.name));
    return [{ id: '' as number | '', name: t('eInvoiceManagement.filters.allCompanies') }, ...list];
  }, [companies, t]);

  const selectedCompanyOption = useMemo(() => {
    if (selectedCompanyId === '') {
      return companyFilterOptions.find((o) => o.id === '') ?? null;
    }
    return companyFilterOptions.find((o) => o.id === Number(selectedCompanyId)) ?? null;
  }, [companyFilterOptions, selectedCompanyId]);

  const normalizeParty = (party: any, fallbackName: string) => ({
    id: String(party?.id ?? ''),
    name: String(party?.name ?? party?.customer_name ?? party?.customerName ?? fallbackName),
    gstin: String(party?.gstin ?? party?.business_number ?? ''),
    address: String(party?.address ?? ''),
    phone: String(party?.phone ?? ''),
    email: String(party?.email ?? '')
  });

  const normalizeInvoiceItems = (items: any[] = []) =>
    items.map((item, index) => ({
      id: String(item?.id ?? `item-${index}`),
      description: String(item?.description ?? item?.item_name ?? t('eInvoiceManagement.defaults.item')),
      hsnCode: String(item?.hsnCode ?? item?.hsn_sac ?? ''),
      quantity: Number(item?.quantity ?? 1),
      unit: String(item?.unit ?? ''),
      unitPrice: Number(item?.unit_price ?? item?.unitPrice ?? 0),
      total: Number(item?.total_price ?? item?.total ?? 0),
      cgstRate: Number(item?.cgstRate ?? 0),
      cgstAmount: Number(item?.cgstAmount ?? 0),
      sgstRate: Number(item?.sgstRate ?? 0),
      sgstAmount: Number(item?.sgstAmount ?? 0),
      igstRate: Number(item?.igstRate ?? 0),
      igstAmount: Number(item?.igstAmount ?? 0),
      cessRate: Number(item?.cessRate ?? 0),
      cessAmount: Number(item?.cessAmount ?? 0)
    }));

  const normalizeEInvoice = (raw: any): EInvoice => {
    const customer = raw?.customer ?? null;
    const buyer = normalizeParty(customer, t('eInvoiceManagement.defaults.unspecified'));
    const seller = normalizeParty(
      companies.find((company) => company.id === raw?.company_id),
      t('eInvoiceManagement.defaults.company')
    );
    const gstIrn = String(raw?.gst_irn ?? '');
    const irpStatus = (raw?.irp_status ?? 'draft') as EInvoice['irpStatus'];
    return {
      id: String(raw?.id ?? ''),
      invoiceNumber: String(raw?.invoice_number ?? raw?.invoiceNumber ?? ''),
      irn: gstIrn,
      qrCode: String(raw?.signed_qr_code ?? raw?.qr_code ?? ''),
      seller,
      buyer,
      items: normalizeInvoiceItems(raw?.items ?? []),
      subtotal: Number(raw?.subtotal ?? 0),
      cgstTotal: Number(raw?.cgst_total ?? 0),
      sgstTotal: Number(raw?.sgst_total ?? 0),
      igstTotal: Number(raw?.igst_total ?? 0),
      cessTotal: Number(raw?.cess_total ?? 0),
      totalAmount: Number(raw?.total_amount ?? 0),
      transactionType: (raw?.transaction_type ?? 'B2B') as EInvoice['transactionType'],
      irpStatus,
      gstAckNo: String(raw?.gst_ack_no ?? ''),
      gstAckDate: String(raw?.gst_ack_date ?? ''),
      irpLastError: String(raw?.irp_last_error ?? ''),
      status: (raw?.status ?? 'draft') as EInvoice['status'],
      issueDate: String(raw?.invoice_date ?? raw?.issueDate ?? raw?.created_at ?? ''),
      dueDate: String(raw?.due_date ?? raw?.dueDate ?? ''),
      notes: String(raw?.notes ?? ''),
      terms: String(raw?.terms ?? ''),
      proformaInvoiceId: raw?.proforma_invoice_id ? String(raw?.proforma_invoice_id) : undefined,
      ewayBillId: raw?.eway_bill_id ? String(raw?.eway_bill_id) : undefined,
      createdBy:
        raw?.creator?.username || raw?.creator?.email || String(raw?.created_by ?? ''),
      createdAt: String(raw?.created_at ?? ''),
      updatedAt: String(raw?.updated_at ?? ''),
      approvalStatus: raw?.approval_status ?? null,
      approverUserId: raw?.approver_user_id != null ? Number(raw.approver_user_id) : undefined,
      approverName: raw?.approver?.username || raw?.approver?.email || '',
      createdByUserId: raw?.created_by != null ? Number(raw.created_by) : undefined
    };
  };

  const normalizeProformaInvoice = (raw: any): ProformaInvoice => {
    const customer = raw?.customer ?? null;
    const customerName = customer?.name ?? raw?.customer_name ?? t('eInvoiceManagement.defaults.unspecified');
    return {
      id: String(raw?.id ?? ''),
      invoiceNumber: String(raw?.invoice_number ?? raw?.invoiceNumber ?? ''),
      customer: {
        name: String(customerName),
        gstin: String(customer?.gstin ?? ''),
        address: String(customer?.address ?? '')
      },
      customer_name: raw?.customer_name,
      totalAmount: Number(raw?.total_amount ?? raw?.totalAmount ?? 0),
      status: String(raw?.status ?? 'draft'),
      approvalStatus: raw?.approval_status ?? null,
    };
  };

  const loadApprovedProformas = async () => {
    const params: Record<string, string | number> = { exclude_converted: 1 };
    if ((user?.role === 'root' || user?.role === 'audit') && selectedCompanyId) {
      params.company_id = selectedCompanyId;
    }
    const response = await api.get('/accounting/proforma-invoices', { params });
    if (response.data.success) {
      const normalized = (response.data.data || [])
        .map((item: any) => normalizeProformaInvoice(item))
        .filter(
          (item: ProformaInvoice) =>
            item.status !== 'converted' &&
            (item.approvalStatus === 'approved' || item.status === 'accepted')
        );
      setProformaInvoices(normalized);
    }
  };

  // 폼 상태
  const [formData, setFormData] = useState({
    proformaInvoiceId: '',
    customerId: '',
    invoiceNumber: '',
    transactionType: 'B2B' as 'B2B' | 'B2C' | 'Export' | 'SEZ',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    subtotal: 0,
    taxAmount: 0,
    notes: '',
    terms: 'Payment due within 30 days of invoice date.',
    approverUserId: '' as number | ''
  });

  // 데이터 로드
  useEffect(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const params: any = {};
        if ((user?.role === 'root' || user?.role === 'audit') && selectedCompanyId) {
          params.company_id = selectedCompanyId;
        }
        
        const [einvoicesResponse, , customersResponse] = await Promise.all([
          api.get('/accounting/e-invoices', { params }),
          loadApprovedProformas(),
          api.get('/customers')
        ]);

        if (einvoicesResponse.data.success) {
          const normalized = (einvoicesResponse.data.data || []).map((item: any) => normalizeEInvoice(item));
          setEinvoices(normalized);
        }
        if (customersResponse.data.success) {
          setCustomers(customersResponse.data.data || []);
        }
      } catch {
        setError(t('eInvoiceManagement.errors.loadData'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    if (user?.role === 'root' || user?.role === 'audit') {
      loadCompanies();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- normalize*, t, user.role는 초기 로드 시점 기준
  }, [selectedCompanyId, menuFlags.menusLoading, menuFlags.canRead]);

  useEffect(() => {
    if (menuFlags.menusLoading || createGuard.allowed) return;
    if (isCreating) setIsCreating(false);
  }, [menuFlags.menusLoading, createGuard.allowed, isCreating]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!user?.company_id) {
        setCompanyUsers([]);
        return;
      }
      try {
        const users = await useReferenceDataStore.getState().fetchUsers({ company_id: Number(user.company_id) });
        setCompanyUsers(
          users
            .filter((u: any) => u.status === 'active')
            .map((u: any) => ({ id: u.id, username: u.username || u.userid || '', email: u.email || '' }))
        );
      } catch {
      /* ignore */
    }
    };
    loadUsers();
  }, [user?.company_id]);

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      if (response.data.success) {
        setCompanies(response.data.data || []);
      }
    } catch {
      /* ignore */
    }
  };

  const isEInvoiceExportAllowed = (e: EInvoice) =>
    !e.approvalStatus || e.approvalStatus === 'approved';

  // E-Invoice 생성
  const handleCreate = async () => {
    if (!createGuard.guard()) return;
    try {
      if (formData.approverUserId === '') {
        setError(t('eInvoiceManagement.errors.selectApprover'));
        return;
      }
      let response: AxiosResponse<any>;
      if (formData.proformaInvoiceId) {
        response = await api.post(
          `/accounting/proforma-invoices/${formData.proformaInvoiceId}/create-e-invoice`,
          {
            issueDate: formData.issueDate,
            dueDate: formData.dueDate,
            notes: formData.notes,
            terms: formData.terms,
            transactionType: formData.transactionType,
            approver_user_id: Number(formData.approverUserId)
          }
        );
      } else {
        if (!formData.customerId) {
          setError(t('eInvoiceManagement.errors.selectProformaOrCustomer'));
          return;
        }
        const subtotal = Number(formData.subtotal || 0);
        const taxAmount = Number(formData.taxAmount || 0);
        const totalAmount = subtotal + taxAmount;
        response = await api.post('/accounting/e-invoices', {
          customer_id: Number(formData.customerId),
          invoice_number: formData.invoiceNumber?.trim() || undefined,
          invoice_date: formData.issueDate,
          due_date: formData.dueDate || formData.issueDate,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: formData.notes,
          status: 'draft',
          transaction_type: formData.transactionType,
          items: [],
          approver_user_id: Number(formData.approverUserId)
        });
      }
      if (response.data.success) {
        setEinvoices(prev => [normalizeEInvoice(response.data.data), ...prev]);
        setIsCreating(false);
        setFormData({
          proformaInvoiceId: '',
          customerId: '',
          invoiceNumber: '',
          transactionType: 'B2B',
          issueDate: new Date().toISOString().split('T')[0],
          dueDate: '',
          subtotal: 0,
          taxAmount: 0,
          notes: '',
          terms: 'Payment due within 30 days of invoice date.',
          approverUserId: ''
        });
        // 데이터 새로고침
        const params: any = {};
        if ((user?.role === 'root' || user?.role === 'audit') && selectedCompanyId) {
          params.company_id = selectedCompanyId;
        }
        const einvoicesResponse = await api.get('/accounting/e-invoices', { params });
        if (einvoicesResponse.data.success) {
          const normalized = (einvoicesResponse.data.data || []).map((item: any) => normalizeEInvoice(item));
          setEinvoices(normalized);
        }
      }
    } catch {
      setError(t('eInvoiceManagement.errors.createEInvoice'));
    }
  };

  // 작성 취소
  const handleCancelCreate = () => {
    setIsCreating(false);
    setFormData({
      proformaInvoiceId: '',
      customerId: '',
      invoiceNumber: '',
      transactionType: 'B2B',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      subtotal: 0,
      taxAmount: 0,
      notes: '',
      terms: 'Payment due within 30 days of invoice date.',
      approverUserId: ''
    });
  };

  // 상태 업데이트
  const handleStatusUpdate = async (id: string, status: string) => {
    if (!editGuard.guard()) return;
    try {
      const response = await api.put(`/accounting/e-invoices/${id}/status`, { status });
      if (response.data.success) {
        setEinvoices(prev => prev.map(einvoice => 
          einvoice.id === id ? { ...einvoice, status: status as any } : einvoice
        ));
      }
    } catch {
      setError(t('eInvoiceManagement.errors.updateStatus'));
    }
  };

  /** NIC IRP에 JSON 제출 → IRN / Signed QR (GST_IRP_MODE=live 시 GSP 연동) */
  const handleGenerateIrn = async (id: string) => {
    if (!editGuard.guard()) return;
    setIrnLoadingId(id);
    setError('');
    try {
      const response = await api.post(`/accounting/e-invoices/${id}/generate-irn`);
      if (response.data.success) {
        const normalized = normalizeEInvoice(response.data.data);
        setEinvoices((prev) => prev.map((e) => (e.id === id ? normalized : e)));
        setSelectedEInvoice((sel) => (sel?.id === id ? normalized : sel));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('eInvoiceManagement.errors.generateIrn');
      setError(msg);
    } finally {
      setIrnLoadingId(null);
    }
  };

  // E-Way Bill 생성
  const handleCreateEWayBill = async (eInvoiceId: string) => {
    if (!createGuard.guard()) return;
    try {
      const response = await api.post(`/accounting/e-invoices/${eInvoiceId}/create-eway-bill`);
      if (response.data.success) {
        setEinvoices(prev => prev.map(einvoice => 
          einvoice.id === eInvoiceId 
            ? { ...einvoice, ewayBillId: response.data.data.id }
            : einvoice
        ));
        setError('');
      }
    } catch {
      setError(t('eInvoiceManagement.errors.createEWayBill'));
    }
  };

  // E-Invoice 상세 보기
  const handleView = (einvoice: EInvoice) => {
    setSelectedEInvoice(einvoice);
    setOpenViewDialog(true);
  };

  // 상태 색상 반환
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'generated': return 'info';
      case 'uploaded': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  // 상태 라벨 반환
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return t('eInvoiceManagement.status.draft');
      case 'generated': return t('eInvoiceManagement.status.generated');
      case 'uploaded': return t('eInvoiceManagement.status.uploaded');
      case 'cancelled': return t('eInvoiceManagement.status.cancelled');
      default: return status;
    }
  };

  const getIrpStatusLabel = (s: EInvoice['irpStatus']) => {
    switch (s) {
      case 'draft': return t('eInvoiceManagement.irpStatus.draft');
      case 'submitted': return t('eInvoiceManagement.irpStatus.submitted');
      case 'irn_generated': return t('eInvoiceManagement.irpStatus.irn_generated');
      case 'failed': return t('eInvoiceManagement.irpStatus.failed');
      default: return s;
    }
  };

  const getIrpStatusColor = (s: EInvoice['irpStatus']) => {
    switch (s) {
      case 'irn_generated': return 'success';
      case 'failed': return 'error';
      case 'submitted': return 'warning';
      default: return 'default';
    }
  };

  // 거래 유형 색상 반환
  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'B2B': return 'primary';
      case 'B2C': return 'secondary';
      case 'Export': return 'success';
      case 'SEZ': return 'warning';
      default: return 'default';
    }
  };

  const filteredEInvoices = useMemo(() => {
    const uid = Number(user?.id);
    return einvoices.filter((einvoice) => {
      const matchesStatus = filterStatus === 'all' || einvoice.status === filterStatus;
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === '' ||
        String(einvoice.invoiceNumber || '')
          .toLowerCase()
          .includes(search) ||
        String(einvoice.buyer?.name || '')
          .toLowerCase()
          .includes(search) ||
        String(einvoice.buyer?.gstin || '')
          .toLowerCase()
          .includes(search) ||
        String(einvoice.seller?.name || '')
          .toLowerCase()
          .includes(search) ||
        String(einvoice.seller?.gstin || '')
          .toLowerCase()
          .includes(search) ||
        String(einvoice.irn || '')
          .toLowerCase()
          .includes(search) ||
        String(einvoice.transactionType || '')
          .toLowerCase()
          .includes(search);
      const base = matchesStatus && matchesSearch;
      if (!base) return false;
      if (listTab === 'pending') {
        return (
          einvoice.approvalStatus === 'pending_approval' &&
          Number(einvoice.approverUserId) === uid
        );
      }
      return Number(einvoice.createdByUserId) === uid;
    });
  }, [einvoices, filterStatus, searchTerm, listTab, user?.id]);

  const handleApproveInvoice = async (id: string) => {
    if (!editGuard.guard()) return;
    try {
      const res = await accountingService.approveInvoice(Number(id));
      if (res?.success) {
        setError('');
        const params: any = {};
        if ((user?.role === 'root' || user?.role === 'audit') && selectedCompanyId) {
          params.company_id = selectedCompanyId;
        }
        const r = await api.get('/accounting/e-invoices', { params });
        if (r.data.success) {
          setEinvoices((r.data.data || []).map((item: any) => normalizeEInvoice(item)));
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || t('eInvoiceManagement.errors.updateStatus'));
    }
  };

  const handleRejectInvoice = async (id: string) => {
    if (!editGuard.guard()) return;
    try {
      const res = await accountingService.rejectInvoice(Number(id));
      if (res?.success) {
        setError('');
        const params: any = {};
        if ((user?.role === 'root' || user?.role === 'audit') && selectedCompanyId) {
          params.company_id = selectedCompanyId;
        }
        const r = await api.get('/accounting/e-invoices', { params });
        if (r.data.success) {
          setEinvoices((r.data.data || []).map((item: any) => normalizeEInvoice(item)));
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || t('eInvoiceManagement.errors.updateStatus'));
    }
  };

  const listStateBoxSx = {
    ...mvsBodyListTableSx,
    borderRadius: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    py: { xs: 6, sm: 8 },
    px: 3,
    gap: 1.5,
    '& .MuiTableHead-root .MuiTableRow-root .MuiTableCell-head:first-of-type': {
      borderTopLeftRadius: 0 },
    '& .MuiTableHead-root .MuiTableRow-root .MuiTableCell-head:last-of-type': {
      borderTopRightRadius: 0 },
    '& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-body:first-of-type': {
      borderBottomLeftRadius: 0 },
    '& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-body:last-of-type': {
      borderBottomRightRadius: 0 } } as const;

  const eInvoiceListTableSx = {
    width: '100%',
    tableLayout: 'fixed' as const,
    borderCollapse: 'collapse',
    bgcolor: 'transparent',
    '& .MuiTableCell-root': {
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none' } } as const;

  const eInvoiceCellBaseSx = {
    fontSize: { xs: '0.75rem', sm: '0.8125rem' },
    py: { xs: 0.85, sm: 1 },
    px: { xs: 0.75, sm: 1.25 },
    verticalAlign: 'middle' as const,
    lineHeight: 1.45 } as const;

  const eInvoiceTableHeadCellSx = {
    ...eInvoiceCellBaseSx,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#475569',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap' as const } as const;

  const eInvoiceCellEllipsisSx = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 0 } as const;

  const renderEllipsisText = (text: string, fontWeight?: number, color?: string) => (
    <Tooltip title={text} placement="top-start" enterDelay={400}>
      <Box
        component="span"
        sx={{
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight,
          color,
          minWidth: 0 }}
      >
        {text}
      </Box>
    </Tooltip>
  );

  const eInvoiceListColumns = [
    { key: 'invoiceNumber', width: '12%', ellipsis: true },
    { key: 'irn', width: '10%', ellipsis: true },
    { key: 'irp', width: '7%', ellipsis: false },
    { key: 'buyer', width: '18%', ellipsis: true },
    { key: 'transactionType', width: '6%', ellipsis: false },
    { key: 'amount', width: '8%', ellipsis: true },
    { key: 'status', width: '12%', ellipsis: false },
    { key: 'issueDate', width: '8%', ellipsis: false },
    { key: 'ewayBill', width: '7%', ellipsis: false },
    { key: 'actions', width: '12%', ellipsis: false },
  ] as const;

  const listKpiStats = useMemo(
    () => ({
      total: einvoices.length,
      draft: einvoices.filter((e) => e.status === 'draft').length,
      irnReady: einvoices.filter((e) => e.irpStatus === 'irn_generated').length,
      pending: einvoices.filter((e) => e.approvalStatus === 'pending_approval').length }),
    [einvoices]
  );

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('eInvoiceManagement.title')}
        description={t('eInvoiceManagement.description')}
        mb={2}
        actions={
          isCreating ? (
            <Button variant="outlined" onClick={handleCancelCreate} sx={mvsBodyOutlinedBtnSx}>
              {t('common.back')}
            </Button>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {(user?.role === 'root' || user?.role === 'audit') && (
                <Autocomplete
                  size="small"
                  options={companyFilterOptions}
                  value={selectedCompanyOption}
                  onChange={(_, next) => {
                    if (!next || next.id === '') setSelectedCompanyId('');
                    else setSelectedCompanyId(Number(next.id));
                  }}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  disableClearable={Boolean(selectedCompanyOption)}
                  slotProps={companySelectListboxSlotProps}
                  sx={{
                    ...eInvoiceFilterFieldSx,
                    ...companySelectNowrapSx,
                    minWidth: { xs: 160, sm: 200 },
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('eInvoiceManagement.filters.company')}
                      placeholder={t('eInvoiceManagement.filters.searchCompany')}
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              )}
              <Tooltip title={createGuard.tooltipTitle} disableHoverListener={!createGuard.tooltipTitle}>
                <span style={{ display: 'inline-flex' }}>
                  <MenuPermissionButton
                    permissionAction="create"
                    menuRoutes={E_INVOICE_MENU_ROUTES}
                    variant="contained"
                    disableElevation
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={() => {
                      if (!createGuard.guard()) return;
                      setIsCreating(true);
                    }}
                    sx={mvsBodyPrimaryBtnSx}
                  >
                    {t('eInvoiceManagement.actions.newEInvoice')}
                  </MenuPermissionButton>
                </span>
              </Tooltip>
            </Box>
          )
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      {isCreating ? (
              <Card elevation={0} sx={mvsBodyCardSx}>
                <CardContent sx={{ px: { xs: 2, sm: 2.5 }, py: 2.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', mb: 3 }}>
                    {t('eInvoiceManagement.create.title')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControl fullWidth>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                        {t('eInvoiceManagement.create.selectProforma')}
                      </Typography>
                      <Select
                        value={formData.proformaInvoiceId}
                        onChange={(e) => setFormData(prev => ({ ...prev, proformaInvoiceId: e.target.value }))}
                        displayEmpty
                        renderValue={(value) => {
                          if (!value) return t('eInvoiceManagement.create.selectProforma');
                          const selected = proformaInvoices.find((item) => item.id === value);
                          const customerName = selected?.customer?.name || selected?.customer_name || t('eInvoiceManagement.defaults.unspecified');
                          return selected ? `${selected.invoiceNumber} - ${customerName}` : String(value);
                        }}
                      >
                        <MenuItem value="">{t('eInvoiceManagement.create.none')}</MenuItem>
                        {proformaInvoices.map((proformaInvoice) => (
                          <MenuItem key={proformaInvoice.id} value={proformaInvoice.id}>
                            {proformaInvoice.invoiceNumber} - {(proformaInvoice.customer?.name || proformaInvoice.customer_name || t('eInvoiceManagement.defaults.unspecified'))}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                        {t('eInvoiceManagement.create.selectCustomer')}
                      </Typography>
                      <Select
                        value={formData.customerId}
                        onChange={(e) => setFormData(prev => ({ ...prev, customerId: e.target.value }))}
                        displayEmpty
                        renderValue={(value) => {
                          if (!value) return t('eInvoiceManagement.create.selectCustomer');
                          const selected = customers.find((item) => String(item.id) === String(value));
                          return selected ? selected.name : String(value);
                        }}
                      >
                        <MenuItem value="">{t('eInvoiceManagement.create.none')}</MenuItem>
                        {customers.map((customer) => (
                          <MenuItem key={customer.id} value={String(customer.id)}>
                            {customer.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                        {t('eInvoiceManagement.create.invoiceNumberOptional')}
                      </Typography>
                      <TextField
                        fullWidth
                        placeholder={t('eInvoiceManagement.create.invoiceNumberPlaceholder')}
                        value={formData.invoiceNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      />
                    </Box>
                    
                    <FormControl fullWidth>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                        {t('eInvoiceManagement.create.transactionType')}
                      </Typography>
                      <Select
                        value={formData.transactionType}
                        onChange={(e) => setFormData(prev => ({ ...prev, transactionType: e.target.value as any }))}
                        displayEmpty
                      >
                        <MenuItem value="B2B">{t('eInvoiceManagement.transactionType.b2b')}</MenuItem>
                        <MenuItem value="B2C">{t('eInvoiceManagement.transactionType.b2c')}</MenuItem>
                        <MenuItem value="Export">{t('eInvoiceManagement.transactionType.export')}</MenuItem>
                        <MenuItem value="SEZ">{t('eInvoiceManagement.transactionType.sez')}</MenuItem>
                      </Select>
                    </FormControl>
                    
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                        {t('eInvoiceManagement.create.issueDate')}
                      </Typography>
                      <TextField
                        fullWidth
                        type="date"
                        value={formData.issueDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                      />
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                        {t('eInvoiceManagement.create.dueDate')}
                      </Typography>
                      <TextField
                        fullWidth
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                      />
                    </Box>

                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                        {t('eInvoiceManagement.create.subtotal')}
                      </Typography>
                      <TextField
                        fullWidth
                        type="number"
                        value={formData.subtotal}
                        onChange={(e) => setFormData(prev => ({ ...prev, subtotal: Number(e.target.value || 0) }))}
                      />
                    </Box>

                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                        {t('eInvoiceManagement.create.taxAmount')}
                      </Typography>
                      <TextField
                        fullWidth
                        type="number"
                        value={formData.taxAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, taxAmount: Number(e.target.value || 0) }))}
                      />
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                        {t('eInvoiceManagement.create.notes')}
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                        {t('eInvoiceManagement.create.terms')}
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        value={formData.terms}
                        onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                      />
                    </Box>

                    <FormControl fullWidth>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                        {t('eInvoiceManagement.approval.approver')} *
                      </Typography>
                      <Select<number | ''>
                        displayEmpty
                        value={formData.approverUserId === '' ? '' : formData.approverUserId}
                        onChange={(e: SelectChangeEvent<number | ''>) => {
                          const raw = e.target.value as string | number | '';
                          setFormData((prev) => ({
                            ...prev,
                            approverUserId: raw === '' ? '' : Number(raw)
                          }));
                        }}
                        renderValue={(selected: number | '' | undefined) => {
                          if (selected === '' || selected === undefined) {
                            return (
                              <Typography color="text.secondary">
                                {t('eInvoiceManagement.approval.selectApprover')}
                              </Typography>
                            );
                          }
                          const u = companyUsers.find((x) => x.id === selected);
                          return u ? `${u.username} (${u.email})` : String(selected);
                        }}
                      >
                        <MenuItem value="">
                          <Typography color="text.secondary">{t('eInvoiceManagement.approval.selectApprover')}</Typography>
                        </MenuItem>
                        {companyUsers.map((u) => (
                          <MenuItem key={u.id} value={u.id}>
                            {u.username} ({u.email})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                      <Button variant="outlined" onClick={handleCancelCreate} sx={mvsBodyOutlinedBtnSx}>
                        {t('common.cancel')}
                      </Button>
                      <MenuPermissionButton
                        permissionAction="create"
                        menuRoutes={E_INVOICE_MENU_ROUTES}
                        variant="contained"
                        disableElevation
                        onClick={handleCreate}
                        sx={mvsBodyPrimaryBtnSx}
                      >
                        {t('common.create')}
                      </MenuPermissionButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
      ) : (
        <>
          <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
            <Tabs
              value={listTab}
              onChange={(_, v: 'written' | 'pending') => setListTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={mvsMainTabsSx}
            >
              <Tab value="written" label={t('eInvoiceManagement.tabs.written')} />
              <Tab value="pending" label={t('eInvoiceManagement.tabs.pending')} />
            </Tabs>
          </Card>

          <Box sx={mvsKpiGridSx}>
            {[
              {
                label: t('eInvoiceManagement.analytics.totalEInvoices'),
                value: listKpiStats.total,
                color: 'text.primary',
              },
              {
                label: t('eInvoiceManagement.status.draft'),
                value: listKpiStats.draft,
                color: 'text.primary',
              },
              {
                label: t('eInvoiceManagement.columns.irn'),
                value: listKpiStats.irnReady,
                color: 'success.main',
              },
              {
                label: t('eInvoiceManagement.tabs.pending'),
                value: listKpiStats.pending,
                color: 'warning.main',
              },
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
                label={t('common.search')}
                placeholder={t('eInvoiceManagement.filters.searchPlaceholder')}
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
                sx={eInvoiceFilterFieldSx}
              />
              <TextField
                fullWidth
                size="small"
                select
                label={t('eInvoiceManagement.filters.status')}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                InputLabelProps={{ shrink: true }}
                SelectProps={{ displayEmpty: true }}
                sx={eInvoiceFilterFieldSx}
              >
                <MenuItem value="all">{t('eInvoiceManagement.filters.allStatus')}</MenuItem>
                <MenuItem value="draft">{t('eInvoiceManagement.status.draft')}</MenuItem>
                <MenuItem value="generated">{t('eInvoiceManagement.status.generated')}</MenuItem>
                <MenuItem value="uploaded">{t('eInvoiceManagement.status.uploaded')}</MenuItem>
                <MenuItem value="cancelled">{t('eInvoiceManagement.status.cancelled')}</MenuItem>
              </TextField>
              <Button
                variant="outlined"
                startIcon={<FilterIcon sx={{ fontSize: 18 }} />}
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                  setSelectedCompanyId('');
                }}
                sx={{
                  ...mvsBodyOutlinedBtnSx,
                  height: 40,
                  whiteSpace: 'nowrap',
                  alignSelf: { xs: 'stretch', sm: 'flex-end' },
                }}
              >
                {t('eInvoiceManagement.actions.reset')}
              </Button>
            </Box>
          </Card>

          <Box sx={mvsBodyListZoneSx}>
            {filteredEInvoices.length === 0 ? (
              <Box sx={listStateBoxSx}>
                <Typography variant="body2" color="text.secondary">
                  {einvoices.length === 0
                    ? t('eInvoiceManagement.empty.noInvoices')
                    : t('eInvoiceManagement.empty.noSearchResults')}
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={mvsBodyListTableSx}>
                <Table size="small" sx={eInvoiceListTableSx}>
                  <colgroup>
                    {eInvoiceListColumns.map((col) => (
                      <col key={col.key} style={{ width: col.width }} />
                    ))}
                  </colgroup>
                  <TableHead sx={mvsTableHeadHighlightSx}>
                    <TableRow>
                      <TableCell sx={eInvoiceTableHeadCellSx}>{t('eInvoiceManagement.columns.invoiceNumber')}</TableCell>
                      <TableCell sx={eInvoiceTableHeadCellSx}>{t('eInvoiceManagement.columns.irn')}</TableCell>
                      <TableCell sx={eInvoiceTableHeadCellSx}>{t('eInvoiceManagement.columns.irp')}</TableCell>
                      <TableCell sx={eInvoiceTableHeadCellSx}>{t('eInvoiceManagement.columns.buyer')}</TableCell>
                      <TableCell sx={eInvoiceTableHeadCellSx}>{t('eInvoiceManagement.columns.transactionType')}</TableCell>
                      <TableCell sx={eInvoiceTableHeadCellSx}>{t('eInvoiceManagement.columns.amount')}</TableCell>
                      <TableCell sx={eInvoiceTableHeadCellSx}>{t('eInvoiceManagement.columns.status')}</TableCell>
                      <TableCell sx={eInvoiceTableHeadCellSx}>{t('eInvoiceManagement.columns.issueDate')}</TableCell>
                      <TableCell sx={eInvoiceTableHeadCellSx}>E-Way Bill</TableCell>
                      <TableCell sx={eInvoiceTableHeadCellSx} align="center">{t('eInvoiceManagement.columns.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={mvsTableBodyRowSx}>
                    {filteredEInvoices.map((einvoice) => (
                    <TableRow key={einvoice.id}>
                      <TableCell sx={{ ...eInvoiceCellBaseSx, ...(eInvoiceListColumns[0].ellipsis ? eInvoiceCellEllipsisSx : {}) }}>
                        {renderEllipsisText(einvoice.invoiceNumber, 600)}
                      </TableCell>
                      <TableCell sx={{ ...eInvoiceCellBaseSx, ...eInvoiceCellEllipsisSx }}>
                        {einvoice.irn ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, overflow: 'hidden' }}>
                            <VerifiedIcon fontSize="small" color="success" sx={{ flexShrink: 0 }} />
                            {renderEllipsisText(einvoice.irn, undefined, 'primary.main')}
                          </Box>
                        ) : (
                          renderEllipsisText(t('eInvoiceManagement.irp.pendingIrn'))
                        )}
                      </TableCell>
                      <TableCell sx={eInvoiceCellBaseSx}>
                        <Chip
                          size="small"
                          label={getIrpStatusLabel(einvoice.irpStatus)}
                          color={getIrpStatusColor(einvoice.irpStatus) as any}
                          sx={eInvoiceChipSx}
                        />
                        {einvoice.irpLastError ? (
                          <Box sx={{ mt: 0.5, minWidth: 0, overflow: 'hidden' }}>
                            {renderEllipsisText(einvoice.irpLastError)}
                          </Box>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ ...eInvoiceCellBaseSx, ...eInvoiceCellEllipsisSx }}>
                        {renderEllipsisText(einvoice.buyer.name, 600)}
                      </TableCell>
                      <TableCell sx={eInvoiceCellBaseSx}>
                        <Chip
                          label={einvoice.transactionType}
                          size="small"
                          color={getTransactionTypeColor(einvoice.transactionType) as any}
                          sx={eInvoiceChipSx}
                        />
                      </TableCell>
                      <TableCell sx={{ ...eInvoiceCellBaseSx, ...eInvoiceCellEllipsisSx }}>
                        {renderEllipsisText(`Rs. ${einvoice.totalAmount.toLocaleString()}`, 600)}
                      </TableCell>
                      <TableCell sx={eInvoiceCellBaseSx}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                          <Chip
                            label={getStatusLabel(einvoice.status)}
                            size="small"
                            color={getStatusColor(einvoice.status) as any}
                            sx={eInvoiceChipSx}
                          />
                          {einvoice.approvalStatus === 'pending_approval' && (
                            <Chip size="small" label={t('eInvoiceManagement.approval.pendingChip')} color="warning" sx={eInvoiceChipSx} />
                          )}
                          {einvoice.approvalStatus === 'approved' && (
                            <Chip size="small" label={t('eInvoiceManagement.approval.approvedChip')} color="success" sx={eInvoiceChipSx} />
                          )}
                          {einvoice.approvalStatus === 'rejected' && (
                            <Chip size="small" label={t('eInvoiceManagement.approval.rejectedChip')} color="error" sx={eInvoiceChipSx} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={eInvoiceCellBaseSx}>
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                          {new Date(einvoice.issueDate).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell sx={eInvoiceCellBaseSx}>
                        {einvoice.ewayBillId ? (
                          <Chip
                            label={t('eInvoiceManagement.eway.generated')}
                            size="small"
                            color="success"
                            icon={<LocalShippingIcon sx={{ fontSize: '0.9rem !important' }} />}
                            sx={eInvoiceChipSx}
                          />
                        ) : einvoice.irpStatus === 'irn_generated' ? (
                          <MenuPermissionButton
                            permissionAction="create"
                            menuRoutes={E_INVOICE_MENU_ROUTES}
                            variant="outlined"
                            size="small"
                            startIcon={<LocalShippingIcon sx={{ fontSize: '0.95rem !important' }} />}
                            onClick={() => handleCreateEWayBill(einvoice.id)}
                            sx={{ ...mvsBodyOutlinedBtnSx, minHeight: 28, py: 0.25, px: 1, fontSize: '0.6875rem' }}
                          >
                            {t('common.create')}
                          </MenuPermissionButton>
                        ) : (
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {t('eInvoiceManagement.eway.pending')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={eInvoiceCellBaseSx} align="center">
                        <Box sx={eInvoiceActionBarSx}>
                          {einvoice.irpStatus !== 'irn_generated' && (
                            <Tooltip
                              title={
                                editGuard.tooltipTitle ||
                                (!isEInvoiceExportAllowed(einvoice)
                                  ? t('eInvoiceManagement.approval.needApprovalForIrn')
                                  : t('eInvoiceManagement.actions.generateIrn'))
                              }
                            >
                              <span>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="secondary"
                                  disabled={editGuard.mergeDisabled(
                                    irnLoadingId === einvoice.id ||
                                      einvoice.irpStatus === 'submitted' ||
                                      !isEInvoiceExportAllowed(einvoice)
                                  )}
                                  onClick={() => handleGenerateIrn(einvoice.id)}
                                  sx={{ minHeight: 28, py: 0.25, px: 1, fontSize: '0.6875rem', borderRadius: '8px' }}
                                >
                                  {irnLoadingId === einvoice.id ? '…' : 'IRN'}
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                          {listTab === 'pending' && einvoice.approvalStatus === 'pending_approval' && (
                            <>
                              <Tooltip title={editGuard.tooltipTitle || t('eInvoiceManagement.approval.approve')}>
                                <span>
                                  <IconButton
                                    size="small"
                                    color="success"
                                    disabled={editGuard.disabled}
                                    onClick={() => void handleApproveInvoice(einvoice.id)}
                                  >
                                    <ThumbUpIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title={editGuard.tooltipTitle || t('eInvoiceManagement.approval.reject')}>
                                <span>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    disabled={editGuard.disabled}
                                    onClick={() => void handleRejectInvoice(einvoice.id)}
                                  >
                                    <ThumbDownIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </>
                          )}
                          <Tooltip title={t('eInvoiceManagement.actions.view')}>
                            <IconButton size="small" onClick={() => handleView(einvoice)}>
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('eInvoiceManagement.actions.qrCode')}>
                            <IconButton size="small" disabled={!einvoice.qrCode}>
                              <QrCodeIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={editGuard.tooltipTitle || t('eInvoiceManagement.actions.upload')}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleStatusUpdate(einvoice.id, 'uploaded')}
                                disabled={editGuard.mergeDisabled(einvoice.irpStatus !== 'irn_generated')}
                              >
                                <SendIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={editGuard.tooltipTitle || t('common.cancel')}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleStatusUpdate(einvoice.id, 'cancelled')}
                                disabled={editGuard.mergeDisabled(einvoice.status === 'cancelled')}
                              >
                                <CancelIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </>
      )}

      {/* E-Invoice 상세 보기 다이얼로그 */}
      <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptLongIcon color="primary" />
            {t('eInvoiceManagement.detail.title')}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedEInvoice && (
            <Box>
              {/* 헤더 정보 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                  <Typography variant="h6">{selectedEInvoice.invoiceNumber}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    IRN: {selectedEInvoice.irn || '—'}
                  </Typography>
                  {selectedEInvoice.gstAckNo ? (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Ack No.: {selectedEInvoice.gstAckNo} · {selectedEInvoice.gstAckDate}
                    </Typography>
                  ) : null}
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Chip
                    label={getStatusLabel(selectedEInvoice.status)}
                    color={getStatusColor(selectedEInvoice.status) as any}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t('eInvoiceManagement.detail.issueDate')}: {new Date(selectedEInvoice.issueDate).toLocaleDateString(i18n.language.startsWith('en') ? 'en-US' : 'ko-KR')}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* 판매자 정보 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>{t('eInvoiceManagement.detail.sellerInfo')}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">{t('eInvoiceManagement.detail.companyName')}</Typography>
                    <Typography variant="body1">{selectedEInvoice.seller.name}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">GSTIN</Typography>
                    <Typography variant="body1">{selectedEInvoice.seller.gstin}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">{t('eInvoiceManagement.detail.address')}</Typography>
                    <Typography variant="body1">{selectedEInvoice.seller.address}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">{t('eInvoiceManagement.detail.contact')}</Typography>
                    <Typography variant="body1">{selectedEInvoice.seller.phone}</Typography>
                  </Box>
                </Box>
              </Box>

              {/* 구매자 정보 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>{t('eInvoiceManagement.detail.buyerInfo')}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">{t('eInvoiceManagement.detail.companyName')}</Typography>
                    <Typography variant="body1">{selectedEInvoice.buyer.name}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">GSTIN</Typography>
                    <Typography variant="body1">{selectedEInvoice.buyer.gstin}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">{t('eInvoiceManagement.detail.address')}</Typography>
                    <Typography variant="body1">{selectedEInvoice.buyer.address}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">{t('eInvoiceManagement.detail.contact')}</Typography>
                    <Typography variant="body1">{selectedEInvoice.buyer.phone}</Typography>
                  </Box>
                </Box>
              </Box>

              {/* 상품 목록 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>{t('eInvoiceManagement.detail.itemList')}</Typography>
                <TableContainer sx={{ ...mvsBodyListTableSx, borderRadius: '8px', overflow: 'hidden' }}>
                  <Table size="small" sx={{ borderCollapse: 'collapse', bgcolor: 'transparent' }}>
                    <TableHead sx={mvsTableHeadHighlightSx}>
                      <TableRow>
                        <TableCell>{t('eInvoiceManagement.detail.columns.description')}</TableCell>
                        <TableCell align="right">{t('eInvoiceManagement.detail.columns.hsnCode')}</TableCell>
                        <TableCell align="right">{t('eInvoiceManagement.detail.columns.quantity')}</TableCell>
                        <TableCell align="right">{t('eInvoiceManagement.detail.columns.unitPrice')}</TableCell>
                        <TableCell align="right">{t('eInvoiceManagement.detail.columns.subtotal')}</TableCell>
                        <TableCell align="right">CGST</TableCell>
                        <TableCell align="right">SGST</TableCell>
                        <TableCell align="right">IGST</TableCell>
                        <TableCell align="right">Cess</TableCell>
                        <TableCell align="right">{t('eInvoiceManagement.detail.columns.total')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody sx={mvsTableBodyRowSx}>
                      {selectedEInvoice.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell align="right">{item.hsnCode}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">Rs. {item.unitPrice.toLocaleString()}</TableCell>
                          <TableCell align="right">Rs. {item.total.toLocaleString()}</TableCell>
                          <TableCell align="right">Rs. {item.cgstAmount.toLocaleString()}</TableCell>
                          <TableCell align="right">Rs. {item.sgstAmount.toLocaleString()}</TableCell>
                          <TableCell align="right">Rs. {item.igstAmount.toLocaleString()}</TableCell>
                          <TableCell align="right">Rs. {item.cessAmount.toLocaleString()}</TableCell>
                          <TableCell align="right">Rs. {(item.total + item.cgstAmount + item.sgstAmount + item.igstAmount + item.cessAmount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* 요약 */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                <Box sx={{ minWidth: 400 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">{t('eInvoiceManagement.detail.summary.subtotal')}:</Typography>
                    <Typography variant="body2">Rs. {selectedEInvoice.subtotal.toLocaleString()}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">CGST:</Typography>
                    <Typography variant="body2">Rs. {selectedEInvoice.cgstTotal.toLocaleString()}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">SGST:</Typography>
                    <Typography variant="body2">Rs. {selectedEInvoice.sgstTotal.toLocaleString()}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">IGST:</Typography>
                    <Typography variant="body2">Rs. {selectedEInvoice.igstTotal.toLocaleString()}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Cess:</Typography>
                    <Typography variant="body2">Rs. {selectedEInvoice.cessTotal.toLocaleString()}</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6">{t('eInvoiceManagement.detail.summary.total')}:</Typography>
                    <Typography variant="h6">Rs. {selectedEInvoice.totalAmount.toLocaleString()}</Typography>
                  </Box>
                </Box>
              </Box>

              {/* QR 코드 */}
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography variant="h6" gutterBottom>{t('eInvoiceManagement.detail.qrTitle')}</Typography>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center',
                  p: 2,
                  border: '2px dashed #ccc',
                  borderRadius: 2,
                  bgcolor: '#f5f5f5'
                }}>
                  {selectedEInvoice.qrCode ? (
                    <Box sx={{ maxWidth: 360, mx: 'auto' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, wordBreak: 'break-all' }}>
                        SignedQRCode (Base64, NIC)
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                        {selectedEInvoice.qrCode.slice(0, 200)}
                        {selectedEInvoice.qrCode.length > 200 ? '…' : ''}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('eInvoiceManagement.irp.pendingIrn')}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* 메모 및 조건 */}
              {(selectedEInvoice.notes || selectedEInvoice.terms) && (
                <Box>
                  {selectedEInvoice.notes && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" gutterBottom>{t('eInvoiceManagement.create.notes')}</Typography>
                      <Typography variant="body2">{selectedEInvoice.notes}</Typography>
                    </Box>
                  )}
                  {selectedEInvoice.terms && (
                    <Box>
                      <Typography variant="h6" gutterBottom>{t('eInvoiceManagement.create.terms')}</Typography>
                      <Typography variant="body2">{selectedEInvoice.terms}</Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenViewDialog(false)} sx={mvsBodyOutlinedBtnSx}>{t('common.close')}</Button>
          <Tooltip
            title={
              selectedEInvoice && !isEInvoiceExportAllowed(selectedEInvoice)
                ? t('eInvoiceManagement.approval.needApprovalForPrint')
                : ''
            }
          >
            <span>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                disabled={!selectedEInvoice || !isEInvoiceExportAllowed(selectedEInvoice)}
                onClick={() => {
                  if (selectedEInvoice && isEInvoiceExportAllowed(selectedEInvoice)) window.print();
                }}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('common.print')}
              </Button>
            </span>
          </Tooltip>
          <Tooltip
            title={
              selectedEInvoice && !isEInvoiceExportAllowed(selectedEInvoice)
                ? t('eInvoiceManagement.approval.needApprovalForPrint')
                : ''
            }
          >
            <span>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                disabled={!selectedEInvoice || !isEInvoiceExportAllowed(selectedEInvoice)}
                onClick={() => {
                  if (selectedEInvoice && isEInvoiceExportAllowed(selectedEInvoice)) window.print();
                }}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('common.download')}
              </Button>
            </span>
          </Tooltip>
          <MenuPermissionButton
            permissionAction="edit"
            menuRoutes={E_INVOICE_MENU_ROUTES}
            variant="contained"
            disableElevation
            startIcon={<SendIcon />}
            onClick={() => {
              if (selectedEInvoice) void handleStatusUpdate(selectedEInvoice.id, 'uploaded');
            }}
            disabled={!selectedEInvoice || selectedEInvoice.irpStatus !== 'irn_generated'}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('eInvoiceManagement.actions.upload')}
          </MenuPermissionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EInvoiceManagement;