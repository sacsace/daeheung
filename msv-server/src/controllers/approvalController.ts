import { Response } from 'express';
import { RequestWithUser } from '../types';
import { Approval, User } from '../models';
import { Op, literal } from 'sequelize';
import { pushNotification } from './notificationController';
import SocketService from '../services/socketService';
import { ensurePayrollApprovalExcelAttachment } from '../services/payrollApprovalExcel';
import { ensureBonusApprovalExcelAttachment } from '../services/bonusApprovalExcel';

/** 결재 흐름에 승인자로 포함된 문서 (승인 완료 후에도 조회되도록) */
function approvalFlowContainsApprover(userId: number) {
  const id = Math.trunc(Number(userId));
  if (!Number.isFinite(id) || id <= 0) {
    return literal('FALSE');
  }
  return literal(
    `EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN "Approval"."approval_flow" IS NULL THEN '[]'::jsonb
          WHEN jsonb_typeof("Approval"."approval_flow") = 'array' THEN "Approval"."approval_flow"
          ELSE '[]'::jsonb
        END
      ) AS elem
      WHERE COALESCE(elem->>'approverId', elem->>'approver_id') ~ '^[0-9]+$'
        AND COALESCE(elem->>'approverId', elem->>'approver_id')::int = ${id}
    )`
  );
}

const parseJsonArray = (value: unknown): any[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const flowApproverId = (step: any): number | null => {
  if (!step) return null;
  const raw = step.approverId ?? step.approver_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** JSONB는 같은 배열을 고치면 변경으로 안 잡혀 사유·단계가 저장되지 않는다. */
const cloneFlow = (value: unknown): any[] =>
  parseJsonArray(value).map((step) => ({ ...(step as object) }));

const saveApprovalFlow = async (
  approval: any,
  fields: Record<string, unknown>,
  flow: any[]
) => {
  approval.set({ ...fields, approval_flow: flow });
  approval.changed('approval_flow', true);
  await approval.save();
};

const notifyApprovalUser = (
  req: RequestWithUser,
  targetUserId: number | null | undefined,
  title: string,
  message: string,
  approval: { id: number; document_id?: string; title?: string },
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
) => {
  if (!targetUserId) return;
  const socketService = (req as any).socketService as SocketService | undefined;
  pushNotification(
    {
      title,
      message,
      type,
      target_type: 'user',
      target_id: targetUserId,
      tenant_id: req.user?.tenant_id,
      company_id: req.user?.company_id,
      sender_user_id: req.user?.id,
      data: {
        feature: 'approval',
        approval_id: approval.id,
        document_id: approval.document_id,
        approval_title: approval.title,
        href: '/work/approval'
      }
    },
    socketService
  );
};

const parseQueryInt = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
};

// 전자 결제 목록 조회
export const getApprovals = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { requester_id, status, type, priority, company_id, current_approver_id } = req.query;

    const whereClause: any = {};
    
    // root나 audit 권한이면 모든 결제 조회 가능, 아니면 자신의 회사 결제만
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    } else {
      // root는 company_id 쿼리 파라미터로 회사별 필터링 가능
      if (userRole === 'root' && company_id) {
        whereClause.company_id = parseInt(company_id as string);
      } else if (userRole === 'root') {
        // root가 company_id를 지정하지 않으면 모든 회사 조회
      } else if (userRole === 'audit') {
        // audit: 테넌트 내 전체 회사 조회 가능, company_id 쿼리로 필터링 가능
        if (tenantId) whereClause.tenant_id = tenantId;
        const requestedCompanyId = parseQueryInt(company_id);
        if (requestedCompanyId != null) {
          whereClause.company_id = requestedCompanyId;
        }
      }
    }

    const rid = parseQueryInt(requester_id);
    const curAppr = parseQueryInt(current_approver_id);

    // 일반 사용자: 본인 요청 + 현재 대기 + 결재 흐름에 승인자로 참여한 건(승인/반려 포함)
    if (userRole === 'user' && userId != null) {
      if (curAppr != null && curAppr === userId && (rid == null || rid !== userId)) {
        whereClause[Op.or] = [
          { current_approver_id: userId },
          approvalFlowContainsApprover(userId),
        ];
      } else if (rid != null && rid === userId && (curAppr == null || curAppr !== userId)) {
        whereClause.requester_id = userId;
      } else {
        whereClause[Op.or] = [
          { requester_id: userId },
          { current_approver_id: userId },
          approvalFlowContainsApprover(userId),
        ];
      }
    } else {
      if (rid != null) {
        whereClause.requester_id = rid;
      }
      if (curAppr != null) {
        whereClause.current_approver_id = curAppr;
      }
    }

    if (status) {
      const s = String(status);
      if (s.includes(',')) {
        const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
        if (parts.length > 1) {
          whereClause.status = { [Op.in]: parts };
        } else if (parts.length === 1) {
          whereClause.status = parts[0];
        }
      } else {
        whereClause.status = status;
      }
    }

    if (type) {
      whereClause.type = type;
    }

    if (priority) {
      whereClause.priority = priority;
    }

    // 활성화된 전자 결제만 조회
    whereClause.is_active = true;

    const approvals = await (Approval as any).findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'currentApprover',
          attributes: ['id', 'username'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: approvals
    });
  } catch (error: any) {
    console.error('전자 결제 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '전자 결제 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 전자 결제 상세 조회
export const getApproval = async (req: RequestWithUser, res: Response) => {
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
      
      if (userRole === 'user' && userId != null) {
        whereClause[Op.or] = [
          { requester_id: userId },
          { current_approver_id: userId },
          approvalFlowContainsApprover(userId),
        ];
      }
    }

    // 활성화된 전자 결제만 조회
    whereClause.is_active = true;

    const approval = await (Approval as any).findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'currentApprover',
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });

    if (!approval) {
      return res.status(404).json({ 
        success: false, 
        message: '전자 결제를 찾을 수 없습니다.' 
      });
    }

    try {
      await ensurePayrollApprovalExcelAttachment(approval);
      await ensureBonusApprovalExcelAttachment(approval);
      await approval.reload({
        include: [
          {
            model: User,
            as: 'requester',
            attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number'],
          },
          {
            model: User,
            as: 'currentApprover',
            attributes: ['id', 'username'],
            required: false,
          },
        ],
      });
    } catch (attachErr) {
      console.error('급여 결재 엑셀 첨부 보강 오류:', attachErr);
    }

    res.json({ success: true, data: approval });
  } catch (error: any) {
    console.error('전자 결제 상세 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '전자 결제 상세 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 전자 결제 생성
export const createApproval = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const { document_id, title, type, category, amount, description, attachments, priority, due_date, approval_flow } = req.body;

    if (!document_id || !title || !type || !description) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 필드가 누락되었습니다.' 
      });
    }

    // document_id 중복 확인
    const existing = await (Approval as any).findOne({
      where: {
        document_id,
        tenant_id: tenantId,
        company_id: companyId
      }
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: '이미 존재하는 문서 ID입니다.' 
      });
    }

    const approval = await (Approval as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      document_id,
      is_active: true,
      title,
      type,
      category: category != null && String(category).trim() !== '' ? String(category).trim() : '',
      amount: amount || null,
      requester_id: userId,
      description,
      attachments: attachments != null ? attachments : null,
      status: 'draft',
      priority: priority || 'medium',
      approval_flow: Array.isArray(approval_flow) ? approval_flow : [],
      due_date: due_date || null
    });

    // 사용자 정보 포함하여 반환
    const approvalWithUser = await (Approval as any).findByPk(approval.id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        }
      ]
    });

    res.status(201).json({ 
      success: true, 
      data: approvalWithUser 
    });
  } catch (error: any) {
    console.error('전자 결제 생성 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '전자 결제 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 전자 결제 수정
export const updateApproval = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { title, type, category, amount, description, attachments, priority, due_date, approval_flow, status } = req.body;

    const whereClause: any = { id, is_active: true };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
      
      // 일반 사용자는 자신이 요청한 결제만 수정 가능 (draft 상태만)
      if (userRole === 'user') {
        whereClause.requester_id = userId;
        whereClause.status = 'draft';
      }
    }

    const approval = await (Approval as any).findOne({
      where: whereClause
    });

    if (!approval) {
      return res.status(404).json({ 
        success: false, 
        message: '전자 결제를 찾을 수 없습니다.' 
      });
    }

    await approval.update({
      title: title !== undefined ? title : approval.title,
      type: type !== undefined ? type : approval.type,
      category: category !== undefined ? category : approval.category,
      amount: amount !== undefined ? amount : approval.amount,
      description: description !== undefined ? description : approval.description,
      attachments: attachments !== undefined ? attachments : approval.attachments,
      priority: priority !== undefined ? priority : approval.priority,
      due_date: due_date !== undefined ? due_date : approval.due_date,
      // 제출 이후에는 승인자/결재흐름 변경 불가 (전달·승인 API만 가능)
      approval_flow:
        approval.status === 'draft' && approval_flow !== undefined
          ? approval_flow
          : approval.approval_flow,
      status: approval.status === 'draft' && status !== undefined ? status : approval.status
    });

    // 사용자 정보 포함하여 반환
    const approvalWithUser = await (Approval as any).findByPk(approval.id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'currentApprover',
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });

    res.json({ 
      success: true, 
      data: approvalWithUser 
    });
  } catch (error: any) {
    console.error('전자 결제 수정 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '전자 결제 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 전자 결제 삭제
export const deleteApproval = async (req: RequestWithUser, res: Response) => {
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
      
      // 일반 사용자는 자신이 요청한 결제만 삭제 가능 (draft 상태만)
      if (userRole === 'user') {
        whereClause.requester_id = userId;
        whereClause.status = 'draft';
      }
    }

    const approval = await (Approval as any).findOne({
      where: whereClause
    });

    if (!approval) {
      return res.status(404).json({ 
        success: false, 
        message: '전자 결제를 찾을 수 없습니다.' 
      });
    }

    // 소프트 삭제: is_active를 false로 설정
    await approval.update({ is_active: false });

    res.json({ 
      success: true, 
      message: '전자 결제가 비활성화되었습니다.' 
    });
  } catch (error: any) {
    console.error('전자 결제 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '전자 결제 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 전자 결제 제출
export const submitApproval = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;

    const approval = await (Approval as any).findOne({
      where: {
        id,
        tenant_id: tenantId,
        company_id: companyId,
        requester_id: userId,
        status: 'draft'
      }
    });

    if (!approval) {
      return res.status(404).json({ 
        success: false, 
        message: '전자 결제를 찾을 수 없거나 제출할 수 없습니다.' 
      });
    }

    // approval_flow에서 첫 번째 승인자 설정
    const approvalFlow = parseJsonArray(approval.approval_flow);
    const firstApproverId = flowApproverId(approvalFlow[0]);

    await approval.update({
      status: 'submitted',
      current_approver_id: firstApproverId
    });

    if (firstApproverId) {
      const requesterName = req.user?.username || '요청자';
      notifyApprovalUser(
        req,
        firstApproverId,
        '전자결재 승인 요청',
        `${requesterName}님이 "${approval.title}" 결재를 요청했습니다.`,
        approval
      );
    }

    // 사용자 정보 포함하여 반환
    const approvalWithUser = await (Approval as any).findByPk(approval.id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'currentApprover',
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });

    res.json({ 
      success: true, 
      data: approvalWithUser 
    });
  } catch (error: any) {
    console.error('전자 결제 제출 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '전자 결제 제출 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 전자 결제 승인
export const approveApproval = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { comment, signature } = req.body;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;

    const approval = await (Approval as any).findOne({
      where: {
        id,
        tenant_id: tenantId,
        company_id: companyId,
        current_approver_id: userId,
        status: { [Op.in]: ['submitted', 'in_review'] }
      }
    });

    if (!approval) {
      return res.status(404).json({ 
        success: false, 
        message: '승인할 수 있는 전자 결제를 찾을 수 없습니다.' 
      });
    }

    // approval_flow 업데이트
    const approvalFlow = cloneFlow(approval.approval_flow);
    const currentStepIndex = approvalFlow.findIndex(
      (step: any) => flowApproverId(step) === Number(userId) && step.status === 'pending'
    );
    
    if (currentStepIndex >= 0) {
      approvalFlow[currentStepIndex] = {
        ...approvalFlow[currentStepIndex],
        status: 'approved',
        approvedAt: new Date().toISOString(),
        comment: comment || null,
        signature: signature || null,
      };
    }

    // 다음 승인자 확인
    const nextStep = approvalFlow.find((step: any) => step.status === 'pending');
    const nextApproverId = flowApproverId(nextStep);
    
    if (nextApproverId) {
      // 다음 승인자가 있으면 in_review 상태 유지
      await saveApprovalFlow(approval, {
        status: 'in_review',
        current_approver_id: nextApproverId,
      }, approvalFlow);
      const approverName = req.user?.username || '승인자';
      notifyApprovalUser(
        req,
        nextApproverId,
        '전자결재 승인 요청',
        `${approverName}님이 "${approval.title}" 결재를 승인했습니다. 다음 승인이 필요합니다.`,
        approval
      );
    } else {
      // 모든 승인이 완료되면 approved 상태로 변경
      await saveApprovalFlow(approval, {
        status: 'approved',
        current_approver_id: null,
      }, approvalFlow);
      const approverName = req.user?.username || '승인자';
      notifyApprovalUser(
        req,
        Number(approval.requester_id),
        '전자결재 승인 완료',
        `${approverName}님이 "${approval.title}" 결재를 최종 승인했습니다.`,
        approval,
        'success'
      );
    }

    // 사용자 정보 포함하여 반환
    const approvalWithUser = await (Approval as any).findByPk(approval.id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'currentApprover',
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });

    res.json({ 
      success: true, 
      data: approvalWithUser 
    });
  } catch (error: any) {
    console.error('전자 결제 승인 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '전자 결제 승인 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 댓글 추가
export const addComment = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { comment, parentId } = req.body;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: '댓글 내용을 입력해주세요.'
      });
    }

    const approval = await (Approval as any).findOne({
      where: {
        id,
        tenant_id: tenantId,
        company_id: companyId
      }
    });

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: '전자 결제를 찾을 수 없습니다.'
      });
    }

    // 기존 댓글 목록 가져오기
    const comments = approval.comments ? (typeof approval.comments === 'string' ? JSON.parse(approval.comments) : approval.comments) : [];
    
    // 새 댓글 생성
    const newComment = {
      id: Date.now(), // 임시 ID (실제로는 DB에서 생성)
      userId,
      userName: req.user?.username || '알 수 없음',
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
      isInternal: false,
      parentId: parentId || null,
      replies: []
    };

    // 부모 댓글이 있으면 대댓글로 추가
    if (parentId) {
      const parentIndex = comments.findIndex((c: any) => c.id === parentId);
      if (parentIndex >= 0) {
        if (!comments[parentIndex].replies) {
          comments[parentIndex].replies = [];
        }
        comments[parentIndex].replies.push(newComment);
      } else {
        return res.status(404).json({
          success: false,
          message: '부모 댓글을 찾을 수 없습니다.'
        });
      }
    } else {
      // 일반 댓글로 추가
      comments.push(newComment);
    }

    // 댓글 업데이트
    await approval.update({
      comments: JSON.stringify(comments)
    });

    res.json({
      success: true,
      data: newComment,
      message: parentId ? '답글이 추가되었습니다.' : '댓글이 추가되었습니다.'
    });
  } catch (error: any) {
    console.error('댓글 추가 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 전자 결제 거부
export const rejectApproval = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const reason = String(req.body?.comment || '').trim();
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: '반려 사유를 입력해 주세요.',
      });
    }

    const approval = await (Approval as any).findOne({
      where: {
        id,
        tenant_id: tenantId,
        company_id: companyId,
        current_approver_id: userId,
        status: { [Op.in]: ['submitted', 'in_review'] }
      }
    });

    if (!approval) {
      return res.status(404).json({ 
        success: false, 
        message: '거부할 수 있는 전자 결제를 찾을 수 없습니다.' 
      });
    }

    // approval_flow 업데이트
    const approvalFlow = cloneFlow(approval.approval_flow);
    let currentStepIndex = approvalFlow.findIndex(
      (step: any) => flowApproverId(step) === Number(userId) && step.status === 'pending'
    );
    if (currentStepIndex < 0) {
      currentStepIndex = approvalFlow.findIndex((step: any) => step.status === 'pending');
    }

    const rejectedAt = new Date().toISOString();
    if (currentStepIndex >= 0) {
      approvalFlow[currentStepIndex] = {
        ...approvalFlow[currentStepIndex],
        status: 'rejected',
        approvedAt: rejectedAt,
        comment: reason,
      };
    } else {
      approvalFlow.push({
        id: 1,
        stepOrder: 1,
        approverId: Number(userId),
        approverName: req.user?.username || '',
        status: 'rejected',
        approvedAt: rejectedAt,
        comment: reason,
      });
    }

    await saveApprovalFlow(approval, {
      status: 'rejected',
      current_approver_id: null,
    }, approvalFlow);

    const approverName = req.user?.username || '승인자';
    notifyApprovalUser(
      req,
      Number(approval.requester_id),
      '전자결재 반려',
      `${approverName}님이 "${approval.title}" 결재를 반려했습니다.`,
      approval,
      'warning'
    );

    // 사용자 정보 포함하여 반환
    const approvalWithUser = await (Approval as any).findByPk(approval.id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'currentApprover',
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });

    res.json({ 
      success: true, 
      data: approvalWithUser 
    });
  } catch (error: any) {
    console.error('전자 결제 거부 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '전자 결제 거부 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 전자 결제 에스컬레이션
export const escalateApproval = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { next_approver_id, comment } = req.body;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;

    if (!next_approver_id) {
      return res.status(400).json({
        success: false,
        message: '에스컬레이션 대상이 필요합니다.'
      });
    }

    const forwardReason = String(comment || '').trim();
    if (!forwardReason) {
      return res.status(400).json({
        success: false,
        message: '전달 사유를 입력해주세요.'
      });
    }

    const approval = await (Approval as any).findOne({
      where: {
        id,
        tenant_id: tenantId,
        company_id: companyId,
        current_approver_id: userId,
        status: { [Op.in]: ['submitted', 'in_review'] }
      }
    });

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: '에스컬레이션할 수 있는 전자 결제를 찾을 수 없습니다.'
      });
    }

    const approvalFlow = cloneFlow(approval.approval_flow);
    const escalationCount = approvalFlow.filter((step: any) => step.escalated).length;

    if (escalationCount >= 4) {
      return res.status(400).json({
        success: false,
        message: '에스컬레이션은 최대 4번까지 가능합니다.'
      });
    }

    const currentStepIndex = approvalFlow.findIndex(
      (step: any) => flowApproverId(step) === Number(userId) && step.status === 'pending'
    );

    if (currentStepIndex < 0) {
      return res.status(400).json({
        success: false,
        message: '현재 승인 단계가 올바르지 않습니다.'
      });
    }

    if (Number(next_approver_id) === userId) {
      return res.status(400).json({
        success: false,
        message: '자기 자신에게는 에스컬레이션할 수 없습니다.'
      });
    }

    const nextApprover = await (User as any).findOne({
      where: {
        id: next_approver_id,
        tenant_id: tenantId,
        company_id: companyId
      }
    });

    if (!nextApprover) {
      return res.status(404).json({
        success: false,
        message: '에스컬레이션 대상 사용자를 찾을 수 없습니다.'
      });
    }

    const alreadyInFlow = approvalFlow.some((step: any) => flowApproverId(step) === Number(nextApprover.id));
    if (alreadyInFlow) {
      return res.status(400).json({
        success: false,
        message: '이미 결재 흐름에 포함된 사용자입니다.'
      });
    }

    const nowIso = new Date().toISOString();
    approvalFlow[currentStepIndex] = {
      ...approvalFlow[currentStepIndex],
      status: 'skipped',
      approvedAt: nowIso,
      comment: forwardReason,
      escalated: true,
      escalatedToId: nextApprover.id,
      escalatedToName: nextApprover.username,
      escalatedAt: nowIso
    };

    const maxStepOrder = approvalFlow.reduce((max: number, step: any) => Math.max(max, step.stepOrder || 0), 0);
    const maxStepId = approvalFlow.reduce((max: number, step: any) => Math.max(max, step.id || 0), 0);

    approvalFlow.push({
      id: maxStepId + 1,
      stepOrder: maxStepOrder + 1,
      approverId: nextApprover.id,
      approverName: nextApprover.username,
      approverDepartment: nextApprover.department || '-',
      approverPosition: nextApprover.position || '-',
      status: 'pending'
    });

    await saveApprovalFlow(approval, {
      status: 'in_review',
      current_approver_id: nextApprover.id,
    }, approvalFlow);

    const actorName = req.user?.username || '승인자';
    notifyApprovalUser(
      req,
      Number(nextApprover.id),
      '전자결재 에스컬레이션',
      `${actorName}님이 "${approval.title}" 결재를 회원님에게 전달했습니다.`,
      approval
    );

    const approvalWithUser = await (Approval as any).findByPk(approval.id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'currentApprover',
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });

    res.json({
      success: true,
      data: approvalWithUser
    });
  } catch (error: any) {
    console.error('전자 결제 에스컬레이션 오류:', error);
    res.status(500).json({
      success: false,
      message: '전자 결제 에스컬레이션 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

