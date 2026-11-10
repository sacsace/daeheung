import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Paper,
  Chip,
  TextField,
  FormControl,
  FormHelperText,
  Select,
  MenuItem,
  IconButton,
  Autocomplete,
  Tooltip,
  Alert,
  Snackbar,
  Pagination,
  InputAdornment,
  Grid,
  Divider,
  Stack,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
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
  mvsBodyPaginationSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
} from '../../theme/daeheungLayout';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  TaskAlt as TaskAltIcon,
  Send as SendIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../../store';
import { api, accountingService, partnerService, companyService } from '../../services/api';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import {
  companySelectListboxSlotProps,
  companySelectNowrapSx,
  shortCompanyName,
} from '../../utils/companyDisplayName';
import AuthMedia from '../../components/Common/AuthMedia';
import {
  buildDocumentDownloadFilename,
  DOCUMENT_PDF_FONT_SIZE_PT,
  DOCUMENT_PDF_LINE_HEIGHT_PT,
  DOCUMENT_PDF_MARGINS_MM,
} from '../../utils/pdf';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import { useMenuActionGuard } from '../../hooks/useMenuActionGuard';

const REGULAR_INVOICE_MENU_ROUTES = ['/accounting/invoice'] as const;

interface InvoiceItem {
  id?: number;
  item_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_rate: number;
  tax_amount: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  tax_amount: number;
  sub_total: number;
  status: string;
  payment_status: string;
  currency: string;
  notes?: string;
  items: InvoiceItem[];
  approval_status?: string | null;
  approver_user_id?: number | null;
  created_by?: number | null;
}

/** 일반 세금계산서 메일 제목용 회사 약자 — 예: Minsub Ventures → MSV */
function buildInvoiceEmailCompanyAbbr(companyName: string): string {
  const n = (companyName || '').trim();
  const lower = n.toLowerCase();
  if (lower.includes('minsub') && lower.includes('venture')) return 'MSV';
  const cleaned = n.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!cleaned) return 'CMP';
  return cleaned.slice(0, 3).padEnd(3, 'X');
}

/** 메일 제목용 고객사명 — 제목만 짧게: Private Limited / Pvt. Ltd. 등 법인 접미사 제거 */
function stripLegalSuffixForInvoiceEmailSubject(raw: string): string {
  let s = raw.replace(/\r|\n|\[|\]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/\bprivate\s+limited\b/gi, ' ');
  s = s.replace(/\bpvt\.?\s*ltd\.?\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();
  return s || 'Customer';
}

function buildInvoiceLineSummaryForEmail(items: InvoiceItem[], maxLines = 2): string {
  if (!items?.length) return 'No line items.';
  const parts = items.slice(0, maxLines).map((it) => {
    const name = (it.item_name || it.description || 'Item').trim();
    return name.length > 100 ? `${name.slice(0, 97)}...` : name;
  });
  const more = items.length > maxLines ? ` (+${items.length - maxLines} more)` : '';
  return parts.join('; ') + more;
}

const regularInvoiceFilterFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx,
} as const;

function buildRegularInvoiceEmailEnglish(params: {
  abbr: string;
  customerName: string;
  invoiceNumber: string;
  issuerLegalName: string;
  totalAmount: number;
  currency: string;
  summary: string;
}): { subject: string; message: string } {
  const customerForSubject = stripLegalSuffixForInvoiceEmailSubject(
    params.customerName.replace(/\r|\n|\[|\]/g, ' ').replace(/\s+/g, ' ').trim() || 'Customer'
  );
  const subject = `[${params.abbr}] Tax Invoice attached (${customerForSubject.slice(0, 200)})`;
  const amt = Number(params.totalAmount) || 0;
  const cur = (params.currency || 'INR').trim() || 'INR';
  const totalStr = amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const message = `Hello,

Please find attached our tax invoice in PDF format for your records.

Invoice number: ${params.invoiceNumber}
Total amount: ${cur} ${totalStr}
Summary: ${params.summary}

Thank you for your business.

Kind regards,
${params.issuerLegalName || 'Accounts'}

---
This message was sent automatically from the MSV system.`;
  return { subject, message };
}

interface CompanyInfo {
  id: number;
  name: string;
  business_number?: string;
  gst_numbers?: string[];
  gstNumbers?: string[];
  pan_number?: string;
  ceo_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  company_logo?: string;
  company_seal?: string;
  ceo_signature?: string;
  account_holder_name?: string;
  bank_name?: string;
  bank_address?: string;
  account_number?: string;
  ifsc_code?: string;
}

const EXCEL_BASE_FONT_SIZE = `${DOCUMENT_PDF_FONT_SIZE_PT}pt`;
const EXCEL_BASE_LINE_HEIGHT = `${DOCUMENT_PDF_LINE_HEIGHT_PT}pt`;
const TAX_SUMMARY_LINE_HEIGHT = `${DOCUMENT_PDF_LINE_HEIGHT_PT}pt`;
const TAX_SUMMARY_CELL_PADDING = '5px 8px';

const taxSummaryTableSx = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  '& .MuiTableRow-root': {
    height: 'auto',
  },
  '& .MuiTableCell-root': {
    padding: `${TAX_SUMMARY_CELL_PADDING} !important`,
    fontSize: EXCEL_BASE_FONT_SIZE,
    lineHeight: `${TAX_SUMMARY_LINE_HEIGHT} !important`,
    borderBottom: 'none',
  },
} as const;

const RegularInvoice: React.FC = () => {
  const { user } = useStore();
  const { t, i18n } = useTranslation();
  const menuFlags = usePageMenuPermission(REGULAR_INVOICE_MENU_ROUTES);
  const createGuard = useMenuActionGuard('create', REGULAR_INVOICE_MENU_ROUTES);
  const editGuard = useMenuActionGuard('edit', REGULAR_INVOICE_MENU_ROUTES);
  const deleteGuard = useMenuActionGuard('delete', REGULAR_INVOICE_MENU_ROUTES);
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandledRef = useRef<string | null>(null);
  const isEnglish = i18n.language === 'en';
  const allowedGstRates = [0, 2.5, 6, 9, 20];
  const allowedIgstRates = [0, 5, 12, 18, 40];
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [listSubTab, setListSubTab] = useState<'requested' | 'pending'>('requested');
  const [companyUsers, setCompanyUsers] = useState<Array<{ id: number; username: string; email: string }>>([]);
  const [approverUserId, setApproverUserId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const isInvoicePageMode = isCreating || isEditing || isViewing;
  const tr = (ko: string, en: string) => ((isInvoicePageMode || isEnglish) ? en : ko);
  const [pendingPrintInvoiceId, setPendingPrintInvoiceId] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewCustomer, setViewCustomer] = useState<{ name: string; email: string; phone?: string; address?: string; gst?: string; pan?: string }>({
    name: '',
    email: '',
    phone: '',
    address: '',
    gst: '',
    pan: ''
  });
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [rootCompanies, setRootCompanies] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [issuerCompany, setIssuerCompany] = useState<CompanyInfo | null>(null);
  const canSelectCompany = false;
  const effectiveCompanyId = useMemo(() => {
    if (canSelectCompany && selectedCompanyId !== '') return Number(selectedCompanyId);
    return user?.company_id != null ? Number(user.company_id) : null;
  }, [canSelectCompany, selectedCompanyId, user?.company_id]);

  const companyFilterOptions = useMemo(() => {
    const list = rootCompanies
      .map((c) => ({ id: Number(c.id), name: shortCompanyName(c.name) }))
      .filter((c) => Number.isFinite(c.id) && c.id > 0 && c.name)
      .sort((a, b) => a.name.localeCompare(b.name));
    return [{ id: '' as number | '', name: tr('전체 회사', 'All Companies') }, ...list];
  }, [rootCompanies, isEnglish, isInvoicePageMode]);

  const selectedCompanyOption = useMemo(() => {
    if (selectedCompanyId === '') {
      return companyFilterOptions.find((o) => o.id === '') ?? null;
    }
    return companyFilterOptions.find((o) => o.id === Number(selectedCompanyId)) ?? null;
  }, [companyFilterOptions, selectedCompanyId]);
  const [recipientCompanyId, setRecipientCompanyId] = useState<number | ''>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('');
  const [issuerGst, setIssuerGst] = useState('');
  const [customerGstNumbers, setCustomerGstNumbers] = useState<string[]>([]);
  const invoicePrintRef = useRef<HTMLDivElement | null>(null);
  const createEmptyItem = (): InvoiceItem => ({
    item_name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0,
    tax_rate: 18,
    tax_amount: 0,
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 0
  });

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    customer_gst: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: 'INR',
    notes: '',
    taxMode: 'overall' as 'overall' | 'item',
    overallCgstRate: 9,
    overallSgstRate: 9,
    overallIgstRate: 0,
    items: [createEmptyItem()] as InvoiceItem[]
  });
  const [filters, setFilters] = useState({
    payment_status: '',
    search: ''
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: number | null;
    invoiceNumber?: string;
    approverUserId: number | '';
    memo: string;
  }>({
    open: false,
    id: null,
    invoiceNumber: '',
    approverUserId: '',
    memo: ''
  });
  const itemNameRefs = useRef<Array<HTMLInputElement | null>>([]);
  const descriptionRefs = useRef<Array<HTMLInputElement | null>>([]);
  const quantityRefs = useRef<Array<HTMLInputElement | null>>([]);
  const unitPriceRefs = useRef<Array<HTMLInputElement | null>>([]);
  const itemsSubtotal = formData.items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  const itemsTaxTotal = formData.items.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
  const itemsGrandTotal = itemsSubtotal + itemsTaxTotal;
  const generatedInvoiceNumber = useMemo(() => {
    if (invoiceNumber) return invoiceNumber;
    return nextInvoiceNumber || 'Auto-generated';
  }, [invoiceNumber, nextInvoiceNumber]);

  const resolveTaxRates = useCallback((item: InvoiceItem) => {
    if (formData.taxMode === 'overall') {
      const igstRate = formData.overallIgstRate || 0;
      return {
        igstRate,
        cgstRate: igstRate > 0 ? 0 : (formData.overallCgstRate || 0),
        sgstRate: igstRate > 0 ? 0 : (formData.overallSgstRate || 0)
      };
    }
    const igstRate = item.igstRate || 0;
    return {
      igstRate,
      cgstRate: igstRate > 0 ? 0 : (item.cgstRate || 0),
      sgstRate: igstRate > 0 ? 0 : (item.sgstRate || 0)
    };
  }, [formData.taxMode, formData.overallCgstRate, formData.overallSgstRate, formData.overallIgstRate]);

  const updateItemTaxAmount = useCallback((item: InvoiceItem) => {
    const { cgstRate, sgstRate, igstRate } = resolveTaxRates(item);
    const totalRate = cgstRate + sgstRate + igstRate;
    const taxAmount = item.total_price * (totalRate / 100);
    return { ...item, cgstRate, sgstRate, igstRate, tax_rate: totalRate, tax_amount: taxAmount };
  }, [resolveTaxRates]);

  const getDisplayGstRates = (item: InvoiceItem) => {
    let cgstRate = Number(item.cgstRate || 0);
    let sgstRate = Number(item.sgstRate || 0);
    let igstRate = Number(item.igstRate || 0);

    if (cgstRate === 0 && sgstRate === 0 && igstRate === 0) {
      let totalRate = Number(item.tax_rate || 0);
      if (!totalRate && Number(item.total_price || 0) > 0) {
        totalRate = (Number(item.tax_amount || 0) / Number(item.total_price || 0)) * 100;
      }
      if (totalRate > 0) {
        if (igstRate > 0) {
          cgstRate = 0;
          sgstRate = 0;
          igstRate = totalRate;
        } else {
          cgstRate = totalRate / 2;
          sgstRate = totalRate / 2;
          igstRate = 0;
        }
      }
    }

    return { cgstRate, sgstRate, igstRate };
  };

  const itemInputSx = { '& .MuiInputBase-root': { height: 34 } };

  const viewItemsSubtotal = useMemo(() => {
    const items = selectedInvoice?.items || [];
    return items.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  }, [selectedInvoice?.items]);

  const viewItemsTaxTotal = useMemo(() => {
    const items = selectedInvoice?.items || [];
    return items.reduce((sum, item) => sum + Number(item.tax_amount || 0), 0);
  }, [selectedInvoice?.items]);

  const viewItemsGrandTotal = viewItemsSubtotal + viewItemsTaxTotal;
  const formatFloorAmount = (value: number) => Math.floor(value).toLocaleString();

  const itemsPerPage = 8;
  const itemPages = useMemo(() => {
    const items = selectedInvoice?.items || [];
    if (items.length === 0) return [[]];
    const pages: InvoiceItem[][] = [];
    for (let i = 0; i < items.length; i += itemsPerPage) {
      pages.push(items.slice(i, i + itemsPerPage));
    }
    return pages;
  }, [selectedInvoice?.items]);

  const hasIgstInItems = useMemo(() => {
    const items = selectedInvoice?.items || [];
    return items.some((it) => Number(it.igstRate || 0) > 0);
  }, [selectedInvoice?.items]);

  const uniformGstRate = useMemo(() => {
    const items = selectedInvoice?.items || [];
    if (items.length === 0) return null;
    const rates = items.map((it) => {
      const cgst = Number(it.cgstRate || 0);
      const sgst = Number(it.sgstRate || 0);
      const igst = Number(it.igstRate || 0);
      let totalRate = cgst + sgst + igst;
      if (!totalRate) {
        const totalPrice = Number(it.total_price || 0);
        const taxAmount = Number(it.tax_amount || 0);
        totalRate = Number(it.tax_rate || 0) || (totalPrice > 0 ? (taxAmount / totalPrice) * 100 : 0);
      }
      return Number(totalRate.toFixed(4));
    });
    const isUniform = rates.every((rate) => rate === rates[0]);
    return isUniform ? rates[0] : null;
  }, [selectedInvoice?.items]);

  const computedTaxTotal = useMemo(() => {
    if (uniformGstRate !== null) {
      return (viewItemsSubtotal * uniformGstRate) / 100;
    }
    return viewItemsTaxTotal;
  }, [uniformGstRate, viewItemsSubtotal, viewItemsTaxTotal]);

  const computedGrandTotal = viewItemsSubtotal + computedTaxTotal;

  const displayGrandTotal = useMemo(() => {
    if (uniformGstRate !== null) return computedGrandTotal;
    if (viewItemsGrandTotal) return viewItemsGrandTotal;
    if (selectedInvoice?.total_amount !== undefined && selectedInvoice?.total_amount !== null) {
      return selectedInvoice.total_amount;
    }
    return itemsGrandTotal;
  }, [uniformGstRate, computedGrandTotal, selectedInvoice?.total_amount, viewItemsGrandTotal, itemsGrandTotal]);

  const hasGstInItems = useMemo(() => {
    const items = selectedInvoice?.items || [];
    if (items.length === 0) return false;
    const shouldHide = uniformGstRate !== null;
    if (shouldHide) return false;
    return items.some((it) => {
      const totalRate = Number(it.tax_rate || 0);
      const cgst = Number(it.cgstRate || 0);
      const sgst = Number(it.sgstRate || 0);
      const igst = Number(it.igstRate || 0);
      const taxAmount = Number(it.tax_amount || 0);
      return totalRate > 0 || cgst > 0 || sgst > 0 || igst > 0 || taxAmount > 0;
    });
  }, [selectedInvoice?.items, uniformGstRate]);

  const summaryAmountColumn = useMemo(
    () => (hasGstInItems ? (hasIgstInItems ? 9 : 8) : 6),
    [hasGstInItems, hasIgstInItems]
  );

  const summaryColumnSx = useMemo(() => {
    const columns = [
      { width: '6%' },
      { width: '50%' },
      { width: '10%' },
      { width: '6%' },
      { width: '10%' }
    ];
    if (hasGstInItems) {
      columns.push({ width: '6%' }, { width: '6%' });
      if (hasIgstInItems) {
        columns.push({ width: '6%' });
      }
    }
    columns.push({ width: '10%' });
    return columns;
  }, [hasGstInItems, hasIgstInItems]);

  const normalizeGstNumbers = useCallback((value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((v) => {
          if (typeof v === 'string') return v;
          return v?.gst_number || v?.gstin || v?.number || '';
        })
        .filter((v: string) => v && v.trim() !== '');
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((v: string) => v && v.trim() !== '');
        }
      } catch {
        // ignore parse error
      }
      return trimmed.includes(',') ? trimmed.split(',').map(v => v.trim()).filter(Boolean) : [trimmed];
    }
    return [];
  }, []);

  const issuerGstNumbers = useMemo(() => {
    const rawValue =
      issuerCompany?.gst_numbers ??
      issuerCompany?.gstNumbers ??
      (issuerCompany as any)?.gst_number ??
      issuerCompany?.business_number;

    return normalizeGstNumbers(rawValue);
  }, [issuerCompany, normalizeGstNumbers]);

  useEffect(() => {
    const loadIssuerCompany = async () => {
      if (!effectiveCompanyId) {
        setIssuerCompany(null);
        return;
      }
      try {
        const response = await companyService.getCompany(Number(effectiveCompanyId));
        if (response.success && response.data) {
          const data = response.data;
          let gstNumbers = normalizeGstNumbers(
            data.gst_numbers ?? data.gstNumbers ?? (data as any).gst_number
          );

          try {
            const gstResponse = await companyService.getCompanyGstNumbers(Number(effectiveCompanyId));
            if (gstResponse?.success) {
              const directGstNumbers = normalizeGstNumbers(gstResponse.data?.gst_numbers);
              if (directGstNumbers.length > 0) {
                gstNumbers = directGstNumbers;
              }
            }
          } catch (gstError) {
          }

          setIssuerCompany({
            id: data.id,
            name: data.name || data.company_name || '',
            business_number: data.business_number || data.businessNumber || '',
            gst_numbers: gstNumbers,
            gstNumbers,
            pan_number: data.pan_number || data.panNumber || '',
            ceo_name: data.ceo_name || data.ceoName || '',
            address: data.address || '',
            phone: data.phone || '',
            email: data.email || '',
            company_logo: data.company_logo || '',
            company_seal: data.company_seal || '',
            ceo_signature: data.ceo_signature || '',
            account_holder_name: data.account_holder_name || data.accountHolderName || '',
            bank_name: data.bank_name || data.bankName || '',
            bank_address: data.bank_address || data.bankAddress || '',
            account_number: data.account_number || data.accountNumber || '',
            ifsc_code: data.ifsc_code || data.ifscCode || ''
          });
        } else {
          setIssuerCompany(null);
        }
      } catch {
        setIssuerCompany(null);
      }
    };

    loadIssuerCompany();
  }, [normalizeGstNumbers, effectiveCompanyId]);

  useEffect(() => {
    if (issuerGstNumbers.length > 0) {
      setIssuerGst(issuerGstNumbers[0]);
    } else {
      setIssuerGst('');
    }
  }, [issuerGstNumbers]);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => updateItemTaxAmount(item))
    }));
  }, [formData.taxMode, formData.overallCgstRate, formData.overallSgstRate, formData.overallIgstRate, updateItemTaxAmount]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!effectiveCompanyId) {
        setCompanyUsers([]);
        return;
      }
      try {
        const users = await useReferenceDataStore.getState().fetchUsers({
          company_id: Number(effectiveCompanyId),
        });
        setCompanyUsers(
          users
            .filter((u: { status?: string }) => u.status === 'active')
            .map((u: { id: number; username?: string; userid?: string; email?: string }) => ({
              id: u.id,
              username: u.username || u.userid || '',
              email: u.email || '',
            }))
        );
      } catch {
      /* ignore */
    }
    };
    void loadUsers();
  }, [effectiveCompanyId]);

  const loadCompanies = useCallback(async () => {
    try {
      // ??? ?? ? ???? ??
      const partners = await useReferenceDataStore.getState().fetchPartners();
      const customersOnly = partners.filter((p: any) => {
          const type = (p.business_type || p.businessType || '').toLowerCase();
          return type === 'customer' || type === 'customer_partner';
        });
        const mapped: CompanyInfo[] = customersOnly.map((p: any) => ({
          id: p.id,
          name: p.company_name || '',
          email: p.email || '',
          phone: p.phone || '',
          address: p.address || '',
          business_number: p.business_number || '',
          gst_numbers: normalizeGstNumbers(p.gst_numbers ?? p.gstNumbers ?? p.business_number)
        }));
        setCompanies(mapped);
    } catch {
      /* ignore */
    }
  }, [normalizeGstNumbers]);

  const applyFilters = useCallback((list: Invoice[]) => {
    let filteredInvoices = list;

    const normalizedPaymentStatus =
      filters.payment_status && filters.payment_status.toLowerCase() === 'all'
        ? ''
        : filters.payment_status;

    if (normalizedPaymentStatus) {
      filteredInvoices = filteredInvoices.filter(inv => inv.payment_status === normalizedPaymentStatus);
    }

    if (filters.search) {
      filteredInvoices = filteredInvoices.filter(inv =>
        inv.invoice_number.toLowerCase().includes(filters.search.toLowerCase()) ||
        inv.customer_name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    return filteredInvoices;
  }, [filters.payment_status, filters.search]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; limit: number; company_id?: number } = { page: 1, limit: 1000 };
      if (canSelectCompany && selectedCompanyId !== '') {
        params.company_id = Number(selectedCompanyId);
      }
      const response = await accountingService.getInvoices(params);
      const rawList = response?.success ? (response.data || []) : [];
      const list: Invoice[] = (rawList as any[]).map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        customer_name: inv.customer?.name || '',
        customer_email: inv.customer?.email || '',
        total_amount: Number(inv.total_amount || 0),
        tax_amount: Number(inv.tax_amount || 0),
        sub_total: Number(inv.subtotal || 0),
        status: inv.status || 'draft',
        payment_status: inv.payment_status || 'pending',
        currency: 'INR',
        items: [],
        approval_status: inv.approval_status ?? null,
        approver_user_id: inv.approver_user_id != null ? Number(inv.approver_user_id) : null,
        created_by: inv.created_by != null ? Number(inv.created_by) : null,
        notes: inv.notes ?? ''
      }));
      setAllInvoices(list);
    } catch (error) {
      setSnackbar({
        open: true,
        message: tr('인보이스 목록을 불러오지 못했습니다.', 'Failed to load invoices.'),
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tr은 초기 로드 시점 기준
  }, [canSelectCompany, selectedCompanyId]);

  const filteredInvoices = useMemo(() => applyFilters(allInvoices), [allInvoices, applyFilters]);

  const displayInvoices = useMemo(() => {
    const uid = Number(user?.id);
    return filteredInvoices.filter((inv) => {
      if (listSubTab === 'pending') {
        return inv.approval_status === 'pending_approval' && Number(inv.approver_user_id) === uid;
      }
      if (inv.created_by == null || Number.isNaN(Number(inv.created_by))) {
        return true;
      }
      return Number(inv.created_by) === uid;
    });
  }, [filteredInvoices, listSubTab, user?.id]);

  const pagedInvoices = useMemo(() => {
    const perPage = 15;
    return displayInvoices.slice((page - 1) * perPage, page * perPage);
  }, [displayInvoices, page]);

  useEffect(() => {
    setTotalPages(Math.max(1, Math.ceil(displayInvoices.length / 15)));
  }, [displayInvoices.length]);

  useEffect(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead) return;
    void loadInvoices();
  }, [loadInvoices, menuFlags.menusLoading, menuFlags.canRead]);

  useEffect(() => {
    if (menuFlags.menusLoading || createGuard.allowed) return;
    if (isCreating) setIsCreating(false);
  }, [menuFlags.menusLoading, createGuard.allowed, isCreating]);

  useEffect(() => {
    setPage(1);
  }, [filters.payment_status, filters.search, listSubTab, selectedCompanyId]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (!canSelectCompany) return;
    const loadRootCompanies = async () => {
      try {
        const response = await api.get('/companies');
        if (response.data?.success) {
          const list = (response.data.data || []).map((c: any) => ({
            id: Number(c.id),
            name: String(c.name || c.company_name || ''),
          }));
          setRootCompanies(list.filter((c: { id: number; name: string }) => c.id > 0 && c.name));
        }
      } catch {
        /* ignore */
      }
    };
    void loadRootCompanies();
  }, [canSelectCompany]);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const isRegularInvoiceExportAllowed = (inv: Invoice | null) => {
    if (!inv) return false;
    const s = inv.approval_status;
    return s == null || s === '' || s === 'approved';
  };

  const handleCreateInvoice = () => {
    if (!createGuard.guard()) return;
    setSelectedInvoice(null);
    setIsEditing(false);
    setIsViewing(false);
    setInvoiceNumber('');
    setRecipientCompanyId('');
    setCustomerGstNumbers([]);
    setFormData({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      customer_address: '',
      customer_gst: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: 'INR',
      notes: '',
      taxMode: 'overall',
      overallCgstRate: 9,
      overallSgstRate: 9,
      overallIgstRate: 0,
      items: [createEmptyItem()]
    });
    setApproverUserId('');
    setIsCreating(true);
  };

  useEffect(() => {
    const loadNextNumber = async () => {
      if (!isCreating) return;
      try {
        const params =
          canSelectCompany && selectedCompanyId !== ''
            ? { company_id: Number(selectedCompanyId) }
            : undefined;
        const response = await accountingService.getNextInvoiceNumber(params);
        if (response?.success) {
          setNextInvoiceNumber(response.data?.invoice_number || '');
        }
      } catch {
      /* ignore */
    }
    };
    loadNextNumber();
  }, [isCreating, canSelectCompany, selectedCompanyId]);

  const addItemAndFocusName = () => {
    const nextIndex = formData.items.length;
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, createEmptyItem()]
    }));
    setTimeout(() => {
      itemNameRefs.current[nextIndex]?.focus();
    }, 0);
  };

  const generateInvoicePdf = async (_fontScale = 1) => {
    if (!invoicePrintRef.current) {
      throw new Error('Invoice area not found.');
    }
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const invoiceElement = invoicePrintRef.current;
    const pageElements = Array.from(
      invoiceElement.querySelectorAll('.invoice-page')
    ) as HTMLElement[];
    const target = (pageElements.length > 0 ? pageElements[0] : invoiceElement) as HTMLElement;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const marginLeft = DOCUMENT_PDF_MARGINS_MM.left;
    const marginTop = DOCUMENT_PDF_MARGINS_MM.top;
    const marginRight = DOCUMENT_PDF_MARGINS_MM.right;
    const marginBottom = DOCUMENT_PDF_MARGINS_MM.bottom;
    const contentWidth = pdfWidth - marginLeft - marginRight;
    const contentHeight = pdfHeight - marginTop - marginBottom;
    /** PNG 무손실 + scale 2 는 A4 한 장이 수~십 MB로 불어남 → 메일 5MB 한도 초과. JPEG·적정 해상도로 압축 */
    const canvas = await html2canvas(target, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      onclone: (clonedDoc: Document) => {
        // 실제 화면은 건드리지 않고, 복제 DOM에서만 출력용 스타일 적용
        const style = clonedDoc.createElement('style');
        style.textContent = `
          .invoice-page {
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
          }
          .invoice-page * {
            font-size: ${EXCEL_BASE_FONT_SIZE} !important;
            line-height: ${EXCEL_BASE_LINE_HEIGHT} !important;
          }
            .invoice-page .tax-summary-label {
              white-space: nowrap !important;
              word-break: keep-all !important;
            }
            .invoice-page .tax-summary-table td {
              padding-top: 4px !important;
              padding-bottom: 4px !important;
              line-height: ${TAX_SUMMARY_LINE_HEIGHT} !important;
            }
        `;
        clonedDoc.head.appendChild(style);
      }
    });
    const JPEG_QUALITY = 0.88;
    const imgData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const imgProps = pdf.getImageProperties(imgData);
    const widthRatio = contentWidth / imgProps.width;
    const heightRatio = contentHeight / imgProps.height;
    const ratio = Math.min(widthRatio, heightRatio);
    const renderWidth = imgProps.width * ratio;
    const renderHeight = imgProps.height * ratio;
    const offsetX = marginLeft;
    const offsetY = marginTop;
    // 단일 페이지 강제 렌더링 (JPEG로 PDF 용량 절감)
    pdf.addImage(imgData, 'JPEG', offsetX, offsetY, renderWidth, renderHeight);
    return pdf;
  };

  const handlePrintInvoice = async () => {
    if (!isRegularInvoiceExportAllowed(selectedInvoice)) {
      showSnackbar(
        tr('승인 완료 후에만 인쇄할 수 있습니다.', 'Printing is only available after approval.'),
        'error'
      );
      return;
    }
    try {
      const pdf = await generateInvoicePdf(1);
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            iframe.remove();
          }, 60_000);
        }
      };
      document.body.appendChild(iframe);
    } catch (error) {
      showSnackbar(tr('인쇄에 실패했습니다.', 'Failed to print.'), 'error');
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedInvoice) return;
    if (!isRegularInvoiceExportAllowed(selectedInvoice)) {
      showSnackbar(
        tr('승인 완료 후에만 PDF를 저장할 수 있습니다.', 'PDF download is only available after approval.'),
        'error'
      );
      return;
    }
    try {
      const pdf = await generateInvoicePdf();
      const company =
        selectedInvoice.customer_name ||
        viewCustomer?.name ||
        issuerCompany?.name ||
        'Customer';
      const detail =
        selectedInvoice.invoice_number ||
        buildInvoiceLineSummaryForEmail(selectedInvoice.items || [], 1) ||
        'Invoice';
      pdf.save(
        buildDocumentDownloadFilename({
          code: 'Invoice',
          companyName: company,
          detail,
          date: selectedInvoice.invoice_date,
        })
      );
    } catch (error) {
      showSnackbar(tr('PDF 다운로드에 실패했습니다.', 'Failed to download PDF.'), 'error');
    }
  };

  const handleSendEmail = async () => {
    if (!selectedInvoice) return;
    if (!isRegularInvoiceExportAllowed(selectedInvoice)) {
      showSnackbar(
        tr('승인 완료 후에만 이메일을 보낼 수 있습니다.', 'Email sending is only available after approval.'),
        'error'
      );
      return;
    }
    const toEmail = (selectedInvoice.customer_email || viewCustomer.email || '').trim();
    if (!toEmail) {
      showSnackbar(tr('고객 이메일이 없습니다.', 'Customer email is missing.'), 'error');
      return;
    }
    try {
      const abbr = buildInvoiceEmailCompanyAbbr(issuerCompany?.name || '');
      const customerName = (selectedInvoice.customer_name || viewCustomer.name || '').trim();
      const summary = buildInvoiceLineSummaryForEmail(selectedInvoice.items || []);
      const { subject: emailSubject, message: emailBody } = buildRegularInvoiceEmailEnglish({
        abbr,
        customerName,
        invoiceNumber: selectedInvoice.invoice_number,
        issuerLegalName: (issuerCompany?.name || '').trim(),
        totalAmount: selectedInvoice.total_amount,
        currency: selectedInvoice.currency || 'INR',
        summary
      });
      const company =
        (selectedInvoice.customer_name || viewCustomer.name || issuerCompany?.name || '').trim() ||
        'Customer';
      const detail =
        selectedInvoice.invoice_number ||
        buildInvoiceLineSummaryForEmail(selectedInvoice.items || [], 1) ||
        'Invoice';
      const attachmentFilename = buildDocumentDownloadFilename({
        code: 'Invoice',
        companyName: company,
        detail,
        date: selectedInvoice.invoice_date,
      });
      const res = await accountingService.sendInvoiceEmail(selectedInvoice.id, {
        to: toEmail,
        subject: emailSubject,
        message: emailBody,
        filename: attachmentFilename,
      });
      if (res?.success === false && res?.message) {
        showSnackbar(res.message, 'error');
        return;
      }
      showSnackbar(tr('이메일을 전송했습니다.', 'Email sent.'), 'success');
    } catch (error: unknown) {
      const err = error as {
        code?: string;
        message?: string;
        response?: { data?: { message?: string } };
      };
      const isTimeout =
        err.code === 'ECONNABORTED' ||
        (typeof err.message === 'string' && err.message.toLowerCase().includes('timeout'));
      const msg = isTimeout
        ? tr(
            '메일 전송이 시간 내에 완료되지 않았습니다. 네트워크·메일 서버를 확인한 뒤 다시 시도해주세요.',
            'The email request timed out. Check your network and mail server, then try again.'
          )
        : err.response?.data?.message ||
          tr('이메일 전송에 실패했습니다.', 'Failed to send email.');
      showSnackbar(msg, 'error');
    }
  };

  const handleEditInvoice = async (invoice: Invoice) => {
    if (invoice.payment_status === 'paid') {
      showSnackbar(tr('정산 완료된 인보이스는 수정할 수 없습니다.', 'Paid invoices cannot be edited.'), 'error');
      return;
    }
    try {
      setLoading(true);
      const detail = await accountingService.getInvoice(invoice.id);
      const inv = detail?.success ? detail.data : null;
      if (!inv) {
        showSnackbar(tr('인보이스를 불러오지 못했습니다.', 'Failed to load invoice.'), 'error');
        return;
      }

      const rawCustomerId = inv.customer?.id ?? inv.customer_id ?? (invoice as any)?.customer_id;
      const customerId = rawCustomerId ? Number(rawCustomerId) : 0;
      const customerFromInvoice = inv.customer || {};
      const customer = companies.find(c => c.id === customerId);
      const gstList = normalizeGstNumbers(
        customer?.gst_numbers ??
        customer?.gstNumbers ??
        customerFromInvoice.gst_numbers ??
        customerFromInvoice.gstNumbers ??
        customerFromInvoice.gst_number ??
        customerFromInvoice.business_number
      );
      if (customer) {
        setCustomerGstNumbers(gstList);
      } else {
        if (customerId && customerFromInvoice) {
          const mappedCustomer: CompanyInfo = {
            id: customerId,
            name: customerFromInvoice.name || invoice.customer_name || '',
            email: customerFromInvoice.email || invoice.customer_email || '',
            phone: customerFromInvoice.phone || '',
            address: customerFromInvoice.address || '',
            business_number: customerFromInvoice.business_number || '',
            gst_numbers: gstList
          };
          setCompanies(prev => {
            if (prev.some(c => c.id === mappedCustomer.id)) return prev;
            return [mappedCustomer, ...prev];
          });
          setCustomerGstNumbers(gstList);
        } else {
          setCustomerGstNumbers([]);
        }
      }
      const gst = gstList.find(g => g && g.trim() !== '') || '';

      const derivedItems = (inv.items || []).map((it: any) => {
        const totalPrice = Number(it.total_price || 0);
        const taxAmount = Number(it.tax_amount || 0);
        const totalRate = Number(it.tax_rate || 0) || (totalPrice > 0 ? (taxAmount / totalPrice) * 100 : 0);
        const cgstRate = totalRate > 0 ? totalRate / 2 : 0;
        const sgstRate = totalRate > 0 ? totalRate / 2 : 0;
        const igstRate = 0;

        return {
          id: it.id,
          item_name: it.item_name || '',
          description: it.description || '',
          quantity: Number(it.quantity || 1),
          unit_price: Number(it.unit_price || 0),
          total_price: Number(it.total_price || 0),
          tax_rate: Number(it.tax_rate || totalRate),
          tax_amount: Number(it.tax_amount || 0),
          cgstRate,
          sgstRate,
          igstRate
        };
      });

      const hasMixedRates = derivedItems.some((item: InvoiceItem) => {
        const first = derivedItems[0];
        return (
          item.cgstRate !== first.cgstRate ||
          item.sgstRate !== first.sgstRate ||
          item.igstRate !== first.igstRate
        );
      });

      const overallCgstRate = derivedItems[0]?.cgstRate || 0;
      const overallSgstRate = derivedItems[0]?.sgstRate || 0;
      const overallIgstRate = derivedItems[0]?.igstRate || 0;

      setSelectedInvoice({
        ...invoice,
        customer_name: inv.customer?.name || invoice.customer_name,
        customer_email: inv.customer?.email || invoice.customer_email,
        total_amount: Number(inv.total_amount || invoice.total_amount),
        tax_amount: Number(inv.tax_amount || invoice.tax_amount),
        sub_total: Number(inv.subtotal || invoice.sub_total),
        approval_status: inv.approval_status ?? invoice.approval_status ?? null,
        approver_user_id:
          inv.approver_user_id != null ? Number(inv.approver_user_id) : invoice.approver_user_id ?? null,
        created_by: inv.created_by != null ? Number(inv.created_by) : invoice.created_by ?? null,
        items: derivedItems
      });

      setIsCreating(false);
      setIsViewing(false);
      setInvoiceNumber(inv.invoice_number || invoice.invoice_number || '');
      setRecipientCompanyId(customerId || '');
      setFormData({
        customer_name: inv.customer?.name || '',
        customer_email: inv.customer?.email || '',
        customer_phone: inv.customer?.phone || '',
        customer_address: inv.customer?.address || '',
        customer_gst: gst,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        currency: 'INR',
        notes: inv.notes || '',
        taxMode: hasMixedRates ? 'item' : 'overall',
        overallCgstRate,
        overallSgstRate,
        overallIgstRate,
        items: derivedItems
      });

      setIsEditing(true);
    } catch (error) {
      showSnackbar(tr('인보이스 상세를 불러오지 못했습니다.', 'Failed to load invoice details.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInvoice = async () => {
    if (isEditing ? !editGuard.guard() : !createGuard.guard()) return;
    const emptyItemIndex = formData.items.findIndex((item) => !item.item_name || item.item_name.trim() === '');
    if (emptyItemIndex !== -1) {
      showSnackbar(tr('항목명은 필수입니다.', 'Item name is required.'), 'error');
      itemNameRefs.current[emptyItemIndex]?.focus();
      return;
    }
    if (!formData.customer_gst) {
      showSnackbar(tr('GSTIN이 없는 고객은 인보이스를 등록할 수 없습니다.', 'Customers without GSTIN cannot register invoices.'), 'error');
      return;
    }
    if (!isEditing && approverUserId === '') {
      showSnackbar(tr('승인자를 선택해주세요.', 'Please select an approver.'), 'error');
      return;
    }

    setLoading(true);
    try {
      const ensureRecipientPartner = async () => {
        if (recipientCompanyId) return recipientCompanyId;

        const companyName = (formData.customer_name || '').trim();
        if (!companyName) {
          showSnackbar(tr('고객 회사명을 입력해주세요.', 'Please enter a customer company name.'), 'error');
          return '';
        }
        const customerEmail = (formData.customer_email || '').trim();
        if (!customerEmail) {
          showSnackbar(tr('고객 이메일을 입력해주세요.', 'Please enter a customer email.'), 'error');
          return '';
        }

        const existing = companies.find(
          (c) => (c.name || '').trim().toLowerCase() === companyName.toLowerCase()
        );
        if (existing?.id) {
          setRecipientCompanyId(existing.id);
          return existing.id;
        }

        const partnerPayload = {
          companyName,
          businessNumber: (formData.customer_gst || '').trim(),
          email: customerEmail,
          phone: (formData.customer_phone || '').trim() || undefined,
          address: (formData.customer_address || '').trim() || undefined,
          businessType: 'customer_partner',
          status: 'active',
          gstNumbers: [(formData.customer_gst || '').trim()]
        };
        const createResponse = await partnerService.createPartner(partnerPayload);
        if (!createResponse?.success || !createResponse?.data) {
          showSnackbar(
            createResponse?.message || tr('파트너 업체 저장에 실패했습니다.', 'Failed to save partner company.'),
            'error'
          );
          return '';
        }

        const raw = createResponse.data;
        const mappedCompany: CompanyInfo = {
          id: Number(raw.id),
          name: String(raw.company_name || raw.companyName || companyName),
          email: String(raw.email || customerEmail),
          phone: String(raw.phone || formData.customer_phone || ''),
          address: String(raw.address || formData.customer_address || ''),
          business_number: String(raw.business_number || raw.businessNumber || formData.customer_gst || ''),
          gst_numbers: normalizeGstNumbers(raw.gstNumbers ?? raw.gst_numbers ?? formData.customer_gst)
        };
        setCompanies((prev) => [mappedCompany, ...prev]);
        setRecipientCompanyId(mappedCompany.id);
        setCustomerGstNumbers(mappedCompany.gst_numbers || []);
        return mappedCompany.id;
      };

      const resolvedRecipientCompanyId = await ensureRecipientPartner();
      if (!resolvedRecipientCompanyId) {
        return;
      }

      const payload = {
        // ?? ??? ???? customers ???? ???
        ...(isEditing && selectedInvoice ? { invoice_number: selectedInvoice.invoice_number } : {}),
        invoice_date: formData.invoice_date,
        due_date: formData.due_date,
        subtotal: itemsSubtotal,
        tax_amount: itemsTaxTotal,
        total_amount: itemsGrandTotal,
        status: selectedInvoice?.status || 'draft',
        payment_status: selectedInvoice?.payment_status || 'pending',
        notes: formData.notes,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        customer_address: formData.customer_address,
        customer_business_number: formData.customer_gst,
        items: formData.items.map((it) => ({
          item_name: it.item_name,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_price,
          tax_rate: it.tax_rate,
          tax_amount: it.tax_amount
        }))
      };

      if (isEditing && selectedInvoice) {
        await accountingService.updateInvoice(selectedInvoice.id, payload);
      } else {
        await accountingService.createInvoice({
          ...payload,
          approver_user_id: Number(approverUserId),
          ...(canSelectCompany && selectedCompanyId !== ''
            ? { company_id: Number(selectedCompanyId) }
            : {}),
        });
      }

      showSnackbar(tr('인보이스가 저장되었습니다.', 'Invoice saved.'), 'success');
      setIsCreating(false);
      setIsEditing(false);
      setIsViewing(false);
      setSelectedInvoice(null);
      await loadInvoices();
      setNextInvoiceNumber('');
    } catch (error: any) {
      showSnackbar(error?.response?.data?.message || 'Failed to save invoice.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsCreating(false);
    setIsEditing(false);
    setIsViewing(false);
    setSelectedInvoice(null);
    setApproverUserId('');
    setRecipientCompanyId('');
    setFormData({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      customer_address: '',
      customer_gst: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: 'INR',
      notes: '',
      taxMode: 'overall',
      overallCgstRate: 9,
      overallSgstRate: 9,
      overallIgstRate: 0,
      items: [createEmptyItem()]
    });
  };

  const handleBackToList = () => {
    if (isCreating || isEditing) {
      handleCancelEdit();
      return;
    }
    setIsViewing(false);
  };

  const handleDeleteInvoice = (id: number, invoiceNumber?: string, paymentStatus?: string) => {
    if (!deleteGuard.guard()) return;
    if (paymentStatus === 'paid') {
      showSnackbar(tr('정산 완료된 인보이스는 삭제 요청할 수 없습니다.', 'Paid invoices cannot be requested for deletion.'), 'error');
      return;
    }
    setDeleteDialog({
      open: true,
      id,
      invoiceNumber: invoiceNumber || '',
      approverUserId: '',
      memo: ''
    });
  };

  const settleInvoice = async (targetInvoice: Invoice) => {
    if (targetInvoice.payment_status === 'paid') {
      showSnackbar(tr('이미 정산 완료된 인보이스입니다.', 'This invoice is already settled.'), 'error');
      return;
    }
    if (!isRegularInvoiceExportAllowed(targetInvoice)) {
      showSnackbar(
        tr('승인 완료 후 정산할 수 있습니다.', 'Settlement is available after approval.'),
        'error'
      );
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await accountingService.updateInvoiceStatus(targetInvoice.id, {
        status: 'paid',
        payment_status: 'paid',
        payment_method: 'cash',
        payment_date: today
      });

      if (!response?.success) {
        showSnackbar(response?.message || tr('정산 완료 처리에 실패했습니다.', 'Failed to complete settlement.'), 'error');
        return;
      }

      setSelectedInvoice((prev) => (
        prev && prev.id === targetInvoice.id
          ? {
              ...prev,
              status: 'paid',
              payment_status: 'paid'
            }
          : prev
      ));
      setAllInvoices((prev) =>
        prev.map((invoice) =>
          invoice.id === targetInvoice.id
            ? { ...invoice, status: 'paid', payment_status: 'paid' }
            : invoice
        )
      );
      showSnackbar(tr('정산 완료 처리되었습니다.', 'Settlement completed.'), 'success');
    } catch (error: any) {
      showSnackbar(error?.response?.data?.message || tr('정산 완료 처리 중 오류가 발생했습니다.', 'An error occurred during settlement.'), 'error');
    }
  };

  const handleSettlementComplete = async () => {
    if (!selectedInvoice) return;
    await settleInvoice(selectedInvoice);
  };

  const handleConfirmDeleteInvoice = async () => {
    if (!deleteDialog.id) return;
    if (deleteDialog.approverUserId === '') {
      showSnackbar(tr('승인 대상을 선택해주세요.', 'Please select an approver.'), 'error');
      return;
    }

    const invoiceId = deleteDialog.id;
    const approverUserId = Number(deleteDialog.approverUserId);
    const memo = deleteDialog.memo.trim() || undefined;

    setDeleteDialog({
      open: false,
      id: null,
      invoiceNumber: '',
      approverUserId: '',
      memo: ''
    });

    try {
      setLoading(true);
      const response = await accountingService.deleteInvoice(invoiceId, {
        approver_user_id: approverUserId,
        memo
      });
      if (response?.success === false) {
        showSnackbar(
          response?.message || tr('삭제 승인 요청 등록에 실패했습니다.', 'Failed to submit delete approval request.'),
          'error'
        );
        return;
      }
      showSnackbar(tr('삭제 승인 요청이 등록되었습니다.', 'Delete approval request has been submitted.'), 'success');
      setIsViewing(false);
      setSelectedInvoice(null);
      await loadInvoices();
    } catch (error: any) {
      showSnackbar(error?.response?.data?.message || tr('삭제 승인 요청 등록에 실패했습니다.', 'Failed to submit delete approval request.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRegularInvoice = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setLoading(true);
      const res = await accountingService.approveInvoice(id);
      if (res?.success) {
        showSnackbar(tr('승인되었습니다.', 'Approved.'), 'success');
        await loadInvoices();
      }
    } catch (err: any) {
      showSnackbar(err?.response?.data?.message || tr('승인에 실패했습니다.', 'Approval failed.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRegularInvoice = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setLoading(true);
      const res = await accountingService.rejectInvoice(id);
      if (res?.success) {
        showSnackbar(tr('반려되었습니다.', 'Rejected.'), 'success');
        await loadInvoices();
      }
    } catch (err: any) {
      showSnackbar(err?.response?.data?.message || tr('반려에 실패했습니다.', 'Rejection failed.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    // 1) 리스트 데이터로 즉시 상세 화면 오픈 (항상 보기 가능)
    setViewCustomer({
      name: invoice.customer_name || '',
      email: invoice.customer_email || '',
      phone: '',
      address: '',
      gst: '',
      pan: ''
    });
    setSelectedInvoice({
      ...invoice,
      total_amount: Number(invoice.total_amount || 0),
      tax_amount: Number(invoice.tax_amount || 0),
      sub_total: Number(invoice.sub_total || 0),
      notes: invoice.notes ?? '',
      approval_status: invoice.approval_status ?? null,
      approver_user_id: invoice.approver_user_id ?? null,
      created_by: invoice.created_by ?? null,
      items: (invoice.items || []).map((it: any) => ({
        id: it.id,
        item_name: it.item_name || '',
        description: it.description || '',
        quantity: Number(it.quantity || 0),
        unit_price: Number(it.unit_price || 0),
        total_price: Number(it.total_price || 0),
        tax_rate: Number(it.tax_rate || 0),
        tax_amount: Number(it.tax_amount || 0)
      }))
    });
    setIsCreating(false);
    setIsEditing(false);
    setIsViewing(true);

    try {
      // 2) 상세 API 성공 시 더 정확한 데이터로 보강
      setLoading(true);
      const detail = await accountingService.getInvoice(invoice.id);
      const inv = detail?.success ? detail.data : null;
      if (!inv) {
        return;
      }
      const customerGstNumbers = normalizeGstNumbers(
        inv.customer?.gst_numbers ?? inv.customer?.gstNumbers ?? inv.customer?.gst_number ?? inv.customer?.business_number
      );
      setViewCustomer({
        name: inv.customer?.name || '',
        email: inv.customer?.email || '',
        phone: inv.customer?.phone || '',
        address: inv.customer?.address || '',
        gst: customerGstNumbers[0] || '',
        pan: ''
      });
      setSelectedInvoice({
        ...invoice,
        customer_name: inv.customer?.name || invoice.customer_name,
        customer_email: inv.customer?.email || invoice.customer_email,
        total_amount: Number(inv.total_amount || invoice.total_amount),
        tax_amount: Number(inv.tax_amount || invoice.tax_amount),
        sub_total: Number(inv.subtotal || invoice.sub_total),
        notes: inv.notes ?? invoice.notes ?? '',
        approval_status: inv.approval_status ?? invoice.approval_status ?? null,
        approver_user_id:
          inv.approver_user_id != null ? Number(inv.approver_user_id) : invoice.approver_user_id ?? null,
        created_by: inv.created_by != null ? Number(inv.created_by) : invoice.created_by ?? null,
        items: (inv.items || []).map((it: any) => ({
          id: it.id,
          item_name: it.item_name || '',
          description: it.description || '',
          quantity: Number(it.quantity || 0),
          unit_price: Number(it.unit_price || 0),
          total_price: Number(it.total_price || 0),
          tax_rate: Number(it.tax_rate || 0),
          tax_amount: Number(it.tax_amount || 0)
        }))
      });
    } catch {
      // 상세 보강 실패는 무시하고 이미 열린 화면(리스트 스냅샷) 유지
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const raw = searchParams.get('id');
    if (!raw) {
      deepLinkHandledRef.current = null;
      return;
    }
    if (deepLinkHandledRef.current === raw) return;
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return;
    deepLinkHandledRef.current = raw;

    let cancelled = false;
    void (async () => {
      try {
        const detail = await accountingService.getInvoice(id);
        if (cancelled || !detail?.success || !detail.data) return;
        const inv = detail.data;
        await handleViewInvoice({
          id: Number(inv.id),
          invoice_number: String(inv.invoice_number || ''),
          invoice_date: inv.invoice_date || new Date().toISOString().slice(0, 10),
          due_date: inv.due_date || new Date().toISOString().slice(0, 10),
          customer_name: inv.customer?.name || inv.customer_name || '',
          customer_email: inv.customer?.email || inv.customer_email || '',
          total_amount: Number(inv.total_amount || 0),
          tax_amount: Number(inv.tax_amount || 0),
          sub_total: Number(inv.subtotal ?? inv.sub_total ?? 0),
          status: inv.status || 'draft',
          payment_status: inv.payment_status || 'pending',
          currency: inv.currency || 'INR',
          notes: inv.notes ?? '',
          approval_status: inv.approval_status ?? null,
          approver_user_id: inv.approver_user_id != null ? Number(inv.approver_user_id) : null,
          created_by: inv.created_by != null ? Number(inv.created_by) : null,
          items: (inv.items || []).map((it: any) => ({
            id: it.id,
            item_name: it.item_name || '',
            description: it.description || '',
            quantity: Number(it.quantity || 0),
            unit_price: Number(it.unit_price || 0),
            total_price: Number(it.total_price || 0),
            tax_rate: Number(it.tax_rate || 0),
            tax_amount: Number(it.tax_amount || 0),
          })),
        });
      } catch {
        /* ignore deep-link failures */
      } finally {
        if (cancelled) return;
        const next = new URLSearchParams(searchParams);
        if (next.has('id')) {
          next.delete('id');
          setSearchParams(next, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per id query
  }, [searchParams]);

  useEffect(() => {
    if (!pendingPrintInvoiceId) return;
    if (!isViewing || !selectedInvoice) return;
    if (selectedInvoice.id !== pendingPrintInvoiceId) return;
    if (!isRegularInvoiceExportAllowed(selectedInvoice)) {
      showSnackbar(
        tr('승인 완료 후에만 인쇄할 수 있습니다.', 'Printing is only available after approval.'),
        'error'
      );
      setPendingPrintInvoiceId(null);
      return;
    }

    setTimeout(() => {
      void handlePrintInvoice();
    }, 0);
    setPendingPrintInvoiceId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 인쇄 1회 트리거: handlePrintInvoice/tr 안정화 불필요
  }, [isViewing, pendingPrintInvoiceId, selectedInvoice]);

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'paid': return 'success';
      case 'partial': return 'info';
      case 'overdue': return 'error';
      default: return 'default';
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'pending': return tr('대기', 'Pending');
      case 'paid': return tr('완료', 'Paid');
      case 'partial': return tr('부분', 'Partial');
      case 'overdue': return tr('연체', 'Overdue');
      default: return status;
    }
  };

  const renderApprovalCell = (inv: Invoice) => {
    const s = inv.approval_status;
    if (s == null || s === '') {
      return (
        <Typography variant="caption" color="text.secondary">
          —
        </Typography>
      );
    }
    if (s === 'pending_approval') {
      return <Chip size="small" label={tr('승인 대기', 'Pending')} color="warning" />;
    }
    if (s === 'approved') {
      return <Chip size="small" label={tr('승인됨', 'Approved')} color="success" />;
    }
    if (s === 'rejected') {
      return <Chip size="small" label={tr('반려', 'Rejected')} color="error" />;
    }
    return <Typography variant="caption">{s}</Typography>;
  };

  const listStateBoxSx = {
    ...mvsBodyListTableSx,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    py: { xs: 6, sm: 8 },
    px: 3,
    gap: 1.5,
  } as const;

  const invoiceListTableSx = {
    width: '100%',
    tableLayout: 'fixed' as const,
    minWidth: { xs: 880, sm: 960 },
    borderCollapse: 'collapse',
    bgcolor: 'transparent',
    '& .MuiTableCell-root': {
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none',
    },
  } as const;

  const invoiceCellBaseSx = {
    fontSize: { xs: '0.75rem', sm: '0.8125rem' },
    py: 0.75,
    px: { xs: 0.5, sm: 1 },
    verticalAlign: 'middle' as const,
  } as const;

  const invoiceCellEllipsisSx = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 0,
  } as const;

  const renderInvoiceEllipsisText = (text: string, fontWeight?: number) => (
    <Tooltip title={text} placement="top-start" enterDelay={400}>
      <Box
        component="span"
        sx={{
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight,
        }}
      >
        {text}
      </Box>
    </Tooltip>
  );

  const invoiceListColumns = [
    { key: 'invoiceNo', label: tr('인보이스 번호', 'Invoice No.'), width: '16%', align: 'left' as const, ellipsis: true },
    { key: 'customer', label: tr('고객', 'Customer'), width: '20%', align: 'left' as const, ellipsis: true },
    { key: 'issueDate', label: tr('발행일', 'Issue Date'), width: '10%', align: 'left' as const, ellipsis: false },
    { key: 'dueDate', label: tr('만기일', 'Due Date'), width: '10%', align: 'left' as const, ellipsis: false },
    { key: 'amount', label: tr('금액', 'Amount'), width: '12%', align: 'left' as const, ellipsis: true },
    { key: 'approval', label: tr('승인', 'Approval'), width: '11%', align: 'left' as const, ellipsis: false },
    { key: 'payment', label: tr('결제 상태', 'Payment Status'), width: '11%', align: 'left' as const, ellipsis: false },
    { key: 'actions', label: tr('작업', 'Actions'), width: '10%', align: 'center' as const, ellipsis: false },
  ] as const;

  const listKpiStats = useMemo(
    () => ({
      total: allInvoices.length,
      pendingPayment: allInvoices.filter((inv) => inv.payment_status === 'pending').length,
      paid: allInvoices.filter((inv) => inv.payment_status === 'paid').length,
      pendingApproval: allInvoices.filter((inv) => inv.approval_status === 'pending_approval').length,
    }),
    [allInvoices]
  );

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      {isInvoicePageMode && (
        <Box sx={{ mb: 1.25 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowBackIcon fontSize="small" />}
            onClick={handleBackToList}
            sx={mvsBodyOutlinedBtnSx}
          >
            {tr('목록으로', 'Back to list')}
          </Button>
        </Box>
      )}
      <DaeheungPageHeader
        title={tr('일반 세금계산서', 'Regular Tax Invoice')}
        description={tr('일반 세금계산서를 생성하고 관리합니다.', 'Create and manage regular invoices.')}
        mb={2}
        actions={
          !isInvoicePageMode ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {canSelectCompany && (
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
                    ...regularInvoiceFilterFieldSx,
                    ...companySelectNowrapSx,
                    minWidth: { xs: 160, sm: 200 },
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={tr('회사', 'Company')}
                      placeholder={tr('회사 검색', 'Search company')}
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              )}
              <Tooltip title={createGuard.tooltipTitle} disableHoverListener={!createGuard.tooltipTitle}>
                <span style={{ display: 'inline-flex' }}>
                  <Button
                    variant="contained"
                    disableElevation
                    startIcon={<AddIcon fontSize="small" />}
                    disabled={loading || createGuard.disabled}
                    onClick={handleCreateInvoice}
                    sx={mvsBodyPrimaryBtnSx}
                  >
                    {tr('새 인보이스', 'New Invoice')}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          ) : undefined
        }
      />

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      {!isInvoicePageMode && (
        <>
          <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
            <Tabs
              value={listSubTab}
              onChange={(_, v) => {
                setListSubTab(v);
                setPage(1);
              }}
              sx={mvsMainTabsSx}
            >
              <Tab value="requested" label={tr('내가 요청한 인보이스', 'Invoices I requested')} />
              <Tab value="pending" label={tr('승인 대기 인보이스', 'Pending my approval')} />
            </Tabs>
          </Card>

          <Box sx={mvsKpiGridSx}>
            {[
              {
                label: tr('총 인보이스', 'Total Invoices'),
                value: listKpiStats.total,
                color: 'text.primary',
              },
              {
                label: tr('결제 대기', 'Payment Pending'),
                value: listKpiStats.pendingPayment,
                color: 'warning.main',
              },
              {
                label: tr('결제 완료', 'Paid'),
                value: listKpiStats.paid,
                color: 'success.main',
              },
              {
                label: tr('승인 대기', 'Pending Approval'),
                value: listKpiStats.pendingApproval,
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
                label={tr('검색', 'Search')}
                placeholder={tr('인보이스 번호 또는 고객명 검색', 'Search by invoice number or customer')}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={regularInvoiceFilterFieldSx}
              />
              <TextField
                fullWidth
                size="small"
                select
                label={tr('결제 상태', 'Payment Status')}
                value={filters.payment_status}
                onChange={(e) => {
                  const value = String(e.target.value);
                  setFilters({ ...filters, payment_status: value.toLowerCase() === 'all' ? '' : value });
                }}
                InputLabelProps={{ shrink: true }}
                SelectProps={{ displayEmpty: true }}
                sx={regularInvoiceFilterFieldSx}
              >
                <MenuItem value="">{tr('전체', 'All')}</MenuItem>
                <MenuItem value="pending">{tr('대기', 'Pending')}</MenuItem>
                <MenuItem value="paid">{tr('완료', 'Paid')}</MenuItem>
                <MenuItem value="partial">{tr('부분', 'Partial')}</MenuItem>
                <MenuItem value="overdue">{tr('연체', 'Overdue')}</MenuItem>
              </TextField>
              <Button
                variant="outlined"
                startIcon={<FilterIcon sx={{ fontSize: 18 }} />}
                disabled={loading}
                onClick={() => {
                  setFilters({ payment_status: '', search: '' });
                  if (canSelectCompany) setSelectedCompanyId('');
                }}
                sx={{
                  ...mvsBodyOutlinedBtnSx,
                  height: 40,
                  whiteSpace: 'nowrap',
                  alignSelf: { xs: 'stretch', sm: 'flex-end' },
                }}
              >
                {tr('초기화', 'Reset')}
              </Button>
            </Box>
          </Card>
        </>
      )}

      {/* ???? ??/?? ? */}
      {isViewing && selectedInvoice ? (
        <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Box
              ref={invoicePrintRef}
              sx={{
                '& .invoice-page .MuiTypography-root, & .invoice-page .MuiTableCell-root': {
                  fontSize: EXCEL_BASE_FONT_SIZE,
                  lineHeight: EXCEL_BASE_LINE_HEIGHT,
                },
                '& .invoice-page .tax-summary-table .MuiTableCell-root': {
                  padding: `${TAX_SUMMARY_CELL_PADDING} !important`,
                  lineHeight: `${TAX_SUMMARY_LINE_HEIGHT} !important`,
                },
                '& .invoice-page .tax-summary-table .MuiTableRow-root': {
                  height: 'auto',
                },
              }}
            >
            {itemPages.map((pageItems, pageIndex) => {
              const isFirst = pageIndex === 0;
              const isLast = pageIndex === itemPages.length - 1;
              return (
                <Box
                  key={`invoice-page-${pageIndex}`}
                  className="invoice-page"
                  sx={{
                    ...(pageIndex > 0 ? { mt: 2 } : {}),
                    breakAfter: isLast ? 'auto' : 'page',
                    pageBreakAfter: isLast ? 'auto' : 'always'
                  }}
                >
                  {isFirst && (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                        <Box>
                          <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                            TAX INVOICE
                          </Typography>
                          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                            {issuerCompany?.name || ''}
                          </Typography>
                          {issuerCompany?.company_logo && (
                            <Box sx={{ mt: 1, mb: 0.8, display: 'flex', justifyContent: 'flex-start' }}>
                              <AuthMedia
                                src={issuerCompany.company_logo}
                                alt="Company logo"
                                sx={{ maxHeight: 60, maxWidth: 220, objectFit: 'contain' }}
                              />
                            </Box>
                          )}
                        </Box>
                        <Box sx={{ minWidth: 220 }}>
                          <Table size="small">
                            <TableBody>
                              {[
                                { label: tr('인보이스 번호', 'Invoice No'), value: selectedInvoice.invoice_number },
                                { label: tr('인보이스 발행일', 'Invoice Date'), value: new Date(selectedInvoice.invoice_date).toLocaleDateString() }
                              ].map((row) => (
                                <TableRow key={row.label}>
                                  <TableCell sx={{ borderBottom: 'none', px: 0, py: 0.5 }}>{row.label}</TableCell>
                                  <TableCell sx={{ borderBottom: 'none', px: 0, py: 0.5, textAlign: 'right' }}>{row.value}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      </Box>

                      <Grid container spacing={1.5} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Card variant="outlined" sx={{ height: '100%', borderColor: 'grey.400' }}>
                            <CardContent sx={{ p: 2 }}>
                              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                {tr('공급자', 'Supplier')}
                              </Typography>
                              {issuerCompany ? (
                                <Stack spacing={0.4}>
                                  <Typography variant="body2" fontWeight={600}>{issuerCompany.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">{tr('사업자번호', 'Business No.')}: {issuerCompany.business_number || '-'}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    GSTIN: {issuerGst || '-'}, PAN: {issuerCompany.pan_number || '-'}
                                  </Typography>
                                  {issuerCompany.address && (
                                    <Typography variant="caption" color="text.secondary">{tr('주소', 'Address')}: {issuerCompany.address}</Typography>
                                  )}
                                  {issuerCompany.phone && (
                                    <Typography variant="caption" color="text.secondary">{tr('연락처', 'Phone')}: {issuerCompany.phone}</Typography>
                                  )}
                                </Stack>
                              ) : (
                                <Typography variant="body2" color="text.secondary">{tr('공급자 회사 정보가 없습니다.', 'No issuer company information')}</Typography>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Card variant="outlined" sx={{ height: '100%', borderColor: 'grey.400' }}>
                            <CardContent sx={{ p: 2 }}>
                              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                {tr('청구 대상', 'Bill To')}
                              </Typography>
                              <Stack spacing={0.4}>
                                <Typography variant="body2" fontWeight={600}>{viewCustomer.name || selectedInvoice.customer_name}</Typography>
                                <Typography variant="caption" color="text.secondary">GSTIN: {viewCustomer.gst || '-'}</Typography>
                                <Typography variant="caption" color="text.secondary">{tr('연락처', 'Phone')}: {viewCustomer.phone || '-'}</Typography>
                                <Typography variant="caption" color="text.secondary">{tr('주소', 'Address')}: {viewCustomer.address || '-'}</Typography>
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <Card variant="outlined" sx={{ borderColor: 'grey.400' }}>
                            <CardContent sx={{ p: 2 }}>
                              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                {tr('배송 대상', 'Shipping To')}
                              </Typography>
                              <Stack spacing={0.4}>
                                <Typography variant="body2" fontWeight={600}>{viewCustomer.name || selectedInvoice.customer_name}</Typography>
                                <Typography variant="caption" color="text.secondary">GSTIN: {viewCustomer.gst || '-'}</Typography>
                                <Typography variant="caption" color="text.secondary">{tr('연락처', 'Phone')}: {viewCustomer.phone || '-'}</Typography>
                                <Typography variant="caption" color="text.secondary">{tr('주소', 'Address')}: {viewCustomer.address || '-'}</Typography>
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    </>
                  )}

                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, borderColor: 'grey.300' }}>
                    <Table
                      size="small"
                      sx={{
                        '& .MuiTableCell-root': {
                          fontSize: EXCEL_BASE_FONT_SIZE,
                          lineHeight: EXCEL_BASE_LINE_HEIGHT,
                        },
                      }}
                    >
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
                          <TableCell align="center" sx={{ width: '6%' }}>No</TableCell>
                          <TableCell align="left" sx={{ width: '50%' }}>Item</TableCell>
                          <TableCell align="center" sx={{ width: '10%' }}>HSN/SAC</TableCell>
                          <TableCell align="center" sx={{ width: '6%' }}>Qty</TableCell>
                          <TableCell align="center" sx={{ width: '10%' }}>Unit Price</TableCell>
                          {hasGstInItems ? (
                            <>
                              <TableCell align="center" sx={{ width: '6%' }}>CGST (%)</TableCell>
                              <TableCell align="center" sx={{ width: '6%' }}>SGST (%)</TableCell>
                              {hasIgstInItems && (
                                <TableCell align="center" sx={{ width: '6%' }}>IGST (%)</TableCell>
                              )}
                            </>
                          ) : null}
                          <TableCell align="center" sx={{ width: '10%' }}>Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pageItems.map((item, idx) => {
                          const itemNumber = pageIndex * itemsPerPage + idx + 1;
                          const { cgstRate, sgstRate, igstRate } = getDisplayGstRates(item);
                          const baseAmount = Number(item.total_price || 0);
                          const lineAmount = uniformGstRate !== null ? baseAmount : baseAmount + Number(item.tax_amount || 0);
                          return (
                            <TableRow key={item.id ?? itemNumber} sx={{ '& td': { py: 0.85 } }}>
                              <TableCell align="center" sx={{ width: '6%' }}>{itemNumber}</TableCell>
                              <TableCell align="left" sx={{ width: '50%' }}>{item.item_name}</TableCell>
                              <TableCell align="center" sx={{ width: '10%' }}>{item.description}</TableCell>
                              <TableCell align="center" sx={{ width: '6%' }}>{item.quantity}</TableCell>
                              <TableCell align="center" sx={{ width: '10%' }}>{(item.unit_price || 0).toLocaleString()}</TableCell>
                              {hasGstInItems ? (
                                <>
                                  <TableCell align="center" sx={{ width: '6%' }}>{cgstRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                  <TableCell align="center" sx={{ width: '6%' }}>{sgstRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                  {hasIgstInItems && (
                                    <TableCell align="center" sx={{ width: '6%' }}>{igstRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                  )}
                                </>
                              ) : null}
                              <TableCell align="center" sx={{ width: '10%' }}>{lineAmount.toLocaleString()}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {isLast && (
                    <>
                      <Card variant="outlined" sx={{ borderColor: 'grey.400' }}>
                        <CardContent sx={{ py: 0.625, px: 1.25, '&:last-child': { pb: 0.625 } }}>
                          <Table size="small" className="tax-summary-table" sx={taxSummaryTableSx}>
                            <TableBody>
                              <TableRow sx={{ bgcolor: 'grey.100' }}>
                                {summaryColumnSx.map((col, idx) => {
                                  const labelIndex = summaryAmountColumn - 2;
                                  const amountIndex = summaryAmountColumn - 1;
                                  if (idx === labelIndex) {
                                    return (
                                      <TableCell key={idx} sx={{ ...col, borderBottom: 'none', textAlign: 'right', fontWeight: 700 }}>
                                        {uniformGstRate !== null ? 'Sum' : 'Subtotal'}
                                      </TableCell>
                                    );
                                  }
                                  if (idx === amountIndex) {
                                    return (
                                      <TableCell key={idx} sx={{ ...col, borderBottom: 'none', textAlign: 'right', fontWeight: 700 }}>
                                        {formatFloorAmount(selectedInvoice.sub_total ?? viewItemsSubtotal ?? itemsSubtotal)} {selectedInvoice.currency}
                                      </TableCell>
                                    );
                                  }
                                  return <TableCell key={idx} sx={{ ...col, borderBottom: 'none' }} />;
                                })}
                              </TableRow>
                              {uniformGstRate !== null ? (
                                <>
                                  {[tr('C GST', 'C GST'), tr('S GST', 'S GST')].map((label) => (
                                    <TableRow key={label}>
                                      {summaryColumnSx.map((col, idx) => {
                                        const labelIndex = summaryAmountColumn - 2;
                                        const amountIndex = summaryAmountColumn - 1;
                                        if (idx === labelIndex) {
                                          return (
                                            <TableCell key={idx} className="tax-summary-label" sx={{ ...col, borderBottom: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                              {label} ({(uniformGstRate / 2).toLocaleString(undefined, { maximumFractionDigits: 2 })}%)
                                            </TableCell>
                                          );
                                        }
                                        if (idx === amountIndex) {
                                          return (
                                            <TableCell key={idx} sx={{ ...col, borderBottom: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                              {formatFloorAmount(computedTaxTotal / 2)} {selectedInvoice.currency}
                                            </TableCell>
                                          );
                                        }
                                        return <TableCell key={idx} sx={{ ...col, borderBottom: 'none' }} />;
                                      })}
                                    </TableRow>
                                  ))}
                                </>
                              ) : (
                                (selectedInvoice.tax_amount ?? viewItemsTaxTotal ?? itemsTaxTotal) > 0 && (
                                  <TableRow>
                                    {summaryColumnSx.map((col, idx) => {
                                      const labelIndex = summaryAmountColumn - 2;
                                      const amountIndex = summaryAmountColumn - 1;
                                      if (idx === labelIndex) {
                                        return (
                                          <TableCell key={idx} className="tax-summary-label" sx={{ ...col, borderBottom: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            GST Total Amount
                                          </TableCell>
                                        );
                                      }
                                      if (idx === amountIndex) {
                                        return (
                                          <TableCell key={idx} sx={{ ...col, borderBottom: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {formatFloorAmount(computedTaxTotal)} {selectedInvoice.currency}
                                          </TableCell>
                                        );
                                      }
                                      return <TableCell key={idx} sx={{ ...col, borderBottom: 'none' }} />;
                                    })}
                                  </TableRow>
                                )
                              )}
                              <TableRow sx={{ bgcolor: 'grey.100' }}>
                                {summaryColumnSx.map((col, idx) => {
                                  const labelIndex = summaryAmountColumn - 2;
                                  const amountIndex = summaryAmountColumn - 1;
                                  if (idx === labelIndex) {
                                    return (
                                      <TableCell key={idx} sx={{ ...col, borderBottom: 'none', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {uniformGstRate !== null ? tr('총합계 금액', 'Grand Total Amount') : tr('합계', 'Total')}
                                      </TableCell>
                                    );
                                  }
                                  if (idx === amountIndex) {
                                    return (
                                      <TableCell key={idx} sx={{ ...col, borderBottom: 'none', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {formatFloorAmount(displayGrandTotal)} {selectedInvoice.currency}
                                      </TableCell>
                                    );
                                  }
                                  return <TableCell key={idx} sx={{ ...col, borderBottom: 'none' }} />;
                                })}
                              </TableRow>
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>

                      {(issuerCompany?.bank_name ||
                        issuerCompany?.account_number ||
                        issuerCompany?.ifsc_code ||
                        issuerCompany?.account_holder_name) && (
                        <Box sx={{ mt: 1.5, display: 'grid', gap: 0.8 }}>
                          <Paper variant="outlined" sx={{ p: 1.2, borderColor: 'grey.400' }}>
                            <Typography variant="body2" fontWeight={600}>
                              {tr('계좌 정보', 'Bank Details')}
                            </Typography>
                            <Stack spacing={0.2} sx={{ mt: 0.6 }}>
                              {issuerCompany?.account_holder_name && (
                                <Typography variant="body2" color="text.secondary">
                                  Account Holder: {issuerCompany.account_holder_name}
                                </Typography>
                              )}
                              {issuerCompany?.bank_name && (
                                <Typography variant="body2" color="text.secondary">
                                  Bank Name: {issuerCompany.bank_name}
                                </Typography>
                              )}
                              {issuerCompany?.account_number && (
                                <Typography variant="body2" color="text.secondary">
                                  Account Number: {issuerCompany.account_number}
                                </Typography>
                              )}
                              {issuerCompany?.ifsc_code && (
                                <Typography variant="body2" color="text.secondary">
                                  IFSC: {issuerCompany.ifsc_code}
                                </Typography>
                              )}
                              {issuerCompany?.bank_address && (
                                <Typography variant="body2" color="text.secondary">
                                  {tr('은행 주소', 'Bank Address')}: {issuerCompany.bank_address}
                                </Typography>
                              )}
                            </Stack>
                          </Paper>
                        </Box>
                      )}

                      {(issuerCompany?.company_seal || issuerCompany?.ceo_signature) && (
                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.6 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                              For {issuerCompany?.name || 'Company'}
                            </Typography>
                            <Box sx={{ position: 'relative', width: '7cm', height: '3cm' }}>
                            {issuerCompany.company_seal && (
                              <AuthMedia
                                src={issuerCompany.company_seal}
                                alt="Company seal"
                                sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                              />
                            )}
                            {issuerCompany.ceo_signature && (
                              <AuthMedia
                                src={issuerCompany.ceo_signature}
                                alt="Signature"
                                sx={{
                                  position: 'absolute',
                                  right: 0,
                                  bottom: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                }}
                              />
                            )}
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                              {tr('승인 서명', 'Authorised Signatory')}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              );
            })}
            </Box>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              {selectedInvoice.payment_status !== 'paid' && (
                <Button variant="outlined" startIcon={<EditIcon />} onClick={() => handleEditInvoice(selectedInvoice)}>
                  {tr('수정', 'Edit')}
                </Button>
              )}
              <Tooltip
                disableHoverListener={isRegularInvoiceExportAllowed(selectedInvoice)}
                title={tr('승인 완료 후 인쇄할 수 있습니다.', 'Printing is available after approval.')}
              >
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    onClick={handlePrintInvoice}
                    disabled={!isRegularInvoiceExportAllowed(selectedInvoice)}
                  >
                    {tr('인쇄', 'Print')}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip
                disableHoverListener={isRegularInvoiceExportAllowed(selectedInvoice)}
                title={tr('승인 완료 후 PDF를 저장할 수 있습니다.', 'PDF download is available after approval.')}
              >
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadPdf}
                    disabled={!isRegularInvoiceExportAllowed(selectedInvoice)}
                  >
                    {tr('PDF 다운로드', 'Download PDF')}
                  </Button>
                </span>
              </Tooltip>
              {selectedInvoice.payment_status !== 'paid' && (
                <Tooltip
                  disableHoverListener={isRegularInvoiceExportAllowed(selectedInvoice)}
                  title={tr(
                    '승인 완료 후 정산할 수 있습니다.',
                    'Settlement is available after approval.'
                  )}
                >
                  <span>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleSettlementComplete}
                      disabled={!isRegularInvoiceExportAllowed(selectedInvoice)}
                    >
                      {tr('정산완료', 'Settlement Complete')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              <Tooltip
                disableHoverListener={isRegularInvoiceExportAllowed(selectedInvoice)}
                title={tr('승인 완료 후 이메일을 보낼 수 있습니다.', 'Email is available after approval.')}
              >
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    onClick={handleSendEmail}
                    disabled={!isRegularInvoiceExportAllowed(selectedInvoice)}
                  >
                    {tr('이메일 전송', 'Send Email')}
                  </Button>
                </span>
              </Tooltip>
              {selectedInvoice.payment_status !== 'paid' && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => {
                    handleDeleteInvoice(
                      selectedInvoice.id,
                      selectedInvoice.invoice_number,
                      selectedInvoice.payment_status
                    );
                  }}
                >
                  {tr('삭제요청', 'Request Delete')}
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      ) : ((isCreating || isEditing) ? (
        <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                  TAX INVOICE
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isEditing ? tr('인보이스 수정', 'Edit Invoice') : tr('일반 세금계산서 생성', 'Create Regular Tax Invoice')}
                </Typography>
              </Box>
              <Stack spacing={1} alignItems="flex-end">
                <Typography variant="caption" color="text.secondary">
                  {tr('인보이스 번호', 'Invoice No.')}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {isEditing && selectedInvoice ? selectedInvoice.invoice_number : generatedInvoiceNumber}
                </Typography>
                <Button variant="outlined" onClick={handleCancelEdit} sx={mvsBodyOutlinedBtnSx}>
                  {tr('취소', 'Cancel')}
                </Button>
              </Stack>
            </Box>

            {issuerCompany?.company_logo && (
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
                <AuthMedia
                  src={issuerCompany.company_logo}
                  alt="Company logo"
                  sx={{ maxHeight: 60, maxWidth: 220, objectFit: 'contain' }}
                />
              </Box>
            )}

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12 }}>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 12 }}>
                    <Card variant="outlined" sx={{ bgcolor: 'white' }}>
                      <CardContent>
                        {issuerCompany ? (
                          <Stack spacing={0.5}>
                            <Typography variant="body2" fontWeight={600}>{issuerCompany.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Business No.: {issuerCompany.business_number || '-'}
                            </Typography>
                            {issuerGstNumbers.length > 1 ? (
                              <Box
                                sx={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  columnGap: 0.75,
                                  rowGap: 0.5,
                                }}
                              >
                                <Typography component="span" variant="caption" color="text.secondary">
                                  GSTIN:
                                </Typography>
                                <FormControl size="small" sx={{ minWidth: 180 }}>
                                  <Select
                                    value={issuerGst || issuerGstNumbers[0]}
                                    onChange={(e) => setIssuerGst(String(e.target.value))}
                                  >
                                    {issuerGstNumbers.map((gst) => (
                                      <MenuItem key={gst} value={gst}>
                                        {gst}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                                <Typography component="span" variant="caption" color="text.secondary">
                                  , PAN: {issuerCompany.pan_number || '-'}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                GSTIN: {issuerGstNumbers[0] || '-'}, PAN: {issuerCompany.pan_number || '-'}
                              </Typography>
                            )}
                            {issuerCompany.address && (
                              <Typography variant="caption" color="text.secondary">Address: {issuerCompany.address}</Typography>
                            )}
                            {issuerCompany.phone && (
                              <Typography variant="caption" color="text.secondary">Phone: {issuerCompany.phone}</Typography>
                            )}
                            {issuerCompany.email && (
                              <Typography variant="caption" color="text.secondary">Email: {issuerCompany.email}</Typography>
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">No issuer company information</Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ bgcolor: 'white', height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Bill to
                    </Typography>
                    <Grid container spacing={0.8}>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="body2" sx={{ mb: 0.15, color: 'text.secondary', fontSize: '0.875rem' }}>
                          Customer Company *
                        </Typography>
                        <Autocomplete
                          fullWidth
                          size="small"
                          freeSolo
                          options={companies}
                          getOptionLabel={(option) => (typeof option === 'string' ? option : option?.name || '')}
                          isOptionEqualToValue={(option, value) => option.id === value.id}
                          value={companies.find(c => c.id === recipientCompanyId) || null}
                          inputValue={formData.customer_name}
                          onInputChange={(_, value) => {
                            setRecipientCompanyId('');
                            setCustomerGstNumbers([]);
                            setFormData((prev) => ({
                              ...prev,
                              customer_name: value
                            }));
                          }}
                          onChange={(_, value) => {
                            if (typeof value === 'string') {
                              setRecipientCompanyId('');
                              setCustomerGstNumbers([]);
                              setFormData({
                                ...formData,
                                customer_name: value
                              });
                              return;
                            }
                            const companyId = value ? value.id : '';
                            setRecipientCompanyId(companyId);
                            if (value) {
                              const gstList = normalizeGstNumbers(value.gst_numbers ?? value.gstNumbers);
                              const gst = gstList.find(g => g && g.trim() !== '') || '';
                              setCustomerGstNumbers(gstList);
                              setFormData({
                                ...formData,
                                customer_name: value.name || '',
                                customer_email: value.email || '',
                                customer_phone: value.phone || '',
                                customer_address: value.address || '',
                                customer_gst: gst
                              });
                            } else {
                              setCustomerGstNumbers([]);
                              setFormData({
                                ...formData,
                                customer_name: formData.customer_name,
                                customer_email: '',
                                customer_phone: '',
                                customer_address: '',
                                customer_gst: ''
                              });
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder={tr('회사 선택 또는 입력', 'Select or type company')}
                              size="small"
                              inputProps={{
                                ...params.inputProps,
                                autoComplete: 'new-password'
                              }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="body2" sx={{ mb: 0.15, color: 'text.secondary', fontSize: '0.875rem' }}>
                          Customer Email *
                        </Typography>
                        <TextField
                          size="small"
                          fullWidth
                          type="email"
                          value={formData.customer_email}
                          onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                          required
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="body2" sx={{ mb: 0.15, color: 'text.secondary', fontSize: '0.875rem' }}>
                          GSTIN *
                        </Typography>
                        {customerGstNumbers.length > 1 ? (
                          <FormControl size="small" fullWidth error={!formData.customer_gst}>
                            <Select
                              value={formData.customer_gst || customerGstNumbers[0] || ''}
                              onChange={(e) => setFormData({ ...formData, customer_gst: String(e.target.value) })}
                            >
                              {customerGstNumbers.map((gst) => (
                                <MenuItem key={gst} value={gst}>
                                  {gst}
                                </MenuItem>
                              ))}
                            </Select>
                            {!formData.customer_gst && (
                              <FormHelperText>GSTIN is required to register an invoice.</FormHelperText>
                            )}
                          </FormControl>
                        ) : (
                          <TextField
                            size="small"
                            fullWidth
                            value={formData.customer_gst}
                            onChange={(e) => setFormData({ ...formData, customer_gst: e.target.value })}
                            required
                            placeholder="GSTIN"
                            error={!formData.customer_gst}
                            helperText={!formData.customer_gst ? 'GSTIN is required to register an invoice.' : ''}
                          />
                        )}
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="body2" sx={{ mb: 0.15, color: 'text.secondary', fontSize: '0.875rem' }}>
                          Customer Phone
                        </Typography>
                        <TextField
                          size="small"
                          fullWidth
                          value={formData.customer_phone}
                          onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="body2" sx={{ mb: 0.15, color: 'text.secondary', fontSize: '0.875rem' }}>
                          Customer Address
                        </Typography>
                        <TextField
                          size="small"
                          fullWidth
                          value={formData.customer_address}
                          onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ bgcolor: 'white', height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Issue Info
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="body2" sx={{ mb: 0.2, color: 'text.secondary', fontSize: '0.875rem' }}>
                          Issue Date *
                        </Typography>
                        <TextField
                          fullWidth
                          type="date"
                          value={formData.invoice_date}
                          onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                          required
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="body2" sx={{ mb: 0.2, color: 'text.secondary', fontSize: '0.875rem' }}>
                          Currency
                        </Typography>
                        <FormControl fullWidth>
                          <Select
                            value={formData.currency}
                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          >
                            <MenuItem value="INR">INR</MenuItem>
                            <MenuItem value="USD">USD</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 2 }} />
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'grey.200',
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: 'white'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
                      ITEMIZED COSTS
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      size="small"
                      onClick={addItemAndFocusName}
                    >
                      Add Item
                    </Button>
                  </Box>

                  <Box sx={{ display: 'flex', px: 2, py: 0.8, bgcolor: 'grey.50', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'grey.200' }}>
                    <Box sx={{ flex: 1.6, pr: 2, display: 'flex', gap: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', flex: 1 }}>Item Name</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', flex: 0.5 }}>HSN/SAC</Typography>
                    </Box>
                    <Box sx={{ width: 110, pr: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>QTY</Typography>
                    </Box>
                    <Box sx={{ width: 160, pr: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>UNIT PRICE</Typography>
                    </Box>
                        <Box sx={{ width: 240, pr: 2, textAlign: 'center' }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>CGST / SGST / IGST (%)</Typography>
                        </Box>
                    <Box sx={{ width: 120, pr: 2, textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>AMOUNT</Typography>
                    </Box>
                    <Box sx={{ width: 40, textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>-</Typography>
                    </Box>
                  </Box>

                  {formData.items.length > 0 ? (
                    formData.items.map((item, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          px: 2,
                          py: 1,
                          borderBottom: index === formData.items.length - 1 ? 'none' : '1px solid',
                          borderColor: 'grey.200'
                        }}
                      >
                        <Box sx={{ flex: 1.6, pr: 2, display: 'flex', gap: 1 }}>
                          <TextField
                            size="small"
                            inputRef={(el) => {
                              if (el) itemNameRefs.current[index] = el;
                            }}
                            value={item.item_name}
                            onChange={(e) => {
                              const updatedItems = [...formData.items];
                              updatedItems[index].item_name = e.target.value;
                              updatedItems[index] = updateItemTaxAmount(updatedItems[index]);
                              setFormData({ ...formData, items: updatedItems });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                descriptionRefs.current[index]?.focus();
                              }
                            }}
                            placeholder="Item Name"
                            fullWidth
                            sx={{ flex: 1, ...itemInputSx }}
                            inputProps={{ style: { padding: '6px 8px' } }}
                          />
                          <TextField
                            size="small"
                            inputRef={(el) => {
                              if (el) descriptionRefs.current[index] = el;
                            }}
                            value={item.description}
                            onChange={(e) => {
                              const updatedItems = [...formData.items];
                              updatedItems[index].description = e.target.value;
                              updatedItems[index] = updateItemTaxAmount(updatedItems[index]);
                              setFormData({ ...formData, items: updatedItems });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                quantityRefs.current[index]?.focus();
                              }
                            }}
                            placeholder="HSN/SAC"
                            fullWidth
                            sx={{ flex: 0.5, ...itemInputSx }}
                            inputProps={{ style: { padding: '6px 8px' } }}
                          />
                        </Box>
                        <Box sx={{ width: 110, pr: 2 }}>
                          <TextField
                            size="small"
                            type="number"
                            inputRef={(el) => {
                              if (el) quantityRefs.current[index] = el;
                            }}
                            value={item.quantity}
                            onChange={(e) => {
                              const updatedItems = [...formData.items];
                              const qty = parseFloat(e.target.value) || 0;
                              updatedItems[index].quantity = qty;
                              updatedItems[index].total_price = qty * updatedItems[index].unit_price;
                              updatedItems[index] = updateItemTaxAmount(updatedItems[index]);
                              setFormData({ ...formData, items: updatedItems });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                unitPriceRefs.current[index]?.focus();
                              }
                            }}
                            fullWidth
                            sx={itemInputSx}
                            inputProps={{ style: { padding: '6px 8px' } }}
                          />
                        </Box>
                        <Box sx={{ width: 160, pr: 2 }}>
                          <TextField
                            size="small"
                            type="number"
                            inputRef={(el) => {
                              if (el) unitPriceRefs.current[index] = el;
                            }}
                            value={item.unit_price}
                            onChange={(e) => {
                              const updatedItems = [...formData.items];
                              const price = parseFloat(e.target.value) || 0;
                              updatedItems[index].unit_price = price;
                              updatedItems[index].total_price = updatedItems[index].quantity * price;
                              updatedItems[index] = updateItemTaxAmount(updatedItems[index]);
                              setFormData({ ...formData, items: updatedItems });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addItemAndFocusName();
                              }
                            }}
                            fullWidth
                            sx={itemInputSx}
                            inputProps={{ style: { padding: '6px 8px' } }}
                          />
                        </Box>
                        <Box sx={{ width: 240, pr: 2, display: 'flex', gap: 1 }}>
                          <FormControl size="small" fullWidth disabled={formData.taxMode === 'overall' || (item.igstRate || 0) > 0} sx={itemInputSx}>
                            <Select
                              value={formData.taxMode === 'overall' ? formData.overallCgstRate : (item.cgstRate || 0)}
                              onChange={(e) => {
                                const rate = Number(e.target.value) || 0;
                                const updatedItems = [...formData.items];
                                updatedItems[index].cgstRate = rate;
                                updatedItems[index].sgstRate = rate;
                                updatedItems[index] = updateItemTaxAmount(updatedItems[index]);
                                setFormData({ ...formData, items: updatedItems });
                              }}
                            >
                              {allowedGstRates.map((rate) => (
                                <MenuItem key={`cgst-${rate}`} value={rate}>
                                  {rate}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl size="small" fullWidth disabled={formData.taxMode === 'overall' || (item.igstRate || 0) > 0} sx={itemInputSx}>
                            <Select
                              value={formData.taxMode === 'overall' ? formData.overallSgstRate : (item.sgstRate || 0)}
                              onChange={(e) => {
                                const rate = Number(e.target.value) || 0;
                                const updatedItems = [...formData.items];
                                updatedItems[index].sgstRate = rate;
                                updatedItems[index] = updateItemTaxAmount(updatedItems[index]);
                                setFormData({ ...formData, items: updatedItems });
                              }}
                            >
                              {allowedGstRates.map((rate) => (
                                <MenuItem key={`sgst-${rate}`} value={rate}>
                                  {rate}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl size="small" fullWidth disabled={formData.taxMode === 'overall'} sx={itemInputSx}>
                            <Select
                              value={formData.taxMode === 'overall' ? formData.overallIgstRate : (item.igstRate || 0)}
                              onChange={(e) => {
                                const rate = Number(e.target.value) || 0;
                                const updatedItems = [...formData.items];
                                updatedItems[index].igstRate = rate;
                                if (rate > 0) {
                                  updatedItems[index].cgstRate = 0;
                                  updatedItems[index].sgstRate = 0;
                                }
                                updatedItems[index] = updateItemTaxAmount(updatedItems[index]);
                                setFormData({ ...formData, items: updatedItems });
                              }}
                            >
                              {allowedIgstRates.map((rate) => (
                                <MenuItem key={`igst-${rate}`} value={rate}>
                                  {rate}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                        <Box sx={{ width: 120, pr: 2, textAlign: 'right' }}>
                          <Typography variant="body2">
                            {(item.total_price + item.tax_amount).toLocaleString()} {formData.currency}
                          </Typography>
                        </Box>
                        <Box sx={{ width: 40, textAlign: 'center' }}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              const updatedItems = formData.items.filter((_, i) => i !== index);
                              setFormData({ ...formData, items: updatedItems });
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Box>
                    ))
                  ) : (
                    <Box sx={{ px: 2, py: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        No items added.
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Card variant="outlined" sx={{ mt: 2, bgcolor: 'white' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                      Tax Settings
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                          Input Mode
                        </Typography>
                        <FormControl fullWidth size="small">
                          <Select
                            size="small"
                            value={formData.taxMode}
                            onChange={(e) => setFormData({ ...formData, taxMode: e.target.value as 'overall' | 'item' })}
                          >
                            <MenuItem value="overall">Overall</MenuItem>
                            <MenuItem value="item">Per Item</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 12, md: 8 }}>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                              CGST (%)
                            </Typography>
                            <FormControl size="small" fullWidth disabled={formData.taxMode === 'item' || formData.overallIgstRate > 0}>
                              <Select
                                value={formData.overallCgstRate}
                                onChange={(e) => {
                                  const rate = Number(e.target.value) || 0;
                                  setFormData(prev => ({
                                    ...prev,
                                    overallCgstRate: rate,
                                    overallSgstRate: rate
                                  }));
                                }}
                              >
                                {allowedGstRates.map((rate) => (
                                  <MenuItem key={`overall-cgst-${rate}`} value={rate}>
                                    {rate}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                              SGST (%)
                            </Typography>
                            <FormControl size="small" fullWidth disabled={formData.taxMode === 'item' || formData.overallIgstRate > 0}>
                              <Select
                                value={formData.overallSgstRate}
                                onChange={(e) => {
                                  const rate = Number(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, overallSgstRate: rate }));
                                }}
                              >
                                {allowedGstRates.map((rate) => (
                                  <MenuItem key={`overall-sgst-${rate}`} value={rate}>
                                    {rate}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                              IGST (%)
                            </Typography>
                            <FormControl size="small" fullWidth disabled={formData.taxMode === 'item'}>
                              <Select
                                value={formData.overallIgstRate}
                                onChange={(e) => {
                                  const rate = Number(e.target.value) || 0;
                                  setFormData(prev => ({
                                    ...prev,
                                    overallIgstRate: rate,
                                    overallCgstRate: rate > 0 ? 0 : prev.overallCgstRate,
                                    overallSgstRate: rate > 0 ? 0 : prev.overallSgstRate
                                  }));
                                }}
                              >
                                {allowedIgstRates.map((rate) => (
                                  <MenuItem key={`overall-igst-${rate}`} value={rate}>
                                    {rate}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                  <Card variant="outlined" sx={{ minWidth: 260, bgcolor: 'white' }}>
                    <CardContent>
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                          <Typography variant="body2">{itemsSubtotal.toLocaleString()}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Tax</Typography>
                          <Typography variant="body2">{itemsTaxTotal.toLocaleString()}</Typography>
                        </Box>
                        <Divider />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="subtitle2">Total</Typography>
                          <Typography variant="subtitle2">{itemsGrandTotal.toLocaleString()} {formData.currency}</Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              </Grid>

              {isCreating && (
                <Grid size={{ xs: 12 }}>
                  <Typography
                    variant="body2"
                    sx={{ mb: 0.5, color: 'text.primary', fontWeight: 600, fontSize: '0.875rem' }}
                  >
                    {tr('승인자', 'Approver')} *
                  </Typography>
                  <Autocomplete
                    size="small"
                    fullWidth
                    options={companyUsers}
                    value={
                      approverUserId === ''
                        ? null
                        : companyUsers.find((x) => x.id === approverUserId) ?? null
                    }
                    onChange={(_, newValue) => setApproverUserId(newValue?.id ?? '')}
                    getOptionLabel={(option) =>
                      option.email ? `${option.username} (${option.email})` : option.username
                    }
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    noOptionsText={tr('일치하는 사용자가 없습니다.', 'No matching users')}
                    clearOnEscape
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={tr('이름 또는 이메일로 검색', 'Search by name or email')}
                      />
                    )}
                  />
                </Grid>
              )}

              {(issuerCompany?.company_seal || issuerCompany?.ceo_signature) && (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <Box sx={{ position: 'relative', width: '7cm', height: '3cm' }}>
                      {issuerCompany.company_seal && (
                        <AuthMedia
                          src={issuerCompany.company_seal}
                          alt="Company seal"
                          sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                        />
                      )}
                      {issuerCompany.ceo_signature && (
                        <AuthMedia
                          src={issuerCompany.ceo_signature}
                          alt="Signature"
                          sx={{
                            position: 'absolute',
                            right: 0,
                            bottom: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                </Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
                  <Button variant="outlined" onClick={handleCancelEdit} sx={mvsBodyOutlinedBtnSx}>
                    {tr('취소', 'Cancel')}
                  </Button>
                  <Button variant="contained" disableElevation onClick={handleSaveInvoice} sx={mvsBodyPrimaryBtnSx}>
                    {tr('저장', 'Save')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ) : (
        <>
          <Box sx={mvsBodyListZoneSx}>
            {pagedInvoices.length === 0 ? (
              <Box sx={listStateBoxSx}>
                <Typography variant="body2" color="text.secondary">
                  {tr('표시할 인보이스가 없습니다.', 'No invoices to display.')}
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={mvsBodyListTableSx}>
                <Table size="small" sx={invoiceListTableSx}>
                  <colgroup>
                    {invoiceListColumns.map((col) => (
                      <col key={col.key} style={{ width: col.width }} />
                    ))}
                  </colgroup>
                  <TableHead sx={mvsTableHeadHighlightSx}>
                    <TableRow>
                      {invoiceListColumns.map((col) => (
                        <TableCell
                          key={col.key}
                          align={col.align}
                          sx={{
                            ...invoiceCellBaseSx,
                            whiteSpace: 'nowrap',
                            ...(col.ellipsis ? invoiceCellEllipsisSx : {}),
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={col.label}
                          >
                            {col.label}
                          </Box>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody sx={mvsTableBodyRowSx}>
                    {pagedInvoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        onClick={() => handleViewInvoice(invoice)}
                        sx={{ cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }}
                      >
                        <TableCell sx={{ ...invoiceCellBaseSx, ...invoiceCellEllipsisSx }}>
                          {renderInvoiceEllipsisText(invoice.invoice_number, 500)}
                        </TableCell>
                        <TableCell sx={{ ...invoiceCellBaseSx, ...invoiceCellEllipsisSx }}>
                          {renderInvoiceEllipsisText(invoice.customer_name, 500)}
                        </TableCell>
                        <TableCell sx={{ ...invoiceCellBaseSx, whiteSpace: 'nowrap' }}>
                          {new Date(invoice.invoice_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell sx={{ ...invoiceCellBaseSx, whiteSpace: 'nowrap' }}>
                          {new Date(invoice.due_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell sx={{ ...invoiceCellBaseSx, ...invoiceCellEllipsisSx }}>
                          {renderInvoiceEllipsisText(
                            `${invoice.total_amount.toLocaleString()} ${invoice.currency}`,
                            500
                          )}
                        </TableCell>
                        <TableCell sx={{ ...invoiceCellBaseSx, whiteSpace: 'nowrap' }}>
                          {renderApprovalCell(invoice)}
                        </TableCell>
                        <TableCell sx={{ ...invoiceCellBaseSx, whiteSpace: 'nowrap' }}>
                          <Chip
                            label={getPaymentStatusText(invoice.payment_status)}
                            color={getPaymentStatusColor(invoice.payment_status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ ...invoiceCellBaseSx, whiteSpace: 'nowrap' }}>
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            {invoice.payment_status !== 'paid' && (
                              <Tooltip
                                disableHoverListener={isRegularInvoiceExportAllowed(invoice)}
                                title={tr(
                                  '승인 완료 후 정산할 수 있습니다.',
                                  'Settlement is available after approval.'
                                )}
                              >
                                <span>
                                  <IconButton
                                    size="small"
                                    color="success"
                                    disabled={!isRegularInvoiceExportAllowed(invoice)}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await settleInvoice(invoice);
                                    }}
                                  >
                                    <TaskAltIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                            <Tooltip
                              title={
                                isRegularInvoiceExportAllowed(invoice)
                                  ? tr('인쇄', 'Print')
                                  : tr('승인 완료 후 인쇄할 수 있습니다.', 'Printing is available after approval.')
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={!isRegularInvoiceExportAllowed(invoice)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isRegularInvoiceExportAllowed(invoice)) return;
                                    setPendingPrintInvoiceId(invoice.id);
                                    void handleViewInvoice(invoice);
                                  }}
                                >
                                  <PrintIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                            {listSubTab === 'pending' && invoice.approval_status === 'pending_approval' && (
                              <>
                                <Tooltip title={tr('승인', 'Approve')}>
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={(e) => void handleApproveRegularInvoice(invoice.id, e)}
                                  >
                                    <ThumbUpIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={tr('반려', 'Reject')}>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={(e) => void handleRejectRegularInvoice(invoice.id, e)}
                                  >
                                    <ThumbDownIcon />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            {invoice.payment_status !== 'paid' && (
                              <Tooltip title={tr('삭제요청', 'Request Delete')}>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteInvoice(invoice.id, invoice.invoice_number, invoice.payment_status);
                                  }}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Box sx={mvsBodyPaginationSx}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
              />
            </Box>
          </Box>
        </>
      ))}

      {/* ??? */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={deleteDialog.open}
        onClose={() => {
          if (loading) return;
          setDeleteDialog({
            open: false,
            id: null,
            invoiceNumber: '',
            approverUserId: '',
            memo: ''
          });
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {tr('삭제 승인 요청', 'Delete approval request')}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {deleteDialog.invoiceNumber
              ? tr(
                  `인보이스 «${deleteDialog.invoiceNumber}» 삭제는 바로 되지 않습니다. 승인자가 승인하면 처리됩니다.`,
                  `Invoice «${deleteDialog.invoiceNumber}» cannot be removed immediately. It will be processed after the approver approves.`
                )
              : tr(
                  '인보이스 삭제는 바로 되지 않습니다. 승인자가 승인하면 처리됩니다.',
                  'Deletion is not immediate. It will be processed after the approver approves.'
                )}
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>
              {tr('승인 대상', 'Approver')} *
            </Typography>
            <Autocomplete
              size="small"
              fullWidth
              options={companyUsers}
              value={
                deleteDialog.approverUserId === ''
                  ? null
                  : companyUsers.find((x) => x.id === deleteDialog.approverUserId) ?? null
              }
              onChange={(_, newValue) =>
                setDeleteDialog((d) => ({ ...d, approverUserId: newValue?.id ?? '' }))
              }
              getOptionLabel={(option) =>
                option.email ? `${option.username} (${option.email})` : option.username
              }
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText={tr('일치하는 사용자가 없습니다.', 'No matching users')}
              clearOnEscape
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={tr('이름 또는 이메일로 검색', 'Search by name or email')}
                />
              )}
            />
            <FormHelperText sx={{ mx: 0 }}>
              {tr('이 요청을 검토·승인할 사용자를 선택하세요.', 'Choose who will review and approve this request.')}
            </FormHelperText>
          </Box>
          <TextField
            fullWidth
            multiline
            minRows={3}
            size="small"
            label={tr('메모', 'Memo')}
            placeholder={tr('삭제 사유 등을 입력하세요.', 'Enter reason for deletion, etc.')}
            value={deleteDialog.memo}
            onChange={(e) => setDeleteDialog((d) => ({ ...d, memo: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() =>
              setDeleteDialog({
                open: false,
                id: null,
                invoiceNumber: '',
                approverUserId: '',
                memo: ''
              })
            }
            disabled={loading}
            sx={mvsBodyOutlinedBtnSx}
          >
            {tr('취소', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            onClick={() => void handleConfirmDeleteInvoice()}
            disabled={loading || companyUsers.length === 0}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
            sx={mvsBodyPrimaryBtnSx}
          >
            {tr('삭제 요청', 'Submit request')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RegularInvoice;