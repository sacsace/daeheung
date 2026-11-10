import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Op } from 'sequelize';
import { RequestWithUser } from '../types';
import {
  ProjectActivity,
  ProjectMember,
  ProjectSchedule,
  ProjectTask,
  ProjectTaskAssignee,
  ProjectTaskComment,
  User,
} from '../models';
import sequelize from '../config/database';
import { getProjectWithAccessOrThrow } from '../services/projectMembershipService';
import {
  canEditWorkspace,
  canManageWorkspace,
  logProjectActivity,
  normalizeScheduleType,
  normalizeTaskPriority,
  normalizeTaskStatus,
  normalizeTaskColor,
  pickUniqueTaskColor,
  recalculateProjectProgress,
} from '../services/projectWorkspaceService';
import { pushNotification } from './notificationController';
import { ensureUploadRoot } from '../utils/uploadPath';
import { DataTypes } from 'sequelize';

const userAttrs = ['id', 'username', 'email', 'department', 'position', 'avatar_url'];
const MAX_TASK_ATTACHMENTS = 10;

let projectTaskSchemaEnsured = false;

async function ensureProjectTaskSchema(): Promise<void> {
  if (projectTaskSchemaEnsured) return;
  const qi = sequelize.getQueryInterface();
  try {
    const table = await qi.describeTable('project_tasks');
    if (!table.progress_note) {
      await qi.addColumn('project_tasks', 'progress_note', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    }
    if (!table.attachments) {
      await qi.addColumn('project_tasks', 'attachments', {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }
    if (!table.color) {
      await qi.addColumn('project_tasks', 'color', {
        type: DataTypes.STRING(7),
        allowNull: true,
      });
    }
    if (!table.sort_order) {
      await qi.addColumn('project_tasks', 'sort_order', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
  } catch (error) {
    console.warn('ensureProjectTaskSchema columns:', error);
  }

  try {
    const tables = await qi.showAllTables();
    const names = (tables as any[]).map((t) =>
      typeof t === 'string' ? t : String(t.tableName || t.table_name || t)
    );
    if (!names.includes('project_task_comments')) {
      await qi.createTable('project_task_comments', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        task_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'project_tasks', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        parent_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'project_task_comments', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        content: { type: DataTypes.TEXT, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
      });
      await qi.addIndex('project_task_comments', ['task_id', 'created_at']);
      await qi.addIndex('project_task_comments', ['parent_id']);
    } else {
      const commentTable = await qi.describeTable('project_task_comments');
      if (!commentTable.parent_id) {
        await qi.addColumn('project_task_comments', 'parent_id', {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'project_task_comments', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        });
        try {
          await qi.addIndex('project_task_comments', ['parent_id']);
        } catch {
          /* index may already exist */
        }
      }
    }
  } catch (error) {
    console.warn('ensureProjectTaskSchema comments table:', error);
  }

  projectTaskSchemaEnsured = true;
}

type TaskAttachmentRecord = {
  originalName: string;
  storedName: string;
  path: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
};

function normalizeTaskAttachments(raw: unknown): TaskAttachmentRecord[] {
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
      const originalName = String(
        item.originalName || item.original_name || storedName || 'attachment'
      ).trim();
      const pathValue = (pathRaw || (storedName ? `project-tasks/${storedName}` : ''))
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
      } satisfies TaskAttachmentRecord;
    })
    .filter(Boolean) as TaskAttachmentRecord[];
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateOnly(value: unknown, field: string): string | null {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const err: any = new Error(`${field} 형식이 올바르지 않습니다.`);
    err.status = 400;
    throw err;
  }
  return raw;
}

function parseUserIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
}

async function assertActiveProjectMembers(projectId: number, userIds: number[], transaction?: any) {
  if (userIds.length === 0) return;
  const rows = await (ProjectMember as any).findAll({
    where: {
      project_id: projectId,
      user_id: { [Op.in]: userIds },
      is_active: true,
      status: 'active',
    },
    attributes: ['user_id'],
    transaction,
  });
  const ok = new Set(rows.map((r: any) => Number(r.user_id)));
  const missing = userIds.filter((id) => !ok.has(id));
  if (missing.length > 0) {
    const err: any = new Error('Task 담당자는 프로젝트 참여자여야 합니다.');
    err.status = 400;
    throw err;
  }
}

async function syncTaskAssignees(params: {
  taskId: number;
  userIds: number[];
  assignedBy: number;
  transaction: any;
}) {
  const existing = await (ProjectTaskAssignee as any).findAll({
    where: { task_id: params.taskId },
    paranoid: false,
    transaction: params.transaction,
  });
  const keep = new Set(params.userIds);
  for (const row of existing) {
    const uid = Number(row.user_id);
    if (keep.has(uid)) {
      if (row.deleted_at) {
        await row.restore({ transaction: params.transaction });
        await row.update(
          { assigned_by: params.assignedBy, assigned_at: new Date() },
          { transaction: params.transaction }
        );
      }
      keep.delete(uid);
    } else if (!row.deleted_at) {
      await row.destroy({ transaction: params.transaction });
    }
  }
  for (const userId of keep) {
    await (ProjectTaskAssignee as any).create(
      {
        task_id: params.taskId,
        user_id: userId,
        assigned_by: params.assignedBy,
        assigned_at: new Date(),
      },
      { transaction: params.transaction }
    );
  }
}

async function loadTask(taskId: number, projectId: number, transaction?: any) {
  return (ProjectTask as any).findOne({
    where: { id: taskId, project_id: projectId, is_active: true },
    include: [
      {
        model: ProjectTaskAssignee,
        as: 'assignees',
        required: false,
        include: [{ model: User, as: 'user', attributes: userAttrs }],
      },
      {
        model: ProjectTaskComment,
        as: 'comments',
        required: false,
        include: [{ model: User, as: 'user', attributes: userAttrs }],
        separate: true,
        order: [['created_at', 'ASC']],
      },
      { model: User, as: 'creator', attributes: userAttrs },
      { model: User, as: 'completer', attributes: userAttrs },
    ],
    transaction,
  });
}

function withOverdueStats(stats: Awaited<ReturnType<typeof recalculateProjectProgress>>, overdueCount: number) {
  return { ...stats, overdue: overdueCount };
}

async function countOverdueTasks(projectId: number, transaction?: any) {
  const today = todayYmd();
  return (ProjectTask as any).count({
    where: {
      project_id: projectId,
      is_active: true,
      status: { [Op.notIn]: ['completed', 'cancelled'] },
      due_date: { [Op.lt]: today, [Op.ne]: null },
    },
    transaction,
  });
}

export const getProjectOverview = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureProjectTaskSchema();
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );

    const [schedules, tasks, activities, members] = await Promise.all([
      (ProjectSchedule as any).findAll({
        where: { project_id: project.id, is_active: true },
        order: [
          ['start_date', 'ASC'],
          ['id', 'ASC'],
        ],
        limit: 20,
      }),
      (ProjectTask as any).findAll({
        where: { project_id: project.id, is_active: true },
        include: [
          {
            model: ProjectTaskAssignee,
            as: 'assignees',
            required: false,
            include: [{ model: User, as: 'user', attributes: ['id', 'username'] }],
          },
        ],
        order: [
          ['due_date', 'ASC'],
          ['id', 'DESC'],
        ],
        limit: 30,
      }),
      (ProjectActivity as any).findAll({
        where: { project_id: project.id },
        include: [{ model: User, as: 'actor', attributes: ['id', 'username'] }],
        order: [['created_at', 'DESC']],
        limit: 15,
      }),
      (ProjectMember as any).findAll({
        where: { project_id: project.id, is_active: true, status: 'active' },
        include: [{ model: User, as: 'user', attributes: userAttrs }],
        order: [
          ['role', 'ASC'],
          ['id', 'ASC'],
        ],
      }),
    ]);

    const progressStats = await recalculateProjectProgress(project.id);
    const overdue = await countOverdueTasks(project.id);
    const today = todayYmd();

    res.json({
      success: true,
      data: {
        project: {
          ...(project.toJSON ? project.toJSON() : project),
          progress: progressStats.progress,
          my_role: membership?.role || (asAdmin ? 'admin' : null),
        },
        members,
        stats: withOverdueStats(progressStats, overdue),
        upcoming_schedules: schedules.filter((s: any) => !s.end_date || String(s.end_date) >= today).slice(0, 10),
        recent_tasks: tasks,
        recent_activities: activities,
      },
    });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('프로젝트 개요 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const listProjectSchedules = async (req: RequestWithUser, res: Response) => {
  try {
    const { project } = await getProjectWithAccessOrThrow(Number(req.params.id), req.user!);
    const from = parseDateOnly(req.query.from, 'from');
    const to = parseDateOnly(req.query.to, 'to');
    const where: any = { project_id: project.id, is_active: true };
    if (from) where.start_date = { ...(where.start_date || {}), [Op.gte]: from };
    if (to) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [{ end_date: null }, { end_date: { [Op.lte]: to } }, { start_date: { [Op.lte]: to } }],
        },
      ];
    }

    const rows = await (ProjectSchedule as any).findAll({
      where,
      include: [{ model: User, as: 'creator', attributes: userAttrs }],
      order: [
        ['start_date', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('일정 목록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const createProjectSchedule = async (req: RequestWithUser, res: Response) => {
  try {
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canEditWorkspace(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '일정을 등록할 권한이 없습니다.' });
    }

    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ success: false, message: '일정 제목을 입력하세요.' });
    const start_date = parseDateOnly(req.body.start_date, '시작일');
    if (!start_date) return res.status(400).json({ success: false, message: '시작일을 입력하세요.' });
    const end_date = parseDateOnly(req.body.end_date, '종료일');
    if (end_date && end_date < start_date) {
      return res.status(400).json({ success: false, message: '종료일은 시작일 이후여야 합니다.' });
    }

    const row = await (ProjectSchedule as any).create({
      tenant_id: project.tenant_id,
      company_id: project.company_id,
      project_id: project.id,
      title,
      description: req.body.description ? String(req.body.description).trim() : null,
      start_date,
      end_date,
      start_time: req.body.start_time ? String(req.body.start_time).trim() : null,
      end_time: req.body.end_time ? String(req.body.end_time).trim() : null,
      all_day: req.body.all_day !== false && req.body.all_day !== 0,
      type: normalizeScheduleType(req.body.type),
      created_by: req.user!.id,
      is_active: true,
    });

    await logProjectActivity({
      tenant_id: project.tenant_id,
      company_id: project.company_id,
      project_id: project.id,
      actor_id: req.user!.id,
      event_type: 'schedule_created',
      metadata: { schedule_id: row.id, title },
    });

    res.status(201).json({ success: true, data: row });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('일정 생성 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const updateProjectSchedule = async (req: RequestWithUser, res: Response) => {
  try {
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canEditWorkspace(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '일정을 수정할 권한이 없습니다.' });
    }

    const row = await (ProjectSchedule as any).findOne({
      where: { id: Number(req.params.scheduleId), project_id: project.id, is_active: true },
    });
    if (!row) return res.status(404).json({ success: false, message: '일정을 찾을 수 없습니다.' });

    const patch: any = {};
    if (req.body.title != null) {
      const title = String(req.body.title).trim();
      if (!title) return res.status(400).json({ success: false, message: '일정 제목을 입력하세요.' });
      patch.title = title;
    }
    if (req.body.description !== undefined) {
      patch.description = req.body.description ? String(req.body.description).trim() : null;
    }
    if (req.body.start_date !== undefined) {
      const start_date = parseDateOnly(req.body.start_date, '시작일');
      if (!start_date) return res.status(400).json({ success: false, message: '시작일을 입력하세요.' });
      patch.start_date = start_date;
    }
    if (req.body.end_date !== undefined) patch.end_date = parseDateOnly(req.body.end_date, '종료일');
    if (req.body.start_time !== undefined) {
      patch.start_time = req.body.start_time ? String(req.body.start_time).trim() : null;
    }
    if (req.body.end_time !== undefined) {
      patch.end_time = req.body.end_time ? String(req.body.end_time).trim() : null;
    }
    if (req.body.all_day !== undefined) patch.all_day = Boolean(req.body.all_day);
    if (req.body.type !== undefined) patch.type = normalizeScheduleType(req.body.type);

    const nextStart = patch.start_date ?? row.start_date;
    const nextEnd = patch.end_date !== undefined ? patch.end_date : row.end_date;
    if (nextEnd && nextEnd < nextStart) {
      return res.status(400).json({ success: false, message: '종료일은 시작일 이후여야 합니다.' });
    }

    await row.update(patch);
    await logProjectActivity({
      tenant_id: project.tenant_id,
      company_id: project.company_id,
      project_id: project.id,
      actor_id: req.user!.id,
      event_type: 'schedule_updated',
      metadata: { schedule_id: row.id, title: row.title },
    });

    res.json({ success: true, data: row });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('일정 수정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const deleteProjectSchedule = async (req: RequestWithUser, res: Response) => {
  try {
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canEditWorkspace(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '일정을 삭제할 권한이 없습니다.' });
    }

    const row = await (ProjectSchedule as any).findOne({
      where: { id: Number(req.params.scheduleId), project_id: project.id, is_active: true },
    });
    if (!row) return res.status(404).json({ success: false, message: '일정을 찾을 수 없습니다.' });

    await row.update({ is_active: false });
    await row.destroy();
    await logProjectActivity({
      tenant_id: project.tenant_id,
      company_id: project.company_id,
      project_id: project.id,
      actor_id: req.user!.id,
      event_type: 'schedule_deleted',
      metadata: { schedule_id: row.id, title: row.title },
    });

    res.json({ success: true, message: '일정이 삭제되었습니다.' });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('일정 삭제 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const listProjectTasks = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureProjectTaskSchema();
    const { project } = await getProjectWithAccessOrThrow(Number(req.params.id), req.user!);
    const where: any = { project_id: project.id, is_active: true };
    if (req.query.status) where.status = normalizeTaskStatus(req.query.status);
    if (req.query.priority) where.priority = normalizeTaskPriority(req.query.priority);
    const assigneeId = Number(req.query.assignee_id);
    const include: any[] = [
      {
        model: ProjectTaskAssignee,
        as: 'assignees',
        required: Number.isInteger(assigneeId) && assigneeId > 0,
        where:
          Number.isInteger(assigneeId) && assigneeId > 0 ? { user_id: assigneeId } : undefined,
        include: [{ model: User, as: 'user', attributes: userAttrs }],
      },
      { model: User, as: 'creator', attributes: userAttrs },
    ];

    const rows = await (ProjectTask as any).findAll({
      where,
      include,
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('Task 목록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const createProjectTask = async (req: RequestWithUser, res: Response) => {
  const t = await sequelize.transaction();
  try {
    await ensureProjectTaskSchema();
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canEditWorkspace(membership?.role, asAdmin)) {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Task를 등록할 권한이 없습니다.' });
    }

    const title = String(req.body.title || '').trim();
    if (!title) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Task 제목을 입력하세요.' });
    }

    const start_date = parseDateOnly(req.body.start_date, '시작일');
    const due_date = parseDateOnly(req.body.due_date, '마감일');
    if (start_date && due_date && due_date < start_date) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '마감일은 시작일 이후여야 합니다.' });
    }

    const status = normalizeTaskStatus(req.body.status);
    const assigneeIds = parseUserIds(req.body.assignee_ids ?? req.body.assignees);
    await assertActiveProjectMembers(project.id, assigneeIds, t);
    const color = await pickUniqueTaskColor(project.id, req.body.color, t);
    const maxOrder = await (ProjectTask as any).max('sort_order', {
      where: { project_id: project.id, is_active: true },
      transaction: t,
    });
    const sort_order = Number.isFinite(Number(maxOrder)) ? Number(maxOrder) + 1 : 0;

    const task = await (ProjectTask as any).create(
      {
        tenant_id: project.tenant_id,
        company_id: project.company_id,
        project_id: project.id,
        title,
        description: req.body.description ? String(req.body.description).trim() : null,
        start_date,
        due_date,
        status,
        priority: normalizeTaskPriority(req.body.priority),
        color,
        sort_order,
        created_by: req.user!.id,
        completed_at: status === 'completed' ? new Date() : null,
        completed_by: status === 'completed' ? req.user!.id : null,
        is_active: true,
      },
      { transaction: t }
    );

    await syncTaskAssignees({
      taskId: task.id,
      userIds: assigneeIds,
      assignedBy: req.user!.id,
      transaction: t,
    });

    await logProjectActivity({
      tenant_id: project.tenant_id,
      company_id: project.company_id,
      project_id: project.id,
      task_id: task.id,
      actor_id: req.user!.id,
      event_type: 'task_created',
      metadata: { title, status, assignee_ids: assigneeIds },
      transaction: t,
    });

    const progressStats = await recalculateProjectProgress(project.id, t);
    await t.commit();

    for (const uid of assigneeIds) {
      if (uid === req.user!.id) continue;
      pushNotification(
        {
          title: 'Task 배정',
          message: `"${project.name}" · ${title}`,
          type: 'info',
          target_type: 'user',
          target_id: uid,
          tenant_id: project.tenant_id,
          company_id: project.company_id,
          sender_user_id: req.user!.id,
          data: {
            feature: 'project_task',
            project_id: project.id,
            task_id: task.id,
            href: `/work/project-management/${project.id}`,
          },
        },
        (req as any).socketService
      );
    }

    const loaded = await loadTask(task.id, project.id);
    const overdue = await countOverdueTasks(project.id);
    res.status(201).json({
      success: true,
      data: loaded,
      stats: withOverdueStats(progressStats, overdue),
    });
  } catch (error: any) {
    await t.rollback();
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('Task 생성 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const updateProjectTask = async (req: RequestWithUser, res: Response) => {
  const t = await sequelize.transaction();
  try {
    await ensureProjectTaskSchema();
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canEditWorkspace(membership?.role, asAdmin)) {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Task를 수정할 권한이 없습니다.' });
    }

    const task = await (ProjectTask as any).findOne({
      where: { id: Number(req.params.taskId), project_id: project.id, is_active: true },
      transaction: t,
    });
    if (!task) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Task를 찾을 수 없습니다.' });
    }

    const prevStatus = String(task.status);
    const patch: any = {};
    if (req.body.title != null) {
      const title = String(req.body.title).trim();
      if (!title) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Task 제목을 입력하세요.' });
      }
      patch.title = title;
    }
    if (req.body.description !== undefined) {
      patch.description = req.body.description ? String(req.body.description).trim() : null;
    }
    if (req.body.progress_note !== undefined) {
      patch.progress_note = req.body.progress_note ? String(req.body.progress_note).trim() : null;
    }
    if (req.body.start_date !== undefined) patch.start_date = parseDateOnly(req.body.start_date, '시작일');
    if (req.body.due_date !== undefined) patch.due_date = parseDateOnly(req.body.due_date, '마감일');
    if (req.body.priority !== undefined) patch.priority = normalizeTaskPriority(req.body.priority);
    if (req.body.color !== undefined) {
      const nextColor = normalizeTaskColor(req.body.color);
      if (req.body.color === '' || req.body.color == null) {
        patch.color = await pickUniqueTaskColor(project.id, null, t);
      } else if (nextColor) {
        patch.color = nextColor;
      }
    }
    if (req.body.status !== undefined) patch.status = normalizeTaskStatus(req.body.status);

    const nextStart = patch.start_date !== undefined ? patch.start_date : task.start_date;
    const nextDue = patch.due_date !== undefined ? patch.due_date : task.due_date;
    if (nextStart && nextDue && nextDue < nextStart) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '마감일은 시작일 이후여야 합니다.' });
    }

    if (patch.status != null && patch.status !== prevStatus) {
      if (patch.status === 'completed') {
        patch.completed_at = new Date();
        patch.completed_by = req.user!.id;
      } else if (prevStatus === 'completed') {
        patch.completed_at = null;
        patch.completed_by = null;
      }
    }

    await task.update(patch, { transaction: t });

    if (req.body.assignee_ids !== undefined || req.body.assignees !== undefined) {
      const assigneeIds = parseUserIds(req.body.assignee_ids ?? req.body.assignees);
      await assertActiveProjectMembers(project.id, assigneeIds, t);
      await syncTaskAssignees({
        taskId: task.id,
        userIds: assigneeIds,
        assignedBy: req.user!.id,
        transaction: t,
      });
    }

    const eventType =
      patch.status != null && patch.status !== prevStatus ? 'task_status_changed' : 'task_updated';
    await logProjectActivity({
      tenant_id: project.tenant_id,
      company_id: project.company_id,
      project_id: project.id,
      task_id: task.id,
      actor_id: req.user!.id,
      event_type: eventType,
      metadata: {
        title: task.title,
        from_status: prevStatus,
        to_status: patch.status ?? prevStatus,
      },
      transaction: t,
    });

    const progressStats = await recalculateProjectProgress(project.id, t);
    await t.commit();

    const loaded = await loadTask(task.id, project.id);
    const overdue = await countOverdueTasks(project.id);
    res.json({
      success: true,
      data: loaded,
      stats: withOverdueStats(progressStats, overdue),
    });
  } catch (error: any) {
    await t.rollback();
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('Task 수정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const moveProjectTask = async (req: RequestWithUser, res: Response) => {
  const t = await sequelize.transaction();
  try {
    await ensureProjectTaskSchema();
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canEditWorkspace(membership?.role, asAdmin)) {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Task 순서를 변경할 권한이 없습니다.' });
    }

    const direction = String(req.body.direction || '').trim().toLowerCase();
    if (direction !== 'up' && direction !== 'down') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'direction은 up 또는 down 이어야 합니다.' });
    }

    const tasks = await (ProjectTask as any).findAll({
      where: { project_id: project.id, is_active: true },
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
      transaction: t,
    });

    const taskId = Number(req.params.taskId);
    const index = tasks.findIndex((row: any) => Number(row.id) === taskId);
    if (index < 0) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Task를 찾을 수 없습니다.' });
    }

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= tasks.length) {
      await t.rollback();
      return res.json({ success: true, data: tasks });
    }

    const ordered = [...tasks];
    const tmp = ordered[index];
    ordered[index] = ordered[swapIndex];
    ordered[swapIndex] = tmp;

    for (let i = 0; i < ordered.length; i += 1) {
      if (Number(ordered[i].sort_order) !== i) {
        await ordered[i].update({ sort_order: i }, { transaction: t });
      }
    }

    await t.commit();

    const rows = await (ProjectTask as any).findAll({
      where: { project_id: project.id, is_active: true },
      include: [
        {
          model: ProjectTaskAssignee,
          as: 'assignees',
          required: false,
          include: [{ model: User, as: 'user', attributes: userAttrs }],
        },
      ],
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    await t.rollback();
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('Task 이동 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const deleteProjectTask = async (req: RequestWithUser, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canManageWorkspace(membership?.role, asAdmin) && !canEditWorkspace(membership?.role, asAdmin)) {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Task를 삭제할 권한이 없습니다.' });
    }

    const task = await (ProjectTask as any).findOne({
      where: { id: Number(req.params.taskId), project_id: project.id, is_active: true },
      transaction: t,
    });
    if (!task) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Task를 찾을 수 없습니다.' });
    }

    await task.update({ is_active: false }, { transaction: t });
    await task.destroy({ transaction: t });
    await logProjectActivity({
      tenant_id: project.tenant_id,
      company_id: project.company_id,
      project_id: project.id,
      task_id: task.id,
      actor_id: req.user!.id,
      event_type: 'task_deleted',
      metadata: { title: task.title },
      transaction: t,
    });

    const progressStats = await recalculateProjectProgress(project.id, t);
    await t.commit();
    const overdue = await countOverdueTasks(project.id);
    res.json({
      success: true,
      message: 'Task가 삭제되었습니다.',
      stats: withOverdueStats(progressStats, overdue),
    });
  } catch (error: any) {
    await t.rollback();
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('Task 삭제 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const listProjectActivities = async (req: RequestWithUser, res: Response) => {
  try {
    const { project } = await getProjectWithAccessOrThrow(Number(req.params.id), req.user!);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const rows = await (ProjectActivity as any).findAll({
      where: { project_id: project.id },
      include: [
        { model: User, as: 'actor', attributes: userAttrs },
        { model: ProjectTask, as: 'task', attributes: ['id', 'title'], required: false },
      ],
      order: [['created_at', 'DESC']],
      limit,
    });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('활동 목록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const getProjectTask = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureProjectTaskSchema();
    const { project } = await getProjectWithAccessOrThrow(Number(req.params.id), req.user!);
    const task = await loadTask(Number(req.params.taskId), project.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task를 찾을 수 없습니다.' });
    const json = task.toJSON ? task.toJSON() : task;
    res.json({
      success: true,
      data: {
        ...json,
        attachments: normalizeTaskAttachments(json.attachments),
      },
    });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('Task 상세 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const listProjectTaskComments = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureProjectTaskSchema();
    const { project } = await getProjectWithAccessOrThrow(Number(req.params.id), req.user!);
    const task = await (ProjectTask as any).findOne({
      where: { id: Number(req.params.taskId), project_id: project.id, is_active: true },
    });
    if (!task) return res.status(404).json({ success: false, message: 'Task를 찾을 수 없습니다.' });

    const rows = await (ProjectTaskComment as any).findAll({
      where: { task_id: task.id },
      include: [{ model: User, as: 'user', attributes: userAttrs }],
      order: [['created_at', 'ASC']],
    });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('Task 댓글 목록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const createProjectTaskComment = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureProjectTaskSchema();
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canEditWorkspace(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '댓글을 작성할 권한이 없습니다.' });
    }

    const task = await (ProjectTask as any).findOne({
      where: { id: Number(req.params.taskId), project_id: project.id, is_active: true },
    });
    if (!task) return res.status(404).json({ success: false, message: 'Task를 찾을 수 없습니다.' });

    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ success: false, message: '댓글 내용을 입력하세요.' });

    let parentId: number | null = null;
    const rawParent = req.body.parent_id ?? req.body.parentId;
    if (rawParent != null && String(rawParent).trim() !== '') {
      parentId = Number(rawParent);
      if (!Number.isInteger(parentId) || parentId <= 0) {
        return res.status(400).json({ success: false, message: '잘못된 원댓글입니다.' });
      }
      const parent = await (ProjectTaskComment as any).findOne({
        where: { id: parentId, task_id: task.id },
      });
      if (!parent) {
        return res.status(404).json({ success: false, message: '원댓글을 찾을 수 없습니다.' });
      }
      // 1단계 답글만 허용
      if (parent.parent_id != null) {
        return res.status(400).json({
          success: false,
          message: '답글에는 다시 답글을 달 수 없습니다. 원댓글에 답글해 주세요.',
        });
      }
    }

    const row = await (ProjectTaskComment as any).create({
      task_id: task.id,
      user_id: req.user!.id,
      parent_id: parentId,
      content,
    });

    await logProjectActivity({
      tenant_id: project.tenant_id,
      company_id: project.company_id,
      project_id: project.id,
      task_id: task.id,
      actor_id: req.user!.id,
      event_type: parentId ? 'task_comment_reply_added' : 'task_comment_added',
      metadata: { title: task.title, parent_id: parentId },
    });

    const loaded = await (ProjectTaskComment as any).findByPk(row.id, {
      include: [{ model: User, as: 'user', attributes: userAttrs }],
    });

    try {
      const actorName =
        String((req.user as any)?.username || (req.user as any)?.userid || 'Someone').trim() ||
        'Someone';
      const taskTitle = String(task.title || 'Task');
      const projectName = String(project.name || '');
      const href = `/work/project-management/${project.id}`;
      const preview = content.replace(/\s+/g, ' ').trim().slice(0, 100);
      const notifyIds = new Set<number>();

      if (parentId) {
        const parent = await (ProjectTaskComment as any).findByPk(parentId, {
          attributes: ['id', 'user_id'],
        });
        const parentAuthorId = parent?.user_id != null ? Number(parent.user_id) : null;
        if (parentAuthorId && parentAuthorId !== Number(req.user!.id)) {
          notifyIds.add(parentAuthorId);
          pushNotification(
            {
              title: '프로젝트 댓글 답글',
              message: `${actorName}님이 "${taskTitle}" 댓글에 답글을 남겼습니다.`,
              type: 'info',
              target_type: 'user',
              target_id: parentAuthorId,
              tenant_id: project.tenant_id,
              company_id: project.company_id,
              sender_user_id: req.user!.id,
              data: {
                feature: 'project_task_comment_reply',
                project_id: project.id,
                task_id: task.id,
                comment_id: row.id,
                parent_comment_id: parentId,
                actor_name: actorName,
                href,
                title_en: 'Project task comment reply',
                message_en: `${actorName} replied to your comment on "${taskTitle}"${
                  projectName ? ` (${projectName})` : ''
                }.${preview ? `\n"${preview}"` : ''}`,
              },
            },
            (req as any).socketService
          );
        }
      }

      const assignees = await (ProjectTaskAssignee as any).findAll({
        where: { task_id: task.id },
        attributes: ['user_id'],
      });
      for (const a of assignees) {
        const uid = Number(a.user_id);
        if (!Number.isFinite(uid) || uid <= 0) continue;
        if (uid === Number(req.user!.id)) continue;
        if (notifyIds.has(uid)) continue;
        notifyIds.add(uid);
        pushNotification(
          {
            title: '프로젝트 댓글',
            message: `${actorName}님이 "${taskTitle}"에 댓글을 남겼습니다.`,
            type: 'info',
            target_type: 'user',
            target_id: uid,
            tenant_id: project.tenant_id,
            company_id: project.company_id,
            sender_user_id: req.user!.id,
            data: {
              feature: 'project_task_comment',
              project_id: project.id,
              task_id: task.id,
              comment_id: row.id,
              actor_name: actorName,
              href,
              title_en: 'Project task comment',
              message_en: `${actorName} commented on "${taskTitle}"${
                projectName ? ` (${projectName})` : ''
              }.${preview ? `\n"${preview}"` : ''}`,
            },
          },
          (req as any).socketService
        );
      }
    } catch (notifyErr) {
      console.error('project task comment notify:', (notifyErr as Error)?.message || notifyErr);
    }

    res.status(201).json({ success: true, data: loaded });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('Task 댓글 작성 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const deleteProjectTaskComment = async (req: RequestWithUser, res: Response) => {
  try {
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canEditWorkspace(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '댓글을 삭제할 권한이 없습니다.' });
    }

    const task = await (ProjectTask as any).findOne({
      where: { id: Number(req.params.taskId), project_id: project.id, is_active: true },
    });
    if (!task) return res.status(404).json({ success: false, message: 'Task를 찾을 수 없습니다.' });

    const comment = await (ProjectTaskComment as any).findOne({
      where: { id: Number(req.params.commentId), task_id: task.id },
    });
    if (!comment) return res.status(404).json({ success: false, message: '댓글을 찾을 수 없습니다.' });

    const isOwner = Number(comment.user_id) === Number(req.user!.id);
    if (!isOwner && !canManageWorkspace(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '본인 댓글만 삭제할 수 있습니다.' });
    }

    // 원댓글 삭제 시 답글도 소프트 삭제
    if (comment.parent_id == null) {
      await (ProjectTaskComment as any).destroy({
        where: { parent_id: comment.id, task_id: task.id },
      });
    }
    await comment.destroy();
    res.json({ success: true, message: '댓글이 삭제되었습니다.' });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('Task 댓글 삭제 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const uploadProjectTaskAttachments = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureProjectTaskSchema();
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canEditWorkspace(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '첨부를 업로드할 권한이 없습니다.' });
    }

    const task = await (ProjectTask as any).findOne({
      where: { id: Number(req.params.taskId), project_id: project.id, is_active: true },
    });
    if (!task) return res.status(404).json({ success: false, message: 'Task를 찾을 수 없습니다.' });

    const files = ((req as any).files || []) as Express.Multer.File[];
    if (!files.length) {
      return res.status(400).json({ success: false, message: '파일이 필요합니다.' });
    }

    const attachments = normalizeTaskAttachments(task.attachments);
    if (attachments.length + files.length > MAX_TASK_ATTACHMENTS) {
      return res.status(400).json({
        success: false,
        message: `첨부는 최대 ${MAX_TASK_ATTACHMENTS}개까지 가능합니다.`,
      });
    }

    const added: TaskAttachmentRecord[] = [];
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
        path: `project-tasks/${task.id}/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
    }

    if (added.length === 0) {
      return res.status(400).json({ success: false, message: '업로드할 수 있는 파일이 없습니다.' });
    }

    const nextAttachments = [...attachments, ...added];
    await task.update({ attachments: nextAttachments });
    await logProjectActivity({
      tenant_id: project.tenant_id,
      company_id: project.company_id,
      project_id: project.id,
      task_id: task.id,
      actor_id: req.user!.id,
      event_type: 'task_attachment_added',
      metadata: { title: task.title, count: added.length },
    });

    res.json({ success: true, data: { attachments: nextAttachments } });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('Task 첨부 업로드 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const deleteProjectTaskAttachment = async (req: RequestWithUser, res: Response) => {
  try {
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canEditWorkspace(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '첨부를 삭제할 권한이 없습니다.' });
    }

    const task = await (ProjectTask as any).findOne({
      where: { id: Number(req.params.taskId), project_id: project.id, is_active: true },
    });
    if (!task) return res.status(404).json({ success: false, message: 'Task를 찾을 수 없습니다.' });

    const storedName = String(req.params.storedName || '').trim();
    if (!storedName || storedName.includes('..')) {
      return res.status(400).json({ success: false, message: '첨부 정보가 올바르지 않습니다.' });
    }

    const attachments = normalizeTaskAttachments(task.attachments);
    const target = attachments.find((row) => row.storedName === storedName);
    if (!target) return res.status(404).json({ success: false, message: '첨부를 찾을 수 없습니다.' });

    const nextAttachments = attachments.filter((row) => row.storedName !== storedName);
    await task.update({ attachments: nextAttachments });

    try {
      const uploadRoot = ensureUploadRoot();
      const absolutePath = path.join(uploadRoot, target.path.replace(/^\/+/, ''));
      if (absolutePath.startsWith(uploadRoot) && fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (unlinkError) {
      console.warn('deleteProjectTaskAttachment unlink:', unlinkError);
    }

    res.json({ success: true, data: { attachments: nextAttachments } });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: error.message });
    console.error('Task 첨부 삭제 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};
