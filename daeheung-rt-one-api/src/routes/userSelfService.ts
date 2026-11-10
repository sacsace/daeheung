import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { getUserUiPreferences, patchUserUiPreferences } from '../controllers/userUiPreferencesController';
import {
  getMyMailServer,
  patchMyMailServer,
  testMyMailServer,
} from '../controllers/userMailServerController';

const router = express.Router();

/** 로그인 사용자 본인 UI/메일 설정 */
router.get('/me/ui-preferences', authenticateToken, getUserUiPreferences);
router.patch('/me/ui-preferences', authenticateToken, patchUserUiPreferences);
router.get('/me/mail-server', authenticateToken, getMyMailServer);
router.patch('/me/mail-server', authenticateToken, patchMyMailServer);
router.post('/me/mail-server/test', authenticateToken, testMyMailServer);

export default router;
