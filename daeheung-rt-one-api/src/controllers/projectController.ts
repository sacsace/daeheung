import { Response } from 'express';
import { RequestWithUser } from '../types';
import { Project, ProjectMember, User } from '../models';
import { DataTypes, Op } from 'sequelize';
import sequelize from '../config/database';
import {
  canEditProject,
  canManageMembers,
  ensureProjectMember,
  generateProjectCode,
  getProjectWithAccessOrThrow,
  isSystemProjectAdmin,
  listAccessibleProjectIds,
  normalizeMemberRole,
  normalizeProjectPriority,
  normalizeProjectStatus,
  PROJECT_MEMBER_ROLES,
} from '../services/projectMembershipService';
import { pushNotification } from './notificationController';

const memberUserAttrs = ['id', 'username', 'email', 'department', 'position', 'avatar_url'];

let projectSchemaReady: Promise<void> | null = null;

async function ensureProjectSchema(): Promise<void> {
  if (!projectSchemaReady) {
    projectSchemaReady = (async () => {
      const qi = sequelize.getQueryInterface();
      try {
        const table = await qi.describeTable('projects');
        if (!table.sort_order) {
          await qi.addColumn('projects', 'sort_order', {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          });
          const rows = await (Project as any).findAll({
            where: { is_active: true },
            order: [
              ['company_id', 'ASC'],
              ['start_date', 'DESC'],
              ['id', 'DESC'],
            ],
            attributes: ['id', 'company_id'],
          });
          let lastCompany: number | null = null;
          let order = 0;
          for (const row of rows) {
            const companyId = Number(row.company_id);
            if (lastCompany !== companyId) {
              lastCompany = companyId;
              order = 0;
            }
            await row.update({ sort_order: order });
            order += 1;
          }
        }
      } catch (error) {
        console.warn('ensureProjectSchema columns:', error);
        projectSchemaReady = null;
      }
    })();
  }
  await projectSchemaReady;
}

function companyScopeWhere(user: any, companyIdQuery?: unknown) {
  const where: any = { is_active: true };
  const role = user?.role;
  if (role === 'root') {
    if (companyIdQuery) where.company_id = Number(companyIdQuery);
  } else if (role === 'audit') {
    if (user.tenant_id) where.tenant_id = user.tenant_id;
    if (user.company_id) where.company_id = user.company_id;
  } else {
    where.tenant_id = user.tenant_id;
    where.company_id = user.company_id;
  }
  return where;
}

export const getProjects = async (req: RequestWithUser, res: Response) => {
  try {
    await ensureProjectSchema();
    const user = req.user!;
    const { page = 1, limit = 10, status = '', manager_id = '', company_id, q = '' } = req.query;

    const whereClause: any = companyScopeWhere(user, company_id);
    if (status) whereClause.status = normalizeProjectStatus(status);
    if (manager_id) whereClause.project_manager = Number(manager_id);

    const search = String(q || '').trim();
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { project_code: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const accessible = await listAccessibleProjectIds(user);
    if (accessible !== 'all') {
      if (accessible.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
        });
      }
      whereClause.id = { [Op.in]: accessible };
    }

    const projects = await (Project as any).findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'manager',
          attributes: memberUserAttrs,
        },
        {
          model: ProjectMember,
          as: 'members',
          where: { is_active: true, status: 'active' },
          required: false,
          attributes: ['id', 'user_id', 'role', 'status'],
          include: [{ model: User, as: 'user', attributes: memberUserAttrs }],
        },
      ],
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
      // 기본: 기획 → 진행중 → 보류 → 완료 → 취소, 이후 수동 순서
      order: [
        [
          sequelize.literal(`CASE "Project"."status"
            WHEN 'planning' THEN 0
            WHEN 'in_progress' THEN 1
            WHEN 'on_hold' THEN 2
            WHEN 'completed' THEN 3
            WHEN 'cancelled' THEN 4
            ELSE 5 END`),
          'ASC',
        ],
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
      distinct: true,
    });

    res.json({
      success: true,
      data: projects.rows,
      pagination: {
        total: projects.count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(projects.count / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('프로젝트 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getProject = async (req: RequestWithUser, res: Response) => {
  try {
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );

    const members = await (ProjectMember as any).findAll({
      where: {
        project_id: project.id,
        is_active: true,
        status: 'active',
      },
      include: [{ model: User, as: 'user', attributes: memberUserAttrs }],
      order: [
        ['role', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    const json = project.toJSON ? project.toJSON() : project;
    res.json({
      success: true,
      data: {
        ...json,
        members,
        my_role: membership?.role || (asAdmin ? 'admin' : null),
      },
    });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('프로젝트 상세 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const createProject = async (req: RequestWithUser, res: Response) => {
  const t = await sequelize.transaction();
  try {
    await ensureProjectSchema();
    const user = req.user!;
    const tenant_id = user.tenant_id!;
    const company_id = user.company_id!;
    const user_id = user.id;

    const name = String(req.body.name || '').trim();
    if (!name) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '프로젝트명을 입력하세요.' });
    }

    const start_date = String(req.body.start_date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '시작일 형식이 올바르지 않습니다.' });
    }

    const end_date = req.body.end_date ? String(req.body.end_date).trim() : null;
    if (end_date && end_date < start_date) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '종료일은 시작일 이후여야 합니다.' });
    }

    const project_manager = Number(req.body.project_manager || user_id);
    if (!Number.isInteger(project_manager) || project_manager <= 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '프로젝트 관리자를 선택하세요.' });
    }

    const managerUser = await (User as any).findOne({
      where: {
        id: project_manager,
        tenant_id,
        company_id,
        status: 'active',
      },
      transaction: t,
    });
    if (!managerUser) {
      await t.rollback();
      return res.status(400).json({ success: false, message: '유효한 프로젝트 관리자가 아닙니다.' });
    }

    const project_code = await generateProjectCode(tenant_id, company_id, t);

    const maxOrder = await (Project as any).max('sort_order', {
      where: { tenant_id, company_id, is_active: true },
      transaction: t,
    });
    const sort_order = Number.isFinite(Number(maxOrder)) ? Number(maxOrder) + 1 : 0;

    const project = await (Project as any).create(
      {
        tenant_id,
        company_id,
        project_code,
        name,
        description: req.body.description ? String(req.body.description).trim() : null,
        status: normalizeProjectStatus(req.body.status),
        priority: normalizeProjectPriority(req.body.priority),
        start_date,
        end_date,
        budget: Number(req.body.budget || 0) || 0,
        actual_cost: 0,
        progress: 0,
        project_manager,
        created_by: user_id,
        sort_order,
        is_active: true,
      },
      { transaction: t }
    );

    await ensureProjectMember(
      {
        tenant_id,
        company_id,
        project_id: project.id,
        user_id: project_manager,
        role: 'owner',
        invited_by: user_id,
      },
      t
    );

    if (user_id !== project_manager) {
      await ensureProjectMember(
        {
          tenant_id,
          company_id,
          project_id: project.id,
          user_id,
          role: 'manager',
          invited_by: user_id,
        },
        t
      );
    }

    const inviteUserIds: number[] = Array.isArray(req.body.member_user_ids)
      ? req.body.member_user_ids.map((id: any) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];
    const inviteRole = normalizeMemberRole(req.body.member_role || 'member');

    for (const inviteId of Array.from(new Set(inviteUserIds))) {
      if (inviteId === project_manager || inviteId === user_id) continue;
      const invitee = await (User as any).findOne({
        where: { id: inviteId, tenant_id, company_id, status: 'active' },
        transaction: t,
      });
      if (!invitee) continue;
      await ensureProjectMember(
        {
          tenant_id,
          company_id,
          project_id: project.id,
          user_id: inviteId,
          role: inviteRole === 'owner' ? 'member' : inviteRole,
          invited_by: user_id,
        },
        t
      );
      pushNotification(
        {
          title: '프로젝트 초대',
          message: `"${name}" 프로젝트에 초대되었습니다.`,
          type: 'info',
          target_type: 'user',
          target_id: inviteId,
          tenant_id,
          company_id,
          sender_user_id: user_id,
          data: {
            feature: 'project',
            project_id: project.id,
            href: `/work/project-management/${project.id}`,
          },
        },
        (req as any).socketService
      );
    }

    await t.commit();

    const created = await (Project as any).findByPk(project.id, {
      include: [
        { model: User, as: 'manager', attributes: memberUserAttrs },
        {
          model: ProjectMember,
          as: 'members',
          where: { is_active: true, status: 'active' },
          required: false,
          include: [{ model: User, as: 'user', attributes: memberUserAttrs }],
        },
      ],
    });

    res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    await t.rollback();
    console.error('프로젝트 생성 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const updateProject = async (req: RequestWithUser, res: Response) => {
  try {
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canEditProject(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '프로젝트를 수정할 권한이 없습니다.' });
    }

    const patch: Record<string, any> = {};
    if (req.body.name != null) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: '프로젝트명을 입력하세요.' });
      patch.name = name;
    }
    if (req.body.description !== undefined) {
      patch.description = req.body.description ? String(req.body.description).trim() : null;
    }
    if (req.body.start_date != null) {
      const start_date = String(req.body.start_date).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
        return res.status(400).json({ success: false, message: '시작일 형식이 올바르지 않습니다.' });
      }
      patch.start_date = start_date;
    }
    if (req.body.end_date !== undefined) {
      patch.end_date = req.body.end_date ? String(req.body.end_date).trim() : null;
    }
    if (req.body.status != null) patch.status = normalizeProjectStatus(req.body.status);
    if (req.body.priority != null) patch.priority = normalizeProjectPriority(req.body.priority);
    if (req.body.budget != null) patch.budget = Number(req.body.budget) || 0;

    const nextStart = patch.start_date || project.start_date;
    const nextEnd = patch.end_date !== undefined ? patch.end_date : project.end_date;
    if (nextEnd && nextStart && String(nextEnd) < String(nextStart)) {
      return res.status(400).json({ success: false, message: '종료일은 시작일 이후여야 합니다.' });
    }

    if (req.body.project_manager != null) {
      const project_manager = Number(req.body.project_manager);
      if (!Number.isInteger(project_manager) || project_manager <= 0) {
        return res.status(400).json({ success: false, message: '프로젝트 관리자가 올바르지 않습니다.' });
      }
      patch.project_manager = project_manager;
      await ensureProjectMember({
        tenant_id: project.tenant_id,
        company_id: project.company_id,
        project_id: project.id,
        user_id: project_manager,
        role: 'owner',
        invited_by: req.user!.id,
      });
    }

    // progress는 Task 기반 자동 계산 — 수동 덮어쓰기 무시 (Phase 11까지 0 유지 가능)
    delete patch.progress;
    delete patch.project_code;

    await project.update(patch);
    if (patch.project_manager != null) {
      await project.reload({
        include: [
          {
            model: User,
            as: 'manager',
            attributes: memberUserAttrs,
          },
        ],
      });
    }
    res.json({ success: true, data: project });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('프로젝트 수정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const deleteProject = async (req: RequestWithUser, res: Response) => {
  try {
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!asAdmin && membership?.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Owner만 프로젝트를 비활성화할 수 있습니다.' });
    }
    await project.update({ is_active: false });
    res.json({ success: true, message: '프로젝트가 비활성화되었습니다.' });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('프로젝트 삭제 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const moveProject = async (req: RequestWithUser, res: Response) => {
  const t = await sequelize.transaction();
  try {
    await ensureProjectSchema();
    const user = req.user!;
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      user
    );
    if (!canEditProject(membership?.role, asAdmin)) {
      await t.rollback();
      return res.status(403).json({ success: false, message: '프로젝트 순서를 변경할 권한이 없습니다.' });
    }

    const direction = String(req.body.direction || '').trim().toLowerCase();
    if (direction !== 'up' && direction !== 'down') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'direction은 up 또는 down 이어야 합니다.' });
    }

    const where: any = {
      tenant_id: project.tenant_id,
      company_id: project.company_id,
      is_active: true,
    };
    const accessible = await listAccessibleProjectIds(user);
    if (accessible !== 'all') {
      if (accessible.length === 0) {
        await t.rollback();
        return res.status(403).json({ success: false, message: '프로젝트 순서를 변경할 권한이 없습니다.' });
      }
      where.id = { [Op.in]: accessible };
    }

    const projects = await (Project as any).findAll({
      where,
      order: [
        [
          sequelize.literal(`CASE "Project"."status"
            WHEN 'planning' THEN 0
            WHEN 'in_progress' THEN 1
            WHEN 'on_hold' THEN 2
            WHEN 'completed' THEN 3
            WHEN 'cancelled' THEN 4
            ELSE 5 END`),
          'ASC',
        ],
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
      transaction: t,
    });

    const index = projects.findIndex((row: any) => Number(row.id) === Number(project.id));
    if (index < 0) {
      await t.rollback();
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' });
    }

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= projects.length) {
      await t.commit();
      return res.json({
        success: true,
        data: projects.map((row: any) => ({ id: row.id, sort_order: row.sort_order })),
      });
    }

    const ordered = [...projects];
    const tmp = ordered[index];
    ordered[index] = ordered[swapIndex];
    ordered[swapIndex] = tmp;

    for (let i = 0; i < ordered.length; i += 1) {
      if (Number(ordered[i].sort_order) !== i) {
        await ordered[i].update({ sort_order: i }, { transaction: t });
      }
    }

    await t.commit();
    res.json({
      success: true,
      data: ordered.map((row: any) => ({ id: row.id, sort_order: Number(row.sort_order) || 0 })),
    });
  } catch (error: any) {
    await t.rollback();
    const status = error?.status || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('프로젝트 이동 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const getProjectMembers = async (req: RequestWithUser, res: Response) => {
  try {
    const { project } = await getProjectWithAccessOrThrow(Number(req.params.id), req.user!);
    const members = await (ProjectMember as any).findAll({
      where: { project_id: project.id, is_active: true, status: 'active' },
      include: [{ model: User, as: 'user', attributes: memberUserAttrs }],
      order: [
        ['role', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    res.json({ success: true, data: members });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('프로젝트 멤버 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const addProjectMembers = async (req: RequestWithUser, res: Response) => {
  try {
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(
      Number(req.params.id),
      req.user!
    );
    if (!canManageMembers(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '멤버를 추가할 권한이 없습니다.' });
    }

    const userIds: number[] = Array.isArray(req.body.user_ids)
      ? req.body.user_ids.map((id: any) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : req.body.user_id
        ? [Number(req.body.user_id)]
        : [];
    if (userIds.length === 0) {
      return res.status(400).json({ success: false, message: '추가할 사용자를 선택하세요.' });
    }

    let role = normalizeMemberRole(req.body.role || 'member');
    if (role === 'owner' && !asAdmin && membership?.role !== 'owner') {
      role = 'manager';
    }

    const added: any[] = [];
    for (const userId of Array.from(new Set(userIds))) {
      const invitee = await (User as any).findOne({
        where: {
          id: userId,
          tenant_id: project.tenant_id,
          company_id: project.company_id,
          status: 'active',
        },
      });
      if (!invitee) continue;

      const row = await ensureProjectMember({
        tenant_id: project.tenant_id,
        company_id: project.company_id,
        project_id: project.id,
        user_id: userId,
        role,
        invited_by: req.user!.id,
      });
      added.push(row);

      pushNotification(
        {
          title: '프로젝트 초대',
          message: `"${project.name}" 프로젝트에 초대되었습니다.`,
          type: 'info',
          target_type: 'user',
          target_id: userId,
          tenant_id: project.tenant_id,
          company_id: project.company_id,
          sender_user_id: req.user!.id,
          data: {
            feature: 'project',
            project_id: project.id,
            href: `/work/project-management/${project.id}`,
          },
        },
        (req as any).socketService
      );
    }

    res.status(201).json({ success: true, data: added });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('프로젝트 멤버 추가 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const updateProjectMember = async (req: RequestWithUser, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const memberId = Number(req.params.memberId);
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(projectId, req.user!);
    if (!canManageMembers(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '멤버 역할을 변경할 권한이 없습니다.' });
    }

    const target = await (ProjectMember as any).findOne({
      where: { id: memberId, project_id: project.id, is_active: true, status: 'active' },
    });
    if (!target) {
      return res.status(404).json({ success: false, message: '멤버를 찾을 수 없습니다.' });
    }

    const role = normalizeMemberRole(req.body.role);
    if (target.role === 'owner' && role !== 'owner') {
      const ownerCount = await (ProjectMember as any).count({
        where: { project_id: project.id, role: 'owner', is_active: true, status: 'active' },
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ success: false, message: '마지막 Owner의 역할은 변경할 수 없습니다.' });
      }
    }

    await target.update({ role });
    res.json({ success: true, data: target });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('프로젝트 멤버 수정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const removeProjectMember = async (req: RequestWithUser, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const memberId = Number(req.params.memberId);
    const { project, membership, asAdmin } = await getProjectWithAccessOrThrow(projectId, req.user!);
    if (!canManageMembers(membership?.role, asAdmin)) {
      return res.status(403).json({ success: false, message: '멤버를 제거할 권한이 없습니다.' });
    }

    const target = await (ProjectMember as any).findOne({
      where: { id: memberId, project_id: project.id, is_active: true, status: 'active' },
    });
    if (!target) {
      return res.status(404).json({ success: false, message: '멤버를 찾을 수 없습니다.' });
    }

    if (target.role === 'owner') {
      const ownerCount = await (ProjectMember as any).count({
        where: { project_id: project.id, role: 'owner', is_active: true, status: 'active' },
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ success: false, message: '마지막 Owner는 제거할 수 없습니다.' });
      }
    }

    await target.update({ is_active: false, status: 'removed' });
    await target.destroy(); // paranoid soft delete
    res.json({ success: true, message: '멤버가 제거되었습니다.' });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('프로젝트 멤버 제거 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export { isSystemProjectAdmin, PROJECT_MEMBER_ROLES };
