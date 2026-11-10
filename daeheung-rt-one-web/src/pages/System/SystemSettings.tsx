import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  IconButton,
  InputAdornment,
  Link,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsOutlinedLabelProps,
  mvsKpiCardSx,
  mvsBodyCardSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyListZoneSx,
} from '../../theme/daeheungLayout';
import {
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  CloudUpload as CloudUploadIcon,
  Save as SaveIcon,
  Email as EmailIcon,
  DisplaySettings as DisplaySettingsIcon,
  Download as DownloadIcon,
  NotificationsOutlined as NotificationsOutlinedIcon,
  Visibility,
  VisibilityOff,
  Send as SendIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { systemSettingsService } from '../../services/api';
import { getUploadUrl } from '../../utils/uploadUrl';
import { useStore, useMenuStore } from '../../store';
import { ensureI18nLanguage } from '../../locales/i18n';
import { canAccessSystemLoginHistory } from '../../utils/canAccessSystemLoginHistory';
import SystemLoginHistoryTab from './SystemLoginHistoryTab';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import { useMenuActionGuard } from '../../hooks/useMenuActionGuard';

const SYSTEM_SETTINGS_MENU_ROUTES = ['/basic-info/system-settings', '/basic-info'] as const;

/** 시스템 설정 폼: 필드·섹션 간 여유 있는 줄간격 */
const CARD_CONTENT_COMPACT = { py: 2, px: 2.25, '&:last-child': { pb: 2 } } as const;
const SECTION_TITLE = { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.4 } as const;
const SECTION_HEADER = { display: 'flex', alignItems: 'center', mb: 1.5 } as const;
const SECTION_DIVIDER = { mb: 2.5 } as const;
const FIELD_BLOCK = {
  mb: 2.5,
  '& .MuiFormHelperText-root': { mt: 0.75, lineHeight: 1.5 },
} as const;
const OUTLINED_FIELD = mvsOutlinedLabelProps;
const SWITCH_LABEL = { mb: 0.75, '& .MuiFormControlLabel-label': { fontSize: '0.8125rem', lineHeight: 1.45 } } as const;
const SWITCH_ROW = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: { xs: 1, sm: 1.25 },
  columnGap: 1.5,
  rowGap: 1.25,
} as const;

/** 화면 설정 토글 — 제목·설명(좌) + 스위치(우) 세로 나열 */
const APPEARANCE_TOGGLE_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 2,
  py: 1.75,
  borderBottom: (theme: { palette: { mode: string; divider: string } }) =>
    `1px solid ${theme.palette.mode === 'light' ? '#E8EDF3' : theme.palette.divider}`,
  '&:last-child': { borderBottom: 'none', pb: 0 },
} as const;

/** 설정 섹션 카드 — MVS Body 외곽 톤 */
const SETTINGS_CARD_SX = {
  ...mvsBodyCardSx,
  overflow: 'hidden',
} as const;

/** 우측 열(화면·알림·보안) — 카드별 내용 높이에 맞춤(잘림 방지) */
const SETTINGS_RIGHT_STACK_SX = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2.5,
  minWidth: 0,
} as const;

const SETTINGS_RIGHT_CARD_SX = {
  ...SETTINGS_CARD_SX,
  display: 'flex',
  flexDirection: 'column',
  flex: '0 0 auto',
  overflow: 'hidden',
} as const;

const SETTINGS_RIGHT_CARD_CONTENT_SX = {
  ...CARD_CONTENT_COMPACT,
  display: 'flex',
  flexDirection: 'column',
} as const;

/** 백업 설정 UI 전체 비활성 — 서버 로직은 유지 */
const BACKUP_UI_DISABLED = true;

/** 저장만 되고 실제 동작과 연결되지 않은 설정 항목 */
const DISABLED_SETTING_KEYS: Readonly<Record<string, readonly string[]>> = {
  appearance: ['showNotifications'],
  notifications: [
    'emailNotifications',
    'pushNotifications',
    'smsNotifications',
    'taskReminders',
    'systemAlerts',
  ],
  security: ['twoFactorAuth', 'ipWhitelist'],
};

const isSettingUiDisabled = (category: string, key: string): boolean =>
  DISABLED_SETTING_KEYS[category]?.includes(key) ?? false;

/** 서버에만 비밀번호가 있을 때 입력란에 보이는 마스크(실제 값과 무관) */
const MAIL_AUTH_PASS_MASK = '********';

type BackupFileItem = {
  filename: string;
  size: number;
  createdAt: string;
};

const formatBackupSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const SystemSettings: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useStore();
  const menuFlags = usePageMenuPermission(SYSTEM_SETTINGS_MENU_ROUTES);
  const editGuard = useMenuActionGuard('edit', SYSTEM_SETTINGS_MENU_ROUTES);
  const { language, setLanguage } = useMenuStore();
  const [settingsTab, setSettingsTab] = useState(0);
  const [canAccessLoginHistory, setCanAccessLoginHistory] = useState(false);
  const canManageAll = menuFlags.canEdit;
  const isRoot = user?.role === 'root';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const allowed = await canAccessSystemLoginHistory(user);
      if (!cancelled) setCanAccessLoginHistory(allowed);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!canAccessLoginHistory && settingsTab !== 0) {
      setSettingsTab(0);
    }
  }, [canAccessLoginHistory, settingsTab]);
  const [settings, setSettings] = useState({
    general: {
      companyName: 'MVS',
      companyAbbreviation: 'MVS',
      companyLogo: '',
      timezone: 'Asia/Kolkata',
      language: 'ko',
      dateFormat: 'YYYY-MM-DD',
      currency: 'INR',
      officeLocation: {
        latitude: '',
        longitude: '',
        radiusMeters: 200
      }
    },
    appearance: {
      theme: 'light',
      primaryColor: '#1D4E7C',
      fontSize: 'medium',
      showNotifications: true
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      taskReminders: true,
      systemAlerts: true
    },
    security: {
      passwordMinLength: 8,
      requireSpecialChars: false,
      sessionTimeout: 600,
      twoFactorAuth: false,
      ipWhitelist: false
    },
    backup: {
      autoBackup: true,
      backupFrequency: 'daily',
      retentionDays: 30,
      cloudBackup: false,
      lastBackup: null as string | null
    },
    mailServer: {
      host: '',
      port: 587,
      secure: false,
      authUser: '',
      authPass: '',
      authPassConfigured: false,
      fromEmail: '',
      fromName: ''
    }
  });

  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [locatingOffice, setLocatingOffice] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [previewLogo, setPreviewLogo] = useState<string>('');
  /** 메일 비밀번호: 저장만 되어 있을 때 필드에 마스크 표시, 포커스 시 편집용으로 비움 */
  const [mailAuthPassFocused, setMailAuthPassFocused] = useState(false);
  const [mailPassVisible, setMailPassVisible] = useState(false);
  const [savingMail, setSavingMail] = useState(false);
  const [mailTestOpen, setMailTestOpen] = useState(false);
  const [mailTestTo, setMailTestTo] = useState('');
  const [mailTestSubject, setMailTestSubject] = useState('');
  const [mailTesting, setMailTesting] = useState(false);
  const [backupFiles, setBackupFiles] = useState<BackupFileItem[]>([]);
  const [backupStoragePath, setBackupStoragePath] = useState('');
  const [downloadingBackupName, setDownloadingBackupName] = useState<string | null>(null);

  const loadBackupFiles = useCallback(async () => {
    if (!isRoot) return;
    try {
      const response = await systemSettingsService.listBackups();
      if (response.success && response.data) {
        setBackupFiles(response.data.files || []);
        setBackupStoragePath(response.data.storagePath || '');
      }
    } catch {
      /* ignore */
    }
  }, [isRoot]);
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await systemSettingsService.getSettings();
      if (response.success && response.data) {
        const d = response.data as typeof settings;
        const ms = (d as any).mailServer || {};
        const loginEmail = (user?.email && String(user.email).trim()) || '';
        const loginName = (user?.username && String(user.username).trim()) || '';
        const normalizedSettings = {
          ...d,
          general: {
            ...d.general,
            companyAbbreviation: String((d as any).general?.companyAbbreviation ?? 'MVS'),
            // 인도 서비스 기본 통화 고정
            currency: 'INR'
          },
          mailServer: {
            host: String(ms.host || ''),
            port: typeof ms.port === 'number' ? ms.port : parseInt(String(ms.port || 587), 10) || 587,
            secure: Boolean(ms.secure),
            authUser: String(ms.authUser || '').trim() || loginEmail,
            authPass: String(ms.authPass || ''),
            authPassConfigured: Boolean(ms.authPassConfigured || ms.authPass),
            fromEmail: String(ms.fromEmail || '').trim() || loginEmail,
            fromName: String(ms.fromName || '').trim() || loginName
          }
        };
        setSettings(normalizedSettings);
        setMailAuthPassFocused(false);
        setMailPassVisible(false);
        if (response.data.general?.companyLogo) {
          setPreviewLogo(response.data.general.companyLogo);
        }
      }
    } catch (error: any) {
      // Network Error인 경우 서버 연결 문제 안내
      let errorMessage = '설정을 불러오는 중 오류가 발생했습니다.';
      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        errorMessage = '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
      } else if (error.response?.status === 401) {
        errorMessage = '인증이 필요합니다. 다시 로그인해주세요.';
      } else if (error.response?.status === 403) {
        errorMessage = '접근 권한이 없습니다. root 권한이 필요합니다.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.username]);

  useEffect(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead) return;
    loadSettings();
  }, [loadSettings, menuFlags.menusLoading, menuFlags.canRead]);

  useEffect(() => {
    if (isRoot) {
      void loadBackupFiles();
    }
  }, [isRoot, loadBackupFiles]);

  const settingControlDisabled = (category: string, key: string) =>
    !canManageAll || isSettingUiDisabled(category, key);

  const settingLabel = (text: string, category: string, key: string) =>
    isSettingUiDisabled(category, key) ? `${text} (${t('systemSettings.comingSoon')})` : text;

  const handleSettingChange = (category: string, key: string, value: any) => {
    if (isSettingUiDisabled(category, key)) return;
    let nextValue = value;
    if (category === 'security' && key === 'sessionTimeout') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        nextValue = Math.min(24 * 60, Math.max(5, Math.floor(parsed)));
      } else {
        nextValue = 30;
      }
    }
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [key]: nextValue
      }
    }));
  };

  const handleMailServerChange = (key: string, value: string | number | boolean) => {
    setSettings((prev) => {
      const mailServer = {
        ...prev.mailServer,
        [key]: value
      } as typeof prev.mailServer;
      // 포트별 TLS 방식 고정(587=STARTTLS, 465=SSL) — Gmail 등 오설정 방지
      if (key === 'port') {
        const p = typeof value === 'number' ? value : parseInt(String(value), 10) || 587;
        if (p === 465) mailServer.secure = true;
        else if (p === 587 || p === 2525 || p === 25) mailServer.secure = false;
      }
      return { ...prev, mailServer };
    });
  };

  const applyGmailMailPreset = () => {
    setSettings((prev) => ({
      ...prev,
      mailServer: {
        ...prev.mailServer,
        host: 'smtp.gmail.com',
        port: 587,
        secure: false
      }
    }));
  };

  const handleOfficeLocationChange = (key: 'latitude' | 'longitude' | 'radiusMeters', value: string) => {
    setSettings(prev => ({
      ...prev,
      general: {
        ...prev.general,
        officeLocation: {
          ...prev.general.officeLocation,
          [key]: value
        }
      }
    }));
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSnackbar({
        open: true,
        message: '이 브라우저에서는 위치 정보를 사용할 수 없습니다.',
        severity: 'error'
      });
      return;
    }

    setLocatingOffice(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setSettings(prev => ({
          ...prev,
          general: {
            ...prev.general,
            officeLocation: {
              ...prev.general.officeLocation,
              latitude: latitude.toString(),
              longitude: longitude.toString()
            }
          }
        }));
        setLocatingOffice(false);
      },
      () => {
        setSnackbar({
          open: true,
          message: '현재 위치를 가져올 수 없습니다. 위치 권한을 확인해주세요.',
          severity: 'error'
        });
        setLocatingOffice(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    if (!editGuard.guard()) return;
    try {
      setSaving(true);
      let payload: typeof settings | { appearance: typeof settings.appearance } = canManageAll
        ? settings
        : { appearance: settings.appearance };
      if (canManageAll && !isRoot) {
        const { backup: _omitBackup, ...withoutBackup } = settings;
        payload = withoutBackup;
      }
      const response = await systemSettingsService.saveSettings(payload);
      if (response.success) {
        setSnackbar({
          open: true,
          message: '설정이 저장되었습니다.',
          severity: 'success'
        });
        
        // 언어 설정 변경: store + i18n 동기화 (전체 페이지 reload 금지)
        if (canManageAll && settings.general.language !== language) {
          const nextLang = settings.general.language as 'ko' | 'en';
          setLanguage(nextLang);
          void ensureI18nLanguage(nextLang);
        }
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || '설정 저장 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMailServer = async () => {
    if (!canManageAll || !editGuard.guard()) return;
    try {
      setSavingMail(true);
      let payload: typeof settings = settings;
      if (!isRoot) {
        const { backup: _omitBackup, ...withoutBackup } = settings;
        payload = withoutBackup as typeof settings;
      }
      const response = await systemSettingsService.saveSettings(payload);
      if (response.success) {
        setSettings((prev) => ({
          ...prev,
          mailServer: {
            ...prev.mailServer,
            authPassConfigured: Boolean(
              prev.mailServer.authPass?.trim() || prev.mailServer.authPassConfigured
            ),
          },
        }));
        setSnackbar({
          open: true,
          message: t('systemSettings.mailServer.savedSmtp'),
          severity: 'success',
        });
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message:
          error?.response?.data?.message ||
          error?.message ||
          t('systemSettings.mailServer.testFailed'),
        severity: 'error',
      });
    } finally {
      setSavingMail(false);
    }
  };

  const openMailTestDialog = () => {
    setMailTestTo((user?.email && String(user.email).trim()) || settings.mailServer.fromEmail || '');
    setMailTestSubject('');
    setMailTestOpen(true);
  };

  const handleSendMailTest = async () => {
    const to = mailTestTo.trim();
    if (!to) {
      setSnackbar({
        open: true,
        message: t('systemSettings.mailServer.testToRequired'),
        severity: 'error',
      });
      return;
    }
    try {
      setMailTesting(true);
      const res = await systemSettingsService.sendTestMail({
        to,
        ...(mailTestSubject.trim() ? { subject: mailTestSubject.trim() } : {}),
      });
      if (res?.success) {
        setMailTestOpen(false);
        setSnackbar({
          open: true,
          message: res.message || t('systemSettings.mailServer.testSent'),
          severity: 'success',
        });
      } else {
        setSnackbar({
          open: true,
          message: (res as any)?.message || t('systemSettings.mailServer.testFailed'),
          severity: 'error',
        });
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message:
          error?.response?.data?.message ||
          error?.message ||
          t('systemSettings.mailServer.testFailed'),
        severity: 'error',
      });
    } finally {
      setMailTesting(false);
    }
  };

  const handleLogoUpload = () => {
    setDialogType('logo');
    setOpenDialog(true);
    setPreviewLogo('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setSnackbar({
          open: true,
          message: '이미지 파일만 업로드할 수 있습니다.',
          severity: 'error'
        });
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB 제한
        setSnackbar({
          open: true,
          message: '파일 크기는 5MB 이하여야 합니다.',
          severity: 'error'
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoConfirm = async () => {
    if (!previewLogo) {
      setSnackbar({
        open: true,
        message: '로고 파일을 선택해주세요.',
        severity: 'error'
      });
      return;
    }

    try {
      setUploading(true);
      const response = await systemSettingsService.uploadLogo(previewLogo);
      if (response.success) {
        setSettings(prev => ({
          ...prev,
          general: {
            ...prev.general,
            companyLogo: response.data.logo
          }
        }));
        setSnackbar({
          open: true,
          message: '로고가 업로드되었습니다.',
          severity: 'success'
        });
        setOpenDialog(false);
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || '로고 업로드 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleBackupNow = () => {
    if (!isRoot) return;
    setDialogType('backup');
    setOpenDialog(true);
  };

  const handleBackupConfirm = async () => {
    if (!isRoot) return;
    try {
      setBackingUp(true);
      const response = await systemSettingsService.runBackup();
      if (response.success) {
        const lastBackup = response.data?.lastBackup || response.data?.createdAt || new Date().toISOString();
        setSettings((prev) => ({
          ...prev,
          backup: {
            ...prev.backup,
            lastBackup,
          },
        }));
        setBackupFiles(response.data?.files || []);
        if (response.data?.storagePath) {
          setBackupStoragePath(response.data.storagePath);
        }
        setSnackbar({
          open: true,
          message: response.message || t('systemSettings.backup.backupDone'),
          severity: 'success',
        });
        setOpenDialog(false);
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || '백업 실행 중 오류가 발생했습니다.',
        severity: 'error',
      });
    } finally {
      setBackingUp(false);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    try {
      setDownloadingBackupName(filename);
      const response = await systemSettingsService.downloadBackup(filename);
      const blob = new Blob([response.data], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('systemSettings.backup.downloadFailed'),
        severity: 'error',
      });
    } finally {
      setDownloadingBackupName(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ ...mvsPageRootSx, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <CircularProgress size={36} />
      </Box>
    );
  }

  const smtpConfigured = Boolean(
    settings.mailServer.host?.trim() &&
      (settings.mailServer.authPassConfigured || settings.mailServer.authPass?.trim())
  );

  const kpiItems =
    settingsTab === 0
      ? [
          {
            key: 'language',
            label: t('systemSettings.stats.language'),
            value: settings.general.language === 'en' ? 'English' : '한국어',
          },
          {
            key: 'smtp',
            label: t('systemSettings.stats.smtp'),
            value: smtpConfigured ? t('systemSettings.stats.configured') : t('systemSettings.stats.notConfigured'),
          },
          ...(isRoot
            ? [
                {
                  key: 'backup',
                  label: t('systemSettings.stats.backupFiles'),
                  value: String(backupFiles.length),
                },
              ]
            : []),
        ]
      : [];

  const showMailPassMask =
    settings.mailServer.authPassConfigured &&
    settings.mailServer.authPass === '' &&
    !mailAuthPassFocused;

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('systemSettings.pageTitle')}
        description={t('systemSettings.pageDescription')}
      />

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      {settingsTab === 0 && kpiItems.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: `repeat(${Math.min(kpiItems.length, 4)}, 1fr)`,
            },
            gap: 2.5,
            mb: 3,
          }}
        >
          {kpiItems.map((item) => (
            <Card key={item.key} elevation={0} sx={mvsKpiCardSx}>
              <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                  {item.label}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary', fontSize: '1.125rem' }}
                  noWrap
                  title={item.value}
                >
                  {item.value}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : null}

      <Card elevation={0} sx={mvsBodyCardSx}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: { xs: 2, sm: 2.5 },
            py: 1,
            bgcolor: '#FFFFFF',
          }}
        >
          <Tabs
            value={settingsTab}
            onChange={(_, v) => {
              if (v === 1 && !canAccessLoginHistory) return;
              setSettingsTab(v);
            }}
            sx={{
              minHeight: 40,
              '& .MuiTab-root': {
                minHeight: 40,
                textTransform: 'none',
                fontSize: '0.8125rem',
                py: 0.75,
              },
            }}
          >
            <Tab label={t('systemSettings.tabs.basic')} />
            {canAccessLoginHistory ? (
              <Tab label={t('systemSettings.tabs.systemLoginHistory')} />
            ) : null}
          </Tabs>
          {settingsTab === 0 ? (
            <Button
              variant="contained"
              disableElevation
              size="small"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />}
              onClick={handleSave}
              disabled={saving || editGuard.disabled}
              sx={mvsBodyPrimaryBtnSx}
            >
              {saving ? t('systemSettings.actions.saving') : t('systemSettings.actions.save')}
            </Button>
          ) : null}
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
      {settingsTab === 1 && canAccessLoginHistory ? <SystemLoginHistoryTab /> : null}

      {settingsTab === 0 && (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2.5,
          alignItems: { xs: 'stretch', md: 'flex-start' }
        }}
      >
        {/* 일반 설정 — 좌측 */}
        <Card elevation={0} sx={{ ...SETTINGS_CARD_SX, display: 'flex', flexDirection: 'column' }}>
          <CardContent sx={{ ...CARD_CONTENT_COMPACT, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={SECTION_HEADER}>
              <SettingsIcon sx={{ mr: 0.75, color: 'primary.main', fontSize: 20 }} />
              <Typography component="h2" sx={SECTION_TITLE}>일반 설정</Typography>
            </Box>
            <Divider sx={SECTION_DIVIDER} />
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
              <Avatar 
                sx={{ mr: 1.5, width: 48, height: 48 }}
                src={getUploadUrl(previewLogo || settings.general.companyLogo)}
              >
                {settings.general.companyName.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.35 }}>
                  회사 로고
                </Typography>
                <Button size="small" onClick={handleLogoUpload} disabled={!canManageAll} sx={{ mt: 0.25 }}>
                  로고 변경
                </Button>
              </Box>
            </Box>

            <Box sx={FIELD_BLOCK}>
              <TextField
                fullWidth
                size="small"
                label="회사명"
                {...OUTLINED_FIELD}
                value={settings.general.companyName}
                onChange={(e) => handleSettingChange('general', 'companyName', e.target.value)}
                variant="outlined"
                disabled={!canManageAll}
              />
            </Box>

            <Box sx={FIELD_BLOCK}>
              <TextField
                fullWidth
                size="small"
                label={t('systemSettings.general.companyAbbreviation')}
                {...OUTLINED_FIELD}
                value={settings.general.companyAbbreviation}
                onChange={(e) => handleSettingChange('general', 'companyAbbreviation', e.target.value.toUpperCase())}
                variant="outlined"
                disabled={!canManageAll}
                placeholder="MSV"
                helperText={t('systemSettings.general.companyAbbreviationHint')}
              />
            </Box>

            <Box sx={FIELD_BLOCK}>
              <Typography sx={{ fontSize: '0.75rem', mb: 1.25, fontWeight: 500, color: 'text.primary', lineHeight: 1.45 }}>
                사무실 위치 (출근 제한 기준)
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 1.5 }}>
                <TextField
                  size="small"
                  type="number"
                  label="위도"
                  {...OUTLINED_FIELD}
                  inputProps={{ step: '0.000001' }}
                  value={settings.general.officeLocation.latitude}
                  onChange={(e) => handleOfficeLocationChange('latitude', e.target.value)}
                  fullWidth
                  disabled={!canManageAll}
                />
                <TextField
                  size="small"
                  type="number"
                  label="경도"
                  {...OUTLINED_FIELD}
                  inputProps={{ step: '0.000001' }}
                  value={settings.general.officeLocation.longitude}
                  onChange={(e) => handleOfficeLocationChange('longitude', e.target.value)}
                  fullWidth
                  disabled={!canManageAll}
                />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <TextField
                  size="small"
                  type="number"
                  label="허용 반경 (미터)"
                  {...OUTLINED_FIELD}
                  inputProps={{ min: 10, step: '10' }}
                  value={settings.general.officeLocation.radiusMeters}
                  onChange={(e) => handleOfficeLocationChange('radiusMeters', e.target.value)}
                  fullWidth
                  disabled={!canManageAll}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleUseCurrentLocation}
                    disabled={locatingOffice || !canManageAll}
                    fullWidth
                    sx={{ ...mvsBodyOutlinedBtnSx, py: 1 }}
                  >
                    {locatingOffice ? '위치 확인 중...' : '현재 위치 가져오기'}
                  </Button>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontSize: '0.7rem', lineHeight: 1.5 }}>
                등록된 위치에서만 출근할 수 있습니다.
              </Typography>
            </Box>

            <Box sx={FIELD_BLOCK}>
              <TextField
                label="시간대"
                {...OUTLINED_FIELD}
                value="인도 표준시 (IST)"
                fullWidth
                size="small"
                disabled
                sx={{
                  '& .MuiInputBase-root': {
                    backgroundColor: 'action.disabledBackground'
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontSize: '0.7rem', lineHeight: 1.5 }}>
                시간대는 항상 인도 표준시(IST)로 고정됩니다.
              </Typography>
            </Box>

            <Box sx={FIELD_BLOCK}>
              <TextField
                fullWidth
                size="small"
                select
                label="언어"
                {...OUTLINED_FIELD}
                value={settings.general.language}
                onChange={(e) => handleSettingChange('general', 'language', e.target.value)}
                disabled={!canManageAll}
              >
                <MenuItem value="ko">한국어</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </TextField>
            </Box>

            <Box sx={FIELD_BLOCK}>
              <TextField
                fullWidth
                size="small"
                select
                label="통화"
                {...OUTLINED_FIELD}
                value="INR"
                variant="outlined"
                disabled
                sx={{
                  '& .MuiInputBase-root': {
                    backgroundColor: 'action.disabledBackground',
                  },
                }}
              >
                <MenuItem value="INR">INR (Rs.)</MenuItem>
              </TextField>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontSize: '0.7rem', lineHeight: 1.5 }}>
                {t('systemSettings.general.currencyFixedNote')}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* 우측: 화면 설정 → 알림 설정 → 보안 설정 (md: 좌측과 동일 행 높이) */}
        <Box sx={SETTINGS_RIGHT_STACK_SX}>
        {/* 외관 설정 */}
        <Card elevation={0} sx={SETTINGS_RIGHT_CARD_SX}>
          <CardContent sx={SETTINGS_RIGHT_CARD_CONTENT_SX}>
            <Box sx={SECTION_HEADER}>
              <DisplaySettingsIcon sx={{ mr: 0.75, color: 'primary.main', fontSize: 20 }} />
              <Typography component="h2" sx={SECTION_TITLE}>화면 설정</Typography>
            </Box>
            <Divider sx={SECTION_DIVIDER} />

            <Box sx={APPEARANCE_TOGGLE_ROW_SX}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, minWidth: 0, flex: 1 }}>
                <NotificationsOutlinedIcon sx={{ fontSize: 20, color: 'secondary.main', mt: 0.15, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.4 }}>
                    {settingLabel('알림 표시', 'appearance', 'showNotifications')}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.35, fontSize: '0.7rem', lineHeight: 1.45 }}
                  >
                    {isSettingUiDisabled('appearance', 'showNotifications')
                      ? t('systemSettings.appearance.showNotificationsComingSoon')
                      : '헤더 영역에 알림 벨 아이콘을 표시합니다.'}
                  </Typography>
                </Box>
              </Box>
              <Switch
                size="small"
                checked={settings.appearance.showNotifications}
                onChange={(e) => handleSettingChange('appearance', 'showNotifications', e.target.checked)}
                disabled={settingControlDisabled('appearance', 'showNotifications')}
                sx={{ flexShrink: 0 }}
              />
            </Box>
          </CardContent>
        </Card>

        {/* 알림 설정 */}
        <Card elevation={0} sx={SETTINGS_RIGHT_CARD_SX}>
          <CardContent sx={SETTINGS_RIGHT_CARD_CONTENT_SX}>
            <Box sx={SECTION_HEADER}>
              <NotificationsIcon sx={{ mr: 0.75, color: 'primary.main', fontSize: 20 }} />
              <Typography component="h2" sx={SECTION_TITLE}>알림 설정</Typography>
            </Box>
            <Divider sx={SECTION_DIVIDER} />

            <Alert
              severity="info"
              sx={{
                mb: 2,
                py: 1,
                fontSize: '0.8125rem',
                '& .MuiAlert-message': { width: '100%' },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75, fontSize: '0.8125rem' }}>
                {t('systemSettings.notifications.comingSoonTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', lineHeight: 1.55 }}>
                {t('systemSettings.notifications.comingSoonBody')}
              </Typography>
            </Alert>

            <Box sx={SWITCH_ROW}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={settings.notifications.emailNotifications}
                    onChange={(e) => handleSettingChange('notifications', 'emailNotifications', e.target.checked)}
                    disabled={settingControlDisabled('notifications', 'emailNotifications')}
                  />
                }
                label={settingLabel('이메일 알림', 'notifications', 'emailNotifications')}
                sx={{ ...SWITCH_LABEL, mb: 0 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={settings.notifications.pushNotifications}
                    onChange={(e) => handleSettingChange('notifications', 'pushNotifications', e.target.checked)}
                    disabled={settingControlDisabled('notifications', 'pushNotifications')}
                  />
                }
                label={settingLabel('푸시 알림', 'notifications', 'pushNotifications')}
                sx={{ ...SWITCH_LABEL, mb: 0 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={settings.notifications.smsNotifications}
                    onChange={(e) => handleSettingChange('notifications', 'smsNotifications', e.target.checked)}
                    disabled={settingControlDisabled('notifications', 'smsNotifications')}
                  />
                }
                label={settingLabel('SMS 알림', 'notifications', 'smsNotifications')}
                sx={{ ...SWITCH_LABEL, mb: 0 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={settings.notifications.taskReminders}
                    onChange={(e) => handleSettingChange('notifications', 'taskReminders', e.target.checked)}
                    disabled={settingControlDisabled('notifications', 'taskReminders')}
                  />
                }
                label={settingLabel('업무 알림', 'notifications', 'taskReminders')}
                sx={{ ...SWITCH_LABEL, mb: 0 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={settings.notifications.systemAlerts}
                    onChange={(e) => handleSettingChange('notifications', 'systemAlerts', e.target.checked)}
                    disabled={settingControlDisabled('notifications', 'systemAlerts')}
                  />
                }
                label={settingLabel('시스템 알림', 'notifications', 'systemAlerts')}
                sx={{ ...SWITCH_LABEL, mb: 0 }}
              />
            </Box>
          </CardContent>
        </Card>

        {/* 보안 설정 */}
        <Card elevation={0} sx={SETTINGS_RIGHT_CARD_SX}>
          <CardContent sx={SETTINGS_RIGHT_CARD_CONTENT_SX}>
            <Box sx={SECTION_HEADER}>
              <SecurityIcon sx={{ mr: 0.75, color: 'primary.main', fontSize: 20 }} />
              <Typography component="h2" sx={SECTION_TITLE}>보안 설정</Typography>
            </Box>
            <Divider sx={SECTION_DIVIDER} />

            <Box sx={FIELD_BLOCK}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="최소 비밀번호 길이"
                {...OUTLINED_FIELD}
                value={settings.security.passwordMinLength}
                onChange={(e) => handleSettingChange('security', 'passwordMinLength', parseInt(e.target.value))}
                variant="outlined"
                disabled={!canManageAll}
              />
            </Box>

            <Box sx={FIELD_BLOCK}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="세션 타임아웃 (분)"
                {...OUTLINED_FIELD}
                value={settings.security.sessionTimeout}
                onChange={(e) => handleSettingChange('security', 'sessionTimeout', parseInt(e.target.value))}
                inputProps={{ min: 5, max: 1440, step: 1 }}
                variant="outlined"
                disabled={!canManageAll}
              />
            </Box>

            <Box sx={SWITCH_ROW}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={settings.security.requireSpecialChars}
                  onChange={(e) => handleSettingChange('security', 'requireSpecialChars', e.target.checked)}
                  disabled={!canManageAll}
                />
              }
              label="특수문자 필수"
              sx={{ ...SWITCH_LABEL, mb: 0 }}
            />

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={settings.security.twoFactorAuth}
                  onChange={(e) => handleSettingChange('security', 'twoFactorAuth', e.target.checked)}
                  disabled={settingControlDisabled('security', 'twoFactorAuth')}
                />
              }
              label={settingLabel('2단계 인증', 'security', 'twoFactorAuth')}
              sx={{ ...SWITCH_LABEL, mb: 0 }}
            />

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={settings.security.ipWhitelist}
                  onChange={(e) => handleSettingChange('security', 'ipWhitelist', e.target.checked)}
                  disabled={settingControlDisabled('security', 'ipWhitelist')}
                />
              }
              label={settingLabel('IP 화이트리스트', 'security', 'ipWhitelist')}
              sx={{ ...SWITCH_LABEL, mb: 0 }}
            />
            </Box>
          </CardContent>
        </Card>
        </Box>

        {/* 보내는 메일 서버 (SMTP) */}
        <Card elevation={0} sx={{ ...SETTINGS_CARD_SX, gridColumn: { xs: '1', md: '1 / -1' } }}>
          <CardContent sx={CARD_CONTENT_COMPACT}>
            <Box sx={SECTION_HEADER}>
              <EmailIcon sx={{ mr: 0.75, color: 'primary.main', fontSize: 20 }} />
              <Typography component="h2" sx={SECTION_TITLE}>{t('systemSettings.mailServer.title')}</Typography>
            </Box>
            <Divider sx={SECTION_DIVIDER} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.8125rem', lineHeight: 1.5 }}>
              {t('systemSettings.mailServer.hint')}
            </Typography>
            <Alert severity="info" sx={{ mb: 2, py: 1, fontSize: '0.8125rem', '& .MuiAlert-message': { width: '100%' } }}>
              <Box component="span" sx={{ display: 'block' }}>
                {t('systemSettings.mailServer.gmailHint')}
              </Box>
              <Link
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: 'inline-block', mt: 0.75, fontWeight: 600, fontSize: '0.8125rem' }}
              >
                {t('systemSettings.mailServer.gmailAppPasswordLink')}
              </Link>
            </Alert>
            {canManageAll && (
              <Button
                size="small"
                variant="outlined"
                onClick={applyGmailMailPreset}
                sx={{ ...mvsBodyOutlinedBtnSx, mb: 2 }}
              >
                {t('systemSettings.mailServer.gmailPreset')}
              </Button>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 1.75
              }}
            >
              <TextField
                fullWidth
                size="small"
                label={t('systemSettings.mailServer.host')}
                {...OUTLINED_FIELD}
                value={settings.mailServer.host}
                onChange={(e) => handleMailServerChange('host', e.target.value)}
                disabled={!canManageAll}
                placeholder="smtp.gmail.com"
              />
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t('systemSettings.mailServer.port')}
                {...OUTLINED_FIELD}
                value={settings.mailServer.port}
                onChange={(e) => handleMailServerChange('port', parseInt(e.target.value, 10) || 587)}
                disabled={!canManageAll}
              />
              <FormControlLabel
                sx={{ gridColumn: { xs: '1', sm: '1 / -1' }, ...SWITCH_LABEL }}
                control={
                  <Switch
                    size="small"
                    checked={settings.mailServer.secure}
                    onChange={(e) => handleMailServerChange('secure', e.target.checked)}
                    disabled={!canManageAll}
                  />
                }
                label={t('systemSettings.mailServer.secure')}
              />
              <TextField
                fullWidth
                size="small"
                label={t('systemSettings.mailServer.authUser')}
                {...OUTLINED_FIELD}
                value={settings.mailServer.authUser}
                onChange={(e) => handleMailServerChange('authUser', e.target.value)}
                disabled={!canManageAll}
                autoComplete="off"
              />
              <TextField
                fullWidth
                size="small"
                type={mailPassVisible || showMailPassMask ? 'text' : 'password'}
                label={t('systemSettings.mailServer.authPass')}
                {...OUTLINED_FIELD}
                value={showMailPassMask ? MAIL_AUTH_PASS_MASK : settings.mailServer.authPass}
                onChange={(e) => handleMailServerChange('authPass', e.target.value)}
                onFocus={() => setMailAuthPassFocused(true)}
                onBlur={() => setMailAuthPassFocused(false)}
                disabled={!canManageAll}
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        edge="end"
                        aria-label={mailPassVisible ? 'hide password' : 'show password'}
                        onClick={() => setMailPassVisible((v) => !v)}
                        disabled={!canManageAll}
                      >
                        {mailPassVisible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={
                  showMailPassMask
                    ? {
                        '& .MuiInputBase-input': {
                          fontFamily: 'ui-monospace, monospace',
                          letterSpacing: '0.08em'
                        }
                      }
                    : undefined
                }
                helperText={
                  settings.mailServer.authPassConfigured
                    ? t('systemSettings.mailServer.authPassHint')
                    : undefined
                }
              />
              <TextField
                fullWidth
                size="small"
                label={t('systemSettings.mailServer.fromEmail')}
                {...OUTLINED_FIELD}
                value={settings.mailServer.fromEmail}
                onChange={(e) => handleMailServerChange('fromEmail', e.target.value)}
                disabled={!canManageAll}
                placeholder="noreply@company.com"
              />
              <TextField
                fullWidth
                size="small"
                label={t('systemSettings.mailServer.fromName')}
                {...OUTLINED_FIELD}
                value={settings.mailServer.fromName}
                onChange={(e) => handleMailServerChange('fromName', e.target.value)}
                disabled={!canManageAll}
                placeholder="MVS"
              />
            </Box>
            {canManageAll && (
              <Box
                sx={{
                  mt: 2.5,
                  pt: 2,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1.25,
                }}
              >
                <Button
                  variant="contained"
                  disableElevation
                  size="small"
                  startIcon={
                    savingMail ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />
                  }
                  onClick={() => void handleSaveMailServer()}
                  disabled={savingMail || mailTesting || editGuard.disabled}
                  sx={mvsBodyPrimaryBtnSx}
                >
                  {savingMail
                    ? t('systemSettings.mailServer.savingSmtp')
                    : t('systemSettings.mailServer.saveSmtp')}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SendIcon fontSize="small" />}
                  onClick={openMailTestDialog}
                  disabled={savingMail || mailTesting}
                  sx={mvsBodyOutlinedBtnSx}
                >
                  {t('systemSettings.mailServer.testSmtp')}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* 백업 설정 — root 전용 */}
        {isRoot && (
        <Card elevation={0} sx={{ ...SETTINGS_CARD_SX, gridColumn: { xs: '1', md: '1 / -1' } }}>
          <CardContent sx={CARD_CONTENT_COMPACT}>
            <Box sx={SECTION_HEADER}>
              <StorageIcon sx={{ mr: 0.75, color: 'primary.main', fontSize: 20 }} />
              <Typography component="h2" sx={SECTION_TITLE}>백업 설정</Typography>
            </Box>
            <Divider sx={SECTION_DIVIDER} />

            <Alert severity="info" sx={{ mb: 2, py: 1, fontSize: '0.8125rem', '& .MuiAlert-message': { width: '100%' } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.8125rem' }}>
                {t('systemSettings.backup.hintTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', lineHeight: 1.55, mb: 0.75 }}>
                {t('systemSettings.backup.hintBody')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
                {t('systemSettings.backup.autoBackupNote')}
              </Typography>
            </Alert>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={settings.backup.autoBackup}
                      onChange={(e) => handleSettingChange('backup', 'autoBackup', e.target.checked)}
                      disabled={BACKUP_UI_DISABLED || !isRoot}
                    />
                  }
                  label="자동 백업"
                  sx={{ ...SWITCH_LABEL, mb: 1 }}
                />

                <Box sx={FIELD_BLOCK}>
                  <TextField
                    fullWidth
                    size="small"
                    select
                    label="백업 주기"
                    {...OUTLINED_FIELD}
                    value={settings.backup.backupFrequency}
                    onChange={(e) => handleSettingChange('backup', 'backupFrequency', e.target.value)}
                    disabled={BACKUP_UI_DISABLED || !isRoot}
                  >
                    <MenuItem value="hourly">매시간</MenuItem>
                    <MenuItem value="daily">매일</MenuItem>
                    <MenuItem value="weekly">매주</MenuItem>
                    <MenuItem value="monthly">매월</MenuItem>
                  </TextField>
                </Box>

                <Box sx={FIELD_BLOCK}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="보관 기간 (일)"
                    {...OUTLINED_FIELD}
                    value={settings.backup.retentionDays}
                    onChange={(e) => handleSettingChange('backup', 'retentionDays', parseInt(e.target.value))}
                    variant="outlined"
                    disabled={BACKUP_UI_DISABLED || !isRoot}
                  />
                </Box>
              </Box>

              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={settings.backup.cloudBackup}
                      onChange={(e) => handleSettingChange('backup', 'cloudBackup', e.target.checked)}
                      disabled={BACKUP_UI_DISABLED}
                    />
                  }
                  label="클라우드 백업"
                  sx={{ ...SWITCH_LABEL, mb: 0.5 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, lineHeight: 1.5 }}>
                  {t('systemSettings.backup.cloudBackupNote')}
                </Typography>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CloudUploadIcon sx={{ fontSize: 18 }} />}
                  onClick={handleBackupNow}
                  disabled={BACKUP_UI_DISABLED || !isRoot}
                  sx={{ ...mvsBodyOutlinedBtnSx, mb: 1 }}
                >
                  지금 백업하기
                </Button>

                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', lineHeight: 1.45, mb: 1 }}>
                  {t('systemSettings.backup.lastBackup')}: {settings.backup.lastBackup
                    ? new Date(settings.backup.lastBackup).toLocaleString(language === 'en' ? 'en-US' : 'ko-KR')
                    : t('systemSettings.backup.none')}
                </Typography>
                {backupStoragePath ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, lineHeight: 1.45 }}>
                    {t('systemSettings.backup.storagePath')}: {backupStoragePath}
                  </Typography>
                ) : null}
              </Box>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, fontSize: '0.8125rem' }}>
                {t('systemSettings.backup.fileListTitle')}
              </Typography>
              {backupFiles.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                  {t('systemSettings.backup.emptyFiles')}
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {backupFiles.map((file) => (
                    <Box
                      key={file.filename}
                      sx={{
                        display: 'flex',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 1,
                        flexWrap: 'wrap',
                        p: 1.25,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', wordBreak: 'break-all' }}>
                          {file.filename}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(file.createdAt).toLocaleString(language === 'en' ? 'en-US' : 'ko-KR')} · {formatBackupSize(file.size)}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={
                          downloadingBackupName === file.filename ? (
                            <CircularProgress size={16} />
                          ) : (
                            <DownloadIcon sx={{ fontSize: 18 }} />
                          )
                        }
                        onClick={() => void handleDownloadBackup(file.filename)}
                        disabled={BACKUP_UI_DISABLED || downloadingBackupName === file.filename}
                        sx={{ ...mvsBodyOutlinedBtnSx, flexShrink: 0 }}
                      >
                        {downloadingBackupName === file.filename
                          ? t('systemSettings.backup.downloading')
                          : t('systemSettings.backup.download')}
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
        )}
      </Box>
      )}
      </Box>

      {/* SMTP 테스트 메일 팝업 */}
      <Dialog
        open={mailTestOpen}
        onClose={() => (!mailTesting ? setMailTestOpen(false) : undefined)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('systemSettings.mailServer.testDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.8125rem', lineHeight: 1.5 }}>
            {t('systemSettings.mailServer.testDialogHint')}
          </Typography>
          <TextField
            fullWidth
            size="small"
            label={t('systemSettings.mailServer.testTo')}
            {...OUTLINED_FIELD}
            value={mailTestTo}
            onChange={(e) => setMailTestTo(e.target.value)}
            disabled={mailTesting}
            autoFocus
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label={t('systemSettings.mailServer.testSubject')}
            {...OUTLINED_FIELD}
            value={mailTestSubject}
            onChange={(e) => setMailTestSubject(e.target.value)}
            disabled={mailTesting}
            helperText={t('systemSettings.mailServer.testSubjectHint')}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            size="small"
            onClick={() => setMailTestOpen(false)}
            disabled={mailTesting}
            sx={mvsBodyOutlinedBtnSx}
          >
            {t('systemSettings.mailServer.cancel')}
          </Button>
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={mailTesting ? <CircularProgress size={16} color="inherit" /> : <SendIcon fontSize="small" />}
            onClick={() => void handleSendMailTest()}
            disabled={mailTesting}
            sx={mvsBodyPrimaryBtnSx}
          >
            {mailTesting
              ? t('systemSettings.mailServer.testSending')
              : t('systemSettings.mailServer.testSend')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 다이얼로그 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogType === 'logo' ? '회사 로고 변경' : '백업 실행'}
        </DialogTitle>
        <DialogContent>
          {dialogType === 'logo' ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              {previewLogo ? (
                <Box sx={{ mb: 2 }}>
                  <Avatar 
                    src={getUploadUrl(previewLogo) || previewLogo || undefined}
                    sx={{ width: 120, height: 120, mx: 'auto', mb: 2 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    미리보기
                  </Typography>
                </Box>
              ) : (
                <CloudUploadIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
              )}
              <Typography variant="body1" gutterBottom>
                로고 파일을 선택하세요
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                이미지 파일만 업로드 가능 (최대 5MB)
              </Typography>
              <Button 
                variant="contained" 
                component="label"
                disabled={uploading}
                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
              >
                {uploading ? '업로드 중...' : '파일 선택'}
                <input 
                  type="file" 
                  hidden 
                  accept="image/*" 
                  onChange={handleFileSelect}
                />
              </Button>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <StorageIcon sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
              <Typography variant="body1" gutterBottom>
                데이터베이스 백업을 시작하시겠습니까?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                {t('systemSettings.backup.dialogBody')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={uploading || backingUp}>
            취소
          </Button>
          <Button 
            variant="contained" 
            onClick={dialogType === 'logo' ? handleLogoConfirm : handleBackupConfirm}
            disabled={uploading || backingUp || (dialogType === 'logo' && !previewLogo)}
            startIcon={(uploading || backingUp) ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {uploading ? '업로드 중...' : backingUp ? '백업 중...' : dialogType === 'logo' ? '업로드' : '백업 시작'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SystemSettings;
