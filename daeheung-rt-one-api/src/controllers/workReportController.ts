import { Response } from 'express';
import { RequestWithUser } from '../types';
import { WorkReport, User } from '../models';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { pushNotification } from './notificationController';
import { sendWorkReportSubmittedEmail, WorkReportMailResult } from '../utils/workReportMail';

function normalizeCcUserIdsRaw(raw: unknown): number[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))];
  }
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) return normalizeCcUserIdsRaw(v);
    } catch {
      return [];
    }
  }
  return [];
}

/** Sequelize는 FROM "work_reports" AS "WorkReport" 이므로 별칭으로 컬럼 참조 */
function ccJsonContainsUser(userId: number) {
  const uid = Number(userId);
  return sequelize.where(
    sequelize.literal(
      `(COALESCE("WorkReport"."cc_user_ids", '[]'::jsonb))::jsonb @> '${JSON.stringify([uid])}'::jsonb`
    ),
    true
  );
}

async function validateAndNormalizeCcUserIds(
  raw: unknown,
  tenantId: number | undefined,
  companyId: number | undefined,
  recipientId: number,
  authorId: number
): Promise<{ ok: true; ids: number[] } | { ok: false; message: string }> {
  let ids = normalizeCcUserIdsRaw(raw);
  ids = ids.filter((id) => id !== recipientId && id !== authorId);
  if (ids.length > 30) {
    return { ok: false, message: '참조 인원은 최대 30명까지 지정할 수 있습니다.' };
  }
  if (tenantId == null || companyId == null) {
    return { ok: true, ids: [] };
  }
  for (const id of ids) {
    const u = await User.findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, status: 'active' }
    });
    if (!u) {
      return { ok: false, message: '참조 인원은 같은 회사의 활성 사용자만 지정할 수 있습니다.' };
    }
  }
  return { ok: true, ids };
}

async function batchAttachCcUsers(rows: any[]) {
  const all = new Set<number>();
  for (const r of rows) {
    normalizeCcUserIdsRaw(r.cc_user_ids).forEach((id) => all.add(id));
  }
  if (!all.size) {
    for (const r of rows) {
      r.cc_users = [];
    }
    return;
  }
  const users = await User.findAll({
    where: { id: [...all] },
    attributes: ['id', 'username']
  });
  const map = new Map<number, string>(users.map((u: any) => [Number(u.id), String(u.username || '')]));
  for (const r of rows) {
    const ids = normalizeCcUserIdsRaw(r.cc_user_ids);
    r.cc_users = ids.map((id) => ({ id, username: map.get(id) || '' }));
  }
}

async function trySendWorkReportSubmittedEmail(params: Parameters<typeof sendWorkReportSubmittedEmail>[0]): Promise<WorkReportMailResult> {
  try {
    const result = await sendWorkReportSubmittedEmail(params);
    if (result.sent === false) {
      console.warn('[workReport] email not sent:', result.reason);
    }
    return result;
  } catch (error: any) {
    console.error('[workReport] email send error:', error?.message || error);
    return { sent: false, reason: '메일 발송 중 오류가 발생했습니다.' };
  }
}

// 업무 보고서 목록 조회
export const getWorkReports = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { author_id, status, type, priority, start_date, end_date, company_id, scope } = req.query;
    /** 받은 보고서: 정식 수신자 + 참조(CC) 동일 목록 */
    const listScope =
      scope === 'received' || scope === 'cc' || scope === 'referenced'
        ? 'received'
        : 'authored';

    const whereClause: any = {};

    // 회사/테넌트 범위: 일반 계정은 본인 회사만, root는 선택적 company_id, audit는 소속 범위
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    } else {
      if (userRole === 'root' && company_id) {
        whereClause.company_id = parseInt(company_id as string, 10);
      } else if (userRole === 'root') {
        // company_id 없으면 전 회사(테넌트 필터 없음)
      } else {
        if (tenantId) whereClause.tenant_id = tenantId;
        if (companyId) whereClause.company_id = companyId;
      }
    }

    // 탭: 작성한 보고서 / 받은 보고서(정식 수신자 또는 참조 CC)
    if (userId != null) {
      if (listScope === 'received') {
        whereClause[Op.or] = [{ recipient_id: userId }, ccJsonContainsUser(Number(userId))];
      } else {
        whereClause.author_id = userId;
      }
    }

    if (author_id && (userRole === 'root' || userRole === 'audit')) {
      const aid = parseInt(author_id as string, 10);
      if (!Number.isNaN(aid)) {
        whereClause.author_id = aid;
      }
    }

    if (status) {
      whereClause.status = status;
    }

    if (type) {
      whereClause.type = type;
    }

    if (priority) {
      whereClause.priority = priority;
    }

    if (start_date && end_date) {
      whereClause.report_date = {
        [Op.between]: [start_date, end_date]
      };
    }

    // 활성화된 보고서만 조회
    whereClause.is_active = true;

    const reports = await (WorkReport as any).findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'username'],
          required: false
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'username', 'email', 'department', 'position'],
          required: false
        }
      ],
      order: [['report_date', 'DESC'], ['created_at', 'DESC']]
    });

    const plain = reports.map((r: any) => r.get({ plain: true }));
    await batchAttachCcUsers(plain);

    res.json({
      success: true,
      data: plain
    });
  } catch (error: any) {
    console.error('업무 보고서 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 보고서 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 업무 보고서 상세 조회
export const getWorkReport = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const whereClause: any = { id };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
      
      // 일반 사용자: 작성자·수신자·참조(CC)·공개 보고서 중 하나면 조회 가능
      if (userRole === 'user') {
        const uid = Number(userId);
        whereClause[Op.or] = [
          { author_id: userId },
          { recipient_id: userId },
          { is_public: true },
          ccJsonContainsUser(uid)
        ];
      }
    }

    // 활성화된 보고서만 조회
    whereClause.is_active = true;

    const report = await (WorkReport as any).findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'username'],
          required: false
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'username', 'email', 'department', 'position'],
          required: false
        }
      ]
    });

    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: '업무 보고서를 찾을 수 없습니다.' 
      });
    }

    const plain = report.get({ plain: true });
    await batchAttachCcUsers([plain]);

    res.json({ success: true, data: plain });
  } catch (error: any) {
    console.error('업무 보고서 상세 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 보고서 상세 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 업무 보고서 생성
export const createWorkReport = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const { report_id, title, type, category, content, summary, achievements, challenges,
            next_steps, attachments, priority, report_date, due_date, tags, is_public, recipient_id,
            status: statusFromBody } = req.body;

    if (!title || !content || !report_date || !type) {
      return res.status(400).json({ 
        success: false, 
        message: '제목, 유형, 내용, 작성일은 필수입니다.' 
      });
    }

    if (!recipient_id || !Number.isInteger(Number(recipient_id)) || Number(recipient_id) <= 0) {
      return res.status(400).json({
        success: false,
        message: '보고서를 받는 사람을 선택해주세요.'
      });
    }

    if (Number(recipient_id) === Number(userId)) {
      return res.status(400).json({
        success: false,
        message: '본인에게는 보고서를 보낼 수 없습니다.'
      });
    }

    const recipientUser = await User.findOne({
      where: {
        id: Number(recipient_id),
        tenant_id: tenantId,
        company_id: companyId
      }
    });
    if (!recipientUser) {
      return res.status(400).json({
        success: false,
        message: '수신자는 같은 회사의 활성 사용자만 지정할 수 있습니다.'
      });
    }

    const ccCheck = await validateAndNormalizeCcUserIds(
      req.body.cc_user_ids,
      tenantId,
      companyId,
      Number(recipient_id),
      Number(userId)
    );
    if (ccCheck.ok === false) {
      return res.status(400).json({ success: false, message: ccCheck.message });
    }
    const ccIdsFinal = ccCheck.ids;

    const reportIdFinal =
      report_id && String(report_id).trim()
        ? String(report_id).trim()
        : `WR-${Date.now()}-${userId}-${Math.floor(Math.random() * 9000 + 1000)}`;

    // report_id 중복 확인
    const existing = await (WorkReport as any).findOne({
      where: {
        report_id: reportIdFinal,
        tenant_id: tenantId,
        company_id: companyId
      }
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: '이미 존재하는 보고서 ID입니다.' 
      });
    }

    const categoryVal = category != null && String(category).trim() ? String(category).trim() : '';
    const summaryVal = summary != null && String(summary).trim() ? String(summary).trim() : '';

    const initialStatus = statusFromBody === 'submitted' ? 'submitted' : 'draft';

    const report = await (WorkReport as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      report_id: reportIdFinal,
      title,
      is_active: true,
      type,
      category: categoryVal,
      author_id: userId,
      recipient_id: Number(recipient_id),
      content,
      summary: summaryVal,
      achievements: achievements ? JSON.stringify(achievements) : '[]',
      challenges: challenges ? JSON.stringify(challenges) : '[]',
      next_steps: next_steps ? JSON.stringify(next_steps) : '[]',
      attachments: attachments ? JSON.stringify(attachments) : '[]',
      status: initialStatus,
      priority: priority || 'medium',
      report_date,
      due_date: due_date || null,
      tags: tags ? JSON.stringify(tags) : '[]',
      is_public: is_public !== undefined ? is_public : false,
      cc_user_ids: ccIdsFinal
    });

    // 사용자 정보 포함하여 반환
    const reportWithUser = await (WorkReport as any).findByPk(report.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'username', 'email', 'department', 'position'],
          required: false
        }
      ]
    });

    const recipientNum = Number(recipient_id);
    if (Number.isInteger(recipientNum) && recipientNum > 0 && recipientNum !== Number(userId)) {
      const authorName =
        (reportWithUser as any)?.author?.username ||
        (reportWithUser as any)?.author?.userid ||
        req.user?.username ||
        '작성자';
      if (initialStatus === 'submitted') {
        pushNotification(
          {
            title: '업무 보고서 제출',
            message: `${authorName}님이 "${String(title).slice(0, 120)}" 보고서를 제출했습니다. 확인해 주세요.`,
            type: 'info',
            target_type: 'user',
            target_id: recipientNum,
            tenant_id: tenantId,
            company_id: companyId,
            sender_user_id: Number(userId),
            skip_email: true,
            data: {
              feature: 'work_report',
              id: report.id,
              report_id: reportIdFinal,
              submitted: true,
              list: 'received'
            }
          },
          (req as any).socketService
        );
      } else {
        pushNotification(
          {
            title: '업무 보고서',
            message: `${authorName}님이 "${String(title).slice(0, 120)}" 보고서를 등록하고 수신자로 지정했습니다.`,
            type: 'info',
            target_type: 'user',
            target_id: recipientNum,
            tenant_id: tenantId,
            company_id: companyId,
            sender_user_id: Number(userId),
            data: {
              feature: 'work_report',
              id: report.id,
              report_id: reportIdFinal,
              list: 'received'
            }
          },
          (req as any).socketService
        );
      }
    }

    if (initialStatus === 'submitted') {
      const authorNameElevated =
        (reportWithUser as any)?.author?.username ||
        (reportWithUser as any)?.author?.userid ||
        req.user?.username ||
        '작성자';
      // 수신자·참조(CC)에게만 알림 (회사 admin 전원 브로드캐스트 제거)
      const msgCc = `${authorNameElevated}님이 "${String(title).slice(0, 120)}" 보고서를 제출했습니다. 확인해 주세요.`;
      for (const ccUid of ccIdsFinal) {
        if (!Number.isInteger(ccUid) || ccUid <= 0 || ccUid === Number(userId)) continue;
        if (ccUid === recipientNum) continue;
        pushNotification(
          {
            title: '업무 보고서 제출',
            message: msgCc,
            type: 'info',
            target_type: 'user',
            target_id: ccUid,
            tenant_id: tenantId,
            company_id: companyId,
            sender_user_id: Number(userId),
            skip_email: true,
            data: {
              feature: 'work_report',
              id: report.id,
              report_id: reportIdFinal,
              submitted: true,
              list: 'cc'
            }
          },
          (req as any).socketService
        );
      }
    }

    const plainCreate = reportWithUser.get({ plain: true });
    await batchAttachCcUsers([plainCreate]);

    let emailDelivery: WorkReportMailResult | undefined;
    if (initialStatus === 'submitted' && Number.isInteger(recipientNum) && recipientNum > 0) {
      emailDelivery = await trySendWorkReportSubmittedEmail({
        tenantId,
        companyId,
        senderUserId: Number(userId),
        report: {
          id: report.id,
          report_id: reportIdFinal,
          title: String(title),
          content: String(content),
          summary: summaryVal,
          report_date,
          type: String(type)
        },
        authorName:
          (reportWithUser as any)?.author?.username ||
          (reportWithUser as any)?.author?.userid ||
          req.user?.username ||
          '작성자',
        recipientUserId: recipientNum,
        ccUserIds: ccIdsFinal
      });
    }

    res.status(201).json({ 
      success: true, 
      data: plainCreate,
      email_delivery: emailDelivery
    });
  } catch (error: any) {
    console.error('업무 보고서 생성 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 보고서 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 업무 보고서 수정
export const updateWorkReport = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { title, type, category, content, summary, achievements, challenges, next_steps,
            attachments, priority, report_date, due_date, tags, is_public, status, recipient_id,
            cc_user_ids } = req.body;

    const whereClause: any = { id, is_active: true };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const report = await (WorkReport as any).findOne({
      where: whereClause
    });

    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: '업무 보고서를 찾을 수 없습니다.' 
      });
    }

    // 일반 사용자는 자신이 작성한 보고서만 수정 가능 (draft, submitted 상태만)
    if (userRole === 'user' && report.author_id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: '수정 권한이 없습니다.' 
      });
    }

    if (userRole === 'user' && report.status !== 'draft' && report.status !== 'submitted') {
      return res.status(403).json({ 
        success: false, 
        message: '수정할 수 없는 상태입니다.' 
      });
    }

    let nextRecipientId = report.recipient_id;
    if (recipient_id !== undefined) {
      if (recipient_id === null || recipient_id === '') {
        nextRecipientId = null;
      } else {
        const rid = Number(recipient_id);
        if (!Number.isInteger(rid) || rid <= 0) {
          return res.status(400).json({ success: false, message: '유효하지 않은 수신자입니다.' });
        }
        const recipientUser = await User.findOne({
          where: { id: rid, tenant_id: tenantId, company_id: companyId }
        });
        if (!recipientUser) {
          return res.status(400).json({
            success: false,
            message: '수신자는 같은 회사의 사용자만 지정할 수 있습니다.'
          });
        }
        nextRecipientId = rid;
      }
    }

    const authorIdNum = Number((report as any).author_id);
    const resolvedRecipientId =
      recipient_id !== undefined ? nextRecipientId : (report as any).recipient_id;
    if (
      resolvedRecipientId != null &&
      Number.isInteger(Number(resolvedRecipientId)) &&
      Number(resolvedRecipientId) > 0 &&
      Number(resolvedRecipientId) === authorIdNum
    ) {
      return res.status(400).json({
        success: false,
        message: '본인에게는 보고서를 보낼 수 없습니다.'
      });
    }

    let ccIdsNext: number[] | undefined;
    if (cc_user_ids !== undefined) {
      const recipForCc =
        recipient_id !== undefined ? nextRecipientId : (report as any).recipient_id;
      const ccRes = await validateAndNormalizeCcUserIds(
        cc_user_ids,
        tenantId,
        companyId,
        Number(recipForCc),
        Number((report as any).author_id)
      );
      if (ccRes.ok === false) {
        return res.status(400).json({ success: false, message: ccRes.message });
      }
      ccIdsNext = ccRes.ids;
    }

    const categoryVal =
      category !== undefined ? (category != null && String(category).trim() ? String(category).trim() : '') : undefined;
    const summaryVal =
      summary !== undefined ? (summary != null && String(summary).trim() ? String(summary).trim() : '') : undefined;

    const prevStatus = String((report as any).status || '');
    const nextStatus = status !== undefined ? String(status) : prevStatus;
    const becomingSubmitted = prevStatus === 'draft' && nextStatus === 'submitted';

    await report.update({
      title: title !== undefined ? title : report.title,
      type: type !== undefined ? type : report.type,
      category: categoryVal !== undefined ? categoryVal : report.category,
      content: content !== undefined ? content : report.content,
      summary: summaryVal !== undefined ? summaryVal : report.summary,
      recipient_id: recipient_id !== undefined ? nextRecipientId : report.recipient_id,
      achievements: achievements !== undefined ? JSON.stringify(achievements) : report.achievements,
      challenges: challenges !== undefined ? JSON.stringify(challenges) : report.challenges,
      next_steps: next_steps !== undefined ? JSON.stringify(next_steps) : report.next_steps,
      attachments: attachments !== undefined ? JSON.stringify(attachments) : report.attachments,
      priority: priority !== undefined ? priority : report.priority,
      report_date: report_date !== undefined ? report_date : report.report_date,
      due_date: due_date !== undefined ? due_date : report.due_date,
      tags: tags !== undefined ? JSON.stringify(tags) : report.tags,
      is_public: is_public !== undefined ? is_public : report.is_public,
      status: status !== undefined ? status : report.status,
      cc_user_ids: ccIdsNext !== undefined ? ccIdsNext : (report as any).cc_user_ids
    });

    // 사용자 정보 포함하여 반환
    const reportWithUser = await (WorkReport as any).findByPk(report.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'username'],
          required: false
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'username', 'email', 'department', 'position'],
          required: false
        }
      ]
    });

    const plainUp = reportWithUser.get({ plain: true });
    await batchAttachCcUsers([plainUp]);

    let emailDelivery: WorkReportMailResult | undefined;
    if (becomingSubmitted) {
      const recipId =
        (plainUp as any).recipient_id != null ? Number((plainUp as any).recipient_id) : NaN;
      if (Number.isInteger(recipId) && recipId > 0) {
        emailDelivery = await trySendWorkReportSubmittedEmail({
          tenantId,
          companyId,
          senderUserId: Number((plainUp as any).author_id || userId),
          report: {
            id: Number((plainUp as any).id),
            report_id: String((plainUp as any).report_id || ''),
            title: String((plainUp as any).title || ''),
            content: String((plainUp as any).content || ''),
            summary: (plainUp as any).summary,
            report_date: (plainUp as any).report_date,
            type: String((plainUp as any).type || '')
          },
          authorName:
            (plainUp as any)?.author?.username ||
            (plainUp as any)?.author?.userid ||
            '작성자',
          recipientUserId: recipId,
          ccUserIds: normalizeCcUserIdsRaw((plainUp as any).cc_user_ids)
        });
      }
    }

    res.json({ 
      success: true, 
      data: plainUp,
      email_delivery: emailDelivery
    });
  } catch (error: any) {
    console.error('업무 보고서 수정 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 보고서 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 업무 보고서 삭제
export const deleteWorkReport = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const whereClause: any = { id };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
      
      // 일반 사용자는 자신이 작성한 보고서만 삭제 가능 (draft 상태만)
      if (userRole === 'user') {
        whereClause.author_id = userId;
        whereClause.status = 'draft';
      }
    }

    const report = await (WorkReport as any).findOne({
      where: whereClause
    });

    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: '업무 보고서를 찾을 수 없습니다.' 
      });
    }

    // 소프트 삭제: is_active를 false로 설정
    await report.update({ is_active: false });

    res.json({ 
      success: true, 
      message: '업무 보고서가 비활성화되었습니다.' 
    });
  } catch (error: any) {
    console.error('업무 보고서 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 보고서 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 업무 보고서 제출
export const submitWorkReport = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;

    const report = await (WorkReport as any).findOne({
      where: {
        id,
        tenant_id: tenantId,
        company_id: companyId,
        author_id: userId,
        status: 'draft'
      }
    });

    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: '업무 보고서를 찾을 수 없거나 제출할 수 없습니다.' 
      });
    }

    await report.update({
      status: 'submitted'
    });

    // 사용자 정보 포함하여 반환
    const reportWithUser = await (WorkReport as any).findByPk(report.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        }
      ]
    });

    const recipientIdNum = report.recipient_id != null ? Number(report.recipient_id) : NaN;
    const authorIdNum = report.author_id != null ? Number(report.author_id) : NaN;
    const authorName =
      (reportWithUser as any)?.author?.username ||
      (reportWithUser as any)?.author?.userid ||
      '작성자';
    if (
      Number.isInteger(recipientIdNum) &&
      recipientIdNum > 0 &&
      recipientIdNum !== authorIdNum
    ) {
      pushNotification(
        {
          title: '업무 보고서 제출',
          message: `${authorName}님이 "${String(report.title).slice(0, 120)}" 보고서를 제출했습니다. 확인해 주세요.`,
          type: 'info',
          target_type: 'user',
          target_id: recipientIdNum,
          tenant_id: tenantId,
          company_id: companyId,
          sender_user_id: Number.isInteger(authorIdNum) ? authorIdNum : Number(userId),
          skip_email: true,
          data: {
            feature: 'work_report',
            id: report.id,
            report_id: report.report_id,
            submitted: true,
            list: 'received'
          }
        },
        (req as any).socketService
      );
    }

    const ccListSubmit = normalizeCcUserIdsRaw(
      (reportWithUser as any)?.cc_user_ids ?? (report as any).cc_user_ids
    );
    const msgCcSubmit = `${authorName}님이 "${String(report.title).slice(0, 120)}" 보고서를 제출했습니다. 확인해 주세요.`;
    for (const ccUid of ccListSubmit) {
      if (!Number.isInteger(ccUid) || ccUid <= 0 || ccUid === authorIdNum) continue;
      if (ccUid === recipientIdNum) continue;
      pushNotification(
        {
          title: '업무 보고서 제출',
          message: msgCcSubmit,
          type: 'info',
          target_type: 'user',
          target_id: ccUid,
          tenant_id: tenantId,
          company_id: companyId,
          sender_user_id: Number.isInteger(authorIdNum) ? authorIdNum : Number(userId),
          skip_email: true,
          data: {
            feature: 'work_report',
            id: report.id,
            report_id: report.report_id,
            submitted: true,
            list: 'cc'
          }
        },
        (req as any).socketService
      );
    }

    const plainSub = reportWithUser.get({ plain: true });
    await batchAttachCcUsers([plainSub]);

    let emailDelivery: WorkReportMailResult | undefined;
    if (Number.isInteger(recipientIdNum) && recipientIdNum > 0) {
      emailDelivery = await trySendWorkReportSubmittedEmail({
        tenantId,
        companyId,
        senderUserId: Number.isInteger(authorIdNum) ? authorIdNum : Number(userId),
        report: {
          id: report.id,
          report_id: String(report.report_id || ''),
          title: String(report.title || ''),
          content: String(report.content || ''),
          summary: (report as any).summary,
          report_date: (report as any).report_date,
          type: String((report as any).type || '')
        },
        authorName,
        recipientUserId: recipientIdNum,
        ccUserIds: ccListSubmit
      });
    }

    res.json({ 
      success: true, 
      data: plainSub,
      email_delivery: emailDelivery
    });
  } catch (error: any) {
    console.error('업무 보고서 제출 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 보고서 제출 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 업무 보고서 승인·피드백(상태 rejected)
export const reviewWorkReport = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { status, review_comment } = req.body;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ 
        success: false, 
        message: '유효하지 않은 상태입니다.' 
      });
    }

    const report = await (WorkReport as any).findOne({
      where: {
        id,
        tenant_id: tenantId,
        company_id: companyId,
        status: 'submitted'
      }
    });

    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: '업무 보고서를 찾을 수 없거나 검토할 수 없습니다.' 
      });
    }

    const recipientId = report.recipient_id != null ? Number(report.recipient_id) : null;
    const uid = userId != null ? Number(userId) : NaN;
    const isRecipient = Number.isInteger(recipientId) && recipientId > 0 && recipientId === uid;
    const isElevatedReviewer =
      userRole === 'root' || userRole === 'admin' || userRole === 'audit';
    const ccIdsReview = normalizeCcUserIdsRaw((report as any).cc_user_ids);
    const inCcList =
      Number.isInteger(uid) && uid > 0 && ccIdsReview.includes(uid);
    const isAuthorReview = Number(report.author_id) === uid;

    if (status === 'approved') {
      if (isAuthorReview) {
        return res.status(403).json({
          success: false,
          message: '작성자는 승인할 수 없습니다.'
        });
      }
      if (inCcList && !isRecipient) {
        return res.status(403).json({
          success: false,
          message: '참조 인원은 승인할 수 없습니다. 피드백만 가능합니다.'
        });
      }
      if (!isRecipient && !isElevatedReviewer) {
        return res.status(403).json({
          success: false,
          message: '승인은 보고서 수신자 또는 관리자만 할 수 있습니다.'
        });
      }
    }

    if (status === 'rejected') {
      if (isAuthorReview) {
        return res.status(403).json({
          success: false,
          message: '작성자는 피드백을 보낼 수 없습니다.'
        });
      }
      if (!isRecipient && !isElevatedReviewer && !inCcList) {
        return res.status(403).json({
          success: false,
          message: '피드백은 수신자·참조 인원·관리자만 할 수 있습니다.'
        });
      }
    }

    await report.update({
      status,
      reviewer_id: userId,
      review_comment: review_comment || null,
      reviewed_at: new Date()
    });

    // 사용자 정보 포함하여 반환
    const reportWithUser = await (WorkReport as any).findByPk(report.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });

    const authorNotifyId = report.author_id != null ? Number(report.author_id) : NaN;
    if (Number.isInteger(authorNotifyId) && authorNotifyId > 0 && authorNotifyId !== uid) {
      const reviewerName =
        (reportWithUser as any)?.reviewer?.username ||
        (reportWithUser as any)?.reviewer?.userid ||
        req.user?.username ||
        '검토자';
      const titleShort = String(report.title || '').slice(0, 120);
      if (status === 'approved') {
        pushNotification(
          {
            title: '업무 보고서 승인',
            message: `${reviewerName}님이 "${titleShort}" 보고서를 승인했습니다.`,
            type: 'success',
            target_type: 'user',
            target_id: authorNotifyId,
            tenant_id: tenantId,
            company_id: companyId,
            sender_user_id: uid,
            data: {
              feature: 'work_report',
              id: report.id,
              report_id: report.report_id,
              list: 'authored',
              reviewed: true,
              status: 'approved'
            }
          },
          (req as any).socketService
        );
      } else {
        pushNotification(
          {
            title: '업무 보고서 피드백',
            message: `${reviewerName}님이 "${titleShort}" 보고서에 피드백을 남겼습니다.`,
            type: 'warning',
            target_type: 'user',
            target_id: authorNotifyId,
            tenant_id: tenantId,
            company_id: companyId,
            sender_user_id: uid,
            data: {
              feature: 'work_report',
              id: report.id,
              report_id: report.report_id,
              list: 'authored',
              reviewed: true,
              status: 'rejected'
            }
          },
          (req as any).socketService
        );
      }
    }

    const plainRv = reportWithUser.get({ plain: true });
    await batchAttachCcUsers([plainRv]);

    res.json({ 
      success: true, 
      data: plainRv 
    });
  } catch (error: any) {
    console.error('업무 보고서 검토 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 보고서 검토 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

