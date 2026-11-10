import { Response } from 'express';
import { RequestWithUser } from '../types';
import { WorkStatistic, User } from '../models';
import { Op } from 'sequelize';

// 업무 통계 목록 조회
export const getWorkStatistics = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { user_id, period, start_period, end_period, company_id } = req.query;

    const whereClause: any = {};
    
    // root나 audit 권한이면 모든 통계 조회 가능, 아니면 자신의 회사 통계만
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
      
      // 일반 사용자는 자신의 통계만 조회
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

    if (period) {
      whereClause.period = period;
    } else if (start_period && end_period) {
      whereClause.period = {
        [Op.between]: [start_period, end_period]
      };
    }

    // 활성화된 업무 통계만 조회
    whereClause.is_active = true;

    const statistics = await (WorkStatistic as any).findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        }
      ],
      order: [['period', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: statistics
    });
  } catch (error: any) {
    console.error('업무 통계 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 통계 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 업무 통계 상세 조회
export const getWorkStatistic = async (req: RequestWithUser, res: Response) => {
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
      
      if (userRole === 'user') {
        whereClause.user_id = userId;
      }
    }

    const statistic = await (WorkStatistic as any).findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        }
      ]
    });

    if (!statistic) {
      return res.status(404).json({ 
        success: false, 
        message: '업무 통계를 찾을 수 없습니다.' 
      });
    }

    res.json({ success: true, data: statistic });
  } catch (error: any) {
    console.error('업무 통계 상세 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 통계 상세 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 업무 통계 생성
export const createWorkStatistic = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { user_id, period, total_hours, productive_hours, tasks_completed, tasks_assigned, 
            efficiency, productivity, attendance_rate, overtime_hours, break_time, 
            focus_time, meeting_time, code_review_time, testing_time, documentation_time } = req.body;

    // 사용할 user_id 결정 (관리자는 다른 사용자 대신 생성 가능)
    const targetUserId = (userRole === 'admin' || userRole === 'root') && user_id ? user_id : userId;

    if (!period) {
      return res.status(400).json({ 
        success: false, 
        message: '기간은 필수입니다.' 
      });
    }

    // 중복 확인
    const existing = await (WorkStatistic as any).findOne({
      where: {
        user_id: targetUserId,
        period,
        tenant_id: tenantId,
        company_id: companyId
      }
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: '해당 기간의 업무 통계가 이미 존재합니다.' 
      });
    }

    const statistic = await (WorkStatistic as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      user_id: targetUserId,
      period,
      is_active: true,
      total_hours: total_hours || 0,
      productive_hours: productive_hours || 0,
      tasks_completed: tasks_completed || 0,
      tasks_assigned: tasks_assigned || 0,
      efficiency: efficiency || 0,
      productivity: productivity || 0,
      attendance_rate: attendance_rate || 0,
      overtime_hours: overtime_hours || 0,
      break_time: break_time || 0,
      focus_time: focus_time || 0,
      meeting_time: meeting_time || 0,
      code_review_time: code_review_time || 0,
      testing_time: testing_time || 0,
      documentation_time: documentation_time || 0
    });

    // 사용자 정보 포함하여 반환
    const statisticWithUser = await (WorkStatistic as any).findByPk(statistic.id, {
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
      data: statisticWithUser 
    });
  } catch (error: any) {
    console.error('업무 통계 생성 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 통계 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 업무 통계 수정
export const updateWorkStatistic = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;

    const whereClause: any = { id };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const statistic = await (WorkStatistic as any).findOne({
      where: whereClause
    });

    if (!statistic) {
      return res.status(404).json({ 
        success: false, 
        message: '업무 통계를 찾을 수 없습니다.' 
      });
    }

    await statistic.update(req.body);

    // 사용자 정보 포함하여 반환
    const statisticWithUser = await (WorkStatistic as any).findByPk(statistic.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
        }
      ]
    });

    res.json({ 
      success: true, 
      data: statisticWithUser 
    });
  } catch (error: any) {
    console.error('업무 통계 수정 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 통계 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 업무 통계 삭제
export const deleteWorkStatistic = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;

    const whereClause: any = { id };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const statistic = await (WorkStatistic as any).findOne({
      where: whereClause
    });

    if (!statistic) {
      return res.status(404).json({ 
        success: false, 
        message: '업무 통계를 찾을 수 없습니다.' 
      });
    }

    // 소프트 삭제: is_active를 false로 설정
    await statistic.update({ is_active: false });

    res.json({ 
      success: true, 
      message: '업무 통계가 비활성화되었습니다.' 
    });
  } catch (error: any) {
    console.error('업무 통계 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '업무 통계 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

