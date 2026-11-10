import { Request, Response } from 'express';
import { RequestWithUser } from '../types';
import { Notice, NoticePoll, NoticeView, User } from '../models';
import { Op } from 'sequelize';
import {
  createPollForNotice,
  getAnonymousPollForNotice,
  softDeletePollForNotice,
} from './noticePollController';

// 공지사항 목록 조회
export const getNotices = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenant_id, company_id } = req.user;
    const { page = 1, limit = 10, search = '', category = '', priority = '', status = '' } = req.query;

    if (!tenant_id || !company_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 정보가 올바르지 않습니다.' 
      });
    }

    const whereClause: any = { tenant_id, company_id, is_active: true };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (category) {
      whereClause.category = category;
    }

    if (priority) {
      whereClause.priority = priority;
    }

    if (status) {
      whereClause.status = status;
    }

    const notices = await (Notice as any).findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'email', 'avatar_url']
        },
        {
          model: NoticePoll,
          as: 'poll',
          attributes: ['id'],
          where: { is_active: true },
          required: false,
        },
      ],
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
      order: [['created_at', 'DESC']]
    });

    const formattedNotices = notices.rows.map((notice: any) => ({
      id: notice.id,
      title: notice.title,
      content: notice.content,
      category: notice.category,
      priority: notice.priority,
      status: notice.status,
      isPublic: notice.is_public,
      targetAudience: notice.target_audience,
      author: notice.author?.username || '알 수 없음',
      authorId: notice.author_id,
      authorAvatarUrl: notice.author?.avatar_url || null,
      createdAt: notice.created_at,
      publishedAt: notice.published_at,
      expiresAt: notice.expires_at,
      attachments: notice.attachments ? JSON.parse(notice.attachments) : [],
      readCount: notice.read_count,
      views: notice.views,
      isPinned: notice.is_pinned || false,
      hasPoll: Boolean(notice.poll?.id),
    }));

    res.json({
      success: true,
      data: formattedNotices,
      pagination: {
        total: notices.count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(notices.count / Number(limit))
      }
    });
  } catch (error: any) {
    console.error('공지사항 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 공지사항 상세 조회
export const getNotice = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, company_id, id: user_id } = req.user;

    if (!tenant_id || !company_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 정보가 올바르지 않습니다.' 
      });
    }

    const notice = await (Notice as any).findOne({
      where: { id, tenant_id, company_id, is_active: true },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'email', 'department', 'position', 'avatar_url']
        }
      ]
    });

    if (!notice) {
      return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
    }

    // 조회수: 동일 사용자는 공지당 1회만 증가
    let viewCount = Number(notice.views || 0);
    if (user_id) {
      try {
        const [, created] = await (NoticeView as any).findOrCreate({
          where: {
            notice_id: notice.id,
            user_id,
          },
          defaults: {
            tenant_id,
            company_id,
            notice_id: notice.id,
            user_id,
          },
        });
        if (created) {
          viewCount += 1;
          await notice.update({ views: viewCount });
        }
      } catch (viewError: any) {
        // 동시 요청 등으로 unique 충돌 시 이미 조회한 것으로 간주
        const code = viewError?.parent?.code || viewError?.original?.code;
        if (code !== '23505') {
          throw viewError;
        }
      }
    }

    const poll = await getAnonymousPollForNotice(Number(id), tenant_id, company_id, user_id);

    const formattedNotice = {
      id: notice.id,
      title: notice.title,
      content: notice.content,
      category: notice.category,
      priority: notice.priority,
      status: notice.status,
      isPublic: notice.is_public,
      targetAudience: notice.target_audience,
      author: notice.author?.username || '알 수 없음',
      authorId: notice.author_id,
      authorAvatarUrl: notice.author?.avatar_url || null,
      createdAt: notice.created_at,
      publishedAt: notice.published_at,
      expiresAt: notice.expires_at,
      attachments: notice.attachments ? JSON.parse(notice.attachments) : [],
      readCount: notice.read_count,
      views: viewCount,
      isPinned: notice.is_pinned || false,
      hasPoll: Boolean(poll),
      poll,
    };

    res.json({ success: true, data: formattedNotice });
  } catch (error: any) {
    console.error('공지사항 상세 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 공지사항 생성
export const createNotice = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenant_id, company_id, id: user_id } = req.user;
    const { title, content, category, priority, status, isPublic, targetAudience, expiresAt, attachments, isPinned, poll } = req.body;
    const normalizedAttachments = Array.isArray(attachments)
      ? attachments
      : typeof attachments === 'string' && attachments
        ? [attachments]
        : [];

    if (!tenant_id || !company_id || !user_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 정보가 올바르지 않습니다.' 
      });
    }

    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        message: '제목과 내용은 필수입니다.' 
      });
    }

    const noticeData: any = {
      tenant_id,
      company_id,
      title,
      content,
      category: category || 'general',
      priority: priority || 'medium',
      status: status || 'draft',
      is_public: isPublic !== undefined ? isPublic : true,
      target_audience: targetAudience || 'all',
      author_id: user_id,
      attachments: normalizedAttachments.length > 0 ? JSON.stringify(normalizedAttachments) : null,
      read_count: 0,
      views: 0,
      is_active: true,
      is_pinned: isPinned !== undefined ? isPinned : false
    };

    if (status === 'published') {
      noticeData.published_at = new Date();
    }

    if (expiresAt) {
      noticeData.expires_at = new Date(expiresAt);
    }

    const notice = await (Notice as any).create(noticeData);

    if (poll && (poll.enabled || poll.question || (Array.isArray(poll.options) && poll.options.length > 0))) {
      try {
        await createPollForNotice({
          noticeId: notice.id,
          tenantId: tenant_id,
          companyId: company_id,
          question: poll.question,
          options: Array.isArray(poll.options) ? poll.options : [],
          opensAt: poll.opensAt || poll.opens_at || null,
          closesAt: poll.closesAt || poll.closes_at || null,
        });
      } catch (pollErr: any) {
        await notice.update({ is_active: false });
        const statusCode = pollErr.status || 400;
        return res.status(statusCode).json({
          success: false,
          message: pollErr.message || '투표 생성에 실패했습니다.',
        });
      }
    }

    res.status(201).json({ success: true, data: notice });
  } catch (error: any) {
    console.error('공지사항 생성 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 공지사항 수정
export const updateNotice = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, company_id } = req.user;
    const { title, content, category, priority, status, isPublic, targetAudience, expiresAt, attachments, isPinned } = req.body;
    const normalizedAttachments = Array.isArray(attachments)
      ? attachments
      : typeof attachments === 'string' && attachments
        ? [attachments]
        : [];

    if (!tenant_id || !company_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 정보가 올바르지 않습니다.' 
      });
    }

    const notice = await (Notice as any).findOne({
      where: { id, tenant_id, company_id, is_active: true }
    });

    if (!notice) {
      return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
    }

    const updateData: any = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (category) updateData.category = category;
    if (priority) updateData.priority = priority;
    if (status) {
      updateData.status = status;
      if (status === 'published' && !notice.published_at) {
        updateData.published_at = new Date();
      }
    }
    if (isPublic !== undefined) updateData.is_public = isPublic;
    if (targetAudience) updateData.target_audience = targetAudience;
    if (expiresAt !== undefined) updateData.expires_at = expiresAt ? new Date(expiresAt) : null;
    if (attachments !== undefined) {
      updateData.attachments = normalizedAttachments.length > 0 ? JSON.stringify(normalizedAttachments) : null;
    }
    if (isPinned !== undefined) updateData.is_pinned = isPinned;

    await notice.update(updateData);

    res.json({ success: true, data: notice });
  } catch (error: any) {
    console.error('공지사항 수정 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 공지사항 삭제 (소프트 삭제)
export const deleteNotice = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, company_id } = req.user;

    if (!tenant_id || !company_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 정보가 올바르지 않습니다.' 
      });
    }

    const notice = await (Notice as any).findOne({
      where: { id, tenant_id, company_id, is_active: true }
    });

    if (!notice) {
      return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
    }

    await notice.update({ is_active: false });
    await softDeletePollForNotice(Number(id), tenant_id, company_id);

    res.json({ success: true, message: '공지사항이 성공적으로 삭제되었습니다.' });
  } catch (error: any) {
    console.error('공지사항 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 공지사항 게시
export const publishNotice = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, company_id } = req.user;

    const notice = await (Notice as any).findOne({
      where: { id, tenant_id, company_id, is_active: true }
    });

    if (!notice) {
      return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
    }

    await notice.update({
      status: 'published',
      published_at: new Date()
    });

    res.json({ success: true, message: '공지사항이 게시되었습니다.', data: notice });
  } catch (error: any) {
    console.error('공지사항 게시 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 공지사항 보관
export const archiveNotice = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, company_id } = req.user;

    const notice = await (Notice as any).findOne({
      where: { id, tenant_id, company_id, is_active: true }
    });

    if (!notice) {
      return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
    }

    await notice.update({ status: 'archived' });

    res.json({ success: true, message: '공지사항이 보관되었습니다.', data: notice });
  } catch (error: any) {
    console.error('공지사항 보관 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



