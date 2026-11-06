import { Response } from 'express';
import { Op } from 'sequelize';
import { RequestWithUser } from '../types';
import {
  Customer,
  Partner,
  RecurringBoardClient,
  RecurringTaskAssignment,
  RecurringTaskInstance,
  RecurringTaskTemplate,
  User,
  WorkBoardMember,
} from '../models';
import { findBoardForUser } from './workBoardController';
import sequelize from '../config/database';
import { DataTypes } from 'sequelize';
import path from 'path';
import fs from 'fs';
import { ensureUploadRoot } from '../utils/uploadPath';
import {
  currentPeriod,
  frequencyAppliesToPeriod,
  generateRecurringInstancesForAllBoards,
  generateRecurringInstancesForBoard,
  parsePeriod,
} from '../services/recurringTaskGenerateService';

const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUALLY', 'CUSTOM'] as const;
const INSTANCE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'NOT_APPLICABLE'] as const;
type InstanceStatus = (typeof INSTANCE_STATUSES)[number];

const SAMPLE_TEMPLATES: Array<{
  name: string;
  code: string;
  category: string;
  frequency: (typeof FREQUENCIES)[number];
  requires_attachment?: boolean;
  requires_verification?: boolean;
}> = [
  { name: 'TDS Payment', code: 'TDS_PAY', category: 'TDS', frequency: 'MONTHLY', requires_attachment: true },
  { name: 'GSTR-1 Filing', code: 'GSTR1', category: 'GST', frequency: 'MONTHLY', requires_attachment: true },
  { name: 'GSTR-3B Filing', code: 'GSTR3B', category: 'GST', frequency: 'MONTHLY', requires_attachment: true, requires_verification: true },
  { name: 'Payroll Processing', code: 'PAYROLL', category: 'Payroll', frequency: 'MONTHLY' },
  { name: 'PF ECR Filing', code: 'PF_ECR', category: 'PF', frequency: 'MONTHLY', requires_attachment: true },
  { name: 'ESI Contribution', code: 'ESI', category: 'ESI', frequency: 'MONTHLY' },
  { name: 'Professional Tax Payment', code: 'PT', category: 'PT', frequency: 'MONTHLY' },
  { name: 'TDS Return', code: 'TDS', category: 'TDS', frequency: 'QUARTERLY', requires_attachment: true },
  { name: 'GSTR-9', code: 'GSTR9', category: 'GST', frequency: 'ANNUALLY', requires_verification: true },
  { name: 'ROC Annual Filing', code: 'ROC', category: 'ROC', frequency: 'ANNUALLY', requires_attachment: true },
  { name: 'Income Tax Return', code: 'ITR', category: 'Income Tax', frequency: 'ANNUALLY' },
];

/** 샘플 템플릿 코드를 SAMPLE_TEMPLATES 순서로 sort_order 맞춤 */
async function syncSampleTemplateSortOrder(boardId: number) {
  const rows = await RecurringTaskTemplate.findAll({
    where: { board_id: boardId, is_active: true },
    attributes: ['id', 'code', 'sort_order'],
  });
  const byCode = new Map(
    rows
      .map((r) => [String(r.code || '').toUpperCase(), r] as const)
      .filter(([code]) => Boolean(code))
  );
  let order = 0;
  for (const sample of SAMPLE_TEMPLATES) {
    const row = byCode.get(sample.code.toUpperCase());
    if (!row) continue;
    if (Number(row.sort_order) !== order) {
      await row.update({ sort_order: order });
    }
    order += 1;
  }
}

let schemaEnsured = false;
let attachmentsColumnEnsured = false;

const RECURRING_INSTANCE_MAX_ATTACHMENTS = 10;

type InstanceAttachmentRecord = {
  originalName: string;
  storedName: string;
  path: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
};

const normalizeInstanceAttachments = (raw: unknown): InstanceAttachmentRecord[] => {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      const storedName = String(item.storedName || item.stored_name || '').trim();
      const pathRaw = String(item.path || '').trim();
      const originalName = String(item.originalName || item.original_name || storedName || 'attachment').trim();
      const pathValue = (pathRaw || (storedName ? `recurring-instances/${storedName}` : ''))
        .replace(/^\/+/, '')
        .replace(/^uploads\//i, '');
      if (!pathValue) return null;
      return {
        originalName,
        storedName: storedName || path.basename(pathValue),
        path: pathValue,
        mimeType:
          item.mimeType != null || item.mime_type != null
            ? String(item.mimeType || item.mime_type)
            : undefined,
        size: item.size != null && Number.isFinite(Number(item.size)) ? Number(item.size) : undefined,
        uploadedAt:
          item.uploadedAt != null || item.uploaded_at != null
            ? String(item.uploadedAt || item.uploaded_at)
            : undefined,
      } satisfies InstanceAttachmentRecord;
    })
    .filter(Boolean) as InstanceAttachmentRecord[];
};

async function ensureRecurringSchema() {
  const qi = sequelize.getQueryInterface();
  if (!schemaEnsured) {
  const tables = await qi.showAllTables();
  const names = tables
    .map((t: any) => String(typeof t === 'string' ? t : t.tableName || t.name || '').toLowerCase());

  if (!names.includes('recurring_task_templates')) {
    await qi.createTable('recurring_task_templates', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      company_id: { type: DataTypes.INTEGER, allowNull: false },
      board_id: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING(200), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      category: { type: DataTypes.STRING(100), allowNull: true },
      frequency: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MONTHLY' },
      default_priority: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'medium' },
      default_due_day: { type: DataTypes.INTEGER, allowNull: true },
      requires_attachment: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      requires_verification: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });
  }
  if (!names.includes('recurring_board_clients')) {
    await qi.createTable('recurring_board_clients', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      company_id: { type: DataTypes.INTEGER, allowNull: false },
      board_id: { type: DataTypes.INTEGER, allowNull: false },
      customer_id: { type: DataTypes.INTEGER, allowNull: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });
  }
  if (!names.includes('recurring_task_assignments')) {
    await qi.createTable('recurring_task_assignments', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      company_id: { type: DataTypes.INTEGER, allowNull: false },
      board_id: { type: DataTypes.INTEGER, allowNull: false },
      customer_id: { type: DataTypes.INTEGER, allowNull: false },
      template_id: { type: DataTypes.INTEGER, allowNull: false },
      assigned_user_id: { type: DataTypes.INTEGER, allowNull: true },
      reviewer_user_id: { type: DataTypes.INTEGER, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });
  }
  if (!names.includes('recurring_task_instances')) {
    await qi.createTable('recurring_task_instances', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      company_id: { type: DataTypes.INTEGER, allowNull: false },
      board_id: { type: DataTypes.INTEGER, allowNull: false },
      template_id: { type: DataTypes.INTEGER, allowNull: false },
      customer_id: { type: DataTypes.INTEGER, allowNull: false },
      period: { type: DataTypes.STRING(7), allowNull: false },
      period_start: { type: DataTypes.DATEONLY, allowNull: false },
      period_end: { type: DataTypes.DATEONLY, allowNull: false },
      due_date: { type: DataTypes.DATEONLY, allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      assigned_user_id: { type: DataTypes.INTEGER, allowNull: true },
      reviewer_user_id: { type: DataTypes.INTEGER, allowNull: true },
      completed_by: { type: DataTypes.INTEGER, allowNull: true },
      completed_at: { type: DataTypes.DATE, allowNull: true },
      verified_by: { type: DataTypes.INTEGER, allowNull: true },
      verified_at: { type: DataTypes.DATE, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
      attachments: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    });
  }
  schemaEnsured = true;
  }

  if (!attachmentsColumnEnsured) {
    try {
      const desc: any = await qi.describeTable('recurring_task_instances');
      if (desc && !desc.attachments) {
        await qi.addColumn('recurring_task_instances', 'attachments', {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
        });
      }
    } catch (e) {
      console.warn('ensureRecurringSchema attachments:', e);
    }
    attachmentsColumnEnsured = true;
  }
}

type LoadRecurringBoardResult = {
  board: any | null;
  member: any | null;
  error: 'not_found' | 'not_recurring' | null;
};

async function loadRecurringBoard(
  boardId: number,
  user: RequestWithUser['user'],
  forWrite = false
): Promise<LoadRecurringBoardResult> {
  await ensureRecurringSchema();
  const { board, member } = await findBoardForUser(boardId, user, forWrite);
  if (!board) return { board: null, member: null, error: 'not_found' };
  if (String((board as any).board_type || 'GENERAL').toUpperCase() !== 'RECURRING') {
    return { board: null, member: null, error: 'not_recurring' };
  }
  return { board, member, error: null };
}

function canManageRecurring(user: RequestWithUser['user'], member: any): boolean {
  if (user?.role === 'root') return true;
  return member?.role === 'owner';
}

function normalizeFrequency(value: unknown): (typeof FREQUENCIES)[number] {
  const raw = String(value || 'MONTHLY').trim().toUpperCase();
  return (FREQUENCIES as readonly string[]).includes(raw)
    ? (raw as (typeof FREQUENCIES)[number])
    : 'MONTHLY';
}

function normalizeInstanceStatus(value: unknown): InstanceStatus | null {
  const raw = String(value || '').trim().toUpperCase();
  return (INSTANCE_STATUSES as readonly string[]).includes(raw) ? (raw as InstanceStatus) : null;
}

function todayYmd(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function isOverdue(status: string, dueDate?: string | null): boolean {
  if (!dueDate) return false;
  if (status === 'COMPLETED' || status === 'VERIFIED' || status === 'NOT_APPLICABLE') return false;
  return String(dueDate) < todayYmd();
}

async function loadInstanceIncludes(instanceId: number) {
  return RecurringTaskInstance.findByPk(instanceId, {
    include: [
      {
        model: RecurringTaskTemplate,
        as: 'template',
        attributes: [
          'id',
          'name',
          'code',
          'frequency',
          'category',
          'requires_attachment',
          'requires_verification',
          'default_due_day',
        ],
      },
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'business_number'] },
      { model: User, as: 'assignee', attributes: ['id', 'username', 'userid', 'avatar_url'] },
      { model: User, as: 'reviewer', attributes: ['id', 'username', 'userid', 'avatar_url'] },
    ],
  });
}

function serializeInstance(row: any) {
  const data: any = typeof row?.toJSON === 'function' ? row.toJSON() : { ...row };
  data.attachments = normalizeInstanceAttachments(data.attachments);
  data.attachment_count = data.attachments.length;
  data.is_overdue = isOverdue(data.status, data.due_date);
  return data;
}

/** 체크리스트/상세에 배정 담당을 반영 (인스턴스에 아직 안 심어진 경우) */
function applyAssignmentToInstanceJson(json: any, assignment: any | null | undefined) {
  if (!assignment) return json;
  if (
    (json.assigned_user_id == null || Number(json.assigned_user_id) <= 0) &&
    assignment.assigned_user_id != null &&
    Number(assignment.assigned_user_id) > 0
  ) {
    json.assigned_user_id = Number(assignment.assigned_user_id);
    if (assignment.assignee) json.assignee = assignment.assignee;
  }
  if (
    (json.reviewer_user_id == null || Number(json.reviewer_user_id) <= 0) &&
    assignment.reviewer_user_id != null &&
    Number(assignment.reviewer_user_id) > 0
  ) {
    json.reviewer_user_id = Number(assignment.reviewer_user_id);
    if (assignment.reviewer) json.reviewer = assignment.reviewer;
  }
  return json;
}

/** 담당 배정 저장 시 기존 인스턴스에도 담당/검토자 동기화 */
async function syncInstancesFromAssignment(
  boardId: number,
  customerId: number,
  templateId: number,
  assignedUserId: number | null,
  reviewerUserId: number | null
) {
  await RecurringTaskInstance.update(
    {
      assigned_user_id: assignedUserId,
      reviewer_user_id: reviewerUserId,
    },
    {
      where: {
        board_id: boardId,
        customer_id: customerId,
        template_id: templateId,
      },
    }
  );
}

async function canEditInstance(
  user: RequestWithUser['user'],
  member: any,
  row: RecurringTaskInstance
): Promise<{ ok: boolean; manage: boolean; isAssignee: boolean; isReviewer: boolean }> {
  const manage = canManageRecurring(user, member);
  const isAssignee = row.assigned_user_id != null && Number(row.assigned_user_id) === Number(user!.id);
  const isReviewer = row.reviewer_user_id != null && Number(row.reviewer_user_id) === Number(user!.id);
  const ok = manage || isAssignee || isReviewer || user!.role === 'audit' || user!.role === 'root';
  return { ok, manage, isAssignee, isReviewer };
}

/** GET /boards/:boardId/recurring/overview */
export const getRecurringOverview = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const loaded = await loadRecurringBoard(boardId, req.user!);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }
    const board = loaded.board!;
    await syncSampleTemplateSortOrder(board.id);

    const [templates, clients, assignments, members] = await Promise.all([
      RecurringTaskTemplate.findAll({
        where: { board_id: board.id, is_active: true },
        order: [
          ['sort_order', 'ASC'],
          ['id', 'ASC'],
        ],
      }),
      RecurringBoardClient.findAll({
        where: { board_id: board.id, is_active: true },
        include: [
          {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'name', 'business_number', 'status'],
          },
        ],
        order: [['id', 'ASC']],
      }),
      RecurringTaskAssignment.findAll({
        where: { board_id: board.id, is_active: true },
        include: [
          { model: RecurringTaskTemplate, as: 'template', attributes: ['id', 'name', 'code', 'frequency', 'category'] },
          { model: Customer, as: 'customer', attributes: ['id', 'name'] },
          { model: User, as: 'assignee', attributes: ['id', 'username', 'userid', 'avatar_url'] },
          { model: User, as: 'reviewer', attributes: ['id', 'username', 'userid', 'avatar_url'] },
        ],
        order: [['id', 'ASC']],
      }),
      WorkBoardMember.findAll({
        where: { board_id: board.id },
        include: [{ model: User, as: 'user', attributes: ['id', 'username', 'userid', 'email', 'avatar_url'] }],
        order: [
          [
            sequelize.literal(`CASE "WorkBoardMember"."role" WHEN 'owner' THEN 0 ELSE 1 END`),
            'ASC',
          ],
          ['id', 'ASC'],
        ],
      }),
    ]);

    res.json({
      success: true,
      data: {
        board: {
          id: board.id,
          name: board.name,
          description: board.description,
          board_type: board.board_type,
          board_color: board.board_color,
          company_id: board.company_id,
          created_by: board.created_by,
        },
        my_role: loaded.member?.role || (req.user!.role === 'root' || req.user!.role === 'audit' ? 'admin' : null),
        /** 정기 업무 마스터(=보드 owner)만 템플릿·고객사·담당 배정 변경 */
        can_manage: canManageRecurring(req.user!, loaded.member),
        templates,
        clients,
        assignments,
        members,
      },
    });
  } catch (error: any) {
    console.error('getRecurringOverview:', error);
    res.status(500).json({
      success: false,
      message: '정기 업무 설정을 불러오지 못했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** POST /boards/:boardId/recurring/templates */
export const createRecurringTemplate = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }
    if (!canManageRecurring(req.user!, loaded.member)) {
      return res.status(403).json({ success: false, message: '템플릿을 관리할 권한이 없습니다.' });
    }
    const board = loaded.board!;
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: '업무명을 입력하세요.' });

    const maxOrder =
      (await RecurringTaskTemplate.max('sort_order', { where: { board_id: board.id } })) ?? -1;

    const row = await RecurringTaskTemplate.create({
      tenant_id: board.tenant_id,
      company_id: board.company_id,
      board_id: board.id,
      name: name.slice(0, 200),
      code: req.body.code ? String(req.body.code).trim().slice(0, 50) : null,
      description: req.body.description ? String(req.body.description).trim() : null,
      category: req.body.category ? String(req.body.category).trim().slice(0, 100) : null,
      frequency: normalizeFrequency(req.body.frequency),
      default_priority: String(req.body.default_priority || 'medium').slice(0, 20),
      default_due_day:
        req.body.default_due_day != null && Number(req.body.default_due_day) > 0
          ? Math.min(31, Number(req.body.default_due_day))
          : null,
      requires_attachment: Boolean(req.body.requires_attachment),
      requires_verification: Boolean(req.body.requires_verification),
      sort_order: Number(maxOrder) + 1,
      is_active: true,
      created_by: req.user!.id,
    });

    res.status(201).json({ success: true, data: row });
  } catch (error: any) {
    console.error('createRecurringTemplate:', error);
    res.status(500).json({ success: false, message: '템플릿을 만들지 못했습니다.' });
  }
};

/** PUT /boards/:boardId/recurring/templates/:templateId */
export const updateRecurringTemplate = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const templateId = Number(req.params.templateId);
    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }
    if (!canManageRecurring(req.user!, loaded.member)) {
      return res.status(403).json({ success: false, message: '템플릿을 관리할 권한이 없습니다.' });
    }

    const row = await RecurringTaskTemplate.findOne({
      where: { id: templateId, board_id: boardId },
    });
    if (!row) return res.status(404).json({ success: false, message: '템플릿을 찾을 수 없습니다.' });

    const patch: Record<string, any> = {};
    if (req.body.name != null) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: '업무명을 입력하세요.' });
      patch.name = name.slice(0, 200);
    }
    if (req.body.code !== undefined) {
      patch.code = req.body.code ? String(req.body.code).trim().slice(0, 50) : null;
    }
    if (req.body.description !== undefined) {
      patch.description = req.body.description ? String(req.body.description).trim() : null;
    }
    if (req.body.category !== undefined) {
      patch.category = req.body.category ? String(req.body.category).trim().slice(0, 100) : null;
    }
    if (req.body.frequency != null) patch.frequency = normalizeFrequency(req.body.frequency);
    if (req.body.default_priority != null) {
      patch.default_priority = String(req.body.default_priority).slice(0, 20);
    }
    if (req.body.default_due_day !== undefined) {
      patch.default_due_day =
        req.body.default_due_day != null && Number(req.body.default_due_day) > 0
          ? Math.min(31, Number(req.body.default_due_day))
          : null;
    }
    if (req.body.requires_attachment != null) {
      patch.requires_attachment = Boolean(req.body.requires_attachment);
    }
    if (req.body.requires_verification != null) {
      patch.requires_verification = Boolean(req.body.requires_verification);
    }
    if (req.body.is_active != null) patch.is_active = Boolean(req.body.is_active);
    if (req.body.sort_order != null) patch.sort_order = Number(req.body.sort_order) || 0;

    await row.update(patch);
    res.json({ success: true, data: row });
  } catch (error: any) {
    console.error('updateRecurringTemplate:', error);
    res.status(500).json({ success: false, message: '템플릿을 수정하지 못했습니다.' });
  }
};

/** DELETE /boards/:boardId/recurring/templates/:templateId — soft */
export const deleteRecurringTemplate = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const templateId = Number(req.params.templateId);
    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }
    if (!canManageRecurring(req.user!, loaded.member)) {
      return res.status(403).json({ success: false, message: '템플릿을 관리할 권한이 없습니다.' });
    }

    const row = await RecurringTaskTemplate.findOne({
      where: { id: templateId, board_id: boardId },
    });
    if (!row) return res.status(404).json({ success: false, message: '템플릿을 찾을 수 없습니다.' });

    await row.update({ is_active: false });
    await row.destroy();
    await RecurringTaskAssignment.update(
      { is_active: false },
      { where: { board_id: boardId, template_id: templateId, is_active: true } }
    );

    res.json({ success: true, message: '템플릿을 비활성화했습니다.' });
  } catch (error: any) {
    console.error('deleteRecurringTemplate:', error);
    res.status(500).json({ success: false, message: '템플릿을 삭제하지 못했습니다.' });
  }
};

/** POST /boards/:boardId/recurring/templates/seed-samples */
export const seedRecurringSampleTemplates = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }
    if (!canManageRecurring(req.user!, loaded.member)) {
      return res.status(403).json({ success: false, message: '템플릿을 관리할 권한이 없습니다.' });
    }
    const board = loaded.board!;

    const existing = await RecurringTaskTemplate.findAll({
      where: { board_id: board.id },
      attributes: ['code', 'name'],
      paranoid: false,
    });
    const existingCodes = new Set(
      existing.map((r) => String(r.code || '').toUpperCase()).filter(Boolean)
    );

    const created = [];
    let order =
      Number((await RecurringTaskTemplate.max('sort_order', { where: { board_id: board.id } })) ?? -1) +
      1;
    for (const sample of SAMPLE_TEMPLATES) {
      if (existingCodes.has(sample.code)) continue;
      const row = await RecurringTaskTemplate.create({
        tenant_id: board.tenant_id,
        company_id: board.company_id,
        board_id: board.id,
        name: sample.name,
        code: sample.code,
        category: sample.category,
        frequency: sample.frequency,
        requires_attachment: Boolean(sample.requires_attachment),
        requires_verification: Boolean(sample.requires_verification),
        sort_order: order++,
        is_active: true,
        created_by: req.user!.id,
      });
      created.push(row);
    }

    await syncSampleTemplateSortOrder(board.id);

    res.json({ success: true, data: created, message: `${created.length}개 샘플 템플릿을 추가했습니다.` });
  } catch (error: any) {
    console.error('seedRecurringSampleTemplates:', error);
    res.status(500).json({ success: false, message: '샘플 템플릿을 추가하지 못했습니다.' });
  }
};

/** 파트너 마스터 → customers 행 매칭/생성 (정기 업무 연결은 customer_id 유지) */
async function ensureCustomerFromPartner(
  partner: any,
  tenantId: number,
  companyId: number
): Promise<any> {
  const biz = String(partner.business_number || '').trim();
  const name = String(partner.company_name || '').trim();

  let customer: any = null;
  if (biz) {
    customer = await Customer.findOne({
      where: { tenant_id: tenantId, company_id: companyId, business_number: biz },
    });
  }
  if (!customer && name) {
    customer = await Customer.findOne({
      where: { tenant_id: tenantId, company_id: companyId, name },
    });
  }
  if (customer) return customer;

  return Customer.create({
    tenant_id: tenantId,
    company_id: companyId,
    name: name || biz || `Partner #${partner.id}`,
    business_number: biz || null,
    ceo_name: partner.representative || null,
    address: partner.address || null,
    phone: partner.phone || null,
    email: partner.email || null,
    website: partner.website || null,
    industry: partner.industry || null,
    status:
      partner.status === 'inactive' || partner.status === 'suspended' ? 'inactive' : 'active',
  });
}

async function linkRecurringCustomer(
  board: { id: number; tenant_id: number; company_id: number },
  customerId: number,
  userId: number
) {
  const existing = await RecurringBoardClient.findOne({
    where: { board_id: board.id, customer_id: customerId },
    paranoid: false,
  });
  if (existing) {
    if (existing.deleted_at) await existing.restore();
    await existing.update({ is_active: true, created_by: userId });
    return existing;
  }
  return RecurringBoardClient.create({
    tenant_id: board.tenant_id,
    company_id: board.company_id,
    board_id: board.id,
    customer_id: customerId,
    is_active: true,
    created_by: userId,
  });
}

/** POST /boards/:boardId/recurring/clients  body: { customer_ids?, partner_ids? } */
export const addRecurringClients = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }
    if (!canManageRecurring(req.user!, loaded.member)) {
      return res.status(403).json({ success: false, message: '고객사를 연결할 권한이 없습니다.' });
    }
    const board = loaded.board!;
    const customerIds = Array.isArray(req.body.customer_ids)
      ? req.body.customer_ids.map((x: any) => Number(x)).filter((n: number) => Number.isInteger(n) && n > 0)
      : [];
    const partnerIds = Array.isArray(req.body.partner_ids)
      ? req.body.partner_ids.map((x: any) => Number(x)).filter((n: number) => Number.isInteger(n) && n > 0)
      : [];
    if (customerIds.length === 0 && partnerIds.length === 0) {
      return res.status(400).json({ success: false, message: '고객사를 선택하세요.' });
    }

    const customerIdSet = new Set<number>();

    if (customerIds.length > 0) {
      const customers = await Customer.findAll({
        where: {
          id: { [Op.in]: customerIds },
          tenant_id: board.tenant_id,
          company_id: board.company_id,
        },
        attributes: ['id'],
      });
      for (const c of customers) customerIdSet.add(Number(c.id));
    }

    if (partnerIds.length > 0) {
      const partners = await Partner.findAll({
        where: {
          id: { [Op.in]: partnerIds },
          tenant_id: board.tenant_id,
          company_id: board.company_id,
        },
      });
      for (const partner of partners) {
        const customer = await ensureCustomerFromPartner(partner, board.tenant_id, board.company_id);
        customerIdSet.add(Number(customer.id));
      }
    }

    if (customerIdSet.size === 0) {
      return res.status(400).json({ success: false, message: '유효한 고객사/파트너가 없습니다.' });
    }

    const added = [];
    for (const customerId of customerIdSet) {
      added.push(await linkRecurringCustomer(board, customerId, req.user!.id));
    }

    const full = await RecurringBoardClient.findAll({
      where: { id: { [Op.in]: added.map((r) => r.id) } },
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'business_number', 'status'] }],
    });

    res.status(201).json({ success: true, data: full });
  } catch (error: any) {
    console.error('addRecurringClients:', error);
    res.status(500).json({ success: false, message: '고객사를 연결하지 못했습니다.' });
  }
};

/** DELETE /boards/:boardId/recurring/clients/:customerId */
export const removeRecurringClient = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const customerId = Number(req.params.customerId);
    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }
    if (!canManageRecurring(req.user!, loaded.member)) {
      return res.status(403).json({ success: false, message: '고객사를 제거할 권한이 없습니다.' });
    }

    const row = await RecurringBoardClient.findOne({
      where: { board_id: boardId, customer_id: customerId, is_active: true },
    });
    if (!row) return res.status(404).json({ success: false, message: '연결된 고객사가 없습니다.' });

    await row.update({ is_active: false });
    await row.destroy();
    await RecurringTaskAssignment.update(
      { is_active: false },
      { where: { board_id: boardId, customer_id: customerId, is_active: true } }
    );

    res.json({ success: true, message: '고객사 연결을 해제했습니다.' });
  } catch (error: any) {
    console.error('removeRecurringClient:', error);
    res.status(500).json({ success: false, message: '고객사 연결을 해제하지 못했습니다.' });
  }
};

/**
 * PUT /boards/:boardId/recurring/assignments
 * body: { customer_id, template_id, assigned_user_id?, reviewer_user_id?, is_active? }
 * is_active false → soft remove assignment
 */
export const upsertRecurringAssignment = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }
    if (!canManageRecurring(req.user!, loaded.member)) {
      return res.status(403).json({ success: false, message: '담당자를 지정할 권한이 없습니다.' });
    }
    const board = loaded.board!;
    const customerId = Number(req.body.customer_id);
    const templateId = Number(req.body.template_id);
    if (!Number.isInteger(customerId) || customerId <= 0 || !Number.isInteger(templateId) || templateId <= 0) {
      return res.status(400).json({ success: false, message: '고객사와 업무 템플릿이 필요합니다.' });
    }

    const client = await RecurringBoardClient.findOne({
      where: { board_id: board.id, customer_id: customerId, is_active: true },
    });
    if (!client) {
      return res.status(400).json({ success: false, message: '먼저 고객사를 보드에 연결하세요.' });
    }
    const template = await RecurringTaskTemplate.findOne({
      where: { id: templateId, board_id: board.id, is_active: true },
    });
    if (!template) {
      return res.status(400).json({ success: false, message: '유효한 업무 템플릿이 아닙니다.' });
    }

    const wantActive = req.body.is_active === false ? false : true;
    const assignedUserId =
      req.body.assigned_user_id != null && Number(req.body.assigned_user_id) > 0
        ? Number(req.body.assigned_user_id)
        : null;
    const reviewerUserId =
      req.body.reviewer_user_id != null && Number(req.body.reviewer_user_id) > 0
        ? Number(req.body.reviewer_user_id)
        : null;

    if (assignedUserId) {
      const m = await WorkBoardMember.findOne({
        where: { board_id: board.id, user_id: assignedUserId },
      });
      if (!m && req.user!.role !== 'root') {
        return res.status(400).json({ success: false, message: '담당자는 보드 멤버여야 합니다.' });
      }
    }
    if (reviewerUserId) {
      const m = await WorkBoardMember.findOne({
        where: { board_id: board.id, user_id: reviewerUserId },
      });
      if (!m && req.user!.role !== 'root') {
        return res.status(400).json({ success: false, message: '검토자는 보드 멤버여야 합니다.' });
      }
    }

    let row = await RecurringTaskAssignment.findOne({
      where: { board_id: board.id, customer_id: customerId, template_id: templateId },
      paranoid: false,
    });

    if (!wantActive) {
      if (row) {
        if (row.deleted_at) await row.restore();
        await row.update({ is_active: false, assigned_user_id: null, reviewer_user_id: null });
        await row.destroy();
      }
      return res.json({ success: true, data: null, message: '업무 배정을 해제했습니다.' });
    }

    if (row) {
      if (row.deleted_at) await row.restore();
      await row.update({
        is_active: true,
        assigned_user_id: assignedUserId,
        reviewer_user_id: reviewerUserId,
      });
    } else {
      row = await RecurringTaskAssignment.create({
        tenant_id: board.tenant_id,
        company_id: board.company_id,
        board_id: board.id,
        customer_id: customerId,
        template_id: templateId,
        assigned_user_id: assignedUserId,
        reviewer_user_id: reviewerUserId,
        is_active: true,
        created_by: req.user!.id,
      });
    }

    await syncInstancesFromAssignment(
      board.id,
      customerId,
      templateId,
      assignedUserId,
      reviewerUserId
    );

    const full = await RecurringTaskAssignment.findByPk(row.id, {
      include: [
        { model: RecurringTaskTemplate, as: 'template', attributes: ['id', 'name', 'code', 'frequency', 'category'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name'] },
        { model: User, as: 'assignee', attributes: ['id', 'username', 'userid', 'avatar_url'] },
        { model: User, as: 'reviewer', attributes: ['id', 'username', 'userid', 'avatar_url'] },
      ],
    });

    res.json({ success: true, data: full });
  } catch (error: any) {
    console.error('upsertRecurringAssignment:', error);
    res.status(500).json({ success: false, message: '담당자 지정을 저장하지 못했습니다.' });
  }
};

/**
 * PUT /boards/:boardId/recurring/assignments/bulk
 * body: {
 *   items: Array<{ customer_id, template_id }>,
 *   assigned_user_id?: number | null,  // set_assignee true일 때 적용
 *   set_assignee?: boolean,
 *   reviewer_user_id?: number | null,
 *   set_reviewer?: boolean
 * }
 */
export const bulkUpsertRecurringAssignments = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }
    if (!canManageRecurring(req.user!, loaded.member)) {
      return res.status(403).json({ success: false, message: '담당자를 지정할 권한이 없습니다.' });
    }
    const board = loaded.board!;
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const items: Array<{ customer_id: number; template_id: number }> = rawItems
      .map((it: any) => ({
        customer_id: Number(it?.customer_id),
        template_id: Number(it?.template_id),
      }))
      .filter(
        (it): it is { customer_id: number; template_id: number } =>
          Number.isInteger(it.customer_id) &&
          it.customer_id > 0 &&
          Number.isInteger(it.template_id) &&
          it.template_id > 0
      );
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: '일괄 설정할 항목이 없습니다.' });
    }

    const setAssignee = Boolean(req.body.set_assignee);
    const setReviewer = Boolean(req.body.set_reviewer);
    if (!setAssignee && !setReviewer) {
      return res.status(400).json({ success: false, message: '담당자 또는 검토자 설정을 선택하세요.' });
    }

    const assignedUserId =
      req.body.assigned_user_id != null && Number(req.body.assigned_user_id) > 0
        ? Number(req.body.assigned_user_id)
        : null;
    const reviewerUserId =
      req.body.reviewer_user_id != null && Number(req.body.reviewer_user_id) > 0
        ? Number(req.body.reviewer_user_id)
        : null;

    if (setAssignee && assignedUserId) {
      const m = await WorkBoardMember.findOne({
        where: { board_id: board.id, user_id: assignedUserId },
      });
      if (!m && req.user!.role !== 'root') {
        return res.status(400).json({ success: false, message: '담당자는 보드 멤버여야 합니다.' });
      }
    }
    if (setReviewer && reviewerUserId) {
      const m = await WorkBoardMember.findOne({
        where: { board_id: board.id, user_id: reviewerUserId },
      });
      if (!m && req.user!.role !== 'root') {
        return res.status(400).json({ success: false, message: '검토자는 보드 멤버여야 합니다.' });
      }
    }

    const clientIds: number[] = Array.from(new Set(items.map((i) => i.customer_id)));
    const templateIds: number[] = Array.from(new Set(items.map((i) => i.template_id)));
    const [validClients, validTemplates] = await Promise.all([
      RecurringBoardClient.findAll({
        where: { board_id: board.id, customer_id: clientIds, is_active: true },
        attributes: ['customer_id'],
      }),
      RecurringTaskTemplate.findAll({
        where: { board_id: board.id, id: templateIds, is_active: true },
        attributes: ['id'],
      }),
    ]);
    const okClients = new Set(validClients.map((c) => Number(c.customer_id)));
    const okTemplates = new Set(validTemplates.map((t) => Number(t.id)));

    const saved: any[] = [];
    for (const item of items) {
      if (!okClients.has(item.customer_id) || !okTemplates.has(item.template_id)) continue;

      let row = await RecurringTaskAssignment.findOne({
        where: {
          board_id: board.id,
          customer_id: item.customer_id,
          template_id: item.template_id,
        },
        paranoid: false,
      });

      const nextAssignee = setAssignee
        ? assignedUserId
        : row && !row.deleted_at
          ? row.assigned_user_id ?? null
          : null;
      const nextReviewer = setReviewer
        ? reviewerUserId
        : row && !row.deleted_at
          ? row.reviewer_user_id ?? null
          : null;

      if (row) {
        if (row.deleted_at) await row.restore();
        await row.update({
          is_active: true,
          assigned_user_id: nextAssignee,
          reviewer_user_id: nextReviewer,
        });
      } else {
        row = await RecurringTaskAssignment.create({
          tenant_id: board.tenant_id,
          company_id: board.company_id,
          board_id: board.id,
          customer_id: item.customer_id,
          template_id: item.template_id,
          assigned_user_id: nextAssignee,
          reviewer_user_id: nextReviewer,
          is_active: true,
          created_by: req.user!.id,
        });
      }

      await syncInstancesFromAssignment(
        board.id,
        item.customer_id,
        item.template_id,
        nextAssignee,
        nextReviewer
      );

      const full = await RecurringTaskAssignment.findByPk(row.id, {
        include: [
          { model: RecurringTaskTemplate, as: 'template', attributes: ['id', 'name', 'code', 'frequency', 'category'] },
          { model: Customer, as: 'customer', attributes: ['id', 'name'] },
          { model: User, as: 'assignee', attributes: ['id', 'username', 'userid', 'avatar_url'] },
          { model: User, as: 'reviewer', attributes: ['id', 'username', 'userid', 'avatar_url'] },
        ],
      });
      if (full) saved.push(full);
    }

    res.json({
      success: true,
      data: saved,
      message: `${saved.length}건 담당 배정을 일괄 저장했습니다.`,
    });
  } catch (error: any) {
    console.error('bulkUpsertRecurringAssignments:', error);
    res.status(500).json({ success: false, message: '담당자 일괄 지정을 저장하지 못했습니다.' });
  }
};

/** GET /boards/:boardId/recurring/checklist?period=YYYY-MM */
export const getRecurringChecklist = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const loaded = await loadRecurringBoard(boardId, req.user!);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }
    const board = loaded.board!;
    const parsed = parsePeriod(req.query.period) || parsePeriod(currentPeriod())!;
    const period = parsed.period;

    const [templates, clients, instances, assignments] = await Promise.all([
      RecurringTaskTemplate.findAll({
        where: { board_id: board.id, is_active: true },
        order: [
          ['sort_order', 'ASC'],
          ['id', 'ASC'],
        ],
      }),
      RecurringBoardClient.findAll({
        where: { board_id: board.id, is_active: true },
        include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'business_number', 'status'] }],
        order: [['id', 'ASC']],
      }),
      RecurringTaskInstance.findAll({
        where: { board_id: board.id, period },
        include: [
          {
            model: RecurringTaskTemplate,
            as: 'template',
            attributes: [
              'id',
              'name',
              'code',
              'frequency',
              'category',
              'requires_attachment',
              'requires_verification',
            ],
          },
          { model: Customer, as: 'customer', attributes: ['id', 'name', 'business_number'] },
          { model: User, as: 'assignee', attributes: ['id', 'username', 'userid', 'avatar_url'] },
          { model: User, as: 'reviewer', attributes: ['id', 'username', 'userid', 'avatar_url'] },
        ],
        order: [['id', 'ASC']],
      }),
      RecurringTaskAssignment.findAll({
        where: { board_id: board.id, is_active: true },
        include: [
          { model: User, as: 'assignee', attributes: ['id', 'username', 'userid', 'avatar_url'] },
          { model: User, as: 'reviewer', attributes: ['id', 'username', 'userid', 'avatar_url'] },
        ],
      }),
    ]);

    const applicableTemplates = templates.filter((t) =>
      frequencyAppliesToPeriod(String(t.frequency), parsed.month)
    );
    const applicableTemplateIds = applicableTemplates.map((t) => Number(t.id));

    /** 고객사×해당기간 템플릿마다 담당자가 있어야 체크리스트에 표시 (배정 우선, 없으면 인스턴스 담당) */
    const assignmentByKey = new Map<string, any>();
    for (const a of assignments) {
      if (a.assigned_user_id == null || Number(a.assigned_user_id) <= 0) continue;
      assignmentByKey.set(`${a.customer_id}:${a.template_id}`, a);
    }
    const instanceByKey = new Map<string, any>();
    for (const row of instances) {
      instanceByKey.set(`${row.customer_id}:${row.template_id}`, row);
    }

    /** 고객사는 해당기간 템플릿 담당이 모두 있을 때만 표시. 담당자가 여러 명이면 담당자별 행으로 분리 */
    const visibleClients: any[] = [];
    for (const client of clients) {
      const customerId = Number(client.customer_id);
      if (applicableTemplateIds.length === 0) continue;

      const assigneeByTemplate: Record<
        string,
        { id: number; username: string; userid?: string | null }
      > = {};
      let fullyAssigned = true;
      for (const templateId of applicableTemplateIds) {
        const a = assignmentByKey.get(`${customerId}:${templateId}`);
        const inst = instanceByKey.get(`${customerId}:${templateId}`);
        const uid = Number(a?.assigned_user_id || inst?.assigned_user_id || 0);
        if (!uid) {
          fullyAssigned = false;
          break;
        }
        const username = String(
          a?.assignee?.username ||
            a?.assignee?.userid ||
            inst?.assignee?.username ||
            inst?.assignee?.userid ||
            uid
        ).trim();
        assigneeByTemplate[String(templateId)] = {
          id: uid,
          username,
          userid: a?.assignee?.userid ?? inst?.assignee?.userid ?? null,
        };
      }
      if (!fullyAssigned) continue;

      const byAssignee = new Map<
        number,
        {
          username: string;
          userid?: string | null;
          templateIds: number[];
          assigneeByTemplate: typeof assigneeByTemplate;
        }
      >();
      for (const templateId of applicableTemplateIds) {
        const info = assigneeByTemplate[String(templateId)];
        if (!info) continue;
        const existing = byAssignee.get(info.id);
        if (existing) {
          existing.templateIds.push(templateId);
          existing.assigneeByTemplate[String(templateId)] = info;
        } else {
          byAssignee.set(info.id, {
            username: info.username,
            userid: info.userid,
            templateIds: [templateId],
            assigneeByTemplate: { [String(templateId)]: info },
          });
        }
      }

      const base: any =
        typeof (client as any).toJSON === 'function' ? (client as any).toJSON() : { ...client };
      for (const [assigneeUserId, group] of byAssignee) {
        visibleClients.push({
          ...base,
          row_key: `${customerId}:${assigneeUserId}`,
          assignee_user_id: assigneeUserId,
          assignee_label: group.username,
          assignee_names: [group.username],
          template_ids: group.templateIds,
          assignee_by_template: group.assigneeByTemplate,
        });
      }
    }

    const canManage = canManageRecurring(req.user!, loaded.member);
    const memberRole = String(loaded.member?.role || '');
    /** 보드 Admin(owner)만 전체. 시스템 audit/admin이어도 보드 멤버면 본인 담당만 */
    const canViewAllChecklist = memberRole === 'owner' || req.user!.role === 'root';
    const scopedClients = canViewAllChecklist
      ? visibleClients
      : visibleClients.filter(
          (c: any) => Number(c.assignee_user_id) === Number(req.user!.id)
        );

    const allowedInstanceKeys = new Set<string>();
    for (const c of scopedClients) {
      const customerId = Number(c.customer_id);
      const templateIds = Array.isArray(c.template_ids) ? c.template_ids : applicableTemplateIds;
      for (const templateId of templateIds) {
        allowedInstanceKeys.add(`${customerId}:${Number(templateId)}`);
      }
    }

    let total = 0;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;
    let overdue = 0;
    let notApplicable = 0;
    const enriched = instances
      .filter((row) =>
        allowedInstanceKeys.has(`${Number(row.customer_id)}:${Number(row.template_id)}`)
      )
      .map((row) => {
        const json = applyAssignmentToInstanceJson(
          serializeInstance(row),
          assignmentByKey.get(`${row.customer_id}:${row.template_id}`)
        );
        if (json.status === 'NOT_APPLICABLE') notApplicable += 1;
        else {
          total += 1;
          if (json.status === 'COMPLETED' || json.status === 'VERIFIED') completed += 1;
          else if (json.status === 'IN_PROGRESS') inProgress += 1;
          else pending += 1;
          if (json.is_overdue) overdue += 1;
        }
        return json;
      });

    res.json({
      success: true,
      data: {
        period,
        can_manage: canManage,
        templates: applicableTemplates,
        all_templates: templates,
        clients: scopedClients,
        clients_total: clients.length,
        clients_hidden_unassigned: Math.max(0, clients.length - visibleClients.length),
        instances: enriched,
        summary: {
          total,
          completed,
          in_progress: inProgress,
          pending,
          overdue,
          not_applicable: notApplicable,
          completion_rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
        },
      },
    });
  } catch (error: any) {
    console.error('getRecurringChecklist:', error);
    res.status(500).json({
      success: false,
      message: '월별 체크리스트를 불러오지 못했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * POST /boards/:boardId/recurring/generate
 * body: { period?: 'YYYY-MM' }
 * 고객사 × (주기에 맞는 활성 템플릿) 인스턴스 생성. 이미 있으면 스킵.
 */
export const generateRecurringPeriod = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }
    if (!canManageRecurring(req.user!, loaded.member)) {
      return res.status(403).json({ success: false, message: '인스턴스를 생성할 권한이 없습니다.' });
    }

    const board = loaded.board!;
    const periodArg = req.body?.period ? String(req.body.period) : currentPeriod();
    const result = await generateRecurringInstancesForBoard(board, periodArg, req.user!.id);

    if (result.skipped_reason === 'no_clients') {
      return res.status(400).json({ success: false, message: '먼저 고객사를 연결하세요.' });
    }
    if (result.skipped_reason === 'no_applicable_templates') {
      return res.status(400).json({
        success: false,
        message: '이 기간에 생성할 활성 템플릿이 없습니다.',
      });
    }

    res.status(201).json({
      success: true,
      data: {
        period: result.period,
        created: result.created,
        skipped: result.skipped,
        instance_ids: result.instance_ids,
      },
      message: `${result.period} 인스턴스 ${result.created}건 생성 (${result.skipped}건 기존 유지)`,
    });
  } catch (error: any) {
    console.error('generateRecurringPeriod:', error);
    res.status(500).json({ success: false, message: '인스턴스를 생성하지 못했습니다.' });
  }
};

/** POST /recurring/generate-all  body: { period? } — root만, 전체 보드 보강 */
export const generateRecurringPeriodAllBoards = async (req: RequestWithUser, res: Response) => {
  try {
    if (req.user!.role !== 'root') {
      return res.status(403).json({ success: false, message: '전체 생성은 root만 실행할 수 있습니다.' });
    }
    const periodArg = req.body?.period ? String(req.body.period) : currentPeriod();
    const result = await generateRecurringInstancesForAllBoards(periodArg);
    res.json({
      success: true,
      data: result,
      message: `${result.period}: ${result.boards}개 보드, 생성 ${result.created}건 / 유지 ${result.skipped}건`,
    });
  } catch (error: any) {
    console.error('generateRecurringPeriodAllBoards:', error);
    res.status(500).json({ success: false, message: '전체 인스턴스 생성에 실패했습니다.' });
  }
};

/** GET /boards/:boardId/recurring/instances/:instanceId */
export const getRecurringInstance = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const instanceId = Number(req.params.instanceId);
    const loaded = await loadRecurringBoard(boardId, req.user!);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }

    const full = await loadInstanceIncludes(instanceId);
    if (!full || Number(full.board_id) !== boardId) {
      return res.status(404).json({ success: false, message: '업무 인스턴스를 찾을 수 없습니다.' });
    }

    const assignment = await RecurringTaskAssignment.findOne({
      where: {
        board_id: boardId,
        customer_id: full.customer_id,
        template_id: full.template_id,
        is_active: true,
      },
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'username', 'userid', 'avatar_url'] },
        { model: User, as: 'reviewer', attributes: ['id', 'username', 'userid', 'avatar_url'] },
      ],
    });

    /** 배정은 있는데 인스턴스에 안 심어져 있으면 DB에도 맞춰 둠 */
    if (
      assignment &&
      ((full.assigned_user_id == null && assignment.assigned_user_id) ||
        (full.reviewer_user_id == null && assignment.reviewer_user_id))
    ) {
      await full.update({
        assigned_user_id: full.assigned_user_id ?? assignment.assigned_user_id ?? null,
        reviewer_user_id: full.reviewer_user_id ?? assignment.reviewer_user_id ?? null,
      });
      await full.reload();
    }

    const data = applyAssignmentToInstanceJson(serializeInstance(full), assignment);
    const perms = await canEditInstance(req.user!, loaded.member, full);
    res.json({
      success: true,
      data: {
        ...data,
        can_manage: perms.manage,
        can_edit: perms.ok,
        can_verify: perms.manage || perms.isReviewer,
      },
    });
  } catch (error: any) {
    console.error('getRecurringInstance:', error);
    res.status(500).json({ success: false, message: '업무 상세를 불러오지 못했습니다.' });
  }
};

/**
 * PUT /boards/:boardId/recurring/instances/:instanceId
 * body: { status?, notes?, assigned_user_id?, reviewer_user_id?, due_date? }
 */
export const updateRecurringInstance = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const instanceId = Number(req.params.instanceId);
    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }

    const row = await RecurringTaskInstance.findOne({
      where: { id: instanceId, board_id: boardId },
      include: [
        {
          model: RecurringTaskTemplate,
          as: 'template',
          attributes: ['id', 'requires_attachment', 'requires_verification', 'name'],
        },
      ],
    });
    if (!row) return res.status(404).json({ success: false, message: '업무 인스턴스를 찾을 수 없습니다.' });

    const { ok, manage, isAssignee, isReviewer } = await canEditInstance(req.user!, loaded.member, row);
    if (!ok) {
      return res.status(403).json({ success: false, message: '이 업무를 변경할 권한이 없습니다.' });
    }

    const template = (row as any).template;
    const attachments = normalizeInstanceAttachments((row as any).attachments);
    const patch: Record<string, any> = {};

    if (req.body.status != null) {
      const status = normalizeInstanceStatus(req.body.status);
      if (!status) {
        return res.status(400).json({ success: false, message: '유효하지 않은 상태입니다.' });
      }
      if (status === 'VERIFIED' && !manage && !isReviewer) {
        return res.status(403).json({ success: false, message: '검증은 검토자 또는 소유자만 할 수 있습니다.' });
      }
      if (status === 'NOT_APPLICABLE' && !manage && !isAssignee) {
        const assignment = await RecurringTaskAssignment.findOne({
          where: {
            board_id: boardId,
            customer_id: row.customer_id,
            template_id: row.template_id,
            is_active: true,
          },
          attributes: ['assigned_user_id'],
        });
        const assignedFromTask =
          assignment?.assigned_user_id != null &&
          Number(assignment.assigned_user_id) === Number(req.user!.id);
        if (!assignedFromTask) {
          return res.status(403).json({
            success: false,
            code: 'NOT_APPLICABLE_FORBIDDEN',
            message: '해당 없음 처리는 소유자 또는 담당자만 할 수 있습니다.',
          });
        }
      }
      // 검증 필수: 완료 → 검증 순서
      if (status === 'VERIFIED' && template?.requires_verification) {
        const fromStatus = String(row.status);
        if (fromStatus !== 'COMPLETED' && fromStatus !== 'VERIFIED') {
          return res.status(400).json({
            success: false,
            message: '검증 필수 업무는 먼저 완료한 뒤 검증할 수 있습니다.',
          });
        }
      }
      // 첨부 필수: 완료·검증 전 파일 필요
      if (
        (status === 'COMPLETED' || status === 'VERIFIED') &&
        template?.requires_attachment &&
        attachments.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            status === 'VERIFIED'
              ? '검증하려면 첨부 파일이 필요합니다. 먼저 파일을 올린 뒤 완료·검증하세요.'
              : '이 업무는 첨부 파일이 있어야 완료할 수 있습니다. 상세에서 파일을 추가하세요.',
        });
      }

      patch.status = status;
      if (status === 'COMPLETED') {
        patch.completed_by = req.user!.id;
        patch.completed_at = new Date();
        patch.verified_by = null;
        patch.verified_at = null;
      } else if (status === 'VERIFIED') {
        if (row.status !== 'COMPLETED' && row.status !== 'VERIFIED') {
          patch.completed_by = row.completed_by ?? req.user!.id;
          patch.completed_at = row.completed_at ?? new Date();
        }
        patch.verified_by = req.user!.id;
        patch.verified_at = new Date();
      } else if (status === 'PENDING' || status === 'IN_PROGRESS') {
        patch.completed_by = null;
        patch.completed_at = null;
        patch.verified_by = null;
        patch.verified_at = null;
      }
    }
    if (req.body.notes !== undefined) {
      patch.notes = req.body.notes ? String(req.body.notes).trim().slice(0, 5000) : null;
    }
    if (manage && req.body.due_date !== undefined) {
      const due = req.body.due_date ? String(req.body.due_date).trim() : null;
      patch.due_date = due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null;
    }
    if (manage && req.body.assigned_user_id !== undefined) {
      patch.assigned_user_id =
        req.body.assigned_user_id != null && Number(req.body.assigned_user_id) > 0
          ? Number(req.body.assigned_user_id)
          : null;
    }
    if (manage && req.body.reviewer_user_id !== undefined) {
      patch.reviewer_user_id =
        req.body.reviewer_user_id != null && Number(req.body.reviewer_user_id) > 0
          ? Number(req.body.reviewer_user_id)
          : null;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, message: '변경할 내용이 없습니다.' });
    }

    await row.update(patch);
    const full = await loadInstanceIncludes(row.id);
    res.json({ success: true, data: serializeInstance(full || row) });
  } catch (error: any) {
    console.error('updateRecurringInstance:', error);
    res.status(500).json({ success: false, message: '업무 상태를 저장하지 못했습니다.' });
  }
};

/** POST /boards/:boardId/recurring/instances/:instanceId/attachments */
export const uploadRecurringInstanceAttachments = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const instanceId = Number(req.params.instanceId);
    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }

    const row = await RecurringTaskInstance.findOne({ where: { id: instanceId, board_id: boardId } });
    if (!row) return res.status(404).json({ success: false, message: '업무 인스턴스를 찾을 수 없습니다.' });

    const { ok } = await canEditInstance(req.user!, loaded.member, row);
    if (!ok) return res.status(403).json({ success: false, message: '첨부할 권한이 없습니다.' });

    const files = ((req as any).files || []) as Express.Multer.File[];
    if (!files.length) return res.status(400).json({ success: false, message: '파일이 필요합니다.' });

    const attachments = normalizeInstanceAttachments((row as any).attachments);
    if (attachments.length + files.length > RECURRING_INSTANCE_MAX_ATTACHMENTS) {
      return res.status(400).json({
        success: false,
        message: `첨부는 최대 ${RECURRING_INSTANCE_MAX_ATTACHMENTS}개까지 가능합니다.`,
      });
    }

    const added: InstanceAttachmentRecord[] = [];
    for (const file of files) {
      if (!file.filename) continue;
      let originalName = file.originalname || file.filename;
      try {
        originalName = Buffer.from(originalName, 'latin1').toString('utf8');
      } catch {
        // keep
      }
      added.push({
        originalName,
        storedName: file.filename,
        path: `recurring-instances/${instanceId}/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
    }
    if (added.length === 0) {
      return res.status(400).json({ success: false, message: '업로드할 수 있는 파일이 없습니다.' });
    }

    const nextAttachments = [...attachments, ...added];
    await row.update({ attachments: nextAttachments });
    const full = await loadInstanceIncludes(row.id);
    res.json({ success: true, data: serializeInstance(full || row) });
  } catch (error: any) {
    console.error('uploadRecurringInstanceAttachments:', error);
    res.status(500).json({ success: false, message: '첨부 업로드에 실패했습니다.' });
  }
};

/** DELETE /boards/:boardId/recurring/instances/:instanceId/attachments/:storedName */
export const deleteRecurringInstanceAttachment = async (req: RequestWithUser, res: Response) => {
  try {
    const boardId = Number(req.params.boardId);
    const instanceId = Number(req.params.instanceId);
    const storedName = String(req.params.storedName || '').trim();
    if (!storedName || storedName.includes('..')) {
      return res.status(400).json({ success: false, message: '삭제할 첨부 정보가 올바르지 않습니다.' });
    }

    const loaded = await loadRecurringBoard(boardId, req.user!, true);
    if (loaded.error === 'not_found') {
      return res.status(404).json({ success: false, message: '보드를 찾을 수 없거나 권한이 없습니다.' });
    }
    if (loaded.error === 'not_recurring') {
      return res.status(400).json({ success: false, message: '정기 업무 보드가 아닙니다.' });
    }

    const row = await RecurringTaskInstance.findOne({ where: { id: instanceId, board_id: boardId } });
    if (!row) return res.status(404).json({ success: false, message: '업무 인스턴스를 찾을 수 없습니다.' });

    const { ok } = await canEditInstance(req.user!, loaded.member, row);
    if (!ok) return res.status(403).json({ success: false, message: '첨부 삭제 권한이 없습니다.' });

    const attachments = normalizeInstanceAttachments((row as any).attachments);
    const target = attachments.find((a) => a.storedName === storedName);
    if (!target) return res.status(404).json({ success: false, message: '첨부를 찾을 수 없습니다.' });

    const nextAttachments = attachments.filter((a) => a.storedName !== storedName);
    await row.update({ attachments: nextAttachments });

    try {
      const uploadRoot = ensureUploadRoot();
      const absolutePath = path.join(uploadRoot, target.path.replace(/^\/+/, ''));
      if (absolutePath.startsWith(uploadRoot) && fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (unlinkError) {
      console.warn('deleteRecurringInstanceAttachment unlink:', unlinkError);
    }

    const full = await loadInstanceIncludes(row.id);
    res.json({ success: true, data: serializeInstance(full || row) });
  } catch (error: any) {
    console.error('deleteRecurringInstanceAttachment:', error);
    res.status(500).json({ success: false, message: '첨부 삭제에 실패했습니다.' });
  }
};
