import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Switch,
  Typography,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import SmtpServerForm from '../../components/Mail/SmtpServerForm';
import {
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsPageRootSx,
} from '../../theme/daeheungLayout';
import { useTranslation } from 'react-i18next';
import {
  userMailServerService,
  userUiPreferencesService,
} from '../../services/api';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_CATEGORY_I18N,
  NOTIFICATION_CATEGORY_KEYS,
  type NotificationSettings,
} from '../../constants/notificationSettings';
import { EMPTY_MAIL_SERVER, MailServerForm } from '../../utils/mailServerForm';
import { showErrorPopup, showSuccessPopup } from '../../utils/errorHandler';
import {
  enableBrowserNotificationsFromSettings,
  notifyNotificationPrefsUpdated,
} from '../../hooks/useBrowserDesktopNotifications';
import { isBrowserNotificationSupported } from '../../utils/browserNotifications';

/** 내 정보·업무 > 설정 — SMTP + 알림 수신 옵션 */
const MyMailSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const txt = (ko: string, en: string) => (isEn ? en : ko);

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [mailServer, setMailServer] = useState<MailServerForm>(EMPTY_MAIL_SERVER);
  const [testTo, setTestTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMail, setSavingMail] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prefs, mail] = await Promise.all([
        userUiPreferencesService.get(),
        userMailServerService.get(),
      ]);
      setSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...(prefs.notificationSettings || {}) });
      setMailServer({
        ...EMPTY_MAIL_SERVER,
        ...mail,
        port: Number(mail.port) || 587,
        secure: Boolean(mail.secure),
        authPass: String(mail.authPass || ''),
        authPassConfigured: Boolean(mail.authPassConfigured || mail.authPass),
      });
      setTestTo((prev) => prev || String(mail.fromEmail || ''));
    } catch (error: any) {
      showErrorPopup(error, txt('설정을 불러오지 못했습니다.', 'Failed to load settings.'));
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveMail = async () => {
    setSavingMail(true);
    try {
      const data = await userMailServerService.patch({
        host: mailServer.host,
        port: mailServer.port,
        secure: mailServer.secure,
        authUser: mailServer.authUser,
        authPass: mailServer.authPass,
        fromEmail: mailServer.fromEmail,
        fromName: mailServer.fromName,
      });
      setMailServer((prev) => ({
        ...prev,
        ...data,
        authPass: String(data.authPass || mailServer.authPass || ''),
        authPassConfigured: Boolean(data.authPassConfigured || data.authPass),
      }));
      showSuccessPopup(txt('SMTP 설정이 저장되었습니다.', 'SMTP settings saved.'));
    } catch (error: any) {
      showErrorPopup(error, txt('SMTP 저장에 실패했습니다.', 'Failed to save SMTP settings.'));
    } finally {
      setSavingMail(false);
    }
  };

  const handleTestMail = async () => {
    if (!testTo.trim()) {
      showErrorPopup(
        new Error(txt('수신 이메일을 입력하세요.', 'Enter a recipient email.')),
        txt('테스트 발송', 'Test send')
      );
      return;
    }
    setTesting(true);
    try {
      await userMailServerService.test(testTo.trim());
      showSuccessPopup(txt('테스트 메일을 발송했습니다.', 'Test email sent.'));
    } catch (error: any) {
      showErrorPopup(error, txt('테스트 발송에 실패했습니다.', 'Test send failed.'));
    } finally {
      setTesting(false);
    }
  };

  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      if (settings.browser) {
        const granted = await enableBrowserNotificationsFromSettings();
        if (!granted) {
          if (!isBrowserNotificationSupported()) {
            showErrorPopup(
              new Error(t('notificationManagement.browserUnsupported')),
              t('notificationManagement.browser')
            );
          } else {
            showErrorPopup(
              new Error(t('notificationManagement.browserPermissionDenied')),
              t('notificationManagement.browser')
            );
          }
          const next = { ...settings, browser: false };
          setSettings(next);
          await userUiPreferencesService.patch({ notificationSettings: next });
          notifyNotificationPrefsUpdated();
          return;
        }
      }
      await userUiPreferencesService.patch({ notificationSettings: settings });
      notifyNotificationPrefsUpdated();
      showSuccessPopup(t('notificationManagement.settingsSaved'));
    } catch (error: any) {
      showErrorPopup(error, t('notificationManagement.settingsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={txt('설정', 'Settings')}
        description={txt(
          'SMTP와 알림 메일 수신 옵션을 설정합니다.',
          'Configure SMTP and email notification preferences.'
        )}
      />

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2.5 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            {txt('보내는 메일 서버 (SMTP)', 'Outgoing mail server (SMTP)')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.8125rem' }}>
            {txt(
              '업무 등록·담당 지정 알림 메일을 보낼 때 사용합니다. 회사 SMTP가 없으면 이 설정이 사용됩니다.',
              'Used when sending work assignment emails. Applied when company SMTP is not configured.'
            )}
          </Typography>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 0, fontSize: '0.8125rem' }}>
            <Box component="span" sx={{ display: 'block' }}>
              {txt(
                'Gmail: smtp.gmail.com · 포트 587 · SSL/TLS 끄기(STARTTLS). 2단계 인증 시 앱 비밀번호를 사용하세요.',
                'Gmail: smtp.gmail.com · port 587 · SSL/TLS off (STARTTLS). Use an App Password with 2-Step Verification.'
              )}
            </Box>
            <Link
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: 'inline-block', mt: 0.75, fontWeight: 600 }}
            >
              {txt(
                '보내는 서버 비밀번호(앱 비밀번호) 만들기',
                'Create outgoing server password (App Password)'
              )}
            </Link>
          </Alert>

          {loading ? (
            <Typography variant="body2" color="text.secondary">
              {t('common.loading')}
            </Typography>
          ) : (
            <SmtpServerForm
              value={mailServer}
              onChange={setMailServer}
              testTo={testTo}
              onTestToChange={setTestTo}
              onSave={() => void handleSaveMail()}
              onTest={() => void handleTestMail()}
              saving={savingMail}
              testing={testing}
              labels={{
                gmailPreset: txt('Gmail 권장값 적용', 'Apply Gmail defaults'),
                host: txt('SMTP 호스트', 'SMTP host'),
                port: txt('포트', 'Port'),
                secure: txt('SSL/TLS (포트 465)', 'SSL/TLS (port 465)'),
                authUser: txt('계정 (로그인 ID)', 'Account (login ID)'),
                authPass: txt('비밀번호', 'Password'),
                authPassHint: txt(
                  '눈 아이콘으로 저장된 비밀번호를 확인할 수 있습니다.',
                  'Use the eye icon to view the saved password.'
                ),
                fromEmail: txt('보내는 주소', 'From email'),
                fromName: txt('보내는 이름', 'From name'),
                testTo: txt('테스트 수신', 'Test recipient'),
                save: savingMail ? t('common.loading') : txt('SMTP 저장', 'Save SMTP'),
                testSend: testing ? t('common.loading') : txt('테스트 발송', 'Send test'),
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card elevation={0} sx={mvsBodyCardSx}>
        <CardContent sx={{ p: 2.5 }}>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 0 }}>
            {txt(
              '앱 내 알림(헤더)은 이 설정과 관계없이 표시됩니다. 이메일은 아래 옵션이 켜져 있고 SMTP(회사 또는 개인)가 준비된 경우에만 발송됩니다.',
              'In-app alerts still appear in the header. Email is sent only when enabled below and SMTP (company or personal) is ready.'
            )}
          </Alert>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25 }}>
            {t('notificationManagement.channelSettings')}
          </Typography>
          <Grid container spacing={1}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(settings.email)}
                    onChange={(e) => setSettings((prev) => ({ ...prev, email: e.target.checked }))}
                  />
                }
                label={t('notificationManagement.email')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(settings.realtime)}
                    onChange={(e) => setSettings((prev) => ({ ...prev, realtime: e.target.checked }))}
                  />
                }
                label={t('notificationManagement.realtime')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(settings.browser)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setSettings((prev) => ({ ...prev, browser: on }));
                      if (on) void enableBrowserNotificationsFromSettings();
                    }}
                  />
                }
                label={t('notificationManagement.browser')}
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ pl: 6, mt: -0.5 }}>
                {t('notificationManagement.browserHint')}
              </Typography>
            </Grid>
          </Grid>

          {settings.email ? (
            <Box sx={{ mt: 2, maxWidth: 480 }}>
              <FormControl fullWidth size="small" sx={{ maxWidth: 280 }}>
                <InputLabel>{t('notificationManagement.emailDigest')}</InputLabel>
                <Select
                  label={t('notificationManagement.emailDigest')}
                  value={settings.emailDigest || 'immediate'}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      emailDigest: e.target.value as NotificationSettings['emailDigest'],
                    }))
                  }
                >
                  <MenuItem value="immediate">{t('notificationManagement.digestImmediate')}</MenuItem>
                  <MenuItem value="daily">{t('notificationManagement.digestDaily')}</MenuItem>
                  <MenuItem value="weekly">{t('notificationManagement.digestWeekly')}</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                {t('notificationManagement.digestHint')}
              </Typography>
            </Box>
          ) : null}

          <Divider sx={{ my: 2 }} />

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
              mb: 1,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {t('notificationManagement.categorySettings')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  setSettings((prev) => {
                    const next = { ...prev };
                    for (const key of NOTIFICATION_CATEGORY_KEYS) next[key] = true;
                    return next;
                  })
                }
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('notificationManagement.categoryEnableAll')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  setSettings((prev) => {
                    const next = { ...prev };
                    for (const key of NOTIFICATION_CATEGORY_KEYS) next[key] = false;
                    return next;
                  })
                }
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('notificationManagement.categoryDisableAll')}
              </Button>
            </Box>
          </Box>
          <Grid container spacing={1}>
            {NOTIFICATION_CATEGORY_KEYS.map((key) => {
              const label = t(`notificationManagement.${NOTIFICATION_CATEGORY_I18N[key]}`);
              const hintKey =
                key === 'comments'
                  ? 'catCommentsHint'
                  : key === 'unreadReminder'
                    ? 'catUnreadReminderHint'
                    : null;
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={key}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings[key] !== false}
                        onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                    }
                    label={label}
                  />
                  {hintKey ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ pl: 6, mt: -0.5, mb: 0.5 }}
                    >
                      {t(`notificationManagement.${hintKey}`)}
                    </Typography>
                  ) : null}
                </Grid>
              );
            })}
          </Grid>

          <Box sx={{ mt: 2.5 }}>
            <Button
              variant="contained"
              disableElevation
              onClick={() => void handleSavePrefs()}
              disabled={saving}
              sx={mvsBodyPrimaryBtnSx}
            >
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MyMailSettings;
