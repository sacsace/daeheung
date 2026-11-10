import { randomBytes } from 'crypto';
import { Router } from 'express';
import path from 'path';
import multer from 'multer';
import { ensureUploadSubdir } from '../utils/uploadPath';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getInventoryTransactions,
  stockIn,
  stockOut,
  adjustStock,
  getInventoryReport,
  bulkUpdateProductsFromExcel,
  getProductExcelSample,
  uploadProductImage,
  getProductCategories,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
  getInventoryLocations,
  createInventoryLocation,
  updateInventoryLocation,
  deleteInventoryLocation,
  getProductUnits,
  createProductUnit,
  updateProductUnit,
  deleteProductUnit,
} from '../controllers/inventoryController';
import { authenticateToken, restrictAuditToReadOnly } from '../middleware/auth';
import { requireAdminRootOrMenuPermissionAnyOf } from '../middleware/menuPermission';
import { validateBody } from '../middleware/validate';

const router = Router();

/** DB `menus.route` — 기본재고 등록·마스터(카테고리·창고·단위·엑셀·이미지) */
const INVENTORY_BASIC = ['/inventory/basic', '/inventory'];
/** 제품 목록/단건 조회 — 입출고·현황·보고서 화면에서 공용 */
const INVENTORY_PRODUCT_READ = [
  '/inventory/basic',
  '/inventory/status',
  '/inventory/report',
  '/inventory/stock-in',
  '/inventory/stock-out',
  '/inventory',
];
/** 재고 보고서 API */
const INVENTORY_REPORT_READ = ['/inventory/report', '/inventory/status', '/inventory/basic', '/inventory'];
/** 거래 내역 조회 */
const INVENTORY_TRANSACTIONS_READ = [
  '/inventory/status',
  '/inventory/report',
  '/inventory/basic',
  '/inventory/stock-in',
  '/inventory/stock-out',
  '/inventory',
];

const VIEW_OR_CREATE: ('can_view' | 'can_create')[] = ['can_view', 'can_create'];
const CREATE_OR_EDIT: ('can_create' | 'can_edit')[] = ['can_create', 'can_edit'];

const permBasicRead = requireAdminRootOrMenuPermissionAnyOf(INVENTORY_BASIC, VIEW_OR_CREATE);
const permBasicCreate = requireAdminRootOrMenuPermissionAnyOf(INVENTORY_BASIC, ['can_create']);
const permBasicEdit = requireAdminRootOrMenuPermissionAnyOf(INVENTORY_BASIC, ['can_edit']);
const permBasicDelete = requireAdminRootOrMenuPermissionAnyOf(INVENTORY_BASIC, ['can_delete']);
const permBasicMutate = requireAdminRootOrMenuPermissionAnyOf(INVENTORY_BASIC, CREATE_OR_EDIT);

const permProductRead = requireAdminRootOrMenuPermissionAnyOf(INVENTORY_PRODUCT_READ, VIEW_OR_CREATE);
const permReportRead = requireAdminRootOrMenuPermissionAnyOf(INVENTORY_REPORT_READ, VIEW_OR_CREATE);
const permTransactionsRead = requireAdminRootOrMenuPermissionAnyOf(INVENTORY_TRANSACTIONS_READ, VIEW_OR_CREATE);

const permStockIn = requireAdminRootOrMenuPermissionAnyOf(['/inventory/stock-in', '/inventory'], CREATE_OR_EDIT);
const permStockOut = requireAdminRootOrMenuPermissionAnyOf(['/inventory/stock-out', '/inventory'], CREATE_OR_EDIT);

const productImageDir = ensureUploadSubdir('product-images');

const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, productImageDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
      cb(null, `product_${Date.now()}_${randomBytes(6).toString('hex')}${safeExt}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
    }
  }
});

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(new Error('Excel 파일(.xlsx, .xls) 또는 CSV만 업로드 가능합니다.'));
    }
  },
});

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

router.get('/product-categories', permBasicRead, getProductCategories);
router.post(
  '/product-categories',
  permBasicMutate,
  restrictAuditToReadOnly,
  validateBody({ name: { required: true, type: 'string', minLength: 1, maxLength: 100 } }),
  createProductCategory
);
router.put(
  '/product-categories/:id',
  permBasicEdit,
  restrictAuditToReadOnly,
  validateBody({ name: { required: true, type: 'string', minLength: 1, maxLength: 100 } }),
  updateProductCategory
);
router.delete('/product-categories/:id', permBasicDelete, restrictAuditToReadOnly, deleteProductCategory);

router.get('/inventory-locations', permBasicRead, getInventoryLocations);
router.post(
  '/inventory-locations',
  permBasicMutate,
  restrictAuditToReadOnly,
  validateBody({ name: { required: true, type: 'string', minLength: 1, maxLength: 100 } }),
  createInventoryLocation
);
router.put(
  '/inventory-locations/:id',
  permBasicEdit,
  restrictAuditToReadOnly,
  validateBody({ name: { required: true, type: 'string', minLength: 1, maxLength: 100 } }),
  updateInventoryLocation
);
router.delete('/inventory-locations/:id', permBasicDelete, restrictAuditToReadOnly, deleteInventoryLocation);

router.get('/product-units', permBasicRead, getProductUnits);
router.post(
  '/product-units',
  permBasicMutate,
  restrictAuditToReadOnly,
  validateBody({ name: { required: true, type: 'string', minLength: 1, maxLength: 50 } }),
  createProductUnit
);
router.put(
  '/product-units/:id',
  permBasicEdit,
  restrictAuditToReadOnly,
  validateBody({ name: { required: true, type: 'string', minLength: 1, maxLength: 50 } }),
  updateProductUnit
);
router.delete('/product-units/:id', permBasicDelete, restrictAuditToReadOnly, deleteProductUnit);

// 제품 관련 라우트 (구체 경로를 :id 보다 먼저 등록)
router.get('/products', permProductRead, getProducts);
router.get('/products/excel/sample', permBasicRead, getProductExcelSample);
router.get('/products/:id', permProductRead, getProduct);
router.post(
  '/products/upload-image',
  permBasicMutate,
  restrictAuditToReadOnly,
  productImageUpload.single('file'),
  uploadProductImage
);
router.post(
  '/products',
  permBasicCreate,
  restrictAuditToReadOnly,
  validateBody({
    product_code: { required: true, type: 'string', minLength: 1, maxLength: 50 },
    name: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    category: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string' },
    image_url: { type: 'string', maxLength: 500 },
    supplier: { type: 'string', maxLength: 200 },
    partner_id: { type: 'number' },
    location: { type: 'string', maxLength: 200 },
    unit_price: { type: 'number' },
    cost_price: { type: 'number' },
    stock_quantity: { type: 'number' },
    min_stock_level: { type: 'number' },
    max_stock_level: { type: 'number' },
    unit: { type: 'string', maxLength: 20 },
    tax_rate: { type: 'number' },
    status: { type: 'string', maxLength: 20 }
  }),
  createProduct
);
router.put(
  '/products/:id',
  permBasicEdit,
  restrictAuditToReadOnly,
  validateBody({
    product_code: { type: 'string', minLength: 1, maxLength: 50 },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    category: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string' },
    image_url: { type: 'string', maxLength: 500 },
    supplier: { type: 'string', maxLength: 200 },
    partner_id: { type: 'number' },
    location: { type: 'string', maxLength: 200 },
    unit_price: { type: 'number' },
    cost_price: { type: 'number' },
    stock_quantity: { type: 'number' },
    min_stock_level: { type: 'number' },
    max_stock_level: { type: 'number' },
    unit: { type: 'string', maxLength: 20 },
    tax_rate: { type: 'number' },
    status: { type: 'string', maxLength: 20 }
  }),
  updateProduct
);
router.delete('/products/:id', permBasicDelete, restrictAuditToReadOnly, deleteProduct);
router.post(
  '/products/excel/bulk-update',
  permBasicMutate,
  restrictAuditToReadOnly,
  excelUpload.single('file'),
  bulkUpdateProductsFromExcel
);

// 재고 거래 관련 라우트
router.get('/transactions', permTransactionsRead, getInventoryTransactions);
router.post(
  '/stock-in',
  permStockIn,
  restrictAuditToReadOnly,
  validateBody({
    product_id: { required: true, type: 'number' },
    quantity: { required: true, type: 'number' },
    notes: { type: 'string' }
  }),
  stockIn
);
router.post(
  '/stock-out',
  permStockOut,
  restrictAuditToReadOnly,
  validateBody({
    product_id: { required: true, type: 'number' },
    quantity: { required: true, type: 'number' },
    notes: { type: 'string' }
  }),
  stockOut
);
router.post(
  '/adjust-stock',
  permBasicEdit,
  restrictAuditToReadOnly,
  validateBody({
    product_id: { required: true, type: 'number' },
    new_quantity: { required: true, type: 'number' },
    notes: { type: 'string' }
  }),
  adjustStock
);

// 재고 보고서
router.get('/report', permReportRead, getInventoryReport);

export default router;
