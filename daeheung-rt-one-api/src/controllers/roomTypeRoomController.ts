import { Response } from 'express';
import { RequestWithUser } from '../types';
import { RoomTypeRoom } from '../models';

export const getRoomTypeRooms = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const { room_type_id } = req.query;

    const whereClause: any = {};

    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    } else if (userRole === 'root' && tenantId && companyId) {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    if (room_type_id) {
      whereClause.room_type_id = Number(room_type_id);
    }

    const rooms = await (RoomTypeRoom as any).findAll({
      where: whereClause,
      order: [['room_type_id', 'ASC'], ['room_number', 'ASC']],
    });

    res.json({ success: true, data: rooms });
  } catch (error: any) {
    console.error('객실 호실명 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '객실 호실명 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const upsertRoomTypeRoom = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const { room_type_id, room_number, room_name } = req.body;

    if (!tenantId || !companyId || !userId) {
      return res.status(400).json({
        success: false,
        message: '사용자 정보가 올바르지 않습니다.',
      });
    }

    if (!room_type_id || !room_number) {
      return res.status(400).json({
        success: false,
        message: '필수 필드가 누락되었습니다.',
      });
    }

    const normalizedNumber = String(room_number).trim();
    const normalizedName = room_name ? String(room_name).trim() : '';

    const existing = await (RoomTypeRoom as any).findOne({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        room_type_id,
        room_number: normalizedNumber,
      },
    });

    if (!normalizedName) {
      if (existing) {
        await existing.destroy();
      }
      return res.json({ success: true, data: null });
    }

    if (existing) {
      await existing.update({ room_name: normalizedName });
      return res.json({ success: true, data: existing });
    }

    const created = await (RoomTypeRoom as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      room_type_id,
      room_number: normalizedNumber,
      room_name: normalizedName,
      created_by: userId,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    console.error('객실 호실명 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '객실 호실명 저장 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
