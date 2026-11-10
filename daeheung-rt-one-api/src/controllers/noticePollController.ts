import { Response } from 'express';
import { RequestWithUser } from '../types';
import { Notice, NoticePoll, NoticePollOption, NoticePollVote } from '../models';

export type AnonymousPollPayload = {
  id: number;
  noticeId: number;
  question: string;
  opensAt: string | null;
  closesAt: string | null;
  isNotYetOpen: boolean;
  isClosed: boolean;
  canVote: boolean;
  totalVotes: number;
  hasVoted: boolean;
  myVoteOptionId: number | null;
  options: Array<{
    id: number;
    label: string;
    sortOrder: number;
    voteCount: number;
  }>;
};

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getPollWindowState(opensAt: Date | null | undefined, closesAt: Date | null | undefined) {
  const now = Date.now();
  const open = parseDate(opensAt || null);
  const close = parseDate(closesAt || null);
  const isNotYetOpen = Boolean(open && open.getTime() > now);
  const isClosed = Boolean(close && close.getTime() <= now);
  return {
    isNotYetOpen,
    isClosed,
    canVoteWindow: !isNotYetOpen && !isClosed,
  };
}

function assertPollWindow(opensAt?: string | null, closesAt?: string | null) {
  const open = opensAt ? parseDate(opensAt) : null;
  const close = closesAt ? parseDate(closesAt) : null;
  if (opensAt && !open) {
    throw Object.assign(new Error('투표 시작 시각이 올바르지 않습니다.'), { status: 400 });
  }
  if (closesAt && !close) {
    throw Object.assign(new Error('투표 마감 시각이 올바르지 않습니다.'), { status: 400 });
  }
  if (open && close && open.getTime() >= close.getTime()) {
    throw Object.assign(new Error('투표 시작은 마감보다 이전이어야 합니다.'), { status: 400 });
  }
}

/** 투표 결과는 옵션별 집계만 반환. 누가 찍었는지는 노출하지 않음. */
export async function getAnonymousPollForNotice(
  noticeId: number,
  tenantId: number,
  companyId: number,
  userId: number | undefined
): Promise<AnonymousPollPayload | null> {
  const poll = await (NoticePoll as any).findOne({
    where: { notice_id: noticeId, tenant_id: tenantId, company_id: companyId, is_active: true },
    include: [
      {
        model: NoticePollOption,
        as: 'options',
        where: { is_active: true },
        required: false,
      },
    ],
  });

  if (!poll) return null;

  const options = Array.isArray(poll.options) ? [...poll.options] : [];
  options.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

  const voteRows = await (NoticePollVote as any).findAll({
    where: { poll_id: poll.id, tenant_id: tenantId, company_id: companyId },
    attributes: ['option_id'],
    raw: true,
  });

  const countMap = new Map<number, number>();
  for (const row of voteRows) {
    const oid = Number(row.option_id);
    countMap.set(oid, (countMap.get(oid) || 0) + 1);
  }

  let myVoteOptionId: number | null = null;
  if (userId) {
    const myVote = await (NoticePollVote as any).findOne({
      where: { poll_id: poll.id, user_id: userId, tenant_id: tenantId, company_id: companyId },
      attributes: ['option_id'],
    });
    if (myVote) myVoteOptionId = myVote.option_id;
  }

  const optionPayload = options.map((opt: any) => ({
    id: opt.id,
    label: opt.label,
    sortOrder: opt.sort_order,
    voteCount: countMap.get(opt.id) || 0,
  }));

  const totalVotes = optionPayload.reduce((sum: number, o: { voteCount: number }) => sum + o.voteCount, 0);
  const window = getPollWindowState(poll.opens_at, poll.closes_at);
  const hasVoted = myVoteOptionId != null;

  return {
    id: poll.id,
    noticeId: poll.notice_id,
    question: poll.question,
    opensAt: poll.opens_at ? new Date(poll.opens_at).toISOString() : null,
    closesAt: poll.closes_at ? new Date(poll.closes_at).toISOString() : null,
    isNotYetOpen: window.isNotYetOpen,
    isClosed: window.isClosed,
    canVote: !hasVoted && window.canVoteWindow,
    totalVotes,
    hasVoted,
    myVoteOptionId,
    options: optionPayload,
  };
}

export async function createPollForNotice(params: {
  noticeId: number;
  tenantId: number;
  companyId: number;
  question: string;
  options: string[];
  opensAt?: string | null;
  closesAt?: string | null;
  transaction?: any;
}) {
  const { noticeId, tenantId, companyId, question, options, opensAt, closesAt, transaction } = params;
  const cleaned = (options || [])
    .map((o) => String(o || '').trim())
    .filter((o) => o.length > 0);

  if (!question || !String(question).trim()) {
    throw Object.assign(new Error('투표 질문은 필수입니다.'), { status: 400 });
  }
  if (cleaned.length < 2) {
    throw Object.assign(new Error('투표 선택지는 2개 이상 필요합니다.'), { status: 400 });
  }
  if (cleaned.length > 20) {
    throw Object.assign(new Error('투표 선택지는 최대 20개까지입니다.'), { status: 400 });
  }

  assertPollWindow(opensAt, closesAt);

  const existing = await (NoticePoll as any).findOne({
    where: { notice_id: noticeId, is_active: true },
    transaction,
  });
  if (existing) {
    throw Object.assign(new Error('이미 투표가 등록된 공지입니다.'), { status: 400 });
  }

  const poll = await (NoticePoll as any).create(
    {
      tenant_id: tenantId,
      company_id: companyId,
      notice_id: noticeId,
      question: String(question).trim().slice(0, 500),
      opens_at: opensAt ? new Date(opensAt) : null,
      closes_at: closesAt ? new Date(closesAt) : null,
      is_active: true,
    },
    { transaction }
  );

  for (let i = 0; i < cleaned.length; i++) {
    await (NoticePollOption as any).create(
      {
        poll_id: poll.id,
        label: cleaned[i].slice(0, 300),
        sort_order: i,
        is_active: true,
      },
      { transaction }
    );
  }

  return poll;
}

export async function softDeletePollForNotice(
  noticeId: number,
  tenantId: number,
  companyId: number,
  transaction?: any
) {
  await (NoticePoll as any).update(
    { is_active: false },
    {
      where: { notice_id: noticeId, tenant_id: tenantId, company_id: companyId, is_active: true },
      transaction,
    }
  );
}

/** 공지에 투표 이슈 추가 (아직 없을 때만) */
export const createNoticePoll = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, company_id, id: user_id, role } = req.user;
    const { question, options, closesAt, opensAt } = req.body || {};

    if (!tenant_id || !company_id || !user_id) {
      return res.status(400).json({ success: false, message: '사용자 정보가 올바르지 않습니다.' });
    }

    const notice = await (Notice as any).findOne({
      where: { id, tenant_id, company_id, is_active: true },
    });
    if (!notice) {
      return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
    }

    const canManage =
      role === 'root' || role === 'admin' || Number(notice.author_id) === Number(user_id);
    if (!canManage) {
      return res.status(403).json({ success: false, message: '투표를 등록할 권한이 없습니다.' });
    }

    await createPollForNotice({
      noticeId: Number(id),
      tenantId: tenant_id,
      companyId: company_id,
      question,
      options: Array.isArray(options) ? options : [],
      opensAt: opensAt || null,
      closesAt: closesAt || null,
    });

    const poll = await getAnonymousPollForNotice(Number(id), tenant_id, company_id, user_id);
    return res.status(201).json({ success: true, data: poll });
  } catch (error: any) {
    const status = error.status || 500;
    console.error('공지 투표 생성 오류:', error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? '서버 오류가 발생했습니다.' : error.message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** 투표 (1인 1표, 결과 익명) */
export const voteNoticePoll = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, company_id, id: user_id } = req.user;
    const optionId = Number(req.body?.optionId ?? req.body?.option_id);

    if (!tenant_id || !company_id || !user_id) {
      return res.status(400).json({ success: false, message: '사용자 정보가 올바르지 않습니다.' });
    }
    if (!Number.isFinite(optionId) || optionId <= 0) {
      return res.status(400).json({ success: false, message: '선택지를 선택해주세요.' });
    }

    const notice = await (Notice as any).findOne({
      where: { id, tenant_id, company_id, is_active: true },
    });
    if (!notice) {
      return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
    }

    const poll = await (NoticePoll as any).findOne({
      where: { notice_id: id, tenant_id, company_id, is_active: true },
    });
    if (!poll) {
      return res.status(404).json({ success: false, message: '투표를 찾을 수 없습니다.' });
    }

    const window = getPollWindowState(poll.opens_at, poll.closes_at);
    if (window.isNotYetOpen) {
      return res.status(400).json({ success: false, message: '투표 기간이 아직 시작되지 않았습니다.' });
    }
    if (window.isClosed) {
      return res.status(400).json({ success: false, message: '마감된 투표입니다.' });
    }

    const option = await (NoticePollOption as any).findOne({
      where: { id: optionId, poll_id: poll.id, is_active: true },
    });
    if (!option) {
      return res.status(400).json({ success: false, message: '유효하지 않은 선택지입니다.' });
    }

    const existing = await (NoticePollVote as any).findOne({
      where: { poll_id: poll.id, user_id },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: '이미 투표하셨습니다. (1인 1표)' });
    }

    try {
      await (NoticePollVote as any).create({
        tenant_id,
        company_id,
        poll_id: poll.id,
        option_id: optionId,
        user_id,
      });
    } catch (err: any) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ success: false, message: '이미 투표하셨습니다. (1인 1표)' });
      }
      throw err;
    }

    const result = await getAnonymousPollForNotice(Number(id), tenant_id, company_id, user_id);
    return res.json({ success: true, data: result, message: '투표가 반영되었습니다.' });
  } catch (error: any) {
    console.error('공지 투표 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
