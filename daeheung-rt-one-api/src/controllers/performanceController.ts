import { Response } from 'express';
import { AuthRequest } from '../types';
import { Performance, User } from '../models';
import { Op } from 'sequelize';

// 성과 목록 조회
export const getPerformances = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { user_id, status, review_period, company_id } = req.query;

    const whereClause: any = {};
    
    // root나 audit 권한이면 모든 성과 조회 가능, 아니면 자신의 회사 성과만
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
      
      // 일반 사용자는 자신의 성과만 조회
      if (userRole === 'user') {
        whereClause.user_id = userId;
      }
    } else {
      // root는 company_id 쿼리 파라미터로 회사별 필터링 가능
      if (userRole === 'root' && company_id) {
        whereClause.company_id = parseInt(company_id as string);
      } else if (userRole === 'root') {
        // root가 company_id를 지정하지 않으면 모든 회사 조회
      } else {
        // audit는 모든 회사 조회 가능
        if (tenantId) whereClause.tenant_id = tenantId;
        if (companyId) whereClause.company_id = companyId;
      }
    }

    if (user_id) {
      whereClause.user_id = user_id;
    }

    if (status) {
      whereClause.status = status;
    }

    if (review_period) {
      whereClause.review_period = review_period;
    }

    // 활성화된 성과만 조회
    whereClause.is_active = true;

    const performances = await (Performance as any).findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'username'],
          required: false
        }
      ],
      order: [['review_period', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: performances
    });
  } catch (error: any) {
    console.error('성과 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '성과 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 성과 상세 조회
export const getPerformance = async (req: AuthRequest, res: Response) => {
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
      
      // 일반 사용자는 자신의 성과만 조회
      if (userRole === 'user') {
        whereClause.user_id = userId;
      }
    }

    // 활성화된 성과만 조회
    whereClause.is_active = true;

    const performance = await (Performance as any).findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
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

    if (!performance) {
      return res.status(404).json({ 
        success: false, 
        message: '성과 정보를 찾을 수 없습니다.' 
      });
    }

    res.json({ success: true, data: performance });
  } catch (error: any) {
    console.error('성과 상세 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '성과 상세 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 성과 생성
export const createPerformance = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { user_id, review_period, overall_rating, goals, competencies, strengths, improvements, manager_comment, employee_comment } = req.body;

    // 사용할 user_id 결정 (관리자는 다른 사용자 대신 생성 가능)
    const targetUserId = (userRole === 'admin' || userRole === 'root') && user_id ? user_id : userId;

    if (!review_period || !overall_rating || !goals || !competencies || !manager_comment) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 필드가 누락되었습니다.' 
      });
    }

    const performance = await (Performance as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      user_id: targetUserId,
      is_active: true,
      review_period,
      overall_rating: parseFloat(overall_rating),
      goals: Array.isArray(goals) ? goals : [],
      competencies: Array.isArray(competencies) ? competencies : [],
      strengths: Array.isArray(strengths) ? strengths : [],
      improvements: Array.isArray(improvements) ? improvements : [],
      manager_comment,
      employee_comment: employee_comment || null,
      status: 'draft'
    });

    // 사용자 정보 포함하여 반환
    const performanceWithUser = await (Performance as any).findByPk(performance.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        }
      ]
    });

    res.status(201).json({ 
      success: true, 
      data: performanceWithUser 
    });
  } catch (error: any) {
    console.error('성과 생성 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '성과 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 성과 수정
export const updatePerformance = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { overall_rating, goals, competencies, strengths, improvements, manager_comment, employee_comment, status } = req.body;

    const whereClause: any = { id, is_active: true };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const performance = await (Performance as any).findOne({
      where: whereClause
    });

    if (!performance) {
      return res.status(404).json({ 
        success: false, 
        message: '성과 정보를 찾을 수 없습니다.' 
      });
    }

    // 일반 사용자는 자신의 코멘트만 수정 가능
    if (userRole === 'user' && performance.user_id === userId) {
      await performance.update({
        employee_comment: employee_comment !== undefined ? employee_comment : performance.employee_comment
      });
    } else if (userRole === 'admin' || userRole === 'root') {
      // 관리자는 모든 필드 수정 가능
      await performance.update({
        overall_rating: overall_rating !== undefined ? parseFloat(overall_rating) : performance.overall_rating,
        goals: goals !== undefined ? goals : performance.goals,
        competencies: competencies !== undefined ? competencies : performance.competencies,
        strengths: strengths !== undefined ? strengths : performance.strengths,
        improvements: improvements !== undefined ? improvements : performance.improvements,
        manager_comment: manager_comment !== undefined ? manager_comment : performance.manager_comment,
        employee_comment: employee_comment !== undefined ? employee_comment : performance.employee_comment,
        status: status !== undefined ? status : performance.status,
        reviewed_by: status === 'reviewed' || status === 'approved' || status === 'finalized' ? userId : performance.reviewed_by
      });
    } else {
      return res.status(403).json({ 
        success: false, 
        message: '수정 권한이 없습니다.' 
      });
    }

    // 사용자 정보 포함하여 반환
    const performanceWithUser = await (Performance as any).findByPk(performance.id, {
      include: [
        {
          model: User,
          as: 'user',
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

    res.json({ 
      success: true, 
      data: performanceWithUser 
    });
  } catch (error: any) {
    console.error('성과 수정 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '성과 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 성과 삭제
export const deletePerformance = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role as string;

    // 관리자만 삭제 가능
    if (userRole !== 'admin' && userRole !== 'root') {
      return res.status(403).json({ 
        success: false, 
        message: '삭제 권한이 없습니다.' 
      });
    }

    const whereClause: any = { id };
    
    // root가 아닌 경우에만 tenant_id와 company_id 필터링
    if (userRole === 'admin') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const performance = await (Performance as any).findOne({
      where: whereClause
    });

    if (!performance) {
      return res.status(404).json({ 
        success: false, 
        message: '성과 정보를 찾을 수 없습니다.' 
      });
    }

    // 소프트 삭제: is_active를 false로 설정
    await performance.update({ is_active: false });

    res.json({ 
      success: true, 
      message: '성과 정보가 비활성화되었습니다.' 
    });
  } catch (error: any) {
    console.error('성과 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '성과 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

