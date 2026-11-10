import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import path from 'path';
import { DataTypes, Op } from 'sequelize';
import { LoginInfo, LoginInfoTab, LoginLog, Company, User } from '../models';
import { authenticateToken, requireRootOrMinsubEmployee } from '../middleware/auth';
import { AuthRequest } from '../types';
import sequelize from '../config/database';

const router = express.Router();
const allowedExcelTypes = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];
const allowedExcelExtensions = ['.xls', '.xlsx'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExcelTypes.includes(file.mimetype) || !allowedExcelExtensions.includes(extension)) {
      return cb(new Error('허용되지 않은 파일 형식입니다.'));
    }
    return cb(null, true);
  }
});

router.use(authenticateToken);
router.use(requireRootOrMinsubEmployee);

/** 마이그레이션 미적용 DB용: login_info_tabs + login_infos.tab_id 자동 반영 */
let loginInfoTabsSchemaEnsured = false;
let loginInfoTabsSchemaLock: Promise<void> | null = null;

const ensureLoginInfoTabsSchema = async (): Promise<void> => {
  if (loginInfoTabsSchemaEnsured) return;
  if (loginInfoTabsSchemaLock) {
    await loginInfoTabsSchemaLock;
    return;
  }

  loginInfoTabsSchemaLock = (async () => {
    const qi = sequelize.getQueryInterface();
    try {
      const tabDesc = await qi.describeTable('login_info_tabs');
      if (!tabDesc.column_headers) {
        await qi.addColumn('login_info_tabs', 'column_headers', {
          type: DataTypes.JSON,
          allowNull: true
        });
      }
      if (!tabDesc.column_hidden) {
        await qi.addColumn('login_info_tabs', 'column_hidden', {
          type: DataTypes.JSON,
          allowNull: true
        });
      }
      if (!tabDesc.column_schema) {
        await qi.addColumn('login_info_tabs', 'column_schema', {
          type: DataTypes.JSON,
          allowNull: true
        });
      }
      loginInfoTabsSchemaEnsured = true;
      return;
    } catch {
      // 테이블 없음 → 마이그레이션과 동일 절차
    }

    try {
      await qi.createTable('login_info_tabs', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        tenant_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'tenants', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        company_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'companies', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        name: { type: DataTypes.STRING(120), allowNull: false },
        sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        column_headers: { type: DataTypes.JSON, allowNull: true },
        column_hidden: { type: DataTypes.JSON, allowNull: true },
        column_schema: { type: DataTypes.JSON, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
      });
    } catch (err: any) {
      const msg = String(err?.message || err?.original?.message || '');
      if (!/already exists|duplicate|이미 있습니다/i.test(msg)) {
        throw err;
      }
    }

    await qi.addIndex('login_info_tabs', ['company_id'], {
      name: 'login_info_tabs_company_id_idx'
    }).catch(() => {});
    await qi.addIndex('login_info_tabs', ['tenant_id'], {
      name: 'login_info_tabs_tenant_id_idx'
    }).catch(() => {});

    const liDesc = await qi.describeTable('login_infos');
    if (!liDesc.tab_id) {
      await qi.addColumn('login_infos', 'tab_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'login_info_tabs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    }

    const [companies] = await sequelize.query(`SELECT id, tenant_id FROM companies ORDER BY id ASC`);
    const rows: Record<string, unknown>[] = [];
    const now = new Date();
    for (const c of companies as { id: number; tenant_id: number }[]) {
      rows.push({
        tenant_id: c.tenant_id,
        company_id: c.id,
        name: '외부 사이트',
        sort_order: 0,
        created_at: now,
        updated_at: now
      });
      rows.push({
        tenant_id: c.tenant_id,
        company_id: c.id,
        name: 'MCA 로그인 정보',
        sort_order: 1,
        created_at: now,
        updated_at: now
      });
    }

    const [countRows] = await sequelize.query(`SELECT COUNT(*)::int AS c FROM login_info_tabs`);
    const tabCount = Number((countRows as { c: string | number }[])?.[0]?.c ?? 0);
    if (tabCount === 0 && rows.length) {
      await qi.bulkInsert('login_info_tabs', rows);
    }

    const li = await qi.describeTable('login_infos');
    const hasScope = !!li.scope;

    if (hasScope) {
      await sequelize.query(`
        UPDATE login_infos li
        SET tab_id = lit.id
        FROM login_info_tabs lit
        WHERE li.company_id = lit.company_id
          AND lit.sort_order = 1
          AND li.scope = 'mca'
      `);
      await sequelize.query(`
        UPDATE login_infos li
        SET tab_id = lit.id
        FROM login_info_tabs lit
        WHERE li.company_id = lit.company_id
          AND lit.sort_order = 0
          AND (li.scope IS NULL OR li.scope IS DISTINCT FROM 'mca')
      `);
    } else {
      await sequelize.query(`
        UPDATE login_infos li
        SET tab_id = lit.id
        FROM login_info_tabs lit
        WHERE li.company_id = lit.company_id AND lit.sort_order = 0
      `);
    }

    await sequelize.query(`
      UPDATE login_infos li
      SET tab_id = lit.id
      FROM login_info_tabs lit
      WHERE li.tab_id IS NULL AND li.company_id = lit.company_id AND lit.sort_order = 0
    `);

    await sequelize.query(`ALTER TABLE login_infos ALTER COLUMN tab_id SET NOT NULL`);

    try {
      await qi.removeIndex('login_infos', 'login_infos_company_id_scope_idx');
    } catch {
      // ignore
    }
    if (hasScope) {
      try {
        await qi.removeColumn('login_infos', 'scope');
      } catch {
        // 이미 제거됨
      }
    }

    try {
      await qi.addIndex('login_infos', ['tab_id'], { name: 'login_infos_tab_id_idx' });
    } catch {
      // ignore
    }

    loginInfoTabsSchemaEnsured = true;
  })();

  try {
    await loginInfoTabsSchemaLock;
  } finally {
    loginInfoTabsSchemaLock = null;
  }
};

let loginInfosExtraFieldsEnsured = false;
const ensureLoginInfosExtraFieldsColumn = async (): Promise<void> => {
  if (loginInfosExtraFieldsEnsured) return;
  const qi = sequelize.getQueryInterface();
  try {
    const li = await qi.describeTable('login_infos');
    if (!li.extra_fields) {
      await qi.addColumn('login_infos', 'extra_fields', {
        type: DataTypes.JSON,
        allowNull: true
      });
    }
    loginInfosExtraFieldsEnsured = true;
  } catch {
    loginInfosExtraFieldsEnsured = true;
  }
};

router.use(async (_req, _res, next) => {
  try {
    await ensureLoginInfoTabsSchema();
    await ensureLoginInfosExtraFieldsColumn();
    next();
  } catch (err) {
    console.error('login_info_tabs 스키마 보장 실패:', err);
    next(err);
  }
});

const ensureCompanyInTenant = async (companyId: number, tenantId: number) => {
  const company = await (Company as any).findOne({
    where: { id: companyId, tenant_id: tenantId },
    attributes: ['id', 'tenant_id']
  });
  return !!company;
};

const ensureDefaultTabsForCompany = async (companyId: number, tenantId: number) => {
  const n = await (LoginInfoTab as any).count({
    where: { company_id: companyId, tenant_id: tenantId }
  });
  if (n > 0) return;
  await (LoginInfoTab as any).bulkCreate([
    { tenant_id: tenantId, company_id: companyId, name: '외부 사이트', sort_order: 0 },
    { tenant_id: tenantId, company_id: companyId, name: 'MCA 로그인 정보', sort_order: 1 }
  ]);
};

const assertTabForCompany = async (tabId: number, companyId: number, tenantId: number) => {
  return (LoginInfoTab as any).findOne({
    where: { id: tabId, company_id: companyId, tenant_id: tenantId }
  });
};

const normalizeHeader = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '');

const resolveColumnIndex = (headers: string[], aliases: string[], fallbackIndex: number) => {
  const normalizedHeaders = headers.map(normalizeHeader);
  const matchIndex = normalizedHeaders.findIndex((header) =>
    aliases.map(normalizeHeader).includes(header)
  );
  return matchIndex >= 0 ? matchIndex : fallbackIndex;
};

const getCellValue = (row: any[], index: number) =>
  index >= 0 && index < row.length ? String(row[index] ?? '').trim() : '';

const trimString = (value: unknown) => String(value ?? '').trim();

const COLUMN_HEADER_KEYS = [
  'no',
  'division',
  'login_id',
  'password',
  'open_file_returns',
  'url',
  'actions'
] as const;

/** 화면에서 숨길 수 있는 데이터 열 (No·작업 열 제외) */
const HIDABLE_COLUMN_FIELDS = ['division', 'login_id', 'password', 'open_file_returns', 'url'] as const;

const normalizeColumnHidden = (
  raw: unknown
): { ok: true; value: string[] } | { ok: false; message: string } => {
  if (raw === null || raw === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'column_hidden는 배열이어야 합니다.' };
  }
  const set = new Set<string>();
  for (const item of raw) {
    const s = trimString(item);
    if (!s) continue;
    if (!(HIDABLE_COLUMN_FIELDS as readonly string[]).includes(s)) {
      return { ok: false, message: '허용되지 않은 열입니다.' };
    }
    set.add(s);
  }
  const arr = [...set];
  const visible = HIDABLE_COLUMN_FIELDS.filter((f) => !arr.includes(f));
  if (visible.length < 1) {
    return { ok: false, message: '데이터 열은 최소 1개 이상 보이도록 해야 합니다.' };
  }
  return { ok: true, value: arr };
};

type NormalizeColumnHiddenResult = ReturnType<typeof normalizeColumnHidden>;
const isColumnHiddenNormalizeError = (
  r: NormalizeColumnHiddenResult
): r is { ok: false; message: string } => r.ok === false;

const BUILTIN_COLUMN_KEYS = ['division', 'login_id', 'password', 'open_file_returns', 'url'] as const;
type BuiltinColumnKey = (typeof BUILTIN_COLUMN_KEYS)[number];

const REQUIRED_BUILTIN_COLUMNS: BuiltinColumnKey[] = ['division', 'login_id', 'password'];

type ColumnSchemaEntry =
  | { kind: 'builtin'; key: BuiltinColumnKey }
  | { kind: 'custom'; id: string; label: string };

type ColumnSchema = { columns: ColumnSchemaEntry[] };

const CUSTOM_COL_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function columnSchemaFromLegacyHidden(columnHidden: unknown): ColumnSchema {
  const hidden = new Set(
    Array.isArray(columnHidden) ? columnHidden.map((x) => trimString(x)).filter(Boolean) : []
  );
  return {
    columns: BUILTIN_COLUMN_KEYS.filter((k) => !hidden.has(k)).map((key) => ({
      kind: 'builtin' as const,
      key
    }))
  };
}

function getEffectiveColumnSchema(tab: any): ColumnSchema {
  const raw = tab?.column_schema;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as any).columns)) {
    const n = normalizeColumnSchema(raw);
    if (n.ok) return n.value;
  }
  return columnSchemaFromLegacyHidden(tab?.column_hidden);
}

const normalizeColumnSchema = (
  raw: unknown
): { ok: true; value: ColumnSchema } | { ok: false; message: string } => {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'column_schema 형식이 올바르지 않습니다.' };
  }
  const cols = (raw as any).columns;
  if (!Array.isArray(cols) || cols.length === 0) {
    return { ok: false, message: '열이 하나 이상 필요합니다.' };
  }
  if (cols.length > 40) {
    return { ok: false, message: '열 개수가 너무 많습니다.' };
  }
  const out: ColumnSchemaEntry[] = [];
  const seenBuiltin = new Set<string>();
  const seenCustom = new Set<string>();
  let customCount = 0;

  for (const item of cols) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, message: 'column_schema 항목 형식이 올바르지 않습니다.' };
    }
    const kind = trimString((item as any).kind);
    if (kind === 'builtin') {
      const key = trimString((item as any).key) as BuiltinColumnKey;
      if (!(BUILTIN_COLUMN_KEYS as readonly string[]).includes(key)) {
        return { ok: false, message: '허용되지 않은 내장 열입니다.' };
      }
      if (seenBuiltin.has(key)) {
        return { ok: false, message: '중복된 열이 있습니다.' };
      }
      seenBuiltin.add(key);
      out.push({ kind: 'builtin', key });
    } else if (kind === 'custom') {
      const id = trimString((item as any).id);
      const label = trimString((item as any).label);
      if (!CUSTOM_COL_ID_RE.test(id)) {
        return { ok: false, message: '커스텀 열 id가 올바르지 않습니다.' };
      }
      if (!label || label.length > 80) {
        return { ok: false, message: '커스텀 열 이름은 1~80자여야 합니다.' };
      }
      if (seenCustom.has(id)) {
        return { ok: false, message: '중복된 커스텀 열이 있습니다.' };
      }
      seenCustom.add(id);
      customCount += 1;
      if (customCount > 25) {
        return { ok: false, message: '커스텀 열은 최대 25개까지입니다.' };
      }
      out.push({ kind: 'custom', id, label });
    } else {
      return { ok: false, message: 'column_schema kind가 올바르지 않습니다.' };
    }
  }

  for (const req of REQUIRED_BUILTIN_COLUMNS) {
    if (!seenBuiltin.has(req)) {
      return { ok: false, message: '구분·Login ID·Password 열은 제거할 수 없습니다.' };
    }
  }

  return { ok: true, value: { columns: out } };
};

type NormalizeColumnSchemaResult = ReturnType<typeof normalizeColumnSchema>;
const isColumnSchemaNormalizeError = (
  r: NormalizeColumnSchemaResult
): r is { ok: false; message: string } => r.ok === false;

function columnSignature(entry: ColumnSchemaEntry): string {
  if (entry.kind === 'builtin') return `builtin:${entry.key}`;
  return `custom:${entry.id}`;
}

async function applyColumnSchemaRemovals(
  tabId: number,
  tenantId: number,
  oldSchema: ColumnSchema,
  newSchema: ColumnSchema
) {
  const oldS = new Set(oldSchema.columns.map(columnSignature));
  const newS = new Set(newSchema.columns.map(columnSignature));
  const removed = [...oldS].filter((x) => !newS.has(x));

  for (const sig of removed) {
    if (sig.startsWith('builtin:')) {
      const key = sig.slice(8) as BuiltinColumnKey;
      if (key === 'open_file_returns') {
        await (LoginInfo as any).update(
          { open_file_returns: null },
          { where: { tab_id: tabId, tenant_id: tenantId } }
        );
      } else if (key === 'url') {
        await (LoginInfo as any).update({ url: null }, { where: { tab_id: tabId, tenant_id: tenantId } });
      }
    } else if (sig.startsWith('custom:')) {
      const id = sig.slice(7);
      const rows = await (LoginInfo as any).findAll({
        where: { tab_id: tabId, tenant_id: tenantId },
        attributes: ['id', 'extra_fields']
      });
      for (const row of rows) {
        const raw = row.extra_fields;
        const ex =
          raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
        if (Object.prototype.hasOwnProperty.call(ex, id)) {
          delete ex[id];
          await row.update({ extra_fields: Object.keys(ex).length ? ex : null });
        }
      }
    }
  }
}

function normalizeExtraFieldsPayload(raw: unknown): Record<string, string> | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!CUSTOM_COL_ID_RE.test(k)) continue;
    const s = trimString(v);
    if (s.length > 500) {
      continue;
    }
    out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

const mergeColumnHeaders = (
  existing: unknown,
  incoming: unknown
): { ok: true; value: Record<string, string> } | { ok: false; message: string } => {
  if (incoming == null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { ok: false, message: 'column_headers 형식이 올바르지 않습니다.' };
  }
  const prev =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, string>) }
      : {};
  const out: Record<string, string> = { ...prev };
  for (const key of COLUMN_HEADER_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue;
    const s = trimString((incoming as Record<string, unknown>)[key]);
    if (!s) {
      delete out[key];
      continue;
    }
    if (s.length > 80) {
      return { ok: false, message: '열 헤더는 80자 이하로 입력해주세요.' };
    }
    out[key] = s;
  }
  return { ok: true, value: out };
};

type MergeColumnHeadersResult = ReturnType<typeof mergeColumnHeaders>;
const isColumnHeadersMergeError = (
  r: MergeColumnHeadersResult
): r is { ok: false; message: string } => r.ok === false;

const isMissingLoginLogsTableError = (error: any) => {
  const message = String(error?.message || '');
  const originalMessage = String(error?.original?.message || '');
  const combined = `${message} ${originalMessage}`.toLowerCase();
  return (
    combined.includes('login_logs') &&
    (combined.includes('does not exist') ||
      combined.includes('relation') ||
      combined.includes('no such table') ||
      combined.includes('unknown table'))
  );
};

let loginLogsSchemaEnsured = false;
const ensureLoginLogsSchema = async () => {
  if (loginLogsSchemaEnsured) return;
  const queryInterface = sequelize.getQueryInterface();
  let table: any = null;
  try {
    table = await queryInterface.describeTable('login_logs');
  } catch (error: any) {
    if (isMissingLoginLogsTableError(error)) {
      await queryInterface.createTable('login_logs', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        tenant_id: { type: DataTypes.INTEGER, allowNull: true },
        company_id: { type: DataTypes.INTEGER, allowNull: true },
        user_id: { type: DataTypes.INTEGER, allowNull: true },
        userid: { type: DataTypes.STRING(100), allowNull: true },
        status: { type: DataTypes.ENUM('success', 'failure'), allowNull: false, defaultValue: 'success' },
        event_type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'login' },
        reason: { type: DataTypes.STRING(255), allowNull: true },
        resource: { type: DataTypes.STRING(120), allowNull: true },
        ip_address: { type: DataTypes.STRING(64), allowNull: true },
        user_agent: { type: DataTypes.STRING(500), allowNull: true },
        logged_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
      });
      loginLogsSchemaEnsured = true;
      return;
    }
    throw error;
  }

  const ensureColumn = async (columnName: string, definition: any) => {
    if (!table?.[columnName]) {
      await queryInterface.addColumn('login_logs', columnName, definition);
    }
  };

  await ensureColumn('tenant_id', { type: DataTypes.INTEGER, allowNull: true });
  await ensureColumn('company_id', { type: DataTypes.INTEGER, allowNull: true });
  await ensureColumn('user_id', { type: DataTypes.INTEGER, allowNull: true });
  await ensureColumn('userid', { type: DataTypes.STRING(100), allowNull: true });
  await ensureColumn('status', {
    type: DataTypes.ENUM('success', 'failure'),
    allowNull: false,
    defaultValue: 'success'
  });
  await ensureColumn('event_type', {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'login'
  });
  await ensureColumn('reason', { type: DataTypes.STRING(255), allowNull: true });
  await ensureColumn('resource', { type: DataTypes.STRING(120), allowNull: true });
  await ensureColumn('ip_address', { type: DataTypes.STRING(64), allowNull: true });
  await ensureColumn('user_agent', { type: DataTypes.STRING(500), allowNull: true });
  await ensureColumn('logged_at', { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW });
  loginLogsSchemaEnsured = true;
};

const validateLoginInfoPayload = (payload: any, isUpdate = false) => {
  const errors: string[] = [];
  const hasField = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);

  const division = hasField('division') ? trimString(payload.division) : '';
  const loginId = hasField('login_id') ? trimString(payload.login_id) : '';
  const password = hasField('password') ? trimString(payload.password) : '';
  const url = hasField('url') ? trimString(payload.url) : '';

  if (!isUpdate) {
    if (!payload.company_id) {
      errors.push('company_id는 필수입니다.');
    }
    if (!division) {
      errors.push('division은 필수입니다.');
    }
    if (!loginId) {
      errors.push('login_id는 필수입니다.');
    }
    if (!password) {
      errors.push('password는 필수입니다.');
    }
  }

  const fieldsToValidate = [
    { key: 'division', value: division },
    { key: 'login_id', value: loginId },
    { key: 'password', value: password },
    { key: 'open_file_returns', value: hasField('open_file_returns') ? trimString(payload.open_file_returns) : '' },
    { key: 'url', value: url }
  ];

  for (const field of fieldsToValidate) {
    if (field.value && field.value.length > 200) {
      errors.push(`${field.key}는 200자 이하로 입력해주세요.`);
    }
  }

  let normalizedExtra: Record<string, string> | null | undefined;
  if (hasField('extra_fields')) {
    if (payload.extra_fields === null) {
      normalizedExtra = null;
    } else if (typeof payload.extra_fields !== 'object' || Array.isArray(payload.extra_fields)) {
      errors.push('extra_fields 형식이 올바르지 않습니다.');
    } else {
      for (const [k, v] of Object.entries(payload.extra_fields as Record<string, unknown>)) {
        if (!CUSTOM_COL_ID_RE.test(k)) {
          errors.push('extra_fields 키 형식이 올바르지 않습니다.');
          break;
        }
        if (trimString(v).length > 500) {
          errors.push('커스텀 열 값은 500자 이하로 입력해주세요.');
          break;
        }
      }
      if (!errors.length) {
        normalizedExtra = normalizeExtraFieldsPayload(payload.extra_fields);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalized: {
      division,
      login_id: loginId,
      password,
      open_file_returns: hasField('open_file_returns') ? trimString(payload.open_file_returns) : undefined,
      url: url || undefined,
      extra_fields: normalizedExtra
    }
  };
};

// 회사별 로그인 정보 탭 목록 (없으면 기본 탭 생성)
router.get('/tabs', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const companyId = req.query.company_id ? Number(req.query.company_id) : NaN;

    if (!companyId || Number.isNaN(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'company_id가 필요합니다.'
      });
    }

    const isValidCompany = await ensureCompanyInTenant(companyId, tenantId);
    if (!isValidCompany) {
      return res.status(403).json({
        success: false,
        message: '해당 회사에 대한 접근 권한이 없습니다.'
      });
    }

    await ensureDefaultTabsForCompany(companyId, tenantId);

    const tabs = await (LoginInfoTab as any).findAll({
      where: { company_id: companyId, tenant_id: tenantId },
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC']
      ]
    });

    res.json({ success: true, data: tabs });
  } catch (error: any) {
    console.error('로그인 정보 탭 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '탭 목록을 불러오지 못했습니다.'
    });
  }
});

router.post('/tabs', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const companyId = Number(req.body.company_id);
    const name = trimString(req.body.name);

    if (!companyId || Number.isNaN(companyId)) {
      return res.status(400).json({ success: false, message: 'company_id가 올바르지 않습니다.' });
    }
    if (!name || name.length > 120) {
      return res.status(400).json({ success: false, message: '탭 이름은 1~120자로 입력해주세요.' });
    }

    const isValidCompany = await ensureCompanyInTenant(companyId, tenantId);
    if (!isValidCompany) {
      return res.status(403).json({ success: false, message: '해당 회사에 대한 접근 권한이 없습니다.' });
    }

    const maxRow = await (LoginInfoTab as any).findOne({
      where: { company_id: companyId, tenant_id: tenantId },
      order: [['sort_order', 'DESC']],
      attributes: ['sort_order']
    });
    const sortOrder = maxRow ? Number(maxRow.sort_order) + 1 : 0;

    const created = await (LoginInfoTab as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      name,
      sort_order: sortOrder
    });

    res.status(201).json({ success: true, message: '탭이 추가되었습니다.', data: created });
  } catch (error: any) {
    console.error('로그인 정보 탭 추가 오류:', error);
    res.status(500).json({ success: false, message: '탭 추가 중 오류가 발생했습니다.' });
  }
});

router.put('/tabs/:tabId', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tabId = Number(req.params.tabId);
    const hasName = Object.prototype.hasOwnProperty.call(req.body, 'name');
    const hasColumnHeaders = Object.prototype.hasOwnProperty.call(req.body, 'column_headers');
    const hasColumnHidden = Object.prototype.hasOwnProperty.call(req.body, 'column_hidden');
    const hasColumnSchema = Object.prototype.hasOwnProperty.call(req.body, 'column_schema');

    if (Number.isNaN(tabId)) {
      return res.status(400).json({ success: false, message: 'tab_id가 올바르지 않습니다.' });
    }
    if (!hasName && !hasColumnHeaders && !hasColumnHidden && !hasColumnSchema) {
      return res.status(400).json({
        success: false,
        message: 'name, column_headers, column_hidden, column_schema 중 하나 이상이 필요합니다.'
      });
    }

    const tab = await (LoginInfoTab as any).findOne({
      where: { id: tabId, tenant_id: tenantId }
    });
    if (!tab) {
      return res.status(404).json({ success: false, message: '탭을 찾을 수 없습니다.' });
    }

    const updates: Record<string, unknown> = {};

    if (hasName) {
      const name = trimString(req.body.name);
      if (!name || name.length > 120) {
        return res.status(400).json({ success: false, message: '탭 이름은 1~120자로 입력해주세요.' });
      }
      updates.name = name;
    }

    if (hasColumnHeaders) {
      if (req.body.column_headers === null) {
        updates.column_headers = null;
      } else {
        const merged = mergeColumnHeaders(tab.column_headers, req.body.column_headers);
        if (isColumnHeadersMergeError(merged)) {
          return res.status(400).json({ success: false, message: merged.message });
        }
        updates.column_headers =
          Object.keys(merged.value).length > 0 ? merged.value : null;
      }
    }

    if (hasColumnHidden) {
      if (req.body.column_hidden === null) {
        updates.column_hidden = null;
      } else {
        const norm = normalizeColumnHidden(req.body.column_hidden);
        if (isColumnHiddenNormalizeError(norm)) {
          return res.status(400).json({ success: false, message: norm.message });
        }
        updates.column_hidden = norm.value.length > 0 ? norm.value : null;
      }
    }

    if (hasColumnSchema) {
      if (req.body.column_schema === null) {
        updates.column_schema = null;
        updates.column_hidden = null;
      } else {
        const norm = normalizeColumnSchema(req.body.column_schema);
        if (isColumnSchemaNormalizeError(norm)) {
          return res.status(400).json({ success: false, message: norm.message });
        }
        const oldSchema = getEffectiveColumnSchema(tab);
        await applyColumnSchemaRemovals(tabId, tenantId, oldSchema, norm.value);
        updates.column_schema = norm.value;
        updates.column_hidden = null;
      }
    }

    await tab.update(updates);
    await tab.reload();
    res.json({
      success: true,
      message: '저장되었습니다.',
      data: tab
    });
  } catch (error: any) {
    console.error('로그인 정보 탭 수정 오류:', error);
    res.status(500).json({ success: false, message: '탭 수정 중 오류가 발생했습니다.' });
  }
});

router.delete('/tabs/:tabId', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tabId = Number(req.params.tabId);

    if (Number.isNaN(tabId)) {
      return res.status(400).json({ success: false, message: 'tab_id가 올바르지 않습니다.' });
    }

    const tab = await (LoginInfoTab as any).findOne({
      where: { id: tabId, tenant_id: tenantId }
    });
    if (!tab) {
      return res.status(404).json({ success: false, message: '탭을 찾을 수 없습니다.' });
    }

    const countTabs = await (LoginInfoTab as any).count({
      where: { company_id: tab.company_id, tenant_id: tenantId }
    });
    if (countTabs <= 1) {
      return res.status(400).json({
        success: false,
        message: '마지막 탭은 삭제할 수 없습니다.'
      });
    }

    await tab.destroy();

    res.json({ success: true, message: '탭이 삭제되었습니다.' });
  } catch (error: any) {
    console.error('로그인 정보 탭 삭제 오류:', error);
    res.status(500).json({ success: false, message: '탭 삭제 중 오류가 발생했습니다.' });
  }
});

// 로그인 정보 목록 조회 (회사 + 탭 필수)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    const tabId = req.query.tab_id ? Number(req.query.tab_id) : null;

    if (companyId && Number.isNaN(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'company_id가 올바르지 않습니다.'
      });
    }

    if (companyId && (!tabId || Number.isNaN(tabId))) {
      return res.status(400).json({
        success: false,
        message: 'tab_id가 필요합니다.'
      });
    }

    const whereClause: any = { tenant_id: tenantId };

    if (companyId) {
      const isValidCompany = await ensureCompanyInTenant(companyId, tenantId);
      if (!isValidCompany) {
        return res.status(403).json({
          success: false,
          message: '해당 회사에 대한 접근 권한이 없습니다.'
        });
      }
      const tab = await assertTabForCompany(tabId!, companyId, tenantId);
      if (!tab) {
        return res.status(403).json({
          success: false,
          message: '해당 탭에 대한 접근 권한이 없습니다.'
        });
      }
      whereClause.company_id = companyId;
      whereClause.tab_id = tabId;
    } else if (tabId) {
      return res.status(400).json({
        success: false,
        message: 'company_id와 함께 tab_id를 지정해주세요.'
      });
    }

    const loginInfos = await (LoginInfo as any).findAll({
      where: whereClause,
      order: [['id', 'ASC']]
    });

    res.json({
      success: true,
      data: loginInfos
    });
  } catch (error: any) {
    console.error('로그인 정보 목록 조회 오류:', error);
    res.status(200).json({
      success: true,
      message: '데이터가 없습니다.',
      data: []
    });
  }
});

// 로그인 로그 목록 조회
router.get('/logs', async (req: AuthRequest, res) => {
  try {
    await ensureLoginLogsSchema();
    const tenantId = req.user.tenant_id;
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    const status = String(req.query.status || '').trim().toLowerCase();
    const eventType = String(req.query.event_type || '').trim().toLowerCase();
    const userid = String(req.query.userid || '').trim();
    const startDate = String(req.query.start_date || '').trim();
    const endDate = String(req.query.end_date || '').trim();
    const rawLimit = req.query.limit ? Number(req.query.limit) : 200;
    const limit = Number.isNaN(rawLimit) ? 200 : Math.max(1, Math.min(rawLimit, 1000));

    if (companyId && Number.isNaN(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'company_id가 올바르지 않습니다.'
      });
    }

    if (status && status !== 'success' && status !== 'failure') {
      return res.status(400).json({
        success: false,
        message: 'status는 success 또는 failure만 가능합니다.'
      });
    }

    const allowedEventTypes = new Set(['login', 'logout', 'delete', 'create', 'update', 'security']);
    if (eventType && !allowedEventTypes.has(eventType)) {
      return res.status(400).json({
        success: false,
        message: 'event_type이 올바르지 않습니다.'
      });
    }

    const whereClause: any = { tenant_id: tenantId };
    if (companyId) {
      const isValidCompany = await ensureCompanyInTenant(companyId, tenantId);
      if (!isValidCompany) {
        return res.status(403).json({
          success: false,
          message: '해당 회사에 대한 접근 권한이 없습니다.'
        });
      }
      whereClause.company_id = companyId;
    }

    if (status) {
      whereClause.status = status;
    }

    if (eventType) {
      whereClause.event_type = eventType;
    }

    if (userid) {
      whereClause.userid = { [Op.iLike]: `%${userid}%` };
    }

    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) {
        dateFilter[Op.gte] = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        dateFilter[Op.lte] = new Date(`${endDate}T23:59:59.999Z`);
      }
      whereClause.logged_at = dateFilter;
    }

    const logs = await (LoginLog as any).findAll({
      where: whereClause,
      order: [['logged_at', 'DESC'], ['id', 'DESC']],
      limit
    });

    const userIds = Array.from(
      new Set(
        logs
          .map((log: any) => log.user_id)
          .filter((id: unknown) => typeof id === 'number')
      )
    ) as number[];

    let usersById = new Map<number, { id: number; username?: string; userid?: string }>();
    if (userIds.length > 0) {
      const users = await (User as any).findAll({
        where: { id: userIds },
        attributes: ['id', 'username', 'userid']
      });
      usersById = new Map(
        users.map((user: any) => [
          user.id,
          { id: user.id, username: user.username, userid: user.userid }
        ])
      );
    }

    const mergedLogs = logs.map((log: any) => ({
      ...log.toJSON(),
      user: log.user_id ? usersById.get(log.user_id) || null : null
    }));

    res.json({
      success: true,
      data: mergedLogs
    });
  } catch (error: any) {
    console.error('로그인 로그 목록 조회 오류:', error);
    if (isMissingLoginLogsTableError(error)) {
      return res.json({
        success: true,
        message: '로그인 로그 테이블이 아직 준비되지 않았습니다.',
        data: []
      });
    }
    res.status(500).json({
      success: false,
      message: '로그인 로그를 불러오지 못했습니다.'
    });
  }
});

// 로그인 정보 엑셀 가져오기
router.post('/import', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const companyId = Number(req.body.company_id);
    const tabId = Number(req.body.tab_id);

    if (!companyId || Number.isNaN(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'company_id가 올바르지 않습니다.'
      });
    }
    if (!tabId || Number.isNaN(tabId)) {
      return res.status(400).json({
        success: false,
        message: 'tab_id가 올바르지 않습니다.'
      });
    }

    const isValidCompany = await ensureCompanyInTenant(companyId, tenantId);
    if (!isValidCompany) {
      return res.status(403).json({
        success: false,
        message: '해당 회사에 대한 접근 권한이 없습니다.'
      });
    }

    const tab = await assertTabForCompany(tabId, companyId, tenantId);
    if (!tab) {
      return res.status(403).json({
        success: false,
        message: '해당 탭에 대한 접근 권한이 없습니다.'
      });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: '엑셀 파일이 필요합니다.'
      });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: '엑셀 파일에 데이터가 없습니다.'
      });
    }

    const headerRow = rows[0].map((cell: any) => String(cell || ''));

    const divisionIndex = resolveColumnIndex(headerRow, ['division', '구분'], 1);
    const loginIdIndex = resolveColumnIndex(headerRow, ['loginid', 'login_id', '로그인id', '로그인아이디'], 2);
    const passwordIndex = resolveColumnIndex(headerRow, ['password', '비밀번호'], 3);
    const openFileIndex = resolveColumnIndex(headerRow, ['toopenfiledreturns', 'toopenfilereturns', 'openfilereturns', '비고'], 4);
    const urlIndex = resolveColumnIndex(headerRow, ['url', '링크'], 5);

    const dataRows = rows.slice(1);
    const entries = [];
    let skipped = 0;

    for (const row of dataRows) {
      const division = getCellValue(row, divisionIndex);
      const login_id = getCellValue(row, loginIdIndex);
      const password = getCellValue(row, passwordIndex);
      const open_file_returns = getCellValue(row, openFileIndex);
      const url = getCellValue(row, urlIndex);

      if (!division || !login_id || !password) {
        skipped += 1;
        continue;
      }

      entries.push({
        tenant_id: tenantId,
        company_id: companyId,
        tab_id: tabId,
        division,
        login_id,
        password,
        open_file_returns: open_file_returns || null,
        url: url || null,
        created_by: userId,
        updated_by: userId
      });
    }

    if (!entries.length) {
      return res.status(400).json({
        success: false,
        message: '가져올 수 있는 유효한 데이터가 없습니다.'
      });
    }

    const created = await (LoginInfo as any).bulkCreate(entries);

    res.status(201).json({
      success: true,
      message: '엑셀 가져오기가 완료되었습니다.',
      data: {
        created: created.length,
        skipped
      }
    });
  } catch (error: any) {
    console.error('로그인 정보 엑셀 가져오기 오류:', error);
    res.status(500).json({
      success: false,
      message: '엑셀 가져오기 중 오류가 발생했습니다.'
    });
  }
});

// 로그인 정보 생성
router.post('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const { company_id } = req.body;
    const tabId = Number(req.body.tab_id);
    const validation = validateLoginInfoPayload(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors[0]
      });
    }

    if (!tabId || Number.isNaN(tabId)) {
      return res.status(400).json({
        success: false,
        message: 'tab_id가 올바르지 않습니다.'
      });
    }

    const isValidCompany = await ensureCompanyInTenant(Number(company_id), tenantId);
    if (!isValidCompany) {
      return res.status(403).json({
        success: false,
        message: '해당 회사에 대한 접근 권한이 없습니다.'
      });
    }

    const tab = await assertTabForCompany(tabId, Number(company_id), tenantId);
    if (!tab) {
      return res.status(403).json({
        success: false,
        message: '해당 탭에 대한 접근 권한이 없습니다.'
      });
    }

    const created = await (LoginInfo as any).create({
      tenant_id: tenantId,
      company_id,
      tab_id: tabId,
      division: validation.normalized.division,
      login_id: validation.normalized.login_id,
      password: validation.normalized.password,
      open_file_returns: validation.normalized.open_file_returns || null,
      url: validation.normalized.url || null,
      extra_fields: validation.normalized.extra_fields ?? null,
      created_by: userId,
      updated_by: userId
    });

    res.status(201).json({
      success: true,
      message: '로그인 정보가 등록되었습니다.',
      data: created
    });
  } catch (error: any) {
    console.error('로그인 정보 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그인 정보 생성 중 오류가 발생했습니다.'
    });
  }
});

// 로그인 정보 수정
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const { id } = req.params;
    const validation = validateLoginInfoPayload(req.body, true);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors[0]
      });
    }

    const loginInfo = await (LoginInfo as any).findOne({
      where: { id: Number(id), tenant_id: tenantId }
    });

    if (!loginInfo) {
      return res.status(404).json({
        success: false,
        message: '로그인 정보를 찾을 수 없습니다.'
      });
    }

    if (req.body.company_id) {
      const isValidCompany = await ensureCompanyInTenant(Number(req.body.company_id), tenantId);
      if (!isValidCompany) {
        return res.status(403).json({
          success: false,
          message: '해당 회사에 대한 접근 권한이 없습니다.'
        });
      }
    }

    const updates: any = {
      updated_by: userId
    };
    if (Object.prototype.hasOwnProperty.call(req.body, 'division')) {
      updates.division = validation.normalized.division;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'login_id')) {
      updates.login_id = validation.normalized.login_id;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'password')) {
      updates.password = validation.normalized.password;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'open_file_returns')) {
      updates.open_file_returns = validation.normalized.open_file_returns || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'url')) {
      updates.url = validation.normalized.url || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'extra_fields')) {
      updates.extra_fields = validation.normalized.extra_fields ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'company_id')) {
      updates.company_id = Number(req.body.company_id);
    }

    await loginInfo.update(updates);

    res.json({
      success: true,
      message: '로그인 정보가 수정되었습니다.',
      data: loginInfo
    });
  } catch (error: any) {
    console.error('로그인 정보 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그인 정보 수정 중 오류가 발생했습니다.'
    });
  }
});

// 로그인 정보 삭제
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const loginInfo = await (LoginInfo as any).findOne({
      where: { id: Number(id), tenant_id: tenantId }
    });

    if (!loginInfo) {
      return res.status(404).json({
        success: false,
        message: '로그인 정보를 찾을 수 없습니다.'
      });
    }

    await loginInfo.destroy();

    res.json({
      success: true,
      message: '로그인 정보가 삭제되었습니다.'
    });
  } catch (error: any) {
    console.error('로그인 정보 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그인 정보 삭제 중 오류가 발생했습니다.'
    });
  }
});

export default router;
