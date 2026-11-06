import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  TableSortLabel,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  Pagination,
  InputAdornment,
  Divider,
  Avatar,
  LinearProgress,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Tabs,
  Tab,
  Autocomplete,
  Collapse,
  useTheme
} from '@mui/material';
import MvsPageHeader from '../../components/Common/MvsPageHeader';
import {
  mvsPageContentMaxWidth,
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
  mvsTableBodyRowSx } from '../../theme/mvsLayout';
import { alpha } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  Send as SendIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  QrCode2 as QrCodeIcon,
  ArrowForward as ArrowForwardIcon,
  OpenInNew as OpenInNewIcon,
  InsertDriveFile as FileIcon,
  ChatBubble as ChatBubbleIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  Reply as ReplyIcon } from '@mui/icons-material';
import { useStore } from '../../store';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { accountingService, companyService, partnerService, workAssigneeListService } from '../../services/api';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { resolveRegisteredStateCodeFromCompanyLike } from '../HR/payroll/indianProfessionalTax';
import { getUploadUrl, downloadUploadFile, fetchUploadObjectUrl } from '../../utils/uploadUrl';
import AuthMedia from '../../components/Common/AuthMedia';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import {
  buildExpenseApprovalPdfFilename,
  downloadExpenseApprovalPdf,
  EXPENSE_DOCUMENT_EXPORT_CSS,
  EXPENSE_ITEMS_QTY_COL_WIDTH_PX,
  EXPENSE_ITEMS_UNIT_PRICE_COL_WIDTH_PX,
  EXPENSE_TAX_AMOUNT_COL_WIDTH_PX,
  EXPENSE_TAX_BOX_WIDTH_PERCENT,
  EXPENSE_TAX_BOX_WIDTH_PX,
  EXPENSE_TAX_RATE_COL_WIDTH_PX,
} from '../../utils/expenseApprovalPdf';
import { buildDocumentDownloadFilename } from '../../utils/pdf';
import { normalizePartnerCompanyName } from '../../utils/partnerCompanyName';
import { formatEnglishSentenceLabel } from '../../utils/textCase';
import {
  formatBankAccountDisplay,
  formatPhoneDisplay,
  hasNonDigitInput,
  normalizeBankAccountDigits,
  normalizeEmailLower,
  normalizeIfsc,
  normalizePhoneDigits,
} from '../../utils/personalInfoFormat';
import { showErrorPopup } from '../../utils/errorHandler';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import { useMenuActionGuard } from '../../hooks/useMenuActionGuard';

const EXPENSE_APPROVAL_MENU_ROUTES = ['/accounting/expense'] as const;

const expenseApprovalFilterFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx } as const;

/** expense-receipts/1784..._IMG.jpg → IMG.jpg */
const getReceiptDisplayName = (filePath: string): string => {
  const base = String(filePath || '').split(/[/\\]/).pop() || String(filePath || '');
  let display: string;
  // 표준명 yyyyMMdd_PV|PI|RT|RI (...) 은 그대로 표시
  if (/^\d{8}_[A-Za-z]/.test(base)) display = base;
  // 레거시 timestamp_원본명
  else display = base.replace(/^\d+_/, '') || base;
  if (String(filePath || '').includes('expense-remittance-proofs')) {
    return stripFileExtensionForDisplay(display);
  }
  return display;
};

const isImageReceipt = (filePath: string): boolean =>
  /\.(jpe?g|png|gif|webp|bmp|heic)(?:$|[?#])/i.test(String(filePath || ''));

const isPdfReceipt = (filePath: string): boolean =>
  /\.pdf(?:$|[?#])/i.test(String(filePath || ''));

/** 작성/받은 탭 기본 상태 필터: 초안 + 제출됨 */
const DEFAULT_LIST_STATUS_FILTER = 'draft_submitted';
/** 송금 탭 단일 상태 필터 기본값(레거시/일부 리셋용) */
const DEFAULT_TRANSFER_STATUS_FILTER = 'transfer_pending';
/** 송금 탭 기본 목록: 송금대기 + 부분송금 + 택스 인보이스 대기 */
const DEFAULT_TRANSFER_STATUS_FILTERS = [
  'transfer_pending',
  'transfer_partial',
  'awaiting_tax',
] as const;

const TRANSFER_STATUS_FILTER_OPTIONS = [
  'transfer_pending',
  'transfer_partial',
  'awaiting_tax',
  'transfer_completed',
  'transfer_failed',
] as const;

const defaultStatusFilterForTab = (tab: string) =>
  tab === 'transfer' ? DEFAULT_TRANSFER_STATUS_FILTER : DEFAULT_LIST_STATUS_FILTER;

const defaultTransferStatusFiltersForTab = (): string[] => [...DEFAULT_TRANSFER_STATUS_FILTERS];

type ExpenseInvoiceType = 'tax' | 'proforma' | 'none';

type ExpenseAttachment = {
  path: string;
  invoiceType: ExpenseInvoiceType;
};

const normalizeExpenseInvoiceType = (value: unknown): ExpenseInvoiceType => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'proforma' || raw === 'proforma_invoice' || raw === 'pi') return 'proforma';
  if (raw === 'none' || raw === 'no_invoice' || raw === 'no-invoice' || raw === '없이' || raw === '없음') {
    return 'none';
  }
  return 'tax';
};

const normalizeExpenseAttachments = (value: unknown): ExpenseAttachment[] => {
  if (!value) return [];
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      const path = value.trim();
      return path ? [{ path, invoiceType: 'tax' }] : [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      if (typeof item === 'string') {
        const path = item.trim();
        return path ? { path, invoiceType: 'tax' as const } : null;
      }
      if (item && typeof item === 'object') {
        const obj = item as {
          path?: string;
          url?: string;
          file?: string;
          invoiceType?: string;
          invoice_type?: string;
        };
        const path = String(obj.path || obj.url || obj.file || '').trim();
        if (!path) return null;
        return {
          path,
          invoiceType: normalizeExpenseInvoiceType(obj.invoiceType ?? obj.invoice_type),
        };
      }
      return null;
    })
    .filter(Boolean) as ExpenseAttachment[];
};

/** 지출결의서 body 가로 — 공통 maxWidth 대비 20% 확장 */
const expensePageRootSx = {
  ...mvsPageRootSx,
  maxWidth: Math.round(mvsPageContentMaxWidth * 1.2),
};

const expenseHasTaxInvoice = (attachments: ExpenseAttachment[] | string[] | unknown) =>
  normalizeExpenseAttachments(attachments).some((row) => row.invoiceType === 'tax');

/** 인보이스 없음 — Tax Invoice 없이 전액 송금 후 종료 가능 */
const expenseIsNoInvoice = (expense: { itemMeta?: Record<string, any> } | null | undefined) => {
  if (!expense?.itemMeta) return false;
  const v = expense.itemMeta.noInvoice ?? expense.itemMeta.no_invoice;
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  const mode = String(
    expense.itemMeta.invoiceMode || expense.itemMeta.invoice_mode || ''
  )
    .trim()
    .toLowerCase();
  return mode === 'none' || mode === 'no_invoice' || mode === 'no-invoice';
};

/** Proforma + 선지출 — 승인 시 송금 없이 지급 완료 처리 */
const expenseIsPrepaid = (expense: { itemMeta?: Record<string, any> } | null | undefined) => {
  if (!expense?.itemMeta) return false;
  const v = expense.itemMeta.isPrepaid ?? expense.itemMeta.is_prepaid;
  return v === true || v === 'true' || v === 1 || v === '1';
};

const expenseIsAwaitingTaxInvoice = (expense: {
  attachments?: ExpenseAttachment[] | string[];
  totalAmount?: number;
  paidAmount?: number;
  status?: string;
  paymentRequestStatus?: string;
  itemMeta?: Record<string, any>;
}) => {
  if (expenseIsPrepaid(expense)) return false;
  if (expenseIsNoInvoice(expense)) return false;
  const total = Number(expense.totalAmount || 0);
  const paid = Number(expense.paidAmount || 0);
  const remaining = Math.max(0, total - paid);
  if (remaining > 0) return false;
  if (paid <= 0) return false;
  if (String(expense.paymentRequestStatus || '').toLowerCase() === 'paid') return false;
  if (expense.status === 'paid') return false;
  return !expenseHasTaxInvoice(expense.attachments);
};

interface ExpenseItem {
  id: string;
  invoiceDate: string;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
  date?: string;
  amount?: number;
  /** TDS 양식 전용 */
  pan?: string;
  deducteePartnerId?: string;
  tdsRate?: number;
  deducteeType?: 'company' | 'other';
  tdsSection?: string;
  tdsCode?: string;
  tdsAmount?: number;
  tdsInterest?: number;
  remarks?: string;
  /** GST 전표 유형 전용 */
  gstRowKey?: 'sale' | 'inputCredit' | 'rcm' | 'earlierCredit' | 'interest' | 'lateFee';
  taxableValue?: number;
  igst?: number;
  cgst?: number;
  sgst?: number;
  /** (E) 이자 / (F) 연체료 인라인 계산 입력값 */
  gstExtra?: GstInterestExtra | GstLateFeeExtra;
  /** 일반 전표 — 항목별 GST 세율 */
  igstRate?: number;
  cgstRate?: number;
  sgstRate?: number;
}

type GstAmountMode = 'auto' | 'manual';

type GstInterestExtra = {
  kind: 'interest';
  unpaidAmount: number;
  dueDate: string;
  plannedDate: string;
  annualRatePercent: number;
  delayDays: number | null;
  computedAmount: number | null;
  amount: number;
  amountMode: GstAmountMode;
  calcAsOfDate: string;
};

type GstLateFeeExtra = {
  kind: 'lateFee';
  filingDueDate: string;
  filingPlannedDate: string;
  dailyFee: number;
  capAmount: number;
  delayDays: number | null;
  computedAmount: number | null;
  amount: number;
  amountMode: GstAmountMode;
  calcAsOfDate: string;
};

type GstSummaryRowKey = NonNullable<ExpenseItem['gstRowKey']>;

const GST_SUMMARY_ROW_ORDER: GstSummaryRowKey[] = [
  'sale',
  'inputCredit',
  'earlierCredit',
  'rcm',
  'interest',
  'lateFee',
];

const GST_SUMMARY_ROW_DEFS: Array<{
  key: GstSummaryRowKey;
  labelKey: string;
  withPeriod?: boolean;
  fields: { taxable?: boolean; igst?: boolean; cgst?: boolean; sgst?: boolean };
}> = [
  { key: 'sale', labelKey: 'gstRowSale', withPeriod: true, fields: { taxable: true, igst: true, cgst: true, sgst: true } },
  { key: 'inputCredit', labelKey: 'gstRowInputCredit', withPeriod: true, fields: { taxable: true, igst: true, cgst: true, sgst: true } },
  { key: 'earlierCredit', labelKey: 'gstRowEarlierCredit', fields: { taxable: true, igst: true, cgst: true, sgst: true } },
  { key: 'rcm', labelKey: 'gstRowRcm', fields: { taxable: true, igst: true, cgst: true, sgst: true } },
  { key: 'interest', labelKey: 'gstRowInterest', fields: { taxable: false, igst: true, cgst: true, sgst: true } },
  { key: 'lateFee', labelKey: 'gstRowLateFee', fields: { taxable: false, igst: false, cgst: true, sgst: true } },
];

/** 1~4: GST/RCM 본표 */
const GST_MAIN_ROW_DEFS = GST_SUMMARY_ROW_DEFS.filter(
  (d) => d.key === 'sale' || d.key === 'inputCredit' || d.key === 'earlierCredit' || d.key === 'rcm'
);
/** 5~6: 이자·연체료 */
const GST_EF_ROW_DEFS = GST_SUMMARY_ROW_DEFS.filter(
  (d) => d.key === 'interest' || d.key === 'lateFee'
);

const GST_INDIA_TZ = 'Asia/Kolkata';

const todayIndiaYmd = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: GST_INDIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const parseIndiaYmdParts = (ymd: string): { y: number; m: number; d: number } | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
};

/** 기한 당일=0, 다음 날부터 1 (인도 달력일) */
const calcIndiaDelayDays = (dueYmd: string, plannedYmd: string): number | null => {
  const due = parseIndiaYmdParts(dueYmd);
  const planned = parseIndiaYmdParts(plannedYmd);
  if (!due || !planned) return null;
  const t0 = Date.UTC(due.y, due.m - 1, due.d);
  const t1 = Date.UTC(planned.y, planned.m - 1, planned.d);
  return Math.max(0, Math.round((t1 - t0) / 86400000));
};

const nonNegDecimal = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return roundDecimal2(n);
};

const createDefaultInterestExtra = (): GstInterestExtra => ({
  kind: 'interest',
  unpaidAmount: 0,
  dueDate: '',
  plannedDate: todayIndiaYmd(),
  annualRatePercent: 18,
  delayDays: null,
  computedAmount: null,
  amount: 0,
  amountMode: 'auto',
  calcAsOfDate: '',
});

const createDefaultLateFeeExtra = (): GstLateFeeExtra => ({
  kind: 'lateFee',
  filingDueDate: '',
  filingPlannedDate: todayIndiaYmd(),
  dailyFee: 0,
  capAmount: 0,
  delayDays: null,
  computedAmount: null,
  amount: 0,
  amountMode: 'auto',
  calcAsOfDate: '',
});

const isInterestCalcComplete = (extra: GstInterestExtra) =>
  Boolean(extra.dueDate && extra.plannedDate) &&
  Number(extra.unpaidAmount) > 0 &&
  Number(extra.annualRatePercent) > 0;

const isLateFeeCalcComplete = (extra: GstLateFeeExtra) =>
  Boolean(extra.filingDueDate && extra.filingPlannedDate) &&
  calcIndiaDelayDays(extra.filingDueDate, extra.filingPlannedDate) != null;

const recomputeInterestExtra = (extra: GstInterestExtra): GstInterestExtra => {
  const unpaidAmount = nonNegDecimal(extra.unpaidAmount);
  const annualRatePercent = nonNegDecimal(extra.annualRatePercent);
  const dueDate = String(extra.dueDate || '').trim();
  const plannedDate = String(extra.plannedDate || '').trim();
  const delayDays = calcIndiaDelayDays(dueDate, plannedDate);
  const complete = Boolean(dueDate && plannedDate) && unpaidAmount > 0 && annualRatePercent > 0 && delayDays != null;
  const computedAmount = complete
    ? roundDecimal2(unpaidAmount * (annualRatePercent / 100) * (delayDays as number) / 365)
    : null;
  const amountMode = extra.amountMode === 'manual' ? 'manual' : 'auto';
  const amount =
    amountMode === 'manual'
      ? nonNegDecimal(extra.amount)
      : computedAmount != null
        ? computedAmount
        : 0;
  return {
    kind: 'interest',
    unpaidAmount,
    dueDate,
    plannedDate,
    annualRatePercent,
    delayDays,
    computedAmount,
    amount,
    amountMode,
    calcAsOfDate: amountMode === 'auto' && complete ? plannedDate : String(extra.calcAsOfDate || ''),
  };
};

const recomputeLateFeeExtra = (extra: GstLateFeeExtra): GstLateFeeExtra => {
  const filingDueDate = String(extra.filingDueDate || '').trim();
  const filingPlannedDate = String(extra.filingPlannedDate || '').trim();
  const dailyFee = nonNegDecimal(extra.dailyFee);
  const capAmount = nonNegDecimal(extra.capAmount);
  const delayDays = calcIndiaDelayDays(filingDueDate, filingPlannedDate);
  const complete = Boolean(filingDueDate && filingPlannedDate) && delayDays != null;
  const computedAmount = complete
    ? roundDecimal2(Math.min((delayDays as number) * dailyFee, capAmount))
    : null;
  const amountMode = extra.amountMode === 'manual' ? 'manual' : 'auto';
  const amount =
    amountMode === 'manual'
      ? nonNegDecimal(extra.amount)
      : computedAmount != null
        ? computedAmount
        : 0;
  return {
    kind: 'lateFee',
    filingDueDate,
    filingPlannedDate,
    dailyFee,
    capAmount,
    delayDays,
    computedAmount,
    amount,
    amountMode,
    calcAsOfDate:
      amountMode === 'auto' && complete ? filingPlannedDate : String(extra.calcAsOfDate || ''),
  };
};

const applyLateFeeHeadsFromAmount = (amount: number) => {
  const half = roundDecimal2(amount / 2);
  const cgst = half;
  const sgst = roundDecimal2(amount - half);
  return { taxableValue: 0, igst: 0, cgst, sgst };
};

const getGstExtraPayableAmount = (item: ExpenseItem | undefined): number => {
  if (!item?.gstExtra) return 0;
  if (item.gstExtra.kind === 'interest') {
    const extra = item.gstExtra;
    if (extra.amountMode === 'auto' && !isInterestCalcComplete(extra) && extra.computedAmount == null) {
      return 0;
    }
    return nonNegDecimal(extra.amount);
  }
  const extra = item.gstExtra;
  if (extra.amountMode === 'auto' && !isLateFeeCalcComplete(extra) && extra.computedAmount == null) {
    return 0;
  }
  return nonNegDecimal(extra.amount);
};

const interestHeadsMatchAmount = (item: ExpenseItem, amount: number) => {
  const heads = calcGstSummaryRowTotal(item);
  return Math.abs(heads - roundDecimal2(amount)) < 0.015;
};

type ExpenseFormType = 'general' | 'gst' | 'tds';

const resolveExpenseFormType = (meta?: Record<string, any> | null): ExpenseFormType => {
  const raw = String(meta?.formType || meta?.form_type || '').trim().toLowerCase();
  if (raw === 'general' || raw === 'gst' || raw === 'tds') return raw;
  return 'general';
};

const calcTdsLineAmounts = (item: {
  amount?: number;
  unitPrice?: number;
  qty?: number;
  tdsRate?: number;
  tdsInterest?: number;
}) => {
  const base = floorMoney(
    Number(item.amount ?? 0) || Number(item.unitPrice || 0) * Number(item.qty || 1)
  );
  const rate = Number(item.tdsRate || 0);
  const tdsAmt = floorMoney(base * (rate / 100));
  const interest = floorMoney(Number(item.tdsInterest || 0));
  const payable = floorMoney(base - tdsAmt);
  return { base, tdsAmt, interest, payable, lineTotal: floorMoney(tdsAmt + interest) };
};

const isOtherTdsDeductee = (item: { deducteeType?: string }) =>
  String(item.deducteeType || '').toLowerCase() !== 'company';

/** Company는 Amount × Rate. Other Than Company Deductee는 입력한 TDS. */
const effectiveTdsLineAmount = (item: {
  amount?: number;
  unitPrice?: number;
  qty?: number;
  tdsRate?: number;
  tdsInterest?: number;
  tdsAmount?: number;
  deducteeType?: string;
}) => {
  if (isOtherTdsDeductee(item)) return floorMoney(Number(item.tdsAmount || 0));
  return calcTdsLineAmounts(item).tdsAmt;
};

const sumTdsAmountByDeducteeType = (
  items: Array<{
    amount?: number;
    unitPrice?: number;
    qty?: number;
    tdsRate?: number;
    tdsInterest?: number;
    tdsAmount?: number;
    deducteeType?: string;
  }> | undefined,
  type: 'company' | 'other'
) =>
  floorMoney(
    (items || []).reduce((sum, item) => {
      const isCompany = !isOtherTdsDeductee(item);
      if (type === 'company' ? !isCompany : isCompany) return sum;
      return sum + effectiveTdsLineAmount(item);
    }, 0)
  );

const formatSignedAmount = (value: number) => {
  const n = floorMoney(value);
  if (n < 0) {
    return `(${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })})`;
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

interface PartnerOption {
  id: number;
  company_name: string;
  representative?: string;
  address?: string;
  phone?: string;
  email?: string;
  pan_number?: string;
  bank_name?: string;
  account_number?: string;
  bank_ifsc?: string;
  account_holder?: string;
  business_number?: string;
  gstNumbers?: string[];
}

interface ExpenseApprovalItem {
  id: number;
  expenseId: string;
  title: string;
  requesterId: number;
  requesterName: string;
  requesterDepartment: string;
  requesterPosition: string;
  totalAmount: number;
  currency: string;
  purpose: string;
  items: ExpenseItem[];
  status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'paid';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  currentApproverId?: number;
  currentApproverName?: string;
  approvalFlow: ApprovalStep[];
  ccUserIds: number[];
  submittedAt: string;
  dueDate: string;
  notes?: string;
  attachments: ExpenseAttachment[];
  comments: ExpenseReportComment[];
  commentCount?: number;
  lastCommentAt?: string;
  hasUnreadComments?: boolean;
  itemMeta?: Record<string, any>;
  approvalId?: number;
  paymentRequestStatus?: string;
  paidAmount?: number;
  paymentRequestedAt?: string;
  paymentCompletedAt?: string;
  paymentApprovedReason?: string;
  paymentApprovedAt?: string;
  paymentApprovedBy?: number;
  paymentRejectedReason?: string;
  paymentRejectedAt?: string;
  paymentRejectedBy?: number;
  bankTransferProvider?: string;
  bankTransferStatus?: string;
  bankTransferReference?: string;
  bankTransferError?: string;
  bankTransferLogs?: Array<{
    timestamp?: string;
    action?: string;
    status?: string;
    provider?: string | null;
    amount?: number;
    proof?: string;
    proof_name?: string;
    payload?: any;
    response?: any;
    error?: string | null;
  }>;
  remittanceHistory?: Array<{ timestamp?: string; amount?: number }>;
  companyId?: number;
  companyName?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalStep {
  id: number;
  stepOrder: number;
  approverId: number;
  approverName: string;
  approverDepartment?: string;
  approverPosition?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  approvedAt?: string;
  assignedAt?: string;
  comment?: string;
  action?: 'assigned' | 'reassigned' | 'approved' | 'rejected' | 'revision_rejected' | 'edited' | 'changed';
  changedById?: number;
  changedByName?: string;
  previousApproverId?: number;
  previousApproverName?: string;
  escalated?: boolean;
  escalatedToId?: number;
  escalatedToName?: string;
}

interface ExpenseReportComment {
  id: number;
  userId?: number;
  userName: string;
  comment: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: number | null;
  replies?: ExpenseReportComment[];
}

const parseExpenseCommentId = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const parseExpenseReportCommentRow = (row: Record<string, unknown>): ExpenseReportComment | null => {
  const comment = String(row.comment || '').trim();
  if (!comment) return null;
  const parsedId = parseExpenseCommentId(row.id);
  if (!parsedId) return null;
  const repliesRaw = Array.isArray(row.replies) ? row.replies : [];
  const replies = repliesRaw
    .map((item) =>
      item && typeof item === 'object'
        ? parseExpenseReportCommentRow(item as Record<string, unknown>)
        : null
    )
    .filter(Boolean) as ExpenseReportComment[];
  return {
    id: parsedId,
    userId: row.userId != null ? Number(row.userId) : undefined,
    userName: String(row.userName || row.user_name || '—'),
    comment,
    createdAt: String(row.createdAt || row.created_at || ''),
    updatedAt: String(row.updatedAt || row.updated_at || '') || undefined,
    parentId:
      row.parentId != null || row.parent_id != null
        ? Number(row.parentId ?? row.parent_id)
        : null,
    replies,
  };
};

const parseExpenseReportComments = (value: unknown): ExpenseReportComment[] => {
  if (value == null) return [];
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((row) => (row && typeof row === 'object' ? parseExpenseReportCommentRow(row as Record<string, unknown>) : null))
    .filter((row): row is ExpenseReportComment => !!row && !row.parentId);
};

const getExpenseLastCommentAt = (comments: ExpenseReportComment[] = []): number => {
  let latest = 0;
  const walk = (rows: ExpenseReportComment[]) => {
    for (const row of rows) {
      for (const value of [row.createdAt, row.updatedAt]) {
        const ts = Date.parse(String(value || ''));
        if (Number.isFinite(ts) && ts > latest) latest = ts;
      }
      if (row.replies?.length) walk(row.replies);
    }
  };
  walk(comments);
  return latest;
};

const resolveExpenseLastCommentAt = (expense: ExpenseApprovalItem): string => {
  const fromField = Date.parse(String(expense.lastCommentAt || ''));
  if (Number.isFinite(fromField) && fromField > 0) {
    return new Date(fromField).toISOString();
  }
  const ts = getExpenseLastCommentAt(expense.comments);
  return ts > 0 ? new Date(ts).toISOString() : '';
};

const countExpenseComments = (comments: ExpenseReportComment[] = []): number => {
  let count = 0;
  const walk = (rows: ExpenseReportComment[]) => {
    for (const row of rows) {
      count += 1;
      if (row.replies?.length) walk(row.replies);
    }
  };
  walk(comments);
  return count;
};

const compareExpenseDefaultListOrder = (
  a: ExpenseApprovalItem,
  b: ExpenseApprovalItem,
  resolveStatus: (expense: ExpenseApprovalItem) => string
) => {
  // 1) 안 읽은 댓글
  if (a.hasUnreadComments !== b.hasUnreadComments) {
    return a.hasUnreadComments ? -1 : 1;
  }

  // 2) 상태: 제출 → 검토 → 승인 → …
  const byStatus =
    (STATUS_SORT_ORDER[resolveStatus(a)] ?? 99) - (STATUS_SORT_ORDER[resolveStatus(b)] ?? 99);
  if (byStatus !== 0) return byStatus;

  // 3) 우선순위: 긴급 → 높음 → 보통 → 낮음
  const byPriority = (PRIORITY_SORT_ORDER[a.priority] ?? 9) - (PRIORITY_SORT_ORDER[b.priority] ?? 9);
  if (byPriority !== 0) return byPriority;

  // 4) 작성일: 최근 → 과거
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
};

const ExpenseCommentCountBadge: React.FC<{ expense: ExpenseApprovalItem }> = ({ expense }) => {
  const count = expense.commentCount ?? countExpenseComments(expense.comments);
  if (count <= 0) return null;
  const isUnread = Boolean(expense.hasUnreadComments);
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        flexShrink: 0,
        lineHeight: 1,
      }}
      aria-label={`${count}`}
    >
      {isUnread ? (
        <Box
          sx={{
            position: 'relative',
            width: 20,
            height: 18,
            flexShrink: 0,
          }}
        >
          <ChatBubbleIcon
            sx={{
              fontSize: 20,
              color: '#DC2626',
              display: 'block',
            }}
          />
          <Box
            component="span"
            sx={{
              position: 'absolute',
              top: 2,
              left: 2,
              right: 2,
              bottom: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: count > 9 ? '0.5rem' : '0.5625rem',
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1,
              transform: 'translateY(1px)',
            }}
          >
            {count}
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: '#64748B' }}>
          <ChatBubbleOutlineIcon sx={{ fontSize: 15 }} />
          <Box component="span" sx={{ fontSize: '0.6875rem', fontWeight: 700 }}>
            {count}
          </Box>
        </Box>
      )}
    </Box>
  );
};

const submitExpenseCommentOnEnter = (
  event: React.KeyboardEvent,
  submit: () => void,
  disabled?: boolean
) => {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || disabled) return;
  event.preventDefault();
  submit();
};

/** 전자결재 문서 작성과 동일한 문서 틀 스타일 */
const EXPENSE_LINE = '#E2E8F0';
const EXPENSE_MUTED_BG = '#F8FAFC';
const EXPENSE_HEADER_BG = '#EEF2F6';
const EXPENSE_TOTAL_BG = '#FEE2E2';
const EXPENSE_TOTAL_FG = '#B91C1C';
const EXPENSE_TOTAL_LINE = '#FECACA';
const EXPENSE_HEADER_FG = '#1E293B';
const EXPENSE_STAMP_LINE = '#94A3B8';
const EXPENSE_STAMP_HEADER_BG = '#F1F5F9';
const EXPENSE_STAMP_LABEL = '#0F172A';
const EXPENSE_STAMP_RADIUS = '6px';
const expenseStampHeaderSx = {
  textAlign: 'center',
  bgcolor: EXPENSE_STAMP_HEADER_BG,
  borderBottom: `1px solid ${EXPENSE_STAMP_LINE}`,
  borderTopLeftRadius: EXPENSE_STAMP_RADIUS,
  borderTopRightRadius: EXPENSE_STAMP_RADIUS,
} as const;
const EXPENSE_VENDOR_BG = '#FFFFFF';
/** 협력업체 섹션 외곽선 — 일반 테두리보다 뚜렷하게 (결재란 외곽선과 동일 톤) */
const EXPENSE_VENDOR_LINE = '#64748B';
const EXPENSE_VENDOR_SUB = '#64748B';
/** 협력업체 라벨(헤더) 셀 — 기본 muted보다 한 단계 진하게 */
const EXPENSE_VENDOR_LABEL_BG = '#D0DCE8';

/** GST 요약표 — 숫자열 간격 (colgroup % + 입력 fullWidth) */
const GST_SUMMARY_NUM_COL_PERCENT = '17%';
const GST_SUMMARY_DETAIL_COL_PERCENT = '28%';

const gstSummaryTableSx = {
  tableLayout: 'fixed' as const,
  width: '100%',
} as const;

const gstSummaryDataCellSx = {
  py: 0.55,
  px: 0.375,
  borderBottom: `1px solid ${EXPENSE_LINE}`,
  verticalAlign: 'middle' as const,
} as const;

const gstSummaryDetailCellSx = {
  ...gstSummaryDataCellSx,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const gstSummaryNumCellSx = {
  ...gstSummaryDataCellSx,
  px: 0.25,
  whiteSpace: 'nowrap' as const,
} as const;

const gstSummaryNumFieldSx = {
  width: '100%',
  maxWidth: '100%',
  display: 'block',
  '& .MuiOutlinedInput-root': {
    width: '100%',
    height: 36,
    borderRadius: '6px',
    bgcolor: '#FFFFFF',
    '& fieldset': { borderColor: '#CBD5E1' },
    '&:hover fieldset': { borderColor: '#94A3B8' },
    '& .MuiOutlinedInput-input': {
      py: 0.5,
      px: 0.625,
      fontSize: '0.875rem',
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
    },
  },
} as const;

/** (E)/(F) 인라인 계산 — 한 줄·가로스크롤 없음 */
const gstInlineCalcRowSx = {
  display: 'grid',
  alignItems: 'center',
  columnGap: 0.75,
  rowGap: 0,
  width: '100%',
  minWidth: 0,
  py: 0.75,
} as const;

const gstInlineUnitSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 0.35,
  minWidth: 0,
} as const;

const gstInlineLabelSx = {
  fontSize: '0.625rem',
  color: '#64748B',
  fontWeight: 600,
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const GST_INLINE_FIELD_HEIGHT = 28;

const gstInlineFieldSx = {
  width: '100%',
  minWidth: 0,
  '& .MuiOutlinedInput-root': {
    width: '100%',
    height: GST_INLINE_FIELD_HEIGHT,
    minHeight: GST_INLINE_FIELD_HEIGHT,
    boxSizing: 'border-box',
    borderRadius: '2px',
    bgcolor: '#FFFFFF',
    '& fieldset': { borderColor: '#B4B4B4' },
    '&:hover fieldset': { borderColor: '#94A3B8' },
    '& .MuiOutlinedInput-input': {
      py: 0.2,
      px: 0.4,
      fontSize: '0.75rem',
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
    },
  },
} as const;

/** 지연일수 등 읽기 전용 — 입력 TextField와 동일 규격 */
const gstInlineReadonlyFieldSx = {
  ...gstInlineFieldSx,
  '& .MuiOutlinedInput-root': {
    ...(gstInlineFieldSx as any)['& .MuiOutlinedInput-root'],
    bgcolor: '#FAFAFA',
    '&.Mui-disabled': {
      bgcolor: '#FAFAFA',
      '& fieldset': { borderColor: '#B4B4B4' },
    },
    '& .MuiOutlinedInput-input.Mui-disabled': {
      WebkitTextFillColor: '#0F172A',
      color: '#0F172A',
    },
  },
} as const;

const gstInlineRowLabelSx = {
  fontSize: '0.75rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  alignSelf: 'center',
  lineHeight: 1.2,
} as const;

const gstInlineModeBtnSx = {
  minWidth: 0,
  px: 0.4,
  py: 0,
  mt: 0.15,
  fontSize: '0.625rem',
  lineHeight: 1.2,
  textTransform: 'none',
  color: '#334155',
  whiteSpace: 'nowrap',
} as const;

/** (E)/(F) 구분용 — 연한 시트 배경 */
const GST_EF_ROW_BG = '#F3F8F3';
const GST_EF_ROW_LINE = '#C5D6C5';

const gstEfRowSx = {
  bgcolor: GST_EF_ROW_BG,
  '& > td': {
    bgcolor: `${GST_EF_ROW_BG} !important`,
    borderBottom: `1px solid ${GST_EF_ROW_LINE}`,
    verticalAlign: 'middle',
    py: 0.55,
  },
} as const;

const gstEfRowCellSx = {
  ...gstSummaryDataCellSx,
  verticalAlign: 'middle' as const,
  py: 0.9,
} as const;

const gstSummaryColGroup = (
  <colgroup>
    <col style={{ width: '4%' }} />
    <col style={{ width: GST_SUMMARY_DETAIL_COL_PERCENT }} />
    <col style={{ width: GST_SUMMARY_NUM_COL_PERCENT }} />
    <col style={{ width: GST_SUMMARY_NUM_COL_PERCENT }} />
    <col style={{ width: GST_SUMMARY_NUM_COL_PERCENT }} />
    <col style={{ width: GST_SUMMARY_NUM_COL_PERCENT }} />
  </colgroup>
);

/** 좌측 헤더·섹션 제목·항목명 공통 시작점 (테두리와 겹치지 않는 최소 여백) */
const EXPENSE_TEXT_PAD_LEFT = '6px';
/** KV 라벨 열 너비 (신청자·제목 등) */
const EXPENSE_KV_LABEL_WIDTH_PX = 128;

const sectionTitleSx = {
  fontWeight: 700,
  fontSize: '0.8125rem',
  color: '#0F172A',
  mb: 0.5,
  letterSpacing: '-0.01em',
  pl: EXPENSE_TEXT_PAD_LEFT,
  ml: 0,
  textAlign: 'left',
  textIndent: 0,
} as const;

const COMPACT_ROW_HEIGHT = 40;

const compactTableSx = {
  tableLayout: 'fixed',
  width: '100%',
  '& .MuiTableCell-root': {
    padding: '0 8px !important',
    height: COMPACT_ROW_HEIGHT,
    fontSize: '0.8125rem !important',
    lineHeight: '20px !important',
    borderBottom: `1px solid ${EXPENSE_LINE} !important`,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'left',
  },
  '& .MuiTableCell-root:first-child': {
    paddingLeft: `${EXPENSE_TEXT_PAD_LEFT} !important`,
    marginLeft: 0,
    textIndent: 0,
  },
  '& .MuiTableRow-root': {
    height: COMPACT_ROW_HEIGHT,
  },
} as const;

const wrapTwoLineSx = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  lineHeight: '20px',
  maxHeight: 40,
  fontSize: '0.8125rem',
} as const;

const wrapCellSx = {
  whiteSpace: 'normal !important',
  overflow: 'hidden',
  verticalAlign: 'middle',
  maxWidth: 0,
} as const;

const expenseAmountCellSx = {
  width: EXPENSE_TAX_AMOUNT_COL_WIDTH_PX,
  minWidth: EXPENSE_TAX_AMOUNT_COL_WIDTH_PX,
  maxWidth: EXPENSE_TAX_AMOUNT_COL_WIDTH_PX,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  overflow: 'visible',
  textOverflow: 'clip',
  // compact 기본 padding 단축속성을 덮어 오른쪽 끝 여백 확보
  padding: '0 20px 0 8px !important',
} as const;

const expenseItemsNumericGridSx = {
  display: 'grid',
  gridTemplateColumns: `minmax(0, 1fr) ${EXPENSE_ITEMS_QTY_COL_WIDTH_PX}px ${EXPENSE_ITEMS_UNIT_PRICE_COL_WIDTH_PX}px ${EXPENSE_TAX_AMOUNT_COL_WIDTH_PX}px`,
  width: '100%',
  alignItems: 'center',
} as const;

const expenseItemsNumericBlockCellSx = {
  width: EXPENSE_TAX_BOX_WIDTH_PX,
  minWidth: EXPENSE_TAX_BOX_WIDTH_PX,
  maxWidth: EXPENSE_TAX_BOX_WIDTH_PX,
  padding: '0 !important',
  verticalAlign: 'middle',
} as const;

const expenseItemsNumericHeaderCellSx = {
  textAlign: 'right',
  pl: 1,
  pr: 2.5,
  fontWeight: 600,
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
} as const;

const expenseItemsNumericValueCellSx = {
  textAlign: 'right',
  pl: 1,
  pr: 2.5,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
} as const;

const expenseItemsTableSx = {
  ...compactTableSx,
  '& .expense-pdf-items-numeric-block': expenseItemsNumericBlockCellSx,
  '& .expense-pdf-items-numeric-grid > *:nth-of-type(2), & .expense-pdf-items-numeric-grid > *:nth-of-type(3)':
    expenseItemsNumericValueCellSx,
  '& .expense-pdf-items-numeric-grid > *:nth-of-type(4)': {
    ...expenseItemsNumericValueCellSx,
    ...expenseAmountCellSx,
    width: EXPENSE_TAX_AMOUNT_COL_WIDTH_PX,
    minWidth: EXPENSE_TAX_AMOUNT_COL_WIDTH_PX,
    maxWidth: EXPENSE_TAX_AMOUNT_COL_WIDTH_PX,
  },
} as const;

const expenseTaxTableSx = {
  ...compactTableSx,
  tableLayout: 'fixed',
  width: '100%',
  '& .MuiTableCell-root': {
    ...compactTableSx['& .MuiTableCell-root'],
    overflow: 'visible',
    textOverflow: 'clip',
  },
  // 합계/최종합계처럼 colSpan으로 칸이 2개만 있을 때도 금액열 스타일 유지
  '& .MuiTableCell-root:nth-of-type(2):not(:last-child)': {
    width: EXPENSE_TAX_RATE_COL_WIDTH_PX,
    minWidth: EXPENSE_TAX_RATE_COL_WIDTH_PX,
    maxWidth: EXPENSE_TAX_RATE_COL_WIDTH_PX,
    textAlign: 'center',
  },
  '& .MuiTableCell-root:last-child': {
    ...expenseAmountCellSx,
    padding: '0 20px 0 8px !important',
  },
} as const;

const expenseTaxTableContainerSx = {
  border: `1px solid ${EXPENSE_LINE}`,
  borderRadius: '6px',
  width: '100%',
  // MUI TableContainer 기본 overflowX:auto + overflowX만 hidden 시
  // CSS 규약상 overflowY가 auto로 바뀌어 불필요 스크롤이 생김
  overflow: 'hidden',
} as const;

/** TDS 합계 박스 — 라벨 2줄이 ... 없이 들어가도록 기본 세금 박스보다 넓게 */
const EXPENSE_TDS_TAX_BOX_WIDTH_PX = 460;

const expenseTdsTaxBoxSx = {
  width: { xs: '100%', sm: EXPENSE_TDS_TAX_BOX_WIDTH_PX },
  minWidth: { xs: '100%', sm: EXPENSE_TDS_TAX_BOX_WIDTH_PX },
  maxWidth: '100%',
  ml: { xs: 0, sm: 'auto' },
  overflow: 'visible',
} as const;

/** TDS 합계(라벨+금액 2열) — 라벨은 줄바꿈 허용(말줄임 금지), 금액열만 고정 */
const expenseTdsTaxTableSx = {
  ...compactTableSx,
  tableLayout: 'fixed',
  width: '100%',
  '& .MuiTableRow-root': {
    height: 'auto',
  },
  '& .MuiTableCell-root': {
    ...compactTableSx['& .MuiTableCell-root'],
    height: 'auto !important',
    minHeight: 52,
    padding: '14px 12px !important',
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'clip',
    lineHeight: '22px !important',
  },
  '& .MuiTableCell-root:last-child': {
    ...expenseAmountCellSx,
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    padding: '14px 20px 14px 8px !important',
  },
} as const;

/** 세금/합계 박스 너비 */
const expenseTaxBoxWidthSx = {
  width: { xs: '100%', sm: EXPENSE_TAX_BOX_WIDTH_PX },
  minWidth: { xs: '100%', sm: EXPENSE_TAX_BOX_WIDTH_PX },
  maxWidth: '100%',
  overflow: 'visible',
} as const;

/** 세금/합계 박스 — 단독 우측 정렬 */
const expenseTaxAlignedBoxSx = {
  ...expenseTaxBoxWidthSx,
  ml: { xs: 0, sm: 'auto' },
} as const;

/** 지출 항목 아래 — 첨부(좌) + 세금/합계(우) */
const expenseDetailFooterRowSx = {
  display: 'flex',
  flexDirection: { xs: 'column', sm: 'row' },
  alignItems: { xs: 'stretch', sm: 'flex-start' },
  justifyContent: 'space-between',
  gap: { xs: 2, sm: 1.5 },
  width: '100%',
} as const;

const ClampText: React.FC<{ children: React.ReactNode; title?: string; sx?: object }> = ({
  children,
  title,
  sx,
}) => (
  <Box
    component="span"
    className="expense-clamp"
    title={title}
    sx={{ ...wrapTwoLineSx, fontWeight: 'inherit', color: 'inherit', ...sx }}
  >
    {children}
  </Box>
);

const kvLabelCellSx = {
  bgcolor: EXPENSE_MUTED_BG,
  color: '#64748B',
  fontWeight: 600,
  width: EXPENSE_KV_LABEL_WIDTH_PX,
  minWidth: EXPENSE_KV_LABEL_WIDTH_PX,
  maxWidth: EXPENSE_KV_LABEL_WIDTH_PX,
  pl: `${EXPENSE_TEXT_PAD_LEFT} !important`,
  textAlign: 'left',
  textIndent: 0,
  ml: 0,
  boxSizing: 'border-box',
} as const;

const vendorKvLabelCellSx = {
  ...kvLabelCellSx,
  bgcolor: `${EXPENSE_VENDOR_LABEL_BG} !important`,
  color: EXPENSE_HEADER_FG,
  fontWeight: 400,
} as const;

const voucherMetaWrapSx = {
  border: `1px solid ${EXPENSE_LINE}`,
  width: 'fit-content',
  maxWidth: '100%',
  display: 'grid',
  // 라벨 88px·값 영역 기준 가로 약 20% 확대
  gridTemplateColumns: `${EXPENSE_KV_LABEL_WIDTH_PX}px minmax(17ch, auto)`,
} as const;

const voucherMetaLabelSx = {
  pl: EXPENSE_TEXT_PAD_LEFT,
  pr: 1,
  py: 0.75,
  bgcolor: EXPENSE_MUTED_BG,
  color: '#64748B',
  fontWeight: 600,
  fontSize: '0.75rem',
  borderRight: `1px solid ${EXPENSE_LINE}`,
  whiteSpace: 'nowrap',
  textAlign: 'left',
  textIndent: 0,
} as const;

const voucherMetaValueSx = {
  px: 1,
  py: 0.75,
  fontWeight: 600,
  fontSize: '0.8125rem',
  color: '#0F172A',
  whiteSpace: 'nowrap',
} as const;

const EXPENSE_APPROVAL_STAMPS_PER_ROW = 4;

const chunkApprovalFlowNodes = <T,>(nodes: T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < nodes.length; i += size) {
    rows.push(nodes.slice(i, i + size));
  }
  return rows;
};

/** Payment Voucher 아래 결재란 — 4칸마다 다음 줄, 우측 정렬 */
const expenseApprovalStampsGridSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 1,
  width: 'max-content',
  maxWidth: '100%',
  boxSizing: 'border-box',
} as const;

const expenseApprovalStampsRowSx = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  width: 'max-content',
  maxWidth: '100%',
  boxSizing: 'border-box',
} as const;

const expenseApprovalStampWrapSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  flexShrink: 0,
  width: 'auto',
} as const;

/** 빈 검색 상태 최소폭 */
const EXPENSE_FLOW_STAMP_MIN_WIDTH = 96;
/** 작성 박스 — 이름 좌우 여유 */
const EXPENSE_PREPARED_STAMP_PAD_X = 1.5;
/** 작성 박스 가로 — 이름 폭 대비 배율 (추가 10% 확대) */
const EXPENSE_PREPARED_STAMP_WIDTH_SCALE = 1.21;
/** 승인 Autocomplete — 드롭다운(▼) 아이콘만 (clear X 없음) */
const EXPENSE_APPROVER_ADORNMENT_PX = 26;
/** 승인 입력 왼쪽 패딩 (우측 ▼ 아이콘 폭보다 좁게) */
const EXPENSE_APPROVER_PAD_LEFT_PX = 4;

/** 검색 가능한 승인자 중 가장 긴 이름 글자 수 */
function getLongestApproverNameChars(
  options: Array<{ id?: number; name?: string } | null | undefined>
): number {
  let max = 0;
  for (const opt of options) {
    const n = Array.from(String(opt?.name || '').trim()).length;
    if (n > max) max = n;
  }
  return max;
}

/**
 * 승인자 Autocomplete 가로폭 —
 * 검색 가능 사용자 중 가장 긴 이름을 기본 폭으로 사용 (선택 전에도 동일)
 */
function getExpenseApproverControlSx(longestNameChars: number) {
  const chars = Math.max(longestNameChars, 4);
  // 오른쪽은 ▼ 아이콘 폭, 왼쪽은 그보다 10% 좁혀 좌측 공백 축소
  const growWidth = `calc(${chars} * 0.55em + 10px + ${EXPENSE_APPROVER_PAD_LEFT_PX + EXPENSE_APPROVER_ADORNMENT_PX}px)`;
  return {
    width: growWidth,
    minWidth: growWidth,
    maxWidth: 'min(400px, 100%)',
    flexShrink: 0,
    margin: 0,
    '& .MuiAutocomplete-inputRoot': {
      flexWrap: 'nowrap',
      paddingLeft: `${EXPENSE_APPROVER_PAD_LEFT_PX}px !important`,
      paddingRight: `${EXPENSE_APPROVER_ADORNMENT_PX}px !important`,
      width: '100%',
      minHeight: 32,
      boxSizing: 'border-box',
      justifyContent: 'center',
    },
    '& .MuiAutocomplete-input': {
      width: '100% !important',
      minWidth: '0 !important',
      paddingLeft: '0 !important',
      paddingRight: '0 !important',
      textAlign: 'center',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
    },
    '& .MuiAutocomplete-endAdornment': {
      top: '50%',
      transform: 'translateY(-50%)',
      right: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      margin: 0,
    },
    '& .MuiAutocomplete-clearIndicator': {
      marginRight: '-2px',
      padding: '2px',
    },
    '& .MuiAutocomplete-popupIndicator': {
      marginRight: '-2px',
      padding: '2px',
    },
  } as const;
}

const expenseApproverAutocompleteSlotProps = {
  paper: {
    sx: {
      width: 'max-content',
      minWidth: 160,
      maxWidth: 'min(480px, 90vw)',
    },
  },
  listbox: {
    sx: {
      '& .MuiAutocomplete-option': {
        whiteSpace: 'nowrap',
      },
    },
  },
} as const;

const ExpenseFlowStamp = ({
  label,
  name,
  muted,
  wide,
  fluidWidth,
  relaxedLabel,
  children,
}: {
  label: string;
  name: string;
  muted?: boolean;
  wide?: boolean;
  fluidWidth?: boolean;
  relaxedLabel?: boolean;
  children?: React.ReactNode;
}) => (
  <Box
    className={`expense-flow-stamp${relaxedLabel ? ' expense-flow-stamp--relaxed-label' : ''}`}
    sx={{
      width: wide ? 222 : fluidWidth ? 'max-content' : 'max-content',
      minWidth: wide ? 222 : relaxedLabel ? 148 : EXPENSE_FLOW_STAMP_MIN_WIDTH,
      maxWidth: wide ? 222 : relaxedLabel || fluidWidth ? 'none' : 'max-content',
      flexShrink: 0,
      border: `1px solid ${EXPENSE_STAMP_LINE}`,
      borderRadius: EXPENSE_STAMP_RADIUS,
      bgcolor: '#FFFFFF',
      overflow: 'hidden',
      opacity: muted ? 0.65 : 1,
      display: 'flex',
      flexDirection: 'column',
      alignSelf: 'stretch',
    }}
  >
    <Box
      sx={{
        ...expenseStampHeaderSx,
        px: relaxedLabel ? 0.75 : 0.35,
        py: 0.35,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontSize: '0.75rem',
          color: EXPENSE_STAMP_LABEL,
          whiteSpace: relaxedLabel || !fluidWidth ? 'nowrap' : 'normal',
          lineHeight: 1.2,
          wordBreak: 'keep-all',
        }}
      >
        {label}
      </Typography>
    </Box>
    <Box
      sx={{
        minHeight: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pl: children ? 0.5 : EXPENSE_PREPARED_STAMP_PAD_X,
        pr: children ? 0.25 : EXPENSE_PREPARED_STAMP_PAD_X,
        width: '100%',
        minWidth: EXPENSE_FLOW_STAMP_MIN_WIDTH,
        boxSizing: 'border-box',
      }}
    >
      {children || (
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '0.8125rem',
            color: EXPENSE_STAMP_LABEL,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: fluidWidth ? 'visible' : 'hidden',
            textOverflow: fluidWidth ? 'clip' : 'ellipsis',
            maxWidth: fluidWidth ? 'none' : '100%',
            px: 0.5,
          }}
        >
          {name}
        </Typography>
      )}
    </Box>
  </Box>
);

const ExpenseListHeadCell = ({
  sortKey,
  activeKey,
  direction,
  onSort,
  children,
  sx,
}: {
  sortKey: ExpenseListSortKey;
  activeKey: ExpenseListSortKey | null;
  direction: 'asc' | 'desc';
  onSort: (key: ExpenseListSortKey) => void;
  children: React.ReactNode;
  sx?: object;
}) => (
  <TableCell sx={{ whiteSpace: 'nowrap', ...sx }}>
    <TableSortLabel
      active={activeKey === sortKey}
      direction={activeKey === sortKey ? direction : 'asc'}
      onClick={() => onSort(sortKey)}
      sx={{
        color: 'inherit',
        '&:hover': { color: 'inherit' },
        '&.Mui-active': { color: 'inherit' },
        '& .MuiTableSortLabel-icon': {
          color: 'inherit !important',
          fontSize: 14,
          opacity: activeKey === sortKey ? 1 : 0.35,
        },
      }}
    >
      {children}
    </TableSortLabel>
  </TableCell>
);

const ExpenseVoucherMetaTable = ({
  voucherNo,
  dateText,
  voucherLabel,
  dateLabel,
}: {
  voucherNo: React.ReactNode;
  dateText: string;
  voucherLabel: string;
  dateLabel: string;
}) => (
  <Box className="expense-pdf-voucher-meta" sx={voucherMetaWrapSx}>
    <Box sx={{ ...voucherMetaLabelSx, borderBottom: `1px solid ${EXPENSE_LINE}` }}>{voucherLabel}</Box>
    <Box sx={{ ...voucherMetaValueSx, borderBottom: `1px solid ${EXPENSE_LINE}` }}>{voucherNo}</Box>
    <Box sx={voucherMetaLabelSx}>{dateLabel}</Box>
    <Box sx={voucherMetaValueSx}>{dateText}</Box>
  </Box>
);

const ExpenseCompanyBlock = ({
  logo,
  logoAlt,
  name,
  address,
  gstNumber,
}: {
  logo?: string;
  logoAlt: string;
  name?: string;
  address?: string;
  gstNumber?: string;
}) => {
  if (!logo && !name && !address && !gstNumber) return null;
  return (
    <Box
      className="expense-pdf-company"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0.35,
        minWidth: 0,
        textAlign: 'left',
      }}
    >
      {logo ? (
        <AuthMedia
          src={logo}
          alt={logoAlt}
          sx={{
  display: 'block',
            alignSelf: 'flex-start',
            maxHeight: 36,
            maxWidth: 160,
            width: 'auto',
            objectFit: 'contain',
            objectPosition: 'left center',
          }}
        />
      ) : null}
      {name ? (
        <Typography
          className="expense-pdf-company-name"
          sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0F172A', lineHeight: 1.3 }}
        >
          {name}
        </Typography>
      ) : null}
      {address ? (
        <Typography
          className="expense-pdf-company-address"
          sx={{
            fontSize: '0.75rem',
            color: '#64748B',
            lineHeight: 1.35,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {formatEnglishSentenceLabel(address)}
        </Typography>
      ) : null}
      {gstNumber ? (
        <Typography sx={{ fontSize: '0.75rem', color: '#64748B', lineHeight: 1.35 }}>
          GSTIN: {gstNumber}
        </Typography>
      ) : null}
    </Box>
  );
};

const sectionBlockSx = {
  border: `1px solid ${EXPENSE_LINE}`,
  borderRadius: '6px',
  bgcolor: '#FFFFFF',
  overflow: 'hidden',
} as const;

const formatLocalYmd = (value?: Date | string | null) => {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const parsed = new Date(s);
    if (Number.isNaN(parsed.getTime())) return '';
    value = parsed;
  }
  const d = value as Date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** 파일명에서 Private Limited / Pvt Ltd 등 법인 접미사 항상 제거 */
const stripCorporateSuffixFromFilename = (value: string) =>
  String(value || '')
    .replace(/\bprivate\s+limited\b\.?/gi, '')
    .replace(/\bprivate\s+ltd\.?\b/gi, '')
    .replace(/\bpvt\.?\s*ltd\.?\b/gi, '')
    .replace(/\bpvt\.?\s*limited\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+\./g, '.')
    .trim();

/** 송금 확인증: yyyymmdd_RT (협력업체명) — 자사명이 아닌 대금 수취 협력업체 */
const buildRemittanceProofFileName = (
  file: File,
  opts?: { partnerName?: string }
) => {
  const fromName = String(file.name || '').split('.').pop() || '';
  const fromType = (file.type.split('/')[1] || 'png').replace(/^jpeg$/i, 'jpg');
  const ext = ((fromName.length <= 4 ? fromName : fromType)
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 4)
    .toLowerCase() || 'png').replace(/^jpeg$/, 'jpg');
  const partnerSource = stripCorporateSuffixFromFilename(
    String(opts?.partnerName || '')
      .replace(/[()（）\[\]【】]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
  return buildDocumentDownloadFilename({
    code: 'RT',
    companyName: partnerSource || 'Partner',
    omitDetail: true,
    extension: ext,
  });
};

const getFileExtension = (fileName: string) => {
  const base = String(fileName || '').split(/[/\\]/).pop() || '';
  const idx = base.lastIndexOf('.');
  if (idx <= 0 || idx === base.length - 1) return '';
  return base.slice(idx + 1);
};

/** UI 표시용 — 확장자 제외 */
const stripFileExtensionForDisplay = (fileName: string): string => {
  const base = String(fileName || '').split(/[/\\]/).pop() || String(fileName || '');
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return base;
  return base.slice(0, idx);
};

/** 확장자는 유지하고 표시 파일명만 변경 */
const renameFileKeepingExtension = (file: File, nextName: string): File => {
  const cleaned = stripCorporateSuffixFromFilename(
    String(nextName || '')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
  );
  if (!cleaned) return file;
  const ext = getFileExtension(file.name);
  const withoutExt = cleaned.replace(/\.[^.]+$/, '').trim() || cleaned;
  const finalName = ext ? `${withoutExt}.${ext}` : withoutExt;
  if (finalName === file.name) return file;
  return new File([file], finalName, { type: file.type, lastModified: file.lastModified });
};

const getTodayLocalYmd = () => formatLocalYmd(new Date());

/** 소수점 이하 자동 차감(내림/절삭) — 정수 금액만 사용 */
const floorMoney = (value: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n >= 0 ? Math.floor(n) : Math.ceil(n);
};

/** 수량·단가 등 소수 둘째 자리까지 반올림 */
const roundDecimal2 = (value: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

/** 합산액의 소수(파이사) 부분을 Discount로 분리하고 정수 합계를 반환 */
const splitAutoPaiseDiscount = (amount: number) => {
  const rounded = roundDecimal2(amount);
  const payable = floorMoney(rounded);
  const discount = roundDecimal2(rounded - payable);
  return {
    payable,
    discount: discount > 0 ? discount : 0,
  };
};

const formatAmount = (value: number) =>
  floorMoney(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const formatDecimal2 = (value: number) =>
  roundDecimal2(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const hasExpenseGstNumber = (value?: string | null) => {
  const s = String(value || '').replace(/\s/g, '').trim();
  return Boolean(s) && s !== '-';
};

/** 일반 전표: GST 번호가 있고 세율이 입력된 경우에만 GST 적용 */
const hasVoucherGstRates = (data: {
  formType: ExpenseFormType;
  gstNumber?: string;
  igstRate?: number;
  cgstRate?: number;
  sgstRate?: number;
  perLineGst?: boolean;
}) =>
  data.formType === 'general' &&
  hasExpenseGstNumber(data.gstNumber) &&
  !data.perLineGst &&
  (Number(data.igstRate || 0) > 0 ||
    Number(data.cgstRate || 0) > 0 ||
    Number(data.sgstRate || 0) > 0);

const calcVoucherGstAmount = (subtotal: number, rate: number) =>
  roundDecimal2(subtotal * (Number(rate || 0) / 100));

const getGstPeriodLabel = (referenceDate?: string, language?: string) => {
  const base = referenceDate ? new Date(`${referenceDate}T12:00:00`) : new Date();
  if (!Number.isFinite(base.getTime())) return '';
  const period = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  const year = period.getFullYear();
  if (language?.startsWith('ko')) {
    return `${period.getMonth() + 1}월 -${year}`;
  }
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'long' });
  return `${fmt.format(period)} -${year}`;
};

/** Professional Tax 행 라벨용 (예: August 26) */
const getGstPeriodShortLabel = (referenceDate?: string, language?: string) => {
  const base = referenceDate ? new Date(`${referenceDate}T12:00:00`) : new Date();
  if (!Number.isFinite(base.getTime())) return '';
  const period = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  const yy = String(period.getFullYear()).slice(-2);
  if (language?.startsWith('ko')) {
    return `${period.getMonth() + 1}월 ${yy}`;
  }
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'long' });
  return `${fmt.format(period)} ${yy}`;
};

const buildPaymentVoucherTitle = (kind: 'GST' | 'TDS', referenceDate?: string) => {
  const raw = String(referenceDate || '').slice(0, 10);
  const parsed = raw ? new Date(`${raw}T12:00:00`) : new Date();
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  return `${kind} Payment Voucher (${date.getFullYear()}년 ${date.getMonth() + 1}월)`;
};

const calcGstSummaryRowTotal = (item: Pick<ExpenseItem, 'igst' | 'cgst' | 'sgst'>) =>
  roundDecimal2(Number(item.igst || 0) + Number(item.cgst || 0) + Number(item.sgst || 0));

const applyGstSummaryRowRules = (item: ExpenseItem): ExpenseItem => {
  const next: ExpenseItem = { ...item };
  next.total = calcGstSummaryRowTotal(next);
  return next;
};

const calcGstSummaryColumnTotals = (
  items: ExpenseItem[],
  rowDefs: typeof GST_SUMMARY_ROW_DEFS = GST_MAIN_ROW_DEFS
) => {
  const raw = rowDefs.reduce(
    (acc, rowDef) => {
      const item =
        getGstLineByKey(items, rowDef.key) ||
        mapSavedGstSummaryItem({ id: `gst-${rowDef.key}` } as ExpenseItem, rowDef.key);
      acc.taxableValue += Number(item.taxableValue || 0);
      acc.igst += Number(item.igst || 0);
      acc.cgst += Number(item.cgst || 0);
      acc.sgst += Number(item.sgst || 0);
      acc.total +=
        rowDef.key === 'interest' || rowDef.key === 'lateFee'
          ? getGstExtraPayableAmount(item)
          : calcGstSummaryRowTotal(item);
      return acc;
    },
    { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, total: 0 }
  );
  return {
    taxableValue: roundDecimal2(raw.taxableValue),
    igst: roundDecimal2(raw.igst),
    cgst: roundDecimal2(raw.cgst),
    sgst: roundDecimal2(raw.sgst),
    total: roundDecimal2(raw.total),
  };
};

const getGstLineByKey = (items: ExpenseItem[], key: GstSummaryRowKey) =>
  items.find((item) => item.gstRowKey === key);

/** 일반 GST 현금 납부액 — ITC 상계 후 최소 0 (초과 ITC가 RCM/이자/연체료를 깎지 않음) */
const calcGstGeneralCashPayable = (items: ExpenseItem[]) => {
  const sale = calcGstSummaryRowTotal(getGstLineByKey(items, 'sale') || {});
  const inputCredit = calcGstSummaryRowTotal(getGstLineByKey(items, 'inputCredit') || {});
  const earlierCredit = calcGstSummaryRowTotal(getGstLineByKey(items, 'earlierCredit') || {});
  return roundDecimal2(Math.max(0, sale - inputCredit - earlierCredit));
};

/**
 * 총 납부액 = 일반 GST 현금(최소 0) + RCM(D) + 이자(E) + 연체료(F)
 */
const calcGstPayableAmount = (items: ExpenseItem[]) => {
  const generalCash = calcGstGeneralCashPayable(items);
  const rcm = calcGstSummaryRowTotal(getGstLineByKey(items, 'rcm') || {});
  const interest = getGstExtraPayableAmount(getGstLineByKey(items, 'interest'));
  const lateFee = getGstExtraPayableAmount(getGstLineByKey(items, 'lateFee'));
  return roundDecimal2(generalCash + rcm + interest + lateFee);
};

/** ITC 상계 후 일반 GST가 0이 된 경우(초과 공제) — remark 안내용 */
const isGstGeneralCashZeroedByItc = (items: ExpenseItem[]) => {
  const sale = calcGstSummaryRowTotal(getGstLineByKey(items, 'sale') || {});
  const inputCredit = calcGstSummaryRowTotal(getGstLineByKey(items, 'inputCredit') || {});
  const earlierCredit = calcGstSummaryRowTotal(getGstLineByKey(items, 'earlierCredit') || {});
  return sale - inputCredit - earlierCredit < 0;
};

/** GST payable(+RCM 클램프) + rounding, + Professional Tax */
const calcGstFinalPayable = (
  items: ExpenseItem[],
  roundingAdjustment = 0,
  professionalTax = 0
) =>
  roundDecimal2(
    calcGstPayableAmount(items) +
      Number(roundingAdjustment || 0) +
      Number(professionalTax || 0)
  );

const createGstSummaryLineItems = (): ExpenseItem[] =>
  GST_SUMMARY_ROW_ORDER.map((key) => {
    const base: ExpenseItem = {
      id: `gst-${key}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      invoiceDate: '',
      description: '',
      qty: 0,
      unitPrice: 0,
      total: 0,
      gstRowKey: key,
      taxableValue: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
    };
    if (key === 'interest') {
      const gstExtra = createDefaultInterestExtra();
      return { ...base, gstExtra, total: gstExtra.amount };
    }
    if (key === 'lateFee') {
      const gstExtra = createDefaultLateFeeExtra();
      return { ...base, gstExtra, total: gstExtra.amount, ...applyLateFeeHeadsFromAmount(0) };
    }
    return base;
  });

const normalizeInterestExtra = (raw: any): GstInterestExtra => {
  const base = createDefaultInterestExtra();
  if (!raw || typeof raw !== 'object') return base;
  return recomputeInterestExtra({
    ...base,
    unpaidAmount: nonNegDecimal(raw.unpaidAmount ?? raw.unpaid_amount),
    dueDate: String(raw.dueDate ?? raw.due_date ?? ''),
    plannedDate: String(raw.plannedDate ?? raw.planned_date ?? base.plannedDate),
    annualRatePercent: nonNegDecimal(raw.annualRatePercent ?? raw.annual_rate_percent ?? 18),
    amount: nonNegDecimal(raw.amount),
    amountMode: raw.amountMode === 'manual' || raw.amount_mode === 'manual' ? 'manual' : 'auto',
    calcAsOfDate: String(raw.calcAsOfDate ?? raw.calc_as_of_date ?? ''),
    delayDays: raw.delayDays ?? raw.delay_days ?? null,
    computedAmount:
      raw.computedAmount != null || raw.computed_amount != null
        ? nonNegDecimal(raw.computedAmount ?? raw.computed_amount)
        : null,
  });
};

const normalizeLateFeeExtra = (raw: any): GstLateFeeExtra => {
  const base = createDefaultLateFeeExtra();
  if (!raw || typeof raw !== 'object') return base;
  return recomputeLateFeeExtra({
    ...base,
    filingDueDate: String(raw.filingDueDate ?? raw.filing_due_date ?? ''),
    filingPlannedDate: String(
      raw.filingPlannedDate ?? raw.filing_planned_date ?? base.filingPlannedDate
    ),
    dailyFee: nonNegDecimal(raw.dailyFee ?? raw.daily_fee),
    capAmount: nonNegDecimal(raw.capAmount ?? raw.cap_amount),
    amount: nonNegDecimal(raw.amount),
    amountMode: raw.amountMode === 'manual' || raw.amount_mode === 'manual' ? 'manual' : 'auto',
    calcAsOfDate: String(raw.calcAsOfDate ?? raw.calc_as_of_date ?? ''),
    delayDays: raw.delayDays ?? raw.delay_days ?? null,
    computedAmount:
      raw.computedAmount != null || raw.computed_amount != null
        ? nonNegDecimal(raw.computedAmount ?? raw.computed_amount)
        : null,
  });
};

const mapSavedGstSummaryItem = (item: ExpenseItem, key?: GstSummaryRowKey): ExpenseItem => {
  const rowKey = (item.gstRowKey || key) as GstSummaryRowKey | undefined;
  let mapped: ExpenseItem = {
    id: item.id || `gst-${key || item.gstRowKey || 'row'}-${Date.now()}`,
    invoiceDate: '',
    description: item.description || '',
    qty: 0,
    unitPrice: 0,
    total: 0,
    gstRowKey: rowKey,
    taxableValue: roundDecimal2(Number(item.taxableValue || 0)),
    igst: roundDecimal2(Number(item.igst || 0)),
    cgst: roundDecimal2(Number(item.cgst || 0)),
    sgst: roundDecimal2(Number(item.sgst || 0)),
  };
  if (rowKey === 'interest') {
    const gstExtra = normalizeInterestExtra(item.gstExtra);
    // 저장본: 날짜 경과만으로 금액이 바뀌지 않도록 저장된 amount/delay 우선
    if (item.gstExtra && (item.gstExtra as GstInterestExtra).calcAsOfDate) {
      const saved = item.gstExtra as GstInterestExtra;
      mapped.gstExtra = {
        ...gstExtra,
        delayDays: saved.delayDays ?? gstExtra.delayDays,
        computedAmount:
          saved.computedAmount != null ? nonNegDecimal(saved.computedAmount) : gstExtra.computedAmount,
        amount: nonNegDecimal(saved.amount ?? gstExtra.amount),
        amountMode: saved.amountMode === 'manual' ? 'manual' : gstExtra.amountMode,
        calcAsOfDate: String(saved.calcAsOfDate || gstExtra.calcAsOfDate || ''),
      };
    } else {
      mapped.gstExtra = gstExtra;
    }
    mapped.total = getGstExtraPayableAmount(mapped);
  } else if (rowKey === 'lateFee') {
    const gstExtra = normalizeLateFeeExtra(item.gstExtra);
    if (item.gstExtra && (item.gstExtra as GstLateFeeExtra).calcAsOfDate) {
      const saved = item.gstExtra as GstLateFeeExtra;
      mapped.gstExtra = {
        ...gstExtra,
        delayDays: saved.delayDays ?? gstExtra.delayDays,
        computedAmount:
          saved.computedAmount != null ? nonNegDecimal(saved.computedAmount) : gstExtra.computedAmount,
        amount: nonNegDecimal(saved.amount ?? gstExtra.amount),
        amountMode: saved.amountMode === 'manual' ? 'manual' : gstExtra.amountMode,
        calcAsOfDate: String(saved.calcAsOfDate || gstExtra.calcAsOfDate || ''),
      };
    } else {
      mapped.gstExtra = gstExtra;
    }
    const amount = getGstExtraPayableAmount(mapped);
    mapped = {
      ...mapped,
      ...applyLateFeeHeadsFromAmount(amount),
      total: amount,
    };
  } else {
    mapped.total = calcGstSummaryRowTotal(mapped);
    mapped = applyGstSummaryRowRules(mapped);
  }
  return mapped;
};

const parseGstSummaryLineItems = (items: ExpenseItem[]): ExpenseItem[] => {
  if (items.some((item) => item.gstRowKey)) {
    return GST_SUMMARY_ROW_ORDER.map((key) => {
      const found = items.find((item) => item.gstRowKey === key);
      return found ? mapSavedGstSummaryItem(found, key) : mapSavedGstSummaryItem({ id: `gst-${key}` } as ExpenseItem, key);
    });
  }
  return createGstSummaryLineItems();
};

/** CGST/SGST 허용 세율(%) */
const ALLOWED_CGST_SGST_RATES = [2.5, 6, 9, 20] as const;
/** IGST 허용 세율(%) — 반쪽 세율의 2배 */
const ALLOWED_IGST_RATES = [5, 12, 18, 40] as const;

const normalizeAllowedHalfGstRate = (value: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return ALLOWED_CGST_SGST_RATES.find((rate) => Math.abs(rate - n) < 0.001) ?? 0;
};

const normalizeAllowedIgstRate = (value: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return ALLOWED_IGST_RATES.find((rate) => Math.abs(rate - n) < 0.001) ?? 0;
};

const formatGstRateOption = (rate: number) =>
  Number.isInteger(rate) ? String(rate) : rate.toFixed(1);

const normalizeVoucherGstRates = (data: {
  igstRate?: number;
  cgstRate?: number;
  sgstRate?: number;
}) => {
  const igstRate = normalizeAllowedIgstRate(Number(data.igstRate || 0));
  let cgstRate = normalizeAllowedHalfGstRate(Number(data.cgstRate || 0));
  let sgstRate = normalizeAllowedHalfGstRate(Number(data.sgstRate || 0));

  if (igstRate > 0) {
    return { igstRate, cgstRate: 0, sgstRate: 0 };
  }
  if (cgstRate > 0) {
    sgstRate = cgstRate;
  } else if (sgstRate > 0) {
    cgstRate = sgstRate;
  }
  return { igstRate: 0, cgstRate, sgstRate };
};

const normalizeLineItemGstRates = (item: Pick<ExpenseItem, 'igstRate' | 'cgstRate' | 'sgstRate'>) =>
  normalizeVoucherGstRates({
    igstRate: Number(item.igstRate || 0),
    cgstRate: Number(item.cgstRate || 0),
    sgstRate: Number(item.sgstRate || 0),
  });

const calcLineItemGstAmounts = (
  item: Pick<ExpenseItem, 'total' | 'amount' | 'igstRate' | 'cgstRate' | 'sgstRate'>
) => {
  const taxable = roundDecimal2(Number(item.total ?? item.amount ?? 0));
  const rates = normalizeLineItemGstRates(item);
  return {
    taxable,
    ...rates,
    igstAmount: calcVoucherGstAmount(taxable, rates.igstRate),
    cgstAmount: calcVoucherGstAmount(taxable, rates.cgstRate),
    sgstAmount: calcVoucherGstAmount(taxable, rates.sgstRate),
  };
};

const sumLineItemsGstAmounts = (items: ExpenseItem[]) =>
  items.reduce(
    (acc, item) => {
      const row = calcLineItemGstAmounts(item);
      acc.igstAmount = roundDecimal2(acc.igstAmount + row.igstAmount);
      acc.cgstAmount = roundDecimal2(acc.cgstAmount + row.cgstAmount);
      acc.sgstAmount = roundDecimal2(acc.sgstAmount + row.sgstAmount);
      return acc;
    },
    { igstAmount: 0, cgstAmount: 0, sgstAmount: 0 }
  );

const hasLineItemGstRates = (items: ExpenseItem[]) =>
  items.some((item) => {
    const rates = normalizeLineItemGstRates(item);
    return rates.igstRate > 0 || rates.cgstRate > 0 || rates.sgstRate > 0;
  });

const PRIORITY_SORT_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** 기본·상태 컬럼 정렬: 제출 → 검토 → 승인 → … */
const STATUS_SORT_ORDER: Record<string, number> = {
  submitted: 0,
  in_review: 1,
  approved: 2,
  awaiting_tax: 3,
  paid: 4,
  revision_rejected: 5,
  draft: 6,
  rejected: 7,
};

const paidStatusChipSx = {
  bgcolor: '#0E7490',
  color: '#FFFFFF',
  fontWeight: 600,
} as const;

type ExpenseListSortKey = 'createdAt' | 'title' | 'person' | 'amount' | 'status' | 'priority';

const looksLikeGstin = (value?: string | null) => {
  const gst = String(value || '').replace(/\s/g, '').toUpperCase();
  return /^\d{2}[A-Z0-9]{13}$/.test(gst);
};

const gstStateCode = (value?: string | null) => {
  const gst = String(value || '').replace(/\s/g, '').toUpperCase();
  if (!/^\d{2}/.test(gst)) return '';
  return gst.slice(0, 2);
};

const isSameUserId = (a?: number | string | null, b?: number | string | null) => {
  if (a == null || b == null || a === '' || b === '') return false;
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
};

const parseApprovalFlow = (value: any): ApprovalStep[] => {
  if (!value) return [];
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.rows)) return parsed.rows;
  return [];
};

const getExpenseFlowStampLabel = (step: ApprovalStep, translate: (key: string) => string) => {
  if (step.action === 'revision_rejected') {
    return translate('expenseApproval.flow.actions.revisionRejected');
  }
  if (step.action === 'rejected' || step.status === 'rejected') {
    return translate('expenseApproval.flow.actions.rejected');
  }
  if (step.action === 'edited') {
    return translate('expenseApproval.flow.actions.edited');
  }
  if (step.status === 'skipped') {
    return translate('expenseApproval.flow.actions.changed');
  }
  if (step.action === 'approved' || step.status === 'approved') {
    return translate('expenseApproval.voucher.approved');
  }
  if (step.status === 'pending') {
    return translate('expenseApproval.flow.status.pending');
  }
  return translate('expenseApproval.voucher.approved');
};

const isRevisionRejectedExpense = (expense: Pick<ExpenseApprovalItem, 'status' | 'itemMeta'>) =>
  expense.status === 'rejected' && expense.itemMeta?.revisionRejected === true;

const displayExpenseCurrency = (_currency?: string) => 'INR';

const readMetaNumber = (meta: Record<string, any> | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const raw = meta?.[key];
    if (raw !== undefined && raw !== null && raw !== '') {
      const num = Number(raw);
      if (Number.isFinite(num)) return num;
    }
  }
  return 0;
};

const calcExpenseTax = (
  items: Array<{
    total?: number;
    amount?: number;
    unitPrice?: number;
    qty?: number;
    tdsRate?: number;
    tdsAmount?: number;
    tdsInterest?: number;
    deducteeType?: string;
  }> | undefined,
  meta: Record<string, any> | undefined,
  companyGstNumber = '',
  companyGstState = ''
) => {
  const formType = resolveExpenseFormType(meta);
  const rows = items || [];

  if (formType === 'tds') {
    let gross = 0;
    let tdsSum = 0;
    let interestSum = 0;
    for (const item of rows) {
      const calc = calcTdsLineAmounts(item);
      gross += calc.base;
      tdsSum += effectiveTdsLineAmount(item);
      interestSum += calc.interest;
    }
    gross = floorMoney(gross);
    tdsSum = floorMoney(tdsSum);
    interestSum = floorMoney(interestSum);
    return {
      formType,
      subtotal: gross,
      igstRate: 0,
      cgstRate: 0,
      sgstRate: 0,
      tdsEnabled: true,
      tdsRate: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      tdsAmount: tdsSum,
      tdsInterestAmount: interestSum,
      tdsOtherDeducteeSum: sumTdsAmountByDeducteeType(rows, 'other'),
      tdsCompanyDeducteeSum: sumTdsAmountByDeducteeType(rows, 'company'),
      discountAmount: 0,
      grandTotal: tdsSum,
    };
  }

  if (formType === 'gst') {
    const roundingAdjustment = readMetaNumber(meta, 'gstRoundingAdjustment', 'gst_rounding_adjustment');
    const professionalTax = readMetaNumber(meta, 'gstProfessionalTax', 'gst_professional_tax');
    const payable = calcGstFinalPayable(rows as ExpenseItem[], roundingAdjustment, professionalTax);
    return {
      formType,
      subtotal: calcGstPayableAmount(rows as ExpenseItem[]),
      igstRate: 0,
      cgstRate: 0,
      sgstRate: 0,
      tdsEnabled: false,
      tdsRate: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      tdsAmount: 0,
      tdsInterestAmount: 0,
      discountAmount: 0,
      grandTotal: payable,
    };
  }

  const subtotal = roundDecimal2(
    rows.reduce((sum, item) => sum + Number(item.total ?? item.amount ?? 0), 0)
  );

  const igstRateMeta = readMetaNumber(meta, 'igstRate', 'igst_rate');
  const cgstRateMeta = readMetaNumber(meta, 'cgstRate', 'cgst_rate');
  const sgstRateMeta = readMetaNumber(meta, 'sgstRate', 'sgst_rate');
  const gstNumberMeta = String(meta?.gstNumber || meta?.gst_number || '').trim();
  const hasGstNumber = hasExpenseGstNumber(gstNumberMeta);
  const hasGstRatesInMeta =
    hasGstNumber && (igstRateMeta > 0 || cgstRateMeta > 0 || sgstRateMeta > 0);

  // GST 번호 없으면 GST 지급(세율·세액) 불가 — 저장된 세율이 있어도 0 처리
  if (formType === 'general' && !hasGstNumber) {
    const legacyTds = Boolean(meta?.tdsEnabled ?? meta?.tds_enabled);
    const tdsRate = legacyTds ? readMetaNumber(meta, 'tdsRate', 'tds_rate') : 0;
    const tdsAmount = legacyTds ? calcVoucherGstAmount(subtotal, tdsRate) : 0;
    const split = splitAutoPaiseDiscount(subtotal - tdsAmount);
    return {
      formType,
      subtotal,
      igstRate: 0,
      cgstRate: 0,
      sgstRate: 0,
      tdsEnabled: legacyTds,
      tdsRate,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      tdsAmount,
      tdsInterestAmount: 0,
      discountAmount: split.discount,
      grandTotal: split.payable,
      perLineGst: false,
    };
  }

  const perLineGst = Boolean(meta?.perLineGst ?? meta?.per_line_gst);
  if (formType === 'general' && perLineGst) {
    const summed = sumLineItemsGstAmounts(rows as ExpenseItem[]);
    const legacyTds = Boolean(meta?.tdsEnabled ?? meta?.tds_enabled);
    const tdsRate = legacyTds ? readMetaNumber(meta, 'tdsRate', 'tds_rate') : 0;
    const tdsAmount = legacyTds ? calcVoucherGstAmount(subtotal, tdsRate) : 0;
    const split = splitAutoPaiseDiscount(
      subtotal + summed.igstAmount + summed.cgstAmount + summed.sgstAmount - tdsAmount
    );
    return {
      formType: 'general' as ExpenseFormType,
      subtotal,
      igstRate: 0,
      cgstRate: 0,
      sgstRate: 0,
      tdsEnabled: legacyTds,
      tdsRate,
      igstAmount: summed.igstAmount,
      cgstAmount: summed.cgstAmount,
      sgstAmount: summed.sgstAmount,
      tdsAmount,
      tdsInterestAmount: 0,
      discountAmount: split.discount,
      grandTotal: split.payable,
      perLineGst: true,
    };
  }

  if (formType === 'general' && !hasGstRatesInMeta) {
    const legacyTds = Boolean(meta?.tdsEnabled ?? meta?.tds_enabled);
    const tdsRate = legacyTds ? readMetaNumber(meta, 'tdsRate', 'tds_rate') : 0;
    const tdsAmount = legacyTds ? calcVoucherGstAmount(subtotal, tdsRate) : 0;
    const split = splitAutoPaiseDiscount(subtotal - tdsAmount);
    return {
      formType,
      subtotal,
      igstRate: 0,
      cgstRate: 0,
      sgstRate: 0,
      tdsEnabled: legacyTds,
      tdsRate,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      tdsAmount,
      tdsInterestAmount: 0,
      discountAmount: split.discount,
      grandTotal: split.payable,
    };
  }

  if (formType === 'general' && hasGstRatesInMeta) {
    const igstAmount = calcVoucherGstAmount(subtotal, igstRateMeta);
    const cgstAmount = calcVoucherGstAmount(subtotal, cgstRateMeta);
    const sgstAmount = calcVoucherGstAmount(subtotal, sgstRateMeta);
    const legacyTds = Boolean(meta?.tdsEnabled ?? meta?.tds_enabled);
    const tdsRate = legacyTds ? readMetaNumber(meta, 'tdsRate', 'tds_rate') : 0;
    const tdsAmount = legacyTds ? calcVoucherGstAmount(subtotal, tdsRate) : 0;
    const split = splitAutoPaiseDiscount(subtotal + igstAmount + cgstAmount + sgstAmount - tdsAmount);
    return {
      formType: 'general' as ExpenseFormType,
      subtotal,
      igstRate: igstRateMeta,
      cgstRate: cgstRateMeta,
      sgstRate: sgstRateMeta,
      tdsEnabled: legacyTds,
      tdsRate,
      igstAmount,
      cgstAmount,
      sgstAmount,
      tdsAmount,
      tdsInterestAmount: 0,
      discountAmount: split.discount,
      grandTotal: split.payable,
    };
  }

  let igstRate = igstRateMeta;
  let cgstRate = cgstRateMeta;
  let sgstRate = sgstRateMeta;
  const legacyTds = Boolean(meta?.tdsEnabled ?? meta?.tds_enabled);
  const tdsRate = legacyTds ? readMetaNumber(meta, 'tdsRate', 'tds_rate') : 0;
  // meta에 저장된 세율만 사용 — GSTIN 기준으로 자동 추론하지 않음
  const igstAmount = calcVoucherGstAmount(subtotal, igstRate);
  const cgstAmount = calcVoucherGstAmount(subtotal, cgstRate);
  const sgstAmount = calcVoucherGstAmount(subtotal, sgstRate);
  const tdsAmount = roundDecimal2(subtotal * (tdsRate / 100));
  const split = splitAutoPaiseDiscount(subtotal + igstAmount + cgstAmount + sgstAmount - tdsAmount);
  return {
    formType,
    subtotal,
    igstRate,
    cgstRate,
    sgstRate,
    tdsEnabled: legacyTds,
    tdsRate,
    igstAmount,
    cgstAmount,
    sgstAmount,
    tdsAmount,
    tdsInterestAmount: 0,
    discountAmount: split.discount,
    grandTotal: split.payable,
  };
};

const pickGstNumberList = (raw: any): string[] => {
  const list = Array.isArray(raw?.gst_numbers)
    ? raw.gst_numbers
    : Array.isArray(raw?.data?.gst_numbers)
      ? raw.data.gst_numbers
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw)
          ? raw
          : [];
  return list
    .map((item: any) => String(typeof item === 'string' ? item : item?.gst_number || '').trim())
    .filter(Boolean);
};

const pickPartnerGstNumber = (partner: {
  gstNumbers?: string[];
  business_number?: string;
}) => {
  const fromList = (partner.gstNumbers || [])
    .map((item) => String(item || '').trim())
    .find(Boolean);
  if (fromList) return fromList;
  const biz = String(partner.business_number || '').trim();
  return looksLikeGstin(biz) ? biz : '';
};

const pickCompanyGstNumber = (company: any) => {
  if (!company) return '';
  const list = Array.isArray(company.gst_numbers)
    ? company.gst_numbers
    : Array.isArray(company.gstNumbers)
      ? company.gstNumbers
      : [];
  const fromList = list
    .map((item: any) => String(typeof item === 'string' ? item : item?.gst_number || '').trim())
    .find(Boolean);
  if (fromList) return fromList;
  const biz = String(company.business_number || '').trim();
  return looksLikeGstin(biz) ? biz : '';
};

const ExpenseApproval: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { user } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const menuFlags = usePageMenuPermission(EXPENSE_APPROVAL_MENU_ROUTES);
  const createGuard = useMenuActionGuard('create', EXPENSE_APPROVAL_MENU_ROUTES);
  const editGuard = useMenuActionGuard('edit', EXPENSE_APPROVAL_MENU_ROUTES);
  const deleteGuard = useMenuActionGuard('delete', EXPENSE_APPROVAL_MENU_ROUTES);
  const isRootUser = user?.role === 'root';
  const isAuditUser = user?.role === 'audit';
  const canViewAllCompanies = isRootUser || isAuditUser;
  const hasTransferAccess = Boolean(user?.is_payment_officer) || isRootUser;
  const resolveDefaultCompanyFilterId = useCallback(
    (options: Array<{ id: number; name: string }> = []): number | '' => {
      const minsub = options.find((company) => {
        const name = stripCorporateSuffixFromFilename(company.name)
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
        return name === 'minsub ventures' || name.startsWith('minsub ventures ');
      });
      if (minsub && minsub.id > 0) return minsub.id;
      const userCompanyId = Number(user?.company_id);
      return Number.isFinite(userCompanyId) && userCompanyId > 0 ? userCompanyId : '';
    },
    [user?.company_id]
  );
  const [expenses, setExpenses] = useState<ExpenseApprovalItem[]>([]);
  const [, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const warnDigitsOnlyField = useCallback(
    (raw: string, fieldLabelKey: string) => {
      if (!hasNonDigitInput(raw)) return;
      showErrorPopup(
        t('errors.digitsOnlyField', { field: t(fieldLabelKey) }),
        undefined,
        'warning'
      );
    },
    [t]
  );
  /** '' | draftCreated — render with t() for i18n */
  const [headerStatusBanner, setHeaderStatusBanner] = useState<'' | 'draftCreated'>('');
  /** 작성·초안 수정 중 자동 저장 상태 */
  const [autoSaveHint, setAutoSaveHint] = useState<'' | 'saving' | 'saved' | 'failed'>('');
  const [isInitializingDraft, setIsInitializingDraft] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseApprovalItem | null>(null);
  const expensePdfRef = useRef<HTMLDivElement | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'view' | 'create' | 'edit'>('list');
  const [listTab, setListTab] = useState<'received' | 'written' | 'transfer'>('received');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(DEFAULT_LIST_STATUS_FILTER);
  /** 송금 탭 상태 필터(다중). 빈 배열 = 전체 */
  const [transferStatusFilters, setTransferStatusFilters] = useState<string[]>(() =>
    defaultTransferStatusFiltersForTab()
  );
  const [priorityFilter, setPriorityFilter] = useState('');
  /** 상단 KPI 합산 기준 월 (YYYY-MM). 전표일(voucherDate) 우선, 없으면 작성일 */
  const [summaryMonth, setSummaryMonth] = useState(() => getTodayLocalYmd().slice(0, 7));
  const [companyFilterId, setCompanyFilterId] = useState<number | ''>('');
  /** 이번 화면에서 사용자가 회사를 고르기 전까지만 기본값(Minsub Ventures)을 넣는다. 새로고침하면 다시 초기화된다. */
  const companyFilterInitializedRef = useRef(false);
  const [companyOptions, setCompanyOptions] = useState<Array<{ id: number; name: string }>>([]);
  /** root/audit: 필터 회사 → 열람 중인 문서 회사 → 로그인 회사. 일반 사용자: 로그인 회사 */
  const effectiveCompanyId = useMemo(() => {
    if (canViewAllCompanies) {
      const fromExpense = Number(selectedExpense?.companyId);
      if (
        (viewMode === 'view' || viewMode === 'edit') &&
        Number.isFinite(fromExpense) &&
        fromExpense > 0
      ) {
        return fromExpense;
      }
      if (typeof companyFilterId === 'number' && companyFilterId > 0) return companyFilterId;
      // 전체 회사 선택 시에도 작성·초안은 로그인 회사 기준으로 진행
      const fromUser = Number(user?.company_id);
      return Number.isFinite(fromUser) && fromUser > 0 ? fromUser : 0;
    }
    const fromUser = Number(user?.company_id);
    return Number.isFinite(fromUser) && fromUser > 0 ? fromUser : 0;
  }, [canViewAllCompanies, user?.company_id, companyFilterId, selectedExpense?.companyId, viewMode]);
  const [listSortKey, setListSortKey] = useState<ExpenseListSortKey | null>(null);
  const [listSortDir, setListSortDir] = useState<'asc' | 'desc'>('asc');
  const [listViewMode, setListViewMode] = useState<'page' | 'all'>('page');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [companyLogo, setCompanyLogo] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyGstNumber, setCompanyGstNumber] = useState('');
  const [companyGstState, setCompanyGstState] = useState('');
  const todayDate = useMemo(() => getTodayLocalYmd(), []);
  const [formData, setFormData] = useState({
    title: '',
    purpose: '',
    currency: 'INR',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    dueDate: getTodayLocalYmd(),
    notes: ''
  });
  const [lineItems, setLineItems] = useState<ExpenseItem[]>([]);
  const [currentAttachments, setCurrentAttachments] = useState<ExpenseAttachment[]>([]);
  const [deletingReceiptPath, setDeletingReceiptPath] = useState<string | null>(null);
  const [approvers, setApprovers] = useState<Array<{ id: number; name: string }>>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [partnerScopeEnforced, setPartnerScopeEnforced] = useState(false);
  const [partnerLoadError, setPartnerLoadError] = useState(false);
  const [partnerInputValue, setPartnerInputValue] = useState('');
  const [voucherData, setVoucherData] = useState({
    formType: 'general' as ExpenseFormType,
    department: '',
    partnerId: '',
    voucherNo: '',
    gstNumber: '',
    voucherDate: getTodayLocalYmd(),
    partnerRepresentative: '',
    partnerAddress: '',
    partnerPhone: '',
    partnerEmail: '',
    partnerPan: '',
    acHolder: '',
    bank: '',
    accountNumber: '',
    ifsc: '',
    paymentDate: '',
    paymentStatus: '',
    amountInWords: '',
    remarks: '',
    checkedById: '',
    approvedById: '',
    igstRate: 0,
    cgstRate: 0,
    sgstRate: 0,
    tdsEnabled: false,
    tdsRate: 0,
    gstRoundingAdjustment: 0,
    gstProfessionalTax: 0,
    perLineGst: false,
    /** Proforma 선지출 — 승인 시 송금 탭 생략 */
    isPrepaid: false,
    /** 인보이스 없음 — Tax Invoice 없이 종료 가능 */
    noInvoice: false,
    invoiceMode: 'tax' as ExpenseInvoiceType,
  });
  const [ccUserIds, setCcUserIds] = useState<number[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState('');
  const [qrImageError, setQrImageError] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const [previewDownloadName, setPreviewDownloadName] = useState('');
  const [receiptInvoiceType, setReceiptInvoiceType] = useState<ExpenseInvoiceType>('tax');
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadError, setPreviewLoadError] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreviewUrl, setPaymentProofPreviewUrl] = useState<string>('');
  const [proofNameDraft, setProofNameDraft] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  /** 초안 생성 중복 방지 (의존성 루프/StrictMode 대비) */
  const draftInitInFlightRef = useRef(false);
  /** ensureDraftReady 대기 중 최신 draftId (state 클로저 우회) */
  const draftIdReadyRef = useRef<number | null>(null);
  const submitInFlightRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveSeqRef = useRef(0);
  const lastAutoSavedJsonRef = useRef('');
  /** 수정 화면 진입 직후 자동 저장 스킵 */
  const autoSaveSkipUntilRef = useRef(0);
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const [uploadingReceipts, setUploadingReceipts] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reasonDialogType, setReasonDialogType] = useState<
    'payment-approve' | 'payment-reject' | 'expense-reject' | 'expense-revision-reject' | 'expense-edit'
  >('payment-approve');
  const [reasonText, setReasonText] = useState('');
  const [reasonTargetId, setReasonTargetId] = useState<number | null>(null);
  const [approverSaving, setApproverSaving] = useState(false);
  const [expenseCommentDraft, setExpenseCommentDraft] = useState('');
  const [expenseCommentReplyTo, setExpenseCommentReplyTo] = useState<number | null>(null);
  const [expenseCommentReplyDraft, setExpenseCommentReplyDraft] = useState('');
  const [expenseCommentEditingId, setExpenseCommentEditingId] = useState<number | null>(null);
  const [expenseCommentEditDraft, setExpenseCommentEditDraft] = useState('');
  const [expenseCommentSubmitting, setExpenseCommentSubmitting] = useState(false);
  const parseExpenseItems = (value: any) => {
    if (!value) return { rows: [], meta: {} };
    let parsed = value;
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch {
        return { rows: [], meta: {} };
      }
    }
    if (Array.isArray(parsed)) {
      return { rows: parsed, meta: {} };
    }
    if (typeof parsed === 'object') {
      const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
      const meta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
      return { rows, meta };
    }
    return { rows: [], meta: {} };
  };

  const mapExpense = (expense: any): ExpenseApprovalItem => {
    const parsedItems = parseExpenseItems(expense.items);
    const parsedComments = parseExpenseReportComments(expense.comments);
    const parsedLastCommentAt = getExpenseLastCommentAt(parsedComments);
    return {
    id: expense.id,
    expenseId: expense.expense_id || '',
    title: expense.title || '',
    requesterId: expense.requester_id,
    requesterName: expense.requester_name || '',
    requesterDepartment: expense.requester_department || '',
    requesterPosition: expense.requester_position || '',
    totalAmount: parseFloat(expense.total_amount || 0),
    currency: displayExpenseCurrency(expense.currency),
    purpose: expense.purpose || '',
    items: parsedItems.rows,
    status: expense.status || 'draft',
    priority: expense.priority || 'medium',
    currentApproverId: expense.current_approver_id,
    currentApproverName: expense.current_approver_name,
    approvalFlow: parseApprovalFlow(expense.approval_flow),
    ccUserIds: Array.isArray(expense.cc_user_ids)
      ? Array.from(
          new Set(
            expense.cc_user_ids
              .map((x: any) => Number(x))
              .filter((n: number) => Number.isInteger(n) && n > 0)
          )
        )
      : [],
    submittedAt: expense.submitted_at || '',
    dueDate: expense.due_date || '',
    notes: expense.notes || '',
    attachments: normalizeExpenseAttachments(expense.attachments),
    comments: parsedComments,
    commentCount: Math.max(Number(expense.comment_count) || 0, countExpenseComments(parsedComments)),
    lastCommentAt:
      String(expense.last_comment_at || '').trim() ||
      (parsedLastCommentAt > 0 ? new Date(parsedLastCommentAt).toISOString() : ''),
    hasUnreadComments: Boolean(expense.has_unread_comments),
    itemMeta: parsedItems.meta,
    approvalId: expense.approval_id || undefined,
    paymentRequestStatus: expense.payment_request_status || undefined,
    paidAmount: Number(expense.paid_amount || 0),
    paymentRequestedAt: expense.payment_requested_at || '',
    paymentCompletedAt: expense.payment_completed_at || '',
    paymentApprovedReason: expense.payment_approved_reason || '',
    paymentApprovedAt: expense.payment_approved_at || '',
    paymentApprovedBy: expense.payment_approved_by || undefined,
    paymentRejectedReason: expense.payment_rejected_reason || '',
    paymentRejectedAt: expense.payment_rejected_at || '',
    paymentRejectedBy: expense.payment_rejected_by || undefined,
    bankTransferProvider: expense.bank_transfer_provider || undefined,
    bankTransferStatus: expense.bank_transfer_status || undefined,
    bankTransferReference: expense.bank_transfer_reference || undefined,
    bankTransferError: expense.bank_transfer_error || undefined,
    bankTransferLogs: Array.isArray(expense.bank_transfer_logs) ? expense.bank_transfer_logs : [],
    remittanceHistory: Array.isArray(expense.remittance_history) ? expense.remittance_history : [],
    companyId: Number(expense.company_id || 0) || undefined,
    companyName: String(expense.company_name || expense.companyName || '').trim() || undefined,
    createdAt: expense.created_at || expense.createdAt || parsedItems.meta?.voucherDate || '',
    updatedAt: expense.updated_at || expense.updatedAt || ''
    };
  };

  const subtotalAmount = useMemo(() => {
    if (voucherData.formType === 'tds') {
      return floorMoney(
        lineItems.reduce((sum, item) => sum + calcTdsLineAmounts(item).base, 0)
      );
    }
    if (voucherData.formType === 'gst') {
      return calcGstFinalPayable(
        lineItems,
        voucherData.gstRoundingAdjustment,
        voucherData.gstProfessionalTax
      );
    }
    return roundDecimal2(lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0));
  }, [lineItems, voucherData.formType]);
  const igstAmount = useMemo(() => {
    if (voucherData.formType !== 'general') return 0;
    if (voucherData.perLineGst) return sumLineItemsGstAmounts(lineItems).igstAmount;
    return hasVoucherGstRates(voucherData)
      ? calcVoucherGstAmount(subtotalAmount, voucherData.igstRate)
      : 0;
  }, [subtotalAmount, voucherData, lineItems]);
  const cgstAmount = useMemo(() => {
    if (voucherData.formType !== 'general') return 0;
    if (voucherData.perLineGst) return sumLineItemsGstAmounts(lineItems).cgstAmount;
    return hasVoucherGstRates(voucherData)
      ? calcVoucherGstAmount(subtotalAmount, voucherData.cgstRate)
      : 0;
  }, [subtotalAmount, voucherData, lineItems]);
  const sgstAmount = useMemo(() => {
    if (voucherData.formType !== 'general') return 0;
    if (voucherData.perLineGst) return sumLineItemsGstAmounts(lineItems).sgstAmount;
    return hasVoucherGstRates(voucherData)
      ? calcVoucherGstAmount(subtotalAmount, voucherData.sgstRate)
      : 0;
  }, [subtotalAmount, voucherData, lineItems]);
  /** 회사·협력업체 GSTIN 앞 2자리(주 코드) 비교 → 주내 CGST/SGST, 주간 IGST */
  const partnerGstStateCode = useMemo(
    () => gstStateCode(voucherData.gstNumber),
    [voucherData.gstNumber]
  );
  const effectiveCompanyGstState = useMemo(
    () => companyGstState || gstStateCode(companyGstNumber),
    [companyGstState, companyGstNumber]
  );
  const canCompareGstStates = Boolean(partnerGstStateCode && effectiveCompanyGstState);
  const isIntraStateGst =
    canCompareGstStates && partnerGstStateCode === effectiveCompanyGstState;
  const isInterStateGst =
    canCompareGstStates && partnerGstStateCode !== effectiveCompanyGstState;
  /** 회사 GST 주 코드를 모르면 주내/주간을 강제하지 않고 둘 다 입력 가능 */
  const hasPartnerGstin = hasExpenseGstNumber(voucherData.gstNumber);
  const canEnterIgst = hasPartnerGstin && (!canCompareGstStates || isInterStateGst);
  const canEnterCgstSgst = hasPartnerGstin && (!canCompareGstStates || isIntraStateGst);

  // 주 코드가 바뀌면 비활성 세율은 0으로 정리
  useEffect(() => {
    if (voucherData.formType !== 'general') return;
    if (!hasExpenseGstNumber(voucherData.gstNumber) || !canCompareGstStates) return;
    if (isIntraStateGst) {
      setVoucherData((prev) =>
        Number(prev.igstRate || 0) === 0 ? prev : { ...prev, igstRate: 0 }
      );
      if (voucherData.perLineGst) {
        setLineItems((prev) =>
          prev.map((item) =>
            Number(item.igstRate || 0) === 0 ? item : { ...item, igstRate: 0 }
          )
        );
      }
        return;
      }
    if (isInterStateGst) {
      setVoucherData((prev) =>
        Number(prev.cgstRate || 0) === 0 && Number(prev.sgstRate || 0) === 0
          ? prev
          : { ...prev, cgstRate: 0, sgstRate: 0 }
      );
      if (voucherData.perLineGst) {
        setLineItems((prev) =>
          prev.map((item) =>
            Number(item.cgstRate || 0) === 0 && Number(item.sgstRate || 0) === 0
              ? item
              : { ...item, cgstRate: 0, sgstRate: 0 }
          )
        );
      }
    }
  }, [
    voucherData.formType,
    voucherData.gstNumber,
    voucherData.perLineGst,
    canCompareGstStates,
    isIntraStateGst,
    isInterStateGst,
  ]);

  useEffect(() => {
    if (voucherData.formType !== 'general') return;
    if (hasExpenseGstNumber(voucherData.gstNumber)) return;
    if (!voucherData.perLineGst) return;
    setVoucherData((prev) => ({ ...prev, perLineGst: false }));
    setLineItems((prev) =>
      prev.map((item) => ({ ...item, igstRate: 0, cgstRate: 0, sgstRate: 0 }))
    );
  }, [voucherData.formType, voucherData.gstNumber, voucherData.perLineGst]);

  const tdsAmount = useMemo(() => {
    if (voucherData.formType === 'tds') {
      return floorMoney(
        lineItems.reduce((sum, item) => sum + effectiveTdsLineAmount(item), 0)
      );
    }
    // 일반 전표: TDS 적용 시 합계(A) 기준으로 계산 (GST 세율 유무와 무관)
    if (voucherData.formType === 'general' && voucherData.tdsEnabled) {
      return calcVoucherGstAmount(subtotalAmount, voucherData.tdsRate);
    }
    return 0;
  }, [lineItems, subtotalAmount, voucherData]);
  const tdsOtherDeducteeSum = useMemo(
    () =>
      voucherData.formType === 'tds' ? sumTdsAmountByDeducteeType(lineItems, 'other') : 0,
    [lineItems, voucherData.formType]
  );
  const tdsCompanyDeducteeSum = useMemo(
    () =>
      voucherData.formType === 'tds' ? sumTdsAmountByDeducteeType(lineItems, 'company') : 0,
    [lineItems, voucherData.formType]
  );
  const totalAmount = useMemo(() => {
    if (voucherData.formType === 'tds') {
      return tdsAmount;
    }
    if (voucherData.formType === 'gst') {
      return calcGstFinalPayable(
        lineItems,
        voucherData.gstRoundingAdjustment,
        voucherData.gstProfessionalTax
      );
    }
    if (
      voucherData.formType === 'general' &&
      !hasVoucherGstRates(voucherData) &&
      !(voucherData.perLineGst && hasLineItemGstRates(lineItems)) &&
      !voucherData.tdsEnabled
    ) {
      return splitAutoPaiseDiscount(subtotalAmount).payable;
    }
    return splitAutoPaiseDiscount(
      subtotalAmount + igstAmount + cgstAmount + sgstAmount - tdsAmount
    ).payable;
  }, [
    voucherData,
    lineItems,
    subtotalAmount,
    igstAmount,
    cgstAmount,
    sgstAmount,
    tdsAmount,
  ]);

  const autoDiscountAmount = useMemo(() => {
    if (voucherData.formType !== 'general') return 0;
    if (
      !hasVoucherGstRates(voucherData) &&
      !(voucherData.perLineGst && hasLineItemGstRates(lineItems)) &&
      !voucherData.tdsEnabled
    ) {
      return splitAutoPaiseDiscount(subtotalAmount).discount;
    }
    return splitAutoPaiseDiscount(
      subtotalAmount + igstAmount + cgstAmount + sgstAmount - tdsAmount
    ).discount;
  }, [
    voucherData,
    lineItems,
    subtotalAmount,
    igstAmount,
    cgstAmount,
    sgstAmount,
    tdsAmount,
  ]);

  const loadExpenseData = useCallback(async () => {
    setLoading(true);
    // 탭/회사 필터 변경 직후 이전 목록이 한 프레임 보이는 깜빡임 방지
    setExpenses([]);
    try {
      const params: Record<string, number> = {};
      if (canViewAllCompanies && companyFilterId) {
        params.company_id = Number(companyFilterId);
      }
      const response = await accountingService.getExpenseReports(params);
      if (response.success) {
        const list = Array.isArray(response.data) ? response.data : [];
        setExpenses(list.map((row: any) => mapExpense(row)));
      } else {
        setExpenses([]);
        setError(response.message || t('expenseApproval.errors.loadFailed'));
      }
    } catch {
      setError(t('expenseApproval.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  // mapExpense is a render-local mapper; listing it would refetch on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stable mapping helper
  }, [t, canViewAllCompanies, companyFilterId]);

  /** 상세 화면 유지한 채 목록만 갱신 (빈 목록 깜빡임 없음) */
  const refreshExpenseListQuietly = useCallback(async () => {
    try {
      const params: Record<string, number> = {};
      if (canViewAllCompanies && companyFilterId) {
        params.company_id = Number(companyFilterId);
      }
      const response = await accountingService.getExpenseReports(params);
      if (response.success) {
        const list = Array.isArray(response.data) ? response.data : [];
        setExpenses(list.map((row: any) => mapExpense(row)));
      }
    } catch {
      /* 기존 목록 유지 */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stable mapping helper
  }, [canViewAllCompanies, companyFilterId]);

  /**
   * mutation 성공 후 목록·상세 동기화 (F5 없이 반영).
   * - refreshList: 목록 quiet refresh
   * - syncDetail: 열려 있는 상세가 해당 id면 서버 단건으로 교체
   * - clearSelection: 상세 닫고 목록으로
   */
  const syncExpenseAfterMutation = useCallback(
    async (
      id: number,
      opts?: { refreshList?: boolean; syncDetail?: boolean; clearSelection?: boolean }
    ) => {
      const refreshList = opts?.refreshList !== false;
      const syncDetail = opts?.syncDetail !== false;
      if (opts?.clearSelection) {
        setSelectedExpense(null);
        setViewMode('list');
      }
      if (refreshList) {
        await refreshExpenseListQuietly();
      }
      if (opts?.clearSelection || !syncDetail) return;
      try {
        const response = await accountingService.getExpenseReport(id);
        if (!response?.success || !response.data) return;
        const mapped = mapExpense(response.data);
        setSelectedExpense((prev) => (prev?.id === id ? mapped : prev));
        setExpenses((prev) => {
          const idx = prev.findIndex((item) => item.id === id);
          if (idx < 0) return prev;
          const next = [...prev];
          next[idx] = mapped;
          return next;
        });
      } catch {
        /* 목록은 유지 */
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapExpense is render-local
    [refreshExpenseListQuietly]
  );

  const getTransferFilterKey = useCallback((expense: ExpenseApprovalItem) => {
    const total = floorMoney(Number(expense.totalAmount || 0));
    // 지급 금액이 없으면 송금 완료로 보지 않음 (0원 문서 오분류 방지)
    if (total <= 0) return 'transfer_pending';
    if (expenseIsPrepaid(expense)) {
      return 'transfer_completed';
    }
    const paid = floorMoney(Number(expense.paidAmount || 0));
    const remaining = Math.max(0, total - paid);
    if (String(expense.bankTransferStatus || '').toLowerCase() === 'failed') {
      return 'transfer_failed';
    }
    if (expenseIsAwaitingTaxInvoice(expense)) {
      return 'awaiting_tax';
    }
    if (
      remaining <= 0 ||
      String(expense.paymentRequestStatus || '').toLowerCase() === 'paid' ||
      expense.status === 'paid'
    ) {
      return 'transfer_completed';
    }
    if (paid > 0) return 'transfer_partial';
    return 'transfer_pending';
  }, []);

  /** 목록에서 '지급 완료'로 취급 (택스 인보이스 대기 건·0원 문서 제외) */
  const isExpensePaidForList = useCallback((expense: ExpenseApprovalItem) => {
    if (expenseIsAwaitingTaxInvoice(expense)) return false;
    const total = floorMoney(Number(expense.totalAmount || 0));
    if (total <= 0) return false;
    const paid = floorMoney(Number(expense.paidAmount || 0));
    const remaining = Math.max(0, total - paid);
    const paymentPaid = String(expense.paymentRequestStatus || '').toLowerCase() === 'paid';
    return (
      paymentPaid ||
      expense.status === 'paid' ||
      (paid > 0 && remaining <= 0 && ['approved', 'paid'].includes(expense.status))
    );
  }, []);

  const buildExpensePayload = useCallback(
    (statusOverride?: ExpenseApprovalItem['status']) => ({
    title: formData.title,
    purpose: formData.purpose,
      total_amount: roundDecimal2(totalAmount),
      currency: 'INR',
      requester_name: user?.username || '',
      requester_department: user?.department || '',
      requester_position: user?.position || '',
      current_approver_id: voucherData.approvedById ? Number(voucherData.approvedById) : null,
      cc_user_ids: ccUserIds.filter((id) => {
        const n = Number(id);
        if (!Number.isInteger(n) || n <= 0) return false;
        if (user?.id != null && Number(user.id) === n) return false;
        if (voucherData.approvedById && Number(voucherData.approvedById) === n) return false;
        return true;
      }),
    priority: formData.priority,
    due_date: formData.dueDate || null,
    notes: formData.notes || '',
      ...(isRootUser && effectiveCompanyId > 0 ? { company_id: effectiveCompanyId } : {}),
      items: {
        rows: lineItems.map((item) => {
          if (voucherData.formType === 'gst' && item.gstRowKey) {
            if (item.gstRowKey === 'interest' && item.gstExtra?.kind === 'interest') {
              const extra = recomputeInterestExtra({
                ...item.gstExtra,
                amountMode: item.gstExtra.amountMode,
              });
              const frozen: GstInterestExtra = {
                ...extra,
                amount: getGstExtraPayableAmount({ ...item, gstExtra: extra }),
                calcAsOfDate:
                  extra.calcAsOfDate ||
                  extra.plannedDate ||
                  todayIndiaYmd(),
              };
              return {
                ...item,
                taxableValue: 0,
                igst: roundDecimal2(Number(item.igst || 0)),
                cgst: roundDecimal2(Number(item.cgst || 0)),
                sgst: roundDecimal2(Number(item.sgst || 0)),
                gstExtra: frozen,
                total: frozen.amount,
              };
            }
            if (item.gstRowKey === 'lateFee' && item.gstExtra?.kind === 'lateFee') {
              const extra = recomputeLateFeeExtra({
                ...item.gstExtra,
                amountMode: item.gstExtra.amountMode,
              });
              const amount = getGstExtraPayableAmount({ ...item, gstExtra: extra });
              const heads = applyLateFeeHeadsFromAmount(amount);
              const frozen: GstLateFeeExtra = {
                ...extra,
                amount,
                calcAsOfDate:
                  extra.calcAsOfDate ||
                  extra.filingPlannedDate ||
                  todayIndiaYmd(),
              };
              return {
                ...item,
                ...heads,
                gstExtra: frozen,
                total: amount,
              };
            }
            const mapped = {
              ...item,
              taxableValue: roundDecimal2(Number(item.taxableValue || 0)),
              igst: roundDecimal2(Number(item.igst || 0)),
              cgst: roundDecimal2(Number(item.cgst || 0)),
              sgst: roundDecimal2(Number(item.sgst || 0)),
            };
            return {
              ...mapped,
              total: calcGstSummaryRowTotal(mapped),
            };
          }
          return {
            ...item,
            qty: roundDecimal2(Number(item.qty || 0)),
            unitPrice: roundDecimal2(Number(item.unitPrice || 0)),
            total: roundDecimal2(Number(item.total || 0)),
            ...(voucherData.formType === 'tds'
              ? (() => {
                  const calc = calcTdsLineAmounts(item);
                  const tdsAmt = effectiveTdsLineAmount(item);
                  return {
                    amount: calc.base,
                    unitPrice: calc.base,
                    qty: 1,
                    pan: String(item.pan || ''),
                    deducteePartnerId: item.deducteePartnerId ? String(item.deducteePartnerId) : '',
                    tdsRate: Number(item.tdsRate || 0),
                    deducteeType: item.deducteeType === 'company' ? 'company' : 'other',
                    tdsSection: String(item.tdsSection || ''),
                    tdsCode: String(item.tdsCode || ''),
                    tdsAmount: tdsAmt,
                    total: tdsAmt,
                  };
                })()
              : {}),
          };
        }),
        meta: {
          ...voucherData,
          checkedById: voucherData.approvedById || '',
          ...(voucherData.formType === 'general' &&
          (voucherData.perLineGst || !hasExpenseGstNumber(voucherData.gstNumber))
            ? { igstRate: 0, cgstRate: 0, sgstRate: 0 }
            : {}),
        },
      },
      status: statusOverride,
    }),
    [
      formData,
      lineItems,
      voucherData,
      ccUserIds,
      totalAmount,
      isRootUser,
      effectiveCompanyId,
      user?.id,
      user?.username,
      user?.department,
      user?.position,
    ]
  );

  // 작성 화면 진입 시 초안 1회만 생성
  useEffect(() => {
    if (viewMode === 'create' && !createGuard.allowed && !createGuard.flags.menusLoading) return;
    if (viewMode !== 'create') {
      draftInitInFlightRef.current = false;
      return;
    }
    if (draftId) return;
    if (isRootUser && !(effectiveCompanyId > 0)) {
      setIsInitializingDraft(false);
      draftInitInFlightRef.current = false;
      return;
    }

    let cancelled = false;
    setIsInitializingDraft(true);
    draftInitInFlightRef.current = true;

    void (async () => {
    try {
      const payload = buildExpensePayload('draft');
      const response = await accountingService.createExpenseReport(payload);
        if (cancelled) return;
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.createDraftFailed'));
      }
        const newId = response.data?.id || null;
        const assignedNo =
          parseExpenseItems(response.data?.items).meta?.voucherNo ||
          response.data?.expense_id ||
          '';
        draftIdReadyRef.current = newId;
        setDraftId(newId);
        setCurrentAttachments(normalizeExpenseAttachments(response.data?.attachments));
        lastAutoSavedJsonRef.current = JSON.stringify(payload);
        if (assignedNo) {
          setVoucherData((prev) => {
            if (prev.voucherNo === assignedNo) return prev;
            return { ...prev, voucherNo: assignedNo };
          });
        }
      setHeaderStatusBanner('draftCreated');
      } catch (err: any) {
        if (cancelled) return;
        draftInitInFlightRef.current = false;
        const serverMsg = String(err?.response?.data?.message || '').trim();
        setError(
          serverMsg
            ? `${t('expenseApproval.errors.createDraftFailed')} (${serverMsg})`
            : t('expenseApproval.errors.createDraftFailed')
        );
    } finally {
        if (!cancelled) setIsInitializingDraft(false);
      }
    })();

    return () => {
      cancelled = true;
      // Strict Mode remount 시 재시도 가능하도록
      draftInitInFlightRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create 진입·draftId·회사 기준 (타이핑으로 재생성 금지)
  }, [viewMode, draftId, t, isRootUser, effectiveCompanyId]);

  /** 제출·영수증 업로드 전에 draftId가 준비될 때까지 대기(또는 즉시 생성) */
  const ensureDraftReady = useCallback(async (): Promise<number | null> => {
    if (viewMode === 'edit') return selectedExpense?.id ?? null;
    if (isRootUser && !(effectiveCompanyId > 0)) {
      setError(t('expenseApproval.errors.selectCompanyFirst'));
      return null;
    }
    if (draftIdReadyRef.current) return draftIdReadyRef.current;
    if (draftId) {
      draftIdReadyRef.current = draftId;
      return draftId;
    }

    // 진입 시 초안 생성이 진행 중이면 잠시 대기
    const deadline = Date.now() + 8000;
    while (draftInitInFlightRef.current && !draftIdReadyRef.current && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 150));
    }
    if (draftIdReadyRef.current) return draftIdReadyRef.current;

    // 대기 후에도 없으면 즉시 생성
    try {
      setIsInitializingDraft(true);
      draftInitInFlightRef.current = true;
        const payload = buildExpensePayload('draft');
      const response = await accountingService.createExpenseReport(payload);
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.createDraftFailed'));
      }
      const newId = response.data?.id || null;
      if (newId) {
        draftIdReadyRef.current = newId;
        setDraftId(newId);
        setCurrentAttachments(normalizeExpenseAttachments(response.data?.attachments));
        lastAutoSavedJsonRef.current = JSON.stringify(payload);
        const assignedNo =
          parseExpenseItems(response.data?.items).meta?.voucherNo ||
          response.data?.expense_id ||
          '';
        if (assignedNo) {
          setVoucherData((prev) =>
            prev.voucherNo === assignedNo ? prev : { ...prev, voucherNo: assignedNo }
          );
        }
        setHeaderStatusBanner('draftCreated');
      }
      return newId;
    } catch (err: any) {
      const serverMsg = String(err?.response?.data?.message || err?.message || '').trim();
      setError(
        serverMsg
          ? `${t('expenseApproval.errors.createDraftFailed')} (${serverMsg})`
          : t('expenseApproval.errors.createDraftFailed')
      );
      return null;
      } finally {
      draftInitInFlightRef.current = false;
      setIsInitializingDraft(false);
    }
  }, [viewMode, selectedExpense?.id, draftId, buildExpensePayload, t, isRootUser, effectiveCompanyId]);

  /** 작성·초안 편집 중 입력을 초안으로 자동 저장 */
  const persistDraftAutoSave = useCallback(async () => {
    if (submitInFlightRef.current || saving || isInitializingDraft) return;
    const isCreateDraft = viewMode === 'create';
    const isEditDraft = viewMode === 'edit' && selectedExpense?.status === 'draft';
    if (!isCreateDraft && !isEditDraft) return;
    if (isCreateDraft ? !createGuard.allowed : !editGuard.allowed) return;

    const activeId = isCreateDraft
      ? draftIdReadyRef.current || draftId
      : selectedExpense?.id ?? null;
    if (!activeId) return;

    const payload = buildExpensePayload('draft');
    const fingerprint = JSON.stringify(payload);
    if (fingerprint === lastAutoSavedJsonRef.current) return;

    const seq = ++autoSaveSeqRef.current;
    setAutoSaveHint('saving');
    try {
      const response = await accountingService.updateExpenseReport(activeId, payload);
      if (seq !== autoSaveSeqRef.current) return;
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.voucher.autoSaveFailed'));
      }
      lastAutoSavedJsonRef.current = fingerprint;
      setAutoSaveHint('saved');
    } catch {
      if (seq !== autoSaveSeqRef.current) return;
      setAutoSaveHint('failed');
    }
  }, [
    saving,
    isInitializingDraft,
    viewMode,
    selectedExpense?.status,
    selectedExpense?.id,
    draftId,
    buildExpensePayload,
    createGuard.allowed,
    editGuard.allowed,
    t,
  ]);

  useEffect(() => {
    const isCreateDraft = viewMode === 'create' && !!draftId;
    const isEditDraft = viewMode === 'edit' && selectedExpense?.status === 'draft';
    if (!isCreateDraft && !isEditDraft) return;
    if (isInitializingDraft || saving || submitInFlightRef.current) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    // 수정 화면 진입 직후 스킵 구간이 있으면 그 이후까지 대기
    const delay = Math.max(1200, autoSaveSkipUntilRef.current - Date.now());
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      void persistDraftAutoSave();
    }, delay);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    formData,
    lineItems,
    voucherData,
    ccUserIds,
    viewMode,
    draftId,
    selectedExpense?.id,
    selectedExpense?.status,
    isInitializingDraft,
    saving,
    persistDraftAutoSave,
  ]);

  const localizeExpenseApiError = useCallback(
    (raw: unknown, fallbackKey: string) => {
      const message = String(raw || '').trim();
      const messageKeyMap: Record<string, string> = {
        '파일이 필요합니다.': 'expenseApproval.errors.fileRequired',
        '파일이 필요합니다': 'expenseApproval.errors.fileRequired',
        '회사를 선택해주세요.': 'expenseApproval.errors.selectCompanyFirst',
        '회사를 선택해주세요': 'expenseApproval.errors.selectCompanyFirst',
        '선택한 회사를 찾을 수 없습니다.': 'expenseApproval.errors.companyNotFound',
        '첨부 유형(Tax Invoice / Proforma Invoice (Quotation) / 인보이스 없음)을 선택해주세요.':
          'expenseApproval.errors.invoiceTypeRequired',
        '검토 중이거나 처리된 문서는 수정할 수 없습니다.': 'expenseApproval.errors.cannotEditProcessed',
        '검토 중이거나 처리된 문서는 수정할 수 없습니다. 목록에서 문서 상태를 확인해 주세요.':
          'expenseApproval.errors.cannotEditProcessed',
      };
      if (message && messageKeyMap[message]) return t(messageKeyMap[message]);
      if (message && /[가-힣]/.test(message) && !i18n.language?.startsWith('ko')) {
        return t(fallbackKey);
      }
      return message || t(fallbackKey);
    },
    [t, i18n.language]
  );

  const filteredExpenses = useMemo(() => {
    let filtered = expenses;

    if (listTab === 'written' && user?.id) {
      // root/audit: 선택한 회사(또는 전체)의 작성 건을 열람 — 본인 작성분으로 좁히지 않음
      if (!canViewAllCompanies) {
        filtered = filtered.filter((expense) => expense.requesterId === user.id);
      }
    }
    if (listTab === 'received' && user?.id) {
      filtered = filtered.filter((expense) => {
        if (expense.status === 'draft') return false;
        // root/audit: 회사 필터 기준 타사 받은 결의서 열람
        if (canViewAllCompanies) return true;
        if (expense.currentApproverId === user.id) return true;
        if (expense.itemMeta?.checkedById && Number(expense.itemMeta.checkedById) === user.id) return true;
        if (expense.itemMeta?.approvedById && Number(expense.itemMeta.approvedById) === user.id) return true;
        if ((expense.ccUserIds || []).includes(Number(user.id))) return true;
        return expense.approvalFlow?.some((step) => step.approverId === user.id);
      });
    }
    if (listTab === 'transfer') {
      if (!hasTransferAccess) {
        filtered = [];
      } else {
        filtered = filtered.filter((expense) => {
          if (expense.status !== 'approved' && expense.status !== 'paid') return false;
          const transferKey = getTransferFilterKey(expense);
          // 빈 배열 = 전체 / 그 외 = 선택한 송금 상태(복수 OR)
          if (!transferStatusFilters.length) return true;
          return transferStatusFilters.includes(transferKey);
        });
      }
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((expense) => {
        const partnerName = String(
          expense.itemMeta?.department ||
            expense.itemMeta?.partnerName ||
            expense.itemMeta?.partner_name ||
            ''
        ).toLowerCase();
        return (
          expense.title.toLowerCase().includes(q) ||
          expense.expenseId.toLowerCase().includes(q) ||
          expense.requesterName.toLowerCase().includes(q) ||
          expense.purpose.toLowerCase().includes(q) ||
          String(expense.companyName || '')
            .toLowerCase()
            .includes(q) ||
          partnerName.includes(q)
        );
      });
    }

    if (listTab !== 'transfer') {
      if (statusFilter === 'paid') {
        // 지급 완료 = Tax Invoice까지 반영되어 업무 종료된 건만
        filtered = filtered.filter((expense) => isExpensePaidForList(expense));
      } else if (statusFilter === 'awaiting_tax') {
        filtered = filtered.filter((expense) => expenseIsAwaitingTaxInvoice(expense));
      } else if (statusFilter === 'approved') {
        // 승인됨: 결재만 끝난 건. 텍스 인보이스 대기·지급완료는 제외
        filtered = filtered.filter(
          (expense) =>
            !isExpensePaidForList(expense) &&
            expense.status === 'approved' &&
            !expenseIsAwaitingTaxInvoice(expense)
        );
      } else if (statusFilter === DEFAULT_LIST_STATUS_FILTER) {
        // 기본: 초안 + 제출됨
        filtered = filtered.filter(
          (expense) => expense.status === 'draft' || expense.status === 'submitted'
        );
      } else if (statusFilter) {
        filtered = filtered.filter(
          (expense) => !isExpensePaidForList(expense) && expense.status === statusFilter
        );
      }
      // statusFilter === '' → 전체: 상태 제한 없음
    }

    if (priorityFilter) {
      filtered = filtered.filter((expense) => expense.priority === priorityFilter);
    }

    return filtered;
  }, [
    expenses,
    searchTerm,
    statusFilter,
    transferStatusFilters,
    priorityFilter,
    listTab,
    user,
    canViewAllCompanies,
    hasTransferAccess,
    getTransferFilterKey,
    isExpensePaidForList,
  ]);

  const handleListSort = (key: ExpenseListSortKey) => {
    setPage(1);
    if (listSortKey === key) {
      setListSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setListSortKey(key);
    setListSortDir(key === 'createdAt' || key === 'amount' ? 'desc' : 'asc');
  };

  useEffect(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead) return;
    loadExpenseData();
  }, [loadExpenseData, menuFlags.menusLoading, menuFlags.canRead]);

  useEffect(() => {
    if (!canViewAllCompanies) {
      setCompanyOptions([]);
      setCompanyFilterId('');
      return;
    }
    let cancelled = false;
    const tenantId = Number(user?.tenant_id);
    (async () => {
      try {
        const res = await companyService.getCompanies();
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (cancelled) return;
        setCompanyOptions(
          rows
            .map((c: any) => ({
              id: Number(c.id),
              // 표시용 — Private Limited / Pvt Ltd 등 제거
              name: stripCorporateSuffixFromFilename(String(c.name || c.company_name || '').trim()),
              tenantId: Number(c.tenant_id || c.tenantId || 0),
            }))
            .filter(
              (c: { id: number; name: string; tenantId: number }) =>
                Number.isFinite(c.id) &&
                c.id > 0 &&
                c.name &&
                (!Number.isFinite(tenantId) || tenantId <= 0 || !c.tenantId || c.tenantId === tenantId)
            )
            .map(({ id, name }: { id: number; name: string }) => ({ id, name }))
            .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
        );
      } catch {
        if (!cancelled) setCompanyOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canViewAllCompanies, user?.tenant_id]);

  useEffect(() => {
    if (!canViewAllCompanies || companyFilterInitializedRef.current) return;
    if (companyOptions.length === 0) return;
    const next = resolveDefaultCompanyFilterId(companyOptions);
    if (!next) return;
    companyFilterInitializedRef.current = true;
    setCompanyFilterId(next);
  }, [canViewAllCompanies, companyOptions, resolveDefaultCompanyFilterId]);

  useEffect(() => {
    if (!user) {
      setCompanyLogo('');
      setCompanyName('');
      setCompanyAddress('');
      setCompanyGstNumber('');
      setCompanyGstState('');
      return;
    }

    const companyId = effectiveCompanyId;
    if (!(companyId > 0)) {
      setCompanyLogo('');
      setCompanyName('');
      setCompanyAddress('');
      setCompanyGstNumber('');
      setCompanyGstState('');
      return;
    }

    let cancelled = false;
    Promise.all([
      useReferenceDataStore.getState().fetchCompanyById(companyId),
      companyService.getCompanyGstNumbers(companyId).catch(() => null),
    ])
      .then(([company, gstRes]) => {
        if (cancelled) return;
        setCompanyName(String(company?.name || '').trim());
        setCompanyLogo(String(company?.company_logo || company?.logo || '').trim());
        setCompanyAddress(String(company?.address || '').trim());
        const gstList = pickGstNumberList(gstRes);
        const gstNumber = gstList[0] || pickCompanyGstNumber(company);
        setCompanyGstNumber(gstNumber);
        setCompanyGstState(
          gstStateCode(gstNumber) ||
            resolveRegisteredStateCodeFromCompanyLike({
              ...(company || {}),
              gst_numbers: gstList.length ? gstList : company?.gst_numbers,
            }) ||
            ''
        );
      })
      .catch(() => {
        if (cancelled) return;
        setCompanyLogo('');
        setCompanyName('');
        setCompanyAddress('');
        setCompanyGstNumber('');
        setCompanyGstState('');
      });

    return () => {
      cancelled = true;
    };
  }, [user, effectiveCompanyId]);

  // GST 세율은 사용자가 직접 입력한 값만 사용 (파트너·GSTIN으로 자동 채우지 않음)

  useEffect(() => {
    const loadApprovers = async () => {
      if (!(effectiveCompanyId > 0)) {
        setApprovers([]);
        return;
      }
      try {
        const users = await useReferenceDataStore.getState().fetchUsers({
          company_id: effectiveCompanyId,
        });
        const options = users.map((item: any) => ({
          id: item.id,
          name: item.username || item.userid || `User ${item.id}`,
        }));
        setApprovers(options);
      } catch {
        setApprovers([]);
      }
    };
    loadApprovers();
  }, [effectiveCompanyId]);

  useEffect(() => {
    const loadPartners = async () => {
      if (isRootUser && !(effectiveCompanyId > 0)) {
        setPartners([]);
        setPartnerLoadError(false);
        setPartnerScopeEnforced(false);
        return;
      }
      try {
        setPartnerLoadError(false);
        // 강제 새로고침 — 빈 캐시가 굳어 검색이 비는 문제 방지
        const partnerPromise =
          isRootUser && effectiveCompanyId > 0
            ? partnerService.getPartners(effectiveCompanyId).then((res: any) => {
                const data = res?.data ?? res;
                return Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
              })
            : useReferenceDataStore.getState().fetchPartners(true);
        const [rows, scopeRes] = await Promise.all([
          partnerPromise,
          workAssigneeListService.getMyScope().catch(() => null),
        ]);
        const scope = scopeRes?.data;
        const allowedPartnerIds = new Set<number>(
          Array.isArray(scope?.partner_ids)
            ? scope.partner_ids.map((id: any) => Number(id)).filter((id: number) => id > 0)
            : []
        );
        const allowedNames = new Set<string>(
          Array.isArray(scope?.partner_names)
            ? scope.partner_names
                .map((n: any) => normalizePartnerCompanyName(n).trim().toLowerCase())
                .filter(Boolean)
            : []
        );
        const enforce =
          Boolean(scope?.enforced) && (allowedPartnerIds.size > 0 || allowedNames.size > 0);
        setPartnerScopeEnforced(enforce);

        const normalized: PartnerOption[] = (Array.isArray(rows) ? rows : [])
          .map((p: any) => ({
            id: Number(p.id),
            company_name: String(p.company_name || p.companyName || p.name || '').trim(),
            representative: p.representative || '',
            address: p.address || '',
            phone: p.phone || '',
            email: p.email || '',
            pan_number: p.pan_number || p.panNumber || '',
            bank_name: p.bank_name || p.bankName || '',
            account_number: p.account_number || p.accountNumber || '',
            bank_ifsc: p.bank_ifsc || p.bankIfsc || p.ifsc || '',
            account_holder: p.account_holder || p.accountHolder || '',
            business_number: String(p.business_number || p.businessNumber || '').trim(),
            gstNumbers: Array.isArray(p.gstNumbers)
              ? p.gstNumbers
              : Array.isArray(p.gst_numbers)
                ? p.gst_numbers
                : [],
          }))
          .filter((p) => Number.isFinite(p.id) && p.company_name)
          .filter((p) => {
            if (!enforce) return true;
            if (allowedPartnerIds.has(p.id)) return true;
            const nameKey = normalizePartnerCompanyName(p.company_name).trim().toLowerCase();
            return Boolean(nameKey) && allowedNames.has(nameKey);
          });

        // 파트너 관리와 동일: 정규화된 회사명이 같으면 1건만 유지
        // (계좌·주소 정보가 더 많은 쪽을 우선, 동점이면 id가 작은 쪽)
        const partnerCompleteness = (p: PartnerOption) =>
          (p.bank_name ? 4 : 0) +
          (p.account_number ? 4 : 0) +
          (p.bank_ifsc ? 2 : 0) +
          (p.account_holder ? 2 : 0) +
          (p.pan_number ? 1 : 0) +
          ((p.gstNumbers || []).length > 0 || p.business_number ? 1 : 0) +
          (String(p.address || '').trim().length > 20 ? 1 : 0);

        const byId = new Map<number, PartnerOption>();
        for (const row of normalized) {
          if (!byId.has(row.id)) byId.set(row.id, row);
        }
        const byName = new Map<string, PartnerOption>();
        for (const row of Array.from(byId.values())) {
          const nameKey = normalizePartnerCompanyName(row.company_name).trim().toLowerCase();
          if (!nameKey) {
            byName.set(`__id_${row.id}`, row);
            continue;
          }
          const existing = byName.get(nameKey);
          if (!existing) {
            byName.set(nameKey, row);
            continue;
          }
          const scoreNew = partnerCompleteness(row);
          const scoreOld = partnerCompleteness(existing);
          if (scoreNew > scoreOld || (scoreNew === scoreOld && row.id < existing.id)) {
            byName.set(nameKey, row);
          }
        }
        setPartners(Array.from(byName.values()));
      } catch {
        setPartnerLoadError(true);
        setPartners([]);
        setPartnerScopeEnforced(false);
      }
    };
    loadPartners();
  }, [isRootUser, effectiveCompanyId]);

  const filterPartnerOptions = useCallback((options: PartnerOption[], state: { inputValue: string }) => {
    const q = state.inputValue.trim().toLowerCase();
    if (!q) return options.slice(0, 80);
    const matched = options.filter((p) => {
      const name = String(p.company_name || '').toLowerCase();
      const holder = String(p.account_holder || p.representative || '').toLowerCase();
      const gst = (p.gstNumbers || []).join(' ').toLowerCase();
      const pan = String(p.pan_number || '').toLowerCase();
      return name.includes(q) || holder.includes(q) || gst.includes(q) || pan.includes(q);
    });
    matched.sort((a, b) => {
      const an = a.company_name.toLowerCase();
      const bn = b.company_name.toLowerCase();
      const aStarts = an.startsWith(q) ? 0 : 1;
      const bStarts = bn.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return an.localeCompare(bn);
    });
    return matched.slice(0, 50);
  }, []);

  const handleSelectTdsDeductee = (id: string, value: PartnerOption | string | null) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (value && typeof value !== 'string') {
          return {
            ...item,
            description: value.company_name || '',
            pan: String(value.pan_number || '').toUpperCase(),
            deducteePartnerId: String(value.id),
          };
        }
        const name = typeof value === 'string' ? value : '';
        return {
          ...item,
          description: name,
          deducteePartnerId: '',
          // 파트너 선택이 아니면 PAN은 수동 유지(이름만 지울 때 PAN 유지)
          pan: name ? item.pan : item.pan,
        };
      })
    );
  };

  useEffect(() => {
    if (!hasTransferAccess && listTab === 'transfer') {
      setListTab('received');
    }
  }, [hasTransferAccess, listTab]);

  useEffect(() => {
    const tab = String(searchParams.get('tab') || '').trim().toLowerCase();
    if (tab === 'received' || tab === 'written' || tab === 'transfer') {
      if (tab === 'transfer' && !hasTransferAccess) return;
      setListTab(tab);
      setStatusFilter(defaultStatusFilterForTab(tab));
      if (tab === 'transfer') {
        setTransferStatusFilters(defaultTransferStatusFiltersForTab());
        setListSortKey('createdAt');
        setListSortDir('desc');
      }
    }
  }, [searchParams, hasTransferAccess]);

  const handleRootCompanyChange = useCallback(
    (next: number | '') => {
      companyFilterInitializedRef.current = true;
      setCompanyFilterId(next);
      setPage(1);
      if (viewMode === 'create') {
        setDraftId(null);
        draftIdReadyRef.current = null;
        draftInitInFlightRef.current = false;
        setCurrentAttachments([]);
        setHeaderStatusBanner('');
        setVoucherData((prev) => ({
          ...prev,
          approvedById: '',
          partnerId: '',
          department: '',
          gstNumber: '',
        }));
        setPartnerInputValue('');
      }
    },
    [viewMode]
  );

  /** 목록용: 맨 위에 "전체 회사" 선택지 */
  const ROOT_COMPANY_ALL_ID = 0;
  const rootCompanyFilterOptions = useMemo(
    () => [{ id: ROOT_COMPANY_ALL_ID, name: t('expenseApproval.filters.allCompanies') }, ...companyOptions],
    [companyOptions, t]
  );

  const selectedRootCompanyOption = useMemo(() => {
    if (typeof companyFilterId !== 'number' || companyFilterId <= 0) {
      return rootCompanyFilterOptions[0];
    }
    return (
      companyOptions.find((c) => Number(c.id) === Number(companyFilterId)) || {
        id: companyFilterId,
        name: '',
      }
    );
  }, [companyFilterId, companyOptions, rootCompanyFilterOptions]);

  const handleRootCompanyOptionChange = useCallback(
    (option: { id: number; name: string } | null) => {
      if (!option || Number(option.id) === ROOT_COMPANY_ALL_ID) {
        handleRootCompanyChange('');
        return;
      }
      handleRootCompanyChange(Number(option.id));
    },
    [handleRootCompanyChange]
  );

  /** 작성 화면: 전체 필터여도 실제 작성 회사(로그인 회사 등)를 표시 */
  const selectedCreateCompanyOption = useMemo(() => {
    if (!(effectiveCompanyId > 0)) return null;
    return companyOptions.find((c) => Number(c.id) === Number(effectiveCompanyId)) || null;
  }, [effectiveCompanyId, companyOptions]);

  const rootCompanyAutocompleteSx = {
    minWidth: { xs: 180, sm: 280 },
    maxWidth: { xs: '100%', sm: 420 },
    ...expenseApprovalFilterFieldSx,
    '& .MuiAutocomplete-input': {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  } as const;

  const rootCompanyAutocompleteSlotProps = {
    paper: {
      sx: {
        width: 'max-content',
        minWidth: '100%',
        maxWidth: 'min(560px, 92vw)',
      },
    },
    listbox: {
      sx: {
        '& .MuiAutocomplete-option': {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
        },
      },
    },
  } as const;

  const openedExpenseQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const rawId = searchParams.get('id');
    if (!rawId || expenses.length === 0) return;
    const queryKey = `${String(searchParams.get('tab') || '')}:${rawId}`;
    if (openedExpenseQueryRef.current === queryKey) return;
    const expenseId = Number(rawId);
    if (!Number.isFinite(expenseId) || expenseId <= 0) return;
    const target = expenses.find((row) => Number(row.id) === expenseId);
    if (!target) return;
    openedExpenseQueryRef.current = queryKey;
    setSelectedExpense({ ...target, hasUnreadComments: false });
    setViewMode('view');
  }, [searchParams, expenses]);

  const qrUrl = useMemo(() => {
    if (!qrToken) return '';
    return `${window.location.origin}/expense-receipt-upload?token=${qrToken}`;
  }, [qrToken]);

  useEffect(() => {
    if (!qrUrl) {
      setQrImage('');
      return;
    }
    setQrImageError('');
    QRCode.toDataURL(qrUrl, { width: 220, margin: 1 })
      .then((url: string) => setQrImage(url))
      .catch(() => {
        setQrImageError(t('expenseApproval.errors.qrGenerateFailed'));
      });
  }, [qrUrl, t]);

  const getExpenseRemainingAmount = useCallback((expense: ExpenseApprovalItem) => {
    const total = floorMoney(Number(expense.totalAmount || 0));
    const paid = floorMoney(Number(expense.paidAmount || 0));
    return Math.max(0, total - paid);
  }, []);

  const getExpenseRemittanceEntries = (expense: ExpenseApprovalItem) => {
    const fromHistory = (expense.remittanceHistory || [])
      .map((row) => ({
        timestamp: String(row.timestamp || ''),
        amount: Number(row.amount || 0),
      }))
      .filter((row) => Number.isFinite(row.amount) && row.amount > 0);
    const source =
      fromHistory.length > 0
        ? fromHistory
        : (expense.bankTransferLogs || [])
            .map((log) => {
              const amount = Number(log.amount ?? log.payload?.amount ?? 0);
              const status = String(log.status || '').toLowerCase();
              const ok = !status || ['success', 'completed', 'paid'].includes(status);
              return { timestamp: String(log.timestamp || ''), amount, ok };
            })
            .filter((row) => row.ok && Number.isFinite(row.amount) && row.amount > 0)
            .map(({ timestamp, amount }) => ({ timestamp, amount }));
    return [...source].sort(
      (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    );
  };

  /** 목록/상세 상태: 실지급 금액이 있고 잔액 0일 때만 지급 완료 (0원 문서는 제외) */
  const resolveDisplayStatus = useCallback(
    (expense: ExpenseApprovalItem): ExpenseApprovalItem['status'] | string => {
      if (expenseIsAwaitingTaxInvoice(expense)) return 'awaiting_tax';
      const total = floorMoney(Number(expense.totalAmount || 0));
      const remaining = getExpenseRemainingAmount(expense);
      const paymentPaid = String(expense.paymentRequestStatus || '').toLowerCase() === 'paid';
      const fullyRemitted =
        total > 0 &&
        (paymentPaid ||
          expense.status === 'paid' ||
          (Number(expense.paidAmount || 0) > 0 &&
            remaining <= 0 &&
            ['approved', 'paid'].includes(expense.status)));
      if (fullyRemitted) return 'paid';
      if (expense.status === 'rejected' && expense.itemMeta?.revisionRejected === true) {
        return 'revision_rejected';
      }
      // DB status가 paid여도 금액 0이면 승인됨으로 표시 (오분류 방지)
      if (expense.status === 'paid' && total <= 0) return 'approved';
      return expense.status;
    },
    [getExpenseRemainingAmount]
  );

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'draft':
        return <Chip label={t('expenseApproval.status.draft')} color="default" size="small" />;
      case 'submitted':
        return <Chip label={t('expenseApproval.status.submitted')} color="info" size="small" />;
      case 'in_review':
        return <Chip label={t('expenseApproval.status.inReview')} color="warning" size="small" />;
      case 'approved':
        return <Chip label={t('expenseApproval.status.approved')} color="success" size="small" />;
      case 'rejected':
        return <Chip label={t('expenseApproval.status.rejected')} color="error" size="small" />;
      case 'revision_rejected':
        return (
          <Chip label={t('expenseApproval.status.revisionRejected')} color="warning" size="small" />
        );
      case 'awaiting_tax':
        return (
          <Chip
            label={t('expenseApproval.status.awaitingTaxInvoice')}
            color="warning"
            size="small"
          />
        );
      case 'paid':
        return <Chip label={t('expenseApproval.status.paid')} size="small" sx={paidStatusChipSx} />;
      default:
        return <Chip label={t('expenseApproval.unknown')} color="default" size="small" />;
    }
  };

  /** 송금할 리스트용: 문서 초안 상태가 아니라 송금 진행 상태를 표시 */
  const getTransferStatusChip = (expense: ExpenseApprovalItem) => {
    const total = Number(expense.totalAmount || 0);
    const paid = Number(expense.paidAmount || 0);
    const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
    if (expense.bankTransferStatus === 'failed') {
      return <Chip label={t('expenseApproval.status.transferFailed')} color="error" size="small" />;
    }
    if (expenseIsAwaitingTaxInvoice(expense)) {
      return (
        <Chip label={t('expenseApproval.status.awaitingTaxInvoice')} color="warning" size="small" />
      );
    }
    if (remaining <= 0 || expense.paymentRequestStatus === 'paid' || expense.status === 'paid') {
      return <Chip label={t('expenseApproval.status.paid')} size="small" sx={paidStatusChipSx} />;
    }
    if (paid > 0) {
      return <Chip label={t('expenseApproval.status.partialTransfer')} color="warning" size="small" />;
    }
    return <Chip label={t('expenseApproval.status.transferPending')} color="info" size="small" />;
  };

  const getPriorityChip = (priority: string) => {
    switch (priority) {
      case 'low':
        return <Chip label={t('expenseApproval.priority.low')} color="default" size="small" />;
      case 'medium':
        return <Chip label={t('expenseApproval.priority.medium')} color="info" size="small" />;
      case 'high':
        return <Chip label={t('expenseApproval.priority.high')} color="warning" size="small" />;
      case 'urgent':
        return <Chip label={t('expenseApproval.priority.urgent')} color="error" size="small" />;
      default:
        return <Chip label={t('expenseApproval.unknown')} color="default" size="small" />;
    }
  };

  const syncExpenseReadState = useCallback((expenseId: number, patch: Partial<ExpenseApprovalItem>) => {
    setExpenses((prev) =>
      prev.map((item) => (item.id === expenseId ? { ...item, ...patch, hasUnreadComments: false } : item))
    );
    setSelectedExpense((prev) => (prev && prev.id === expenseId ? { ...prev, ...patch, hasUnreadComments: false } : prev));
  }, []);

  const handleViewExpense = (expense: ExpenseApprovalItem) => {
    // 초안·수정 반려는 상세 대신 바로 수정 화면으로
    if (
      (expense.status === 'draft' || isRevisionRejectedExpense(expense)) &&
      canEditExpense(expense)
    ) {
      handleEditExpense(expense);
      return;
    }

    setSelectedExpense({ ...expense, hasUnreadComments: false });
    setExpenses((prev) =>
      prev.map((item) => (item.id === expense.id ? { ...item, hasUnreadComments: false } : item))
    );
    setViewMode('view');

    void (async () => {
      try {
        const response = await accountingService.getExpenseReport(expense.id, { skipErrorPopup: true });
        if (!response?.success || !response.data) return;
        const mapped = mapExpense(response.data);
        // 상세 API 기준으로 첨부(프로포마/텍스 등)까지 다시 반영
        setSelectedExpense({ ...mapped, hasUnreadComments: false });
        syncExpenseReadState(expense.id, {
          comments: mapped.comments,
          commentCount: mapped.commentCount,
          lastCommentAt: mapped.lastCommentAt,
        });
      } catch {
        try {
          await accountingService.markExpenseCommentsRead(expense.id, { skipErrorPopup: true });
          syncExpenseReadState(expense.id, {});
        } catch {
          // keep optimistic unread=false for current session only
        }
      }
    })();
  };

  const handleEditExpense = (expense: ExpenseApprovalItem) => {
    setSelectedExpense(expense);
    const meta = expense.itemMeta || {};
    const linkedPartner = partners.find((p) => String(p.id) === String(meta.partnerId || ''));
    const savedDueDate = formatLocalYmd(expense.dueDate);
    setFormData({
      title: expense.title || '',
      purpose: expense.purpose || '',
      currency: displayExpenseCurrency(expense.currency),
      priority: expense.priority || 'medium',
      dueDate: savedDueDate || todayDate,
      notes: expense.notes || ''
    });
    const savedItems = (expense.items || []).map((item) => {
      const qty = roundDecimal2(Number(item.qty || 1));
      const unitPrice = roundDecimal2(Number(item.unitPrice || item.amount || 0));
      const formType = resolveExpenseFormType(meta);
      if (formType === 'gst') {
        return mapSavedGstSummaryItem(item, item.gstRowKey as GstSummaryRowKey | undefined);
      }
      if (formType === 'tds') {
        const base = floorMoney(Number(item.amount ?? item.total ?? unitPrice));
        const tdsRate = Number(item.tdsRate || 0);
        const tdsInterest = floorMoney(Number(item.tdsInterest || 0));
        const tdsAmt = floorMoney(
          Number(item.tdsAmount ?? base * (tdsRate / 100))
        );
        return {
        id: item.id || `${Date.now()}-${Math.random()}`,
          invoiceDate: formatLocalYmd(item.invoiceDate || item.date) || todayDate,
        description: item.description || '',
          qty: 1,
          unitPrice: base,
          amount: base,
          pan: item.pan || '',
          deducteePartnerId: item.deducteePartnerId != null ? String(item.deducteePartnerId) : '',
          tdsRate,
          deducteeType: item.deducteeType === 'company' ? 'company' as const : 'other' as const,
          tdsSection: item.tdsSection || '',
          tdsCode: item.tdsCode || '',
          tdsAmount: tdsAmt,
          tdsInterest,
          remarks: item.remarks || '',
          total: floorMoney(base - tdsAmt),
        };
      }
      return {
        id: item.id || `${Date.now()}-${Math.random()}`,
        invoiceDate: formatLocalYmd(item.invoiceDate || item.date) || todayDate,
        description: item.description || '',
        qty,
        unitPrice,
        total: roundDecimal2(Number(item.total || item.amount || qty * unitPrice)),
      };
    });
    const resolvedFormType = resolveExpenseFormType(meta);
    setLineItems(
      savedItems.length > 0
        ? resolvedFormType === 'gst'
          ? parseGstSummaryLineItems(savedItems)
          : savedItems.map((item) => ({
              ...item,
              ...normalizeLineItemGstRates(item),
            }))
        : resolvedFormType === 'gst'
          ? createGstSummaryLineItems()
          : [createEmptyLineItem(resolvedFormType)]
    );
    setCurrentAttachments(expense.attachments || []);
    setCcUserIds(Array.isArray(expense.ccUserIds) ? [...expense.ccUserIds] : []);
    setVoucherData({
      formType: resolveExpenseFormType(meta),
      department: meta.department || linkedPartner?.company_name || '',
      partnerId: meta.partnerId != null ? String(meta.partnerId) : '',
      voucherNo: meta.voucherNo || '',
      gstNumber: meta.gstNumber || pickPartnerGstNumber(linkedPartner || ({} as PartnerOption)) || '',
      voucherDate: formatLocalYmd(meta.voucherDate) || todayDate,
      partnerRepresentative: meta.partnerRepresentative || linkedPartner?.representative || '',
      partnerAddress: meta.partnerAddress || linkedPartner?.address || '',
      partnerPhone: normalizePhoneDigits(meta.partnerPhone || linkedPartner?.phone || ''),
      partnerEmail: normalizeEmailLower(meta.partnerEmail || linkedPartner?.email || ''),
      partnerPan: meta.partnerPan || linkedPartner?.pan_number || '',
      acHolder: meta.acHolder || linkedPartner?.account_holder || '',
      bank: meta.bank || linkedPartner?.bank_name || '',
      accountNumber: normalizeBankAccountDigits(
        meta.accountNumber || linkedPartner?.account_number || ''
      ),
      ifsc: normalizeIfsc(meta.ifsc || linkedPartner?.bank_ifsc || ''),
      paymentDate: formatLocalYmd(meta.paymentDate) || '',
      paymentStatus: meta.paymentStatus || '',
      amountInWords: meta.amountInWords || '',
      remarks: meta.remarks || '',
      checkedById: meta.checkedById != null ? String(meta.checkedById) : '',
      approvedById: meta.approvedById != null ? String(meta.approvedById) : '',
      ...normalizeVoucherGstRates(
        hasExpenseGstNumber(meta.gstNumber || pickPartnerGstNumber(linkedPartner || ({} as PartnerOption)) || '')
          ? {
              igstRate: Number(meta.igstRate || meta.igst_rate || 0),
              cgstRate: Number(meta.cgstRate || meta.cgst_rate || 0),
              sgstRate: Number(meta.sgstRate || meta.sgst_rate || 0),
            }
          : { igstRate: 0, cgstRate: 0, sgstRate: 0 }
      ),
      tdsEnabled: Boolean(meta.tdsEnabled ?? meta.tds_enabled),
      tdsRate: Number(meta.tdsRate || meta.tds_rate || 0),
      gstRoundingAdjustment: Number(meta.gstRoundingAdjustment ?? meta.gst_rounding_adjustment ?? 0),
      gstProfessionalTax: Number(meta.gstProfessionalTax ?? meta.gst_professional_tax ?? 0),
      perLineGst: Boolean(meta.perLineGst ?? meta.per_line_gst),
      isPrepaid: Boolean(meta.isPrepaid ?? meta.is_prepaid),
      noInvoice: Boolean(meta.noInvoice ?? meta.no_invoice) ||
        String(meta.invoiceMode || meta.invoice_mode || '').toLowerCase() === 'none',
      invoiceMode: (Boolean(meta.noInvoice ?? meta.no_invoice)
        ? 'none'
        : normalizeExpenseInvoiceType(meta.invoiceMode || meta.invoice_mode || 'tax')) as ExpenseInvoiceType,
    });
    setReceiptInvoiceType(
      Boolean(meta.noInvoice ?? meta.no_invoice)
        ? 'none'
        : normalizeExpenseInvoiceType(meta.invoiceMode || meta.invoice_mode || 'tax')
    );
    setPartnerInputValue(
      String(meta.department || '').trim() ||
        linkedPartner?.company_name ||
        ''
    );
    setDraftId(expense.id);
    draftIdReadyRef.current = expense.id;
    setHeaderStatusBanner('');
    lastAutoSavedJsonRef.current = '';
    setAutoSaveHint('');
    autoSaveSkipUntilRef.current = Date.now() + 1500;
    setViewMode('edit');
  };

  const handleCreateExpense = () => {
    if (!createGuard.guard()) return;
    const loginCompanyId = Number(user?.company_id);
    // 전체 회사 선택 시에도 필터는 유지하고, 작성만 로그인 회사(effectiveCompanyId)로 진행
    const writeCompanyId =
      (typeof companyFilterId === 'number' && companyFilterId > 0
        ? companyFilterId
        : null) ??
      (Number.isFinite(loginCompanyId) && loginCompanyId > 0 ? loginCompanyId : 0);
    if (isRootUser && !(writeCompanyId > 0)) {
      setError(t('expenseApproval.errors.selectCompanyFirst'));
      return;
    }
    setSelectedExpense(null);
    setFormData({
      title: '',
      purpose: '',
      currency: 'INR',
      priority: 'medium',
      dueDate: todayDate,
      notes: ''
    });
    setLineItems([createEmptyLineItem('general')]);
    setCurrentAttachments([]);
    setCcUserIds([]);
    setPartnerInputValue('');
    setVoucherData({
      formType: 'general',
      department: '',
      partnerId: '',
      voucherNo: '',
      gstNumber: '',
      voucherDate: todayDate,
      partnerRepresentative: '',
      partnerAddress: '',
      partnerPhone: '',
      partnerEmail: '',
      partnerPan: '',
      acHolder: '',
      bank: '',
      accountNumber: '',
      ifsc: '',
      paymentDate: '',
      paymentStatus: '',
      amountInWords: '',
      remarks: '',
      checkedById: '',
      approvedById: '',
      igstRate: 0,
      cgstRate: 0,
      sgstRate: 0,
      tdsEnabled: false,
      tdsRate: 0,
      gstRoundingAdjustment: 0,
      gstProfessionalTax: 0,
      perLineGst: false,
      isPrepaid: false,
      noInvoice: false,
      invoiceMode: 'tax' as ExpenseInvoiceType,
    });
    setReceiptInvoiceType('tax');
    setDraftId(null);
    draftIdReadyRef.current = null;
    setHeaderStatusBanner('');
    draftInitInFlightRef.current = false;
    submitInFlightRef.current = false;
    lastAutoSavedJsonRef.current = '';
    setAutoSaveHint('');
    autoSaveSkipUntilRef.current = 0;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setViewMode('create');
  };

  const leaveExpenseForm = useCallback(async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    // 제출 중이 아니면 대기 중인 초안 자동 저장을 먼저 반영
    try {
      await persistDraftAutoSave();
    } catch {
      /* 목록 복귀는 계속 진행 */
    }
    autoSaveSeqRef.current += 1;
    lastAutoSavedJsonRef.current = '';
    setAutoSaveHint('');
    setSelectedExpense(null);
    setDraftId(null);
    draftIdReadyRef.current = null;
    draftInitInFlightRef.current = false;
    submitInFlightRef.current = false;
    setHeaderStatusBanner('');
    setIsInitializingDraft(false);
    setListTab('written');
    setStatusFilter(DEFAULT_LIST_STATUS_FILTER);
    setPage(1);
    setViewMode('list');
    await loadExpenseData();
  }, [persistDraftAutoSave, loadExpenseData]);

  const handleSaveExpense = async (editReason?: string) => {
    if (saving || submitInFlightRef.current) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    autoSaveSeqRef.current += 1;
    setAutoSaveHint('');
    if (viewMode === 'edit' ? !editGuard.guard() : !createGuard.guard()) return;
    if (!formData.title.trim()) {
      setError(t('expenseApproval.errors.requiredTitlePurpose'));
      return;
    }
    if (!voucherData.approvedById) {
      setError(t('expenseApproval.errors.approverRequired'));
      return;
    }
    if (
      voucherData.formType !== 'tds' &&
      !currentAttachments.length &&
      !String(voucherData.remarks || '').trim()
    ) {
      setError(t('expenseApproval.errors.receiptOrRemarksRequired'));
      return;
    }
    if (isSameUserId(voucherData.approvedById, user?.id)) {
      setError(t('expenseApproval.errors.cannotSelectSelf'));
      return;
    }
    const activeExpenseId = await ensureDraftReady();
    if (!activeExpenseId) {
      setError(t('expenseApproval.errors.draftNotReadyRetry'));
      return;
    }
    const isRevisionResubmitEdit =
      viewMode === 'edit' &&
      selectedExpense != null &&
      isRevisionRejectedExpense(selectedExpense);
    const isPreApprovalEdit =
      viewMode === 'edit' &&
      selectedExpense != null &&
      (selectedExpense.status === 'submitted' || selectedExpense.status === 'in_review');
    if (isRevisionResubmitEdit && !String(editReason || '').trim()) {
      setReasonDialogType('expense-edit');
      setReasonTargetId(activeExpenseId);
      setReasonText('');
      setReasonDialogOpen(true);
      return;
    }
    setSaving(true);
    submitInFlightRef.current = true;
    try {
      const payload = {
        ...buildExpensePayload('submitted'),
        ...(isRevisionResubmitEdit && editReason?.trim() ? { edit_reason: editReason.trim() } : {}),
      };
      const response = await accountingService.updateExpenseReport(activeExpenseId, payload);
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.submitResponseFailed'));
      }
      await leaveExpenseForm();
      setSuccess(
        isRevisionResubmitEdit
          ? t('expenseApproval.success.resubmittedAfterRevision')
          : isPreApprovalEdit
            ? t('expenseApproval.success.edited')
            : t('expenseApproval.success.submitted')
      );
    } catch (saveError: any) {
      submitInFlightRef.current = false;
      setError(
        localizeExpenseApiError(
          saveError?.response?.data?.message || saveError?.message,
          'expenseApproval.errors.submitFailed'
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const createEmptyLineItem = (formType: ExpenseFormType = voucherData.formType): ExpenseItem => {
    if (formType === 'tds') {
      return {
    id: `${Date.now()}-${Math.random()}`,
        invoiceDate: todayDate,
    description: '',
    qty: 1,
    unitPrice: 0,
        amount: 0,
        pan: '',
        deducteePartnerId: '',
        tdsRate: 0,
        deducteeType: 'other',
        tdsSection: '',
        tdsCode: '',
        tdsAmount: 0,
        tdsInterest: 0,
        remarks: '',
        total: 0,
      };
    }
    return {
      id: `${Date.now()}-${Math.random()}`,
      invoiceDate: todayDate,
      description: '',
      qty: 1,
      unitPrice: 0,
      total: 0,
      igstRate: 0,
      cgstRate: 0,
      sgstRate: 0,
    };
  };

  const handleChangeFormType = (next: ExpenseFormType) => {
    if (next === voucherData.formType) return;
    setVoucherData((prev) => ({
      ...prev,
      formType: next,
      igstRate: next === 'general' ? prev.igstRate : 0,
      cgstRate: next === 'general' ? prev.cgstRate : 0,
      sgstRate: next === 'general' ? prev.sgstRate : 0,
      tdsEnabled: next === 'general' ? prev.tdsEnabled : false,
      tdsRate: next === 'general' ? prev.tdsRate : 0,
      perLineGst: next === 'general' ? prev.perLineGst : false,
      gstRoundingAdjustment: next === 'gst' ? prev.gstRoundingAdjustment : 0,
      gstProfessionalTax: next === 'gst' ? prev.gstProfessionalTax : 0,
      isPrepaid: next === 'gst' || next === 'tds' ? false : prev.isPrepaid,
      noInvoice: next === 'gst' || next === 'tds' ? false : prev.noInvoice,
      invoiceMode:
        next === 'gst' || next === 'tds'
          ? ('tax' as ExpenseInvoiceType)
          : prev.invoiceMode,
    }));
    setLineItems(next === 'gst' ? createGstSummaryLineItems() : [createEmptyLineItem(next)]);
    if (next === 'gst' || next === 'tds') {
      setFormData((prev) => ({
        ...prev,
        title: buildPaymentVoucherTitle(next === 'gst' ? 'GST' : 'TDS', voucherData.voucherDate),
      }));
    }
  };

  const handleUpdateGstSummaryRow = (
    id: string,
    field: 'taxableValue' | 'igst' | 'cgst' | 'sgst',
    value: number
  ) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.gstRowKey === 'lateFee' && (field === 'igst' || field === 'cgst' || field === 'sgst')) {
          // 연체료 세목은 계산금액 기준 자동 배분 — 수동 세목 변경 차단
          return item;
        }
        const safeValue = nonNegDecimal(value);
        const nextItem: ExpenseItem = applyGstSummaryRowRules({
          ...item,
          [field]: safeValue,
        });
        return nextItem;
      })
    );
  };

  const patchGstInterestExtra = (
    id: string,
    patch: Partial<GstInterestExtra>,
    options?: { forceAuto?: boolean }
  ) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.gstRowKey !== 'interest') return item;
        const current =
          item.gstExtra?.kind === 'interest' ? item.gstExtra : createDefaultInterestExtra();
        const amountMode: GstAmountMode = options?.forceAuto
          ? 'auto'
          : patch.amountMode ?? current.amountMode;
        const nextExtra = recomputeInterestExtra({ ...current, ...patch, amountMode });
        return {
          ...item,
          gstExtra: nextExtra,
          taxableValue: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          total: nextExtra.amount,
        };
      })
    );
  };

  const patchGstLateFeeExtra = (
    id: string,
    patch: Partial<GstLateFeeExtra>,
    options?: { forceAuto?: boolean }
  ) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.gstRowKey !== 'lateFee') return item;
        const current =
          item.gstExtra?.kind === 'lateFee' ? item.gstExtra : createDefaultLateFeeExtra();
        const amountMode: GstAmountMode = options?.forceAuto
          ? 'auto'
          : patch.amountMode ?? current.amountMode;
        const nextExtra = recomputeLateFeeExtra({ ...current, ...patch, amountMode });
        const heads = applyLateFeeHeadsFromAmount(nextExtra.amount);
        return {
          ...item,
          gstExtra: nextExtra,
          ...heads,
          total: nextExtra.amount,
        };
      })
    );
  };

  const patchVoucherTaxRates = (patch: Partial<typeof voucherData>) => {
    setVoucherData((prev) => {
      // GST 번호 없으면 세율 입력·적용 불가
      if (!hasExpenseGstNumber(prev.gstNumber)) {
        return { ...prev, igstRate: 0, cgstRate: 0, sgstRate: 0 };
      }
      if (prev.perLineGst) {
        return prev;
      }
      const partnerState = gstStateCode(prev.gstNumber);
      const companyState = companyGstState || gstStateCode(companyGstNumber);
      const canCompare = Boolean(partnerState && companyState);
      const intra = canCompare && partnerState === companyState;
      const inter = canCompare && partnerState !== companyState;

      const next = { ...prev, ...patch };

      if ('cgstRate' in patch) {
        // 주 비교 가능할 때만 주간이면 CGST 차단
        if (canCompare && !intra) {
          return { ...prev, cgstRate: 0, sgstRate: 0 };
        }
        const cgst = normalizeAllowedHalfGstRate(Number(patch.cgstRate ?? 0));
        next.cgstRate = cgst;
        next.sgstRate = cgst;
        next.igstRate = 0;
      }

      if ('igstRate' in patch) {
        if (canCompare && !inter) {
          return { ...prev, igstRate: 0 };
        }
        const igst = normalizeAllowedIgstRate(Number(patch.igstRate ?? 0));
        next.igstRate = igst;
        next.cgstRate = 0;
        next.sgstRate = 0;
      }

      return next;
    });
  };

  const patchLineItemGstRate = (id: string, kind: 'igst' | 'cgst', value: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (!hasExpenseGstNumber(voucherData.gstNumber)) {
          return { ...item, igstRate: 0, cgstRate: 0, sgstRate: 0 };
        }
        if (kind === 'igst') {
          if (canCompareGstStates && !isInterStateGst) return { ...item, igstRate: 0 };
          const igst = normalizeAllowedIgstRate(Number(value || 0));
          return { ...item, igstRate: igst, cgstRate: 0, sgstRate: 0 };
        }
        if (canCompareGstStates && !isIntraStateGst) return { ...item, cgstRate: 0, sgstRate: 0 };
        const cgst = normalizeAllowedHalfGstRate(Number(value || 0));
        return { ...item, cgstRate: cgst, sgstRate: cgst, igstRate: 0 };
      })
    );
  };

  const togglePerLineGst = (checked: boolean) => {
    if (!hasExpenseGstNumber(voucherData.gstNumber)) return;
    setVoucherData((prev) => ({
      ...prev,
      perLineGst: checked,
      ...(checked ? { igstRate: 0, cgstRate: 0, sgstRate: 0 } : {}),
    }));
    if (!checked) {
      setLineItems((prev) =>
        prev.map((item) => ({ ...item, igstRate: 0, cgstRate: 0, sgstRate: 0 }))
      );
    }
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [...prev, createEmptyLineItem()]);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateLineItem = (id: string, field: keyof ExpenseItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextItem: ExpenseItem = { ...item, [field]: value };
        if (voucherData.formType === 'tds') {
          if (field === 'amount' || field === 'unitPrice') {
            const base = floorMoney(Number(value || 0));
            nextItem.amount = base;
            nextItem.unitPrice = base;
            nextItem.qty = 1;
          }
          if (field === 'tdsRate') {
            nextItem.tdsRate = Number(value || 0);
          }
          if (field === 'tdsInterest') {
            nextItem.tdsInterest = floorMoney(Number(value || 0));
          }
          if (field === 'tdsAmount') {
            nextItem.tdsAmount = floorMoney(Number(value || 0));
          }
          const calc = calcTdsLineAmounts(nextItem);
          nextItem.amount = calc.base;
          nextItem.unitPrice = calc.base;
          const manualTds = isOtherTdsDeductee(nextItem);
          if (manualTds && field === 'deducteeType') {
            nextItem.tdsAmount = floorMoney(Number(item.tdsAmount ?? calc.tdsAmt));
          } else if (!manualTds) {
            nextItem.tdsAmount = calc.tdsAmt;
          } else if (field !== 'tdsAmount') {
            nextItem.tdsAmount = floorMoney(Number(item.tdsAmount || 0));
          }
          nextItem.total = floorMoney(Number(nextItem.tdsAmount || 0));
          return nextItem;
        }
        if (field === 'qty') {
          nextItem.qty = roundDecimal2(Number(value || 0));
        }
        if (field === 'unitPrice') {
          nextItem.unitPrice = roundDecimal2(Number(value || 0));
        }
        const qty = Number(nextItem.qty || 0);
        const unitPrice = Number(nextItem.unitPrice || 0);
        nextItem.total = roundDecimal2(qty * unitPrice);
        return nextItem;
      })
    );
  };

  const setInputRef = (id: string, field: string) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    inputRefs.current[`${id}-${field}`] = el;
  };

  const focusField = (id: string, field: string) => {
    const el = inputRefs.current[`${id}-${field}`];
    if (el) el.focus();
  };

  const handleLineItemKeyDown = (id: string, field: string, rowIndex: number) => (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    // 설명: Alt+Enter → 줄바꿈, Enter → 다음 칸
    if (field === 'description' && event.altKey) {
      event.preventDefault();
      const target = event.target as HTMLTextAreaElement;
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const next = `${target.value.slice(0, start)}\n${target.value.slice(end)}`;
      handleUpdateLineItem(id, 'description', next);
      requestAnimationFrame(() => {
        const el = inputRefs.current[`${id}-description`] as HTMLTextAreaElement | null;
        if (!el) return;
        const pos = start + 1;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    event.preventDefault();
    if (field === 'invoiceDate') {
      focusField(id, 'description');
      return;
    }
    if (field === 'description') {
      focusField(id, 'qty');
      return;
    }
    if (field === 'qty') {
      focusField(id, 'unitPrice');
      return;
    }
    if (field === 'unitPrice') {
      const newItem = createEmptyLineItem();
      setLineItems((prev) => {
        const next = [...prev, newItem];
        return next;
      });
      setTimeout(() => {
        focusField(newItem.id, 'description');
      }, 0);
    }
  };

  const handleOpenQr = async () => {
    const activeExpenseId = await ensureDraftReady();
    if (!activeExpenseId) {
      setError(t('expenseApproval.errors.draftNotReady'));
      return;
    }
    setQrLoading(true);
    try {
      const response = await accountingService.getReceiptUploadToken(activeExpenseId);
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.qrTokenFailed'));
      }
      setQrToken(response.token);
      setQrOpen(true);
    } catch (qrError) {
      setError(t('expenseApproval.errors.qrTokenFailed'));
    } finally {
      setQrLoading(false);
    }
  };

  /** QR 업로드 중 첨부 목록을 주기적으로 갱신해 화면에 바로 반영 */
  useEffect(() => {
    if (!qrOpen) return;
    const activeExpenseId = viewMode === 'edit' ? selectedExpense?.id : draftId;
    if (!activeExpenseId) return;

    let cancelled = false;
    let lastCount = -1;

    const refreshAttachments = async () => {
      try {
        const response = await accountingService.getExpenseReport(activeExpenseId);
        if (cancelled || !response?.success) return;
        const next = normalizeExpenseAttachments(response.data?.attachments);
        if (lastCount >= 0 && next.length > lastCount) {
          setSuccess(t('expenseApproval.success.receiptAttached'));
        }
        lastCount = next.length;
        setCurrentAttachments(next);
        if (viewMode === 'edit') {
          setSelectedExpense((prev) =>
            prev && prev.id === activeExpenseId ? { ...prev, attachments: next } : prev
          );
        }
      } catch (pollError) {
      }
    };

    refreshAttachments();
    const timer = window.setInterval(refreshAttachments, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [qrOpen, viewMode, selectedExpense?.id, draftId, t]);

  const openAttachment = (file: string) => {
    setPreviewLoadError(false);
    setPreviewAttachment(file);
    setPreviewDownloadName(getReceiptDisplayName(file));
  };

  const closeAttachmentPreview = () => {
    setPreviewAttachment(null);
    setPreviewDownloadName('');
    setPreviewBlobUrl('');
    setPreviewLoading(false);
    setPreviewLoadError(false);
  };

  const resolvePreviewDownloadName = useCallback(() => {
    if (!previewAttachment) return 'download';
    const original = getReceiptDisplayName(previewAttachment);
    const ext = getFileExtension(previewAttachment);
    const draft = stripCorporateSuffixFromFilename(
      String(previewDownloadName || '')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
    );
    if (!draft) return original;
    const withoutExt = draft.replace(/\.[^.]+$/, '').trim() || draft;
    return ext ? `${withoutExt}.${ext}` : withoutExt;
  }, [previewAttachment, previewDownloadName]);

  useEffect(() => {
    if (!previewAttachment || isImageReceipt(previewAttachment)) {
      setPreviewBlobUrl('');
      setPreviewLoading(false);
      setPreviewLoadError(false);
      return;
    }

    if (!isPdfReceipt(previewAttachment)) {
      setPreviewBlobUrl('');
      setPreviewLoading(false);
      setPreviewLoadError(false);
      return;
    }

    let cancelled = false;
    let objectUrl = '';
    setPreviewLoading(true);
    setPreviewLoadError(false);
    setPreviewBlobUrl('');

    void (async () => {
      try {
        const url = await fetchUploadObjectUrl(previewAttachment, {
          forceMime: 'application/pdf',
        });
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setPreviewBlobUrl(url);
      } catch {
        if (!cancelled) {
          setPreviewLoadError(true);
          setPreviewBlobUrl('');
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewAttachment]);

  const handleDeleteReceipt = async (file: ExpenseAttachment) => {
    if (file.path.includes('expense-remittance-proofs')) return;
    const activeExpenseId = await ensureDraftReady();
    if (!activeExpenseId) {
      setError(t('expenseApproval.errors.draftNotReady'));
      return;
    }
    setDeletingReceiptPath(file.path);
    try {
      const response = await accountingService.deleteExpenseReceipt(activeExpenseId, file.path);
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.receiptDeleteFailed'));
      }
      const next = normalizeExpenseAttachments(response.data?.attachments);
      setCurrentAttachments(next);
      setSelectedExpense((prev) =>
        prev && prev.id === activeExpenseId ? { ...prev, attachments: next } : prev
      );
      setExpenses((prev) =>
        prev.map((item) => (item.id === activeExpenseId ? { ...item, attachments: next } : item))
      );
      setSuccess(t('expenseApproval.success.receiptDeleted'));
    } catch (deleteError: any) {
      setError(
        String(deleteError?.response?.data?.message || deleteError?.message || '').trim() ||
          t('expenseApproval.errors.receiptDeleteFailed')
      );
    } finally {
      setDeletingReceiptPath(null);
    }
  };

  const renderAttachmentList = (
    files: ExpenseAttachment[] | string[],
    options?: { deletable?: boolean; onDelete?: (file: ExpenseAttachment) => void; typeLabel?: string }
  ) => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 110px))',
        gap: 1,
        justifyContent: 'flex-start',
      }}
    >
      {normalizeExpenseAttachments(files).map((file, index) => {
        const displayName = getReceiptDisplayName(file.path);
        const image = isImageReceipt(file.path);
        const typeLabel =
          options?.typeLabel ||
          (file.invoiceType === 'proforma'
            ? t('expenseApproval.voucher.invoiceTypeProforma')
            : file.invoiceType === 'none'
              ? t('expenseApproval.voucher.invoiceTypeNone')
              : t('expenseApproval.voucher.invoiceTypeTax'));
        const showTypeBadge = !file.path.includes('expense-remittance-proofs');
        const canDelete =
          Boolean(options?.deletable && options?.onDelete) &&
          !file.path.includes('expense-remittance-proofs');
        const isDeleting = deletingReceiptPath === file.path;
        return (
          <Box
            key={`${file.path}-${index}`}
            sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              width: '100%',
              maxWidth: 110,
            }}
          >
            {canDelete ? (
              <IconButton
                size="small"
                aria-label={t('expenseApproval.voucher.receiptDelete')}
                disabled={Boolean(deletingReceiptPath)}
                onClick={(event) => {
                  event.stopPropagation();
                  void options?.onDelete?.(file);
                }}
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  zIndex: 2,
                  width: 22,
                  height: 22,
                  bgcolor: 'rgba(255,255,255,0.92)',
                  border: '1px solid #CBD5E1',
                  '&:hover': { bgcolor: '#FEE2E2', borderColor: 'error.main' },
                }}
              >
                {isDeleting ? (
                  <CircularProgress size={12} />
                ) : (
                  <DeleteIcon sx={{ fontSize: 14, color: 'error.main' }} />
                )}
              </IconButton>
            ) : null}
            <Box
              component="button"
              type="button"
              onClick={() => openAttachment(file.path)}
              sx={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                width: '100%',
                borderRadius: '8px',
                transition: 'border-color 0.15s ease',
                '&:hover': {
                  '& .receipt-thumb': {
                    borderColor: 'primary.main',
                  },
                },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 2,
                },
              }}
            >
            <Box
              className="receipt-thumb"
              sx={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid',
                borderColor: '#CBD5E1',
                bgcolor: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center' }}
            >
              {image ? (
                <AuthMedia
                  src={file.path}
                  alt={displayName}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block' }}
                />
              ) : (
                <FileIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              )}
              {showTypeBadge ? (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 4,
                    top: 4,
                    px: 0.5,
                    py: 0.15,
                    borderRadius: '2px',
                    bgcolor:
                      file.invoiceType === 'proforma'
                        ? '#FEF3C7'
                        : file.invoiceType === 'none'
                          ? '#E5E7EB'
                          : '#DCFCE7',
                    color:
                      file.invoiceType === 'proforma'
                        ? '#92400E'
                        : file.invoiceType === 'none'
                          ? '#374151'
                          : '#166534',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
                  {typeLabel}
                </Box>
              ) : null}
            </Box>
            <Typography
              variant="caption"
              title={`${displayName} (${typeLabel})`}
              sx={{
                px: 0.25,
                fontWeight: 600,
                fontSize: '0.7rem',
                color: 'text.primary',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.35 }}
            >
              {displayName}
            </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );

  const handleUploadReceipts = async (files: FileList | null) => {
    // FileList는 input value 초기화 시 같이 비워지므로 즉시 스냅샷
    const selectedFiles = files && files.length > 0 ? Array.from(files) : [];
    if (selectedFiles.length === 0) return;
    const activeFormType =
      viewMode === 'view' || viewMode === 'edit'
        ? resolveExpenseFormType(selectedExpense?.itemMeta)
        : voucherData.formType;
    const invoiceTypeForUpload: ExpenseInvoiceType =
      activeFormType === 'gst' ? 'tax' : receiptInvoiceType;
    if (activeFormType !== 'gst' && !receiptInvoiceType) {
      setError(t('expenseApproval.errors.invoiceTypeRequired'));
      return;
    }
    const activeExpenseId =
      viewMode === 'edit' || viewMode === 'view'
        ? selectedExpense?.id ?? null
        : await ensureDraftReady();
    if (!activeExpenseId) {
      setError(t('expenseApproval.errors.draftNotReady'));
      return;
    }
    const wasAwaitingTaxInvoice =
      viewMode === 'view' &&
      selectedExpense != null &&
      expenseIsAwaitingTaxInvoice(selectedExpense);
    // 보기 모드: 택스 인보이스 대기 업로드만 허용. 그 외 첨부는 수정하기 후 edit에서만.
    if (viewMode === 'view' && !wasAwaitingTaxInvoice) {
      return;
    }
    const uploadingTaxInvoice =
      invoiceTypeForUpload === 'tax' || activeFormType === 'gst';
    // 승인 이후 Tax Invoice가 이미 있으면 재업로드 안내
    if (
      viewMode === 'view' &&
      selectedExpense != null &&
      uploadingTaxInvoice &&
      (selectedExpense.status === 'approved' || selectedExpense.status === 'paid') &&
      expenseHasTaxInvoice(selectedExpense.attachments) &&
      !wasAwaitingTaxInvoice
    ) {
      setError(t('expenseApproval.errors.taxInvoiceAlreadyAttached'));
      return;
    }
    try {
      setUploadingReceipts(true);
      const companyLabel =
        String(
          (voucherData as any).partnerName ||
            voucherData.department ||
            selectedExpense?.itemMeta?.partnerName ||
            selectedExpense?.itemMeta?.department ||
            selectedExpense?.companyName ||
            ''
        ).trim() || 'Company';
      const detailLabel =
        String(formData.title || selectedExpense?.title || '').trim() ||
        String(formData.purpose || selectedExpense?.purpose || '').trim() ||
        String(lineItems[0]?.description || '').trim() ||
        (uploadingTaxInvoice ? 'RI' : 'PI');
      // Tax Invoice → RI / Proforma·인보이스 없음 → PI
      const receiptCode = uploadingTaxInvoice ? 'RI' : 'PI';
      const renamed = selectedFiles.map((file) => {
        const mimeExt = String(file.type || '')
          .split('/')
          .pop()
          ?.replace(/^jpeg$/, 'jpg')
          .replace(/^vnd\.ms-excel$/, 'xls')
          .replace(/^vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet$/, 'xlsx')
          .replace(/^vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/, 'docx')
          .replace(/^msword$/, 'doc');
        const ext = getFileExtension(file.name) || mimeExt || 'bin';
        const nextName = buildDocumentDownloadFilename({
          code: receiptCode,
          companyName: companyLabel,
          detail: detailLabel,
          extension: ext,
        });
        return renameFileKeepingExtension(file, nextName);
      });
      const response = await accountingService.uploadExpenseReceiptById(
        activeExpenseId,
        renamed,
        invoiceTypeForUpload
      );
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.receiptUploadFailed'));
      }
      const next = normalizeExpenseAttachments(response.data?.attachments);
      setCurrentAttachments(next);
      const uploadedTaxInvoice = uploadingTaxInvoice;
      if (response.data) {
        const mapped = mapExpense(response.data);
        if (selectedExpense && selectedExpense.id === activeExpenseId) {
          setSelectedExpense(mapped);
        }
        setExpenses((prev) => prev.map((row) => (row.id === mapped.id ? mapped : row)));
      } else if (selectedExpense && selectedExpense.id === activeExpenseId) {
        const patched = {
          ...selectedExpense,
          attachments: next,
          status: (response.data?.status as ExpenseApprovalItem['status']) || selectedExpense.status,
          paymentRequestStatus:
            response.data?.payment_request_status ?? selectedExpense.paymentRequestStatus,
        };
        setSelectedExpense(patched);
        setExpenses((prev) =>
          prev.map((row) => (row.id === activeExpenseId ? { ...row, ...patched } : row))
        );
      }
      // 택스 인보이스 대기 중 업로드: 상세에 남기고 저장 완료 메시지만 표시, 목록은 백그라운드 갱신
      if (wasAwaitingTaxInvoice && uploadedTaxInvoice) {
        setSuccess(t('expenseApproval.success.saveCompleted'));
        void refreshExpenseListQuietly();
        return;
      }
      setSuccess(
        activeFormType === 'gst'
          ? t('expenseApproval.success.calculationAttached')
          : invoiceTypeForUpload === 'proforma'
            ? t('expenseApproval.success.proformaAttached')
            : invoiceTypeForUpload === 'none'
              ? t('expenseApproval.success.noInvoiceAttached')
              : t('expenseApproval.success.taxInvoiceAttached')
      );
    } catch (uploadError: any) {
      setError(
        localizeExpenseApiError(
          uploadError?.response?.data?.message || uploadError?.message,
          'expenseApproval.errors.receiptUploadFailed'
        )
      );
    } finally {
      setUploadingReceipts(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!deleteGuard.guard()) return;
    setDeleteTargetId(id);
  };

  const confirmDeleteExpense = async () => {
    if (!deleteGuard.guard() || !deleteTargetId) return;
    const deletedId = deleteTargetId;
    try {
      const response = await accountingService.deleteExpenseReport(deletedId);
      if (!response.success) {
        throw new Error(response.message || t('expenseApproval.errors.deleteFailed'));
      }
      if (selectedExpense?.id === deletedId) {
        setSelectedExpense(null);
        setViewMode('list');
      }
      await refreshExpenseListQuietly();
      setExpenses((prev) => prev.filter((item) => item.id !== deletedId));
      setSuccess(t('expenseApproval.success.deleted'));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('expenseApproval.errors.deleteFailed'));
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleApproveExpense = (id: number) => {
    accountingService
      .updateExpenseReportStatus(id, 'approved')
      .then(() => syncExpenseAfterMutation(id, { clearSelection: true }))
      .then(() => {
        setListTab('received');
        setSuccess(t('expenseApproval.success.approved'));
      })
      .catch(() => {
        setError(t('expenseApproval.errors.approveFailed'));
      });
  };

  const handleRejectExpense = (id: number, reason: string) => {
    accountingService
      .updateExpenseReportStatus(id, 'rejected', { reason, reject_kind: 'final' })
      .then(() => syncExpenseAfterMutation(id))
      .then(() => {
        setSuccess(t('expenseApproval.success.rejected'));
      })
      .catch(() => {
        setError(t('expenseApproval.errors.rejectFailed'));
      });
  };

  const handleRevisionRejectExpense = (id: number, reason: string) => {
    accountingService
      .updateExpenseReportStatus(id, 'rejected', { reason, reject_kind: 'revision' })
      .then(() => syncExpenseAfterMutation(id))
      .then(() => {
        setSuccess(t('expenseApproval.success.revisionRejected'));
      })
      .catch(() => {
        setError(t('expenseApproval.errors.revisionRejectFailed'));
      });
  };

  const handleResubmitExpense = (id: number) => {
    accountingService
      .updateExpenseReportStatus(id, 'submitted')
      .then(() => syncExpenseAfterMutation(id))
      .then(() => {
        setSuccess(t('expenseApproval.success.resubmitted'));
      })
      .catch((resubmitError: any) => {
        setError(
          resubmitError?.response?.data?.message || t('expenseApproval.errors.resubmitFailed')
        );
      });
  };

  const isDesignatedApprover = (expense: ExpenseApprovalItem) => {
    if (!user?.id) return false;
    return (
      isSameUserId(expense.itemMeta?.approvedById, user.id) ||
      isSameUserId(expense.currentApproverId, user.id)
    );
  };

  const isExpensePaymentCompleted = (expense: ExpenseApprovalItem) => {
    const total = floorMoney(Number(expense.totalAmount || 0));
    if (total <= 0) return false;
    const remaining = getExpenseRemainingAmount(expense);
    const paymentPaid = String(expense.paymentRequestStatus || '').toLowerCase() === 'paid';
    return (
      paymentPaid ||
      expense.status === 'paid' ||
      (Number(expense.paidAmount || 0) > 0 && remaining <= 0 && ['approved', 'paid'].includes(expense.status))
    );
  };

  const canUserApproveExpense = (expense: ExpenseApprovalItem) => {
    if (!['submitted', 'in_review'].includes(expense.status)) return false;
    // root: 지정 승인자가 아니어도 타사 결의서 승인 가능
    if (isRootUser) return true;
    return isDesignatedApprover(expense);
  };

  const canUserRevisionRejectExpense = (expense: ExpenseApprovalItem) => {
    // root: 승인·지급 완료 후에도 수정 반려 가능
    if (isRootUser) {
      return (
        ['submitted', 'in_review', 'approved', 'paid'].includes(expense.status) ||
        isExpensePaymentCompleted(expense)
      );
    }
    if (isExpensePaymentCompleted(expense)) return false;
    if (!['submitted', 'in_review', 'approved'].includes(expense.status)) return false;
    return isDesignatedApprover(expense);
  };

  /** root 전용: 승인·지급 완료 후 최종 반려 */
  const canUserFinalRejectExpense = (expense: ExpenseApprovalItem) => {
    if (!isRootUser) return false;
    return (
      ['approved', 'paid'].includes(expense.status) || isExpensePaymentCompleted(expense)
    );
  };

  const canChangeExpenseApprover = (expense: ExpenseApprovalItem) => {
    if (!user?.id) return false;
    if (['approved', 'rejected', 'paid'].includes(expense.status)) return false;
    if (isRootUser) return true;
    return isDesignatedApprover(expense);
  };

  const canEditExpense = (expense: ExpenseApprovalItem) => {
    if (!user?.id) return false;
    // 목록 탭과 무관 — 작성자면 상세에서 수정 가능 (수정 반려 포함)
    if (!isSameUserId(expense.requesterId, user.id)) return false;
    // 초안·수정반려·제출/검토 중(승인 전)만 작성자 수정 가능
    return (
      expense.status === 'draft' ||
      expense.status === 'submitted' ||
      expense.status === 'in_review' ||
      isRevisionRejectedExpense(expense)
    );
  };

  const canResubmitExpense = (expense: ExpenseApprovalItem) => {
    if (!user?.id) return false;
    if (!isSameUserId(expense.requesterId, user.id)) return false;
    return expense.status === 'rejected' && !isRevisionRejectedExpense(expense);
  };

  const canDeleteExpense = (expense: ExpenseApprovalItem) => {
    if (!user?.id) return false;

    // root: 승인·지급 완료·송금 탭 포함 소프트 삭제 가능
    if (isRootUser) {
      return (
        ['draft', 'submitted', 'in_review', 'rejected', 'approved', 'paid'].includes(expense.status) ||
        isExpensePaymentCompleted(expense) ||
        floorMoney(Number(expense.totalAmount || 0)) <= 0
      );
    }

    if (listTab === 'transfer') return false;

    // 목록에 '지급 완료'로 보이는 건(문서 status와 무관) 삭제 불가
    if (resolveDisplayStatus(expense) === 'paid') return false;
    if (expense.status === 'paid') return false;

    if (['approved', 'paid'].includes(expense.status)) return false;
    if (!isSameUserId(expense.requesterId, user.id)) return false;
    // 일반 작성자: 초안·반려만 (제출/검토 중은 삭제 불가)
    if (['submitted', 'in_review'].includes(expense.status)) return false;
    return true;
  };

  const getExpenseGrandTotal = useCallback(
    (expense: ExpenseApprovalItem) =>
      calcExpenseTax(expense.items, expense.itemMeta, companyGstNumber, companyGstState).grandTotal,
    [companyGstNumber, companyGstState]
  );

  const openReasonDialog = (
    type: 'payment-approve' | 'payment-reject' | 'expense-reject' | 'expense-revision-reject',
    id: number
  ) => {
    setReasonDialogType(type);
    setReasonTargetId(id);
    setReasonText('');
    setReasonDialogOpen(true);
  };

  const closeReasonDialog = () => {
    setReasonDialogOpen(false);
    setReasonTargetId(null);
    setReasonText('');
  };

  const handleRequestPayment = async (id: number) => {
    try {
      const response = await accountingService.requestExpensePayment(id);
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.paymentRequestFailed'));
      }
      await syncExpenseAfterMutation(id);
      setSuccess(t('expenseApproval.success.paymentRequested'));
    } catch {
      setError(t('expenseApproval.errors.paymentRequestFailed'));
    }
  };

  const setRemittanceProofFile = useCallback((file: File | null) => {
    if (!file) {
      setPaymentProofFile(null);
      setProofNameDraft('');
      return;
    }
    const meta = selectedExpense?.itemMeta || {};
    const linkedPartner = partners.find((p) => String(p.id) === String(meta.partnerId || voucherData.partnerId || ''));
    const partnerName =
      String(meta.department || '').trim() ||
      String(voucherData.department || '').trim() ||
      String(linkedPartner?.company_name || '').trim() ||
      '';
    const named = new File(
      [file],
      buildRemittanceProofFileName(file, {
        partnerName,
      }),
      { type: file.type, lastModified: file.lastModified }
    );
    setPaymentProofFile(named);
    setProofNameDraft(stripFileExtensionForDisplay(named.name));
  }, [
    partners,
    selectedExpense?.itemMeta,
    voucherData.department,
    voucherData.partnerId,
  ]);

  const applyProofFileName = useCallback((nextName: string) => {
    setPaymentProofFile((prev) => {
      if (!prev) return prev;
      const renamed = renameFileKeepingExtension(prev, nextName);
      setProofNameDraft(stripFileExtensionForDisplay(renamed.name));
      return renamed;
    });
  }, []);

  useEffect(() => {
    if (!paymentProofFile || !paymentProofFile.type.startsWith('image/')) {
      setPaymentProofPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(paymentProofFile);
    setPaymentProofPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [paymentProofFile]);

  useEffect(() => {
    if (!paymentDialogOpen) return;
    const onPaste: EventListener = (event) => {
      const items = (event as ClipboardEvent).clipboardData?.items;
      if (!items?.length) return;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item.type.startsWith('image/')) continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        event.preventDefault();
        const ext = (item.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        const file = new File([blob], `paste.${ext}`, { type: item.type });
        setRemittanceProofFile(file);
        break;
      }
    };
    window.addEventListener('paste', onPaste as EventListener);
    return () => window.removeEventListener('paste', onPaste as EventListener);
  }, [paymentDialogOpen, setRemittanceProofFile]);

  const openPaymentDialog = (_mode: 'complete' | 'retry' = 'complete') => {
    if (!selectedExpense) return;
    const remaining = getExpenseRemainingAmount(selectedExpense);
    setPaymentAmountInput(remaining > 0 ? String(remaining) : String(selectedExpense.totalAmount || ''));
    setRemittanceProofFile(null);
    setProofNameDraft('');
    setPaymentDialogOpen(true);
  };

  const handleCompletePayment = async (id: number, amount?: number, proof?: File | null) => {
    try {
      setPaymentSubmitting(true);
      if (!proof) {
        setError(t('expenseApproval.errors.remittanceProofRequired'));
        return;
      }
      const response = await accountingService.completeExpensePayment(id, amount, proof);
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.paymentCompleteFailed'));
      }
      setPaymentDialogOpen(false);
      setRemittanceProofFile(null);
      const remaining = Number(response?.remaining_amount);
      if (response?.awaiting_tax_invoice) {
        setSuccess(t('expenseApproval.success.remittanceAwaitingTax'));
        if (response?.data) {
          const mapped = mapExpense(response.data);
          setSelectedExpense(mapped);
          setExpenses((prev) => prev.map((item) => (item.id === mapped.id ? mapped : item)));
        }
        await syncExpenseAfterMutation(id, { syncDetail: !response?.data });
        setViewMode('view');
      } else if (Number.isFinite(remaining) && remaining > 0) {
        setSuccess(t('expenseApproval.success.partialPaymentCompleted', { remaining }));
        if (response?.data) {
          const mapped = mapExpense(response.data);
          setSelectedExpense(mapped);
          setExpenses((prev) => prev.map((item) => (item.id === mapped.id ? mapped : item)));
          await refreshExpenseListQuietly();
        } else {
          await syncExpenseAfterMutation(id);
        }
      } else {
      setSuccess(t('expenseApproval.success.paymentCompleted'));
        await syncExpenseAfterMutation(id, { clearSelection: true });
        setListTab('transfer');
        setStatusFilter(DEFAULT_TRANSFER_STATUS_FILTER);
        setTransferStatusFilters(defaultTransferStatusFiltersForTab());
        setListSortKey('createdAt');
        setListSortDir('desc');
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          t('expenseApproval.errors.paymentCompleteFailed')
      );
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const submitPaymentDialog = async () => {
    if (!selectedExpense) return;
    const remaining = getExpenseRemainingAmount(selectedExpense);
    const amount = Number(paymentAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t('expenseApproval.errors.invalidPaymentAmount'));
      return;
    }
    if (remaining > 0 && amount > remaining + 0.001) {
      setError(t('expenseApproval.errors.paymentExceedsRemaining', { remaining }));
      return;
    }
    if (!paymentProofFile) {
      setError(t('expenseApproval.errors.remittanceProofRequired'));
      return;
    }
    const proofToSend = renameFileKeepingExtension(paymentProofFile, proofNameDraft);
    if (proofToSend.name !== paymentProofFile.name) {
      setPaymentProofFile(proofToSend);
      setProofNameDraft(stripFileExtensionForDisplay(proofToSend.name));
    }
    await handleCompletePayment(selectedExpense.id, amount, proofToSend);
  };

  const handleApprovePayment = async (id: number, reason?: string) => {
    try {
      const response = await accountingService.approveExpensePayment(id, reason);
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.finalApproveFailed'));
      }
      await syncExpenseAfterMutation(id);
      setSuccess(t('expenseApproval.success.finalApproved'));
    } catch {
      setError(t('expenseApproval.errors.finalApproveFailed'));
    }
  };

  const handleRejectPayment = async (id: number, reason?: string) => {
    try {
      const response = await accountingService.rejectExpensePayment(id, reason);
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.paymentRejectResponseFailed'));
      }
      await syncExpenseAfterMutation(id);
      setSuccess(t('expenseApproval.success.paymentRejected'));
    } catch {
      setError(t('expenseApproval.errors.rejectFailed'));
    }
  };

  const handleReasonSubmit = async () => {
    if (!reasonTargetId) return;
    if (
      (reasonDialogType === 'payment-reject' ||
        reasonDialogType === 'expense-reject' ||
        reasonDialogType === 'expense-revision-reject' ||
        reasonDialogType === 'expense-edit') &&
      !reasonText.trim()
    ) {
      setError(
        reasonDialogType === 'expense-edit'
          ? t('expenseApproval.errors.editReasonRequired')
          : reasonDialogType === 'expense-revision-reject'
            ? t('expenseApproval.errors.revisionRejectReasonRequired')
            : t('expenseApproval.errors.rejectReasonRequired')
      );
      return;
    }
    const reason = reasonText.trim();
    if (reasonDialogType === 'payment-approve') {
      await handleApprovePayment(reasonTargetId, reason || undefined);
      closeReasonDialog();
    } else if (reasonDialogType === 'payment-reject') {
      await handleRejectPayment(reasonTargetId, reason || undefined);
    closeReasonDialog();
    } else if (reasonDialogType === 'expense-edit') {
      closeReasonDialog();
      await handleSaveExpense(reason);
    } else if (reasonDialogType === 'expense-revision-reject') {
      handleRevisionRejectExpense(reasonTargetId, reason);
      closeReasonDialog();
    } else {
      handleRejectExpense(reasonTargetId, reason);
      closeReasonDialog();
    }
  };

  const getUserNameById = (id?: number) => {
    if (!id) return '-';
    return approvers.find((item) => item.id === id)?.name || `User ${id}`;
  };

  const getExpenseApproverName = useCallback(
    (expense: ExpenseApprovalItem) => {
      const approvedById = expense.itemMeta?.approvedById ? Number(expense.itemMeta.approvedById) : null;
      if (approvedById != null) {
        const named = getUserNameById(approvedById);
        if (named !== '-') return named;
      }
      if (expense.currentApproverName) return expense.currentApproverName;
      if (expense.currentApproverId) return getUserNameById(expense.currentApproverId);
      return '-';
    },
    // getUserNameById는 approvers에만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approvers]
  );

  const displayedExpenses = useMemo(() => {
    const rows = [...filteredExpenses];
    const dir = listSortDir === 'asc' ? 1 : -1;
    const compareText = (left: string, right: string) =>
      left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }) * dir;
    rows.sort((a, b) => {
      if (!listSortKey) {
        // 송금 탭: 최신 작성일이 위로
        if (listTab === 'transfer') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return compareExpenseDefaultListOrder(a, b, resolveDisplayStatus);
      }
      switch (listSortKey) {
        case 'createdAt':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        case 'title':
          return compareText(a.title || '', b.title || '');
        case 'person':
          return compareText(
            listTab === 'written' ? getExpenseApproverName(a) : a.requesterName || '',
            listTab === 'written' ? getExpenseApproverName(b) : b.requesterName || ''
          );
        case 'amount':
          return (getExpenseGrandTotal(a) - getExpenseGrandTotal(b)) * dir;
        case 'status':
          return (
            ((STATUS_SORT_ORDER[resolveDisplayStatus(a)] ?? 99) -
              (STATUS_SORT_ORDER[resolveDisplayStatus(b)] ?? 99)) * dir
          );
        case 'priority':
          return ((PRIORITY_SORT_ORDER[a.priority] ?? 9) - (PRIORITY_SORT_ORDER[b.priority] ?? 9)) * dir;
        default:
          return 0;
      }
    });
    return rows;
  }, [filteredExpenses, listSortKey, listSortDir, listTab, getExpenseApproverName, getExpenseGrandTotal, resolveDisplayStatus]);

  const selectableApprovers = useMemo(() => {
    const requesterId = viewMode === 'create' ? user?.id : selectedExpense?.requesterId ?? user?.id;
    return approvers.filter((item) => {
      if (isSameUserId(item.id, user?.id)) return false;
      if (requesterId != null && isSameUserId(item.id, requesterId)) return false;
      return true;
    });
  }, [approvers, user?.id, viewMode, selectedExpense?.requesterId]);

  /** 승인 박스 기본 가로 = 검색 가능 승인자 중 가장 긴 이름 */
  const longestSelectableApproverNameChars = useMemo(
    () => getLongestApproverNameChars(selectableApprovers),
    [selectableApprovers]
  );

  const selectableCcUsers = useMemo(() => {
    const requesterId = viewMode === 'create' ? user?.id : selectedExpense?.requesterId ?? user?.id;
    const approvedId = voucherData.approvedById ? Number(voucherData.approvedById) : null;
    return approvers.filter((item) => {
      if (isSameUserId(item.id, user?.id)) return false;
      if (requesterId != null && isSameUserId(item.id, requesterId)) return false;
      if (approvedId != null && isSameUserId(item.id, approvedId)) return false;
      return true;
    });
  }, [approvers, user?.id, viewMode, selectedExpense?.requesterId, voucherData.approvedById]);

  const handleChangeApprover = async (next: { id: number; name: string } | null) => {
    if (!selectedExpense || !next?.id || !canChangeExpenseApprover(selectedExpense)) return;
    if (isSameUserId(next.id, user?.id)) {
      setError(t('expenseApproval.errors.cannotSelectSelf'));
      return;
    }
    if (isSameUserId(next.id, selectedExpense.requesterId)) {
      setError(t('expenseApproval.errors.cannotSelectRequester'));
      return;
    }
    const currentId = selectedExpense.itemMeta?.approvedById ?? selectedExpense.currentApproverId;
    if (isSameUserId(next.id, currentId)) return;

    setApproverSaving(true);
    try {
      const response = await accountingService.changeExpenseApprover(selectedExpense.id, next.id);
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.changeApproverFailed'));
      }
      const mapped = mapExpense(response.data);
      setSelectedExpense(mapped);
      setExpenses((prev) => prev.map((item) => (item.id === mapped.id ? mapped : item)));
      setSuccess(t('expenseApproval.success.approverChanged'));
    } catch (changeError: any) {
      setError(
        changeError?.response?.data?.message ||
          changeError?.message ||
          t('expenseApproval.errors.changeApproverFailed')
      );
    } finally {
      setApproverSaving(false);
    }
  };

  useEffect(() => {
    setExpenseCommentDraft('');
    setExpenseCommentReplyTo(null);
    setExpenseCommentReplyDraft('');
    setExpenseCommentEditingId(null);
    setExpenseCommentEditDraft('');
  }, [selectedExpense?.id]);

  const syncExpenseComments = (
    expenseId: number,
    nextComments: ExpenseReportComment[],
    options?: { commentCount?: number; hasUnreadComments?: boolean }
  ) => {
    const nextCount = options?.commentCount ?? countExpenseComments(nextComments);
    const latest = getExpenseLastCommentAt(nextComments);
    const lastCommentAt = latest > 0 ? new Date(latest).toISOString() : new Date().toISOString();
    const patch = {
      comments: nextComments,
      commentCount: nextCount,
      lastCommentAt,
      hasUnreadComments: options?.hasUnreadComments ?? true,
    };
    setSelectedExpense((prev) => (prev && prev.id === expenseId ? { ...prev, ...patch } : prev));
    setExpenses((prev) => prev.map((item) => (item.id === expenseId ? { ...item, ...patch } : item)));
  };

  const handleBackToExpenseList = useCallback(async () => {
    if (selectedExpense?.id) {
      const commentCount =
        selectedExpense.commentCount ?? countExpenseComments(selectedExpense.comments);
      const lastCommentAt = resolveExpenseLastCommentAt(selectedExpense);
      const hasUnreadComments = selectedExpense.hasUnreadComments ?? false;

      setExpenses((prev) =>
        prev.map((item) =>
          item.id === selectedExpense.id
            ? {
                ...item,
                comments: selectedExpense.comments,
                commentCount,
                lastCommentAt,
                hasUnreadComments,
                attachments: selectedExpense.attachments,
                status: selectedExpense.status,
                paymentRequestStatus: selectedExpense.paymentRequestStatus,
                paidAmount: selectedExpense.paidAmount,
              }
            : item
        )
      );
      setSelectedExpense((prev) =>
        prev && prev.id === selectedExpense.id ? { ...prev, hasUnreadComments } : prev
      );
    }
    setListSortKey(null);
    setListSortDir('asc');
    setViewMode('list');
    await refreshExpenseListQuietly();
  }, [selectedExpense, refreshExpenseListQuietly]);

  const canEditExpenseComment = useCallback(
    (comment: ExpenseReportComment) => isSameUserId(comment.userId, user?.id),
    [user?.id]
  );

  const startExpenseCommentEdit = (comment: ExpenseReportComment) => {
    setExpenseCommentEditingId(comment.id);
    setExpenseCommentEditDraft(comment.comment);
    setExpenseCommentReplyTo(null);
    setExpenseCommentReplyDraft('');
  };

  const cancelExpenseCommentEdit = () => {
    setExpenseCommentEditingId(null);
    setExpenseCommentEditDraft('');
  };

  const handleAddExpenseComment = async (parentId?: number) => {
    if (!selectedExpense || expenseCommentSubmitting) return;
    const text = parentId ? expenseCommentReplyDraft.trim() : expenseCommentDraft.trim();
    if (!text) return;
    setExpenseCommentSubmitting(true);
    setError('');
    try {
      const response = await accountingService.addExpenseReportComment(
        selectedExpense.id,
        text,
        parentId
      );
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.commentAddFailed'));
      }
      const nextComments = parseExpenseReportComments(response.comments);
      syncExpenseComments(selectedExpense.id, nextComments, {
        commentCount: Number(response.comment_count) || undefined,
        hasUnreadComments: Boolean(response.has_unread_comments ?? true),
      });
      if (parentId) {
        setExpenseCommentReplyDraft('');
        setExpenseCommentReplyTo(null);
        setSuccess(t('expenseApproval.success.replyAdded'));
      } else {
        setExpenseCommentDraft('');
        setSuccess(t('expenseApproval.success.commentAdded'));
      }
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || t('expenseApproval.errors.commentAddFailed'));
    } finally {
      setExpenseCommentSubmitting(false);
    }
  };

  const handleUpdateExpenseComment = async (commentId: number) => {
    if (!selectedExpense || expenseCommentSubmitting || !expenseCommentEditDraft.trim()) return;
    setExpenseCommentSubmitting(true);
    setError('');
    try {
      const response = await accountingService.updateExpenseReportComment(
        selectedExpense.id,
        commentId,
        expenseCommentEditDraft.trim()
      );
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.errors.commentUpdateFailed'));
      }
      const nextComments = parseExpenseReportComments(response.comments);
      syncExpenseComments(selectedExpense.id, nextComments, {
        commentCount: Number(response.comment_count) || undefined,
        hasUnreadComments: Boolean(response.has_unread_comments ?? true),
      });
      cancelExpenseCommentEdit();
      setSuccess(t('expenseApproval.success.commentUpdated'));
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || t('expenseApproval.errors.commentUpdateFailed'));
    } finally {
      setExpenseCommentSubmitting(false);
    }
  };

  const handleDownloadExpensePdf = async () => {
    const root = expensePdfRef.current;
    if (!root || !selectedExpense) {
      setError(t('expenseApproval.errors.pdfTargetMissing'));
      return;
    }
    setPdfDownloading(true);
    try {
      const meta = selectedExpense.itemMeta || {};
      const filename = buildExpenseApprovalPdfFilename({
        companyName:
          companyName ||
          selectedExpense.companyName ||
          selectedExpense.itemMeta?.department ||
          '',
        detail: selectedExpense.title || meta.voucherNo || selectedExpense.expenseId,
        voucherNo: meta.voucherNo || selectedExpense.expenseId,
        title: selectedExpense.title,
      });
      await downloadExpenseApprovalPdf(root, filename);
      setSuccess(t('expenseApproval.success.pdfDownloaded'));
    } catch (pdfError: any) {
      setError(pdfError?.message || t('expenseApproval.errors.pdfDownloadFailed'));
    } finally {
      setPdfDownloading(false);
    }
  };

  const handlePrintExpense = () => {
    if (!expensePdfRef.current || !selectedExpense) {
      setError(t('expenseApproval.errors.pdfTargetMissing'));
      return;
    }
    window.print();
    setSuccess(t('expenseApproval.success.printed'));
  };

  const dateLocale = useMemo(() => (i18n.language?.startsWith('ko') ? 'ko-KR' : 'en-US'), [i18n.language]);
  const formLangAttr = i18n.language?.startsWith('ko') ? 'ko' : 'en';
  const gstPeriodLabel = useMemo(
    () => getGstPeriodLabel(voucherData.voucherDate, i18n.language),
    [voucherData.voucherDate, i18n.language]
  );
  const gstPeriodShortLabel = useMemo(
    () => getGstPeriodShortLabel(voucherData.voucherDate, i18n.language),
    [voucherData.voucherDate, i18n.language]
  );
  const gstPayableAmount = useMemo(
    () =>
      voucherData.formType === 'gst'
        ? roundDecimal2(
            calcGstPayableAmount(lineItems) + Number(voucherData.gstRoundingAdjustment || 0)
          )
        : 0,
    [lineItems, voucherData.formType, voucherData.gstRoundingAdjustment]
  );
  const gstTotalPayableAmount = useMemo(
    () =>
      voucherData.formType === 'gst'
        ? calcGstFinalPayable(
            lineItems,
            voucherData.gstRoundingAdjustment,
            voucherData.gstProfessionalTax
          )
        : 0,
    [lineItems, voucherData.formType, voucherData.gstRoundingAdjustment, voucherData.gstProfessionalTax]
  );

  /** 초과 ITC로 일반 GST 현금이 0일 때 remark에 자동 설명 */
  useEffect(() => {
    if (viewMode !== 'create' && viewMode !== 'edit') return;
    if (voucherData.formType !== 'gst') return;
    const autoRemark = String(t('expenseApproval.voucher.gstPayableNegativeRemark') || '').trim();
    if (!autoRemark) return;
    const zeroed = isGstGeneralCashZeroedByItc(lineItems);
    setVoucherData((prev) => {
      const current = String(prev.remarks || '');
      const trimmed = current.trim();
      if (zeroed) {
        if (!trimmed) return { ...prev, remarks: autoRemark };
        if (trimmed === autoRemark || current.includes(autoRemark)) return prev;
        return { ...prev, remarks: `${trimmed}\n${autoRemark}` };
      }
      if (trimmed === autoRemark) return { ...prev, remarks: '' };
      if (!current.includes(autoRemark)) return prev;
      const next = current
        .split(/\r?\n/)
        .filter((line) => line.trim() !== autoRemark)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (next === trimmed) return prev;
      return { ...prev, remarks: next };
    });
  }, [lineItems, voucherData.formType, viewMode, t]);

  const formatRemittanceDateTime = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString(dateLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const softFieldSx = useMemo(
    () => ({
      ...mvsSearchFieldSx,
      ...mvsFilterFieldHeightSx,
      '& .MuiOutlinedInput-root': {
        borderRadius: '6px',
        bgcolor: '#FFFFFF',
        '& fieldset': { borderColor: '#CBD5E1' },
        '&:hover fieldset': { borderColor: '#94A3B8' },
      },
    }),
    []
  );

  const lineItemFieldSx = {
    ...softFieldSx,
    '& .MuiOutlinedInput-root': {
      height: 30,
      borderRadius: '6px',
      bgcolor: '#FFFFFF',
      '& fieldset': { borderColor: '#CBD5E1' },
      '&:hover fieldset': { borderColor: '#94A3B8' },
      '& .MuiOutlinedInput-input': { py: 0.25, fontSize: '0.8125rem' },
    },
  } as const;

  const lineItemCellSx = {
    py: 0.35,
    px: 0.75,
    borderBottom: `1px solid ${EXPENSE_LINE}`,
  } as const;

  const sectionShellSx = {
    mb: 0,
  } as const;

  const getExpenseSummaryMonthKey = useCallback((expense: ExpenseApprovalItem) => {
    const voucher = formatLocalYmd(expense.itemMeta?.voucherDate);
    const created = formatLocalYmd(expense.createdAt);
    const due = formatLocalYmd(expense.dueDate);
    const ymd = voucher || created || due || '';
    return ymd.length >= 7 ? ymd.slice(0, 7) : '';
  }, []);

  const summaryExpenses = useMemo(
    () => expenses.filter((expense) => getExpenseSummaryMonthKey(expense) === summaryMonth),
    [expenses, getExpenseSummaryMonthKey, summaryMonth]
  );

  const totalExpenseAmount = summaryExpenses.reduce(
    (sum, expense) => sum + getExpenseGrandTotal(expense),
    0
  );
  const approvedAmount = summaryExpenses
    .filter((expense) => expense.status === 'approved' || expense.status === 'paid')
    .reduce((sum, expense) => sum + getExpenseGrandTotal(expense), 0);
  const pendingAmount = summaryExpenses
    .filter((expense) => expense.status === 'submitted' || expense.status === 'in_review')
    .reduce((sum, expense) => sum + getExpenseGrandTotal(expense), 0);
  const urgentCount = summaryExpenses.filter((expense) => expense.priority === 'urgent').length;

  const paginatedExpenses = displayedExpenses.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );
  const visibleExpenses = listViewMode === 'all' ? displayedExpenses : paginatedExpenses;

  const listStateBoxSx = {
    ...mvsBodyListTableSx,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    py: { xs: 6, sm: 8 },
    px: 3,
    gap: 1.5 } as const;

  const attachmentPreviewDialog = (
    <Dialog
      open={Boolean(previewAttachment)}
      onClose={closeAttachmentPreview}
      maxWidth="lg"
      fullWidth
      sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
    >
      <DialogTitle sx={{ pr: 2, pb: 1.25 }}>
        <TextField
          size="small"
          fullWidth
          label={t('expenseApproval.detail.attachmentFileName')}
          value={previewDownloadName}
          onChange={(e) =>
            setPreviewDownloadName(stripCorporateSuffixFromFilename(e.target.value))
          }
          onFocus={(e) => e.target.select()}
          onBlur={() => setPreviewDownloadName(resolvePreviewDownloadName())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              if (previewAttachment) {
                setPreviewDownloadName(getReceiptDisplayName(previewAttachment));
              }
              (e.target as HTMLInputElement).blur();
            }
          }}
          helperText={t('expenseApproval.detail.attachmentFileNameHint')}
          InputProps={{ sx: { fontWeight: 600 } }}
        />
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, bgcolor: '#F1F5F9', minHeight: { xs: 320, sm: 480 } }}>
        {previewAttachment && isImageReceipt(previewAttachment) ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
            <AuthMedia
              src={previewAttachment}
              alt={previewDownloadName || getReceiptDisplayName(previewAttachment)}
              sx={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }}
            />
          </Box>
        ) : previewLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360 }}>
            <CircularProgress size={32} />
          </Box>
        ) : previewAttachment && isPdfReceipt(previewAttachment) && previewBlobUrl ? (
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: { xs: '60vh', sm: '75vh' },
              bgcolor: '#fff',
            }}
          >
            <Box
              component="iframe"
              title={previewDownloadName || getReceiptDisplayName(previewAttachment)}
              src={`${previewBlobUrl}#toolbar=1&navpanes=0`}
              sx={{
                display: 'block',
                width: '100%',
                height: '100%',
                border: 0,
                bgcolor: '#fff',
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              minHeight: 280,
              px: 2,
              textAlign: 'center',
            }}
          >
            <FileIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {previewLoadError
                ? t('expenseApproval.errors.attachmentPreviewFailed', {
                    defaultValue: '미리보기를 불러오지 못했습니다. 다운로드하거나 새 탭에서 열어 주세요.',
                  })
                : t('expenseApproval.detail.attachmentPreviewUnavailable', {
                    defaultValue: '이 파일 형식은 미리보기를 지원하지 않습니다. 다운로드하거나 새 탭에서 열어 주세요.',
                  })}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
        {previewAttachment ? (
          <>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon fontSize="small" />}
              onClick={() => {
                void downloadUploadFile(previewAttachment, resolvePreviewDownloadName());
              }}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('common.download')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<OpenInNewIcon fontSize="small" />}
              onClick={() => {
                const url = previewBlobUrl || getUploadUrl(previewAttachment);
                if (url) window.open(url, '_blank', 'noopener,noreferrer');
              }}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('common.openInNew')}
            </Button>
          </>
        ) : null}
        <Button onClick={closeAttachmentPreview} sx={mvsBodyOutlinedBtnSx}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const statusSnackbars = (
    <>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess('')}>
        <Alert onClose={() => setSuccess('')} severity="success">
          {success}
        </Alert>
      </Snackbar>
    </>
  );

  if (viewMode === 'create' || viewMode === 'edit') {
    const isEdit = viewMode === 'edit';
    const isRevisionResubmitEdit =
      isEdit &&
      selectedExpense != null &&
      isRevisionRejectedExpense(selectedExpense);
    const isPreApprovalEdit =
      isEdit &&
      selectedExpense != null &&
      (selectedExpense.status === 'submitted' || selectedExpense.status === 'in_review');
    return (
      <Box sx={{ ...expensePageRootSx }}>
        <MvsPageHeader
          title={isEdit ? t('expenseApproval.form.editTitle') : t('expenseApproval.form.createTitle')}
          mb={2}
          actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {isRootUser && !isEdit && (
              <Autocomplete
                size="small"
                options={companyOptions}
                value={selectedCreateCompanyOption}
                onChange={(_, option) => {
                  if (option && Number(option.id) > 0) {
                    handleRootCompanyChange(Number(option.id));
                  }
                }}
                getOptionLabel={(option) => option.name || ''}
                isOptionEqualToValue={(a, b) => Number(a.id) === Number(b.id)}
                disableClearable={Boolean(selectedCreateCompanyOption)}
                filterOptions={(options, state) => {
                  const q = String(state.inputValue || '')
                    .trim()
                    .toLowerCase();
                  if (!q) return options;
                  return options.filter((opt) => String(opt.name || '').toLowerCase().includes(q));
                }}
                slotProps={rootCompanyAutocompleteSlotProps}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('expenseApproval.filters.company')}
                    placeholder={t('expenseApproval.placeholders.searchCompany')}
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                sx={{
                  minWidth: 200,
                  maxWidth: 420,
                  ...expenseApprovalFilterFieldSx,
                  '& .MuiAutocomplete-input': {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              />
            )}
            {headerStatusBanner === 'draftCreated' && (
              <Typography variant="body2" color="text.secondary">
                {t('expenseApproval.success.draftCreated')}
              </Typography>
            )}
            {autoSaveHint === 'saving' && (
              <Typography variant="body2" color="text.secondary">
                {t('expenseApproval.voucher.autoSaveSaving')}
              </Typography>
            )}
            {autoSaveHint === 'saved' && (
              <Typography variant="body2" color="text.secondary">
                {t('expenseApproval.voucher.autoSaveSaved')}
              </Typography>
            )}
            {autoSaveHint === 'failed' && (
              <Typography variant="body2" color="error">
                {t('expenseApproval.voucher.autoSaveFailed')}
              </Typography>
            )}
              <Button
                variant="outlined"
                onClick={() => void leaveExpenseForm()}
                sx={mvsBodyOutlinedBtnSx}
              >
              {t('expenseApproval.actions.backToList')}
            </Button>
          </Box>
          }
        />

        <Card elevation={0} component="section" lang={formLangAttr} sx={{ ...mvsBodyCardSx, mb: 3, maxWidth: '100%' }}>
            {saving && <LinearProgress sx={{ borderRadius: 0 }} />}

            <Box sx={{ borderBottom: `1px solid ${EXPENSE_LINE}`, bgcolor: '#FFFFFF' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                  gap: { xs: 1, md: 1.5 },
                  alignItems: 'stretch',
                  px: { xs: 1.5, sm: 2 },
                  pt: 2,
                  pb: 1.25,
                }}
              >
                <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box>
                    <ExpenseCompanyBlock
                      logo={companyLogo}
                      logoAlt={t('expenseApproval.voucher.companyLogoAlt')}
                      name={companyName}
                      address={companyAddress}
                      gstNumber={companyGstNumber}
                    />
                  </Box>
                  <ExpenseVoucherMetaTable
                    voucherLabel={t('expenseApproval.voucher.labelVoucherNumber')}
                    dateLabel={t('expenseApproval.voucher.labelDateCreated')}
                    voucherNo={voucherData.voucherNo || t('expenseApproval.voucher.autoGenerated')}
                    dateText={
                      formData.dueDate
                        ? new Date(`${formData.dueDate}T00:00:00`).toLocaleDateString(dateLocale)
                        : new Date().toLocaleDateString(dateLocale)
                    }
                  />
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 1,
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{
                      width: 'max-content',
                      minWidth: EXPENSE_FLOW_STAMP_MIN_WIDTH,
                      border: `1px solid ${EXPENSE_STAMP_LINE}`,
                      borderRadius: EXPENSE_STAMP_RADIUS,
                      bgcolor: '#FFFFFF',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        ...expenseStampHeaderSx,
                        px: 1,
                        py: 0.35,
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: EXPENSE_STAMP_LABEL }}>
                    {t('expenseApproval.voucher.prepared')}
                  </Typography>
                </Box>
                    <Box
                      sx={{
                        minHeight: 68,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        px: EXPENSE_PREPARED_STAMP_PAD_X,
                        py: 0.5,
                        minWidth: `calc(${Math.max(Array.from(String(user?.username || '-').trim()).length, 4)} * 0.55em * ${EXPENSE_PREPARED_STAMP_WIDTH_SCALE} + 18px)`,
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          textAlign: 'center',
                          color: EXPENSE_STAMP_LABEL,
                          whiteSpace: 'nowrap',
                          px: 1,
                        }}
                      >
                        {user?.username || '-'}
                      </Typography>
                    </Box>
                  </Box>

                  <ArrowForwardIcon sx={{ color: '#94A3B8', fontSize: 20, flexShrink: 0 }} />

                  <Box
                    sx={{
                      width: 'max-content',
                      minWidth: EXPENSE_FLOW_STAMP_MIN_WIDTH,
                      maxWidth: 'min(400px, 100%)',
                      border: `1px solid ${EXPENSE_STAMP_LINE}`,
                      borderRadius: EXPENSE_STAMP_RADIUS,
                      bgcolor: '#FFFFFF',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        ...expenseStampHeaderSx,
                        px: 0.5,
                        py: 0.35,
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: EXPENSE_STAMP_LABEL }}>
                    {t('expenseApproval.voucher.approved')}
                  </Typography>
                    </Box>
                    <Box
                      sx={{
                        minHeight: 68,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        px: 0.25,
                        py: 0.5,
                        width: 'max-content',
                        minWidth: EXPENSE_FLOW_STAMP_MIN_WIDTH,
                        boxSizing: 'border-box',
                      }}
                    >
                  <Autocomplete
                        size="small"
                        disableClearable
                        options={selectableApprovers}
                    getOptionLabel={(option) => option.name}
                        isOptionEqualToValue={(a, b) => Number(a.id) === Number(b.id)}
                        value={
                          selectableApprovers.find((item) => String(item.id) === String(voucherData.approvedById))
                          || approvers.find((item) => String(item.id) === String(voucherData.approvedById))
                          || undefined
                        }
                        onChange={(_, value) => {
                          if (value && isSameUserId(value.id, user?.id)) {
                            setError(t('expenseApproval.errors.cannotSelectSelf'));
                            return;
                          }
                          const nextApproverId = value ? String(value.id) : '';
                          setVoucherData({ ...voucherData, approvedById: nextApproverId });
                          if (value?.id) {
                            setCcUserIds((prev) => prev.filter((id) => !isSameUserId(id, value.id)));
                          }
                        }}
                        sx={getExpenseApproverControlSx(longestSelectableApproverNameChars)}
                        slotProps={expenseApproverAutocompleteSlotProps}
                    renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder={t('expenseApproval.placeholders.searchSimple')}
                            variant="standard"
                            size="small"
                            InputProps={{
                              ...params.InputProps,
                              disableUnderline: true,
                            }}
                            sx={{
                              '& .MuiInputBase-root': {
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                justifyContent: 'center',
                                flexWrap: 'nowrap',
                              },
                              '& .MuiInputBase-input': {
                                textAlign: 'center',
                                py: 0.25,
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                              },
                            }}
                          />
                        )}
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                mx: { xs: 1.5, sm: 2 },
                mb: 0,
                mt: 1,
                border: `1px solid ${EXPENSE_STAMP_LINE}`,
                borderRadius: EXPENSE_STAMP_RADIUS,
                bgcolor: '#FFFFFF',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  px: 1,
                  py: 0.5,
                  ...expenseStampHeaderSx,
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                  {t('expenseApproval.cc.label')}
              </Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: '#64748B' }}>
                  {t('expenseApproval.cc.hint')}
                </Typography>
              </Box>
              <Box sx={{ px: 1, py: 1.25, minHeight: 52 }}>
                <Autocomplete
                  multiple
                  size="small"
                  options={selectableCcUsers}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(a, b) => Number(a.id) === Number(b.id)}
                  value={ccUserIds
                    .map((id) => {
                      const found =
                        selectableCcUsers.find((u) => Number(u.id) === Number(id)) ||
                        approvers.find((u) => Number(u.id) === Number(id));
                      return found || { id, name: getUserNameById(id) || `#${id}` };
                    })
                    .filter(Boolean)}
                  onChange={(_, value) => {
                    setCcUserIds((value || []).map((v) => Number(v.id)).filter((id) => id > 0));
                  }}
                  sx={{
                    '& .MuiAutocomplete-inputRoot': {
                      minHeight: 36,
                      alignItems: 'center',
                      py: 0.25,
                    },
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        size="small"
                        label={option.name}
                        {...getTagProps({ index })}
                        key={option.id}
                        sx={{
                          border: 'none',
                          borderRadius: '4px',
                          height: 26,
                          bgcolor: '#EEF2F7',
                          color: '#334155',
                          '& .MuiChip-deleteIcon': { color: '#64748B' },
                        }}
                      />
                    ))
                  }
                  renderInput={(params) => (
                  <TextField
                      {...params}
                      placeholder={t('expenseApproval.cc.placeholder')}
                      variant="standard"
                      InputProps={{
                        ...params.InputProps,
                        disableUnderline: true,
                      }}
                    />
                  )}
                  />
                </Box>
            </Box>

            <CardContent sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, bgcolor: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1.5,
                px: 0.25,
              }}
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mr: 0.5, flexShrink: 0 }}>
                  {t('expenseApproval.voucher.formTypeLabel')}
                </Typography>
                <RadioGroup
                  row
                  value={voucherData.formType}
                  onChange={(e) => handleChangeFormType(e.target.value as ExpenseFormType)}
                  sx={{ gap: { xs: 0, sm: 1 } }}
                >
                  <FormControlLabel
                    value="general"
                    control={<Radio size="small" />}
                    label={t('expenseApproval.voucher.formTypeGeneral')}
                  />
                  <FormControlLabel
                    value="gst"
                    control={<Radio size="small" />}
                    label={t('expenseApproval.voucher.formTypeGst')}
                  />
                  <FormControlLabel
                    value="tds"
                    control={<Radio size="small" />}
                    label={t('expenseApproval.voucher.formTypeTds')}
                  />
                </RadioGroup>
                </Box>
              <FormControl
                        size="small"
                        sx={{
                  ...softFieldSx,
                  width: { xs: '100%', sm: 160 },
                  minWidth: { sm: 140 },
                  flexShrink: 0,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '6px',
                    bgcolor: EXPENSE_TOTAL_BG,
                    '& fieldset': { borderColor: EXPENSE_TOTAL_LINE },
                    '&:hover fieldset': { borderColor: '#FCA5A5' },
                    '&.Mui-focused fieldset': { borderColor: EXPENSE_TOTAL_FG },
                  },
                  '& .MuiInputLabel-root': { color: EXPENSE_TOTAL_FG },
                  '& .MuiInputLabel-root.Mui-focused': { color: EXPENSE_TOTAL_FG },
                }}
              >
                <InputLabel>{t('expenseApproval.filters.priority')}</InputLabel>
                <Select
                  label={t('expenseApproval.filters.priority')}
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent',
                    })
                  }
                      >
                        <MenuItem value="low">{t('expenseApproval.priority.low')}</MenuItem>
                        <MenuItem value="medium">{t('expenseApproval.priority.medium')}</MenuItem>
                        <MenuItem value="high">{t('expenseApproval.priority.high')}</MenuItem>
                        <MenuItem value="urgent">{t('expenseApproval.priority.urgent')}</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
            {/* 지출 신청 */}
                  <Box>
              <Typography variant="subtitle2" sx={sectionTitleSx}>
                  {t('expenseApproval.voucher.sectionRequest')}
              </Typography>
              <Box
                sx={{
                  ...sectionBlockSx,
                  border: `1px solid ${EXPENSE_VENDOR_LINE}`,
                }}
              >
              <TableContainer>
                <Table
                  size="small"
                  sx={{
                    ...compactTableSx,
                    tableLayout: 'fixed',
                    width: '100%',
                    '& .expense-request-meta-label': {
                      textAlign: 'left !important',
                      paddingLeft: `${EXPENSE_TEXT_PAD_LEFT} !important`,
                      paddingRight: '8px !important',
                      backgroundColor: '#D8E2EC !important',
                      color: `${EXPENSE_HEADER_FG} !important`,
                      fontWeight: '400 !important',
                    },
                  }}
                >
                  <colgroup>
                    <col style={{ width: EXPENSE_KV_LABEL_WIDTH_PX }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: 132 }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: 100 }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <TableBody>
                    <TableRow>
                      <TableCell
                        className="expense-request-meta-label"
                        sx={{
                          ...kvLabelCellSx,
                          width: EXPENSE_KV_LABEL_WIDTH_PX,
                          minWidth: EXPENSE_KV_LABEL_WIDTH_PX,
                          maxWidth: EXPENSE_KV_LABEL_WIDTH_PX,
                          fontWeight: 400,
                        }}
                      >
                        {t('expenseApproval.columns.requester')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user?.username || '-'}
                      </TableCell>
                      <TableCell
                        className="expense-request-meta-label"
                        sx={{
                          ...kvLabelCellSx,
                          width: 132,
                          minWidth: 132,
                          maxWidth: 132,
                          fontWeight: 400,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t('expenseApproval.voucher.departmentRole')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {[user?.department, user?.position]
                          .filter((v) => v && String(v).trim() && String(v).trim() !== '-')
                          .join(' / ') || '-'}
                      </TableCell>
                      <TableCell
                        className="expense-request-meta-label"
                        sx={{
                          ...kvLabelCellSx,
                          width: 100,
                          minWidth: 100,
                          maxWidth: 100,
                          fontWeight: 400,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t('expenseApproval.voucher.labelDateCreated')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 400, whiteSpace: 'nowrap' }}>
                        {formData.dueDate
                          ? new Date(`${formData.dueDate}T00:00:00`).toLocaleDateString(dateLocale)
                          : new Date().toLocaleDateString(dateLocale)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
                  <Box sx={{ gridColumn: { md: '1 / -1' } }}>
                    <TextField
                      label={t('expenseApproval.voucher.labelTitle')}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                      fullWidth
                      size="small"
                      sx={softFieldSx}
                    />
                  </Box>
                  <Box sx={{ gridColumn: { md: '1 / -1' } }}>
                  <TextField
                      label={t('expenseApproval.voucher.labelPurpose')}
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    fullWidth
                      size="small"
                    multiline
                    minRows={2}
                      sx={softFieldSx}
                  />
                </Box>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* 대금을 받는 협력업체 */}
            <Box>
              <Typography variant="subtitle2" sx={sectionTitleSx}>
                {t('expenseApproval.voucher.sectionVendor')}
              </Typography>
              <Box
              sx={{
                ...sectionBlockSx,
                border: `1px solid ${EXPENSE_VENDOR_LINE}`,
                borderRadius: '6px',
                bgcolor: EXPENSE_VENDOR_BG,
              }}
            >
              <Box sx={{ p: 1.25 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, display: 'block', mb: 0.75, color: EXPENSE_VENDOR_SUB }}
              >
                {t('expenseApproval.voucher.vendorGroupDoc')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.25 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 1 }}>
                  <Autocomplete
                  sx={softFieldSx}
                  fullWidth
                    options={partners}
                  filterOptions={filterPartnerOptions}
                  getOptionLabel={(option) => option.company_name || ''}
                  isOptionEqualToValue={(a, b) => Number(a.id) === Number(b.id)}
                  autoHighlight
                  clearOnBlur={false}
                  selectOnFocus
                  handleHomeEndKeys
                  noOptionsText={
                    partnerLoadError
                      ? t('expenseApproval.voucher.partnerLoadFailed')
                      : partnerScopeEnforced && partners.length === 0
                        ? t('expenseApproval.voucher.partnerScopeEmpty')
                        : partnerScopeEnforced
                          ? t('expenseApproval.voucher.partnerScopeNoMatch')
                          : t('partnerManagement.empty.noResults')
                  }
                    value={partners.find((item) => String(item.id) === String(voucherData.partnerId)) || null}
                  inputValue={partnerInputValue}
                  onInputChange={(_, newInput) => setPartnerInputValue(newInput)}
                    onChange={(_, value) => {
                      if (!value) {
                      setPartnerInputValue('');
                        setVoucherData({
                          ...voucherData,
                          partnerId: '',
                          department: '',
                          gstNumber: '',
                        partnerRepresentative: '',
                        partnerAddress: '',
                        partnerPhone: '',
                        partnerEmail: '',
                        partnerPan: '',
                          bank: '',
                          accountNumber: '',
                          ifsc: '',
                        acHolder: '',
                        igstRate: 0,
                        cgstRate: 0,
                        sgstRate: 0,
                        });
                        return;
                      }
                    setPartnerInputValue(value.company_name || '');
                    const gstNumber = pickPartnerGstNumber(value);
                      setVoucherData({
                        ...voucherData,
                        partnerId: String(value.id),
                        department: value.company_name || '',
                        gstNumber,
                      partnerRepresentative: value.representative || '',
                      partnerAddress: value.address || '',
                      partnerPhone: normalizePhoneDigits(value.phone || ''),
                      partnerEmail: normalizeEmailLower(value.email || ''),
                      partnerPan: value.pan_number || '',
                        bank: value.bank_name || '',
                        accountNumber: normalizeBankAccountDigits(value.account_number || ''),
                        ifsc: normalizeIfsc(value.bank_ifsc || ''),
                      acHolder: value.account_holder || value.representative || value.company_name || '',
                      });
                    }}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Box sx={{ minWidth: 0, py: 0.25 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {option.company_name}
                        </Typography>
                        {(option.account_holder || option.bank_name || option.address) && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {[option.account_holder, option.bank_name, option.address].filter(Boolean).join(' · ')}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  )}
                    renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('expenseApproval.voucher.labelPartner')}
                      placeholder={t('expenseApproval.placeholders.searchCompany')}
                      size="small"
                    />
                  )}
                />
                  <TextField
                  label={t('expenseApproval.voucher.labelVoucherNumber')}
                    value={voucherData.voucherNo}
                  placeholder={t('expenseApproval.voucher.autoGenerated')}
                    fullWidth
                  size="small"
                  InputProps={{ readOnly: true }}
                  sx={softFieldSx}
                  />
                </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1 }}>
                  <TextField
                  label={t('expenseApproval.voucher.labelGstNumber')}
                    value={voucherData.gstNumber}
                  onChange={(e) => {
                    const gstNumber = e.target.value;
                    setVoucherData({
                      ...voucherData,
                      gstNumber,
                      ...(!hasExpenseGstNumber(gstNumber)
                        ? { igstRate: 0, cgstRate: 0, sgstRate: 0 }
                        : {}),
                    });
                  }}
                    fullWidth
                  size="small"
                  sx={softFieldSx}
                  />
                  <TextField
                  label={t('expenseApproval.voucher.labelPanNumber')}
                  value={voucherData.partnerPan}
                  onChange={(e) => setVoucherData({ ...voucherData, partnerPan: e.target.value })}
                  fullWidth
                  size="small"
                  sx={softFieldSx}
                />
                  <TextField
                  label={t('expenseApproval.voucher.labelVoucherDate')}
                    type="date"
                    value={voucherData.voucherDate}
                    onChange={(e) => setVoucherData({ ...voucherData, voucherDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  size="small"
                    inputProps={{ lang: formLangAttr }}
                  sx={softFieldSx}
                  />
                </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1 }}>
                <TextField
                  label={t('expenseApproval.voucher.labelRepresentative')}
                  value={voucherData.partnerRepresentative}
                  onChange={(e) => setVoucherData({ ...voucherData, partnerRepresentative: e.target.value })}
                  fullWidth
                  size="small"
                  sx={softFieldSx}
                />
                <TextField
                  label={t('expenseApproval.voucher.labelPartnerPhone')}
                  value={formatPhoneDisplay(voucherData.partnerPhone)}
                  onChange={(e) => {
                    warnDigitsOnlyField(e.target.value, 'expenseApproval.voucher.labelPartnerPhone');
                    setVoucherData({
                      ...voucherData,
                      partnerPhone: normalizePhoneDigits(e.target.value),
                    });
                  }}
                  fullWidth
                  size="small"
                  inputProps={{ inputMode: 'numeric', 'data-skip-proper-case': '1' }}
                  sx={softFieldSx}
                />
                <TextField
                  label={t('expenseApproval.voucher.labelPartnerEmail')}
                  value={voucherData.partnerEmail}
                  onChange={(e) =>
                    setVoucherData({
                      ...voucherData,
                      partnerEmail: normalizeEmailLower(e.target.value),
                    })
                  }
                  fullWidth
                  size="small"
                  inputProps={{ inputMode: 'email', 'data-skip-proper-case': '1' }}
                  sx={softFieldSx}
                />
              </Box>
                <TextField
                  label={t('expenseApproval.voucher.labelPartnerAddress')}
                  value={formatEnglishSentenceLabel(voucherData.partnerAddress)}
                  onChange={(e) => setVoucherData({ ...voucherData, partnerAddress: e.target.value })}
                  fullWidth
                  size="small"
                  sx={softFieldSx}
                />
                </Box>
              <Box sx={{ mt: 1.25, pt: 0.25 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, display: 'block', mb: 0.75, color: EXPENSE_VENDOR_SUB }}
              >
                {t('expenseApproval.voucher.vendorGroupPayout')}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
                  <TextField
                  label={t('expenseApproval.voucher.labelAccountHolder')}
                    value={voucherData.acHolder}
                    onChange={(e) => setVoucherData({ ...voucherData, acHolder: e.target.value })}
                    fullWidth
                  size="small"
                  sx={softFieldSx}
                  />
                  <TextField
                  label={t('expenseApproval.voucher.labelBankName')}
                    value={voucherData.bank}
                    onChange={(e) => setVoucherData({ ...voucherData, bank: e.target.value })}
                    fullWidth
                  size="small"
                  inputProps={{ 'data-skip-proper-case': '1', name: 'bank_name' }}
                  sx={softFieldSx}
                  />
                  <TextField
                  label={t('expenseApproval.voucher.labelAccountNumber')}
                    value={formatBankAccountDisplay(voucherData.accountNumber)}
                    onChange={(e) => {
                      warnDigitsOnlyField(e.target.value, 'expenseApproval.voucher.labelAccountNumber');
                      setVoucherData({
                        ...voucherData,
                        accountNumber: normalizeBankAccountDigits(e.target.value),
                      });
                    }}
                    fullWidth
                  size="small"
                  inputProps={{ inputMode: 'numeric', 'data-skip-proper-case': '1' }}
                  sx={softFieldSx}
                  />
                  <TextField
                  label={t('expenseApproval.voucher.labelIfsc')}
                    value={voucherData.ifsc}
                    onChange={(e) =>
                      setVoucherData({ ...voucherData, ifsc: normalizeIfsc(e.target.value) })
                    }
                    fullWidth
                  size="small"
                  inputProps={{ 'data-skip-proper-case': '1', name: 'ifsc', style: { textTransform: 'uppercase' } }}
                  sx={softFieldSx}
                  />
                </Box>
              </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={sectionShellSx}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  flexWrap: 'wrap',
                  mb: 0.5,
                }}
              >
                <Typography variant="subtitle2" sx={{ ...sectionTitleSx, mb: 0 }}>
                {t('expenseApproval.voucher.sectionItems')}
              </Typography>
                {voucherData.formType === 'general' && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={Boolean(voucherData.perLineGst)}
                        disabled={!hasExpenseGstNumber(voucherData.gstNumber)}
                        onChange={(e) => togglePerLineGst(e.target.checked)}
                        sx={{ py: 0 }}
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                        {t('expenseApproval.voucher.perItemGst')}
                      </Typography>
                    }
                    sx={{ mr: 0, ml: 0 }}
                  />
                )}
              </Box>
              {voucherData.formType === 'general' &&
                hasPartnerGstin &&
                !canCompareGstStates && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                    {t('expenseApproval.voucher.gstStateCompareHint')}
                  </Typography>
                )}
              {voucherData.formType === 'gst' ? (
              <>
              <Typography
                variant="subtitle2"
                sx={{
                  mb: 0.5,
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  color: '#1E293B',
                  pl: 0.25,
                }}
              >
                {t('expenseApproval.voucher.gstSectionMain')}
              </Typography>
              <TableContainer
                sx={{
                    mb: 1,
                    borderRadius: '6px',
                    border: `1px solid ${EXPENSE_LINE}`,
                    overflowX: 'auto',
                  }}
                >
                  <Table size="small" sx={gstSummaryTableSx}>
                    {gstSummaryColGroup}
                <TableHead
                  sx={{
                        bgcolor: EXPENSE_HEADER_BG,
                    '& .MuiTableCell-head': {
                          bgcolor: EXPENSE_HEADER_BG,
                          color: EXPENSE_HEADER_FG,
                      fontWeight: 600,
                      fontSize: '0.75rem',
                          letterSpacing: '0.02em',
                      textTransform: 'none',
                          borderBottom: `1px solid ${EXPENSE_LINE}`,
                          borderTop: '2px solid #94A3B8',
                          py: 0.55,
                          px: 0.75,
                          whiteSpace: 'nowrap',
                    },
                  }}
                >
                  <TableRow>
                        <TableCell sx={{ width: 40 }}>{t('expenseApproval.voucher.tableNo')}</TableCell>
                        <TableCell>{t('expenseApproval.voucher.gstTableDetail')}</TableCell>
                        <TableCell align="right" sx={gstSummaryNumCellSx}>
                          {t('expenseApproval.voucher.gstTableTaxableValue')}
                        </TableCell>
                        <TableCell align="right" sx={gstSummaryNumCellSx}>
                          {t('expenseApproval.voucher.gstTableIgst')}
                        </TableCell>
                        <TableCell align="right" sx={gstSummaryNumCellSx}>
                          {t('expenseApproval.voucher.gstTableCgst')}
                        </TableCell>
                        <TableCell align="right" sx={gstSummaryNumCellSx}>
                          {t('expenseApproval.voucher.gstTableSgst')}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {GST_MAIN_ROW_DEFS.map((rowDef, index) => {
                        const item = getGstLineByKey(lineItems, rowDef.key) || mapSavedGstSummaryItem({ id: `gst-${rowDef.key}` } as ExpenseItem, rowDef.key);
                        const renderGstCell = (
                          field: 'taxableValue' | 'igst' | 'cgst' | 'sgst',
                          opts?: { readOnly?: boolean; compact?: boolean }
                        ) => {
                          const cellValue = field === 'taxableValue' ? item.taxableValue : item[field];
                          if (opts?.readOnly) {
                            return (
                              <Typography
                                variant="body2"
                                sx={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem' }}
                              >
                                {formatDecimal2(Number(cellValue || 0))}
                              </Typography>
                            );
                          }
                          return (
                            <TextField
                              type="number"
                              size="small"
                              fullWidth
                              value={cellValue ?? 0}
                              onChange={(e) => {
                                const raw = Number(e.target.value);
                                handleUpdateGstSummaryRow(
                                  item.id,
                                  field,
                                  Number.isFinite(raw) && raw < 0 ? 0 : Number(e.target.value || 0)
                                );
                              }}
                              inputProps={{ min: 0, step: 0.01 }}
                              sx={
                                opts?.compact
                                  ? {
                                      ...gstSummaryNumFieldSx,
                                      '& .MuiOutlinedInput-root': {
                                        ...(gstSummaryNumFieldSx as any)['& .MuiOutlinedInput-root'],
                                        height: 30,
                                        borderRadius: '2px',
                                      },
                                    }
                                  : gstSummaryNumFieldSx
                              }
                            />
                          );
                        };
                        return (
                          <TableRow key={rowDef.key}>
                            <TableCell sx={gstSummaryDataCellSx}>{index + 1}</TableCell>
                            <TableCell sx={gstSummaryDetailCellSx}>
                              <Typography variant="body2" sx={{ fontSize: '0.8125rem', lineHeight: 1.35 }}>
                                {t(`expenseApproval.voucher.${rowDef.labelKey}`, {
                                  period: rowDef.withPeriod ? gstPeriodLabel : undefined,
                                })}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={gstSummaryNumCellSx}>
                              {renderGstCell('taxableValue')}
                            </TableCell>
                            <TableCell align="right" sx={gstSummaryNumCellSx}>
                              {renderGstCell('igst')}
                            </TableCell>
                            <TableCell align="right" sx={gstSummaryNumCellSx}>
                              {renderGstCell('cgst')}
                            </TableCell>
                            <TableCell align="right" sx={gstSummaryNumCellSx}>
                              {renderGstCell('sgst')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                </TableContainer>

              <Typography
                variant="subtitle2"
                sx={{
                  mt: 1.5,
                  mb: 0.5,
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  color: '#1E293B',
                  pl: 0.25,
                }}
              >
                {t('expenseApproval.voucher.gstSectionExtra')}
              </Typography>
              <TableContainer
                sx={{
                  mb: 1,
                  borderRadius: '2px',
                  border: '1px solid #C5D6C5',
                  bgcolor: '#F3F8F3',
                  overflow: 'hidden',
                }}
              >
                <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                  <TableBody>
                    {GST_EF_ROW_DEFS.map((rowDef, index) => {
                      const item = getGstLineByKey(lineItems, rowDef.key) || mapSavedGstSummaryItem({ id: `gst-${rowDef.key}` } as ExpenseItem, rowDef.key);
                        if (rowDef.key === 'interest') {
                          const extra =
                            item.gstExtra?.kind === 'interest'
                              ? item.gstExtra
                              : createDefaultInterestExtra();
                          const incomplete =
                            extra.amountMode === 'auto' && extra.computedAmount == null;
                          return (
                            <TableRow key={rowDef.key}>
                              <TableCell
                                sx={{
                                  ...gstEfRowCellSx,
                                  width: 40,
                                  bgcolor: 'transparent',
                                  verticalAlign: 'middle',
                                }}
                              >
                                {GST_MAIN_ROW_DEFS.length + index + 1}
                              </TableCell>
                              <TableCell
                                sx={{
                                  ...gstEfRowCellSx,
                                  minWidth: 0,
                                  bgcolor: 'transparent',
                                  verticalAlign: 'middle',
                                }}
                              >
                                <Box
                                  sx={{
                                    ...gstInlineCalcRowSx,
                                    alignItems: 'center',
                                    gridTemplateColumns: {
                                      xs: '72px repeat(3, minmax(0, 1fr))',
                                      md: '72px repeat(6, minmax(0, 1fr))',
                                    },
                                  }}
                                >
                                  <Typography sx={gstInlineRowLabelSx}>
                                    {t(`expenseApproval.voucher.${rowDef.labelKey}`)}
                                  </Typography>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>{t('expenseApproval.voucher.gstInterestUnpaid')}</Typography>
                                    <TextField
                                      type="number"
                                      size="small"
                                      value={extra.unpaidAmount || ''}
                                      onChange={(e) =>
                                        patchGstInterestExtra(item.id, {
                                          unpaidAmount: Math.max(0, Number(e.target.value || 0)),
                                          amountMode: 'auto',
                                        })
                                      }
                                      inputProps={{ min: 0, step: 0.01 }}
                                      sx={gstInlineFieldSx}
                                    />
                                  </Box>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>{t('expenseApproval.voucher.gstInterestDueDate')}</Typography>
                                    <TextField
                                      type="date"
                                      size="small"
                                      value={extra.dueDate || ''}
                                      onChange={(e) =>
                                        patchGstInterestExtra(item.id, {
                                          dueDate: e.target.value,
                                          amountMode: 'auto',
                                        })
                                      }
                                      InputLabelProps={{ shrink: true }}
                                      sx={gstInlineFieldSx}
                                    />
                                  </Box>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>{t('expenseApproval.voucher.gstInterestPlannedDate')}</Typography>
                                    <TextField
                                      type="date"
                                      size="small"
                                      value={extra.plannedDate || ''}
                                      onChange={(e) =>
                                        patchGstInterestExtra(item.id, {
                                          plannedDate: e.target.value,
                                          amountMode: 'auto',
                                        })
                                      }
                                      InputLabelProps={{ shrink: true }}
                                      sx={gstInlineFieldSx}
                                    />
                                  </Box>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>{t('expenseApproval.voucher.gstInterestDelayDays')}</Typography>
                                    <TextField
                                      size="small"
                                      disabled
                                      value={
                                        extra.delayDays == null
                                          ? t('expenseApproval.voucher.gstCalcIncomplete')
                                          : String(extra.delayDays)
                                      }
                                      sx={gstInlineReadonlyFieldSx}
                                    />
                                  </Box>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>{t('expenseApproval.voucher.gstInterestAnnualRate')}</Typography>
                                    <TextField
                                      type="number"
                                      size="small"
                                      value={extra.annualRatePercent || ''}
                                      onChange={(e) =>
                                        patchGstInterestExtra(item.id, {
                                          annualRatePercent: Math.max(0, Number(e.target.value || 0)),
                                          amountMode: 'auto',
                                        })
                                      }
                                      inputProps={{ min: 0, step: 0.01 }}
                                      sx={gstInlineFieldSx}
                                    />
                                  </Box>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>
                                      {t('expenseApproval.voucher.gstCalcAmount')}
                                      <Typography
                                        component="span"
                                        sx={{
                                          ml: 0.5,
                                          fontSize: '0.625rem',
                                          fontWeight: 500,
                                          color: extra.amountMode === 'manual' ? '#B45309' : '#64748B',
                                        }}
                                      >
                                        ({extra.amountMode === 'manual'
                                          ? t('expenseApproval.voucher.gstCalcManual')
                                          : t('expenseApproval.voucher.gstCalcAuto')})
                                      </Typography>
                                    </Typography>
                                    <TextField
                                      type="number"
                                      size="small"
                                      value={incomplete ? '' : extra.amount}
                                      placeholder={incomplete ? t('expenseApproval.voucher.gstCalcIncomplete') : undefined}
                                      onChange={(e) =>
                                        patchGstInterestExtra(item.id, {
                                          amount: Math.max(0, Number(e.target.value || 0)),
                                          amountMode: 'manual',
                                        })
                                      }
                                      inputProps={{ min: 0, step: 0.01 }}
                                      sx={gstInlineFieldSx}
                                    />
                                    {extra.amountMode === 'manual' ? (
                                      <Button
                                        size="small"
                                        onClick={() => patchGstInterestExtra(item.id, {}, { forceAuto: true })}
                                        sx={gstInlineModeBtnSx}
                                      >
                                        {t('expenseApproval.voucher.gstCalcRestoreAuto')}
                                      </Button>
                                    ) : null}
                                  </Box>
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        }

                        if (rowDef.key === 'lateFee') {
                          const extra =
                            item.gstExtra?.kind === 'lateFee'
                              ? item.gstExtra
                              : createDefaultLateFeeExtra();
                          const incomplete =
                            extra.amountMode === 'auto' && extra.computedAmount == null;
                          return (
                            <TableRow key={rowDef.key}>
                              <TableCell
                                sx={{
                                  ...gstEfRowCellSx,
                                  width: 40,
                                  bgcolor: 'transparent',
                                  verticalAlign: 'middle',
                                }}
                              >
                                {GST_MAIN_ROW_DEFS.length + index + 1}
                              </TableCell>
                              <TableCell
                                sx={{
                                  ...gstEfRowCellSx,
                                  minWidth: 0,
                                  bgcolor: 'transparent',
                                  verticalAlign: 'middle',
                                }}
                              >
                                <Box
                                  sx={{
                                    ...gstInlineCalcRowSx,
                                    alignItems: 'center',
                                    gridTemplateColumns: {
                                      xs: '72px repeat(3, minmax(0, 1fr))',
                                      md: '72px repeat(6, minmax(0, 1fr))',
                                    },
                                  }}
                                >
                                  <Typography sx={gstInlineRowLabelSx}>
                                    {t(`expenseApproval.voucher.${rowDef.labelKey}`)}
                                  </Typography>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>{t('expenseApproval.voucher.gstLateFeeFilingDue')}</Typography>
                                    <TextField
                                      type="date"
                                      size="small"
                                      value={extra.filingDueDate || ''}
                                      onChange={(e) =>
                                        patchGstLateFeeExtra(item.id, {
                                          filingDueDate: e.target.value,
                                          amountMode: 'auto',
                                        })
                                      }
                                      InputLabelProps={{ shrink: true }}
                                      sx={gstInlineFieldSx}
                                    />
                                  </Box>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>{t('expenseApproval.voucher.gstLateFeeFilingPlanned')}</Typography>
                                    <TextField
                                      type="date"
                                      size="small"
                                      value={extra.filingPlannedDate || ''}
                                      onChange={(e) =>
                                        patchGstLateFeeExtra(item.id, {
                                          filingPlannedDate: e.target.value,
                                          amountMode: 'auto',
                                        })
                                      }
                                      InputLabelProps={{ shrink: true }}
                                      sx={gstInlineFieldSx}
                                    />
                                  </Box>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>{t('expenseApproval.voucher.gstInterestDelayDays')}</Typography>
                                    <TextField
                                      size="small"
                                      disabled
                                      value={
                                        extra.delayDays == null
                                          ? t('expenseApproval.voucher.gstCalcIncomplete')
                                          : String(extra.delayDays)
                                      }
                                      sx={gstInlineReadonlyFieldSx}
                                    />
                                  </Box>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>{t('expenseApproval.voucher.gstLateFeeDaily')}</Typography>
                                    <TextField
                                      type="number"
                                      size="small"
                                      value={extra.dailyFee || ''}
                                      onChange={(e) =>
                                        patchGstLateFeeExtra(item.id, {
                                          dailyFee: Math.max(0, Number(e.target.value || 0)),
                                          amountMode: 'auto',
                                        })
                                      }
                                      inputProps={{ min: 0, step: 0.01 }}
                                      sx={gstInlineFieldSx}
                                    />
                                  </Box>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>{t('expenseApproval.voucher.gstLateFeeCap')}</Typography>
                                    <TextField
                                      type="number"
                                      size="small"
                                      value={extra.capAmount || ''}
                                      onChange={(e) =>
                                        patchGstLateFeeExtra(item.id, {
                                          capAmount: Math.max(0, Number(e.target.value || 0)),
                                          amountMode: 'auto',
                                        })
                                      }
                                      inputProps={{ min: 0, step: 0.01 }}
                                      sx={gstInlineFieldSx}
                                    />
                                  </Box>
                                  <Box sx={gstInlineUnitSx}>
                                    <Typography sx={gstInlineLabelSx}>
                                      {t('expenseApproval.voucher.gstCalcAmount')}
                                      <Typography
                                        component="span"
                                        sx={{
                                          ml: 0.5,
                                          fontSize: '0.625rem',
                                          fontWeight: 500,
                                          color: extra.amountMode === 'manual' ? '#B45309' : '#64748B',
                                        }}
                                      >
                                        ({extra.amountMode === 'manual'
                                          ? t('expenseApproval.voucher.gstCalcManual')
                                          : t('expenseApproval.voucher.gstCalcAuto')})
                                      </Typography>
                                    </Typography>
                                    <TextField
                                      type="number"
                                      size="small"
                                      value={incomplete ? '' : extra.amount}
                                      placeholder={incomplete ? t('expenseApproval.voucher.gstCalcIncomplete') : undefined}
                                      onChange={(e) =>
                                        patchGstLateFeeExtra(item.id, {
                                          amount: Math.max(0, Number(e.target.value || 0)),
                                          amountMode: 'manual',
                                        })
                                      }
                                      inputProps={{ min: 0, step: 0.01 }}
                                      sx={gstInlineFieldSx}
                                    />
                                    {extra.amountMode === 'manual' ? (
                                      <Button
                                        size="small"
                                        onClick={() => patchGstLateFeeExtra(item.id, {}, { forceAuto: true })}
                                        sx={gstInlineModeBtnSx}
                                      >
                                        {t('expenseApproval.voucher.gstCalcRestoreAuto')}
                                      </Button>
                                    ) : null}
                                  </Box>
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return null;
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 1.25,
                  py: 1,
                  border: '1px solid #FECACA',
                  borderRadius: '2px',
                  bgcolor: '#FEE2E2',
                  mb: 1,
                }}
              >
                <Typography sx={{ color: '#B91C1C', fontWeight: 700, fontSize: '0.8125rem' }}>
                  {t('expenseApproval.voucher.gstPayableLabel')}
                </Typography>
                <Typography sx={{ color: '#B91C1C', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {formatDecimal2(gstPayableAmount)}
                </Typography>
              </Box>
              </>
              ) : voucherData.formType === 'tds' ? (
                <>
                  <TableContainer
                    sx={{
                      mb: 1,
                      borderRadius: '6px',
                      border: `1px solid ${EXPENSE_LINE}`,
                      overflowX: 'auto',
                    }}
                  >
                    <Table size="small" sx={{ tableLayout: 'auto', minWidth: 1100 }}>
                <TableHead
                  sx={{
                          bgcolor: EXPENSE_HEADER_BG,
                    '& .MuiTableCell-head': {
                            bgcolor: EXPENSE_HEADER_BG,
                            color: EXPENSE_HEADER_FG,
                      fontWeight: 600,
                      fontSize: '0.75rem',
                            letterSpacing: '0.02em',
                      textTransform: 'none',
                            borderBottom: `1px solid ${EXPENSE_LINE}`,
                            borderTop: '2px solid #94A3B8',
                            py: 0.55,
                            px: 0.75,
                            whiteSpace: 'nowrap',
                    },
                  }}
                >
                  <TableRow>
                          <TableCell sx={{ width: 40 }}>{t('expenseApproval.voucher.tableNo')}</TableCell>
                          <TableCell>{t('expenseApproval.voucher.tdsColDate')}</TableCell>
                          <TableCell>{t('expenseApproval.voucher.tdsColPan')}</TableCell>
                          <TableCell sx={{ minWidth: 220 }}>{t('expenseApproval.voucher.tdsColDeducteeName')}</TableCell>
                          <TableCell align="right">{t('expenseApproval.voucher.tdsColAmount')}</TableCell>
                          <TableCell align="center">{t('expenseApproval.voucher.tdsColRate')}</TableCell>
                          <TableCell sx={{ minWidth: 148, whiteSpace: 'pre-line', lineHeight: 1.25 }}>
                            {t('expenseApproval.voucher.tdsColDeducteeType')}
                          </TableCell>
                          <TableCell>{t('expenseApproval.voucher.tdsColSection')}</TableCell>
                          <TableCell>{t('expenseApproval.voucher.tdsColCode')}</TableCell>
                          <TableCell align="right">{t('expenseApproval.voucher.tdsColTds')}</TableCell>
                          <TableCell sx={{ width: 40 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lineItems.map((item, index) => {
                          const calc = calcTdsLineAmounts(item);
                          return (
                            <TableRow key={item.id}>
                              <TableCell sx={lineItemCellSx}>{index + 1}</TableCell>
                              <TableCell sx={{ ...lineItemCellSx, width: 140 }}>
                                <TextField
                                  type="date"
                                  size="small"
                                  fullWidth
                                  value={item.invoiceDate || ''}
                                  onChange={(e) =>
                                    handleUpdateLineItem(item.id, 'invoiceDate', e.target.value)
                                  }
                                  inputProps={{ lang: formLangAttr }}
                                  sx={lineItemFieldSx}
                                />
                              </TableCell>
                              <TableCell sx={{ ...lineItemCellSx, minWidth: 120 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  value={item.pan || ''}
                                  onChange={(e) =>
                                    handleUpdateLineItem(item.id, 'pan', e.target.value.toUpperCase())
                                  }
                                  inputProps={{ maxLength: 10 }}
                                  sx={lineItemFieldSx}
                                />
                              </TableCell>
                              <TableCell sx={{ ...lineItemCellSx, minWidth: 240 }}>
                                <Autocomplete
                                  freeSolo
                                  size="small"
                                  options={partners}
                                  filterOptions={filterPartnerOptions}
                                  getOptionLabel={(option) =>
                                    typeof option === 'string' ? option : option.company_name || ''
                                  }
                                  isOptionEqualToValue={(a, b) => {
                                    if (typeof a === 'string' || typeof b === 'string') {
                                      return String(a) === String(b);
                                    }
                                    return Number(a.id) === Number(b.id);
                                  }}
                                  value={
                                    (item.deducteePartnerId &&
                                      partners.find((p) => String(p.id) === String(item.deducteePartnerId))) ||
                                    item.description ||
                                    null
                                  }
                                  onChange={(_, value) => handleSelectTdsDeductee(item.id, value)}
                                  onInputChange={(_, newInput, reason) => {
                                    if (reason === 'input') {
                                      setLineItems((prev) =>
                                        prev.map((row) =>
                                          row.id === item.id
                                            ? {
                                                ...row,
                                                description: newInput,
                                                deducteePartnerId: '',
                                              }
                                            : row
                                        )
                                      );
                                    }
                                    if (reason === 'clear') {
                                      handleSelectTdsDeductee(item.id, null);
                                    }
                                  }}
                                  renderOption={(props, option) => (
                                    <li {...props} key={option.id}>
                                      <Box sx={{ minWidth: 0, py: 0.25 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                          {option.company_name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap>
                                          {[option.pan_number, option.account_holder, option.gstNumbers?.[0]]
                                            .filter(Boolean)
                                            .join(' · ') || '-'}
                                        </Typography>
                                      </Box>
                                    </li>
                                  )}
                                  noOptionsText={
                                    partnerLoadError
                                      ? t('expenseApproval.voucher.partnerLoadFailed')
                                      : partnerScopeEnforced && partners.length === 0
                                        ? t('expenseApproval.voucher.partnerScopeEmpty')
                                        : t('partnerManagement.empty.noResults')
                                  }
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      size="small"
                                      placeholder={t('expenseApproval.voucher.tdsDeducteeSearchHint')}
                                      sx={lineItemFieldSx}
                                    />
                                  )}
                                  sx={{
                                    minWidth: 220,
                                    '& .MuiAutocomplete-inputRoot': {
                                      py: 0,
                                      ...((lineItemFieldSx as any)['& .MuiOutlinedInput-root'] || {}),
                                    },
                                  }}
                                />
                              </TableCell>
                              <TableCell align="right" sx={lineItemCellSx}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={item.amount ?? 0}
                                  onChange={(e) =>
                                    handleUpdateLineItem(item.id, 'amount', Number(e.target.value || 0))
                                  }
                                  inputProps={{ step: 1 }}
                                  sx={{
                                    ...lineItemFieldSx,
                                    minWidth: 100,
                                    '& input': { textAlign: 'right', px: 0.75 },
                                  }}
                                />
                              </TableCell>
                              <TableCell align="center" sx={lineItemCellSx}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={item.tdsRate ?? 0}
                                  onChange={(e) =>
                                    handleUpdateLineItem(item.id, 'tdsRate', Number(e.target.value || 0))
                                  }
                                  inputProps={{ min: 0, step: 0.01 }}
                                  sx={{
                                    ...lineItemFieldSx,
                                    width: 80,
                                    '& input': { textAlign: 'right', px: 0.75 },
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={lineItemCellSx}>
                                <Select
                                  size="small"
                                  fullWidth
                                  value={item.deducteeType === 'company' ? 'company' : 'other'}
                                  onChange={(e) =>
                                    handleUpdateLineItem(
                                      item.id,
                                      'deducteeType',
                                      e.target.value as 'company' | 'other'
                                    )
                                  }
                                  sx={{
                                    ...lineItemFieldSx,
                                    '& .MuiSelect-select': { py: 0.5, fontSize: '0.8125rem' },
                                  }}
                                >
                                  <MenuItem value="company">
                                    {t('expenseApproval.voucher.tdsDeducteeCompany')}
                                  </MenuItem>
                                  <MenuItem value="other">
                                    {t('expenseApproval.voucher.tdsDeducteeOther')}
                                  </MenuItem>
                                </Select>
                              </TableCell>
                              <TableCell sx={{ ...lineItemCellSx, minWidth: 88 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  value={item.tdsSection || ''}
                                  onChange={(e) =>
                                    handleUpdateLineItem(item.id, 'tdsSection', e.target.value)
                                  }
                                  sx={lineItemFieldSx}
                                />
                              </TableCell>
                              <TableCell sx={{ ...lineItemCellSx, minWidth: 80 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  value={item.tdsCode || ''}
                                  onChange={(e) =>
                                    handleUpdateLineItem(item.id, 'tdsCode', e.target.value)
                                  }
                                  sx={lineItemFieldSx}
                                />
                              </TableCell>
                              <TableCell align="right" sx={{ ...lineItemCellSx, fontVariantNumeric: 'tabular-nums' }}>
                                {isOtherTdsDeductee(item) ? (
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={item.tdsAmount ?? 0}
                                    onChange={(e) =>
                                      handleUpdateLineItem(
                                        item.id,
                                        'tdsAmount',
                                        Number(e.target.value || 0)
                                      )
                                    }
                                    inputProps={{ step: 1 }}
                                    sx={{
                                      ...lineItemFieldSx,
                                      minWidth: 88,
                                      '& input': { textAlign: 'right', px: 0.75 },
                                    }}
                                  />
                                ) : (
                                  formatSignedAmount(calc.tdsAmt)
                                )}
                              </TableCell>
                              <TableCell sx={lineItemCellSx}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemoveLineItem(item.id)}
                                  sx={{ p: 0.25 }}
                                  aria-label={t('common.delete')}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {lineItems.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={11} align="center">
                              {t('expenseApproval.voucher.lineItemsEmpty')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddLineItem}
                    sx={{ mt: 1, textTransform: 'none', borderRadius: '8px' }}
                  >
                    {t('expenseApproval.voucher.tdsAddRow')}
                  </Button>
                </>
              ) : (
                <>
              <TableContainer
                sx={{
                  mb: 1,
                  borderRadius: '6px',
                  border: `1px solid ${EXPENSE_LINE}`,
                  overflowX: 'auto',
                }}
              >
              <Table size="small">
                <TableHead
                  sx={{
                    bgcolor: EXPENSE_HEADER_BG,
                    '& .MuiTableCell-head': {
                      bgcolor: EXPENSE_HEADER_BG,
                      color: EXPENSE_HEADER_FG,
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      letterSpacing: '0.02em',
                      textTransform: 'none',
                      borderBottom: `1px solid ${EXPENSE_LINE}`,
                      borderTop: '2px solid #94A3B8',
                      py: 0.55,
                      px: 0.75,
                    } }}
                >
                  <TableRow>
                    <TableCell sx={{ width: 40 }}>{t('expenseApproval.voucher.tableNo')}</TableCell>
                    <TableCell sx={{ width: 140 }}>{t('expenseApproval.voucher.tableInvoiceDate')}</TableCell>
                    <TableCell>{t('expenseApproval.voucher.tableDescription')}</TableCell>
                    <TableCell align="right" sx={{ width: 72 }}>{t('expenseApproval.voucher.tableQty')}</TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>{t('expenseApproval.voucher.tableUnitPrice')}</TableCell>
                    <TableCell align="right" sx={{ width: 110 }}>{t('expenseApproval.voucher.tableTotal')}</TableCell>
                    {voucherData.perLineGst && (
                      <>
                        <TableCell align="center" sx={{ width: 88 }}>
                          {t('expenseApproval.voucher.tableIgstRate')}
                        </TableCell>
                        <TableCell align="center" sx={{ width: 88 }}>
                          {t('expenseApproval.voucher.tableCgstRate')}
                        </TableCell>
                        <TableCell align="center" sx={{ width: 88 }}>
                          {t('expenseApproval.voucher.tableSgstRate')}
                        </TableCell>
                        <TableCell align="right" sx={{ width: 100 }}>
                          {t('expenseApproval.voucher.tableGstAmount')}
                        </TableCell>
                      </>
                    )}
                    <TableCell sx={{ width: 40 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell sx={lineItemCellSx}>{index + 1}</TableCell>
                      <TableCell sx={{ ...lineItemCellSx, width: 140 }}>
                        <TextField
                          type="date"
                          value={item.invoiceDate}
                          onChange={(e) => handleUpdateLineItem(item.id, 'invoiceDate', e.target.value)}
                          onKeyDown={handleLineItemKeyDown(item.id, 'invoiceDate', index)}
                          size="small"
                          fullWidth
                          inputProps={{ lang: formLangAttr }}
                          inputRef={setInputRef(item.id, 'invoiceDate')}
                          sx={lineItemFieldSx}
                        />
                      </TableCell>
                      <TableCell sx={lineItemCellSx}>
                        <TextField
                          value={item.description}
                          onChange={(e) => handleUpdateLineItem(item.id, 'description', e.target.value)}
                          onKeyDown={handleLineItemKeyDown(item.id, 'description', index)}
                          size="small"
                          fullWidth
                          multiline
                          minRows={1}
                          maxRows={4}
                          placeholder={t('expenseApproval.voucher.placeholderDescription')}
                          inputRef={setInputRef(item.id, 'description')}
                          sx={{
                            ...lineItemFieldSx,
                            '& .MuiOutlinedInput-root': {
                              height: 'auto',
                              minHeight: 30,
                              borderRadius: '6px',
                              bgcolor: '#FFFFFF',
                              alignItems: 'flex-start',
                              '& fieldset': { borderColor: '#CBD5E1' },
                              '&:hover fieldset': { borderColor: '#94A3B8' },
                              '& textarea': {
                                py: 0.25,
                                fontSize: '0.8125rem',
                                lineHeight: 1.35,
                              },
                            },
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ ...lineItemCellSx, width: 72, maxWidth: 72 }}>
                        <TextField
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleUpdateLineItem(item.id, 'qty', Number(e.target.value || 0))}
                          onKeyDown={handleLineItemKeyDown(item.id, 'qty', index)}
                          size="small"
                          inputProps={{ min: 0, step: 0.01 }}
                          inputRef={setInputRef(item.id, 'qty')}
                          sx={{
                            ...lineItemFieldSx,
                            width: 64,
                            maxWidth: 64,
                            '& input': { textAlign: 'right', px: 0.75 },
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ ...lineItemCellSx, width: 120 }}>
                        <TextField
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateLineItem(item.id, 'unitPrice', Number(e.target.value || 0))}
                          onKeyDown={handleLineItemKeyDown(item.id, 'unitPrice', index)}
                          size="small"
                          inputProps={{ min: 0, step: 0.01 }}
                          fullWidth
                          placeholder={t('expenseApproval.voucher.placeholderUnitPrice')}
                          inputRef={setInputRef(item.id, 'unitPrice')}
                          sx={lineItemFieldSx}
                        />
                      </TableCell>
                      <TableCell align="right" sx={lineItemCellSx}>{formatDecimal2(item.total)}</TableCell>
                      {voucherData.perLineGst && (() => {
                        const lineGst = calcLineItemGstAmounts(item);
                        const igstEnabled = canEnterIgst;
                        const cgstEnabled = canEnterCgstSgst;
                        const taxAmt = roundDecimal2(
                          lineGst.igstAmount + lineGst.cgstAmount + lineGst.sgstAmount
                        );
                        const renderRateSelect = (
                          kind: 'igst' | 'cgst' | 'sgst',
                          rateValue: number,
                          allowedRates: readonly number[],
                          enabled: boolean,
                          readOnly: boolean
                        ) => (
                          <TableCell align="center" sx={{ ...lineItemCellSx, width: 88 }}>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={
                                  allowedRates.some((rate) => Math.abs(rate - rateValue) < 0.001)
                                    ? String(rateValue)
                                    : ''
                                }
                                displayEmpty
                                disabled={!enabled || readOnly}
                                onChange={(e) => {
                                  if (kind === 'igst' || kind === 'cgst') {
                                    patchLineItemGstRate(item.id, kind, Number(e.target.value || 0));
                                  }
                                }}
                                sx={{
                                  height: 30,
                                  borderRadius: '6px',
                                  bgcolor: enabled && !readOnly ? '#FFFFFF' : '#F8FAFC',
                                  fontSize: '0.8125rem',
                                  opacity: enabled ? 1 : 0.55,
                                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                                  '& .MuiSelect-select': { py: 0.25, pr: '28px !important' },
                                }}
                                renderValue={(selected) => {
                                  if (!selected) return '-';
                                  return `${formatGstRateOption(Number(selected))}%`;
                                }}
                              >
                                <MenuItem value="">
                                  <em>-</em>
                                </MenuItem>
                                {allowedRates.map((rate) => (
                                  <MenuItem key={rate} value={String(rate)}>
                                    {formatGstRateOption(rate)}%
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                        );
                        return (
                          <>
                            {renderRateSelect(
                              'igst',
                              Number(item.igstRate || 0),
                              ALLOWED_IGST_RATES,
                              igstEnabled,
                              false
                            )}
                            {renderRateSelect(
                              'cgst',
                              Number(item.cgstRate || 0),
                              ALLOWED_CGST_SGST_RATES,
                              cgstEnabled,
                              false
                            )}
                            {renderRateSelect(
                              'sgst',
                              Number(item.sgstRate || 0),
                              ALLOWED_CGST_SGST_RATES,
                              cgstEnabled,
                              true
                            )}
                            <TableCell
                              align="right"
                              sx={{ ...lineItemCellSx, width: 100, fontVariantNumeric: 'tabular-nums' }}
                            >
                              {formatDecimal2(taxAmt)}
                            </TableCell>
                          </>
                        );
                      })()}
                      <TableCell align="right" sx={lineItemCellSx}>
                        <IconButton size="small" onClick={() => handleRemoveLineItem(item.id)} sx={{ p: 0.25 }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lineItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={voucherData.perLineGst ? 11 : 7} align="center">
                        {t('expenseApproval.voucher.lineItemsEmpty')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </TableContainer>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddLineItem}
                sx={{ mt: 1, textTransform: 'none', borderRadius: '8px' }}
              >
                {t('expenseApproval.voucher.addItem')}
              </Button>
                </>
              )}
            </Box>

            {voucherData.formType === 'tds' && (
            <Box
                className="expense-pdf-tax"
              sx={{
                  mb: 1,
                  ...expenseTdsTaxBoxSx,
                  borderRadius: '6px',
                  p: { xs: 1, sm: 1.25 },
                bgcolor: 'background.paper',
                  border: `1px solid ${EXPENSE_LINE}`,
                }}
              >
                <Typography variant="subtitle2" sx={sectionTitleSx}>
                  {t('expenseApproval.voucher.sectionTax')}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2,
                    py: 1.25,
                    px: 1.25,
                    mb: 1,
                    borderRadius: '6px',
                    bgcolor: EXPENSE_HEADER_BG,
              }}
            >
              <Typography
                    variant="body2"
                sx={{
                      color: EXPENSE_HEADER_FG,
                  fontWeight: 600,
                      fontSize: '0.8125rem',
                      whiteSpace: 'pre-line',
                      lineHeight: 1.25,
                      pr: 1,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {t('expenseApproval.voucher.tdsSumOtherDeductee')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: EXPENSE_HEADER_FG, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {formatSignedAmount(tdsOtherDeducteeSum)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    pt: 1.25,
                    px: 1.25,
                    pb: 1.25,
                    borderRadius: '6px',
                    bgcolor: EXPENSE_TOTAL_BG,
                    border: `1px solid ${EXPENSE_TOTAL_LINE}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      color: EXPENSE_TOTAL_FG,
                      whiteSpace: 'pre-line',
                      lineHeight: 1.25,
                      pr: 1,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {t('expenseApproval.voucher.tdsSumCompanyDeductee')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: EXPENSE_TOTAL_FG }}>
                    {formatSignedAmount(tdsCompanyDeducteeSum)}
                  </Typography>
                </Box>
              </Box>
            )}

            {voucherData.formType === 'general' && (
            <Box
              className="expense-pdf-tax"
              sx={{
                mb: 1,
                width: { xs: '100%', sm: `${EXPENSE_TAX_BOX_WIDTH_PERCENT}%` },
                minWidth: { xs: '100%', sm: EXPENSE_TAX_BOX_WIDTH_PX },
                maxWidth: '100%',
                ml: { xs: 0, sm: 'auto' },
                borderRadius: '6px',
                p: { xs: 1, sm: 1.25 },
                bgcolor: 'background.paper',
                border: `1px solid ${EXPENSE_LINE}`,
              }}
            >
              <Typography variant="subtitle2" sx={sectionTitleSx}>
                {t('expenseApproval.voucher.sectionTax')}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 1,
                  py: 0.5,
                  px: 1,
                  mb: 0.75,
                  borderRadius: '6px',
                  bgcolor: EXPENSE_HEADER_BG }}
              >
                <Typography variant="body2" sx={{ color: EXPENSE_HEADER_FG, fontWeight: 600, fontSize: '0.8125rem' }}>
                  {t('expenseApproval.voucher.taxSubtotal')}
                </Typography>
                <Typography variant="body2" sx={{ color: EXPENSE_HEADER_FG, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {formatDecimal2(subtotalAmount)}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: { xs: 'none', sm: 'grid' },
                  gridTemplateColumns: 'minmax(88px,auto) 88px 1fr',
                  gap: 1,
                  alignItems: 'center',
                  py: 0.25,
                  borderBottom: `1px solid ${EXPENSE_LINE}`,
                  mb: 0.25 }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.06em' }}>
                  {t('expenseApproval.voucher.taxColItem')}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.06em', textAlign: 'center' }}>
                  {t('expenseApproval.voucher.taxColRate')}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.06em', textAlign: 'right' }}>
                  {t('expenseApproval.voucher.taxColAmount')}
                </Typography>
              </Box>

              {([
                {
                  key: 'igst',
                  label: 'IGST (B)',
                  rate: voucherData.igstRate,
                  allowedRates: ALLOWED_IGST_RATES,
                  onRateChange: (v: number) => patchVoucherTaxRates({ igstRate: v }),
                  amount: igstAmount,
                  readOnly: false,
                  enabled: canEnterIgst,
                },
                {
                  key: 'cgst',
                  label: 'CGST (C)',
                  rate: voucherData.cgstRate,
                  allowedRates: ALLOWED_CGST_SGST_RATES,
                  onRateChange: (v: number) => patchVoucherTaxRates({ cgstRate: v }),
                  amount: cgstAmount,
                  readOnly: false,
                  enabled: canEnterCgstSgst,
                },
                {
                  key: 'sgst',
                  label: 'SGST (D)',
                  rate: voucherData.sgstRate,
                  allowedRates: ALLOWED_CGST_SGST_RATES,
                  onRateChange: (v: number) => patchVoucherTaxRates({ cgstRate: v }),
                  amount: sgstAmount,
                  readOnly: true,
                  enabled: canEnterCgstSgst,
                },
              ] as const).map((row) => (
                <Box
                  key={row.key}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(88px,auto) 88px 1fr' },
                    gap: { xs: 0.75, sm: 1 },
                    alignItems: 'center',
                    py: 0.35,
                    borderBottom: `1px solid ${EXPENSE_LINE}`,
                    opacity: row.enabled ? 1 : 0.55,
                    '&:last-of-type': { borderBottom: 'none', pb: 0 } }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem', gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                    {row.label}
                  </Typography>
                  <FormControl
                    size="small"
                    sx={{
                      width: { xs: '100%', sm: 'auto' },
                      maxWidth: { xs: 120, sm: 'none' },
                      gridColumn: { xs: '1', sm: 'auto' },
                    }}
                  >
                    <Select
                      value={
                        row.allowedRates.some((rate) => Math.abs(rate - Number(row.rate || 0)) < 0.001)
                          ? String(row.rate)
                          : ''
                      }
                      displayEmpty
                      disabled={row.readOnly || !row.enabled || Boolean(voucherData.perLineGst)}
                      onChange={(e) => row.onRateChange(Number(e.target.value || 0))}
                      sx={{
                        height: 32,
                        borderRadius: '6px',
                        bgcolor:
                          row.readOnly || !row.enabled || voucherData.perLineGst
                            ? '#F8FAFC'
                            : '#FFFFFF',
                        fontSize: '0.8125rem',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                        '& .MuiSelect-select': { py: 0.4, pr: '28px !important' },
                      }}
                      renderValue={(selected) => {
                        if (voucherData.perLineGst) return t('expenseApproval.voucher.perItemGstRateHint');
                        if (!selected) return '-';
                        return `${formatGstRateOption(Number(selected))}%`;
                      }}
                    >
                      <MenuItem value="">
                        <em>-</em>
                      </MenuItem>
                      {row.allowedRates.map((rate) => (
                        <MenuItem key={rate} value={String(rate)}>
                          {formatGstRateOption(rate)}%
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography
                    variant="body2"
                    sx={{
                      textAlign: { xs: 'right', sm: 'right' },
                      fontVariantNumeric: 'tabular-nums',
                      color: 'text.secondary',
                      fontWeight: 500,
                      fontSize: '0.8125rem' }}
                  >
                    {formatDecimal2(row.amount)}
                  </Typography>
                </Box>
              ))}

              <Box sx={{ mt: 0.75, pt: 0.5, borderTop: `1px solid ${EXPENSE_LINE}` }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={voucherData.tdsEnabled}
                      onChange={(e) => setVoucherData({ ...voucherData, tdsEnabled: e.target.checked })}
                      size="small"
                      sx={{ py: 0 }}
                    />
                  }
                  label={<Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem' }}>{t('expenseApproval.voucher.tdsApply')}</Typography>}
                  sx={{ ml: -0.5, mb: 0, minHeight: 28 }}
                />
                <Collapse in={voucherData.tdsEnabled} timeout="auto" unmountOnExit>
                  <Box sx={{ mt: 0.5 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(88px,auto) 88px 1fr' },
                        gap: 1,
                        alignItems: 'center' }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                        TDS (E)
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={voucherData.tdsRate}
                        onChange={(e) => setVoucherData({ ...voucherData, tdsRate: Number(e.target.value || 0) })}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                        inputProps={{ min: 0, step: 0.01 }}
                        sx={{
                          width: { xs: '100%', sm: 'auto' },
                          maxWidth: { xs: 120, sm: 'none' },
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                            bgcolor: (theme) => alpha(theme.palette.text.primary, 0.03),
                            '& fieldset': { borderColor: (theme) => alpha(theme.palette.text.primary, 0.08) } } }}
                      />
                      <Typography
                        variant="body2"
                        sx={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'text.secondary',
                          fontWeight: 500 }}
                      >
                        −{formatDecimal2(tdsAmount)}
                      </Typography>
                    </Box>
                  </Box>
                </Collapse>
                {autoDiscountAmount > 0 ? (
                  <Box
                    sx={{
                      mt: 0.5,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(88px,auto) 88px 1fr' },
                      gap: 1,
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem', gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                      {t('expenseApproval.voucher.autoDiscount')}
                      {!voucherData.tdsEnabled ? ' (E)' : ''}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', textAlign: { xs: 'left', sm: 'center' }, fontSize: '0.75rem' }}
                    >
                      —
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'text.secondary',
                        fontWeight: 500,
                        fontSize: '0.8125rem',
                      }}
                    >
                      −{formatDecimal2(autoDiscountAmount)}
                    </Typography>
                  </Box>
                ) : null}
              </Box>

              <Box
                sx={{
                  mt: 0.75,
                  pt: 0.6,
                  px: 1,
                  pb: 0.6,
                  borderRadius: '6px',
                  bgcolor: EXPENSE_TOTAL_BG,
                  border: `1px solid ${EXPENSE_TOTAL_LINE}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 0.5 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, letterSpacing: '-0.02em', color: EXPENSE_TOTAL_FG }}>
                  {t('expenseApproval.voucher.grandTotal')}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: EXPENSE_TOTAL_FG }}>
                  {formatDecimal2(totalAmount)}
                </Typography>
              </Box>
            </Box>
            )}

            <TextField
              label={
                voucherData.formType === 'tds' || currentAttachments.length
                  ? t('expenseApproval.voucher.remarksIfAny')
                  : voucherData.formType === 'gst'
                    ? t('expenseApproval.voucher.remarksRequiredGst')
                    : t('expenseApproval.voucher.remarksRequired')
              }
              value={voucherData.remarks}
              onChange={(e) => setVoucherData({ ...voucherData, remarks: e.target.value })}
              fullWidth
              multiline
              minRows={3}
              required={voucherData.formType !== 'tds' && !currentAttachments.length}
              helperText={
                voucherData.formType === 'tds' || currentAttachments.length
                  ? undefined
                  : voucherData.formType === 'gst'
                    ? t('expenseApproval.voucher.remarksRequiredGstHint')
                    : t('expenseApproval.voucher.remarksRequiredHint')
              }
              sx={{ mt: 2, ...softFieldSx }}
            />

            {voucherData.formType !== 'tds' && (
              <>
            <Divider sx={{ my: 1.5, borderColor: alpha(theme.palette.text.primary, 0.08) }} />

            <Box sx={sectionShellSx}>
              <Typography variant="subtitle2" sx={sectionTitleSx}>
                {voucherData.formType === 'gst'
                  ? t('expenseApproval.voucher.sectionCalculationAttachments')
                  : t('expenseApproval.voucher.sectionReceipts')}
              </Typography>
              {voucherData.formType === 'gst' ? (
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, pl: EXPENSE_TEXT_PAD_LEFT }}>
                  {t('expenseApproval.voucher.gstPaymentCalculationLabel')}
                </Typography>
              ) : (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {t('expenseApproval.voucher.invoiceTypeHint')}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 0.5,
                      mb: 1,
                    }}
                  >
                    <RadioGroup
                      row
                      value={receiptInvoiceType}
                      onChange={(e) => {
                        const next = e.target.value as ExpenseInvoiceType;
                        setReceiptInvoiceType(next);
                        setVoucherData((prev) => ({
                          ...prev,
                          invoiceMode: next,
                          noInvoice: next === 'none',
                        }));
                      }}
                      sx={{ mr: 1 }}
                    >
                      <FormControlLabel
                        value="tax"
                        control={<Radio size="small" />}
                        label={t('expenseApproval.voucher.invoiceTypeTax')}
                      />
                      <FormControlLabel
                        value="proforma"
                        control={<Radio size="small" />}
                        label={t('expenseApproval.voucher.invoiceTypeProforma')}
                      />
                      <FormControlLabel
                        value="none"
                        control={<Radio size="small" />}
                        label={t('expenseApproval.voucher.invoiceTypeNone')}
                      />
                    </RadioGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={Boolean(voucherData.isPrepaid)}
                          onChange={(e) =>
                            setVoucherData({ ...voucherData, isPrepaid: e.target.checked })
                          }
                        />
                      }
                      label={t('expenseApproval.voucher.prepaid')}
                      sx={{ ml: 0 }}
                    />
                  </Box>
                  {voucherData.isPrepaid ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 1 }}
                    >
                      {t('expenseApproval.voucher.prepaidHint')}
                    </Typography>
                  ) : null}
                  {voucherData.noInvoice && !voucherData.isPrepaid ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 1 }}
                    >
                      {t('expenseApproval.voucher.noInvoiceHint')}
                    </Typography>
                  ) : null}
                </>
              )}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                {voucherData.formType !== 'gst' && (
                  <Button variant="outlined" startIcon={<QrCodeIcon />} onClick={handleOpenQr} disabled={qrLoading} sx={{ textTransform: 'none', borderRadius: '8px' }}>
                  {qrLoading ? t('expenseApproval.voucher.receiptQrLoading') : t('expenseApproval.voucher.receiptQr')}
                </Button>
                )}
                <Button variant="outlined" component="label" disabled={uploadingReceipts} sx={{ textTransform: 'none', borderRadius: '8px' }}>
                  {uploadingReceipts ? t('expenseApproval.voucher.receiptUploading') : t('expenseApproval.voucher.receiptUpload')}
                  <input
                    hidden
                    multiple
                    type="file"
                    {...(voucherData.formType === 'gst'
                      ? {}
                      : { accept: 'image/*,application/pdf' })}
                    onChange={(e) => {
                      void handleUploadReceipts(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </Button>
                {voucherData.formType !== 'gst' && (
                  <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadExpenseData} sx={{ textTransform: 'none', borderRadius: '8px' }}>
                  {t('expenseApproval.voucher.refresh')}
                </Button>
                )}
              </Box>
              {currentAttachments.length ? (
                renderAttachmentList(currentAttachments, {
                  deletable: true,
                  onDelete: handleDeleteReceipt,
                  ...(voucherData.formType === 'gst'
                    ? { typeLabel: t('expenseApproval.voucher.gstPaymentCalculationLabel') }
                    : {}),
                })
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {voucherData.formType === 'gst'
                    ? t('expenseApproval.voucher.calculationNone')
                    : t('expenseApproval.voucher.receiptNone')}
                </Typography>
              )}
            </Box>
              </>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => void leaveExpenseForm()}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                disableElevation
                onClick={() => void handleSaveExpense()}
                disabled={saving || isInitializingDraft || (isEdit ? editGuard.disabled : createGuard.disabled)}
                sx={mvsBodyPrimaryBtnSx}
              >
                {saving
                  ? isRevisionResubmitEdit
                    ? t('expenseApproval.voucher.resubmitAfterRevisionSaving')
                    : isPreApprovalEdit
                      ? t('common.processing')
                      : t('expenseApproval.voucher.submitSaving')
                  : isRevisionResubmitEdit
                    ? t('expenseApproval.voucher.resubmitAfterRevision')
                    : isPreApprovalEdit
                      ? t('common.save')
                      : isEdit
                        ? t('expenseApproval.voucher.submit')
                        : t('expenseApproval.voucher.create')}
              </Button>
            </Box>
            </Box>
            </CardContent>
        </Card>

        <Dialog open={qrOpen} onClose={() => setQrOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{t('expenseApproval.dialog.uploadByPhoneTitle')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('expenseApproval.voucher.qrDialogHint')}
            </Typography>
            {qrImage && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <img
                  src={qrImage}
                  alt="receipt-upload-qr"
                />
              </Box>
            )}
            {!qrImage && !qrImageError && (
              <Typography variant="body2" color="text.secondary">
                {t('expenseApproval.voucher.qrGenerating')}
              </Typography>
            )}
            {qrImageError && (
              <Typography variant="body2" color="error">
                {qrImageError}
              </Typography>
            )}
            {qrUrl && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, wordBreak: 'break-all' }}>
                {qrUrl}
              </Typography>
            )}
            {currentAttachments.length > 0 && (
              <Box sx={{ mt: 1, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  {t('expenseApproval.detail.attachments')} ({currentAttachments.length})
                </Typography>
                {renderAttachmentList(currentAttachments, {
                  deletable: true,
                  onDelete: handleDeleteReceipt,
                })}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setQrOpen(false)} sx={mvsBodyOutlinedBtnSx}>{t('common.close')}</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={reasonDialogOpen} onClose={closeReasonDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {reasonDialogType === 'payment-approve'
              ? t('expenseApproval.dialog.finalApproveReasonTitle')
              : reasonDialogType === 'expense-edit'
                ? t('expenseApproval.dialog.editReasonTitle')
                : reasonDialogType === 'expense-revision-reject'
                  ? t('expenseApproval.dialog.revisionRejectReasonTitle')
                  : t('expenseApproval.dialog.rejectReasonTitle')}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              placeholder={
                reasonDialogType === 'payment-approve'
                  ? t('expenseApproval.dialog.finalApproveReasonPlaceholder')
                  : reasonDialogType === 'expense-edit'
                    ? t('expenseApproval.dialog.editReasonPlaceholder')
                    : reasonDialogType === 'expense-revision-reject'
                      ? t('expenseApproval.dialog.revisionRejectReasonPlaceholder')
                      : t('expenseApproval.dialog.rejectReasonPlaceholder')
              }
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={closeReasonDialog} sx={mvsBodyOutlinedBtnSx}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              disableElevation
              color={
                reasonDialogType === 'payment-approve'
                  ? 'success'
                  : reasonDialogType === 'expense-edit'
                    ? 'primary'
                    : reasonDialogType === 'expense-revision-reject'
                      ? 'warning'
                      : 'error'
              }
              onClick={() => void handleReasonSubmit()}
              sx={mvsBodyPrimaryBtnSx}
            >
              {reasonDialogType === 'payment-approve'
                ? t('expenseApproval.actions.approve')
                : reasonDialogType === 'expense-edit'
                  ? t('expenseApproval.voucher.resubmitAfterRevision')
                  : reasonDialogType === 'expense-revision-reject'
                    ? t('expenseApproval.actions.revisionReject')
                    : t('expenseApproval.actions.reject')}
            </Button>
          </DialogActions>
        </Dialog>

        {attachmentPreviewDialog}
        {statusSnackbars}
      </Box>
    );
  }

  if (viewMode === 'view' && selectedExpense) {
    const meta = selectedExpense.itemMeta || {};
    const approvedById = meta.approvedById ? Number(meta.approvedById) : null;
    const approvedByName =
      (approvedById != null && getUserNameById(approvedById) !== '-')
        ? getUserNameById(approvedById)
        : selectedExpense.currentApproverName || '-';
    const linkedPartner = partners.find((p) => String(p.id) === String(meta.partnerId || ''));
    const partnerName =
      meta.department ||
      linkedPartner?.company_name ||
      '-';
    const partnerDetail = {
      gstNumber: meta.gstNumber || pickPartnerGstNumber(linkedPartner || ({} as PartnerOption)) || '-',
      partnerRepresentative: meta.partnerRepresentative || linkedPartner?.representative || '-',
      partnerPan: meta.partnerPan || linkedPartner?.pan_number || '-',
      partnerPhone: meta.partnerPhone || linkedPartner?.phone || '-',
      partnerEmail: meta.partnerEmail || linkedPartner?.email || '-',
      partnerAddress: meta.partnerAddress || linkedPartner?.address || '-',
      acHolder: meta.acHolder || linkedPartner?.account_holder || '-',
      bank: meta.bank || linkedPartner?.bank_name || '-',
      accountNumber: meta.accountNumber || linkedPartner?.account_number || '-',
      ifsc: meta.ifsc || linkedPartner?.bank_ifsc || '-',
    };
    const hasVendorInfo = [partnerName, ...Object.values(partnerDetail)].some((value) => {
      const text = String(value || '').trim();
      return Boolean(text) && text !== '-';
    });
    const voucherNo = meta.voucherNo || selectedExpense.expenseId || '-';
    const voucherDate = meta.voucherDate || selectedExpense.dueDate || selectedExpense.createdAt || '';
    const isRequester = isSameUserId(user?.id, selectedExpense.requesterId);
    const isFinalApprover = isDesignatedApprover(selectedExpense);
    const isPaymentOfficer = hasTransferAccess;
    const isPaymentRequested = selectedExpense.paymentRequestStatus === 'requested';
    const isPaymentApproved = selectedExpense.paymentRequestStatus === 'approved';
    const isPaymentPaid = selectedExpense.paymentRequestStatus === 'paid';
    const canApproveThis = listTab !== 'transfer' && canUserApproveExpense(selectedExpense);
    // root: 송금 탭·승인/지급 후에도 반려·수정반려·삭제 가능
    const canRevisionRejectThis =
      (listTab !== 'transfer' || isRootUser) && canUserRevisionRejectExpense(selectedExpense);
    const canFinalRejectThis =
      (listTab !== 'transfer' || isRootUser) &&
      (canApproveThis || canUserFinalRejectExpense(selectedExpense));
    const canDeleteThis = canDeleteExpense(selectedExpense);
    const canEditThis = canEditExpense(selectedExpense);
    const canResubmitThis = canResubmitExpense(selectedExpense);
    const canChangeApproverThis = listTab !== 'transfer' && canChangeExpenseApprover(selectedExpense);
    const isExpenseApproved = selectedExpense.status === 'approved' || selectedExpense.status === 'paid';
    const taxSummary = calcExpenseTax(
      selectedExpense.items,
      meta,
      companyGstNumber,
      companyGstState
    );
    const detailFormType = resolveExpenseFormType(meta);
    const detailGstPeriodLabel = getGstPeriodLabel(
      String(meta.voucherDate || voucherDate || selectedExpense.createdAt || ''),
      i18n.language
    );
    const detailGstItems =
      detailFormType === 'gst' ? parseGstSummaryLineItems(selectedExpense.items || []) : [];
    const detailGstPayable =
      detailFormType === 'gst' ? calcGstPayableAmount(detailGstItems) : 0;
    const remittanceEntries = getExpenseRemittanceEntries(selectedExpense);
    const approvalFlowNodes = (() => {
      const steps = [...(selectedExpense.approvalFlow || [])].sort(
        (a, b) => (a.stepOrder || 0) - (b.stepOrder || 0)
      );
      const nodes: Array<{
        key: string;
        label: string;
        name: string;
        muted?: boolean;
        editable?: boolean;
        pdfHide?: boolean;
        relaxedLabel?: boolean;
      }> = [
        {
          key: 'prepared',
          label: t('expenseApproval.voucher.prepared'),
          name: selectedExpense.requesterName || '-',
        },
      ];
      if (steps.length === 0) {
        nodes.push({
          key: 'approve',
          label: t('expenseApproval.voucher.approved'),
          name: approvedByName,
          editable: true,
        });
      } else {
        const lastIndex = steps.length - 1;
        steps.forEach((step, index) => {
          nodes.push({
            key: String(step.id || `${step.approverId}-${step.stepOrder}-${index}`),
            label: getExpenseFlowStampLabel(step, (key) => t(key)),
            name: step.approverName || getUserNameById(step.approverId),
            muted: step.status === 'skipped',
            pdfHide: step.status === 'skipped',
            relaxedLabel: step.action === 'revision_rejected',
            editable:
              isSameUserId(step.approverId, approvedById) ||
              (approvedById == null && index === lastIndex),
          });
        });
      }
      return nodes;
    })();

    const renderExpenseCommentBody = (comment: ExpenseReportComment, options?: { compact?: boolean; allowReply?: boolean }) => {
      const compact = options?.compact;
      const allowReply = options?.allowReply !== false;
      const isEditing = expenseCommentEditingId === comment.id;
      const fontSize = compact ? '0.8125rem' : undefined;

      if (isEditing) {
    return (
          <Box sx={{ mt: 0.5, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { sm: 'flex-start' } }}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              size="small"
              autoFocus
              value={expenseCommentEditDraft}
              onChange={(e) => setExpenseCommentEditDraft(e.target.value)}
              onKeyDown={(e) =>
                submitExpenseCommentOnEnter(
                  e,
                  () => void handleUpdateExpenseComment(comment.id),
                  expenseCommentSubmitting || !expenseCommentEditDraft.trim()
                )
              }
              disabled={expenseCommentSubmitting}
              inputProps={{ 'data-skip-proper-case': '1', 'data-comment-input': '1' }}
            />
            <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
              <Button
                variant="contained"
                disableElevation
                onClick={() => void handleUpdateExpenseComment(comment.id)}
                disabled={expenseCommentSubmitting || !expenseCommentEditDraft.trim()}
                sx={{ ...mvsBodyPrimaryBtnSx, whiteSpace: 'nowrap' }}
              >
                {expenseCommentSubmitting
                  ? t('expenseApproval.detail.commentEditSubmitting')
                  : t('expenseApproval.detail.commentSave')}
              </Button>
              <Button
                variant="outlined"
                onClick={cancelExpenseCommentEdit}
                disabled={expenseCommentSubmitting}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('common.cancel')}
              </Button>
            </Box>
          </Box>
        );
      }

      return (
        <>
          <Typography
            variant="body2"
            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize }}
          >
            {comment.comment}
          </Typography>
          {menuFlags.canRead ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.5 }}>
              {allowReply ? (
                <Button
                  size="small"
                  startIcon={<ReplyIcon sx={{ fontSize: '0.95rem !important' }} />}
                  onClick={() => {
                    cancelExpenseCommentEdit();
                    if (expenseCommentReplyTo === comment.id) {
                      setExpenseCommentReplyTo(null);
                      setExpenseCommentReplyDraft('');
                      return;
                    }
                    setExpenseCommentReplyTo(comment.id);
                    setExpenseCommentReplyDraft('');
                  }}
                  sx={{
                    px: 0.5,
                    minWidth: 0,
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                  }}
                >
                  {t('expenseApproval.detail.reply')}
                </Button>
              ) : null}
              {canEditExpenseComment(comment) ? (
                <Button
                  size="small"
                  startIcon={<EditIcon sx={{ fontSize: '0.95rem !important' }} />}
                  onClick={() => startExpenseCommentEdit(comment)}
                  sx={{
                    px: 0.5,
                    minWidth: 0,
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                  }}
                >
                  {t('expenseApproval.detail.commentEdit')}
                </Button>
              ) : null}
            </Box>
          ) : null}
        </>
      );
    };

    return (
      <Box sx={{ ...expensePageRootSx }}>
        <Box className="expense-no-print">
        <MvsPageHeader
          title={t('expenseApproval.detail.title')}
          actions={
            <>
            <Button
              variant="outlined"
              onClick={() => void handleBackToExpenseList()}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('expenseApproval.actions.backToList')}
            </Button>
            {canApproveThis && (
              <Button
                variant="contained"
                color="success"
                disableElevation
                startIcon={<CheckCircleIcon fontSize="small" />}
                onClick={() => handleApproveExpense(selectedExpense.id)}
                sx={mvsBodyPrimaryBtnSx}
              >
                {t('expenseApproval.actions.accept')}
              </Button>
            )}
            {(canApproveThis || canRevisionRejectThis) && (
              <Button
                variant="contained"
                color="warning"
                disableElevation
                startIcon={<EditIcon fontSize="small" />}
                onClick={() => openReasonDialog('expense-revision-reject', selectedExpense.id)}
              >
                {t('expenseApproval.actions.revisionReject')}
              </Button>
            )}
            {canFinalRejectThis && (
              <Button
                variant="contained"
                color="error"
                disableElevation
                startIcon={<CancelIcon fontSize="small" />}
                onClick={() => openReasonDialog('expense-reject', selectedExpense.id)}
              >
                {t('expenseApproval.actions.reject')}
              </Button>
            )}
            {canDeleteThis && (
              <Button
                variant="outlined"
                color="error"
                disableElevation
                startIcon={<DeleteIcon fontSize="small" />}
                onClick={() => handleDeleteExpense(selectedExpense.id)}
                disabled={deleteGuard.disabled}
              >
                {t('common.delete')}
              </Button>
            )}
            {canEditThis && (
            <Button
              variant="contained"
              disableElevation
              startIcon={<EditIcon fontSize="small" />}
              onClick={() => handleEditExpense(selectedExpense)}
              sx={mvsBodyPrimaryBtnSx}
            >
              {t('expenseApproval.actions.editDetail')}
            </Button>
            )}
            {canResubmitThis && (
            <Button
              variant="contained"
              disableElevation
              startIcon={<SendIcon fontSize="small" />}
              onClick={() => handleResubmitExpense(selectedExpense.id)}
              sx={mvsBodyPrimaryBtnSx}
            >
              {t('expenseApproval.actions.resubmit')}
            </Button>
            )}
            </>
          }
        />
        </Box>

        <Card
          elevation={0}
          ref={expensePdfRef}
          className="expense-pdf-root"
          sx={{ ...mvsBodyCardSx, mb: 3 }}
        >
          <Box sx={{ borderBottom: `1px solid ${EXPENSE_LINE}`, bgcolor: '#FFFFFF' }}>
            <Box
              className="expense-pdf-header"
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: { md: 'space-between' },
                alignItems: { xs: 'stretch', md: 'flex-start' },
                gap: { xs: 1, md: 1.5 },
                width: '100%',
                px: { xs: 1.5, sm: 2 },
                pt: 2,
                pb: 1.25,
                overflowX: { md: 'auto' },
                overflowY: 'visible',
                boxSizing: 'border-box',
              }}
            >
              <Box
                className="expense-pdf-header-left"
                sx={{ minWidth: 0, flex: { md: '1 1 auto' }, display: 'flex', flexDirection: 'column', gap: 1.5 }}
              >
                <ExpenseCompanyBlock
                  logo={companyLogo}
                  logoAlt={t('expenseApproval.voucher.companyLogoAlt')}
                  name={companyName}
                  address={companyAddress}
                  gstNumber={companyGstNumber}
                />
                <Box className="expense-pdf-voucher-row">
                  <ExpenseVoucherMetaTable
                    voucherLabel={t('expenseApproval.voucher.labelVoucherNumber')}
                    dateLabel={t('expenseApproval.voucher.labelDateCreated')}
                    voucherNo={voucherNo}
                    dateText={
                      voucherDate
                        ? new Date(String(voucherDate).slice(0, 10) + 'T00:00:00').toLocaleDateString(dateLocale)
                        : '-'
                    }
                  />
          </Box>
        </Box>

              <Box
                className="expense-pdf-header-right"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 1,
                  flexShrink: 0,
                  ml: { md: 'auto' },
                  width: { xs: '100%', md: 'auto' },
                  maxWidth: '100%',
                }}
              >
                <Typography
                  className="expense-pdf-amount expense-pdf-doc-title"
                  sx={{
                    fontWeight: 700,
                    fontSize: '1.125rem',
                    color: '#0F172A',
                    textAlign: 'right',
                  }}
                >
                  {t('expenseApproval.voucher.subtitle')}
                </Typography>
                <Box className="expense-pdf-stamps" sx={expenseApprovalStampsGridSx}>
                  {chunkApprovalFlowNodes(approvalFlowNodes, EXPENSE_APPROVAL_STAMPS_PER_ROW).map((rowNodes, rowIndex) => (
                    <Box
                      key={`expense-approval-stamp-row-${rowIndex}`}
                      className="expense-pdf-stamps-row"
                      sx={expenseApprovalStampsRowSx}
                    >
                      {rowNodes.map((node, colIndex) => {
                        const isLastInRow = colIndex === rowNodes.length - 1;
                        const showArrow = !isLastInRow;
                        return (
                          <Box
                            key={node.key}
                            className={`expense-flow-stamp-wrap${node.pdfHide ? ' expense-pdf-hide' : ''}`}
                            sx={expenseApprovalStampWrapSx}
                          >
                            <ExpenseFlowStamp
                              label={node.label}
                              name={node.name}
                              muted={node.muted}
                              wide={false}
                              fluidWidth
                              relaxedLabel={node.relaxedLabel}
                            >
                              {canChangeApproverThis && node.editable ? (
                                <Autocomplete
                                  size="small"
                                  disableClearable
                                  disabled={approverSaving}
                                  options={selectableApprovers}
                                  getOptionLabel={(option) => option.name}
                                  isOptionEqualToValue={(a, b) => Number(a.id) === Number(b.id)}
                                  value={
                                    selectableApprovers.find((item) => isSameUserId(item.id, approvedById))
                                    || approvers.find((item) => isSameUserId(item.id, approvedById))
                                    || undefined
                                  }
                                  onChange={(_, value) => {
                                    handleChangeApprover(value);
                                  }}
                                  sx={getExpenseApproverControlSx(longestSelectableApproverNameChars)}
                                  slotProps={expenseApproverAutocompleteSlotProps}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      placeholder={t('expenseApproval.placeholders.searchSimple')}
                                      variant="standard"
                                      size="small"
                                      InputProps={{
                                        ...params.InputProps,
                                        disableUnderline: true,
                                      }}
                                      sx={{
                                        '& .MuiInputBase-root': {
                                          fontSize: '0.8125rem',
                                          fontWeight: 600,
                                          justifyContent: 'center',
                                          minHeight: 32,
                                          height: 32,
                                          alignItems: 'center',
                                          flexWrap: 'nowrap',
                                        },
                                        '& .MuiInputBase-input': {
                                          textAlign: 'center',
                                          py: 0,
                                          height: 32,
                                          boxSizing: 'border-box',
                                          whiteSpace: 'nowrap',
                                          textOverflow: 'ellipsis',
                                          overflow: 'hidden',
                                        },
                                      }}
                                    />
                                  )}
                                />
                              ) : undefined}
                            </ExpenseFlowStamp>
                            {showArrow ? (
                              <Box
                                sx={{
                                  width: 20,
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <ArrowForwardIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
                              </Box>
                            ) : null}
                          </Box>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
                {(selectedExpense.ccUserIds || []).length > 0 && (
                  <Box
                    className="expense-pdf-hide"
                    sx={{
                      width: '100%',
                      maxWidth: 320,
                      border: `1px solid ${EXPENSE_STAMP_LINE}`,
                      borderRadius: EXPENSE_STAMP_RADIUS,
                      bgcolor: '#FFFFFF',
                      alignSelf: 'flex-end',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        px: 1,
                        py: 0.35,
                        ...expenseStampHeaderSx,
                        textAlign: 'left',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                        {t('expenseApproval.cc.label')}
                </Typography>
                </Box>
                    <Box sx={{ px: 1, py: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selectedExpense.ccUserIds || []).map((id) => (
                        <Box
                          key={id}
                          sx={{
                            px: 0.75,
                            py: 0.25,
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#334155',
                            bgcolor: '#EEF2F7',
                          }}
                        >
                          {getUserNameById(id) || `#${id}`}
              </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          <CardContent sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box
              className="expense-pdf-title-row"
              sx={{
                border: `1px solid ${EXPENSE_LINE}`,
                borderRadius: '6px',
                overflow: 'hidden',
                display: 'grid',
                gridTemplateColumns: `${EXPENSE_KV_LABEL_WIDTH_PX}px minmax(0, 1fr)`,
                minHeight: COMPACT_ROW_HEIGHT,
                height: COMPACT_ROW_HEIGHT,
                bgcolor: '#FFFFFF',
                boxSizing: 'border-box',
              }}
            >
              <Box
                className="expense-pdf-kv-label"
                sx={{
                  ...kvLabelCellSx,
                  display: 'flex',
                  alignItems: 'center',
                  py: '0 !important',
                  lineHeight: 1,
                  height: '100%',
                  borderRight: `1px solid ${EXPENSE_LINE}`,
                  borderTopLeftRadius: '5px',
                  borderBottomLeftRadius: '5px',
                }}
              >
                {t('expenseApproval.voucher.labelTitle')}
              </Box>
              <Box
                sx={{
                  px: 1.25,
                  py: 0,
                  display: 'flex',
                  flexWrap: 'nowrap',
                  alignItems: 'center',
                  gap: 1,
                  minWidth: 0,
                  height: '100%',
                  lineHeight: 1,
                }}
              >
                <Typography
                  className="expense-pdf-title"
                  sx={{
                    fontWeight: 400,
                    fontSize: '0.8125rem',
                    color: '#0F172A',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {selectedExpense.title || t('expenseApproval.detail.title')}
                </Typography>
                <Box className="expense-pdf-hide" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {getStatusChip(resolveDisplayStatus(selectedExpense))}
                  {expenseIsPrepaid(selectedExpense) ? (
                    <Chip
                      label={t('expenseApproval.voucher.prepaid')}
                      size="small"
                      color="info"
                      variant="outlined"
                      sx={{ ml: 0.5 }}
                    />
                  ) : null}
                  {getPriorityChip(selectedExpense.priority)}
                </Box>
              </Box>
            </Box>

            {/* 지출 신청 */}
            <Box className="expense-pdf-section">
              <Typography className="expense-pdf-section-title" variant="subtitle2" sx={sectionTitleSx}>
                  {t('expenseApproval.voucher.sectionRequest')}
                  </Typography>
              <Box
                sx={{
                  border: `1px solid ${EXPENSE_VENDOR_LINE}`,
                  borderRadius: '6px',
                  bgcolor: '#FFFFFF',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `${EXPENSE_KV_LABEL_WIDTH_PX}px minmax(0, 1fr)`,
                    minHeight: COMPACT_ROW_HEIGHT,
                    borderBottom: `1px solid ${EXPENSE_LINE}`,
                    boxSizing: 'border-box',
                  }}
                >
                  <Box
                    className="expense-pdf-kv-label expense-request-meta-label"
                    sx={{
                      ...kvLabelCellSx,
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                      borderRight: `1px solid ${EXPENSE_LINE}`,
                      bgcolor: '#D8E2EC !important',
                      color: `${EXPENSE_HEADER_FG} !important`,
                      fontWeight: 400,
                      boxSizing: 'border-box',
                    }}
                  >
                    {t('expenseApproval.columns.requester')}
                </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'minmax(0, 1fr) 132px minmax(0, 1.4fr) 100px minmax(0, 0.85fr)',
                      },
                      alignItems: 'stretch',
                      minWidth: 0,
                      minHeight: COMPACT_ROW_HEIGHT,
                    }}
                  >
                    <Box
                      sx={{
                        px: 1,
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: 0,
                        fontWeight: 400,
                        borderRight: { sm: `1px solid ${EXPENSE_LINE}` },
                      }}
                    >
                      <ClampText>{selectedExpense.requesterName || '-'}</ClampText>
                    </Box>
                    <Box
                      className="expense-pdf-kv-label expense-request-meta-label"
                      sx={{
                        display: { xs: 'none', sm: 'flex' },
                        alignItems: 'center',
                        px: 1,
                        bgcolor: '#D8E2EC',
                        color: EXPENSE_HEADER_FG,
                        fontWeight: 400,
                        fontSize: '0.8125rem',
                        borderRight: `1px solid ${EXPENSE_LINE}`,
                        boxSizing: 'border-box',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('expenseApproval.voucher.departmentRole')}
                    </Box>
                    <Box
                      sx={{
                        display: { xs: 'none', sm: 'flex' },
                        px: 1,
                        alignItems: 'center',
                        minWidth: 0,
                        fontWeight: 400,
                        borderRight: `1px solid ${EXPENSE_LINE}`,
                      }}
                    >
                      <ClampText>
                        {[selectedExpense.requesterDepartment, selectedExpense.requesterPosition]
                          .filter((v) => v && String(v).trim() && String(v).trim() !== '-')
                          .join(' / ') || '-'}
                      </ClampText>
                    </Box>
                    <Box
                      className="expense-pdf-kv-label expense-request-meta-label"
                      sx={{
                        display: { xs: 'none', sm: 'flex' },
                        alignItems: 'center',
                        px: 1,
                        bgcolor: '#D8E2EC',
                        color: EXPENSE_HEADER_FG,
                        fontWeight: 400,
                        fontSize: '0.8125rem',
                        borderRight: `1px solid ${EXPENSE_LINE}`,
                        boxSizing: 'border-box',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('expenseApproval.voucher.labelDateCreated')}
                    </Box>
                    <Box
                      sx={{
                        display: { xs: 'none', sm: 'flex' },
                        px: 1,
                        alignItems: 'center',
                        fontWeight: 400,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {voucherDate
                        ? new Date(String(voucherDate).slice(0, 10) + 'T00:00:00').toLocaleDateString(dateLocale)
                        : selectedExpense.createdAt
                          ? new Date(String(selectedExpense.createdAt).slice(0, 10) + 'T00:00:00').toLocaleDateString(
                              dateLocale
                            )
                          : '-'}
                    </Box>
                  </Box>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `${EXPENSE_KV_LABEL_WIDTH_PX}px minmax(0, 1fr)`,
                    minHeight: COMPACT_ROW_HEIGHT,
                    boxSizing: 'border-box',
                  }}
                >
                  <Box
                    className="expense-pdf-kv-label"
                    sx={{
                      ...kvLabelCellSx,
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                      borderRight: `1px solid ${EXPENSE_LINE}`,
                      fontWeight: 400,
                      boxSizing: 'border-box',
                    }}
                  >
                    {t('expenseApproval.detail.purpose')}
                  </Box>
                  <Box sx={{ px: 1, py: 0.75, display: 'flex', alignItems: 'center', minWidth: 0, fontWeight: 600 }}>
                    <ClampText title={String(selectedExpense.purpose || '')}>
                      {selectedExpense.purpose || '-'}
                    </ClampText>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* 대금을 받는 협력업체 — 표시할 정보가 없으면 숨김 */}
            {hasVendorInfo && (
            <Box className="expense-pdf-section">
              <Typography className="expense-pdf-section-title" variant="subtitle2" sx={{ ...sectionTitleSx, fontWeight: 400 }}>
                  {t('expenseApproval.voucher.sectionVendor')}
                </Typography>
              <TableContainer sx={{ border: `1px solid ${EXPENSE_VENDOR_LINE}`, borderRadius: '6px', bgcolor: '#FFFFFF', overflowX: 'hidden' }}>
                <Table size="small" sx={compactTableSx}>
                  <TableBody>
                    <TableRow>
                      <TableCell className="expense-pdf-kv-label" sx={vendorKvLabelCellSx}>{t('expenseApproval.voucher.labelPartner')}</TableCell>
                      <TableCell sx={{ fontWeight: 400, ...wrapCellSx }}>
                        <ClampText title={formatEnglishSentenceLabel(partnerName)}>
                          {formatEnglishSentenceLabel(partnerName) || '-'}
                        </ClampText>
                      </TableCell>
                      <TableCell className="expense-pdf-kv-label" sx={vendorKvLabelCellSx}>{t('expenseApproval.voucher.labelGstNumber')}</TableCell>
                      <TableCell sx={{ fontWeight: 400, ...wrapCellSx }}>
                        <ClampText title={String(partnerDetail.gstNumber || '')}>{partnerDetail.gstNumber}</ClampText>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="expense-pdf-kv-label" sx={vendorKvLabelCellSx}>{t('expenseApproval.voucher.labelRepresentative')}</TableCell>
                      <TableCell sx={{ fontWeight: 400, ...wrapCellSx }}>
                        <ClampText title={formatEnglishSentenceLabel(partnerDetail.partnerRepresentative)}>
                          {formatEnglishSentenceLabel(partnerDetail.partnerRepresentative) || '-'}
                        </ClampText>
                      </TableCell>
                      <TableCell className="expense-pdf-kv-label" sx={vendorKvLabelCellSx}>{t('expenseApproval.voucher.labelPanNumber')}</TableCell>
                      <TableCell sx={{ fontWeight: 400, ...wrapCellSx }}>
                        <ClampText>{partnerDetail.partnerPan}</ClampText>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="expense-pdf-kv-label" sx={vendorKvLabelCellSx}>{t('expenseApproval.voucher.labelPartnerPhone')}</TableCell>
                      <TableCell sx={{ fontWeight: 400, ...wrapCellSx }}>
                        <ClampText>
                          {normalizePhoneDigits(partnerDetail.partnerPhone)
                            ? formatPhoneDisplay(partnerDetail.partnerPhone)
                            : '-'}
                        </ClampText>
                      </TableCell>
                      <TableCell className="expense-pdf-kv-label" sx={vendorKvLabelCellSx}>{t('expenseApproval.voucher.labelPartnerEmail')}</TableCell>
                      <TableCell sx={{ fontWeight: 400, ...wrapCellSx }}>
                        <ClampText
                          title={
                            partnerDetail.partnerEmail && partnerDetail.partnerEmail !== '-'
                              ? normalizeEmailLower(partnerDetail.partnerEmail)
                              : ''
                          }
                        >
                          {partnerDetail.partnerEmail && partnerDetail.partnerEmail !== '-'
                            ? normalizeEmailLower(partnerDetail.partnerEmail)
                            : '-'}
                        </ClampText>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="expense-pdf-kv-label" sx={vendorKvLabelCellSx}>
                        {t('expenseApproval.voucher.labelPartnerAddress')}
                      </TableCell>
                      <TableCell colSpan={3} sx={{ fontWeight: 400, ...wrapCellSx }}>
                        <ClampText title={formatEnglishSentenceLabel(partnerDetail.partnerAddress)}>
                          {formatEnglishSentenceLabel(partnerDetail.partnerAddress) || '-'}
                        </ClampText>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="expense-pdf-kv-label" sx={vendorKvLabelCellSx}>{t('expenseApproval.voucher.labelAccountHolder')}</TableCell>
                      <TableCell sx={{ fontWeight: 400, ...wrapCellSx }}>
                        <ClampText title={formatEnglishSentenceLabel(partnerDetail.acHolder)}>
                          {formatEnglishSentenceLabel(partnerDetail.acHolder) || '-'}
                        </ClampText>
                      </TableCell>
                      <TableCell className="expense-pdf-kv-label" sx={vendorKvLabelCellSx}>{t('expenseApproval.voucher.labelBankName')}</TableCell>
                      <TableCell sx={{ fontWeight: 400, ...wrapCellSx }}>
                        <ClampText title={partnerDetail.bank || ''}>
                          {partnerDetail.bank || '-'}
                        </ClampText>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="expense-pdf-kv-label" sx={vendorKvLabelCellSx}>{t('expenseApproval.voucher.labelAccountNumber')}</TableCell>
                      <TableCell sx={{ fontWeight: 400, ...wrapCellSx }}>
                        <ClampText>
                          {normalizeBankAccountDigits(partnerDetail.accountNumber)
                            ? formatBankAccountDisplay(partnerDetail.accountNumber)
                            : '-'}
                        </ClampText>
                      </TableCell>
                      <TableCell className="expense-pdf-kv-label" sx={vendorKvLabelCellSx}>{t('expenseApproval.voucher.labelIfsc')}</TableCell>
                      <TableCell sx={{ fontWeight: 400, ...wrapCellSx }}>
                        <ClampText title={String(partnerDetail.ifsc || '').toUpperCase()}>
                          {partnerDetail.ifsc ? String(partnerDetail.ifsc).toUpperCase() : '-'}
                        </ClampText>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
            )}

            {/* 지출 항목 */}
            <Box className="expense-pdf-section">
              <Typography className="expense-pdf-section-title" variant="subtitle2" sx={sectionTitleSx}>
                  {t('expenseApproval.detail.items')}
              </Typography>
              {detailFormType === 'gst' ? (
                <>
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 0.5,
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    color: '#1E293B',
                    pl: 0.25,
                  }}
                >
                  {t('expenseApproval.voucher.gstSectionMain')}
                </Typography>
                <TableContainer sx={{ border: `1px solid ${EXPENSE_LINE}`, borderRadius: '6px', overflowX: 'auto' }}>
                  <Table size="small" sx={gstSummaryTableSx}>
                    {gstSummaryColGroup}
                  <TableHead
                    sx={{
                        bgcolor: EXPENSE_HEADER_BG,
                      '& .MuiTableCell-head': {
                          bgcolor: EXPENSE_HEADER_BG,
                          color: EXPENSE_HEADER_FG,
                        fontWeight: 600,
                          fontSize: '0.75rem',
                        textTransform: 'none',
                          letterSpacing: '0.02em',
                          borderTop: '2px solid #94A3B8',
                          borderBottom: `1px solid ${EXPENSE_LINE}`,
                          whiteSpace: 'nowrap',
                        },
                    }}
                  >
                    <TableRow>
                        <TableCell sx={{ width: 40 }}>{t('expenseApproval.voucher.tableNo')}</TableCell>
                        <TableCell>{t('expenseApproval.voucher.gstTableDetail')}</TableCell>
                        <TableCell align="right" sx={gstSummaryNumCellSx}>
                          {t('expenseApproval.voucher.gstTableTaxableValue')}
                        </TableCell>
                        <TableCell align="right" sx={gstSummaryNumCellSx}>
                          {t('expenseApproval.voucher.gstTableIgst')}
                        </TableCell>
                        <TableCell align="right" sx={gstSummaryNumCellSx}>
                          {t('expenseApproval.voucher.gstTableCgst')}
                        </TableCell>
                        <TableCell align="right" sx={gstSummaryNumCellSx}>
                          {t('expenseApproval.voucher.gstTableSgst')}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {GST_MAIN_ROW_DEFS.map((rowDef, index) => {
                        const item =
                          getGstLineByKey(detailGstItems, rowDef.key) ||
                          mapSavedGstSummaryItem({ id: `gst-${rowDef.key}` } as ExpenseItem, rowDef.key);
                        return (
                          <TableRow key={rowDef.key}>
                            <TableCell sx={gstSummaryDataCellSx}>{index + 1}</TableCell>
                            <TableCell sx={{ ...gstSummaryDetailCellSx, ...wrapCellSx }}>
                              <ClampText>
                                {t(`expenseApproval.voucher.${rowDef.labelKey}`, {
                                  period: rowDef.withPeriod ? detailGstPeriodLabel : undefined,
                                })}
                              </ClampText>
                            </TableCell>
                            <TableCell align="right" sx={{ ...gstSummaryNumCellSx, ...expenseAmountCellSx }}>
                              {formatAmount(Number(item.taxableValue || 0))}
                            </TableCell>
                            <TableCell align="right" sx={{ ...gstSummaryNumCellSx, ...expenseAmountCellSx }}>
                              {formatAmount(Number(item.igst || 0))}
                            </TableCell>
                            <TableCell align="right" sx={{ ...gstSummaryNumCellSx, ...expenseAmountCellSx }}>
                              {formatAmount(Number(item.cgst || 0))}
                            </TableCell>
                            <TableCell align="right" sx={{ ...gstSummaryNumCellSx, ...expenseAmountCellSx }}>
                              {formatAmount(Number(item.sgst || 0))}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                </TableContainer>

                <Typography
                  variant="subtitle2"
                  sx={{
                    mt: 1.5,
                    mb: 0.5,
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    color: '#1E293B',
                    pl: 0.25,
                  }}
                >
                  {t('expenseApproval.voucher.gstSectionExtra')}
                </Typography>
                <TableContainer
                  sx={{
                    border: '1px solid #C5D6C5',
                    borderRadius: '2px',
                    bgcolor: '#F3F8F3',
                    overflow: 'hidden',
                    mb: 1,
                  }}
                >
                  <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                    <TableBody>
                      {GST_EF_ROW_DEFS.map((rowDef, index) => {
                        const item =
                          getGstLineByKey(detailGstItems, rowDef.key) ||
                          mapSavedGstSummaryItem({ id: `gst-${rowDef.key}` } as ExpenseItem, rowDef.key);
                          const amount = getGstExtraPayableAmount(item);
                          const extra = item.gstExtra;
                          const detailBits =
                            rowDef.key === 'interest' && extra?.kind === 'interest'
                              ? [
                                  `${t('expenseApproval.voucher.gstInterestUnpaid')}: ${formatDecimal2(extra.unpaidAmount)}`,
                                  `${t('expenseApproval.voucher.gstInterestDueDate')}: ${extra.dueDate || '—'}`,
                                  `${t('expenseApproval.voucher.gstInterestPlannedDate')}: ${extra.plannedDate || '—'}`,
                                  `${t('expenseApproval.voucher.gstInterestDelayDays')}: ${extra.delayDays ?? '—'}`,
                                  `${t('expenseApproval.voucher.gstInterestAnnualRate')}: ${formatDecimal2(extra.annualRatePercent)}`,
                                  `${t('expenseApproval.voucher.gstCalcAmount')}: ${formatDecimal2(amount)}`,
                                  extra.amountMode === 'manual'
                                    ? t('expenseApproval.voucher.gstCalcManual')
                                    : t('expenseApproval.voucher.gstCalcAuto'),
                                ]
                              : extra?.kind === 'lateFee'
                                ? [
                                    `${t('expenseApproval.voucher.gstLateFeeFilingDue')}: ${extra.filingDueDate || '—'}`,
                                    `${t('expenseApproval.voucher.gstLateFeeFilingPlanned')}: ${extra.filingPlannedDate || '—'}`,
                                    `${t('expenseApproval.voucher.gstInterestDelayDays')}: ${extra.delayDays ?? '—'}`,
                                    `${t('expenseApproval.voucher.gstLateFeeDaily')}: ${formatDecimal2(extra.dailyFee)}`,
                                    `${t('expenseApproval.voucher.gstLateFeeCap')}: ${formatDecimal2(extra.capAmount)}`,
                                    `${t('expenseApproval.voucher.gstCalcAmount')}: ${formatDecimal2(amount)}`,
                                    extra.amountMode === 'manual'
                                      ? t('expenseApproval.voucher.gstCalcManual')
                                      : t('expenseApproval.voucher.gstCalcAuto'),
                                  ]
                                : [];
                          return (
                            <TableRow key={rowDef.key}>
                              <TableCell sx={{ ...gstEfRowCellSx, width: 40, bgcolor: 'transparent' }}>
                                {GST_MAIN_ROW_DEFS.length + index + 1}
                              </TableCell>
                              <TableCell sx={{ ...gstEfRowCellSx, ...wrapCellSx, bgcolor: 'transparent' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                                  {t(`expenseApproval.voucher.${rowDef.labelKey}`)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                  {detailBits.join(' · ')}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    px: 1.25,
                    py: 1,
                    border: '1px solid #FECACA',
                    borderRadius: '2px',
                    bgcolor: '#FEE2E2',
                  }}
                >
                  <Typography sx={{ color: '#B91C1C', fontWeight: 700, fontSize: '0.8125rem' }}>
                    {t('expenseApproval.voucher.gstPayableLabel')}
                  </Typography>
                  <Typography sx={{ color: '#B91C1C', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {formatDecimal2(detailGstPayable)}
                  </Typography>
                </Box>
                </>
              ) : detailFormType === 'tds' ? (
                <TableContainer sx={{ border: `1px solid ${EXPENSE_LINE}`, borderRadius: '6px', overflowX: 'auto' }}>
                  <Table size="small" sx={{ tableLayout: 'auto', minWidth: 1100 }}>
                    <TableHead
                      sx={{
                        bgcolor: EXPENSE_HEADER_BG,
                        '& .MuiTableCell-head': {
                          bgcolor: EXPENSE_HEADER_BG,
                          color: EXPENSE_HEADER_FG,
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          textTransform: 'none',
                          letterSpacing: '0.02em',
                          borderTop: '2px solid #94A3B8',
                          borderBottom: `1px solid ${EXPENSE_LINE}`,
                          whiteSpace: 'nowrap',
                        },
                      }}
                    >
                      <TableRow>
                        <TableCell sx={{ width: 40 }}>{t('expenseApproval.voucher.tableNo')}</TableCell>
                        <TableCell>{t('expenseApproval.voucher.tdsColDate')}</TableCell>
                        <TableCell>{t('expenseApproval.voucher.tdsColPan')}</TableCell>
                        <TableCell sx={{ minWidth: 220 }}>{t('expenseApproval.voucher.tdsColDeducteeName')}</TableCell>
                        <TableCell align="right">{t('expenseApproval.voucher.tdsColAmount')}</TableCell>
                        <TableCell align="center">{t('expenseApproval.voucher.tdsColRate')}</TableCell>
                        <TableCell sx={{ minWidth: 148, whiteSpace: 'pre-line', lineHeight: 1.25 }}>
                          {t('expenseApproval.voucher.tdsColDeducteeType')}
                        </TableCell>
                        <TableCell>{t('expenseApproval.voucher.tdsColSection')}</TableCell>
                        <TableCell>{t('expenseApproval.voucher.tdsColCode')}</TableCell>
                        <TableCell align="right">{t('expenseApproval.voucher.tdsColTds')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(selectedExpense.items || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} align="center" sx={{ color: 'text.secondary' }}>
                            {t('expenseApproval.voucher.lineItemsEmpty')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        (selectedExpense.items || []).map((item, index) => {
                          const calc = calcTdsLineAmounts(item);
                          return (
                            <TableRow key={item.id || index}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>
                                {formatLocalYmd(item.invoiceDate || item.date) || '-'}
                              </TableCell>
                              <TableCell>{item.pan || '-'}</TableCell>
                              <TableCell sx={wrapCellSx}>
                                <ClampText>{item.description || '-'}</ClampText>
                              </TableCell>
                              <TableCell align="right" sx={expenseAmountCellSx}>
                                {formatSignedAmount(calc.base)}
                              </TableCell>
                              <TableCell align="center">
                                {Number(item.tdsRate || 0).toFixed(2)}%
                              </TableCell>
                              <TableCell>
                                {item.deducteeType === 'company'
                                  ? t('expenseApproval.voucher.tdsDeducteeCompany')
                                  : t('expenseApproval.voucher.tdsDeducteeOther')}
                              </TableCell>
                              <TableCell>{item.tdsSection || '-'}</TableCell>
                              <TableCell>{item.tdsCode || '-'}</TableCell>
                              <TableCell align="right" sx={expenseAmountCellSx}>
                                {formatSignedAmount(effectiveTdsLineAmount(item))}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
              <TableContainer sx={{ border: `1px solid ${EXPENSE_LINE}`, borderRadius: '6px', overflowX: 'hidden', overflowY: 'visible' }}>
                <Table size="small" className="expense-pdf-items" sx={expenseItemsTableSx}>
                  <colgroup>
                    <col style={{ width: 128 }} />
                    <col />
                    <col style={{ width: EXPENSE_TAX_BOX_WIDTH_PX }} />
                  </colgroup>
                  <TableHead
                    sx={{
                      bgcolor: EXPENSE_HEADER_BG,
                      '& .MuiTableCell-head': {
                        bgcolor: EXPENSE_HEADER_BG,
                        color: EXPENSE_HEADER_FG,
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        letterSpacing: '0.02em',
                        borderTop: '2px solid #94A3B8',
                        borderBottom: `1px solid ${EXPENSE_LINE}`,
                      },
                    }}
                  >
                    <TableRow>
                      <TableCell sx={{ width: 128, minWidth: 128, maxWidth: 128 }}>{t('expenseApproval.detail.columns.invoiceDate')}</TableCell>
                      <TableCell>{t('expenseApproval.detail.columns.description')}</TableCell>
                      <TableCell align="right" className="expense-pdf-items-numeric-block" sx={expenseItemsNumericBlockCellSx}>
                        <Box className="expense-pdf-items-numeric-grid" sx={expenseItemsNumericGridSx}>
                          <Box />
                          <Box sx={expenseItemsNumericHeaderCellSx}>{t('expenseApproval.detail.columns.qty')}</Box>
                          <Box sx={expenseItemsNumericHeaderCellSx}>{t('expenseApproval.detail.columns.unitPrice')}</Box>
                          <Box sx={{ ...expenseItemsNumericHeaderCellSx, ...expenseAmountCellSx }}>
                            {t('expenseApproval.detail.columns.amount')}
                          </Box>
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedExpense.items || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary' }}>
                          {t('expenseApproval.voucher.lineItemsEmpty')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedExpense.items.map((item) => (
                      <TableRow key={item.id || item.description}>
                        <TableCell>{item.invoiceDate || '-'}</TableCell>
                          <TableCell sx={{ ...wrapCellSx, whiteSpace: 'pre-line !important' }}>
                            <ClampText
                              title={String(item.description || '')}
                              sx={{ whiteSpace: 'pre-line', WebkitLineClamp: 'unset', maxHeight: 'none' }}
                            >
                              {item.description || '-'}
                            </ClampText>
                            {Boolean(meta.perLineGst ?? meta.per_line_gst) && (() => {
                              const g = calcLineItemGstAmounts(item);
                              const rateLabel =
                                g.igstRate > 0
                                  ? `IGST ${formatGstRateOption(g.igstRate)}%`
                                  : g.cgstRate > 0
                                    ? `CGST/SGST ${formatGstRateOption(g.cgstRate)}%`
                                    : null;
                              const taxAmt = roundDecimal2(g.igstAmount + g.cgstAmount + g.sgstAmount);
                              if (!rateLabel && taxAmt <= 0) return null;
                              return (
                                <Typography sx={{ fontSize: '0.75rem', color: '#64748B', mt: 0.25 }}>
                                  {rateLabel || '-'} · {formatDecimal2(taxAmt)}
                                </Typography>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="expense-pdf-items-numeric-block" sx={expenseItemsNumericBlockCellSx}>
                            <Box className="expense-pdf-items-numeric-grid" sx={expenseItemsNumericGridSx}>
                              <Box />
                              <Box sx={expenseItemsNumericValueCellSx}>
                                {item.qty != null ? formatDecimal2(Number(item.qty)) : '-'}
                              </Box>
                              <Box sx={expenseItemsNumericValueCellSx}>
                                {formatDecimal2(item.unitPrice ?? item.amount ?? 0)}
                              </Box>
                              <Box sx={{ ...expenseItemsNumericValueCellSx, ...expenseAmountCellSx }}>
                                {formatDecimal2(item.total ?? item.amount ?? 0)}
                              </Box>
                            </Box>
                          </TableCell>
                      </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              )}
            </Box>

            <Box
              sx={{
                ...expenseDetailFooterRowSx,
                ...(detailFormType === 'tds' ? { justifyContent: 'flex-end' } : {}),
              }}
            >
            {/* 첨부파일 — 표 왼쪽 하단 (TDS는 영수증 첨부 없음) */}
            {detailFormType !== 'tds' && (
            <Box
              className="expense-pdf-plain expense-pdf-hide"
              sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' } }}
            >
              <Typography variant="subtitle2" sx={sectionTitleSx}>
                {detailFormType === 'gst'
                  ? t('expenseApproval.voucher.sectionCalculationAttachments')
                  : t('expenseApproval.detail.attachments')}
                        </Typography>
              {detailFormType !== 'gst' && expenseIsAwaitingTaxInvoice(selectedExpense) && (
                <Alert severity="warning" sx={{ mb: 1.5, py: 0.5 }}>
                  {t('expenseApproval.detail.awaitingTaxInvoiceHint')}
                </Alert>
              )}
              {detailFormType !== 'gst' &&
                isRequester &&
                isExpenseApproved &&
                expenseHasTaxInvoice(selectedExpense.attachments) &&
                !expenseIsAwaitingTaxInvoice(selectedExpense) && (
                  <Alert severity="info" sx={{ mb: 1.5, py: 0.5 }}>
                    {t('expenseApproval.detail.taxInvoiceAlreadyAttached')}
                  </Alert>
                )}
              {(() => {
                // 송금 탭/송금 담당 화면에서는 인보이스 유형 선택·파일 첨부 UI를 숨김
                // (송금 확인증은 '송금하기' 다이얼로그에서만 첨부)
                const isRemittanceView = listTab === 'transfer';
                const awaitingTax = expenseIsAwaitingTaxInvoice(selectedExpense);
                const attachmentRows = normalizeExpenseAttachments(selectedExpense.attachments);
                const hasProforma = attachmentRows.some((row) => row.invoiceType === 'proforma');
                // 프로포마 승인 후·송금 전/송금 탭: 인보이스 변경 잠금.
                // 다만 전액 송금 후 「택스 인보이스 대기」면 Tax Invoice 업로드는 허용.
                const approvedWithProformaLocked =
                  isExpenseApproved &&
                  hasProforma &&
                  !expenseHasTaxInvoice(selectedExpense.attachments) &&
                  !awaitingTax;
                // 보기 화면에서는 첨부·유형 변경 불가. 「수정하기」(edit)에서만 편집.
                // 예외: 전액 송금 후 「택스 인보이스 대기」면 Tax Invoice 업로드만 보기에서도 허용.
                const showInvoiceUpload =
                  isRequester &&
                  !isRemittanceView &&
                  !approvedWithProformaLocked &&
                  awaitingTax;
                const taxOnlyUpload = awaitingTax;
                const isGstForm = detailFormType === 'gst';

                if (!showInvoiceUpload) {
                  if (isRemittanceView || approvedWithProformaLocked) {
                    return (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {t('expenseApproval.detail.attachmentLockedOnRemittance')}
                      </Typography>
                    );
                  }
                  return null;
                }

                return (
                  <Box sx={{ mb: 1.5 }}>
                    {isGstForm ? (
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75, pl: EXPENSE_TEXT_PAD_LEFT }}>
                        {t('expenseApproval.voucher.gstPaymentCalculationLabel')}
                        </Typography>
                    ) : taxOnlyUpload ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                        {t('expenseApproval.detail.uploadTaxInvoiceOnly')}
                      </Typography>
                    ) : (
                      <RadioGroup
                        row
                        value={receiptInvoiceType}
                        onChange={(e) => {
                          const next = e.target.value as ExpenseInvoiceType;
                          setReceiptInvoiceType(next);
                          setVoucherData((prev) => ({
                            ...prev,
                            invoiceMode: next,
                            noInvoice: next === 'none',
                          }));
                        }}
                        sx={{ mb: 0.75 }}
                      >
                        <FormControlLabel
                          value="tax"
                          control={<Radio size="small" />}
                          label={t('expenseApproval.voucher.invoiceTypeTax')}
                        />
                        <FormControlLabel
                          value="proforma"
                          control={<Radio size="small" />}
                          label={t('expenseApproval.voucher.invoiceTypeProforma')}
                        />
                        <FormControlLabel
                          value="none"
                          control={<Radio size="small" />}
                          label={t('expenseApproval.voucher.invoiceTypeNone')}
                        />
                      </RadioGroup>
                    )}
                    <Button
                      variant="outlined"
                      component="label"
                      disabled={uploadingReceipts}
                      size="small"
                      sx={{ textTransform: 'none', borderRadius: '8px' }}
                      onClick={() => {
                        if (taxOnlyUpload || isGstForm) setReceiptInvoiceType('tax');
                      }}
                    >
                      {uploadingReceipts
                        ? t('expenseApproval.voucher.receiptUploading')
                        : taxOnlyUpload && !isGstForm
                          ? t('expenseApproval.voucher.uploadTaxInvoice')
                          : t('expenseApproval.voucher.receiptUpload')}
                      <input
                        hidden
                        multiple
                        type="file"
                        {...(isGstForm ? {} : { accept: 'image/*,application/pdf' })}
                        onChange={(e) => {
                          if (taxOnlyUpload || isGstForm) setReceiptInvoiceType('tax');
                          void handleUploadReceipts(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </Button>
                      </Box>
                );
              })()}
              {(() => {
                const attachmentRows = normalizeExpenseAttachments(selectedExpense.attachments);
                const proformaRows = attachmentRows.filter((row) => row.invoiceType === 'proforma');
                const otherRows = attachmentRows.filter((row) => row.invoiceType !== 'proforma');
                if (attachmentRows.length === 0) {
                  return (
                      <Typography variant="body2" color="text.secondary">
                      {detailFormType === 'gst'
                        ? t('expenseApproval.voucher.calculationNone')
                        : t('expenseApproval.voucher.receiptNone')}
                      </Typography>
                  );
                }
                const gstTypeLabel =
                  detailFormType === 'gst'
                    ? { typeLabel: t('expenseApproval.voucher.gstPaymentCalculationLabel') }
                    : undefined;
                return (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {proformaRows.length > 0 ? (
                      <Box>
                        <Typography variant="subtitle2" sx={{ ...sectionTitleSx, mt: 0, mb: 0.75 }}>
                          {t('expenseApproval.voucher.invoiceTypeProforma')}
                        </Typography>
                        {renderAttachmentList(proformaRows)}
                      </Box>
                    ) : null}
                    {otherRows.length > 0 ? (
                      <Box>
                        {proformaRows.length > 0 && detailFormType !== 'gst' ? (
                          <Typography variant="subtitle2" sx={{ ...sectionTitleSx, mt: 0, mb: 0.75 }}>
                            {t('expenseApproval.voucher.invoiceTypeTax')}
                        </Typography>
                        ) : null}
                        {renderAttachmentList(otherRows, gstTypeLabel)}
                      </Box>
                    ) : null}
                  </Box>
                );
              })()}
              {(() => {
                const proofPaths = (selectedExpense.bankTransferLogs || [])
                  .map((log) => log.proof || log.payload?.proof)
                  .filter((p): p is string => Boolean(p));
                if (proofPaths.length === 0) return null;
                return (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ ...sectionTitleSx, mt: 0 }}>
                      {t('expenseApproval.detail.remittanceProofs')}
                    </Typography>
                    {renderAttachmentList(proofPaths)}
                  </Box>
                );
              })()}
            </Box>
            )}

            {detailFormType === 'tds' && (
              <Box className="expense-pdf-tax" sx={{ ...expenseTdsTaxBoxSx, flexShrink: 0 }}>
                <Typography variant="subtitle2" sx={sectionTitleSx}>
                  {t('expenseApproval.voucher.sectionTax')}
                </Typography>
                <TableContainer sx={expenseTaxTableContainerSx}>
                  <Table size="small" sx={expenseTdsTaxTableSx}>
                    <TableBody>
                      <TableRow sx={{ bgcolor: EXPENSE_HEADER_BG }}>
                        <TableCell sx={{ color: EXPENSE_HEADER_FG, fontWeight: 600, whiteSpace: 'pre-line' }}>
                          {t('expenseApproval.voucher.tdsSumOtherDeductee')}
                        </TableCell>
                        <TableCell align="right" sx={{ ...expenseAmountCellSx, fontWeight: 600, color: EXPENSE_HEADER_FG }}>
                          {formatSignedAmount(taxSummary.tdsOtherDeducteeSum || 0)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="expense-pdf-grand-row" sx={{ bgcolor: EXPENSE_TOTAL_BG }}>
                        <TableCell
                          className="expense-pdf-grand"
                          sx={{ fontWeight: 700, borderBottom: 'none', color: EXPENSE_TOTAL_FG, whiteSpace: 'pre-line' }}
                        >
                          {t('expenseApproval.voucher.tdsSumCompanyDeductee')}
                        </TableCell>
                        <TableCell
                          className="expense-pdf-grand"
                          align="right"
                          sx={{ ...expenseAmountCellSx, fontWeight: 700, borderBottom: 'none', color: EXPENSE_TOTAL_FG }}
                        >
                          {displayExpenseCurrency(selectedExpense.currency)}{' '}
                          {formatSignedAmount(taxSummary.tdsCompanyDeducteeSum || 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
            </Box>
            )}

            {detailFormType === 'general' && (
            <Box
              className="expense-pdf-tax"
              sx={{ ...expenseTaxBoxWidthSx, flexShrink: 0 }}
            >
              <Typography variant="subtitle2" sx={sectionTitleSx}>{t('expenseApproval.voucher.sectionTax')}</Typography>
              <TableContainer sx={expenseTaxTableContainerSx}>
                <Table size="small" sx={expenseTaxTableSx}>
                  <colgroup>
                    <col />
                    <col style={{ width: EXPENSE_TAX_RATE_COL_WIDTH_PX }} />
                    <col style={{ width: EXPENSE_TAX_AMOUNT_COL_WIDTH_PX }} />
                  </colgroup>
                  <TableBody>
                    <TableRow sx={{ bgcolor: EXPENSE_HEADER_BG }}>
                      <TableCell sx={{ color: EXPENSE_HEADER_FG, fontWeight: 600 }}>
                        {t('expenseApproval.voucher.taxSubtotal')}
                      </TableCell>
                      <TableCell />
                      <TableCell align="right" sx={{ ...expenseAmountCellSx, fontWeight: 600, color: EXPENSE_HEADER_FG }}>
                        {formatDecimal2(taxSummary.subtotal)}
                      </TableCell>
                    </TableRow>
                    {([
                      { label: 'IGST (B)', rate: taxSummary.igstRate, amount: taxSummary.igstAmount },
                      { label: 'CGST (C)', rate: taxSummary.cgstRate, amount: taxSummary.cgstAmount },
                      { label: 'SGST (D)', rate: taxSummary.sgstRate, amount: taxSummary.sgstAmount },
                    ] as const).map((row) => (
                      <TableRow key={row.label}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell align="center" sx={{ color: 'text.secondary' }}>
                          {taxSummary.perLineGst
                            ? t('expenseApproval.voucher.perItemGstRateHint')
                            : `${row.rate}%`}
                        </TableCell>
                        <TableCell align="right" sx={expenseAmountCellSx}>
                          {formatDecimal2(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {taxSummary.tdsEnabled ? (
                      <TableRow>
                        <TableCell>TDS (E)</TableCell>
                        <TableCell align="center" sx={{ color: 'text.secondary' }}>{taxSummary.tdsRate}%</TableCell>
                        <TableCell align="right" sx={expenseAmountCellSx}>
                          −{formatDecimal2(taxSummary.tdsAmount)}
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {Number(taxSummary.discountAmount || 0) > 0 ? (
                      <TableRow>
                        <TableCell>
                          {t('expenseApproval.voucher.autoDiscount')}
                          {!taxSummary.tdsEnabled ? ' (E)' : ''}
                        </TableCell>
                        <TableCell align="center" sx={{ color: 'text.secondary' }}>—</TableCell>
                        <TableCell align="right" sx={expenseAmountCellSx}>
                          −{formatDecimal2(taxSummary.discountAmount)}
                        </TableCell>
                      </TableRow>
                    ) : null}
                    <TableRow className="expense-pdf-grand-row" sx={{ bgcolor: EXPENSE_TOTAL_BG }}>
                      <TableCell className="expense-pdf-grand" sx={{ fontWeight: 700, borderBottom: 'none', color: EXPENSE_TOTAL_FG }}>
                        {t('expenseApproval.voucher.grandTotal')}
                      </TableCell>
                      <TableCell sx={{ borderBottom: 'none' }} />
                      <TableCell
                        className="expense-pdf-grand"
                        align="right"
                        sx={{ ...expenseAmountCellSx, fontWeight: 700, borderBottom: 'none', color: EXPENSE_TOTAL_FG }}
                      >
                        {displayExpenseCurrency(selectedExpense.currency)} {formatDecimal2(taxSummary.grandTotal)}
                      </TableCell>
                    </TableRow>
                    {(Number(selectedExpense.paidAmount || 0) > 0 ||
                      isPaymentApproved ||
                      remittanceEntries.length > 0) && (
                      <>
                        {remittanceEntries.length > 0
                          ? remittanceEntries.map((row, index) => (
                              <TableRow key={`${row.timestamp || 'remit'}-${index}`}>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                  {t('expenseApproval.detail.paidAmount')} {formatRemittanceDateTime(row.timestamp)}
                                </TableCell>
                                <TableCell />
                                <TableCell align="right" sx={expenseAmountCellSx}>
                                  {displayExpenseCurrency(selectedExpense.currency)} {formatAmount(row.amount)}
                                </TableCell>
                              </TableRow>
                            ))
                          : (
                            <TableRow>
                              <TableCell>{t('expenseApproval.detail.paidAmount')}</TableCell>
                              <TableCell />
                              <TableCell align="right" sx={expenseAmountCellSx}>
                                {displayExpenseCurrency(selectedExpense.currency)}{' '}
                                {formatAmount(Number(selectedExpense.paidAmount || 0))}
                              </TableCell>
                            </TableRow>
                          )}
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {t('expenseApproval.detail.remainingAmount')}
                          </TableCell>
                          <TableCell />
                          <TableCell align="right" sx={{ ...expenseAmountCellSx, fontWeight: 700, color: 'warning.main' }}>
                            {displayExpenseCurrency(selectedExpense.currency)}{' '}
                            {formatAmount(getExpenseRemainingAmount(selectedExpense))}
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              </Box>
            )}
            </Box>

            {/* 송금 확인증 — 첨부파일 영역(위)에 표시. TDS 등 첨부 영역이 없을 때만 여기 노출 */}
            {detailFormType === 'tds' &&
              (() => {
                const proofPaths = (selectedExpense.bankTransferLogs || [])
                  .map((log) => log.proof || log.payload?.proof)
                  .filter((p): p is string => Boolean(p));
                if (proofPaths.length === 0) return null;
                return (
                  <Box className="expense-pdf-plain">
                    <Typography variant="subtitle2" sx={sectionTitleSx}>
                      {t('expenseApproval.detail.remittanceProofs')}
                    </Typography>
                    {renderAttachmentList(proofPaths)}
                  </Box>
                );
              })()}

            {/* 메모 */}
            {(selectedExpense.notes || meta.remarks) && (
              <Box className="expense-pdf-plain">
                <Typography variant="subtitle2" sx={sectionTitleSx}>{t('expenseApproval.detail.notes')}</Typography>
                <Box sx={{ p: 1, border: `1px solid ${EXPENSE_LINE}`, borderRadius: '6px', bgcolor: EXPENSE_MUTED_BG }}>
                  <Typography variant="body2">
                    {selectedExpense.notes || meta.remarks}
                  </Typography>
                </Box>
              </Box>
            )}

            {(meta.revisionRejectReason || meta.rejectedReason || meta.rejectedComment) && (
              <Box className="expense-pdf-plain">
                <Typography variant="subtitle2" sx={sectionTitleSx}>
                  {meta.revisionRejected
                    ? t('expenseApproval.detail.revisionRejectComment')
                    : t('expenseApproval.detail.rejectedComment')}
                </Typography>
                <Box sx={{ p: 1, border: `1px solid ${EXPENSE_LINE}`, borderRadius: '6px', bgcolor: EXPENSE_MUTED_BG }}>
                  <Typography variant="body2">
                    {meta.revisionRejectReason || meta.rejectedReason || meta.rejectedComment}
                  </Typography>
                </Box>
              </Box>
            )}

            {(selectedExpense.paymentApprovedReason ||
              selectedExpense.paymentRejectedReason ||
              selectedExpense.paymentApprovedAt ||
              selectedExpense.paymentRejectedAt) && (
              <Box className="expense-pdf-plain">
                <Typography variant="subtitle2" sx={sectionTitleSx}>{t('expenseApproval.detail.paymentProcessing')}</Typography>
                <Box sx={{ p: 1, border: `1px solid ${EXPENSE_LINE}`, borderRadius: '6px', bgcolor: EXPENSE_MUTED_BG }}>
                  {selectedExpense.paymentApprovedAt && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {t('expenseApproval.detail.paymentApprovedLine', {
                        datetime: new Date(selectedExpense.paymentApprovedAt).toLocaleString(dateLocale),
                        user: getUserNameById(selectedExpense.paymentApprovedBy) })}
                    </Typography>
                  )}
                  {selectedExpense.paymentApprovedReason && (
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {t('expenseApproval.detail.paymentApprovedReason', { reason: selectedExpense.paymentApprovedReason })}
                    </Typography>
                  )}
                  {selectedExpense.paymentRejectedAt && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {t('expenseApproval.detail.paymentRejectedLine', {
                        datetime: new Date(selectedExpense.paymentRejectedAt).toLocaleString(dateLocale),
                        user: getUserNameById(selectedExpense.paymentRejectedBy) })}
                    </Typography>
                  )}
                  {selectedExpense.paymentRejectedReason && (
                    <Typography variant="body2">
                      {t('expenseApproval.detail.paymentRejectedReason', { reason: selectedExpense.paymentRejectedReason })}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}

          </CardContent>
        </Card>

            <Box
              className="expense-no-print expense-pdf-hide"
              sx={{ mt: 2, mb: 1, display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}
            >
              {isRequester && isExpenseApproved && !isPaymentRequested && !isPaymentApproved && !isPaymentPaid && (
                <Button
                  variant="outlined"
                  startIcon={<SendIcon />}
                  onClick={() => handleRequestPayment(selectedExpense.id)}
                >
                  {t('expenseApproval.detailActions.requestPayment')}
                </Button>
              )}
              {isFinalApprover && isExpenseApproved && isPaymentRequested && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => openReasonDialog('payment-reject', selectedExpense.id)}
                >
                  {t('expenseApproval.actions.reject')}
                </Button>
              )}
              {isFinalApprover && isExpenseApproved && isPaymentRequested && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => openReasonDialog('payment-approve', selectedExpense.id)}
                >
                  {t('expenseApproval.detailActions.finalApprove')}
                </Button>
              )}
              {isPaymentOfficer &&
                isExpenseApproved &&
                !isPaymentPaid &&
                getExpenseRemainingAmount(selectedExpense) > 0 && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => openPaymentDialog('complete')}
                >
                  {t('expenseApproval.detailActions.executePayment')}
                </Button>
              )}
              {isPaymentOfficer && (selectedExpense.bankTransferStatus || (selectedExpense.bankTransferLogs || []).length > 0) && (
                <Button
                  variant="outlined"
                  color="info"
                  onClick={() => navigate(`/accounting/expense/transfer-log/${selectedExpense.id}`)}
                >
                  {t('expenseApproval.actions.transferLog')}
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrintExpense}
              >
                {t('expenseApproval.detailActions.print')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => void handleDownloadExpensePdf()}
                disabled={pdfDownloading}
              >
                {pdfDownloading
                  ? t('expenseApproval.detailActions.pdfDownloading')
                  : t('expenseApproval.detailActions.pdfDownload')}
              </Button>
              {canApproveThis && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => handleApproveExpense(selectedExpense.id)}
                  >
                  {t('expenseApproval.actions.accept')}
                  </Button>
              )}
              {(canApproveThis || canRevisionRejectThis) && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<EditIcon />}
                  onClick={() => openReasonDialog('expense-revision-reject', selectedExpense.id)}
                >
                  {t('expenseApproval.actions.revisionReject')}
                </Button>
              )}
              {canFinalRejectThis && (
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<CancelIcon />}
                  onClick={() => openReasonDialog('expense-reject', selectedExpense.id)}
                  >
                    {t('expenseApproval.actions.reject')}
                  </Button>
              )}
              {canDeleteThis && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDeleteExpense(selectedExpense.id)}
                  disabled={deleteGuard.disabled}
                >
                  {t('common.delete')}
                </Button>
              )}
              {canEditThis && (
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<EditIcon />}
                  onClick={() => handleEditExpense(selectedExpense)}
                  sx={mvsBodyPrimaryBtnSx}
                >
                  {t('expenseApproval.actions.editDetail')}
                </Button>
              )}
            </Box>

            <Box
              className="expense-no-print expense-pdf-hide"
              sx={{
                mt: 2,
                width: '100%',
                boxSizing: 'border-box',
                border: `1px solid ${EXPENSE_LINE}`,
                bgcolor: EXPENSE_MUTED_BG,
                p: 1.5,
              }}
            >
              <Typography variant="subtitle2" sx={{ ...sectionTitleSx, mb: 1 }}>
                {t('expenseApproval.detail.comments')}
              </Typography>
              {selectedExpense.comments.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 1.5 }}>
                  {selectedExpense.comments.map((comment) => (
                    <Box key={comment.id}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#CBD5E1', color: '#0F172A' }}>
                          {(comment.userName || '?').charAt(0)}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'baseline', mb: 0.25 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {comment.userName}
                            </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatRemittanceDateTime(comment.updatedAt || comment.createdAt)}
                          </Typography>
                        </Box>
                          {renderExpenseCommentBody(comment)}
                          {expenseCommentReplyTo === comment.id && menuFlags.canRead ? (
                            <Box sx={{ mt: 1, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { sm: 'flex-start' } }}>
                              <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                size="small"
                                autoFocus
                                placeholder={t('expenseApproval.detail.replyPlaceholder')}
                                value={expenseCommentReplyDraft}
                                onChange={(e) => setExpenseCommentReplyDraft(e.target.value)}
                                onKeyDown={(e) =>
                                  submitExpenseCommentOnEnter(
                                    e,
                                    () => void handleAddExpenseComment(comment.id),
                                    expenseCommentSubmitting || !expenseCommentReplyDraft.trim()
                                  )
                                }
                                disabled={expenseCommentSubmitting}
                                inputProps={{ 'data-skip-proper-case': '1', 'data-comment-input': '1' }}
                              />
                              <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
                                <Button
                                  variant="contained"
                                  disableElevation
                                  onClick={() => void handleAddExpenseComment(comment.id)}
                                  disabled={expenseCommentSubmitting || !expenseCommentReplyDraft.trim()}
                                  sx={{ ...mvsBodyPrimaryBtnSx, whiteSpace: 'nowrap' }}
                                >
                                  {expenseCommentSubmitting
                                    ? t('expenseApproval.detail.commentSubmitting')
                                    : t('expenseApproval.detail.replySubmit')}
                                </Button>
                                <Button
                                  variant="outlined"
                                  onClick={() => {
                                    setExpenseCommentReplyTo(null);
                                    setExpenseCommentReplyDraft('');
                                  }}
                                  disabled={expenseCommentSubmitting}
                                  sx={mvsBodyOutlinedBtnSx}
                                >
                                  {t('common.cancel')}
                                </Button>
                              </Box>
                            </Box>
                          ) : null}
                        </Box>
                      </Box>
                      {(comment.replies || []).length > 0 ? (
                        <Box
                          sx={{
                            mt: 1,
                            ml: 4.5,
                            pl: 1.5,
                            borderLeft: `2px solid ${EXPENSE_LINE}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                          }}
                        >
                          {(comment.replies || []).map((reply) => (
                            <Box key={reply.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                              <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem', bgcolor: '#E2E8F0', color: '#0F172A' }}>
                                {(reply.userName || '?').charAt(0)}
                              </Avatar>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'baseline', mb: 0.25 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                                    {reply.userName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatRemittanceDateTime(reply.updatedAt || reply.createdAt)}
                                  </Typography>
                                </Box>
                                {renderExpenseCommentBody(reply, { compact: true, allowReply: false })}
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      ) : null}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {t('expenseApproval.detail.commentsEmpty')}
                </Typography>
              )}
              {menuFlags.canRead ? (
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { sm: 'flex-start' } }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                    placeholder={t('expenseApproval.detail.commentPlaceholder')}
                    value={expenseCommentDraft}
                    onChange={(e) => setExpenseCommentDraft(e.target.value)}
                    onKeyDown={(e) =>
                      submitExpenseCommentOnEnter(
                        e,
                        () => void handleAddExpenseComment(),
                        expenseCommentSubmitting || !expenseCommentDraft.trim()
                      )
                    }
                    disabled={expenseCommentSubmitting}
                    inputProps={{ 'data-skip-proper-case': '1', 'data-comment-input': '1' }}
                  />
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={() => void handleAddExpenseComment()}
                    disabled={expenseCommentSubmitting || !expenseCommentDraft.trim()}
                    sx={{ ...mvsBodyPrimaryBtnSx, flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
                  >
                    {expenseCommentSubmitting
                      ? t('expenseApproval.detail.commentSubmitting')
                      : t('expenseApproval.detail.commentSubmit')}
                  </Button>
                </Box>
              ) : null}
            </Box>

            <Dialog open={reasonDialogOpen} onClose={closeReasonDialog} maxWidth="sm" fullWidth>
              <DialogTitle>
                {reasonDialogType === 'payment-approve'
                  ? t('expenseApproval.dialog.finalApproveReasonTitle')
                  : reasonDialogType === 'expense-edit'
                    ? t('expenseApproval.dialog.editReasonTitle')
                    : reasonDialogType === 'expense-revision-reject'
                      ? t('expenseApproval.dialog.revisionRejectReasonTitle')
                      : t('expenseApproval.dialog.rejectReasonTitle')}
              </DialogTitle>
              <DialogContent>
                <TextField
                  autoFocus
                  fullWidth
                  multiline
                  minRows={3}
                  placeholder={
                    reasonDialogType === 'payment-approve'
                      ? t('expenseApproval.dialog.finalApproveReasonPlaceholder')
                      : reasonDialogType === 'expense-edit'
                        ? t('expenseApproval.dialog.editReasonPlaceholder')
                        : reasonDialogType === 'expense-revision-reject'
                          ? t('expenseApproval.dialog.revisionRejectReasonPlaceholder')
                          : t('expenseApproval.dialog.rejectReasonPlaceholder')
                  }
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                />
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" onClick={closeReasonDialog} sx={mvsBodyOutlinedBtnSx}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="contained"
                  disableElevation
                  color={
                    reasonDialogType === 'payment-approve'
                      ? 'success'
                      : reasonDialogType === 'expense-edit'
                        ? 'primary'
                        : reasonDialogType === 'expense-revision-reject'
                          ? 'warning'
                          : 'error'
                  }
                  onClick={() => void handleReasonSubmit()}
                  sx={mvsBodyPrimaryBtnSx}
                >
                  {reasonDialogType === 'payment-approve'
                    ? t('expenseApproval.actions.approve')
                    : reasonDialogType === 'expense-edit'
                      ? t('expenseApproval.voucher.resubmitAfterRevision')
                      : reasonDialogType === 'expense-revision-reject'
                        ? t('expenseApproval.actions.revisionReject')
                        : t('expenseApproval.actions.reject')}
                </Button>
              </DialogActions>
            </Dialog>

            <Dialog
              open={paymentDialogOpen}
              onClose={() => !paymentSubmitting && setPaymentDialogOpen(false)}
              maxWidth="xs"
              fullWidth
            >
              <DialogTitle>
                {t('expenseApproval.dialog.executePaymentTitle')}
              </DialogTitle>
              <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {t('expenseApproval.dialog.paymentAmountHint', {
                    total: formatAmount(Number(selectedExpense.totalAmount || 0)),
                    paid: formatAmount(Number(selectedExpense.paidAmount || 0)),
                    remaining: formatAmount(getExpenseRemainingAmount(selectedExpense)),
                    currency: displayExpenseCurrency(selectedExpense.currency),
                  })}
                </Typography>
                <TextField
                  autoFocus
                  fullWidth
                  type="number"
                  label={t('expenseApproval.dialog.paymentAmount')}
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  inputProps={{ min: 0, step: '0.01' }}
                  disabled={paymentSubmitting}
                />
                <Box
                  tabIndex={0}
                  sx={{
                    mt: 1.5,
                    p: 1.25,
                    border: `1px dashed ${EXPENSE_LINE}`,
                    bgcolor: EXPENSE_MUTED_BG,
                    outline: 'none',
                    '&:focus-within': { borderColor: 'primary.main' },
                  }}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items?.length) return;
                    for (let i = 0; i < items.length; i += 1) {
                      const item = items[i];
                      if (!item.type.startsWith('image/')) continue;
                      const blob = item.getAsFile();
                      if (!blob) continue;
                      e.preventDefault();
                      const ext = (item.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
                      const file = new File([blob], `paste.${ext}`, { type: item.type });
                      setRemittanceProofFile(file);
                      break;
                    }
                  }}
                >
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary' }}>
                    {t('expenseApproval.dialog.remittanceProof')} *
                  </Typography>
                  {!paymentProofFile ? (
                    <Button variant="outlined" component="label" disabled={paymentSubmitting} sx={{ mb: 0.5 }}>
                      {t('expenseApproval.dialog.remittanceProofUpload')}
                      <input
                        hidden
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setRemittanceProofFile(e.target.files?.[0] || null)}
                      />
                    </Button>
                  ) : (
                    <Box sx={{ mb: 0.5 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={proofNameDraft}
                        disabled={paymentSubmitting}
                        onChange={(e) =>
                          setProofNameDraft(
                            stripFileExtensionForDisplay(
                              stripCorporateSuffixFromFilename(e.target.value)
                            )
                          )
                        }
                        onFocus={(e) => e.target.select()}
                        onBlur={() => applyProofFileName(proofNameDraft)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setProofNameDraft(stripFileExtensionForDisplay(paymentProofFile.name));
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        helperText={t('expenseApproval.dialog.remittanceProofRenameTitle', {
                          defaultValue: '클릭하여 파일명 변경',
                        })}
                        FormHelperTextProps={{ sx: { mx: 0 } }}
                        inputProps={{
                          'aria-label': t('expenseApproval.dialog.remittanceProofRenameTitle', {
                            defaultValue: '클릭하여 파일명 변경',
                          }),
                        }}
                        sx={{
                          mb: 0.5,
                          '& .MuiOutlinedInput-root': {
                            bgcolor: '#fff',
                            '& fieldset': { borderColor: EXPENSE_LINE },
                          },
                          '& .MuiOutlinedInput-input': {
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            py: 1,
                          },
                        }}
                      />
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          disabled={paymentSubmitting}
                          onClick={() => setRemittanceProofFile(null)}
                        >
                          {t('common.delete')}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          component="label"
                          disabled={paymentSubmitting}
                        >
                          {t('expenseApproval.dialog.remittanceProofChange', {
                            defaultValue: '파일 변경',
                          })}
                          <input
                            hidden
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setRemittanceProofFile(e.target.files?.[0] || null)}
                          />
                        </Button>
                      </Box>
                    </Box>
                  )}
                  {paymentProofPreviewUrl && (
                    <Box
                      component="img"
                      src={paymentProofPreviewUrl}
                      alt="remittance-proof"
                      sx={{
                        mt: 1,
                        maxWidth: '100%',
                        maxHeight: 160,
                        objectFit: 'contain',
                        border: `1px solid ${EXPENSE_LINE}`,
                        display: 'block',
                      }}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                    {t('expenseApproval.dialog.remittanceProofHint')}
                  </Typography>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button
                  variant="outlined"
                  onClick={() => setPaymentDialogOpen(false)}
                  disabled={paymentSubmitting}
                  sx={mvsBodyOutlinedBtnSx}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => void submitPaymentDialog()}
                  disabled={paymentSubmitting || !paymentProofFile}
                  sx={mvsBodyPrimaryBtnSx}
                >
                  {paymentSubmitting
                    ? t('common.processing')
                    : t('expenseApproval.detailActions.executePayment')}
                </Button>
              </DialogActions>
            </Dialog>
        <style>
          {`
            @page {
              size: A4;
              margin: 10mm 10mm 10mm 20mm;
            }
            @media print {
              html, body, #root {
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
              }
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                background: #fff;
              }
              header, nav, aside,
              .MuiDrawer-root,
              .MuiAppBar-root,
              .MuiToolbar-root,
              .MuiBottomNavigation-root,
              .MuiSnackbar-root,
              .MuiDialog-root,
              .expense-no-print,
              .expense-pdf-hide {
                display: none !important;
              }
              .expense-pdf-root {
                position: static !important;
                inset: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                width: 100% !important;
                max-width: 100% !important;
                background: #fff !important;
                z-index: auto !important;
                overflow: visible !important;
                height: auto !important;
                page-break-inside: auto !important;
                break-inside: auto !important;
              }
              .expense-pdf-root .expense-pdf-items tr,
              .expense-pdf-root .expense-pdf-items .MuiTableRow-root {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              ${EXPENSE_DOCUMENT_EXPORT_CSS}
            }
          `}
        </style>
        {attachmentPreviewDialog}
        {statusSnackbars}
      </Box>
    );
  }

  return (
    <Box sx={{ ...expensePageRootSx }}>
      <MvsPageHeader
        title={t('expenseApproval.title')}
        description={t('expenseApproval.description')}
        mb={2}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {canViewAllCompanies && (
              <Autocomplete
                size="small"
                options={rootCompanyFilterOptions}
                value={
                  selectedRootCompanyOption ?? {
                    id: ROOT_COMPANY_ALL_ID,
                    name: t('expenseApproval.filters.allCompanies'),
                  }
                }
                onChange={(_, option) => handleRootCompanyOptionChange(option)}
                getOptionLabel={(option) => option.name || ''}
                isOptionEqualToValue={(a, b) => Number(a.id) === Number(b.id)}
                disableClearable
                filterOptions={(options, state) => {
                  const q = String(state.inputValue || '')
                    .trim()
                    .toLowerCase();
                  if (!q) return options;
                  return options.filter((opt) => String(opt.name || '').toLowerCase().includes(q));
                }}
                slotProps={rootCompanyAutocompleteSlotProps}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('expenseApproval.filters.company')}
                    placeholder={t('expenseApproval.filters.allCompanies')}
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                sx={rootCompanyAutocompleteSx}
              />
            )}
            <Tooltip title={createGuard.tooltipTitle} disableHoverListener={!createGuard.tooltipTitle}>
              <span style={{ display: 'inline-flex' }}>
        <Button
          variant="contained"
          disableElevation
          startIcon={<AddIcon fontSize="small" />}
          onClick={handleCreateExpense}
                  disabled={createGuard.disabled}
                  sx={mvsBodyPrimaryBtnSx}
        >
          {t('expenseApproval.actions.requestExpense')}
        </Button>
              </span>
            </Tooltip>
      </Box>
        }
      />

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
      <Tabs
        value={listTab}
          onChange={(_, value) => {
            setListTab(value);
            setStatusFilter(defaultStatusFilterForTab(value));
            if (value === 'transfer') {
              setTransferStatusFilters(defaultTransferStatusFiltersForTab());
            }
            setPage(1);
            if (value === 'transfer') {
              setListSortKey('createdAt');
              setListSortDir('desc');
            } else {
              setListSortKey(null);
              setListSortDir('asc');
            }
          }}
          sx={mvsMainTabsSx}
      >
        <Tab label={t('expenseApproval.tabs.received')} value="received" />
        <Tab label={t('expenseApproval.tabs.written')} value="written" />
        {hasTransferAccess && <Tab label={t('expenseApproval.tabs.transfer')} value="transfer" />}
      </Tabs>
      </Card>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1.25,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {t('expenseApproval.summary.monthScopeHint', { period: summaryMonth })}
        </Typography>
        <TextField
          type="month"
          size="small"
          label={t('expenseApproval.summary.monthLabel')}
          value={summaryMonth}
          onChange={(e) => {
            const next = String(e.target.value || '').trim();
            if (/^\d{4}-\d{2}$/.test(next)) setSummaryMonth(next);
          }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ lang: formLangAttr }}
          sx={{
            width: { xs: '100%', sm: 180 },
            ...mvsSearchFieldSx,
            ...mvsFilterFieldHeightSx,
          }}
        />
      </Box>
      <Box sx={mvsKpiGridSx}>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('expenseApproval.summary.totalExpense')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
              {formatAmount(totalExpenseAmount)}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('expenseApproval.summary.approvedAmount')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'success.main' }}>
              {formatAmount(approvedAmount)}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('expenseApproval.summary.pendingAmount')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'warning.main' }}>
              {formatAmount(pendingAmount)}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              {t('expenseApproval.summary.urgentRequests')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'error.main' }}>
              {urgentCount}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box
                sx={{
            ...mvsFilterBarInnerSx,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'minmax(180px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr) auto',
            },
          }}
        >
              <TextField
                fullWidth
                size="small"
              label={t('expenseApproval.placeholders.searchSimple')}
              placeholder={
                canViewAllCompanies
                  ? t('expenseApproval.placeholders.searchWithCompany')
                  : t('expenseApproval.placeholders.search')
              }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={expenseApprovalFilterFieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                ) }}
            />
            <TextField
              fullWidth
              size="small"
              select
              label={t('expenseApproval.filters.status')}
              value={listTab === 'transfer' ? transferStatusFilters : statusFilter}
              onChange={(e) => {
                if (listTab === 'transfer') {
                  const raw = e.target.value;
                  const next = typeof raw === 'string' ? raw.split(',') : (raw as string[]);
                  // 「전체」 선택 시 필터 해제
                  if (next.includes('__all__') || (next.length === 1 && next[0] === '')) {
                    setTransferStatusFilters([]);
                  } else {
                    setTransferStatusFilters(
                      next.filter((v) => v && v !== '__all__' && v !== '')
                    );
                  }
                } else {
                  setStatusFilter(e.target.value as string);
                }
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              SelectProps={{
                multiple: listTab === 'transfer',
                displayEmpty: true,
                MenuProps: {
                  disableScrollLock: true,
                  PaperProps: { sx: { maxHeight: 320 } },
                },
                renderValue: (selected) => {
                  if (listTab === 'transfer') {
                    const keys = Array.isArray(selected)
                      ? selected.map(String)
                      : selected
                        ? [String(selected)]
                        : [];
                    if (!keys.length) return t('expenseApproval.filters.all');
                    const transferLabels: Record<string, string> = {
                      transfer_pending: t('expenseApproval.status.transferPending'),
                      transfer_partial: t('expenseApproval.status.partialTransfer'),
                      awaiting_tax: t('expenseApproval.status.awaitingTaxInvoice'),
                      transfer_completed: t('expenseApproval.status.transferCompleted'),
                      transfer_failed: t('expenseApproval.status.transferFailed'),
                    };
                    return keys.map((k) => transferLabels[k] ?? k).join(', ');
                  }
                  if (selected === '' || selected == null) return t('expenseApproval.filters.all');
                  const statusLabels: Record<string, string> = {
                    [DEFAULT_LIST_STATUS_FILTER]: t('expenseApproval.filters.draftAndSubmitted'),
                    draft: t('expenseApproval.status.draft'),
                    submitted: t('expenseApproval.status.submitted'),
                    in_review: t('expenseApproval.status.inReview'),
                    approved: t('expenseApproval.status.approved'),
                    awaiting_tax: t('expenseApproval.status.awaitingTaxInvoice'),
                    rejected: t('expenseApproval.status.rejected'),
                    paid: t('expenseApproval.status.paid'),
                  };
                  return statusLabels[String(selected)] ?? String(selected);
                } }}
              sx={expenseApprovalFilterFieldSx}
            >
              {listTab === 'transfer'
                ? [
                    <MenuItem key="__all__" value="__all__">
                      <Checkbox size="small" checked={transferStatusFilters.length === 0} sx={{ p: 0.5, mr: 0.5 }} />
                      {t('expenseApproval.filters.all')}
                    </MenuItem>,
                    ...TRANSFER_STATUS_FILTER_OPTIONS.map((key) => {
                      const labels: Record<string, string> = {
                        transfer_pending: t('expenseApproval.status.transferPending'),
                        transfer_partial: t('expenseApproval.status.partialTransfer'),
                        awaiting_tax: t('expenseApproval.status.awaitingTaxInvoice'),
                        transfer_completed: t('expenseApproval.status.transferCompleted'),
                        transfer_failed: t('expenseApproval.status.transferFailed'),
                      };
                      return (
                        <MenuItem key={key} value={key}>
                          <Checkbox
                            size="small"
                            checked={transferStatusFilters.includes(key)}
                            sx={{ p: 0.5, mr: 0.5 }}
                          />
                          {labels[key]}
                        </MenuItem>
                      );
                    }),
                  ]
                : [
                    <MenuItem key="all" value="">
                      {t('expenseApproval.filters.all')}
                    </MenuItem>,
                    <MenuItem key={DEFAULT_LIST_STATUS_FILTER} value={DEFAULT_LIST_STATUS_FILTER}>
                      {t('expenseApproval.filters.draftAndSubmitted')}
                    </MenuItem>,
                    <MenuItem key="draft" value="draft">
                      {t('expenseApproval.status.draft')}
                    </MenuItem>,
                    <MenuItem key="submitted" value="submitted">
                      {t('expenseApproval.status.submitted')}
                    </MenuItem>,
                    <MenuItem key="in_review" value="in_review">
                      {t('expenseApproval.status.inReview')}
                    </MenuItem>,
                    <MenuItem key="approved" value="approved">
                      {t('expenseApproval.status.approved')}
                    </MenuItem>,
                    <MenuItem key="awaiting_tax" value="awaiting_tax">
                      {t('expenseApproval.status.awaitingTaxInvoice')}
                    </MenuItem>,
                    <MenuItem key="rejected" value="rejected">
                      {t('expenseApproval.status.rejected')}
                    </MenuItem>,
                    <MenuItem key="paid" value="paid">
                      {t('expenseApproval.status.paid')}
                    </MenuItem>,
                  ]}
            </TextField>
            <TextField
              fullWidth
              size="small"
              select
              label={t('expenseApproval.filters.priority')}
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{
                displayEmpty: true,
                renderValue: (selected) => {
                  if (selected === '' || selected == null) return t('expenseApproval.filters.all');
                  const priorityLabels: Record<string, string> = {
                    low: t('expenseApproval.priority.low'),
                    medium: t('expenseApproval.priority.medium'),
                    high: t('expenseApproval.priority.high'),
                    urgent: t('expenseApproval.priority.urgent') };
                  return priorityLabels[String(selected)] ?? String(selected);
                } }}
              sx={expenseApprovalFilterFieldSx}
              >
                <MenuItem value="">{t('expenseApproval.filters.all')}</MenuItem>
                <MenuItem value="low">{t('expenseApproval.priority.low')}</MenuItem>
                <MenuItem value="medium">{t('expenseApproval.priority.medium')}</MenuItem>
                <MenuItem value="high">{t('expenseApproval.priority.high')}</MenuItem>
                <MenuItem value="urgent">{t('expenseApproval.priority.urgent')}</MenuItem>
            </TextField>
              <Button
                variant="outlined"
              startIcon={<FilterIcon sx={{ fontSize: 18 }} />}
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter(defaultStatusFilterForTab(listTab));
                  if (listTab === 'transfer') {
                    setTransferStatusFilters(defaultTransferStatusFiltersForTab());
                  }
                  setPriorityFilter('');
                setListSortKey(null);
                setListSortDir('asc');
                setPage(1);
                }}
              sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap' }}
              >
                {t('expenseApproval.actions.reset')}
              </Button>
            </Box>
      </Card>

      {/* 지출결의서 목록 테이블 */}
      <Box sx={mvsBodyListZoneSx}>
        <Box
              sx={{
            mb: 1.25,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 0.75,
          }}
        >
          <Button
            size="small"
            disableElevation
            variant={listViewMode === 'all' ? 'contained' : 'outlined'}
            onClick={() => {
              setListViewMode('all');
              setPage(1);
            }}
            sx={{
              height: 32,
              minWidth: 0,
              px: 1.5,
              textTransform: 'none',
                  fontWeight: 600,
              fontSize: '0.75rem',
              borderRadius: '10px',
              boxShadow: 'none',
              whiteSpace: 'nowrap',
              ...(listViewMode === 'all'
                ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
                : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
            }}
          >
            {t('expenseApproval.listView.viewAll')}
          </Button>
          <Button
            size="small"
            disableElevation
            variant={listViewMode === 'page' ? 'contained' : 'outlined'}
            onClick={() => {
              setListViewMode('page');
              setPage(1);
            }}
            sx={{
              height: 32,
              minWidth: 0,
              px: 1.5,
                  textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.75rem',
              borderRadius: '10px',
              boxShadow: 'none',
              whiteSpace: 'nowrap',
              ...(listViewMode === 'page'
                ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
                : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
            }}
          >
            {t('expenseApproval.listView.viewPages')}
          </Button>
        </Box>
        {visibleExpenses.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <Typography variant="body2" color="text.secondary">
              {listTab === 'transfer'
                ? t('expenseApproval.empty.noTransferItems')
                : t('expenseApproval.empty.noResults')}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={mvsBodyListTableSx}>
            <Table
              size="small"
              sx={{
                borderCollapse: 'collapse',
                bgcolor: 'transparent',
                tableLayout: 'fixed',
                width: '100%',
                minWidth: { xs: 760, md: 0 },
                '& .MuiTableCell-root': {
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderTop: 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  verticalAlign: 'middle',
                  boxSizing: 'border-box',
                },
              }}
            >
              <TableHead sx={mvsTableHeadHighlightSx}>
              <TableRow>
                <TableCell
                  sx={{
                    width: 68,
                    minWidth: 68,
                    maxWidth: 68,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'visible',
                    textOverflow: 'clip',
                    px: 1,
                  }}
                >
                  {t('expenseApproval.columns.no')}
                </TableCell>
                <ExpenseListHeadCell
                  sortKey="createdAt"
                  activeKey={listSortKey}
                  direction={listSortDir}
                  onSort={handleListSort}
                  sx={{
                    width: 140,
                    minWidth: 140,
                    maxWidth: 140,
                    overflow: 'visible',
                    textOverflow: 'clip',
                    px: 1,
                  }}
                >
                  {t('expenseApproval.columns.createdAt')}
                </ExpenseListHeadCell>
                <ExpenseListHeadCell
                  sortKey="title"
                  activeKey={listSortKey}
                  direction={listSortDir}
                  onSort={handleListSort}
                  sx={{ width: '24%', maxWidth: 280 }}
                >
                  {t('expenseApproval.columns.expenseInfo')}
                </ExpenseListHeadCell>
                <ExpenseListHeadCell
                  sortKey="person"
                  activeKey={listSortKey}
                  direction={listSortDir}
                  onSort={handleListSort}
                  sx={{ width: 148, minWidth: 148, maxWidth: 148 }}
                >
                  {listTab === 'written'
                    ? t('expenseApproval.columns.approver')
                    : t('expenseApproval.columns.requester')}
                </ExpenseListHeadCell>
                <ExpenseListHeadCell
                  sortKey="amount"
                  activeKey={listSortKey}
                  direction={listSortDir}
                  onSort={handleListSort}
                  sx={{ width: 136, minWidth: 136, maxWidth: 136 }}
                >
                  {t('expenseApproval.columns.amount')}
                </ExpenseListHeadCell>
                <ExpenseListHeadCell
                  sortKey="status"
                  activeKey={listSortKey}
                  direction={listSortDir}
                  onSort={handleListSort}
                  sx={{ width: 148, minWidth: 148, maxWidth: 148 }}
                >
                  {t('expenseApproval.columns.status')}
                </ExpenseListHeadCell>
                <ExpenseListHeadCell
                  sortKey="priority"
                  activeKey={listSortKey}
                  direction={listSortDir}
                  onSort={handleListSort}
                  sx={{ width: 108, minWidth: 108, maxWidth: 108 }}
                >
                  {t('expenseApproval.columns.priority')}
                </ExpenseListHeadCell>
                <TableCell
                  sx={{
                    width: 176,
                    minWidth: 176,
                    maxWidth: 176,
                    whiteSpace: 'nowrap',
                    pl: 1,
                    pr: 4,
                    textAlign: 'center',
                    overflow: 'visible',
                  }}
                >
                  {t('expenseApproval.columns.actions')}
                </TableCell>
              </TableRow>
            </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {visibleExpenses.map((expense, index) => (
                <TableRow
                  key={expense.id}
                  onClick={() => handleViewExpense(expense)}
                    sx={{ cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }}
                  >
                  <TableCell
                    sx={{
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                      width: 68,
                      minWidth: 68,
                      maxWidth: 68,
                      overflow: 'visible',
                      textOverflow: 'clip',
                      px: 1,
                    }}
                  >
                    {(listViewMode === 'page' ? (page - 1) * itemsPerPage : 0) + index + 1}
                  </TableCell>
                  <TableCell
                    sx={{
                      width: 140,
                      minWidth: 140,
                      maxWidth: 140,
                      overflow: 'visible',
                      textOverflow: 'clip',
                      px: 1,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatLocalYmd(expense.createdAt)
                      ? new Date(`${formatLocalYmd(expense.createdAt)}T00:00:00`).toLocaleDateString(dateLocale)
                      : '-'}
                  </TableCell>
                  <TableCell sx={{ width: '24%', maxWidth: 280, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ minWidth: 0 }}>
                        {expense.title}
                      </Typography>
                      <ExpenseCommentCountBadge expense={expense} />
                    </Box>
                    {canViewAllCompanies && expense.companyName ? (
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        {expense.companyName}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell sx={{ width: 148, minWidth: 148, maxWidth: 148 }}>
                    {listTab === 'written' ? (
                      <Typography variant="body2" fontWeight="bold" noWrap>
                        {getExpenseApproverName(expense)}
                      </Typography>
                    ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      <Avatar sx={{ mr: 1, width: 28, height: 28, flexShrink: 0 }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                      <Typography variant="body2" fontWeight="bold" noWrap>
                          {expense.requesterName}
                        </Typography>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell sx={{ width: 136, minWidth: 136, maxWidth: 136 }}>
                    <Typography variant="body2" fontWeight="bold" noWrap sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {displayExpenseCurrency(expense.currency)} {formatAmount(getExpenseGrandTotal(expense))}
                    </Typography>
                    {listTab === 'transfer' && Number(expense.paidAmount || 0) > 0 && (
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        {t('expenseApproval.list.remainingShort', {
                          amount: formatAmount(getExpenseRemainingAmount(expense)),
                          currency: displayExpenseCurrency(expense.currency),
                        })}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ width: 148, minWidth: 148, maxWidth: 148, whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap', minWidth: 0 }}>
                      {listTab === 'transfer'
                        ? getTransferStatusChip(expense)
                        : getStatusChip(resolveDisplayStatus(expense))}
                      {listTab === 'received' &&
                        user?.id != null &&
                        (expense.ccUserIds || []).includes(Number(user.id)) &&
                        !canUserApproveExpense(expense) &&
                        !isDesignatedApprover(expense) && (
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              flexShrink: 0,
                              height: 22,
                              px: 0.5,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              lineHeight: 1,
                              border: '1px solid #B4B4B4',
                              bgcolor: '#FFFFFF',
                              color: 'text.secondary',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t('expenseApproval.cc.badge')}
                          </Box>
                        )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ width: 108, minWidth: 108, maxWidth: 108 }}>{getPriorityChip(expense.priority)}</TableCell>
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                      width: 176,
                      minWidth: 176,
                      maxWidth: 176,
                      pl: 1,
                      pr: 4,
                      textAlign: 'center',
                      overflow: 'visible',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'inline-flex',
                        gap: 0.25,
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexWrap: 'nowrap',
                        maxWidth: '100%',
                      }}
                    >
                      {listTab === 'transfer' && (
                        <Tooltip title={t('expenseApproval.actions.transferLog')}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/accounting/expense/transfer-log/${expense.id}`);
                            }}
                            sx={{ color: 'text.secondary', borderRadius: '10px', '&:hover': { bgcolor: 'action.hover' } }}
                          >
                            <PendingIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(listTab === 'received' || (isRootUser && (listTab === 'written' || listTab === 'transfer'))) &&
                        canUserApproveExpense(expense) && (
                        <Tooltip title={t('expenseApproval.actions.accept')}>
                            <IconButton
                              size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveExpense(expense.id);
                            }}
                              color="success"
                              sx={{ borderRadius: '10px' }}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                      )}
                      {(listTab === 'received' || (isRootUser && (listTab === 'written' || listTab === 'transfer'))) &&
                        (canUserApproveExpense(expense) || canUserRevisionRejectExpense(expense)) && (
                        <Tooltip title={t('expenseApproval.actions.revisionReject')}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReasonDialog('expense-revision-reject', expense.id);
                            }}
                            color="warning"
                            sx={{ borderRadius: '10px' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(listTab === 'received' || (isRootUser && (listTab === 'written' || listTab === 'transfer'))) &&
                        (canUserApproveExpense(expense) || canUserFinalRejectExpense(expense)) && (
                          <Tooltip title={t('expenseApproval.actions.reject')}>
                            <IconButton
                              size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReasonDialog('expense-reject', expense.id);
                            }}
                              color="error"
                              sx={{ borderRadius: '10px' }}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                      )}
                      {canDeleteExpense(expense) && (
                      <Tooltip title={deleteGuard.tooltipTitle || t('common.delete')}>
                        <span>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteExpense(expense.id);
                          }}
                            disabled={deleteGuard.disabled}
                          sx={{
                            color: 'text.secondary',
                            borderRadius: '10px',
                              '&:hover': { color: 'error.main', bgcolor: (theme) => `${theme.palette.error.main}14` } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        </span>
                      </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        )}

        {listViewMode === 'page' ? (
          <Box sx={mvsBodyPaginationSx}>
          <Pagination
              count={Math.max(1, Math.ceil(displayedExpenses.length / itemsPerPage))}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
        ) : null}
      </Box>

      {/* 스낵바 */}
      {statusSnackbars}
      {attachmentPreviewDialog}

      <Dialog open={deleteTargetId !== null} onClose={() => setDeleteTargetId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('expenseApproval.dialog.deleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('expenseApproval.dialog.deleteMessage')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTargetId(null)} sx={mvsBodyOutlinedBtnSx}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" disableElevation onClick={confirmDeleteExpense} sx={mvsBodyPrimaryBtnSx}>
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExpenseApproval;
