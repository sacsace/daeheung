import { Request, Response } from 'express';
import { RequestWithUser } from '../types';
import { Product, InventoryTransaction, ProductCategory, ProductUnit, InventoryLocation, Partner, User } from '../models';
import { Op, Sequelize } from 'sequelize';
import sequelize from '../config/database';
import * as XLSX from 'xlsx';
import { resolveCompanyId } from '../utils/companyScope';

/** DB 스키마가 초기 마이그레이션만 적용된 경우 company_id / unit_price 등 누락 보정 */
const ensureInventoryTransactionColumns = async () => {
  try {
    await sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD COLUMN IF NOT EXISTS company_id INTEGER;
    `);
    await sequelize.query(`
      UPDATE inventory_transactions it
      SET company_id = p.company_id
      FROM products p
      WHERE it.product_id = p.id AND it.company_id IS NULL;
    `);
    await sequelize.query(`
      UPDATE inventory_transactions it
      SET company_id = (SELECT MIN(c.id) FROM companies c WHERE c.tenant_id = it.tenant_id)
      WHERE it.company_id IS NULL AND it.tenant_id IS NOT NULL;
    `);
    await sequelize.query(`
      UPDATE inventory_transactions
      SET company_id = (SELECT MIN(id) FROM companies)
      WHERE company_id IS NULL;
    `);
    await sequelize
      .query(`
      ALTER TABLE inventory_transactions
      ALTER COLUMN company_id SET NOT NULL;
    `)
      .catch(() => {});

    await sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD COLUMN IF NOT EXISTS unit_price DECIMAL(15,2);
    `);
    await sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15,2);
    `);
    await sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'unit_cost'
        ) THEN
          UPDATE inventory_transactions SET unit_price = COALESCE(unit_cost, 0) WHERE unit_price IS NULL;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'total_cost'
        ) THEN
          UPDATE inventory_transactions SET total_amount = COALESCE(total_cost, 0) WHERE total_amount IS NULL;
        END IF;
      END $$;
    `);
    await sequelize.query(`
      UPDATE inventory_transactions SET unit_price = 0 WHERE unit_price IS NULL;
    `);
    await sequelize.query(`
      UPDATE inventory_transactions SET total_amount = 0 WHERE total_amount IS NULL;
    `);
    await sequelize.query(`
      ALTER TABLE inventory_transactions ALTER COLUMN unit_price SET DEFAULT 0;
    `).catch(() => {});
    await sequelize.query(`
      ALTER TABLE inventory_transactions ALTER COLUMN total_amount SET DEFAULT 0;
    `).catch(() => {});
    await sequelize.query(`
      ALTER TABLE inventory_transactions ALTER COLUMN unit_price SET NOT NULL;
    `).catch(() => {});
    await sequelize.query(`
      ALTER TABLE inventory_transactions ALTER COLUMN total_amount SET NOT NULL;
    `).catch(() => {});

    await sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD COLUMN IF NOT EXISTS created_by INTEGER;
    `);
    await sequelize.query(`
      UPDATE inventory_transactions it
      SET created_by = (
        SELECT u.id FROM users u
        WHERE u.tenant_id = it.tenant_id
        ORDER BY u.id ASC
        LIMIT 1
      )
      WHERE created_by IS NULL;
    `);
    await sequelize.query(`
      UPDATE inventory_transactions
      SET created_by = (SELECT MIN(id) FROM users)
      WHERE created_by IS NULL;
    `);
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transactions_created_by_fkey'
        ) THEN
          ALTER TABLE inventory_transactions
          ADD CONSTRAINT inventory_transactions_created_by_fkey
          FOREIGN KEY (created_by) REFERENCES users(id);
        END IF;
      END $$;
    `).catch(() => {});
    await sequelize.query(`
      ALTER TABLE inventory_transactions ALTER COLUMN created_by SET NOT NULL;
    `).catch(() => {});
  } catch (error) {
    console.warn('[inventory] ensureInventoryTransactionColumns skipped:', error);
  }
};

// 제품 목록 조회
export const getProducts = async (req: RequestWithUser, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    
    if (!tenant_id || !company_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 정보가 올바르지 않습니다.' 
      });
    }

    const { page = 1, limit = 10, search = '', category = '', location = '', lowStock } = req.query;

    const lowStockOnly =
      String(lowStock).toLowerCase() === 'true' || lowStock === true || String(lowStock) === '1';

    const whereClause: any = { tenant_id, company_id };
    
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { product_code: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (category) {
      whereClause.category = category;
    }

    /** 창고(보관 위치)명 — 제품 `location`과 동일한 문자열로 필터 */
    if (location && String(location).trim()) {
      whereClause.location = String(location).trim();
    }

    // Product 모델에는 status 필드가 있음 (기본값: 'active')
    // status가 'active'인 제품만 조회
    whereClause.status = 'active';

    /** 재고 부족만: 최소재고(min_stock_level) > 0 이고 현재고 <= 최소재고 (재고보고서·대시보드와 동일) */
    if (lowStockOnly) {
      whereClause[Op.and] = [
        ...(Array.isArray(whereClause[Op.and]) ? whereClause[Op.and] : []),
        Sequelize.where(Sequelize.col('min_stock_level'), Op.gt, 0),
        Sequelize.where(Sequelize.col('stock_quantity'), Op.lte, Sequelize.col('min_stock_level'))
      ];
    }

    const products = await (Product as any).findAndCountAll({
      where: whereClause,
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
      order: lowStockOnly
        ? [
            [
              Sequelize.literal(
                '(COALESCE(stock_quantity, 0) - COALESCE(min_stock_level, 0))'
              ),
              'ASC'
            ]
          ]
        : [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: products.rows,
      pagination: {
        total: products.count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(products.count / Number(limit))
      }
    });
  } catch (error: any) {
    console.error('제품 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 제품 상세 조회
export const getProduct = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);

    if (!tenant_id || !company_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 정보가 올바르지 않습니다.' 
      });
    }

    const product = await (Product as any).findOne({
      where: { id, tenant_id, company_id, status: 'active' }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
    }

    res.json({ success: true, data: product });
  } catch (error: any) {
    console.error('제품 상세 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 제품 생성
export const createProduct = async (req: RequestWithUser, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    const user_id = req.user?.id;

    if (!tenant_id || !company_id || !user_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 정보가 올바르지 않습니다.' 
      });
    }

    const productData: any = { 
      ...req.body, 
      tenant_id, 
      company_id, 
      created_by: user_id, 
      status: 'active' 
    };

    const partnerId = req.body.partner_id;
    if (partnerId != null && partnerId !== '') {
      const partner = await (Partner as any).findOne({
        where: { id: Number(partnerId), tenant_id, company_id, status: 'active' }
      });
      if (partner) {
        productData.partner_id = partner.id;
        productData.supplier = partner.company_name;
      } else {
        delete productData.partner_id;
      }
    } else {
      delete productData.partner_id;
    }

    const product = await (Product as any).create(productData);

    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    console.error('제품 생성 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 제품 수정
export const updateProduct = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);

    if (!tenant_id || !company_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 정보가 올바르지 않습니다.' 
      });
    }

    const product = await (Product as any).findOne({
      where: { id, tenant_id, company_id, status: 'active' }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
    }

    const patch: any = { ...req.body };
    const partnerId = req.body.partner_id;
    if (partnerId != null && partnerId !== '') {
      const partner = await (Partner as any).findOne({
        where: { id: Number(partnerId), tenant_id, company_id, status: 'active' }
      });
      if (partner) {
        patch.partner_id = partner.id;
        patch.supplier = partner.company_name;
      } else {
        delete patch.partner_id;
      }
    } else if (req.body.partner_id === null || req.body.partner_id === '') {
      patch.partner_id = null;
    }

    await product.update(patch);

    res.json({ success: true, data: product });
  } catch (error: any) {
    console.error('제품 수정 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 제품 삭제
export const deleteProduct = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user.tenant_id;
    const company_id = resolveCompanyId(req);

    if (!tenant_id || !company_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 정보가 올바르지 않습니다.' 
      });
    }

    const product = await (Product as any).findOne({
      where: { id, tenant_id, company_id, status: 'active' }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
    }

    // 소프트 삭제: status를 'inactive'로 설정
    await product.update({ status: 'inactive' });

    res.json({ success: true, message: '제품이 삭제되었습니다.' });
  } catch (error: any) {
    console.error('제품 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 재고 거래 내역 조회
export const getInventoryTransactions = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureInventoryTransactionColumns();
    const tenant_id = req.user.tenant_id;
    const company_id = resolveCompanyId(req);
    const { page = 1, limit = 10, product_id = '', transaction_type = '' } = req.query;

    const whereClause: any = { tenant_id, company_id };
    
    if (product_id) {
      whereClause.product_id = product_id;
    }
    
    if (transaction_type) {
      whereClause.transaction_type = transaction_type;
    }

    const transactions = await (InventoryTransaction as any).findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['name', 'product_code']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email'],
          required: false
        }
      ],
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: transactions.rows,
      pagination: {
        total: transactions.count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(transactions.count / Number(limit))
      }
    });
  } catch (error) {
    console.error('재고 거래 내역 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 재고 입고
export const stockIn = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureInventoryTransactionColumns();
    const tenant_id = req.user.tenant_id;
    const company_id = resolveCompanyId(req);
    const user_id = req.user.id;
    const { product_id, quantity, notes } = req.body;

    const product = await (Product as any).findOne({
      where: { id: product_id, tenant_id, company_id }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
    }

    const qty = Number(quantity);
    const unitVal =
      Number(product.cost_price ?? 0) > 0
        ? Number(product.cost_price)
        : Number(product.unit_price ?? 0) || 0;
    const totalVal = qty * unitVal;

    // 재고 거래 기록 생성
    const transaction = await (InventoryTransaction as any).create({
      tenant_id,
      company_id,
      product_id,
      transaction_type: 'in',
      quantity: qty,
      unit_price: unitVal,
      total_amount: totalVal,
      reference_type: 'manual',
      reference_id: null,
      created_at: new Date(),
      notes,
      created_by: user_id
    });

    // 제품 재고 수량 업데이트
    await product.update({
      stock_quantity: Number(product.stock_quantity) + qty
    });

    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error('재고 입고 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 재고 출고
export const stockOut = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureInventoryTransactionColumns();
    const tenant_id = req.user.tenant_id;
    const company_id = resolveCompanyId(req);
    const user_id = req.user.id;
    const { product_id, quantity, notes } = req.body;

    const product = await (Product as any).findOne({
      where: { id: product_id, tenant_id, company_id }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
    }

    const qty = Number(quantity);
    if (Number(product.stock_quantity) < qty) {
      return res.status(400).json({ success: false, message: '재고가 부족합니다.' });
    }

    const unitVal = Number(product.unit_price ?? 0) || 0;
    const totalVal = qty * unitVal;

    // 재고 거래 기록 생성
    const transaction = await (InventoryTransaction as any).create({
      tenant_id,
      company_id,
      product_id,
      transaction_type: 'out',
      quantity: qty,
      unit_price: unitVal,
      total_amount: totalVal,
      reference_type: 'manual',
      reference_id: null,
      created_at: new Date(),
      notes,
      created_by: user_id
    });

    // 제품 재고 수량 업데이트
    await product.update({
      stock_quantity: Number(product.stock_quantity) - qty
    });

    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error('재고 출고 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 재고 조정
export const adjustStock = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureInventoryTransactionColumns();
    const tenant_id = req.user.tenant_id;
    const company_id = resolveCompanyId(req);
    const user_id = req.user.id;
    const { product_id, new_quantity, notes } = req.body;

    const product = await (Product as any).findOne({
      where: { id: product_id, tenant_id, company_id }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
    }

    const quantity_diff = Number(new_quantity) - Number(product.stock_quantity);
    const absDiff = Math.abs(quantity_diff);
    const unitVal = Number(product.unit_price ?? 0) || 0;

    // 재고 거래 기록 생성
    const transaction = await (InventoryTransaction as any).create({
      tenant_id,
      company_id,
      product_id,
      transaction_type: 'adjustment',
      quantity: absDiff,
      unit_price: unitVal,
      total_amount: absDiff * unitVal,
      reference_type: 'manual',
      reference_id: null,
      created_at: new Date(),
      notes: `${notes || ''} (조정: ${quantity_diff > 0 ? '+' : ''}${quantity_diff})`,
      created_by: user_id
    });

    // 제품 재고 수량 업데이트
    await product.update({
      stock_quantity: new_quantity
    });

    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error('재고 조정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 재고 보고서 통계 조회
export const getInventoryReport = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureInventoryTransactionColumns();
    const tenant_id = req.user.tenant_id;
    const company_id = resolveCompanyId(req);
    
    if (!tenant_id || !company_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 정보가 올바르지 않습니다.' 
      });
    }

    // 전체 제품 조회
    const allProducts = await (Product as any).findAll({
      where: { tenant_id, company_id, status: 'active' }
    });

    // 통계 계산
    const totalProducts = allProducts.length;
    let totalValue = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;
    const categoryStats: { [key: string]: { count: number; value: number } } = {};

    allProducts.forEach((product: any) => {
      const stock = parseFloat(product.stock_quantity || 0);
      const price = parseFloat(product.unit_price || 0);
      const value = stock * price;
      
      totalValue += value;

      // 재고 부족 체크
      const minStock = parseFloat(product.min_stock_level || 0);
      if (stock === 0) {
        outOfStockItems++;
      } else if (minStock > 0 && stock <= minStock) {
        lowStockItems++;
      }

      // 카테고리별 통계
      const category = product.category || '기타';
      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, value: 0 };
      }
      categoryStats[category].count++;
      categoryStats[category].value += value;
    });

    // 카테고리별 분포 데이터
    const categoryDistribution = Object.entries(categoryStats).map(([name, stats]) => ({
      name,
      value: stats.value,
      count: stats.count
    }));

    // 최근 6개월 재고 변동 추이 (거래 내역 기반)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTransactions = await (InventoryTransaction as any).findAll({
      where: {
        tenant_id,
        company_id,
        created_at: {
          [Op.gte]: sixMonthsAgo
        }
      },
      attributes: [
        [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('created_at')), 'month'],
        [Sequelize.fn('SUM', Sequelize.col('quantity')), 'total_quantity'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'transaction_count']
      ],
      group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('created_at'))],
      order: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('created_at')), 'ASC']]
    });

    // 재고 부족 항목 목록
    const lowStockProducts = allProducts
      .filter((product: any) => {
        const stock = parseFloat(product.stock_quantity || 0);
        const minStock = parseFloat(product.min_stock_level || 0);
        return minStock > 0 && stock <= minStock;
      })
      .map((product: any) => ({
        id: product.id,
        name: product.name,
        product_code: product.product_code,
        category: product.category || '기타',
        currentStock: parseFloat(product.stock_quantity || 0),
        minStock: parseFloat(product.min_stock_level || 0),
        unitPrice: parseFloat(product.unit_price || 0),
        totalValue: parseFloat(product.stock_quantity || 0) * parseFloat(product.unit_price || 0)
      }));

    res.json({
      success: true,
      data: {
        stats: {
          totalProducts,
          totalValue,
          lowStockItems,
          outOfStockItems,
          averageTurnover: 0 // 추후 계산 로직 추가 가능
        },
        categoryDistribution,
        monthlyTransactions: monthlyTransactions.map((t: any) => ({
          month: new Date(t.get('month')).toLocaleDateString('ko-KR', { month: 'long' }),
          stock: 0, // 현재 재고는 별도 계산 필요
          movements: parseInt(t.get('transaction_count') || 0)
        })),
        lowStockProducts
      }
    });
  } catch (error: any) {
    console.error('재고 보고서 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

function parseExcelNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).replace(/,/g, '').trim();
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function pickExcelCell(row: Record<string, unknown>, keys: string[]): unknown {
  const map: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    map[String(k).trim()] = row[k];
  }
  for (const key of keys) {
    if (map[key] !== undefined && map[key] !== null && String(map[key]).trim() !== '') {
      return map[key];
    }
  }
  const lowerKeys = keys.map((k) => k.toLowerCase());
  for (const k of Object.keys(map)) {
    const lk = k.toLowerCase();
    if (lowerKeys.some((lk2) => lk === lk2 || k.includes(lk2))) return map[k];
  }
  return undefined;
}

/** 엑셀 일괄 반영: 품목코드 기준으로 기존 행은 수정, 없으면 제품명·카테고리가 있으면 신규 등록 */
export const bulkUpdateProductsFromExcel = async (req: RequestWithUser, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file?.buffer) {
      return res.status(400).json({ success: false, message: 'Excel 파일을 업로드해주세요.' });
    }

    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    const user_id = req.user?.id;

    if (!tenant_id || !company_id || !user_id) {
      return res.status(400).json({ success: false, message: '사용자 정보가 올바르지 않습니다.' });
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    if (!data?.length) {
      return res.status(400).json({ success: false, message: 'Excel 파일에 데이터가 없습니다.' });
    }

    const result = {
      updated: 0,
      created: 0,
      failed: [] as { row: number; error: string }[],
      total: data.length
    };

    const skuKeys = ['품목코드', 'SKU', 'product_code', '제품코드'];
    const nameKeys = ['제품명', 'name', '품명'];
    const catKeys = ['카테고리', 'category'];
    const stockKeys = ['재고수량', '현재재고', 'stock_quantity', '재고'];
    const priceKeys = ['단가', 'unit_price', '판매가'];
    const costKeys = ['원가', 'cost_price'];
    const minKeys = ['최소재고', 'min_stock_level'];
    const maxKeys = ['최대재고', 'max_stock_level'];
    const unitKeys = ['단위', 'unit'];
    const taxKeys = ['세율(%)', '세율', 'tax_rate'];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;
      try {
        const skuRaw = pickExcelCell(row, skuKeys);
        const sku = skuRaw !== undefined && skuRaw !== null ? String(skuRaw).trim() : '';
        if (!sku) {
          result.failed.push({ row: rowNum, error: '품목코드(SKU)가 비어 있습니다.' });
          continue;
        }

        const product = await (Product as any).findOne({
          where: {
            [Op.and]: [
              { tenant_id },
              { company_id },
              { status: 'active' },
              sequelize.where(
                sequelize.fn('LOWER', sequelize.col('product_code')),
                sku.toLowerCase()
              )
            ]
          }
        });

        const nameVal = pickExcelCell(row, nameKeys);
        const catVal = pickExcelCell(row, catKeys);
        const name = nameVal !== undefined && nameVal !== null ? String(nameVal).trim() : '';
        const category = catVal !== undefined && catVal !== null ? String(catVal).trim() : '';

        const patch: Record<string, unknown> = {};
        const pq = parseExcelNumber(pickExcelCell(row, stockKeys));
        const pu = parseExcelNumber(pickExcelCell(row, priceKeys));
        const pc = parseExcelNumber(pickExcelCell(row, costKeys));
        const pmin = parseExcelNumber(pickExcelCell(row, minKeys));
        const pmax = parseExcelNumber(pickExcelCell(row, maxKeys));
        const ptax = parseExcelNumber(pickExcelCell(row, taxKeys));
        const unitRaw = pickExcelCell(row, unitKeys);
        const unit = unitRaw !== undefined && unitRaw !== null ? String(unitRaw).trim() : '';

        if (pq !== undefined) patch.stock_quantity = pq;
        if (pu !== undefined) patch.unit_price = pu;
        if (pc !== undefined) patch.cost_price = pc;
        if (pmin !== undefined) patch.min_stock_level = pmin;
        if (pmax !== undefined) patch.max_stock_level = pmax;
        if (ptax !== undefined) patch.tax_rate = ptax;
        if (unit) patch.unit = unit;
        if (name) patch.name = name;
        if (category) patch.category = category;

        if (product) {
          if (Object.keys(patch).length === 0) {
            result.failed.push({ row: rowNum, error: '변경할 값이 없습니다.' });
            continue;
          }
          await product.update(patch);
          result.updated++;
        } else {
          if (!name || !category) {
            result.failed.push({
              row: rowNum,
              error: '미등록 품목은 제품명·카테고리를 함께 입력해야 등록됩니다.'
            });
            continue;
          }
          await (Product as any).create({
            tenant_id,
            company_id,
            product_code: sku,
            name,
            category,
            description: null,
            stock_quantity: pq ?? 0,
            unit_price: pu ?? 0,
            cost_price: pc ?? 0,
            min_stock_level: pmin ?? 0,
            max_stock_level: pmax ?? 1000,
            unit: unit || '개',
            tax_rate: ptax ?? 0,
            status: 'active',
            created_by: user_id
          });
          result.created++;
        }
      } catch (e: any) {
        const msg =
          e?.name === 'SequelizeUniqueConstraintError'
            ? '이미 사용 중인 품목코드입니다.'
            : e?.message || '처리 실패';
        result.failed.push({ row: rowNum, error: msg });
      }
    }

    const msg = `처리 완료: 수정 ${result.updated}건, 신규 ${result.created}건, 실패 ${result.failed.length}건`;
    res.json({
      success: true,
      message: msg,
      data: result
    });
  } catch (error: any) {
    console.error('재고 Excel 일괄 반영 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Excel 처리 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/** 재고 일괄 반영용 엑셀 양식(첫 시트 헤더 고정) */
export const getProductExcelSample = async (_req: RequestWithUser, res: Response) => {
  try {
    const headers = [
      '품목코드',
      '제품명',
      '카테고리',
      '재고수량',
      '단가',
      '원가',
      '최소재고',
      '최대재고',
      '단위',
      '세율(%)'
    ];
    const example = [
      'SKU-001',
      '샘플 제품',
      '일반',
      10,
      1000,
      800,
      1,
      100,
      '개',
      0
    ];
    const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, '재고');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `재고_일괄반영_양식_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.send(Buffer.from(buf));
  } catch (error: any) {
    console.error('재고 Excel 샘플 오류:', error);
    res.status(500).json({ success: false, message: '샘플 파일 생성에 실패했습니다.' });
  }
};

export const getProductCategories = async (req: RequestWithUser, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    if (!tenant_id || !company_id) {
      return res.status(400).json({ success: false, message: '사용자 정보가 올바르지 않습니다.' });
    }
    const rows = await (ProductCategory as any).findAll({
      where: { tenant_id, company_id },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('제품 카테고리 목록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const createProductCategory = async (req: RequestWithUser, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    const name = String(req.body?.name || '').trim();
    if (!tenant_id || !company_id || !name) {
      return res.status(400).json({ success: false, message: '카테고리명을 입력하세요.' });
    }
    const row = await (ProductCategory as any).create({ tenant_id, company_id, name });
    res.status(201).json({ success: true, data: row });
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: '이미 존재하는 카테고리입니다.' });
    }
    console.error('제품 카테고리 등록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const updateProductCategory = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    const name = String(req.body?.name || '').trim();
    if (!tenant_id || !company_id || !name) {
      return res.status(400).json({ success: false, message: '카테고리명을 입력하세요.' });
    }
    const row = await (ProductCategory as any).findOne({ where: { id, tenant_id, company_id } });
    if (!row) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
    await row.update({ name });
    res.json({ success: true, data: row });
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: '이미 존재하는 카테고리입니다.' });
    }
    console.error('제품 카테고리 수정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const deleteProductCategory = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    if (!tenant_id || !company_id) {
      return res.status(400).json({ success: false, message: '사용자 정보가 올바르지 않습니다.' });
    }
    const row = await (ProductCategory as any).findOne({ where: { id, tenant_id, company_id } });
    if (!row) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
    await row.destroy();
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (error: any) {
    console.error('제품 카테고리 삭제 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const getInventoryLocations = async (req: RequestWithUser, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    if (!tenant_id || !company_id) {
      return res.status(400).json({ success: false, message: '사용자 정보가 올바르지 않습니다.' });
    }
    const rows = await (InventoryLocation as any).findAll({
      where: { tenant_id, company_id },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('보관 위치 목록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const createInventoryLocation = async (req: RequestWithUser, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    const name = String(req.body?.name || '').trim();
    if (!tenant_id || !company_id || !name) {
      return res.status(400).json({ success: false, message: '위치명을 입력하세요.' });
    }
    const row = await (InventoryLocation as any).create({ tenant_id, company_id, name });
    res.status(201).json({ success: true, data: row });
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: '이미 존재하는 위치입니다.' });
    }
    console.error('보관 위치 등록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const updateInventoryLocation = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    const name = String(req.body?.name || '').trim();
    if (!tenant_id || !company_id || !name) {
      return res.status(400).json({ success: false, message: '위치명을 입력하세요.' });
    }
    const row = await (InventoryLocation as any).findOne({ where: { id, tenant_id, company_id } });
    if (!row) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
    await row.update({ name });
    res.json({ success: true, data: row });
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: '이미 존재하는 위치입니다.' });
    }
    console.error('보관 위치 수정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const deleteInventoryLocation = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    if (!tenant_id || !company_id) {
      return res.status(400).json({ success: false, message: '사용자 정보가 올바르지 않습니다.' });
    }
    const row = await (InventoryLocation as any).findOne({ where: { id, tenant_id, company_id } });
    if (!row) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
    await row.destroy();
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (error: any) {
    console.error('보관 위치 삭제 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const getProductUnits = async (req: RequestWithUser, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    if (!tenant_id || !company_id) {
      return res.status(400).json({ success: false, message: '사용자 정보가 올바르지 않습니다.' });
    }
    const rows = await (ProductUnit as any).findAll({
      where: { tenant_id, company_id },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('제품 단위 목록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const createProductUnit = async (req: RequestWithUser, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    const name = String(req.body?.name || '').trim();
    if (!tenant_id || !company_id || !name) {
      return res.status(400).json({ success: false, message: '단위명을 입력하세요.' });
    }
    const row = await (ProductUnit as any).create({ tenant_id, company_id, name });
    res.status(201).json({ success: true, data: row });
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: '이미 존재하는 단위입니다.' });
    }
    console.error('제품 단위 등록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const updateProductUnit = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    const name = String(req.body?.name || '').trim();
    if (!tenant_id || !company_id || !name) {
      return res.status(400).json({ success: false, message: '단위명을 입력하세요.' });
    }
    const row = await (ProductUnit as any).findOne({ where: { id, tenant_id, company_id } });
    if (!row) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
    await row.update({ name });
    res.json({ success: true, data: row });
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: '이미 존재하는 단위입니다.' });
    }
    console.error('제품 단위 수정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const deleteProductUnit = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user?.tenant_id;
    const company_id = resolveCompanyId(req);
    if (!tenant_id || !company_id) {
      return res.status(400).json({ success: false, message: '사용자 정보가 올바르지 않습니다.' });
    }
    const row = await (ProductUnit as any).findOne({ where: { id, tenant_id, company_id } });
    if (!row) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
    await row.destroy();
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (error: any) {
    console.error('제품 단위 삭제 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/** 제품 이미지 업로드 (정적 경로 /uploads/product-images/...) */
export const uploadProductImage = async (req: RequestWithUser, res: Response) => {
  try {
    const file = (req as any).file as { filename: string } | undefined;
    if (!file) {
      return res.status(400).json({ success: false, message: '이미지 파일이 필요합니다.' });
    }
    const url = `/uploads/product-images/${file.filename}`;
    res.json({ success: true, data: { url } });
  } catch (error: any) {
    console.error('제품 이미지 업로드 오류:', error);
    res.status(500).json({ success: false, message: '이미지 업로드에 실패했습니다.' });
  }
};
