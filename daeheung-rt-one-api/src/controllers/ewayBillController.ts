import { Response } from 'express';
import { RequestWithUser } from '../types';
import { EWayBill, EWayBillItem, User, Company, Invoice } from '../models';
import { Op } from 'sequelize';
import { env } from '../config/env';
import {
  assertLiveEWayConfig,
  buildNicStyleEWayBillPayload,
  submitEWayBillToGstn
} from '../services/gstEWayBillService';

// E-Way Bill 번호 생성 함수
const generateEwayBillNumber = async (companyId: number): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `EWB-${year}-`;
  
  // 올해 생성된 E-Way Bill 개수 조회
  const count = await (EWayBill as any).count({
    where: {
      company_id: companyId,
      eway_bill_number: {
        [Op.like]: `${prefix}%`
      }
    }
  });
  
  const sequence = String(count + 1).padStart(6, '0');
  return `${prefix}${sequence}`;
};

// E-Way Bill 목록 조회
export const getEWayBills = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    const { status, invoice_number, start_date, end_date, company_id, page = 1, limit = 20 } = req.query;

    const whereClause: any = {};
    
    // root나 audit 권한이면 모든 E-Way Bill 조회 가능, 아니면 자신의 회사만
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    } else if (userRole === 'root' && company_id) {
      whereClause.company_id = parseInt(company_id as string);
    }
    
    // 활성화된 E-Way Bill만 조회
    whereClause.is_active = true;
    
    // 필터링
    if (status) {
      whereClause.status = status;
    }
    
    if (invoice_number) {
      whereClause.invoice_number = {
        [Op.like]: `%${invoice_number}%`
      };
    }
    
    if (start_date && end_date) {
      whereClause.generated_at = {
        [Op.between]: [start_date, end_date]
      };
    }
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const { count, rows } = await (EWayBill as any).findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'generator',
          attributes: ['id', 'username', 'email']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Invoice,
          as: 'invoice',
          attributes: ['id', 'invoice_number'],
          required: false
        },
        {
          model: EWayBillItem,
          as: 'items',
          required: false
        }
      ],
      order: [['generated_at', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit as string),
      offset: offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(count / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    console.error('E-Way Bill 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: 'E-Way Bill 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// E-Way Bill 상세 조회
export const getEWayBill = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;

    const whereClause: any = { id, is_active: true };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const ewayBill = await (EWayBill as any).findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'generator',
          attributes: ['id', 'username', 'email']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Invoice,
          as: 'invoice',
          attributes: ['id', 'invoice_number'],
          required: false
        },
        {
          model: EWayBillItem,
          as: 'items',
          required: false
        }
      ]
    });

    if (!ewayBill) {
      return res.status(404).json({
        success: false,
        message: 'E-Way Bill을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: ewayBill
    });
  } catch (error: any) {
    console.error('E-Way Bill 상세 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: 'E-Way Bill 상세 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// E-Way Bill 생성
export const createEWayBill = async (req: RequestWithUser, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    
    const {
      invoice_id,
      invoice_number,
      invoice_date,
      supply_type,
      sub_supply_type,
      document_type,
      document_number,
      document_date,
      from_gstin,
      from_name,
      from_address,
      from_pincode,
      from_state,
      from_state_code,
      to_gstin,
      to_name,
      to_address,
      to_pincode,
      to_state,
      to_state_code,
      transport_mode,
      vehicle_number,
      vehicle_type,
      transporter_id,
      transporter_name,
      transporter_gstin,
      transporter_doc_number,
      transporter_doc_date,
      distance,
      items,
      notes
    } = req.body;

    // E-Way Bill 번호 생성
    const ewayBillNumber = await generateEwayBillNumber(companyId);

    // 상품 항목 계산
    let totalValue = 0;
    let totalTaxAmount = 0;
    
    if (items && Array.isArray(items) && items.length > 0) {
      items.forEach((item: any) => {
        const itemValue = parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0);
        totalValue += itemValue;
        
        // 세금 계산 (CGST + SGST 또는 IGST)
        let itemTax = 0;
        if (item.cgst_amount) itemTax += parseFloat(item.cgst_amount);
        if (item.sgst_amount) itemTax += parseFloat(item.sgst_amount);
        if (item.igst_amount) itemTax += parseFloat(item.igst_amount);
        if (item.cess_amount) itemTax += parseFloat(item.cess_amount);
        
        totalTaxAmount += itemTax;
      });
    }

    const totalAmount = totalValue + totalTaxAmount;

    // E-Way Bill 생성
    const ewayBill = await (EWayBill as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      eway_bill_number: ewayBillNumber,
      invoice_id: invoice_id || null,
      invoice_number,
      invoice_date,
      supply_type,
      sub_supply_type,
      document_type: document_type || 'invoice',
      document_number: document_number || invoice_number,
      document_date: document_date || invoice_date,
      from_gstin,
      from_name,
      from_address,
      from_pincode,
      from_state,
      from_state_code,
      to_gstin,
      to_name,
      to_address,
      to_pincode,
      to_state,
      to_state_code,
      transport_mode: transport_mode || 'road',
      vehicle_number,
      vehicle_type,
      transporter_id,
      transporter_name,
      transporter_gstin,
      transporter_doc_number,
      transporter_doc_date,
      distance,
      total_value: totalValue,
      total_tax_amount: totalTaxAmount,
      total_amount: totalAmount,
      status: 'draft',
      generated_by: userId,
      notes,
      is_active: true
    });

    // 상품 항목 생성
    if (items && Array.isArray(items) && items.length > 0) {
      const itemPromises = items.map((item: any) => {
        const itemValue = parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0);
        let itemTax = 0;
        if (item.cgst_amount) itemTax += parseFloat(item.cgst_amount);
        if (item.sgst_amount) itemTax += parseFloat(item.sgst_amount);
        if (item.igst_amount) itemTax += parseFloat(item.igst_amount);
        if (item.cess_amount) itemTax += parseFloat(item.cess_amount);
        
        return (EWayBillItem as any).create({
          eway_bill_id: ewayBill.id,
          item_name: item.item_name,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          unit: item.unit || 'PCS',
          unit_price: item.unit_price,
          total_value: itemValue,
          cgst_rate: item.cgst_rate,
          cgst_amount: item.cgst_amount || 0,
          sgst_rate: item.sgst_rate,
          sgst_amount: item.sgst_amount || 0,
          igst_rate: item.igst_rate,
          igst_amount: item.igst_amount || 0,
          cess_rate: item.cess_rate,
          cess_amount: item.cess_amount || 0,
          total_tax_amount: itemTax,
          total_amount: itemValue + itemTax
        });
      });
      
      await Promise.all(itemPromises);
    }

    // 생성된 E-Way Bill 조회 (항목 포함)
    const createdEWayBill = await (EWayBill as any).findByPk(ewayBill.id, {
      include: [
        {
          model: EWayBillItem,
          as: 'items'
        },
        {
          model: User,
          as: 'generator',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'E-Way Bill이 생성되었습니다.',
      data: createdEWayBill
    });
  } catch (error: any) {
    console.error('E-Way Bill 생성 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: 'E-Way Bill 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// E-Way Bill 수정
export const updateEWayBill = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    
    const whereClause: any = { id, is_active: true };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const ewayBill = await (EWayBill as any).findOne({ where: whereClause });

    if (!ewayBill) {
      return res.status(404).json({
        success: false,
        message: 'E-Way Bill을 찾을 수 없습니다.'
      });
    }

    // 생성된 E-Way Bill은 수정 불가
    if (ewayBill.status === 'generated' || ewayBill.status === 'active') {
      return res.status(400).json({
        success: false,
        message: '이미 생성된 E-Way Bill은 수정할 수 없습니다.'
      });
    }

    const {
      invoice_id,
      invoice_number,
      invoice_date,
      supply_type,
      sub_supply_type,
      document_type,
      document_number,
      document_date,
      from_gstin,
      from_name,
      from_address,
      from_pincode,
      from_state,
      from_state_code,
      to_gstin,
      to_name,
      to_address,
      to_pincode,
      to_state,
      to_state_code,
      transport_mode,
      vehicle_number,
      vehicle_type,
      transporter_id,
      transporter_name,
      transporter_gstin,
      transporter_doc_number,
      transporter_doc_date,
      distance,
      items,
      notes
    } = req.body;

    // 상품 항목 재계산
    let totalValue = 0;
    let totalTaxAmount = 0;
    
    if (items && Array.isArray(items) && items.length > 0) {
      items.forEach((item: any) => {
        const itemValue = parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0);
        totalValue += itemValue;
        
        let itemTax = 0;
        if (item.cgst_amount) itemTax += parseFloat(item.cgst_amount);
        if (item.sgst_amount) itemTax += parseFloat(item.sgst_amount);
        if (item.igst_amount) itemTax += parseFloat(item.igst_amount);
        if (item.cess_amount) itemTax += parseFloat(item.cess_amount);
        
        totalTaxAmount += itemTax;
      });
    }

    const totalAmount = totalValue + totalTaxAmount;

    // E-Way Bill 업데이트
    await ewayBill.update({
      invoice_id: invoice_id !== undefined ? invoice_id : ewayBill.invoice_id,
      invoice_number: invoice_number || ewayBill.invoice_number,
      invoice_date: invoice_date || ewayBill.invoice_date,
      supply_type: supply_type || ewayBill.supply_type,
      sub_supply_type: sub_supply_type !== undefined ? sub_supply_type : ewayBill.sub_supply_type,
      document_type: document_type || ewayBill.document_type,
      document_number: document_number || ewayBill.document_number,
      document_date: document_date || ewayBill.document_date,
      from_gstin: from_gstin || ewayBill.from_gstin,
      from_name: from_name || ewayBill.from_name,
      from_address: from_address || ewayBill.from_address,
      from_pincode: from_pincode || ewayBill.from_pincode,
      from_state: from_state || ewayBill.from_state,
      from_state_code: from_state_code || ewayBill.from_state_code,
      to_gstin: to_gstin !== undefined ? to_gstin : ewayBill.to_gstin,
      to_name: to_name || ewayBill.to_name,
      to_address: to_address || ewayBill.to_address,
      to_pincode: to_pincode || ewayBill.to_pincode,
      to_state: to_state || ewayBill.to_state,
      to_state_code: to_state_code || ewayBill.to_state_code,
      transport_mode: transport_mode || ewayBill.transport_mode,
      vehicle_number: vehicle_number !== undefined ? vehicle_number : ewayBill.vehicle_number,
      vehicle_type: vehicle_type !== undefined ? vehicle_type : ewayBill.vehicle_type,
      transporter_id: transporter_id !== undefined ? transporter_id : ewayBill.transporter_id,
      transporter_name: transporter_name !== undefined ? transporter_name : ewayBill.transporter_name,
      transporter_gstin: transporter_gstin !== undefined ? transporter_gstin : ewayBill.transporter_gstin,
      transporter_doc_number: transporter_doc_number !== undefined ? transporter_doc_number : ewayBill.transporter_doc_number,
      transporter_doc_date: transporter_doc_date !== undefined ? transporter_doc_date : ewayBill.transporter_doc_date,
      distance: distance !== undefined ? distance : ewayBill.distance,
      total_value: totalValue,
      total_tax_amount: totalTaxAmount,
      total_amount: totalAmount,
      notes: notes !== undefined ? notes : ewayBill.notes
    });

    // 기존 항목 삭제 후 새로 생성
    if (items && Array.isArray(items)) {
      await (EWayBillItem as any).destroy({
        where: { eway_bill_id: ewayBill.id }
      });

      if (items.length > 0) {
        const itemPromises = items.map((item: any) => {
          const itemValue = parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0);
          let itemTax = 0;
          if (item.cgst_amount) itemTax += parseFloat(item.cgst_amount);
          if (item.sgst_amount) itemTax += parseFloat(item.sgst_amount);
          if (item.igst_amount) itemTax += parseFloat(item.igst_amount);
          if (item.cess_amount) itemTax += parseFloat(item.cess_amount);
          
          return (EWayBillItem as any).create({
            eway_bill_id: ewayBill.id,
            item_name: item.item_name,
            hsn_code: item.hsn_code,
            quantity: item.quantity,
            unit: item.unit || 'PCS',
            unit_price: item.unit_price,
            total_value: itemValue,
            cgst_rate: item.cgst_rate,
            cgst_amount: item.cgst_amount || 0,
            sgst_rate: item.sgst_rate,
            sgst_amount: item.sgst_amount || 0,
            igst_rate: item.igst_rate,
            igst_amount: item.igst_amount || 0,
            cess_rate: item.cess_rate,
            cess_amount: item.cess_amount || 0,
            total_tax_amount: itemTax,
            total_amount: itemValue + itemTax
          });
        });
        
        await Promise.all(itemPromises);
      }
    }

    // 업데이트된 E-Way Bill 조회
    const updatedEWayBill = await (EWayBill as any).findByPk(ewayBill.id, {
      include: [
        {
          model: EWayBillItem,
          as: 'items'
        },
        {
          model: User,
          as: 'generator',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    res.json({
      success: true,
      message: 'E-Way Bill이 수정되었습니다.',
      data: updatedEWayBill
    });
  } catch (error: any) {
    console.error('E-Way Bill 수정 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: 'E-Way Bill 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// E-Way Bill 생성 (상태를 generated로 변경)
export const generateEWayBill = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    
    const whereClause: any = { id, is_active: true };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const ewayBill = await (EWayBill as any).findOne({
      where: whereClause,
      include: [{ model: EWayBillItem, as: 'items', required: false }]
    });

    if (!ewayBill) {
      return res.status(404).json({
        success: false,
        message: 'E-Way Bill을 찾을 수 없습니다.'
      });
    }

    if (ewayBill.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Draft 상태의 E-Way Bill만 생성할 수 있습니다.'
      });
    }

    const items = (ewayBill as any).items as Array<Record<string, unknown>> | undefined;
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '품목이 없으면 E-Way Bill을 발급할 수 없습니다.'
      });
    }

    const cfgErr = assertLiveEWayConfig();
    if (cfgErr) {
      return res.status(400).json({
        success: false,
        message: cfgErr
      });
    }

    const billRow = ewayBill.get({ plain: true }) as Record<string, unknown>;
    const payload = buildNicStyleEWayBillPayload(billRow as any, items as any);
    const isLive = (env.GST_EWAY_MODE || 'mock').toLowerCase() === 'live';

    let result;
    try {
      result = await submitEWayBillToGstn(payload);
    } catch (err: any) {
      const msg = err?.message || 'GSTN E-Way Bill 발급 실패';
      await ewayBill.update({ gstn_last_error: String(msg).slice(0, 2000) });
      return res.status(502).json({
        success: false,
        message: isLive ? msg : `E-Way Bill 처리 실패: ${msg}`,
        error: process.env.NODE_ENV === 'development' ? msg : undefined
      });
    }

    const generatedAt = new Date();
    let validUntil = new Date(generatedAt);
    if (isLive) {
      validUntil = result.validUpto;
    } else {
      validUntil.setDate(validUntil.getDate() + 7);
    }

    await ewayBill.update({
      status: 'generated',
      generated_at: generatedAt,
      valid_until: validUntil,
      gstn_eway_bill_no: isLive ? result.ewayBillNo : null,
      gstn_valid_upto: isLive ? result.validUpto : null,
      gstn_last_error: null,
      qr_code: result.qrCode
    });

    const updatedEWayBill = await (EWayBill as any).findByPk(ewayBill.id, {
      include: [
        {
          model: EWayBillItem,
          as: 'items'
        },
        {
          model: User,
          as: 'generator',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    res.json({
      success: true,
      message: 'E-Way Bill이 생성되었습니다.',
      data: updatedEWayBill
    });
  } catch (error: any) {
    console.error('E-Way Bill 생성 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: 'E-Way Bill 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// E-Way Bill 취소
export const cancelEWayBill = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    
    const whereClause: any = { id, is_active: true };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const ewayBill = await (EWayBill as any).findOne({ where: whereClause });

    if (!ewayBill) {
      return res.status(404).json({
        success: false,
        message: 'E-Way Bill을 찾을 수 없습니다.'
      });
    }

    if (ewayBill.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: '이미 취소된 E-Way Bill입니다.'
      });
    }

    await ewayBill.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      cancellation_reason: cancellation_reason || '사용자 요청에 의한 취소'
    });

    res.json({
      success: true,
      message: 'E-Way Bill이 취소되었습니다.',
      data: ewayBill
    });
  } catch (error: any) {
    console.error('E-Way Bill 취소 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: 'E-Way Bill 취소 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// E-Way Bill 삭제 (소프트 삭제)
export const deleteEWayBill = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    const companyId = req.user?.company_id;
    const userRole = req.user?.role;
    
    const whereClause: any = { id, is_active: true };
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const ewayBill = await (EWayBill as any).findOne({ where: whereClause });

    if (!ewayBill) {
      return res.status(404).json({
        success: false,
        message: 'E-Way Bill을 찾을 수 없습니다.'
      });
    }

    // 생성된 E-Way Bill은 삭제 불가
    if (ewayBill.status === 'generated' || ewayBill.status === 'active') {
      return res.status(400).json({
        success: false,
        message: '생성된 E-Way Bill은 삭제할 수 없습니다. 취소를 사용하세요.'
      });
    }

    await ewayBill.update({ is_active: false });

    res.json({
      success: true,
      message: 'E-Way Bill이 삭제되었습니다.'
    });
  } catch (error: any) {
    console.error('E-Way Bill 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: 'E-Way Bill 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



