import express from 'express';
import path from 'path';
import nodemailer from 'nodemailer';
import { Company, User } from '../models';
import { authenticateToken, requireRole } from '../middleware/auth';
import { buildNodemailerTransportOptions, getSystemMailTransportOptions, normalizeSmtpPassword } from '../utils/mailConfig';

const router = express.Router();

const DEFAULT_SESSION_TIMEOUT_MINUTES = 600;
const MIN_SESSION_TIMEOUT_MINUTES = 5;
const MAX_SESSION_TIMEOUT_MINUTES = 24 * 60;

const normalizeSessionTimeoutMinutes = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_SESSION_TIMEOUT_MINUTES;
  const rounded = Math.floor(num);
  if (rounded < MIN_SESSION_TIMEOUT_MINUTES) return MIN_SESSION_TIMEOUT_MINUTES;
  if (rounded > MAX_SESSION_TIMEOUT_MINUTES) return MAX_SESSION_TIMEOUT_MINUTES;
  return rounded;
};

const buildDefaultSettings = (company: Company) => ({
  general: {
    companyName: company.name || 'MVS',
    /** 메일 제목 등 `[약어]` — 예: MSV */
    companyAbbreviation: '',
    companyLogo: '',
    timezone: company.timezone || 'Asia/Kolkata',
    language: 'ko',
    dateFormat: 'YYYY-MM-DD',
    currency: 'INR',
    officeLocation: {
      latitude: null,
      longitude: null,
      radiusMeters: 200
    }
  },
  appearance: {
    theme: 'light',
    primaryColor: '#1976d2',
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
    cloudBackup: false
  },
  mailServer: {
    host: '',
    port: 587,
    secure: false,
    authUser: '',
    fromEmail: '',
    fromName: '',
    authPassConfigured: false
  }
});

const buildSettingsResponse = (company: Company, user?: User | null) => {
  const defaultSettings = buildDefaultSettings(company);
  const companySettings = (company.settings || {}) as Record<string, unknown>;
  const userSettings = (user?.settings || {}) as Record<string, unknown>;

  /** SMTP: 회사 시스템 설정. 구버전 사용자별 저장값은 회사에 없을 때만 표시 폴백 */
  const companyMail = (companySettings.mailServer || {}) as Record<string, unknown>;
  const legacyUserMail = (userSettings.mailServer || {}) as Record<string, unknown>;
  const sourceMail =
    companyMail.host != null && String(companyMail.host).trim()
      ? companyMail
      : legacyUserMail;

  const mergedMail = {
    ...defaultSettings.mailServer,
    host: sourceMail.host != null ? String(sourceMail.host).trim() : '',
    port: sourceMail.port != null ? Number(sourceMail.port) || 587 : defaultSettings.mailServer.port,
    secure:
      sourceMail.secure !== undefined && sourceMail.secure !== null
        ? Boolean(sourceMail.secure)
        : defaultSettings.mailServer.secure,
    authUser: sourceMail.authUser != null ? String(sourceMail.authUser).trim() : '',
    authPass: sourceMail.authPass != null ? String(sourceMail.authPass) : '',
    fromEmail: sourceMail.fromEmail != null ? String(sourceMail.fromEmail).trim() : '',
    fromName: sourceMail.fromName != null ? String(sourceMail.fromName).trim() : '',
    authPassConfigured: Boolean(sourceMail.authPass && String(sourceMail.authPass).trim())
  };

  return {
    ...defaultSettings,
    ...companySettings,
    general: {
      ...defaultSettings.general,
      companyName: company.name || defaultSettings.general.companyName,
      timezone: company.timezone || defaultSettings.general.timezone,
      ...((companySettings.general || {}) as Record<string, unknown>)
    },
    appearance: (() => {
      const merged = {
        ...defaultSettings.appearance,
        ...((companySettings.appearance || {}) as Record<string, unknown>),
        ...((userSettings.appearance || {}) as Record<string, unknown>)
      } as Record<string, unknown>;
      delete merged.sidebarCollapsed;
      return merged;
    })(),
    mailServer: mergedMail
  };
};

// 시스템 설정 조회
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userCompanyId = (req as any).user.company_id;
    const tenantId = (req as any).user.tenant_id;
    const userId = (req as any).user.id;

    if (!userCompanyId) {
      return res.status(400).json({
        success: false,
        message: '회사 정보가 없습니다.'
      });
    }

    const company = await Company.findOne({
      where: {
        id: userCompanyId,
        tenant_id: tenantId
      }
    });

    const user = await User.findOne({
      where: {
        id: userId,
        tenant_id: tenantId,
        company_id: userCompanyId
      }
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: '회사를 찾을 수 없습니다.'
      });
    }

    const settings = buildSettingsResponse(company, user);
    const userRole = (req as any).user.role;

    // 회사 로고가 있으면 Base64로 변환
    if (company.company_logo && Buffer.isBuffer(company.company_logo)) {
      settings.general.companyLogo = `data:image/png;base64,${company.company_logo.toString('base64')}`;
    }

    // 백업 설정은 root만 조회 가능
    if (userRole !== 'root') {
      delete (settings as { backup?: unknown }).backup;
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error: any) {
    console.error('시스템 설정 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '시스템 설정 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// 사무실 위치 조회 (근태용)
router.get('/office-location', authenticateToken, async (req, res) => {
  try {
    const userCompanyId = (req as any).user.company_id;
    const tenantId = (req as any).user.tenant_id;

    if (!userCompanyId) {
      return res.status(400).json({
        success: false,
        message: '회사 정보가 없습니다.'
      });
    }

    const company = await Company.findOne({
      where: {
        id: userCompanyId,
        tenant_id: tenantId
      }
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: '회사를 찾을 수 없습니다.'
      });
    }

    const settings = buildSettingsResponse(company, null);
    const officeLocation = settings.general?.officeLocation || null;

    res.json({
      success: true,
      data: {
        officeLocation
      }
    });
  } catch (error: any) {
    console.error('사무실 위치 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사무실 위치 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// 시스템 설정 저장
router.put('/', authenticateToken, async (req, res) => {
  try {
    const userCompanyId = (req as any).user.company_id;
    const tenantId = (req as any).user.tenant_id;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;
    const settings = req.body;
    const canManageAll = userRole === 'root' || userRole === 'admin';

    if (!userCompanyId) {
      return res.status(400).json({
        success: false,
        message: '회사 정보가 없습니다.'
      });
    }

    const company = await Company.findOne({
      where: {
        id: userCompanyId,
        tenant_id: tenantId
      }
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: '회사를 찾을 수 없습니다.'
      });
    }

    const user = await User.findOne({
      where: {
        id: userId,
        tenant_id: tenantId,
        company_id: userCompanyId
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    if (canManageAll) {
      // 회사명 업데이트
      if (settings.general?.companyName) {
        await company.update({
          name: settings.general.companyName
        });
      }

      // 타임존은 항상 인도 표준시(IST)로 고정
      // 시간대 업데이트 제거 - 항상 Asia/Kolkata로 유지

      // 로고 업데이트 (Base64 이미지가 있는 경우)
      if (settings.general?.companyLogo && settings.general.companyLogo.startsWith('data:image')) {
        const base64Data = settings.general.companyLogo.replace(/^data:image\/\w+;base64,/, '');
        const logoBuffer = Buffer.from(base64Data, 'base64');
        await company.update({
          company_logo: logoBuffer
        });
      }

      const rawBody = (settings || {}) as Record<string, unknown>;
      const backup = rawBody.backup;
      const restSettings = { ...rawBody };
      if (restSettings.security && typeof restSettings.security === 'object') {
        const securitySettings = restSettings.security as Record<string, unknown>;
        securitySettings.sessionTimeout = normalizeSessionTimeoutMinutes(securitySettings.sessionTimeout);
      }
      delete restSettings.appearance;
      delete restSettings.backup;
      delete restSettings.mailServer;
      const existingCompanySettings = (company.settings || {}) as Record<string, unknown>;
      const settingsToSave: Record<string, unknown> = {
        ...existingCompanySettings,
        ...restSettings,
        general: restSettings.general
          ? {
              ...(existingCompanySettings.general as Record<string, unknown>),
              ...(restSettings.general as Record<string, unknown>),
              companyLogo: undefined // 로고는 별도 필드에 저장되므로 settings에서 제거
            }
          : existingCompanySettings.general
      };

      if (userRole === 'root' && backup !== undefined) {
        settingsToSave.backup = backup;
      }

      if (settings.mailServer && typeof settings.mailServer === 'object') {
        const inc = settings.mailServer as Record<string, unknown>;
        const prevCompanyMail = (existingCompanySettings.mailServer || {}) as Record<string, unknown>;
        const prevUserMail = (((user.settings || {}) as Record<string, unknown>).mailServer ||
          {}) as Record<string, unknown>;
        const passwordUnchanged = !inc.authPass || String(inc.authPass).trim() === '';
        const effectivePrevPass =
          (prevCompanyMail.authPass && normalizeSmtpPassword(String(prevCompanyMail.authPass))) ||
          (prevUserMail.authPass && normalizeSmtpPassword(String(prevUserMail.authPass))) ||
          '';
        settingsToSave.mailServer = {
          host: inc.host != null ? String(inc.host).trim() : prevCompanyMail.host || '',
          port: inc.port != null ? Math.max(1, Number(inc.port) || 587) : prevCompanyMail.port || 587,
          secure: inc.secure != null ? Boolean(inc.secure) : Boolean(prevCompanyMail.secure),
          authUser: inc.authUser != null ? String(inc.authUser).trim() : prevCompanyMail.authUser || '',
          authPass: passwordUnchanged ? effectivePrevPass : normalizeSmtpPassword(String(inc.authPass)),
          fromEmail: inc.fromEmail != null ? String(inc.fromEmail).trim() : prevCompanyMail.fromEmail || '',
          fromName: inc.fromName != null ? String(inc.fromName).trim() : prevCompanyMail.fromName || ''
        };
      } else {
        const prevCompanyMail = (existingCompanySettings.mailServer || {}) as Record<string, unknown>;
        const prevUserMail = (((user.settings || {}) as Record<string, unknown>).mailServer ||
          {}) as Record<string, unknown>;
        const companyHasMail =
          prevCompanyMail.host != null && String(prevCompanyMail.host).trim().length > 0;
        const legacyHasMail =
          prevUserMail.host != null && String(prevUserMail.host).trim().length > 0;
        if (!companyHasMail && legacyHasMail) {
          settingsToSave.mailServer = {
            host: String(prevUserMail.host).trim(),
            port: prevUserMail.port != null ? Math.max(1, Number(prevUserMail.port) || 587) : 587,
            secure: prevUserMail.secure != null ? Boolean(prevUserMail.secure) : false,
            authUser: prevUserMail.authUser != null ? String(prevUserMail.authUser).trim() : '',
            authPass: prevUserMail.authPass != null ? String(prevUserMail.authPass).trim() : '',
            fromEmail: prevUserMail.fromEmail != null ? String(prevUserMail.fromEmail).trim() : '',
            fromName: prevUserMail.fromName != null ? String(prevUserMail.fromName).trim() : ''
          };
        }
      }

      await company.update({
        settings: settingsToSave as any
      });
      await company.reload();
    }

    let updatedUser = user;

    await company.reload();

    const existingUserSettings = (user.settings || {}) as Record<string, unknown>;
    const nextUserSettings = { ...existingUserSettings };

    if (settings.appearance && typeof settings.appearance === 'object') {
      const nextAppearance = {
        ...((existingUserSettings.appearance || {}) as Record<string, unknown>),
        ...(settings.appearance as Record<string, unknown>)
      };
      delete nextAppearance.sidebarCollapsed;
      nextUserSettings.appearance = nextAppearance;
    }

    if (settings.appearance) {
      updatedUser = await user.update({
        settings: nextUserSettings as any
      });
    }

    res.json({
      success: true,
      message: '시스템 설정이 저장되었습니다.',
      data: buildSettingsResponse(company, updatedUser)
    });
  } catch (error: any) {
    console.error('시스템 설정 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '시스템 설정 저장 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// 시스템 설정 초기화
router.delete('/', authenticateToken, requireRole(['root', 'admin']), async (req, res) => {
  try {
    const userCompanyId = (req as any).user.company_id;
    const tenantId = (req as any).user.tenant_id;

    if (!userCompanyId) {
      return res.status(400).json({
        success: false,
        message: '회사 정보가 없습니다.'
      });
    }

    const company = await Company.findOne({
      where: {
        id: userCompanyId,
        tenant_id: tenantId
      }
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: '회사를 찾을 수 없습니다.'
      });
    }

    await company.update({
      settings: {},
      company_logo: null
    });

    const settings = buildSettingsResponse(company, null);

    res.json({
      success: true,
      message: '시스템 설정이 초기화되었습니다.',
      data: settings
    });
  } catch (error: any) {
    console.error('시스템 설정 초기화 오류:', error);
    res.status(500).json({
      success: false,
      message: '시스템 설정 초기화 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// 로고 업로드
router.post('/logo', authenticateToken, requireRole(['root', 'admin']), async (req, res) => {
  try {
    const userCompanyId = (req as any).user.company_id;
    const tenantId = (req as any).user.tenant_id;
    const { logo } = req.body; // Base64 이미지

    if (!userCompanyId) {
      return res.status(400).json({
        success: false,
        message: '회사 정보가 없습니다.'
      });
    }

    if (!logo || !logo.startsWith('data:image')) {
      return res.status(400).json({
        success: false,
        message: '유효한 이미지 파일이 아닙니다.'
      });
    }

    const company = await Company.findOne({
      where: {
        id: userCompanyId,
        tenant_id: tenantId
      }
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: '회사를 찾을 수 없습니다.'
      });
    }

    const base64Data = logo.replace(/^data:image\/\w+;base64,/, '');
    const logoBuffer = Buffer.from(base64Data, 'base64');

    await company.update({
      company_logo: logoBuffer
    });

    res.json({
      success: true,
      message: '로고가 업로드되었습니다.',
      data: {
        logo: `data:image/png;base64,${logoBuffer.toString('base64')}`
      }
    });
  } catch (error: any) {
    console.error('로고 업로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '로고 업로드 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// 백업 실행
router.post('/backup', authenticateToken, requireRole(['root']), async (req, res) => {
  try {
    const tenantId = Number((req as any).user.tenant_id);
    const companyId = Number((req as any).user.company_id);
    if (!tenantId || !companyId) {
      return res.status(400).json({ success: false, message: '회사 정보가 없습니다.' });
    }

    const company = await Company.findOne({
      where: { id: companyId, tenant_id: tenantId },
    });
    if (!company) {
      return res.status(404).json({ success: false, message: '회사를 찾을 수 없습니다.' });
    }

    const companySettings = (company.settings || {}) as Record<string, unknown>;
    const backupSettings = (companySettings.backup || {}) as Record<string, unknown>;
    const retentionDays = Number(backupSettings.retentionDays) || 30;

    const {
      createDatabaseBackup,
      cleanupOldBackups,
      getBackupRootDir,
      listDatabaseBackups,
    } = await import('../services/databaseBackupService');

    const backupFile = await createDatabaseBackup(tenantId);
    const removedCount = cleanupOldBackups(tenantId, retentionDays);
    const lastBackup = backupFile.createdAt;

    const nextSettings = {
      ...companySettings,
      backup: {
        ...backupSettings,
        lastBackup,
        lastBackupFile: backupFile.filename,
      },
    };
    await company.update({ settings: nextSettings as any });

    res.json({
      success: true,
      message: '데이터베이스 백업이 완료되었습니다.',
      data: {
        ...backupFile,
        storagePath: getBackupRootDir(),
        removedOldFiles: removedCount,
        files: listDatabaseBackups(tenantId),
        lastBackup,
      },
    });
  } catch (error: any) {
    console.error('백업 실행 오류:', error);
    res.status(500).json({
      success: false,
      message: error?.message || '백업 실행 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
});

// 백업 파일 목록
router.get('/backups', authenticateToken, requireRole(['root']), async (req, res) => {
  try {
    const tenantId = Number((req as any).user.tenant_id);
    const { listDatabaseBackups, getBackupRootDir } = await import('../services/databaseBackupService');
    res.json({
      success: true,
      data: {
        storagePath: getBackupRootDir(),
        files: listDatabaseBackups(tenantId),
      },
    });
  } catch (error: any) {
    console.error('백업 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '백업 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
});

// 백업 파일 다운로드
router.get('/backups/:filename/download', authenticateToken, requireRole(['root']), async (req, res) => {
  try {
    const tenantId = Number((req as any).user.tenant_id);
    const { resolveBackupFilePath } = await import('../services/databaseBackupService');
    const filePath = resolveBackupFilePath(tenantId, req.params.filename);
    if (!filePath) {
      return res.status(404).json({ success: false, message: '백업 파일을 찾을 수 없습니다.' });
    }

    res.download(filePath, path.basename(filePath));
  } catch (error: any) {
    console.error('백업 다운로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '백업 다운로드 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
});

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SMTP 테스트 메일 발송 (현재 사용자의 SMTP 설정 우선)
router.post('/test-mail', authenticateToken, requireRole(['root', 'admin']), async (req, res) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const companyId = (req as any).user.company_id;
    const userId = (req as any).user.id;
    const rawTo = req.body?.to;
    const rawSubject = req.body?.subject;

    const to = typeof rawTo === 'string' ? rawTo.trim() : '';
    if (!to || !EMAIL_RX.test(to)) {
      return res.status(400).json({
        success: false,
        message: '유효한 수신 이메일 주소를 입력하세요.'
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: '회사 정보가 없습니다.'
      });
    }

    const companyRow = await (Company as any).findByPk(companyId, {
      attributes: ['id', 'tenant_id', 'name', 'settings']
    });

    if (!companyRow) {
      return res.status(404).json({
        success: false,
        message: '회사 정보를 찾을 수 없습니다.'
      });
    }
    if (tenantId != null && Number(companyRow.tenant_id) !== Number(tenantId)) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }

    const mailOpts = getSystemMailTransportOptions(companyRow);
    if (!mailOpts) {
      return res.status(503).json({
        success: false,
        message:
          '메일 서버가 설정되지 않았습니다. 시스템 설정 > 보내는 메일 서버(SMTP)에 호스트·계정·비밀번호를 저장하거나, 서버 환경변수(EMAIL_*)를 설정하세요.'
      });
    }

    const companyName = String(companyRow.name || 'MVS').trim();
    const defaultSubjectEn = `[${companyName}] Mail send test`;
    const customSubject =
      typeof rawSubject === 'string' && rawSubject.trim().length > 0
        ? rawSubject.trim().slice(0, 200)
        : '';
    const subject = customSubject || defaultSubjectEn;

    const sentAt = new Date().toISOString();
    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.55;max-width:640px;">
        <p style="margin:0 0 8px;">This message was sent as an SMTP configuration test from the <strong>${companyName}</strong> MVS system.</p>
        <p style="margin:0 0 16px;">Sent at (UTC): ${sentAt}</p>
        <p style="margin-top:16px;color:#666;font-size:12px;">This is a test email.</p>
      </div>
    `;
    const text = `SMTP test mail (${companyName})\nSent at (UTC): ${sentAt}\n\nThis is a test email.`;

    const transporter = nodemailer.createTransport(buildNodemailerTransportOptions(mailOpts));

    await transporter.sendMail({
      from: mailOpts.from,
      to,
      subject,
      text,
      html
    });

    res.json({
      success: true,
      message: '테스트 메일을 발송했습니다. 수신함을 확인하세요.',
      data: { to, subject }
    });
  } catch (error: any) {
    console.error('테스트 메일 발송 오류:', error);
    const msg =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : '테스트 메일 발송 중 오류가 발생했습니다.';
    res.status(502).json({
      success: false,
      message: msg,
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

export default router;

