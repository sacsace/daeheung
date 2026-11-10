import { Router } from 'express';
import {
  getCostAnalysis,
  generateInsights,
  updateInsightStatus
} from '../controllers/aiController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// AI 분석 관련 라우트
router.get('/cost-analysis', getCostAnalysis);
router.post('/generate-insights', generateInsights);
router.put('/insights/:insightId/status', updateInsightStatus);

export default router;



