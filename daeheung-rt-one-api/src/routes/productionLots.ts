import { Router } from 'express';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { authenticateToken, restrictAuditToReadOnly } from '../middleware/auth';
import { requireAdminRootOrMenuPermissionAnyOf } from '../middleware/menuPermission';
import ProductionLot, { LotKind } from '../models/ProductionLot';
import LotMovement, { LotMovementType } from '../models/LotMovement';
import Product from '../models/Product';

const router = Router();
const LOT_ROUTES = ['/production/lots', '/production'];
const canRead = requireAdminRootOrMenuPermissionAnyOf(LOT_ROUTES, ['can_view', 'can_create']);
const canCreate = requireAdminRootOrMenuPermissionAnyOf(LOT_ROUTES, ['can_create', 'can_edit']);
const canDelete = requireAdminRootOrMenuPermissionAnyOf(LOT_ROUTES, ['can_delete']);

const KINDS = new Set<LotKind>(['material', 'finished']);
const MOVEMENTS = new Set<LotMovementType>(['receive', 'produce', 'consume', 'ship']);

const roundQty = (value: number) => Math.round(value * 1000) / 1000;

const scopeOf = (req: any): { tenant_id: number; company_id: number } | null => {
  const tenantId = Number(req.user?.tenant_id);
  const companyId = Number(req.user?.company_id);
  if (!Number.isFinite(tenantId) || tenantId <= 0 || !Number.isFinite(companyId) || companyId <= 0) {
    return null;
  }
  return { tenant_id: tenantId, company_id: companyId };
};

const lotInclude = [
  { model: Product, as: 'product', attributes: ['id', 'product_code', 'name', 'unit'], required: false },
];

async function nextLotNo(tenantId: number, companyId: number): Promise<string> {
  const now = new Date();
  const prefix = `DRT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`;
  const latest = await ProductionLot.findOne({
    where: { tenant_id: tenantId, company_id: companyId, lot_no: { [Op.like]: `${prefix}%` } },
    order: [['lot_no', 'DESC']],
    paranoid: false,
  });
  const prev = latest ? Number(String(latest.lot_no).slice(prefix.length)) : 0;
  const seq = Number.isFinite(prev) ? prev + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

router.use(authenticateToken);

router.get('/', canRead, async (req, res) => {
  try {
    const scope = scopeOf(req);
    if (!scope) {
      return res.status(400).json({ success: false, message: '소속 회사가 없습니다.' });
    }
    const [lots, products] = await Promise.all([
      ProductionLot.findAll({
        where: scope,
        include: lotInclude,
        order: [['updated_at', 'DESC'], ['id', 'DESC']],
      }),
      Product.findAll({
        where: scope,
        attributes: ['id', 'product_code', 'name', 'unit'],
        order: [['name', 'ASC']],
      }),
    ]);
    return res.json({ success: true, data: { lots, products } });
  } catch (error: any) {
    console.error('로트 목록 조회 오류:', error);
    return res.status(500).json({ success: false, message: '로트 목록을 불러오지 못했습니다.' });
  }
});

router.get('/:id', canRead, async (req, res) => {
  try {
    const scope = scopeOf(req);
    if (!scope) {
      return res.status(400).json({ success: false, message: '소속 회사가 없습니다.' });
    }
    const lot = await ProductionLot.findOne({
      where: { id: Number(req.params.id), ...scope },
      include: lotInclude,
    });
    if (!lot) {
      return res.status(404).json({ success: false, message: '로트를 찾을 수 없습니다.' });
    }
    const movements = await LotMovement.findAll({
      where: { lot_id: lot.id, ...scope },
      include: [{ model: ProductionLot, as: 'relatedLot', attributes: ['id', 'lot_no', 'lot_kind'], required: false }],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
    });
    return res.json({ success: true, data: { lot, movements } });
  } catch (error: any) {
    console.error('로트 상세 조회 오류:', error);
    return res.status(500).json({ success: false, message: '로트 상세를 불러오지 못했습니다.' });
  }
});

router.post('/', canCreate, restrictAuditToReadOnly, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const scope = scopeOf(req);
    if (!scope) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '소속 회사가 없습니다.' });
    }
    const lotKind = String(req.body?.lot_kind || '') as LotKind;
    const productId = Number(req.body?.product_id);
    if (!KINDS.has(lotKind)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '구분은 원자재 또는 완제품입니다.' });
    }
    const product = await Product.findOne({ where: { id: productId, ...scope }, transaction });
    if (!product) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '품목을 선택하세요.' });
    }

    const requestedNo = String(req.body?.lot_no || '').trim();
    const lotNo = requestedNo || (await nextLotNo(scope.tenant_id, scope.company_id));
    const duplicate = await ProductionLot.findOne({
      where: { company_id: scope.company_id, lot_no: lotNo },
      transaction,
    });
    if (duplicate) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '같은 로트 번호가 이미 있습니다.' });
    }

    const initialQty = roundQty(Number(req.body?.initial_quantity || 0));
    if (initialQty < 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '수량은 0 이상이어야 합니다.' });
    }

    const lot = await ProductionLot.create(
      {
        ...scope,
        lot_no: lotNo,
        product_id: productId,
        lot_kind: lotKind,
        status: initialQty > 0 ? (lotKind === 'finished' ? 'in_process' : 'released') : 'open',
        quantity_on_hand: initialQty,
        location: String(req.body?.location || '').trim() || null,
        produced_on: req.body?.produced_on || null,
        notes: String(req.body?.notes || '').trim() || null,
        created_by: Number((req as any).user?.id) || null,
      },
      { transaction }
    );

    if (initialQty > 0) {
      await LotMovement.create(
        {
          ...scope,
          lot_id: lot.id,
          movement_type: lotKind === 'finished' ? 'produce' : 'receive',
          quantity: initialQty,
          notes: '최초 수량',
          created_by: Number((req as any).user?.id) || null,
        },
        { transaction }
      );
    }

    await transaction.commit();
    const created = await ProductionLot.findByPk(lot.id, { include: lotInclude });
    return res.status(201).json({ success: true, data: created, message: '로트를 등록했습니다.' });
  } catch (error: any) {
    await transaction.rollback();
    console.error('로트 등록 오류:', error);
    return res.status(500).json({ success: false, message: '로트를 등록하지 못했습니다.' });
  }
});

router.post('/:id/movements', canCreate, restrictAuditToReadOnly, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const scope = scopeOf(req);
    if (!scope) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '소속 회사가 없습니다.' });
    }
    const movementType = String(req.body?.movement_type || '') as LotMovementType;
    const quantity = roundQty(Number(req.body?.quantity));
    if (!MOVEMENTS.has(movementType) || !Number.isFinite(quantity) || quantity <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '이동 구분과 수량을 확인하세요.' });
    }

    const lot = await ProductionLot.findOne({
      where: { id: Number(req.params.id), ...scope },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!lot) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: '로트를 찾을 수 없습니다.' });
    }
    if (lot.status === 'scrapped') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '폐기 로트는 이동할 수 없습니다.' });
    }

    const onHand = roundQty(Number(lot.quantity_on_hand));
    let relatedLotId: number | null = null;

    if (movementType === 'receive') {
      if (lot.lot_kind !== 'material') {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: '입고는 원자재 로트만 가능합니다.' });
      }
      lot.quantity_on_hand = roundQty(onHand + quantity);
      if (lot.status === 'open') lot.status = 'released';
    } else if (movementType === 'produce') {
      if (lot.lot_kind !== 'finished') {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: '생산은 완제품 로트만 가능합니다.' });
      }
      lot.quantity_on_hand = roundQty(onHand + quantity);
      if (lot.status === 'open' || lot.status === 'shipped') lot.status = 'in_process';
    } else if (movementType === 'consume') {
      if (lot.lot_kind !== 'material') {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: '사용은 원자재 로트만 가능합니다.' });
      }
      if (onHand < quantity) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: '로트 수량이 부족합니다.' });
      }
      relatedLotId = Number(req.body?.related_lot_id);
      const finished = await ProductionLot.findOne({
        where: { id: relatedLotId, ...scope, lot_kind: 'finished' },
        transaction,
      });
      if (!finished) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: '이 원자재를 사용한 완제품 로트를 선택하세요.' });
      }
      lot.quantity_on_hand = roundQty(onHand - quantity);
    } else {
      if (lot.lot_kind !== 'finished') {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: '출고는 완제품 로트만 가능합니다.' });
      }
      if (onHand < quantity) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: '로트 수량이 부족합니다.' });
      }
      lot.quantity_on_hand = roundQty(onHand - quantity);
      lot.status = Number(lot.quantity_on_hand) === 0 ? 'shipped' : 'released';
    }

    await lot.save({ transaction });
    await LotMovement.create(
      {
        ...scope,
        lot_id: lot.id,
        movement_type: movementType,
        quantity,
        related_lot_id: relatedLotId,
        notes: String(req.body?.notes || '').trim() || null,
        created_by: Number((req as any).user?.id) || null,
      },
      { transaction }
    );
    await transaction.commit();
    const updated = await ProductionLot.findByPk(lot.id, { include: lotInclude });
    return res.json({ success: true, data: updated, message: '로트 수량을 반영했습니다.' });
  } catch (error: any) {
    await transaction.rollback();
    console.error('로트 이동 오류:', error);
    return res.status(500).json({ success: false, message: '로트 이동을 저장하지 못했습니다.' });
  }
});

router.delete('/:id', canDelete, restrictAuditToReadOnly, async (req, res) => {
  try {
    const scope = scopeOf(req);
    if (!scope) {
      return res.status(400).json({ success: false, message: '소속 회사가 없습니다.' });
    }
    const lot = await ProductionLot.findOne({ where: { id: Number(req.params.id), ...scope } });
    if (!lot) {
      return res.status(404).json({ success: false, message: '로트를 찾을 수 없습니다.' });
    }
    if (roundQty(Number(lot.quantity_on_hand)) > 0) {
      return res.status(400).json({ success: false, message: '수량이 남은 로트는 삭제할 수 없습니다.' });
    }
    await lot.destroy();
    return res.json({ success: true, message: '로트를 삭제했습니다.' });
  } catch (error: any) {
    console.error('로트 삭제 오류:', error);
    return res.status(500).json({ success: false, message: '로트를 삭제하지 못했습니다.' });
  }
});

export default router;
