import { Response } from 'express';
import { Op } from 'sequelize';
import { RequestWithUser } from '../types';
import { RoomType } from '../models';

export const getRoomTypes = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const { status, company_id } = req.query;

    const whereClause: any = {};

    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    } else if (userRole === 'root' && company_id) {
      whereClause.company_id = parseInt(company_id as string, 10);
    } else if (userRole === 'audit') {
      if (tenantId) whereClause.tenant_id = tenantId;
      if (companyId) whereClause.company_id = companyId;
    }

    if (status === 'active') {
      whereClause.is_active = true;
    } else if (status === 'inactive') {
      whereClause.is_active = false;
    }

    const roomTypes = await (RoomType as any).findAll({
      where: whereClause,
      order: [['name', 'ASC']],
    });

    res.json({ success: true, data: roomTypes });
  } catch (error: any) {
    console.error('객실 유형 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '객실 유형 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const createRoomType = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const { name, room_count, nightly_rate, description, is_active } = req.body;

    if (!name || room_count === undefined || nightly_rate === undefined) {
      return res.status(400).json({
        success: false,
        message: '필수 필드가 누락되었습니다.',
      });
    }

    const existing = await (RoomType as any).findOne({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        name,
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: '이미 등록된 객실 유형입니다.',
      });
    }

    const roomType = await (RoomType as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      name,
      room_count,
      nightly_rate,
      description: description || null,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      created_by: userId,
    });

    res.status(201).json({ success: true, data: roomType });
  } catch (error: any) {
    console.error('객실 유형 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '객실 유형 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateRoomType = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const { name, room_count, nightly_rate, description, is_active } = req.body;

    const whereClause: any = { id };

    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const roomType = await (RoomType as any).findOne({ where: whereClause });

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: '객실 유형을 찾을 수 없습니다.',
      });
    }

    if (name) {
      const duplicate = await (RoomType as any).findOne({
        where: {
          tenant_id: roomType.tenant_id,
          company_id: roomType.company_id,
          name,
          id: { [Op.ne]: roomType.id },
        },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: '이미 등록된 객실 유형입니다.',
        });
      }
    }

    await roomType.update({
      name: name !== undefined ? name : roomType.name,
      room_count: room_count !== undefined ? room_count : roomType.room_count,
      nightly_rate: nightly_rate !== undefined ? nightly_rate : roomType.nightly_rate,
      description: description !== undefined ? description : roomType.description,
      is_active: is_active !== undefined ? Boolean(is_active) : roomType.is_active,
    });

    res.json({ success: true, data: roomType });
  } catch (error: any) {
    console.error('객실 유형 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '객실 유형 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteRoomType = async (req: RequestWithUser, res: Response) => {
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

    const roomType = await (RoomType as any).findOne({ where: whereClause });

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: '객실 유형을 찾을 수 없습니다.',
      });
    }

    await roomType.update({ is_active: false });

    res.json({ success: true, message: '객실 유형이 비활성화되었습니다.' });
  } catch (error: any) {
    console.error('객실 유형 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '객실 유형 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
