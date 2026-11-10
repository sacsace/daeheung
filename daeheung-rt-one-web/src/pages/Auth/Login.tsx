import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Fingerprint as FingerprintIcon
} from '@mui/icons-material';
import { useStore, useMenuStore } from '../../store';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { api, API_BASE_URL, setStoredLoginNoticeVersion } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { ensureI18nLanguage, detectOsLanguage } from '../../locales/i18n';
import { alpha, useTheme } from '@mui/material/styles';
import { IS_STANDALONE, PRODUCT_NAME } from '../../config/deployment';
import {
  canUsePlatformPasskey,
  getRememberedUserid,
  listPasskeyCredentials,
  loginWithPlatformPasskey,
  registerPlatformPasskey,
  rememberUserid,
} from '../../utils/webauthn';
import { redirectFromSearchParams } from '../../utils/safeInternalPath';

const Login: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { login, isAuthenticated } = useStore();
  const setMenuLanguage = useMenuStore((s) => s.setLanguage);
  const navigate = useNavigate();
  const location = useLocation();
  const postLoginPath = redirectFromSearchParams(location.search, '/dashboard');
  const [formData, setFormData] = useState({
    userid: getRememberedUserid(),
    password: '',
    remember: false
  });
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [registerPasskeyOpen, setRegisterPasskeyOpen] = useState(false);
  const [registerPasskeyBusy, setRegisterPasskeyBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorTimeout, setErrorTimeout] = useState<NodeJS.Timeout | null>(null);
  const brandVideoRef = useRef<HTMLVideoElement>(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');
  const [signupStep, setSignupStep] = useState<'form' | 'done'>('form');
  const [signupResult, setSignupResult] = useState<{
    usageStartDate: string;
    usageEndDate: string;
    plan: string;
  } | null>(null);
  const [signupData, setSignupData] = useState({
    companyName: '',
    businessNumber: '',
    gstNumber: '',
    adminName: '',
    adminUserid: '',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    planType: 'free_3months',
    startDate: new Date().toISOString().slice(0, 10),
    phone: '',
    address: ''
  });

  // 로그인 화면: OS 언어(한국어 외 → 영어)로 SEO/UI 동기화
  useEffect(() => {
    const lang = detectOsLanguage();
    setMenuLanguage(lang);
    void ensureI18nLanguage(lang);
  }, [setMenuLanguage]);

  useEffect(() => {
    let active = true;
    void canUsePlatformPasskey().then((ok) => {
      if (active) setPasskeyAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const video = brandVideoRef.current;
    if (!video) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (media.matches) {
        video.pause();
        return;
      }
      void video.play().catch(() => undefined);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (errorTimeout) {
        clearTimeout(errorTimeout);
      }
    };
  }, [errorTimeout]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // 에러 메시지를 즉시 지우지 않고 사용자가 로그인 버튼을 다시 클릭할 때까지 유지
  };

  const controlWidth = 320;

  const getPeriodEndDate = (startDate: string): string => {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return '-';
    const end = new Date(start);
    end.setMonth(end.getMonth() + 3);
    end.setDate(end.getDate() - 1);
    return end.toISOString().slice(0, 10);
  };

  const handleSignupChange = (field: string, value: string) => {
    setSignupData((prev) => ({ ...prev, [field]: value }));
  };

  const showError = (message: string) => {
    setError(message);
    // 기존 타이머가 있으면 클리어
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    // 10초 후에 에러 메시지 자동 제거
    const timeout = setTimeout(() => {
      setError('');
      setErrorTimeout(null);
    }, 10000);
    setErrorTimeout(timeout);
  };

  const localizeLoginApiError = (payload: any, fallbackKey = 'login.loginFailed') => {
    const code = String(payload?.code || '').trim();
    const codeKeyMap: Record<string, string> = {
      INVALID_CREDENTIALS: 'login.invalidCredentials',
      INVALID_INPUT: 'login.invalidInput',
      SUBSCRIPTION_INACTIVE: 'login.subscriptionInactive',
      SUBSCRIPTION_NOT_STARTED: 'login.subscriptionNotStarted',
      SUBSCRIPTION_EXPIRED: 'login.subscriptionExpired',
      JWT_SECRET_MISSING: 'login.serverError',
      SERVER_ERROR: 'login.serverError',
    };
    if (code && codeKeyMap[code]) return t(codeKeyMap[code]);

    const message = String(payload?.message || '').trim();
    const messageKeyMap: Record<string, string> = {
      '사용자 ID 또는 비밀번호가 올바르지 않습니다.': 'login.invalidCredentials',
      '입력값이 올바르지 않습니다.': 'login.invalidInput',
      '이용권 상태가 비활성화되어 로그인할 수 없습니다.': 'login.subscriptionInactive',
      '아직 이용 기간이 시작되지 않았습니다.': 'login.subscriptionNotStarted',
      '이용 기간이 만료되었습니다. 결제를 갱신해 주세요.': 'login.subscriptionExpired',
      '서버 JWT 설정이 누락되었습니다.': 'login.serverError',
      '서버 오류가 발생했습니다.': 'login.serverError',
      '로그인에 실패했습니다.': 'login.loginFailed',
    };
    if (message && messageKeyMap[message]) return t(messageKeyMap[message]);
    if (message && /[가-힣]/.test(message) && !i18n.language?.startsWith('ko')) {
      return t(fallbackKey);
    }
    return message || t(fallbackKey);
  };

  const localizeSignupApiError = (payload: any) => {
    const message = String(payload?.message || '').trim();
    const messageKeyMap: Record<string, string> = {
      'GST 번호 형식이 올바르지 않습니다. (15자리)': 'login.signup.invalidGst',
      '동일한 회사는 무료 이용(3개월)을 1회만 사용할 수 있습니다.': 'login.signup.freeTrialUsed',
      '이미 사용 중인 관리자 ID입니다.': 'login.signup.adminIdTaken',
      '이미 사용 중인 이메일입니다.': 'login.signup.emailTaken',
      '이미 등록된 사업자번호입니다.': 'login.signup.businessNumberTaken',
      '이미 등록된 GST 번호입니다.': 'login.signup.gstTaken',
      '가입 처리 중 오류가 발생했습니다.': 'login.signup.registerFailed',
      '가입에 실패했습니다.': 'login.signup.registerFailed',
    };
    if (message && messageKeyMap[message]) return t(messageKeyMap[message]);
    if (message && /[가-힣]/.test(message) && !i18n.language?.startsWith('ko')) {
      return t('login.signup.registerFailed');
    }
    return message || t('login.signup.registerFailed');
  };

  const goAfterLogin = () => {
    navigate(postLoginPath, { replace: true });
  };

  // 세션이 이미 있는 채 메일 링크로 /login?redirect=… 들어온 경우만 즉시 이동
  // (신규 로그인 직후 패스키 등록 모달과 충돌하지 않도록 mount 시점 인증 상태만 본다)
  const wasAuthenticatedOnMount = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticatedOnMount.current) {
      goAfterLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishLogin = (token: string, user: any, loginNoticeVersion?: number) => {
    rememberUserid(user?.userid || formData.userid);
    // 응답 인터셉터보다 먼저 기준값을 고정해 자기 로그인 팝업을 막음
    setStoredLoginNoticeVersion(
      loginNoticeVersion != null && Number.isFinite(Number(loginNoticeVersion))
        ? Number(loginNoticeVersion)
        : 0
    );
    login(token, user);
    goAfterLogin();
  };

  const offerPasskeyRegistration = async (token: string, user: any, loginNoticeVersion?: number) => {
    rememberUserid(user?.userid || formData.userid);
    setStoredLoginNoticeVersion(
      loginNoticeVersion != null && Number.isFinite(Number(loginNoticeVersion))
        ? Number(loginNoticeVersion)
        : 0
    );
    login(token, user);

    const can = await canUsePlatformPasskey();
    if (!can) {
      goAfterLogin();
      return;
    }
    try {
      const existing = await listPasskeyCredentials();
      if (existing.length > 0) {
        goAfterLogin();
        return;
      }
    } catch {
      /* 목록 실패 시에도 등록 제안 */
    }
    setRegisterPasskeyOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError('');
    
    // 기존 타이머가 있으면 클리어
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      setErrorTimeout(null);
    }

    try {
      const response = await api.post('/auth/login', formData);
      
      if (response.data.success) {
        const { token, user, loginNoticeVersion } = response.data.data;
        await offerPasskeyRegistration(token, user, loginNoticeVersion);
      } else {
        showError(localizeLoginApiError(response.data));
      }
    } catch (err: any) {
      let errorMessage = '';
      
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || err.message?.includes('network')) {
        errorMessage = t('login.networkError', { url: API_BASE_URL });
      } else if (err.response?.status === 404) {
        errorMessage = t('login.apiNotFound', {
          path: `${err.config?.baseURL || API_BASE_URL}${err.config?.url || '/auth/login'}`
        });
      } else if (err.response?.status === 0) {
        errorMessage = t('login.corsError');
      } else {
        errorMessage = localizeLoginApiError(err.response?.data, 'login.loginFailed');
      }
      
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setError('');
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      setErrorTimeout(null);
    }
    try {
      const data = await loginWithPlatformPasskey(formData.userid);
      finishLogin(data.token, data.user, data.loginNoticeVersion);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        showError(t('login.passkeyCancelled'));
      } else {
        showError(localizeLoginApiError(err?.response?.data, 'login.passkeyFailed'));
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleRegisterPasskeyConfirm = async () => {
    setRegisterPasskeyBusy(true);
    try {
      await registerPlatformPasskey(t('login.passkeyThisDevice'));
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        console.warn('passkey register after login:', err);
      }
    } finally {
      setRegisterPasskeyBusy(false);
      setRegisterPasskeyOpen(false);
      goAfterLogin();
    }
  };

  const handleRegisterPasskeySkip = () => {
    if (registerPasskeyBusy) return;
    setRegisterPasskeyOpen(false);
    goAfterLogin();
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    setSignupSuccess('');
    setSignupResult(null);

    if (signupData.adminPassword !== signupData.adminPasswordConfirm) {
      setSignupError(t('login.signup.passwordMismatch'));
      return;
    }

    setSignupLoading(true);
    try {
      await submitSignupRegistration();
    } catch (err: any) {
      setSignupError(localizeSignupApiError(err?.response?.data || { message: err?.message }));
    } finally {
      setSignupLoading(false);
    }
  };

  const submitSignupRegistration = async () => {
    const response = await api.post('/auth/register', {
      companyName: signupData.companyName,
      businessNumber: signupData.businessNumber,
      gstNumber: signupData.gstNumber,
      adminName: signupData.adminName,
      adminUserid: signupData.adminUserid,
      adminEmail: signupData.adminEmail,
      adminPassword: signupData.adminPassword,
      planType: signupData.planType,
      startDate: signupData.startDate,
      phone: signupData.phone,
      address: signupData.address
    }, {
      headers: {
        'x-skip-error-popup': 'true'
      }
    });

    if (response.data?.success) {
      const resultData = response.data?.data || {};
      const usageEnd = resultData.usageEndDate || getPeriodEndDate(signupData.startDate);
      setSignupResult({
        usageStartDate: resultData.usageStartDate || signupData.startDate,
        usageEndDate: usageEnd,
        plan: String(resultData.plan || signupData.planType)
      });
      setSignupSuccess(
        t('login.signup.signupSuccessAlert', {
          start: signupData.startDate,
          end: usageEnd
        })
      );
      setSignupStep('done');
      setFormData((prev) => ({
        ...prev,
        userid: signupData.adminUserid,
        password: signupData.adminPassword
      }));
    } else {
      setSignupError(localizeSignupApiError(response.data));
    }
  };

  const closeSignupDialog = () => {
    if (signupLoading) return;
    setSignupOpen(false);
    setSignupStep('form');
    setSignupError('');
    setSignupSuccess('');
    setSignupResult(null);
  };

  const loginInputSx = {
    '& .MuiOutlinedInput-root': {
      minHeight: 40,
      borderRadius: '4px',
      bgcolor: '#FFFFFF',
      '& fieldset': {
        borderColor: '#B4B4B4',
      },
      '&:hover fieldset': {
        borderColor: '#6B7280',
      },
      '&.Mui-focused fieldset': {
        borderColor: 'primary.main',
        borderWidth: '1px',
      },
    },
    '& .MuiInputBase-input': {
      py: 1,
      px: 1.25,
      fontSize: '0.875rem',
    },
  } as const;

  const loginFieldLabelSx = {
    display: 'block',
    mb: 0.5,
    color: 'text.secondary',
    fontSize: '0.75rem',
    fontWeight: 600,
  } as const;

  const signupFieldSx = {
    '& .MuiOutlinedInput-root': {
      minHeight: 44,
      borderRadius: '8px',
      bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.12 : 0.06),
      transition: theme.transitions.create(['background-color', 'box-shadow'], { duration: 150 }),
      '& fieldset': {
        borderColor: alpha(theme.palette.divider, 0.9),
      },
      '&:hover': {
        bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.16 : 0.09),
      },
      '&.Mui-focused': {
        bgcolor: 'background.paper',
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
        '& fieldset': {
          borderColor: alpha(theme.palette.divider, 0.95),
        },
      },
    },
    '& .MuiInputBase-input': {
      fontSize: '0.875rem',
      py: 1.05,
      letterSpacing: '-0.015em',
    },
    '& .MuiOutlinedInput-input::placeholder': {
      color: alpha(theme.palette.text.secondary, 0.72),
      opacity: 1,
    },
  } as const;

  const signupLabelSx = {
    display: 'block',
    mb: 0.65,
    color: 'text.secondary',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '-0.01em',
  } as const;

  const signupSectionTitleSx = {
    fontSize: '0.875rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'text.primary',
    lineHeight: 1.35,
  } as const;

  const handleLoginLanguage = (_event: React.MouseEvent<HTMLElement>, newLang: 'ko' | 'en' | null) => {
    if (newLang === null) return;
    void ensureI18nLanguage(newLang);
    setMenuLanguage(newLang);
  };

  return (
    <Box
      sx={{
        height: '100dvh',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        bgcolor: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          flex: { xs: '0 0 46vh', md: '1 1 auto' },
          minHeight: { xs: 280, md: 0 },
          overflow: 'hidden',
          bgcolor: '#0E1B33',
        }}
      >
        <video
          ref={brandVideoRef}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        >
          <source src="/brand/DHRNT_main_video.mp4" type="video/mp4" />
        </video>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(14, 27, 51, 0.38)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 2.5, md: 6 },
            py: { xs: 2, md: 4 },
            pointerEvents: 'none',
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: 640,
              textAlign: 'left',
              bgcolor: 'rgba(14, 27, 51, 0.45)',
              border: 0,
              boxShadow: 'none',
              px: { xs: 2, md: 3 },
              py: { xs: 2, md: 3 },
            }}
          >
            <Typography
              component="p"
              sx={{
                color: '#FFFFFF',
                fontWeight: 800,
                letterSpacing: '0.04em',
                fontSize: { xs: '1.25rem', md: '2.25rem' },
                lineHeight: 1.15,
                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
              }}
            >
              DAEHEUNG R&T
            </Typography>
            <Typography
              sx={{
                mt: { xs: 1, md: 2 },
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: { xs: '0.8125rem', md: '1.0625rem' },
                lineHeight: 1.45,
                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
              }}
            >
              Daeheung R&T, the company that puts nature and people first.
            </Typography>
            <Typography
              sx={{
                mt: { xs: 0.75, md: 1.25 },
                color: 'rgba(255,255,255,0.92)',
                fontWeight: 500,
                fontSize: { xs: '0.75rem', md: '0.9375rem' },
                lineHeight: 1.5,
                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
              }}
            >
              Daeheung R&T with green forest, clean air and water operates environmentally friendly based on people first culture.
            </Typography>
            <Box
              sx={{
                width: 48,
                height: '1px',
                bgcolor: 'rgba(255,255,255,0.7)',
                mr: 'auto',
                my: { xs: 1.25, md: 2 },
              }}
            />
            <Typography
              component="p"
              sx={{
                color: '#FFFFFF',
                fontWeight: 800,
                letterSpacing: '0.02em',
                fontSize: { xs: '1rem', md: '1.35rem' },
                lineHeight: 1.2,
                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
              }}
            >
              Daeheung R&T One
            </Typography>
            <Typography
              sx={{
                mt: 0.75,
                color: '#FFFFFF',
                fontWeight: 500,
                fontSize: { xs: '0.75rem', md: '0.9375rem' },
                lineHeight: 1.5,
                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
              }}
            >
              Daeheung R&T One is the name of this ERP. People, attendance, daily work, purchasing, sales, and accounting run in one system.
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          flex: { xs: '1 1 auto', md: '0 0 440px' },
          width: { md: 440 },
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
          bgcolor: '#FFFFFF',
          borderLeft: { md: '1px solid #E2E8F0' },
          position: 'relative',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            px: { xs: 2, sm: 3 },
            pt: { xs: 1.25, sm: 2 },
          }}
        >
          <ToggleButtonGroup
            exclusive
            value={i18n.language?.startsWith('en') ? 'en' : 'ko'}
            onChange={handleLoginLanguage}
            aria-label={t('login.languageToggleAria')}
            sx={{
              bgcolor: '#FFFFFF',
              p: 0.2,
              borderRadius: '4px',
              border: '1px solid #B4B4B4',
              boxShadow: 'none',
              '& .MuiToggleButtonGroup-grouped': {
                border: 0,
                mx: 0.1,
                borderRadius: '2px !important',
                px: { xs: 1.1, sm: 1.5 },
                py: { xs: 0.3, sm: 0.45 },
                fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                fontWeight: 600,
                textTransform: 'none',
                color: 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: '#E2E8F0',
                  color: '#0F172A',
                  '&:hover': { bgcolor: '#CBD5E1' },
                },
              },
            }}
          >
            <ToggleButton value="en" disableRipple>
              {t('login.langEn')}
            </ToggleButton>
            <ToggleButton value="ko" disableRipple>
              {t('login.langKo')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 2, sm: 4 },
            py: { xs: 2, sm: 5 },
            overflowY: { xs: 'auto', md: 'visible' },
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Box sx={{ width: '100%', maxWidth: controlWidth }}>
            <Box
              component="img"
              src="/brand/daeheung-logo.jpg"
              alt="DAEHEUNG R&T"
              sx={{
                display: 'block',
                width: '100%',
                maxWidth: 280,
                height: 'auto',
                mb: { xs: 1.5, sm: 2.5 },
                objectFit: 'contain',
              }}
            />
            <Typography
              component="h1"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1rem', sm: '1.125rem' },
                color: '#1B2A4A',
                letterSpacing: '-0.02em',
                lineHeight: 1.3,
                mb: 0.25,
              }}
            >
              {t('login.cardTitle')}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'text.secondary',
                mb: { xs: 1.5, sm: 2.25 },
              }}
            >
              ERP · {PRODUCT_NAME}
            </Typography>

            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: { xs: 1.25, sm: 2 },
                  borderRadius: '4px',
                  fontSize: '0.8125rem',
                  boxShadow: 'none',
                  py: { xs: 0.35, sm: 0.75 },
                  '& .MuiAlert-message': {
                    display: '-webkit-box',
                    WebkitLineClamp: { xs: 3, sm: 'unset' },
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  },
                }}
              >
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Box sx={{ mb: { xs: 1.1, sm: 1.5 } }}>
                <Typography component="label" htmlFor="userid" sx={loginFieldLabelSx}>
                  {t('login.emailLabel')}
                </Typography>
                <TextField
                  fullWidth
                  required
                  id="userid"
                  name="userid"
                  autoComplete="username"
                  autoFocus
                  value={formData.userid}
                  onChange={handleChange}
                  inputProps={{ 'aria-label': t('login.userID') }}
                  sx={loginInputSx}
                />
              </Box>

              <Box sx={{ mb: { xs: 1.5, sm: 2.25 } }}>
                <Typography component="label" htmlFor="password" sx={loginFieldLabelSx}>
                  {t('login.password')}
                </Typography>
                <TextField
                  fullWidth
                  required
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  inputProps={{ 'aria-label': t('login.password') }}
                  InputProps={{
                    endAdornment: (
                      <Box sx={{ pr: 0.25 }}>
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                          size="small"
                          sx={{ color: 'text.secondary' }}
                        >
                          {showPassword ? <VisibilityOff sx={{ fontSize: '1rem' }} /> : <Visibility sx={{ fontSize: '1rem' }} />}
                        </IconButton>
                      </Box>
                    ),
                  }}
                  sx={loginInputSx}
                />
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                disableElevation
                disabled={loading || passkeyLoading}
                sx={{
                  py: 1,
                  minHeight: { xs: 40, sm: 42 },
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  borderRadius: '2px',
                  textTransform: 'none',
                  boxShadow: 'none',
                  bgcolor: '#1B3A6F',
                  '&:hover': { boxShadow: 'none', bgcolor: '#152E58' },
                }}
              >
                {loading ? t('common.loading') : t('login.loginButton')}
              </Button>

              {passkeyAvailable && (
                <Button
                  type="button"
                  fullWidth
                  variant="outlined"
                  disableElevation
                  disabled={loading || passkeyLoading || !formData.userid.trim()}
                  onClick={() => void handlePasskeyLogin()}
                  startIcon={<FingerprintIcon sx={{ fontSize: '1.1rem' }} />}
                  sx={{
                    mt: { xs: 0.75, sm: 1 },
                    py: 1,
                    minHeight: { xs: 38, sm: 40 },
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    textTransform: 'none',
                    borderColor: '#B4B4B4',
                    color: 'text.primary',
                    bgcolor: '#FFFFFF',
                    boxShadow: 'none',
                    '&:hover': {
                      borderColor: '#6B7280',
                      bgcolor: '#F8FAFC',
                      boxShadow: 'none',
                    },
                  }}
                >
                  {passkeyLoading ? t('common.loading') : t('login.passkeyLogin')}
                </Button>
              )}

              {!IS_STANDALONE && (
              <Button
                fullWidth
                variant="text"
                onClick={() => {
                  setSignupOpen(true);
                  setSignupStep('form');
                  setSignupError('');
                  setSignupSuccess('');
                  setSignupResult(null);
                }}
                sx={{
                  mt: { xs: 0.35, sm: 0.75 },
                  py: { xs: 0.5, sm: 0.75 },
                  minHeight: { xs: 32, sm: 36 },
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                  textTransform: 'none',
                  borderRadius: '4px',
                  '&:hover': { bgcolor: 'transparent', color: 'primary.main', textDecoration: 'underline' },
                }}
              >
                {t('login.signUpCta')}
              </Button>
              )}
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            flex: '0 0 auto',
            px: { xs: 2, sm: 4 },
            pb: { xs: 1, sm: 2 },
            pt: { xs: 0.75, sm: 1 },
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: { xs: 0.25, sm: 0.5 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            {[
              { to: '/legal/terms', label: t('login.footerTerms') },
              { to: '/legal/privacy', label: t('login.footerPrivacy') },
              { to: '/legal/support', label: t('login.footerSupport') },
            ].map((link, index) => (
              <React.Fragment key={link.to}>
                {index > 0 && (
                  <Typography variant="caption" sx={{ color: alpha(theme.palette.text.secondary, 0.45), fontSize: '0.6875rem' }}>
                    ·
                  </Typography>
                )}
                <Typography
                  component={RouterLink}
                  to={link.to}
                  variant="caption"
                  sx={{
                    color: alpha(theme.palette.text.secondary, 0.82),
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                  }}
                >
                  {link.label}
                </Typography>
              </React.Fragment>
            ))}
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="caption" sx={{ color: alpha(theme.palette.text.secondary, 0.7), fontSize: '0.6875rem', whiteSpace: 'nowrap' }}>
              Developed by{' '}
              <Typography
                component="a"
                href="https://www.msventures.in"
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                sx={{
                  color: 'inherit',
                  fontSize: 'inherit',
                  fontWeight: 700,
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.main', textDecoration: 'none' },
                }}
              >
                Minsub Ventures
              </Typography>
            </Typography>
          </Box>
        </Box>
      </Box>

      <Dialog
        open={registerPasskeyOpen}
        onClose={handleRegisterPasskeySkip}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '4px',
            border: '1px solid #B4B4B4',
            boxShadow: 'none',
          },
        }}
      >
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, pb: 1 }}>
          {t('login.passkeyRegisterTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('login.passkeyRegisterHint')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button
            onClick={handleRegisterPasskeySkip}
            disabled={registerPasskeyBusy}
            sx={{ textTransform: 'none' }}
          >
            {t('login.passkeyRegisterSkip')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => void handleRegisterPasskeyConfirm()}
            disabled={registerPasskeyBusy}
            startIcon={<FingerprintIcon />}
            sx={{ textTransform: 'none', borderRadius: '4px', boxShadow: 'none' }}
          >
            {registerPasskeyBusy ? t('common.loading') : t('login.passkeyRegisterConfirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={signupOpen}
        onClose={closeSignupDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            width: 'min(96vw, 1176px)',
            maxHeight: '92vh',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid #B4B4B4',
            boxShadow: 'none',
          },
        }}
      >
        <DialogTitle
          sx={{
            pt: 2.5,
            px: 3,
            pb: 1.25,
            fontSize: '1.125rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'text.primary',
          }}
        >
          {signupStep === 'form' && t('login.signup.titleForm')}
          {signupStep === 'done' && t('login.signup.titleDone')}
        </DialogTitle>
        <Box component="form" onSubmit={handleSignupSubmit}>
          <DialogContent
            dividers
            sx={{
              display: signupStep === 'form' ? 'grid' : 'block',
              gridTemplateColumns: signupStep === 'form' ? { xs: '1fr', md: '1.45fr 1fr' } : undefined,
              gap: signupStep === 'form' ? { xs: 2, md: 2.5 } : 0,
              px: { xs: 2.5, sm: 3 },
              py: { xs: 2, sm: 2.5 },
              overflowY: 'auto',
              borderColor: alpha(theme.palette.divider, 0.85),
            }}
          >
            {signupError && (
              <Alert
                severity="error"
                variant="outlined"
                sx={{ gridColumn: '1 / -1', borderRadius: '8px', fontSize: '0.8125rem' }}
              >
                {signupError}
              </Alert>
            )}
            {signupSuccess && (
              <Alert
                severity="success"
                variant="outlined"
                sx={{ gridColumn: '1 / -1', borderRadius: '8px', fontSize: '0.8125rem' }}
              >
                {signupSuccess}
              </Alert>
            )}

            {signupStep === 'form' && (
              <>
                <Box sx={{ display: 'grid', gap: 1.75 }}>
                  <Typography variant="subtitle2" sx={signupSectionTitleSx}>
                    {t('login.signup.sectionInitial')}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                    <Box>
                      <Typography variant="caption" sx={signupLabelSx}>
                        {t('login.signup.labelCompanyName')}
                      </Typography>
                      <TextField
                        hiddenLabel
                        sx={signupFieldSx}
                        placeholder={t('login.signup.phCompanyName')}
                        size="small"
                        fullWidth
                        value={signupData.companyName}
                        onChange={(e) => handleSignupChange('companyName', e.target.value)}
                        required
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={signupLabelSx}>
                        {t('login.signup.labelBusinessNumber')}
                      </Typography>
                      <TextField
                        hiddenLabel
                        sx={signupFieldSx}
                        placeholder={t('login.signup.phBusinessNumber')}
                        size="small"
                        fullWidth
                        value={signupData.businessNumber}
                        onChange={(e) => handleSignupChange('businessNumber', e.target.value)}
                        required
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={signupLabelSx}>
                        {t('login.signup.labelGst')}
                      </Typography>
                      <TextField
                        hiddenLabel
                        sx={signupFieldSx}
                        placeholder={t('login.signup.phGst')}
                        size="small"
                        fullWidth
                        value={signupData.gstNumber}
                        onChange={(e) => handleSignupChange('gstNumber', e.target.value.toUpperCase())}
                        inputProps={{ maxLength: 15 }}
                        required
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={signupLabelSx}>
                        {t('login.signup.labelPhone')}
                      </Typography>
                      <TextField
                        hiddenLabel
                        sx={signupFieldSx}
                        placeholder={t('login.signup.phPhone')}
                        size="small"
                        fullWidth
                        value={signupData.phone}
                        onChange={(e) => handleSignupChange('phone', e.target.value)}
                      />
                    </Box>
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography variant="caption" sx={signupLabelSx}>
                        {t('login.signup.labelAddress')}
                      </Typography>
                      <TextField
                        hiddenLabel
                        sx={signupFieldSx}
                        placeholder={t('login.signup.phAddress')}
                        size="small"
                        fullWidth
                        value={signupData.address}
                        onChange={(e) => handleSignupChange('address', e.target.value)}
                      />
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ ...signupSectionTitleSx, mt: 0.5 }}>
                    {t('login.signup.sectionAdmin')}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                    <Box>
                      <Typography variant="caption" sx={signupLabelSx}>
                        {t('login.signup.labelAdminName')}
                      </Typography>
                      <TextField
                        hiddenLabel
                        sx={signupFieldSx}
                        placeholder={t('login.signup.phAdminName')}
                        size="small"
                        fullWidth
                        value={signupData.adminName}
                        onChange={(e) => handleSignupChange('adminName', e.target.value)}
                        required
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={signupLabelSx}>
                        {t('login.signup.labelAdminId')}
                      </Typography>
                      <TextField
                        hiddenLabel
                        sx={signupFieldSx}
                        placeholder={t('login.signup.phAdminId')}
                        size="small"
                        fullWidth
                        value={signupData.adminUserid}
                        onChange={(e) => handleSignupChange('adminUserid', e.target.value)}
                        required
                      />
                    </Box>
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography variant="caption" sx={signupLabelSx}>
                        {t('login.signup.labelAdminEmail')}
                      </Typography>
                      <TextField
                        hiddenLabel
                        sx={signupFieldSx}
                        placeholder={t('login.signup.phAdminEmail')}
                        size="small"
                        fullWidth
                        type="email"
                        value={signupData.adminEmail}
                        onChange={(e) => handleSignupChange('adminEmail', e.target.value)}
                        required
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={signupLabelSx}>
                        {t('login.signup.labelPassword')}
                      </Typography>
                      <TextField
                        hiddenLabel
                        sx={signupFieldSx}
                        placeholder={t('login.signup.phPassword')}
                        size="small"
                        fullWidth
                        type="password"
                        value={signupData.adminPassword}
                        onChange={(e) => handleSignupChange('adminPassword', e.target.value)}
                        required
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={signupLabelSx}>
                        {t('login.signup.labelPasswordConfirm')}
                      </Typography>
                      <TextField
                        hiddenLabel
                        sx={signupFieldSx}
                        placeholder={t('login.signup.phPasswordConfirm')}
                        size="small"
                        fullWidth
                        type="password"
                        value={signupData.adminPasswordConfirm}
                        onChange={(e) => handleSignupChange('adminPasswordConfirm', e.target.value)}
                        required
                      />
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gap: 1.25, alignContent: 'start' }}>
                  <Typography variant="subtitle2" sx={signupSectionTitleSx}>
                    {t('login.signup.sectionPlan')}
                  </Typography>
                  <Alert
                    severity="success"
                    variant="outlined"
                    sx={{
                      borderRadius: '8px',
                      py: 1.25,
                      '& .MuiAlert-message': { fontSize: '0.875rem', lineHeight: 1.55, letterSpacing: '-0.01em' },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {t('login.signup.planFreeTrial')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700 }}>
                      {t('login.signup.oncePerCompany')}
                    </Typography>
                  </Alert>
                  <Box>
                    <Typography variant="caption" sx={signupLabelSx}>
                      {t('login.signup.labelStartDate')}
                    </Typography>
                    <TextField
                      hiddenLabel
                      sx={signupFieldSx}
                      type="date"
                      size="small"
                      fullWidth
                      value={signupData.startDate}
                      onChange={(e) => handleSignupChange('startDate', e.target.value)}
                    />
                  </Box>
                  <Alert
                    severity="info"
                    variant="outlined"
                    sx={{
                      borderRadius: '8px',
                      py: 1,
                      bgcolor: alpha(theme.palette.info.main, theme.palette.mode === 'light' ? 0.06 : 0.12),
                      borderColor: alpha(theme.palette.info.main, 0.28),
                      '& .MuiAlert-message': { fontSize: '0.8125rem', lineHeight: 1.55, letterSpacing: '-0.01em' },
                    }}
                  >
                    {t('login.signup.infoUsageLine', {
                      start: signupData.startDate,
                      end: getPeriodEndDate(signupData.startDate)
                    })}
                    <br />
                    {t('login.signup.infoFreeTrialPolicy')}
                    <br />
                    {t('login.signup.infoMaxUsers')}
                    <br />
                    {t('login.signup.infoAdminGrant')}
                  </Alert>
                </Box>
              </>
            )}

            {signupStep === 'done' && (
              <Box sx={{ maxWidth: 768, mx: 'auto' }}>
                <Alert severity="success" variant="outlined" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.875rem' }}>
                  {t('login.signup.doneSuccess')}
                </Alert>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: '8px',
                    borderColor: alpha(theme.palette.divider, 0.9),
                    bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.04 : 0.02),
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.25, letterSpacing: '-0.02em' }}>
                    {t('login.signup.planFreeTrial')}
                  </Typography>
                  <Typography variant="body2">
                    {t('login.signup.lineCompany', { name: signupData.companyName || '-' })}
                  </Typography>
                  <Typography variant="body2">
                    {t('login.signup.lineUsage', {
                      start: signupResult?.usageStartDate || signupData.startDate,
                      end: signupResult?.usageEndDate || getPeriodEndDate(signupData.startDate)
                    })}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                    {t('login.signup.infoMaxUsers')}
                  </Typography>
                </Paper>
              </Box>
            )}
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2.25,
              gap: 1,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
              bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.06 : 0.03),
            }}
          >
            <Box sx={{ flex: 1 }} />
            <Button
              onClick={closeSignupDialog}
              disabled={signupLoading}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px', px: 2 }}
            >
              {t('common.cancel')}
            </Button>
            {signupStep === 'form' && (
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disableElevation
                disabled={signupLoading}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2.5 }}
              >
                {signupLoading ? t('login.signup.processing') : t('login.signup.registerButton')}
              </Button>
            )}
            {signupStep === 'done' && (
              <Button
                variant="contained"
                color="primary"
                disableElevation
                disabled={signupLoading}
                onClick={() => {
                  closeSignupDialog();
                }}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2.5 }}
              >
                {t('login.signup.finishSignup')}
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default Login;