import express from 'express';
import {
  sendNotification,
  getNotifications,
  updateNotification,
  deleteNotification,
  getActionInbox
} from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 알림 전송
router.post('/send', validateBody({
  title: { required: true, type: 'string', maxLength: 200 },
  message: { required: true, type: 'string', maxLength: 2000 },
  type: { required: true, type: 'string', oneOf: ['info', 'success', 'warning', 'error'] },
  target_type: { required: true, type: 'string', oneOf: ['user', 'tenant', 'all'] }
}), sendNotification);

// 승인·결제 대기 등 인박스 (앱 헤더 알림)
router.get('/inbox', getActionInbox);

// 알림 목록 조회
router.get('/', getNotifications);

// 알림 수정
router.put('/:id', updateNotification);

// 알림 삭제
router.delete('/:id', deleteNotification);

export default router;
