import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../types';
import CompanyCalendarSchedule from '../models/CompanyCalendarSchedule';
import User from '../models/User';

const toDateOnly = (value: unknown): string | null => {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const serialize = (row: CompanyCalendarSchedule) => ({
  id: row.id,
  scheduleDate: row.schedule_date,
  title: row.title,
  isHoliday: Boolean(row.is_holiday),
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** 기존 users.settings.ui.calendarSchedules → 회사 공통 테이블 1회 이관 */
const migrateLegacySchedulesIfEmpty = async (
  tenantId: number,
  companyId: number,
  actorUserId?: number
) => {
  const existingCount = await CompanyCalendarSchedule.count({
    where: { tenant_id: tenantId, company_id: companyId, is_active: true },
  });
  if (existingCount > 0) return;

  const users = await User.findAll({
    where: { tenant_id: tenantId, company_id: companyId },
    attributes: ['id', 'settings'],
  });

  const seen = new Set<string>();
  const toCreate: Array<{
    tenant_id: number;
    company_id: number;
    schedule_date: string;
    title: string;
    is_holiday: boolean;
    created_by: number | null;
    updated_by: number | null;
    is_active: boolean;
  }> = [];

  for (const u of users) {
    const settings = (u.settings || {}) as Record<string, any>;
    const schedules = settings?.ui?.calendarSchedules;
    if (!schedules || typeof schedules !== 'object') continue;

    for (const [dateKey, list] of Object.entries(schedules as Record<string, unknown>)) {
      const dateOnly = toDateOnly(dateKey);
      if (!dateOnly || !Array.isArray(list)) continue;
      for (const item of list as any[]) {
        const title = String(item?.title || '').trim();
        if (!title) continue;
        const isHoliday = item?.type === 'company_holiday';
        const key = `${dateOnly}|${title}|${isHoliday ? 1 : 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        toCreate.push({
          tenant_id: tenantId,
          company_id: companyId,
          schedule_date: dateOnly,
          title,
          is_holiday: isHoliday,
          created_by: actorUserId ?? u.id ?? null,
          updated_by: actorUserId ?? u.id ?? null,
          is_active: true,
        });
      }
    }
  }

  if (toCreate.length === 0) return;
  await CompanyCalendarSchedule.bulkCreate(toCreate as any);
};

export const listCompanyCalendarSchedules = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const companyId = req.user!.company_id;
    const { from, to } = req.query;

    await migrateLegacySchedulesIfEmpty(tenantId, companyId, req.user?.id);

    const where: any = {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
    };

    const fromDate = toDateOnly(from);
    const toDate = toDateOnly(to);
    if (fromDate || toDate) {
      where.schedule_date = {};
      if (fromDate) where.schedule_date[Op.gte] = fromDate;
      if (toDate) where.schedule_date[Op.lte] = toDate;
    }

    const rows = await CompanyCalendarSchedule.findAll({
      where,
      order: [
        ['schedule_date', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    return res.json({ success: true, data: rows.map(serialize) });
  } catch (error: any) {
    console.error('listCompanyCalendarSchedules:', error);
    return res.status(500).json({
      success: false,
      message: '회사 스케줄을 불러오지 못했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
};

export const createCompanyCalendarSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const companyId = req.user!.company_id;
    const userId = req.user!.id;
    const title = String(req.body?.title || '').trim();
    const scheduleDate = toDateOnly(req.body?.scheduleDate ?? req.body?.schedule_date);
    const isHoliday = Boolean(req.body?.isHoliday ?? req.body?.is_holiday);

    if (!title || !scheduleDate) {
      return res.status(400).json({ success: false, message: '날짜와 내용을 입력하세요.' });
    }

    const row = await CompanyCalendarSchedule.create({
      tenant_id: tenantId,
      company_id: companyId,
      schedule_date: scheduleDate,
      title,
      is_holiday: isHoliday,
      created_by: userId,
      updated_by: userId,
      is_active: true,
    });

    return res.status(201).json({ success: true, data: serialize(row) });
  } catch (error: any) {
    console.error('createCompanyCalendarSchedule:', error);
    return res.status(500).json({
      success: false,
      message: '회사 스케줄을 저장하지 못했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
};

export const updateCompanyCalendarSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const companyId = req.user!.company_id;
    const userId = req.user!.id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: '잘못된 요청입니다.' });
    }

    const row = await CompanyCalendarSchedule.findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '스케줄을 찾을 수 없습니다.' });
    }

    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) {
        return res.status(400).json({ success: false, message: '내용을 입력하세요.' });
      }
      row.title = title;
    }
    if (req.body?.scheduleDate != null || req.body?.schedule_date != null) {
      const scheduleDate = toDateOnly(req.body?.scheduleDate ?? req.body?.schedule_date);
      if (!scheduleDate) {
        return res.status(400).json({ success: false, message: '날짜 형식이 올바르지 않습니다.' });
      }
      row.schedule_date = scheduleDate;
    }
    if (req.body?.isHoliday != null || req.body?.is_holiday != null) {
      row.is_holiday = Boolean(req.body?.isHoliday ?? req.body?.is_holiday);
    }
    row.updated_by = userId;
    await row.save();

    return res.json({ success: true, data: serialize(row) });
  } catch (error: any) {
    console.error('updateCompanyCalendarSchedule:', error);
    return res.status(500).json({
      success: false,
      message: '회사 스케줄을 수정하지 못했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
};

export const deleteCompanyCalendarSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const companyId = req.user!.company_id;
    const userId = req.user!.id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: '잘못된 요청입니다.' });
    }

    const row = await CompanyCalendarSchedule.findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '스케줄을 찾을 수 없습니다.' });
    }

    row.is_active = false;
    row.updated_by = userId;
    await row.save();

    return res.json({ success: true });
  } catch (error: any) {
    console.error('deleteCompanyCalendarSchedule:', error);
    return res.status(500).json({
      success: false,
      message: '회사 스케줄을 삭제하지 못했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
};

/** 회사 내 다른 사용자의 공개 개인 스케줄 */
export const listPublicPersonalCalendarSchedules = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const companyId = req.user!.company_id;
    const myId = req.user!.id;
    const { from, to } = req.query;
    const fromDate = toDateOnly(from);
    const toDate = toDateOnly(to);

    const users = await User.findAll({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        id: { [Op.ne]: myId },
      },
      attributes: ['id', 'username', 'settings'],
    });

    const items: Array<{
      id: string;
      scheduleDate: string;
      title: string;
      isHoliday: boolean;
      ownerId: number;
      ownerName: string;
      isPublic: true;
      source: 'personal_public';
    }> = [];

    for (const u of users) {
      const settings = (u.settings || {}) as Record<string, any>;
      const schedules = settings?.ui?.calendarSchedules;
      if (!schedules || typeof schedules !== 'object') continue;
      const ownerName = String(u.username || 'User');

      for (const [dateKey, list] of Object.entries(schedules as Record<string, unknown>)) {
        const dateOnly = toDateOnly(dateKey);
        if (!dateOnly || !Array.isArray(list)) continue;
        if (fromDate && dateOnly < fromDate) continue;
        if (toDate && dateOnly > toDate) continue;

        for (const item of list as any[]) {
          if (!item?.isPublic && item?.is_public !== true) continue;
          const title = String(item?.title || '').trim();
          if (!title) continue;
          items.push({
            id: `pub-${u.id}-${String(item.id || title)}`,
            scheduleDate: dateOnly,
            title,
            isHoliday: item?.type === 'company_holiday',
            ownerId: u.id,
            ownerName,
            isPublic: true,
            source: 'personal_public',
          });
        }
      }
    }

    items.sort((a, b) =>
      a.scheduleDate === b.scheduleDate
        ? a.title.localeCompare(b.title)
        : a.scheduleDate.localeCompare(b.scheduleDate)
    );

    return res.json({ success: true, data: items });
  } catch (error: any) {
    console.error('listPublicPersonalCalendarSchedules:', error);
    return res.status(500).json({
      success: false,
      message: '공개 개인 스케줄을 불러오지 못했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
};
