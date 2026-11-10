import express from 'express';
import { Request, Response } from 'express';
import { SupportTicket, SupportResponse } from '../models';
import { validateBody } from '../middleware/validate';

const router = express.Router();

let hasSupportTicketCompanyIdColumn: boolean | null = null;

const ensureSupportTicketSchemaInfo = async () => {
  if (hasSupportTicketCompanyIdColumn !== null) return;
  try {
    const queryInterface = (SupportTicket as any).sequelize?.getQueryInterface?.();
    if (!queryInterface) {
      hasSupportTicketCompanyIdColumn = true;
      return;
    }
    const tableDefinition = await queryInterface.describeTable('support_tickets');
    hasSupportTicketCompanyIdColumn = Boolean(tableDefinition?.company_id);
  } catch (error) {
    console.warn('support_tickets 스키마 조회 실패, company_id 컬럼 존재로 가정합니다.', error);
    hasSupportTicketCompanyIdColumn = true;
  }
};

const supportTicketFindOptions = async () => {
  await ensureSupportTicketSchemaInfo();
  if (hasSupportTicketCompanyIdColumn) {
    return {};
  }
  return {
    attributes: {
      exclude: ['company_id']
    }
  };
};

// 지원 티켓 목록 조회
router.get('/', async (req: Request, res: Response) => {
  try {
    const ticketOptionPatch = await supportTicketFindOptions();
    const tickets = await (SupportTicket as any).findAll({
      where: { tenant_id: 1 },
      ...ticketOptionPatch,
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: tickets
    });
  } catch (error: any) {
    console.error('지원 티켓 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '지원 티켓 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 특정 지원 티켓 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ticketOptionPatch = await supportTicketFindOptions();
    const ticket = await (SupportTicket as any).findOne({
      where: { id, tenant_id: 1 },
      ...ticketOptionPatch
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: '지원 티켓을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error: any) {
    console.error('지원 티켓 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '지원 티켓 조회 중 오류가 발생했습니다.'
    });
  }
});

// 지원 티켓 생성
router.post(
  '/',
  validateBody({
    customer_id: { required: true, type: 'number' },
    ticket_number: { required: true, type: 'string', minLength: 1, maxLength: 50 },
    title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    description: { required: true, type: 'string', minLength: 1 },
    category: { type: 'string', maxLength: 50 },
    priority: { type: 'string', maxLength: 20 },
    status: { type: 'string', maxLength: 20 },
    assigned_to: { type: 'number' }
  }),
  async (req: Request, res: Response) => {
  try {
    await ensureSupportTicketSchemaInfo();
    const ticketData = {
      ...req.body,
      tenant_id: 1
    };
    if (hasSupportTicketCompanyIdColumn) {
      (ticketData as any).company_id = 1;
    }

    const ticket = await (SupportTicket as any).create(ticketData);

    res.status(201).json({
      success: true,
      message: '지원 티켓이 성공적으로 등록되었습니다.',
      data: ticket
    });
  } catch (error: any) {
    console.error('지원 티켓 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '지원 티켓 생성 중 오류가 발생했습니다.'
    });
  }
});

// 지원 티켓 수정
router.put(
  '/:id',
  validateBody({
    customer_id: { type: 'number' },
    ticket_number: { type: 'string', minLength: 1, maxLength: 50 },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', minLength: 1 },
    category: { type: 'string', maxLength: 50 },
    priority: { type: 'string', maxLength: 20 },
    status: { type: 'string', maxLength: 20 },
    assigned_to: { type: 'number' }
  }),
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ticketOptionPatch = await supportTicketFindOptions();
    const ticket = await (SupportTicket as any).findOne({
      where: { id, tenant_id: 1 },
      ...ticketOptionPatch
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: '지원 티켓을 찾을 수 없습니다.'
      });
    }

    await ticket.update(req.body);

    res.json({
      success: true,
      message: '지원 티켓이 성공적으로 수정되었습니다.',
      data: ticket
    });
  } catch (error: any) {
    console.error('지원 티켓 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '지원 티켓 수정 중 오류가 발생했습니다.'
    });
  }
});

// 지원 티켓 삭제
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ticketOptionPatch = await supportTicketFindOptions();
    const ticket = await (SupportTicket as any).findOne({
      where: { id, tenant_id: 1 },
      ...ticketOptionPatch
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: '지원 티켓을 찾을 수 없습니다.'
      });
    }

    await ticket.destroy();

    res.json({
      success: true,
      message: '지원 티켓이 성공적으로 삭제되었습니다.'
    });
  } catch (error: any) {
    console.error('지원 티켓 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '지원 티켓 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 지원 티켓 응답 목록 조회
router.get('/:id/responses', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const responses = await (SupportResponse as any).findAll({
      where: { ticket_id: id },
      order: [['created_at', 'ASC']]
    });

    res.json({
      success: true,
      data: responses
    });
  } catch (error: any) {
    console.error('지원 응답 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '지원 응답 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 지원 티켓 응답 생성
router.post(
  '/:id/responses',
  validateBody({
    response: { required: true, type: 'string', minLength: 1 }
  }),
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const responseData = {
      ...req.body,
      ticket_id: id,
      user_id: 1 // 실제로는 인증된 사용자 ID를 사용해야 함
    };

    const response = await (SupportResponse as any).create(responseData);

    // 티켓의 마지막 응답 시간 업데이트
    await (SupportTicket as any).update(
      { last_response_at: new Date() },
      { where: { id } }
    );

    res.status(201).json({
      success: true,
      message: '응답이 성공적으로 등록되었습니다.',
      data: response
    });
  } catch (error: any) {
    console.error('지원 응답 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '지원 응답 생성 중 오류가 발생했습니다.'
    });
  }
});

export default router;
