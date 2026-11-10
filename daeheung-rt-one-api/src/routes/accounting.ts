import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { ensureUploadSubdir } from '../utils/uploadPath';
import {
  getInvoices,
  getNextInvoiceNumber,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  updateInvoiceStatus,
  sendInvoiceEmail,
  getAccountingStats,
  getProformaInvoices,
  createProformaInvoice,
  updateProformaInvoiceStatus,
  createEInvoiceFromProforma,
  getEInvoices,
  createEInvoice,
  updateEInvoiceStatus,
  generateEInvoiceIrn,
  createEWayBillFromEInvoice,
  getExpenseReports,
  getExpenseReportById,
  createExpenseReport,
  updateExpenseReport,
  deleteExpenseReport,
  updateExpenseReportStatus,
  changeExpenseApprover,
  uploadExpenseReceiptById,
  deleteExpenseReceipt,
  requestExpensePayment,
  rejectExpensePayment,
  approveExpensePayment,
  completeExpensePayment,
  retryExpenseTransfer,
  getReceiptUploadToken,
  uploadExpenseReceiptByToken,
  addExpenseReportComment,
  updateExpenseReportComment,
  markExpenseReportCommentsRead,
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetDepreciationSchedule,
  approveInvoice,
  rejectInvoice,
} from '../controllers/accountingController';
import {
  approveAutoVoucher,
  getAutoVoucherById,
  getAutoVoucherRules,
  getAutoVouchers,
  postAutoVoucher,
  rejectAutoVoucher,
  updateAutoVoucher,
  uploadAndGenerateAutoVoucher,
  upsertAutoVoucherRule,
} from '../controllers/autoVoucherController';
import {
  brainAsk,
  brainLearn,
  brainListAudits,
  brainRecommend,
  brainRecommendFromExpense,
  brainRecommendFromInvoice,
} from '../controllers/accountingBrainController';
import {
  createGlAccount,
  createGlVoucher,
  deleteGlAccount,
  getAccountLedger,
  getGlAccounts,
  getGlVoucherById,
  getGlVouchers,
  getTrialBalance,
  getProfitAndLoss,
  postGlVoucher,
  bulkPostGlVouchers,
  seedGlAccounts,
  updateGlAccount,
  validateGlVoucherLines,
  getBalanceSheet,
} from '../controllers/glController';
import { previewTallyImport, runTallyImport } from '../controllers/tallyImportController';
import { getTallyImportBatch, getTallyImportReconciliation } from '../controllers/tallyMigrationController';
import {
  createSapImportTemplate,
  inspectSapImportFile,
  listSapImportTemplates,
  previewSapImport,
} from '../controllers/sapImportController';
import {
  approveSapImportMapping,
  createSapImportMapping,
  deactivateSapImportMapping,
  listSapImportMappings,
} from '../controllers/sapImportMappingController';
import {
  seedAccountingMasters,
  getVoucherTypes,
  upsertVoucherType,
  getTransactionItems,
  upsertTransactionItem,
  getGstCodes,
  upsertGstCode,
  getTdsCodes,
  upsertTdsCode,
  getBankAccounts,
  upsertBankAccount,
  getFinancialYears,
  searchParties,
  searchAccounts,
  previewVoucher,
  validateVoucher,
  createEnhancedVoucher,
  submitVoucher,
  approveVoucherEntry,
  rejectVoucherEntry,
  getNextVoucherNumber,
} from '../controllers/voucherEntryController';
import {
  getEWayBills,
  getEWayBill,
  createEWayBill,
  updateEWayBill,
  generateEWayBill,
  cancelEWayBill,
  deleteEWayBill,
} from '../controllers/ewayBillController';
import { authenticateToken, restrictAuditToReadOnly } from '../middleware/auth';
import { requireAdminRootOrMenuPermissionAnyOf } from '../middleware/menuPermission';
import { validateBody } from '../middleware/validate';

const router = Router();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

// 영수증 업로드용 multer (인증 없이 토큰으로만 사용) — destination은 요청 시점에 해석(볼륨 마운트 반영)
const receiptStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadSubdir('expense-receipts'));
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    // 임시 고유명으로 저장 후 controller에서 yyyyMMdd_PV (회사) (세부).ext 로 개명
    const ext = path.extname(file.originalname || '') || '';
    const finalName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, finalName);
  }
});
const receiptUpload = multer({
  storage: receiptStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // GST 계산식 첨부: 엑셀·PDF·이미지 등 모든 형식 허용
    if (file) return cb(null, true);
    cb(new Error('파일이 없습니다.'));
  }
});

const remittanceProofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadSubdir('expense-remittance-proofs'));
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    let original = file.originalname || 'proof';
    try {
      original = Buffer.from(original, 'latin1').toString('utf8');
    } catch {
      // keep original
    }
    const ext = path.extname(original) || '.png';
    const base =
      path
        .basename(original, ext)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100) || 'proof';
    cb(null, `${base}${ext}`);
  }
});
const remittanceProofUpload = multer({
  storage: remittanceProofStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('이미지 또는 PDF만 업로드 가능합니다.'));
  }
});

const autoVoucherStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadSubdir('auto-vouchers'));
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    const safeName = (file.originalname || 'document').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});
const autoVoucherUpload = multer({
  storage: autoVoucherStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'text/csv',
      'text/plain',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('지원하지 않는 파일 형식입니다.'));
  },
});

const tallyImportPath = ensureUploadSubdir('tally-imports');
const tallyImportStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tallyImportPath),
  filename: (_req, file, cb) => {
    const safeName = (file.originalname || 'tally-export').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});
/** Tally Day Book XML can be multi-GB — default 2GB (override with TALLY_IMPORT_MAX_MB) */
const TALLY_IMPORT_MAX_BYTES =
  Math.max(1, Number(process.env.TALLY_IMPORT_MAX_MB) || 2048) * 1024 * 1024;
const tallyImportUpload = multer({
  storage: tallyImportStorage,
  limits: { fileSize: TALLY_IMPORT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const allowedExt =
      name.endsWith('.xml') ||
      name.endsWith('.json') ||
      name.endsWith('.txt') ||
      /\.xml$/i.test(name);
    const mime = String(file.mimetype || '').toLowerCase();
    const allowedMime =
      !mime ||
      mime === 'application/octet-stream' ||
      mime.includes('xml') ||
      mime.includes('json') ||
      mime.includes('text') ||
      mime.includes('csv');
    if (allowedExt || allowedMime) return cb(null, true);
    cb(new Error(`Tally Export는 XML / JSON 파일만 지원합니다. (받은 형식: ${file.mimetype || 'unknown'})`));
  },
});

const sapImportPath = ensureUploadSubdir('sap-imports');
const sapImportStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, sapImportPath),
  filename: (_req, file, cb) => {
    const safeName = (file.originalname || 'sap-import').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});
/** SAP Excel/CSV can be large — default 2GB (override with SAP_IMPORT_MAX_MB) */
const SAP_IMPORT_MAX_BYTES =
  Math.max(1, Number(process.env.SAP_IMPORT_MAX_MB) || 2048) * 1024 * 1024;
const sapImportUpload = multer({
  storage: sapImportStorage,
  limits: { fileSize: SAP_IMPORT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    const allowedExtensions = new Set(['.xlsx', '.xls', '.csv']);
    const allowedMimes = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
      'text/plain',
      'application/octet-stream',
    ]);
    if (allowedExtensions.has(extension) && allowedMimes.has(String(file.mimetype || '').toLowerCase())) {
      return cb(null, true);
    }
    return cb(new Error('SAP Import는 XLSX, XLS 또는 CSV 파일만 지원합니다.'));
  },
});

const SAP_IMPORT_MENU_ROUTE = '/accounting/sap-import';
const REGULAR_INVOICE_MENU_ROUTE = '/accounting/invoice';
const E_INVOICE_MENU_ROUTE = '/accounting/e-invoice';

const sapImportViewPermission = requireAdminRootOrMenuPermissionAnyOf(
  [SAP_IMPORT_MENU_ROUTE],
  ['can_view']
);
const sapImportCreatePermission = requireAdminRootOrMenuPermissionAnyOf(
  [SAP_IMPORT_MENU_ROUTE],
  ['can_create']
);

const regularInvoiceReadPerm = requireAdminRootOrMenuPermissionAnyOf(
  [REGULAR_INVOICE_MENU_ROUTE],
  ['can_view', 'can_create']
);
const regularInvoiceCreatePerm = requireAdminRootOrMenuPermissionAnyOf(
  [REGULAR_INVOICE_MENU_ROUTE],
  ['can_create']
);
const regularInvoiceEditPerm = requireAdminRootOrMenuPermissionAnyOf(
  [REGULAR_INVOICE_MENU_ROUTE],
  ['can_edit']
);
const regularInvoiceDeletePerm = requireAdminRootOrMenuPermissionAnyOf(
  [REGULAR_INVOICE_MENU_ROUTE],
  ['can_delete']
);

const eInvoiceReadPerm = requireAdminRootOrMenuPermissionAnyOf(
  [E_INVOICE_MENU_ROUTE],
  ['can_view', 'can_create']
);
const eInvoiceCreatePerm = requireAdminRootOrMenuPermissionAnyOf(
  [E_INVOICE_MENU_ROUTE],
  ['can_create']
);
const eInvoiceEditPerm = requireAdminRootOrMenuPermissionAnyOf(
  [E_INVOICE_MENU_ROUTE],
  ['can_edit']
);
const eInvoiceDeletePerm = requireAdminRootOrMenuPermissionAnyOf(
  [E_INVOICE_MENU_ROUTE],
  ['can_delete']
);

// 토큰으로 영수증 업로드 (인증 미들웨어 없음 - 휴대폰에서 QR 스캔 후 호출)
router.post('/expenses/upload-receipt', receiptUpload.single('file'), uploadExpenseReceiptByToken);

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// AI 자동 전표
router.get('/auto-vouchers', getAutoVouchers);
router.get('/auto-vouchers/:id', getAutoVoucherById);
router.post('/auto-vouchers/upload', restrictAuditToReadOnly, autoVoucherUpload.single('file'), uploadAndGenerateAutoVoucher);
router.put('/auto-vouchers/:id', restrictAuditToReadOnly, updateAutoVoucher);
router.post('/auto-vouchers/:id/approve', restrictAuditToReadOnly, approveAutoVoucher);
router.post('/auto-vouchers/:id/post', restrictAuditToReadOnly, postAutoVoucher);
router.post('/auto-vouchers/:id/reject', restrictAuditToReadOnly, rejectAutoVoucher);
router.get('/auto-voucher-rules', getAutoVoucherRules);
router.post('/auto-voucher-rules', restrictAuditToReadOnly, upsertAutoVoucherRule);

// Accounting Brain — recommend / Q&A / learning only (NEVER posts)
router.post('/brain/recommend', brainRecommend);
router.post('/brain/ask', brainAsk);
router.post('/brain/learn', restrictAuditToReadOnly, brainLearn);
router.post('/brain/from-invoice/:id', brainRecommendFromInvoice);
router.post('/brain/from-expense/:id', brainRecommendFromExpense);
router.get('/brain/audits', brainListAudits);

// 장부 / 계정과목 / 전표 (Tally형)
router.get('/gl/accounts', getGlAccounts);
router.post('/gl/accounts', restrictAuditToReadOnly, createGlAccount);
router.put('/gl/accounts/:id', restrictAuditToReadOnly, updateGlAccount);
router.delete('/gl/accounts/:id', restrictAuditToReadOnly, deleteGlAccount);
router.post('/gl/accounts/seed-defaults', restrictAuditToReadOnly, seedGlAccounts);
router.get('/gl/vouchers', getGlVouchers);
router.get('/gl/vouchers/:id', getGlVoucherById);
router.post('/gl/vouchers', restrictAuditToReadOnly, createGlVoucher);
router.post('/gl/vouchers/bulk-post', restrictAuditToReadOnly, bulkPostGlVouchers);
router.post('/gl/vouchers/:id/post', restrictAuditToReadOnly, postGlVoucher);
router.post('/gl/vouchers/validate-lines', validateGlVoucherLines);
router.get('/gl/ledger', getAccountLedger);
router.get('/gl/trial-balance', getTrialBalance);
router.get('/gl/profit-and-loss', getProfitAndLoss);
router.get('/gl/balance-sheet', getBalanceSheet);

// Tally Export → MSV Import (XML/JSON, draft vouchers only)
router.post('/tally/preview', restrictAuditToReadOnly, tallyImportUpload.single('file'), previewTallyImport);
router.post('/tally/import', restrictAuditToReadOnly, tallyImportUpload.single('file'), runTallyImport);
router.get('/tally/batches/:id', getTallyImportBatch);
router.get('/tally/batches/:id/reconciliation', getTallyImportReconciliation);

// SAP Excel / CSV → MVS Draft Voucher (Phase 3: Template 및 읽기 전용 미리보기)
router.get('/sap/templates', sapImportViewPermission, listSapImportTemplates);
router.post(
  '/sap/templates',
  restrictAuditToReadOnly,
  sapImportCreatePermission,
  createSapImportTemplate
);
router.post(
  '/sap/inspect',
  restrictAuditToReadOnly,
  sapImportCreatePermission,
  sapImportUpload.single('file'),
  inspectSapImportFile
);
router.post(
  '/sap/preview',
  restrictAuditToReadOnly,
  sapImportCreatePermission,
  sapImportUpload.single('file'),
  previewSapImport
);
router.get('/sap/mappings', sapImportViewPermission, listSapImportMappings);
router.post('/sap/mappings', restrictAuditToReadOnly, sapImportCreatePermission, createSapImportMapping);
router.post('/sap/mappings/:id/approve', restrictAuditToReadOnly, sapImportCreatePermission, approveSapImportMapping);
router.post('/sap/mappings/:id/deactivate', restrictAuditToReadOnly, sapImportCreatePermission, deactivateSapImportMapping);

// 전표 입력 마스터 & 직관적 전표 API
router.post('/masters/seed', restrictAuditToReadOnly, seedAccountingMasters);
router.get('/voucher-types', getVoucherTypes);
router.post('/voucher-types', restrictAuditToReadOnly, upsertVoucherType);
router.get('/transaction-items', getTransactionItems);
router.post('/transaction-items', restrictAuditToReadOnly, upsertTransactionItem);
router.get('/gst-codes', getGstCodes);
router.post('/gst-codes', restrictAuditToReadOnly, upsertGstCode);
router.get('/tds-codes', getTdsCodes);
router.post('/tds-codes', restrictAuditToReadOnly, upsertTdsCode);
router.get('/bank-accounts', getBankAccounts);
router.post('/bank-accounts', restrictAuditToReadOnly, upsertBankAccount);
router.get('/financial-years', getFinancialYears);
router.get('/parties', searchParties);
router.get('/accounts/search', searchAccounts);
router.post('/vouchers/preview', previewVoucher);
router.post('/vouchers/validate', validateVoucher);
router.post('/vouchers/enhanced', restrictAuditToReadOnly, createEnhancedVoucher);
router.get('/vouchers/next-number', getNextVoucherNumber);
router.post('/vouchers/:id/submit', restrictAuditToReadOnly, submitVoucher);
router.post('/vouchers/:id/approve', restrictAuditToReadOnly, approveVoucherEntry);
router.post('/vouchers/:id/reject', restrictAuditToReadOnly, rejectVoucherEntry);

// 인보이스 관련 라우트
router.get('/invoices/next-number', regularInvoiceReadPerm, getNextInvoiceNumber);
router.get('/invoices', regularInvoiceReadPerm, getInvoices);
router.get('/invoices/:id', regularInvoiceReadPerm, getInvoice);
router.post('/invoices/:id/approve', regularInvoiceEditPerm, restrictAuditToReadOnly, approveInvoice);
router.post('/invoices/:id/reject', regularInvoiceEditPerm, restrictAuditToReadOnly, rejectInvoice);
router.post(
  '/invoices',
  regularInvoiceCreatePerm,
  restrictAuditToReadOnly,
  validateBody({
    customer_id: { type: 'number' },
    customer_name: { type: 'string', maxLength: 255 },
    invoice_date: { type: 'string', pattern: datePattern },
    due_date: { type: 'string', pattern: datePattern },
    subtotal: { type: 'number' },
    tax_amount: { type: 'number' },
    total_amount: { type: 'number' },
    status: { type: 'string', maxLength: 20 },
    payment_status: { type: 'string', maxLength: 20 },
    payment_method: { type: 'string', maxLength: 50 },
    payment_date: { type: 'string', pattern: datePattern },
    notes: { type: 'string' },
    approver_user_id: { required: true, type: 'number' }
  }),
  createInvoice
);
router.put(
  '/invoices/:id',
  regularInvoiceEditPerm,
  restrictAuditToReadOnly,
  validateBody({
    customer_id: { type: 'number' },
    customer_name: { type: 'string', maxLength: 255 },
    invoice_date: { type: 'string', pattern: datePattern },
    due_date: { type: 'string', pattern: datePattern },
    subtotal: { type: 'number' },
    tax_amount: { type: 'number' },
    total_amount: { type: 'number' },
    status: { type: 'string', maxLength: 20 },
    payment_status: { type: 'string', maxLength: 20 },
    payment_method: { type: 'string', maxLength: 50 },
    payment_date: { type: 'string', pattern: datePattern },
    notes: { type: 'string' },
    approver_user_id: { type: 'number' }
  }),
  updateInvoice
);
router.put(
  '/invoices/:id/status',
  regularInvoiceEditPerm,
  restrictAuditToReadOnly,
  validateBody({
    status: { type: 'string', maxLength: 20 },
    payment_status: { type: 'string', maxLength: 20 },
    payment_method: { type: 'string', maxLength: 50 },
    payment_date: { type: 'string', pattern: datePattern }
  }),
  updateInvoiceStatus
);
router.delete('/invoices/:id', regularInvoiceDeletePerm, restrictAuditToReadOnly, deleteInvoice);
router.post(
  '/invoices/:id/send-email',
  regularInvoiceEditPerm,
  restrictAuditToReadOnly,
  validateBody({
    to: { required: true, type: 'string', minLength: 3, maxLength: 255 },
    subject: { type: 'string', maxLength: 200 },
    message: { type: 'string' },
    filename: { type: 'string', maxLength: 255 }
  }),
  sendInvoiceEmail
);

// 프로포마 인보이스 관련 라우트
router.get('/proforma-invoices', getProformaInvoices);
router.post(
  '/proforma-invoices',
  restrictAuditToReadOnly,
  validateBody({
    customer_id: { type: 'number' },
    customer_name: { type: 'string', maxLength: 255 },
    invoice_date: { type: 'string', pattern: datePattern },
    due_date: { type: 'string', pattern: datePattern },
    subtotal: { type: 'number' },
    tax_amount: { type: 'number' },
    total_amount: { type: 'number' },
    status: { type: 'string', maxLength: 20 },
    notes: { type: 'string' }
  }),
  createProformaInvoice
);
router.put(
  '/proforma-invoices/:id/status',
  restrictAuditToReadOnly,
  validateBody({
    status: { required: true, type: 'string', maxLength: 20 }
  }),
  updateProformaInvoiceStatus
);
router.post('/proforma-invoices/:id/create-e-invoice', eInvoiceCreatePerm, restrictAuditToReadOnly, createEInvoiceFromProforma);

// E-Invoice 관련 라우트
router.get('/e-invoices', eInvoiceReadPerm, getEInvoices);
router.post(
  '/e-invoices',
  eInvoiceCreatePerm,
  restrictAuditToReadOnly,
  validateBody({
    customer_id: { type: 'number' },
    customer_name: { type: 'string', maxLength: 255 },
    invoice_date: { type: 'string', pattern: datePattern },
    due_date: { type: 'string', pattern: datePattern },
    subtotal: { type: 'number' },
    tax_amount: { type: 'number' },
    total_amount: { type: 'number' },
    status: { type: 'string', maxLength: 20 },
    notes: { type: 'string' },
    approver_user_id: { required: true, type: 'number' }
  }),
  createEInvoice
);
router.put(
  '/e-invoices/:id/status',
  eInvoiceEditPerm,
  restrictAuditToReadOnly,
  validateBody({
    status: { required: true, type: 'string', maxLength: 20 }
  }),
  updateEInvoiceStatus
);
router.post('/e-invoices/:id/generate-irn', eInvoiceEditPerm, restrictAuditToReadOnly, generateEInvoiceIrn);
router.post('/e-invoices/:id/create-eway-bill', eInvoiceCreatePerm, restrictAuditToReadOnly, createEWayBillFromEInvoice);

// E-Way Bill 관련 라우트
router.get('/eway-bills', getEWayBills);
router.get('/eway-bills/:id', getEWayBill);
router.post(
  '/eway-bills',
  restrictAuditToReadOnly,
  validateBody({
    invoice_number: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    invoice_date: { required: true, type: 'string', pattern: datePattern },
    supply_type: { required: true, type: 'string', oneOf: ['outward', 'inward'] },
    document_type: { type: 'string', oneOf: ['invoice', 'credit_note', 'debit_note', 'bill_of_supply'] },
    document_number: { type: 'string', minLength: 1, maxLength: 100 },
    document_date: { type: 'string', pattern: datePattern },
    from_gstin: { required: true, type: 'string', minLength: 1, maxLength: 15 },
    from_name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    from_address: { required: true, type: 'string', minLength: 1 },
    from_pincode: { required: true, type: 'string', minLength: 1, maxLength: 10 },
    from_state: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    from_state_code: { required: true, type: 'number' },
    to_name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    to_address: { required: true, type: 'string', minLength: 1 },
    to_pincode: { required: true, type: 'string', minLength: 1, maxLength: 10 },
    to_state: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    to_state_code: { required: true, type: 'number' },
    transport_mode: { required: true, type: 'string', oneOf: ['road', 'rail', 'air', 'ship'] },
    vehicle_number: { type: 'string', maxLength: 50 },
    vehicle_type: { type: 'string', maxLength: 50 },
    transporter_id: { type: 'string', maxLength: 100 },
    transporter_name: { type: 'string', maxLength: 255 },
    transporter_gstin: { type: 'string', maxLength: 15 },
    transporter_doc_number: { type: 'string', maxLength: 100 },
    transporter_doc_date: { type: 'string', pattern: datePattern },
    distance: { type: 'number' },
    notes: { type: 'string' }
  }),
  createEWayBill
);
router.put(
  '/eway-bills/:id',
  restrictAuditToReadOnly,
  validateBody({
    invoice_number: { type: 'string', minLength: 1, maxLength: 100 },
    invoice_date: { type: 'string', pattern: datePattern },
    supply_type: { type: 'string', oneOf: ['outward', 'inward'] },
    document_type: { type: 'string', oneOf: ['invoice', 'credit_note', 'debit_note', 'bill_of_supply'] },
    document_number: { type: 'string', minLength: 1, maxLength: 100 },
    document_date: { type: 'string', pattern: datePattern },
    from_gstin: { type: 'string', minLength: 1, maxLength: 15 },
    from_name: { type: 'string', minLength: 1, maxLength: 255 },
    from_address: { type: 'string', minLength: 1 },
    from_pincode: { type: 'string', minLength: 1, maxLength: 10 },
    from_state: { type: 'string', minLength: 1, maxLength: 100 },
    from_state_code: { type: 'number' },
    to_name: { type: 'string', minLength: 1, maxLength: 255 },
    to_address: { type: 'string', minLength: 1 },
    to_pincode: { type: 'string', minLength: 1, maxLength: 10 },
    to_state: { type: 'string', minLength: 1, maxLength: 100 },
    to_state_code: { type: 'number' },
    transport_mode: { type: 'string', oneOf: ['road', 'rail', 'air', 'ship'] },
    vehicle_number: { type: 'string', maxLength: 50 },
    vehicle_type: { type: 'string', maxLength: 50 },
    transporter_id: { type: 'string', maxLength: 100 },
    transporter_name: { type: 'string', maxLength: 255 },
    transporter_gstin: { type: 'string', maxLength: 15 },
    transporter_doc_number: { type: 'string', maxLength: 100 },
    transporter_doc_date: { type: 'string', pattern: datePattern },
    distance: { type: 'number' },
    notes: { type: 'string' }
  }),
  updateEWayBill
);
router.post('/eway-bills/:id/generate', restrictAuditToReadOnly, generateEWayBill);
router.post(
  '/eway-bills/:id/cancel',
  restrictAuditToReadOnly,
  validateBody({
    cancellation_reason: { type: 'string' }
  }),
  cancelEWayBill
);
router.delete('/eway-bills/:id', restrictAuditToReadOnly, deleteEWayBill);

// 회계 통계 라우트
router.get('/stats', getAccountingStats);

// 지출결의서 라우트
router.get('/expenses', getExpenseReports);
router.get('/expenses/:id', getExpenseReportById);
router.post(
  '/expenses/:id/comments',
  restrictAuditToReadOnly,
  validateBody({
    comment: { required: true, type: 'string', minLength: 1, maxLength: 2000 },
    parentId: { required: false, type: 'number' },
    parent_id: { required: false, type: 'number' },
  }),
  addExpenseReportComment
);
router.put(
  '/expenses/:id/comments/:commentId',
  restrictAuditToReadOnly,
  validateBody({
    comment: { required: true, type: 'string', minLength: 1, maxLength: 2000 },
  }),
  updateExpenseReportComment
);
router.post(
  '/expenses/:id/comments/read',
  restrictAuditToReadOnly,
  markExpenseReportCommentsRead
);
router.get('/expenses/:id/receipt-upload-token', getReceiptUploadToken);
router.post('/expenses/:id/upload-receipt', restrictAuditToReadOnly, receiptUpload.array('files'), uploadExpenseReceiptById);
router.delete('/expenses/:id/receipt', restrictAuditToReadOnly, deleteExpenseReceipt);
router.post(
  '/expenses',
  restrictAuditToReadOnly,
  validateBody({
    expense_id: { type: 'string', maxLength: 100 },
    title: { type: 'string', maxLength: 255 },
    requester_id: { type: 'number' },
    requester_name: { type: 'string', maxLength: 100 },
    requester_department: { type: 'string', maxLength: 100 },
    requester_position: { type: 'string', maxLength: 100 },
    total_amount: { type: 'number' },
    currency: { type: 'string', maxLength: 10 },
    purpose: { type: 'string' },
    status: { type: 'string', oneOf: ['draft', 'submitted'] },
    priority: { type: 'string', oneOf: ['low', 'medium', 'high', 'urgent'] },
    due_date: { type: 'string', pattern: datePattern },
    notes: { type: 'string' }
  }),
  createExpenseReport
);
router.put(
  '/expenses/:id',
  restrictAuditToReadOnly,
  validateBody({
    expense_id: { type: 'string', minLength: 1, maxLength: 100 },
    title: { type: 'string', minLength: 1, maxLength: 255 },
    requester_id: { type: 'number' },
    requester_name: { type: 'string', minLength: 1, maxLength: 100 },
    requester_department: { type: 'string', maxLength: 100 },
    requester_position: { type: 'string', maxLength: 100 },
    total_amount: { type: 'number' },
    currency: { type: 'string', maxLength: 10 },
    purpose: { type: 'string' },
    status: { type: 'string', oneOf: ['draft', 'submitted'] },
    priority: { type: 'string', oneOf: ['low', 'medium', 'high', 'urgent'] },
    due_date: { type: 'string', pattern: datePattern },
    notes: { type: 'string' }
  }),
  updateExpenseReport
);
router.delete('/expenses/:id', restrictAuditToReadOnly, deleteExpenseReport);
router.put(
  '/expenses/:id/status',
  restrictAuditToReadOnly,
  validateBody({
    status: { required: true, type: 'string', oneOf: ['submitted', 'approved', 'rejected'] }
  }),
  updateExpenseReportStatus
);
router.put(
  '/expenses/:id/approver',
  restrictAuditToReadOnly,
  validateBody({
    approver_id: { required: true, type: 'number' }
  }),
  changeExpenseApprover
);
router.post('/expenses/:id/request-payment', restrictAuditToReadOnly, requestExpensePayment);
router.post(
  '/expenses/:id/reject-payment',
  restrictAuditToReadOnly,
  validateBody({
    reason: { type: 'string', maxLength: 1000 }
  }),
  rejectExpensePayment
);
router.post(
  '/expenses/:id/approve-payment',
  restrictAuditToReadOnly,
  validateBody({
    reason: { type: 'string', maxLength: 1000 }
  }),
  approveExpensePayment
);
router.post(
  '/expenses/:id/complete-payment',
  restrictAuditToReadOnly,
  remittanceProofUpload.single('proof'),
  completeExpensePayment
);
router.post(
  '/expenses/:id/retry-transfer',
  restrictAuditToReadOnly,
  remittanceProofUpload.single('proof'),
  retryExpenseTransfer
);

// 예산 라우트
router.get('/budgets', getBudgets);
router.post(
  '/budgets',
  restrictAuditToReadOnly,
  validateBody({
    budget_id: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    type: { required: true, type: 'string', oneOf: ['annual', 'quarterly', 'monthly', 'project'] },
    period: { required: true, type: 'string', minLength: 1, maxLength: 20 },
    start_date: { required: true, type: 'string', pattern: datePattern },
    end_date: { required: true, type: 'string', pattern: datePattern },
    total_planned: { type: 'number' },
    total_actual: { type: 'number' },
    total_variance: { type: 'number' },
    variance_percentage: { type: 'number' },
    status: { type: 'string', oneOf: ['draft', 'pending', 'approved', 'active', 'completed', 'cancelled'] },
    notes: { type: 'string' }
  }),
  createBudget
);
router.put(
  '/budgets/:id',
  restrictAuditToReadOnly,
  validateBody({
    budget_id: { type: 'string', minLength: 1, maxLength: 100 },
    name: { type: 'string', minLength: 1, maxLength: 255 },
    type: { type: 'string', oneOf: ['annual', 'quarterly', 'monthly', 'project'] },
    period: { type: 'string', minLength: 1, maxLength: 20 },
    start_date: { type: 'string', pattern: datePattern },
    end_date: { type: 'string', pattern: datePattern },
    total_planned: { type: 'number' },
    total_actual: { type: 'number' },
    total_variance: { type: 'number' },
    variance_percentage: { type: 'number' },
    status: { type: 'string', oneOf: ['draft', 'pending', 'approved', 'active', 'completed', 'cancelled'] },
    notes: { type: 'string' }
  }),
  updateBudget
);
router.delete('/budgets/:id', restrictAuditToReadOnly, deleteBudget);

// 자산 라우트
router.get('/assets', getAssets);
router.get('/assets/:id/depreciation-schedule', getAssetDepreciationSchedule);
router.post(
  '/assets',
  restrictAuditToReadOnly,
  validateBody({
    asset_code: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    category: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    subcategory: { type: 'string', maxLength: 100 },
    purchase_date: { type: 'string', pattern: datePattern },
    purchase_price: { type: 'number' },
    salvage_value: { type: 'number' },
    current_value: { type: 'number' },
    depreciation_rate: { type: 'number' },
    accumulated_depreciation: { type: 'number' },
    location: { type: 'string', maxLength: 255 },
    status: { type: 'string', oneOf: ['active', 'maintenance', 'disposed', 'lost', 'transferred'] },
    maintenance_date: { type: 'string', pattern: datePattern },
    next_maintenance: { type: 'string', pattern: datePattern },
    warranty_expiry: { type: 'string', pattern: datePattern },
    description: { type: 'string' },
    vendor: { type: 'string', maxLength: 100 },
    serial_number: { type: 'string', maxLength: 100 },
    assigned_to: { type: 'string', maxLength: 100 },
    department: { type: 'string', maxLength: 100 },
    useful_life: { type: 'number' },
    depreciation_method: { type: 'string', oneOf: ['straight_line', 'declining_balance', 'units_of_production'] }
  }),
  createAsset
);
router.put(
  '/assets/:id',
  restrictAuditToReadOnly,
  validateBody({
    asset_code: { type: 'string', minLength: 1, maxLength: 100 },
    name: { type: 'string', minLength: 1, maxLength: 255 },
    category: { type: 'string', minLength: 1, maxLength: 100 },
    subcategory: { type: 'string', maxLength: 100 },
    purchase_date: { type: 'string', pattern: datePattern },
    purchase_price: { type: 'number' },
    salvage_value: { type: 'number' },
    current_value: { type: 'number' },
    depreciation_rate: { type: 'number' },
    accumulated_depreciation: { type: 'number' },
    location: { type: 'string', maxLength: 255 },
    status: { type: 'string', oneOf: ['active', 'maintenance', 'disposed', 'lost', 'transferred'] },
    maintenance_date: { type: 'string', pattern: datePattern },
    next_maintenance: { type: 'string', pattern: datePattern },
    warranty_expiry: { type: 'string', pattern: datePattern },
    description: { type: 'string' },
    vendor: { type: 'string', maxLength: 100 },
    serial_number: { type: 'string', maxLength: 100 },
    assigned_to: { type: 'string', maxLength: 100 },
    department: { type: 'string', maxLength: 100 },
    useful_life: { type: 'number' },
    depreciation_method: { type: 'string', oneOf: ['straight_line', 'declining_balance', 'units_of_production'] }
  }),
  updateAsset
);
router.delete('/assets/:id', restrictAuditToReadOnly, deleteAsset);

export default router;
