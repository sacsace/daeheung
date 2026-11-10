import express from 'express';
import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import { DataTypes } from 'sequelize';
import { Contract, Customer } from '../models';
import { validateBody } from '../middleware/validate';
import sequelize from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { requireAdminRootOrMenuPermissionAnyOf } from '../middleware/menuPermission';
import { AuthRequest } from '../types';
import { ensureUploadSubdir } from '../utils/uploadPath';
import {
  assertActiveContractType,
  createContractType,
  deleteContractType,
  getContractTypes,
  updateContractType,
} from '../controllers/contractTypeController';

const router = express.Router();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const contractUploadDir = ensureUploadSubdir('contracts');

/** 프론트 `/customers/contracts` 및 상위 메뉴 `route` 후보 */
const CONTRACT_MENU_ROUTES = ['/customers/contracts', '/customers'];

const permRead = requireAdminRootOrMenuPermissionAnyOf(CONTRACT_MENU_ROUTES, ['can_view', 'can_create']);
const permCreate = requireAdminRootOrMenuPermissionAnyOf(CONTRACT_MENU_ROUTES, ['can_create']);
const permEdit = requireAdminRootOrMenuPermissionAnyOf(CONTRACT_MENU_ROUTES, ['can_edit']);
const permDelete = requireAdminRootOrMenuPermissionAnyOf(CONTRACT_MENU_ROUTES, ['can_delete']);

let contractSchemaEnsured = false;

const ensureContractUploadDir = () => {
  ensureUploadSubdir('contracts');
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureContractUploadDir();
    cb(null, contractUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeBase = path
      .basename(file.originalname || 'contract-file', ext)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);
    const timestamp = Date.now();
    cb(null, `${timestamp}_${safeBase}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

const generateContractNumber = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const suffix = String(Date.now()).slice(-6);
  return `CTR-${yyyy}${mm}${dd}-${suffix}`;
};

const ensureContractSchema = async () => {
  if (contractSchemaEnsured) return;

  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable('contracts');

  if (!table.company_id) {
    await queryInterface.addColumn('contracts', 'company_id', {
      type: DataTypes.INTEGER,
      allowNull: true
    });
  }

  if (!table.contract_value) {
    await queryInterface.addColumn('contracts', 'contract_value', {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    });

    if (table.value) {
      await sequelize.query(`
        UPDATE contracts
        SET contract_value = value
        WHERE contract_value IS NULL
      `);
    }
  }

  if (!table.contract_type) {
    await queryInterface.addColumn('contracts', 'contract_type', {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'sales'
    });
  } else {
    await queryInterface.changeColumn('contracts', 'contract_type', {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'sales'
    });
  }

  if (!table.attachments) {
    await queryInterface.addColumn('contracts', 'attachments', {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
    });
  }

  contractSchemaEnsured = true;
};

const resolveValidCustomerId = async (
  input: unknown,
  user: { tenant_id: number; company_id: number }
): Promise<number | null> => {
  const num = typeof input === 'number' ? input : Number.parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(num) || num >= 1000000000) return null;
  const customer = await (Customer as any).findOne({
    where: { id: num, tenant_id: user.tenant_id, company_id: user.company_id },
    attributes: ['id']
  });
  return customer ? num : null;
};

router.use(authenticateToken);

const withCustomerName = (row: any) => {
  const plain = typeof row?.toJSON === 'function' ? row.toJSON() : { ...row };
  const customerName =
    plain.customer?.name ||
    plain.customer_name ||
    null;
  return {
    ...plain,
    customer_name: customerName,
  };
};

const customerInclude = {
  model: Customer as any,
  as: 'customer',
  attributes: ['id', 'name'],
  required: false,
};

// 계약 구분 마스터 (/:id 보다 먼저 등록)
router.get('/types', permRead, getContractTypes);
router.post('/types', permCreate, createContractType);
router.put('/types/:id', permEdit, updateContractType);
router.delete('/types/:id', permDelete, deleteContractType);

// 계약 목록 조회
router.get('/', permRead, async (req: AuthRequest, res: Response) => {
  try {
    await ensureContractSchema();
    const contracts = await (Contract as any).findAll({
      where: { tenant_id: req.user.tenant_id, company_id: req.user.company_id },
      include: [customerInclude],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: contracts.map(withCustomerName)
    });
  } catch (error: any) {
    console.error('계약 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '계약 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 특정 계약 조회
router.get('/:id', permRead, async (req: AuthRequest, res: Response) => {
  try {
    await ensureContractSchema();
    const numericId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(numericId)) {
      return res.status(400).json({ success: false, message: '잘못된 계약 ID입니다.' });
    }

    const contract = await (Contract as any).findOne({
      where: {
        id: numericId,
        tenant_id: req.user.tenant_id,
        company_id: req.user.company_id
      },
      include: [customerInclude],
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: '계약을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: withCustomerName(contract)
    });
  } catch (error: any) {
    console.error('계약 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '계약 조회 중 오류가 발생했습니다.'
    });
  }
});

// 계약 생성
router.post(
  '/',
  permCreate,
  validateBody({
    contract_number: { type: 'string', minLength: 1, maxLength: 50 },
    title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    customer_id: { type: 'number' },
    contract_type: { type: 'string', minLength: 1, maxLength: 50 },
    start_date: { required: true, type: 'string', pattern: datePattern },
    end_date: { required: true, type: 'string', pattern: datePattern },
    status: { type: 'string', maxLength: 20 }
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      await ensureContractSchema();
      const parsedContractValue = Number(req.body.contract_value ?? req.body.value);
      if (!Number.isFinite(parsedContractValue) || parsedContractValue <= 0) {
        return res.status(400).json({
          success: false,
          message: '계약 가치를 올바르게 입력해 주세요.'
        });
      }

      const typeCheck = await assertActiveContractType(
        req.user.tenant_id,
        req.user.company_id,
        req.body.contract_type || 'sales'
      );
      if (typeCheck.ok === false) {
        return res.status(400).json({ success: false, message: typeCheck.message });
      }

      const customerId = await resolveValidCustomerId(req.body.customer_id, req.user);
      const generatedContractNumber = req.body.contract_number || generateContractNumber();
      const contractData = {
        ...req.body,
        customer_id: customerId,
        contract_number: generatedContractNumber,
        contract_type: typeCheck.code,
        contract_value: parsedContractValue,
        tenant_id: req.user.tenant_id,
        company_id: req.user.company_id,
        attachments: Array.isArray(req.body.attachments) ? req.body.attachments : []
      };

      const contract = await (Contract as any).create(contractData);

      res.status(201).json({
        success: true,
        message: '계약이 성공적으로 등록되었습니다.',
        data: contract
      });
    } catch (error: any) {
      console.error('계약 생성 오류:', error);
      res.status(500).json({
        success: false,
        message: '계약 생성 중 오류가 발생했습니다.'
      });
    }
  }
);

// 계약 수정
router.put(
  '/:id',
  permEdit,
  validateBody({
    contract_number: { type: 'string', minLength: 1, maxLength: 50 },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    customer_id: { type: 'number' },
    contract_type: { type: 'string', minLength: 1, maxLength: 50 },
    start_date: { type: 'string', pattern: datePattern },
    end_date: { type: 'string', pattern: datePattern },
    status: { type: 'string', maxLength: 20 }
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      await ensureContractSchema();
      const numericId = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(numericId)) {
        return res.status(400).json({ success: false, message: '잘못된 계약 ID입니다.' });
      }

      const contract = await (Contract as any).findOne({
        where: {
          id: numericId,
          tenant_id: req.user.tenant_id,
          company_id: req.user.company_id
        }
      });

      if (!contract) {
        return res.status(404).json({
          success: false,
          message: '계약을 찾을 수 없습니다.'
        });
      }

      const updatePayload: Record<string, any> = { ...req.body };
      if (
        Object.prototype.hasOwnProperty.call(updatePayload, 'contract_value') ||
        Object.prototype.hasOwnProperty.call(updatePayload, 'value')
      ) {
        const parsedContractValue = Number(updatePayload.contract_value ?? updatePayload.value);
        if (!Number.isFinite(parsedContractValue) || parsedContractValue <= 0) {
          return res.status(400).json({
            success: false,
            message: '계약 가치를 올바르게 입력해 주세요.'
          });
        }
        updatePayload.contract_value = parsedContractValue;
      }

      if (Object.prototype.hasOwnProperty.call(updatePayload, 'customer_id')) {
        updatePayload.customer_id = await resolveValidCustomerId(updatePayload.customer_id, req.user);
      }

      if (Object.prototype.hasOwnProperty.call(updatePayload, 'contract_type')) {
        const typeCheck = await assertActiveContractType(
          req.user.tenant_id,
          req.user.company_id,
          updatePayload.contract_type
        );
        if (typeCheck.ok === false) {
          return res.status(400).json({ success: false, message: typeCheck.message });
        }
        updatePayload.contract_type = typeCheck.code;
      }

      await contract.update(updatePayload);

      res.json({
        success: true,
        message: '계약이 성공적으로 수정되었습니다.',
        data: contract
      });
    } catch (error: any) {
      console.error('계약 수정 오류:', error);
      res.status(500).json({
        success: false,
        message: '계약 수정 중 오류가 발생했습니다.'
      });
    }
  }
);

// 계약 삭제
router.delete('/:id', permDelete, async (req: AuthRequest, res: Response) => {
  try {
    await ensureContractSchema();
    const numericId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(numericId)) {
      return res.status(400).json({ success: false, message: '잘못된 계약 ID입니다.' });
    }

    const contract = await (Contract as any).findOne({
      where: {
        id: numericId,
        tenant_id: req.user.tenant_id,
        company_id: req.user.company_id
      }
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: '계약을 찾을 수 없습니다.'
      });
    }

    await contract.destroy();

    res.json({
      success: true,
      message: '계약이 성공적으로 삭제되었습니다.'
    });
  } catch (error: any) {
    console.error('계약 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '계약 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 계약 파일 첨부
router.post('/:id/upload-files', permEdit, upload.array('files'), async (req: AuthRequest, res: Response) => {
  try {
    await ensureContractSchema();
    const numericId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(numericId)) {
      return res.status(400).json({ success: false, message: '잘못된 계약 ID입니다.' });
    }

    const contract = await (Contract as any).findOne({
      where: {
        id: numericId,
        tenant_id: req.user.tenant_id,
        company_id: req.user.company_id
      }
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: '계약을 찾을 수 없습니다.'
      });
    }

    const files = ((req as any).files || []) as Array<{ filename?: string }>;
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: '첨부할 파일이 없습니다.'
      });
    }

    const existingAttachments = Array.isArray(contract.attachments) ? [...contract.attachments] : [];
    const uploadedPaths = files
      .filter((file) => file.filename)
      .map((file) => path.join('contracts', file.filename as string).replace(/\\/g, '/'));

    const attachments = [...existingAttachments, ...uploadedPaths];
    await contract.update({ attachments });

    return res.json({
      success: true,
      message: '계약 파일이 첨부되었습니다.',
      data: contract,
      uploaded: uploadedPaths
    });
  } catch (error: any) {
    console.error('계약 파일 첨부 오류:', error);
    return res.status(500).json({
      success: false,
      message: '계약 파일 첨부 중 오류가 발생했습니다.'
    });
  }
});

export default router;
