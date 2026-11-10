import express from 'express';
import { Op, fn, col } from 'sequelize';
import {
  Invoice,
  Customer,
  Product,
  RoomBooking,
  WorkBoard,
  WorkBoardList,
  WorkBoardCard,
  WorkBoardMember,
  User,
} from '../models';
import { AuthRequest } from '../types';
import {
  buildReferenceCacheKey,
  referenceCacheGet,
  referenceCacheSet,
} from '../utils/redisCache';

const router = express.Router();
const DASHBOARD_CACHE_TTL_SEC = Number(process.env.DASHBOARD_CACHE_TTL_SEC || 30);
const DASHBOARD_TASK_CACHE_TTL_SEC = Number(process.env.DASHBOARD_TASK_CACHE_TTL_SEC || 15);
const useDashboardCache = process.env.DISABLE_DASHBOARD_CACHE !== '1';

async function getCachedJson<T>(key: string): Promise<T | null> {
  if (!useDashboardCache) return null;
  try {
    const raw = await referenceCacheGet(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setCachedJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  if (!useDashboardCache) return;
  try {
    await referenceCacheSet(key, JSON.stringify(value), ttlSec);
  } catch {
    // ignore cache write failures
  }
}

const resolveTenantId = (req: AuthRequest): number => {
  const user = req.user;
  if (!user) return parseInt(String(process.env.DEFAULT_TENANT_ID || 1), 10);
  if (user.role === 'root' || user.role === 'audit') {
    const q = parseInt(String(req.query.tenantId || ''), 10);
    return Number.isFinite(q) && q > 0 ? q : user.tenant_id;
  }
  return user.tenant_id;
};

const queryTenantValue = (req: AuthRequest): string => (
  typeof req.query.tenantId === 'string' ? req.query.tenantId : ''
);

router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const user = req.user;
    const cacheKey = buildReferenceCacheKey([
      'dashboard',
      'stats',
      tenantId,
      user?.company_id || 'all',
      queryTenantValue(req),
    ]);
    const cached = await getCachedJson<{ success: true; data: any }>(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const invoiceBaseWhere: any = {
      tenant_id: tenantId,
      is_active: true,
      [Op.or]: [
        { invoice_category: 'regular' },
        { invoice_category: 'e_invoice' },
        { invoice_category: null }
      ]
    };

    const safeSum = async (runner: () => Promise<number | null>) => {
      try {
        return (await runner()) || 0;
      } catch (err: any) {
        if (err.name === 'SequelizeDatabaseError' &&
            (err.message?.includes('릴레이션') || err.message?.includes('relation'))) {
          return 0;
        }
        throw err;
      }
    };

    const safeCount = async (runner: () => Promise<number>) => {
      try {
        return await runner();
      } catch (err: any) {
        if (err.name === 'SequelizeDatabaseError' &&
            (err.message?.includes('릴레이션') || err.message?.includes('relation'))) {
          return 0;
        }
        throw err;
      }
    };

    const employeeWhere: any = {
      tenant_id: tenantId,
      status: 'active',
    };
    if (user && user.role !== 'root' && user.role !== 'audit') {
      employeeWhere.company_id = user.company_id;
    }

    const [totalRevenue, roomBookingRevenue, customerCount, invoiceCount, inventoryCount, employeeCount] = await Promise.all([
      safeSum(() => Invoice.sum('total_amount', {
        where: {
          ...invoiceBaseWhere,
          [Op.and]: [{ [Op.or]: [{ payment_status: 'paid' }, { status: 'paid' }] }]
        }
      })),
      safeSum(() => RoomBooking.sum('total_amount', {
        where: { tenant_id: tenantId, payment_status: 'paid', is_active: true }
      })),
      safeCount(() => Customer.count({ where: { tenant_id: tenantId } })),
      safeCount(() => Invoice.count({ where: invoiceBaseWhere })),
      safeSum(() => Product.sum('stock_quantity', { where: { tenant_id: tenantId } })),
      safeCount(() => User.count({ where: employeeWhere })),
    ]);

    const payload = {
      success: true,
      data: {
        totalRevenue: totalRevenue + roomBookingRevenue,
        customerCount,
        invoiceCount,
        inventoryCount,
        employeeCount,
      }
    };
    await setCachedJson(cacheKey, payload, DASHBOARD_CACHE_TTL_SEC);
    res.json(payload);
  } catch (error: any) {
    console.error('대시보드 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '대시보드 통계 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

router.get('/revenue-trend', async (req: AuthRequest, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const cacheKey = buildReferenceCacheKey([
      'dashboard',
      'revenue-trend',
      tenantId,
      queryTenantValue(req),
    ]);
    const cached = await getCachedJson<{ success: true; data: any[] }>(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const loadInvoiceRevenue = async () => {
      try {
        return await Invoice.findAll({
          attributes: [
            [fn('DATE_TRUNC', 'month', col('created_at')), 'month'],
            [fn('SUM', col('total_amount')), 'revenue']
          ],
          where: {
            tenant_id: tenantId,
            is_active: true,
            [Op.or]: [
              { invoice_category: 'regular' },
              { invoice_category: 'e_invoice' },
              { invoice_category: null }
            ],
            [Op.and]: [{ [Op.or]: [{ payment_status: 'paid' }, { status: 'paid' }] }],
            created_at: { [Op.gte]: twelveMonthsAgo }
          },
          group: [fn('DATE_TRUNC', 'month', col('created_at'))],
          order: [[fn('DATE_TRUNC', 'month', col('created_at')), 'ASC']]
        });
      } catch (err: any) {
        if (err.name === 'SequelizeDatabaseError') return [];
        throw err;
      }
    };

    const loadBookingRevenue = async () => {
      try {
        return await RoomBooking.findAll({
          attributes: [
            [fn('DATE_TRUNC', 'month', col('check_in_date')), 'month'],
            [fn('SUM', col('total_amount')), 'revenue']
          ],
          where: {
            tenant_id: tenantId,
            payment_status: 'paid',
            is_active: true,
            check_in_date: { [Op.gte]: twelveMonthsAgo }
          },
          group: [fn('DATE_TRUNC', 'month', col('check_in_date'))],
          order: [[fn('DATE_TRUNC', 'month', col('check_in_date')), 'ASC']]
        });
      } catch (err: any) {
        if (err.name === 'SequelizeDatabaseError') return [];
        throw err;
      }
    };

    const [revenueData, bookingRevenueData] = await Promise.all([
      loadInvoiceRevenue(),
      loadBookingRevenue()
    ]);

    const combinedByMonth = new Map<string, number>();
    [...revenueData, ...bookingRevenueData].forEach((row: any) => {
      const key = String(row.get?.('month') ?? row.month);
      const value = Number(row.get?.('revenue') ?? row.revenue ?? 0);
      combinedByMonth.set(key, (combinedByMonth.get(key) || 0) + value);
    });

    const combinedRevenueData = Array.from(combinedByMonth.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => (a.month < b.month ? -1 : 1));

    const payload = { success: true, data: combinedRevenueData };
    await setCachedJson(cacheKey, payload, DASHBOARD_CACHE_TTL_SEC);
    res.json(payload);
  } catch (error: any) {
    console.error('매출 추이 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '매출 추이 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

router.get('/inventory-status', async (req: AuthRequest, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const cacheKey = buildReferenceCacheKey([
      'dashboard',
      'inventory-status',
      tenantId,
      queryTenantValue(req),
    ]);
    const cached = await getCachedJson<{ success: true; data: any }>(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const lowStockThreshold = parseInt(process.env.LOW_STOCK_THRESHOLD || '10', 10);
    const highStockThreshold = parseInt(process.env.HIGH_STOCK_THRESHOLD || '100', 10);

    const countStock = async (where: Record<string, unknown>) => {
      try {
        return await Product.count({ where: { tenant_id: tenantId, ...where } });
      } catch (err: any) {
        if (err.name === 'SequelizeDatabaseError') return 0;
        throw err;
      }
    };

    const [lowStock, normalStock, overStock] = await Promise.all([
      countStock({ stock_quantity: { [Op.lt]: lowStockThreshold } }),
      countStock({ stock_quantity: { [Op.between]: [lowStockThreshold, highStockThreshold] } }),
      countStock({ stock_quantity: { [Op.gt]: highStockThreshold } })
    ]);

    const payload = {
      success: true,
      data: { lowStock, normalStock, overStock }
    };
    await setCachedJson(cacheKey, payload, DASHBOARD_CACHE_TTL_SEC);
    res.json(payload);
  } catch (error: any) {
    console.error('재고 현황 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '재고 현황 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

router.get('/notices', async (_req, res) => {
  res.json({ success: true, data: [] });
});

const classifyTaskStatus = (listTitle: string): 'todo' | 'in_progress' | 'done' => {
  const normalized = (listTitle || '').replace(/\s+/g, '').toLowerCase();
  if (
    normalized.includes('업무완료') ||
    normalized.includes('완료') ||
    normalized.includes('done') ||
    normalized.includes('closed') ||
    normalized.includes('workcompleted')
  ) {
    return 'done';
  }
  if (normalized.includes('진행') || normalized.includes('doing') || normalized.includes('progress')) {
    return 'in_progress';
  }
  return 'todo';
};

/** 대시보드 — 내 담당 업무 카드 (보드별 N+1 조회 대신 단일 집계) */
router.get('/my-tasks', async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.json({ success: true, data: [] });
    }
    const cacheKey = buildReferenceCacheKey([
      'dashboard',
      'my-tasks',
      user.id,
      user.tenant_id,
      user.company_id || 'all',
    ]);
    const cached = await getCachedJson<{ success: true; data: any[] }>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const memberships = await WorkBoardMember.findAll({
      where: { user_id: user.id },
      attributes: ['board_id'],
    });
    const boardIds = memberships.map((m) => m.board_id);
    if (boardIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const boardWhere: Record<string, unknown> = {
      id: { [Op.in]: boardIds },
      tenant_id: user.tenant_id,
    };
    if (user.company_id) {
      boardWhere.company_id = user.company_id;
    }

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.floor(limitRaw), 1), 200)
      : 5;

    const cards = await WorkBoardCard.findAll({
      where: { assignee_user_id: user.id },
      attributes: ['id', 'title', 'due_date', 'list_id'],
      include: [
        {
          model: WorkBoardList,
          as: 'list',
          attributes: ['id', 'title'],
          required: true,
          include: [
            {
              model: WorkBoard,
              as: 'board',
              attributes: ['id', 'name'],
              required: true,
              where: boardWhere,
            },
          ],
        },
      ],
      limit,
    });

    const tasks = cards.map((card) => {
      const json = card.toJSON ? card.toJSON() : card;
      const list = (json as any).list || {};
      const board = list.board || {};
      const listTitle = list.title || '-';
      return {
        id: `${board.id}-${json.id}`,
        boardId: board.id,
        cardId: Number(json.id) || null,
        boardName: board.name || '-',
        listName: listTitle,
        title: json.title || '제목 없음',
        dueDate: json.due_date,
        status: classifyTaskStatus(listTitle),
      };
    });

    tasks.sort((a, b) => {
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    const payload = { success: true, data: tasks.slice(0, limit) };
    await setCachedJson(cacheKey, payload, DASHBOARD_TASK_CACHE_TTL_SEC);
    res.json(payload);
  } catch (error: any) {
    console.error('내 담당 업무 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '내 담당 업무 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
});

export default router;
