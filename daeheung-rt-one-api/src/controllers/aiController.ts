import { Request, Response } from 'express';
import { RequestWithUser } from '../types';
import { Op } from 'sequelize';
import { Invoice } from '../models';

// 비용 분석 데이터 조회
export const getCostAnalysis = async (req: RequestWithUser, res: Response) => {
  try {
    const { range = '6months', category = 'all' } = req.query;
    const { tenant_id, company_id } = req.user || {};

    if (!tenant_id || !company_id) {
      return res.status(400).json({
        success: false,
        message: '사용자 정보가 올바르지 않습니다.'
      });
    }

    // 기간 계산
    const now = new Date();
    const startDate = new Date();
    
    switch (range) {
      case '1month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3months':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 6);
    }

    // 비용 데이터 수집
    const whereClause: any = {
      tenant_id,
      company_id,
      created_at: { [Op.gte]: startDate },
      [Op.or]: [
        { payment_status: 'paid' },
        { status: 'paid' },
        { status: 'approved' }
      ]
    };

    // 카테고리별 필터링 (DB 컬럼은 invoice_category 사용)
    const normalizedCategory = String(category || 'all').trim().toLowerCase();
    const allowedInvoiceCategories = new Set(['regular', 'e_invoice', 'proforma']);
    if (normalizedCategory !== 'all' && allowedInvoiceCategories.has(normalizedCategory)) {
      whereClause.invoice_category = normalizedCategory;
    }

    // 인보이스 데이터 (지출/비용 관련)
    const invoices = await (Invoice as any).findAll({
      where: whereClause,
      attributes: ['total_amount', 'invoice_category', 'created_at', 'status', 'payment_status']
    });

    // 월별 데이터 집계
    const monthlyData: { [key: string]: number } = {};
    const categoryData: { [key: string]: number } = {};

    // 인보이스 데이터 집계
    invoices.forEach((invoice: any) => {
      const month = new Date(invoice.created_at).toISOString().substring(0, 7);
      const amount = parseFloat(invoice.total_amount || 0);
      monthlyData[month] = (monthlyData[month] || 0) + amount;
      const catRaw = String(invoice.invoice_category || 'regular').toLowerCase();
      const cat =
        catRaw === 'e_invoice'
          ? '전자 인보이스'
          : catRaw === 'proforma'
            ? '프로포마'
            : '일반 인보이스';
      categoryData[cat] = (categoryData[cat] || 0) + amount;
    });

    // 월별 트렌드 데이터 생성
    const monthlyTrend = Object.keys(monthlyData)
      .sort()
      .map(month => ({
        month,
        cost: monthlyData[month]
      }));

    // 카테고리별 분포 데이터 생성
    const categoryTotal = Object.values(categoryData).reduce((a: number, b: number) => a + b, 0);
    const categoryDistribution = Object.keys(categoryData).map(cat => ({
      category: cat,
      cost: categoryData[cat],
      percentage:
        categoryTotal > 0
          ? (categoryData[cat] / categoryTotal) * 100
          : 0
    }));

    // 총 비용 계산
    const totalCost = Object.values(monthlyData).reduce((a: number, b: number) => a + b, 0);

    // 평균 비용 계산
    const averageCost = monthlyTrend.length > 0 
      ? totalCost / monthlyTrend.length 
      : 0;

    // 최고/최저 비용 찾기
    const costs = monthlyTrend.map(item => item.cost);
    const maxCost = costs.length > 0 ? Math.max(...costs) : 0;
    const minCost = costs.length > 0 ? Math.min(...costs) : 0;
    const monthlyTrendWithBudget = monthlyTrend.map((item) => {
      const budget = Number((item.cost * 1.1).toFixed(2));
      return {
        ...item,
        budget,
        variance: Number((item.cost - budget).toFixed(2))
      };
    });
    const categoryBreakdown = categoryDistribution.map((item, index) => ({
      category: item.category,
      amount: item.cost,
      percentage: Number(item.percentage.toFixed(1)),
      trend: 'stable' as const,
      color: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#4ecdc4'][index % 5]
    }));

    // AI 인사이트 (샘플 데이터)
    const aiInsights = [
      {
        id: '1',
        type: 'cost_optimization',
        title: '비용 절감 기회 발견',
        description: '최근 3개월간 운영비용이 평균보다 15% 높게 나타났습니다.',
        confidence: 0.85,
        impact: 'high',
        recommendations: [
          '불필요한 구독 서비스 취소 검토',
          '에너지 사용량 최적화',
          '공급업체 재협상 고려'
        ],
        data: { period: '3months', increase: 15 },
        createdAt: new Date().toISOString(),
        status: 'new',
        priority: 1,
        category: '운영비',
        tags: ['비용절감', '최적화'],
        estimatedSavings: totalCost * 0.15,
        implementationEffort: 'medium',
        timeline: '2-3개월'
      }
    ];

    res.json({
      success: true,
      data: {
        totalCost,
        averageCost,
        monthlyTrend: monthlyTrendWithBudget,
        categoryDistribution,
        categoryBreakdown,
        departmentCosts: [],
        costDrivers: [],
        predictions: [],
        benchmarks: [],
        costComparison: {
          current: monthlyTrendWithBudget[monthlyTrendWithBudget.length - 1]?.cost || 0,
          previous: monthlyTrendWithBudget[monthlyTrendWithBudget.length - 2]?.cost || 0,
          change:
            monthlyTrendWithBudget.length >= 2 &&
            (monthlyTrendWithBudget[monthlyTrendWithBudget.length - 2].cost || 0) > 0
              ? ((monthlyTrendWithBudget[monthlyTrendWithBudget.length - 1].cost - monthlyTrendWithBudget[monthlyTrendWithBudget.length - 2].cost) /
                  monthlyTrendWithBudget[monthlyTrendWithBudget.length - 2].cost) * 100
              : 0
        },
        topCategories: categoryBreakdown
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
        costBreakdown: {
          fixed: totalCost * 0.4,
          variable: totalCost * 0.6
        },
        aiInsights,
        recommendations: [
          {
            type: 'cost_optimization',
            title: '고정비용 검토',
            description: '고정비용이 전체 비용의 40%를 차지합니다. 재검토가 필요합니다.',
            priority: 'high',
            estimatedSavings: totalCost * 0.1
          }
        ]
      }
    });
  } catch (error: any) {
    console.error('비용 분석 오류:', error);
    res.status(500).json({
      success: false,
      message: '비용 분석 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// AI 인사이트 생성
export const generateInsights = async (req: RequestWithUser, res: Response) => {
  try {
    const { type, data } = req.body;
    const { tenant_id, company_id } = req.user || {};

    if (!tenant_id || !company_id) {
      return res.status(400).json({
        success: false,
        message: '사용자 정보가 올바르지 않습니다.'
      });
    }

    // AI 인사이트 생성 로직 (샘플)
    const insights = [
      {
        id: Date.now().toString(),
        type: type || 'cost_optimization',
        title: 'AI 생성 인사이트',
        description: '데이터 분석 결과 비용 최적화 기회가 발견되었습니다.',
        confidence: 0.75,
        impact: 'medium',
        recommendations: [
          '데이터 기반 의사결정 강화',
          '자동화 도입 검토',
          '프로세스 개선'
        ],
        data: data || {},
        createdAt: new Date().toISOString(),
        status: 'new',
        priority: 2,
        category: '일반',
        tags: ['AI', '최적화']
      }
    ];

    res.json({
      success: true,
      data: {
        insights
      }
    });
  } catch (error: any) {
    console.error('AI 인사이트 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: 'AI 인사이트 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// AI 인사이트 상태 업데이트
export const updateInsightStatus = async (req: RequestWithUser, res: Response) => {
  try {
    const { insightId } = req.params as { insightId: string };
    const { status } = req.body as { status?: string };
    const allowedStatus = new Set(['new', 'reviewed', 'implemented', 'dismissed']);

    if (!insightId || !String(insightId).trim()) {
      return res.status(400).json({
        success: false,
        message: 'insightId가 필요합니다.'
      });
    }

    if (!status || !allowedStatus.has(String(status))) {
      return res.status(400).json({
        success: false,
        message: 'status는 new/reviewed/implemented/dismissed 중 하나여야 합니다.'
      });
    }

    // 현재는 인사이트를 DB에 저장하지 않으므로 요청 성공만 반환하고
    // 프론트 상태를 업데이트하도록 응답한다.
    return res.json({
      success: true,
      message: '인사이트 상태가 변경되었습니다.',
      data: {
        id: String(insightId),
        status: String(status)
      }
    });
  } catch (error: any) {
    console.error('AI 인사이트 상태 업데이트 오류:', error);
    return res.status(500).json({
      success: false,
      message: '인사이트 상태 업데이트 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

