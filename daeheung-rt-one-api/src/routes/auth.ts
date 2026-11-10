import express from 'express';
import { login, getProfile, register, refreshToken, checkSession, logout } from '../controllers/authController';
import {
  webauthnRegisterOptions,
  webauthnRegisterVerify,
  webauthnLoginOptions,
  webauthnLoginVerify,
  webauthnListCredentials,
  webauthnDeleteCredential,
} from '../controllers/webauthnController';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = express.Router();

// 로그인
router.post('/login', validateBody({
  userid: { required: true, type: 'string', minLength: 2, maxLength: 50 },
  password: { required: true, type: 'string', minLength: 6, maxLength: 128 }
}), login);

// WebAuthn / 지문·페이스 ID (Passkey)
router.post('/webauthn/login/options', webauthnLoginOptions);
router.post('/webauthn/login/verify', webauthnLoginVerify);
router.post('/webauthn/register/options', authenticateToken, webauthnRegisterOptions);
router.post('/webauthn/register/verify', authenticateToken, webauthnRegisterVerify);
router.get('/webauthn/credentials', authenticateToken, webauthnListCredentials);
router.delete('/webauthn/credentials/:id', authenticateToken, webauthnDeleteCredential);

// 회사+관리자 가입 (3개월 무료)
router.post('/register', validateBody({
  companyName: { required: true, type: 'string', minLength: 2, maxLength: 200 },
  businessNumber: { required: true, type: 'string', minLength: 3, maxLength: 50 },
  gstNumber: { required: true, type: 'string', minLength: 15, maxLength: 15 },
  adminName: { required: true, type: 'string', minLength: 2, maxLength: 100 },
  adminUserid: { required: true, type: 'string', minLength: 2, maxLength: 50 },
  adminEmail: { required: true, type: 'string', minLength: 5, maxLength: 255 },
  adminPassword: { required: true, type: 'string', minLength: 6, maxLength: 128 },
  planType: { type: 'string', maxLength: 30 },
  startDate: { type: 'string', maxLength: 20 },
  phone: { type: 'string', maxLength: 50 },
  address: { type: 'string', maxLength: 500 }
}), register);

// 프로필 조회 (인증 필요)
router.get('/profile', authenticateToken, getProfile);
router.get('/session', authenticateToken, checkSession);
router.post('/refresh', authenticateToken, refreshToken);
router.post('/logout', authenticateToken, logout);

export default router;
