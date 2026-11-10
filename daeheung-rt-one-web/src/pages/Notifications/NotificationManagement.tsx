import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  List,
  ListItemButton,
  ListItemText,
  Tabs,
  Tab,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsBodyCardSx,
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsBodyOutlinedBtnSx,
  mvsPageRootSx,
} from '../../theme/daeheungLayout';
import {
  Check as CheckIcon,
  DeleteSweep as DeleteSweepIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Description as TemplateIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, userUiPreferencesService, UserUiPreferencesData } from '../../services/api';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_CATEGORY_I18N,
  NOTIFICATION_CATEGORY_KEYS,
} from '../../constants/notificationSettings';
import {
  enableBrowserNotificationsFromSettings,
  notifyNotificationPrefsUpdated,
} from '../../hooks/useBrowserDesktopNotifications';
import { isBrowserNotificationSupported } from '../../utils/browserNotifications';
import { useErrorStore } from '../../store/errorStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useMenuStore, useStore } from '../../store';
import NotificationDetailDialog from '../../components/Notifications/NotificationDetailDialog';
import {
  ActionInboxRow,
  AppNotification,
  buildNotificationsFromSources,
  getNotificationChipColor,
  getNotificationChipLabel,
  ServerNotificationItem,
} from '../../utils/notificationFeed';

type FilterMode = 'all' | 'unread';
type TabKey = 'history' | 'send' | 'settings' | 'templates';

const CARD_SX = mvsBodyCardSx;

const DEFAULT_SETTINGS = DEFAULT_NOTIFICATION_SETTINGS;

const TAB_INDEX: Record<TabKey, number> = {
  history: 0,
  send: 1,
  settings: 2,
  templates: 3,
};

const INDEX_TAB: TabKey[] = ['history', 'send', 'settings', 'templates'];

const NotificationManagement: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useMenuStore();
  const { user } = useStore();
  const { errors, notifications, clearErrors, clearNotifications } = useErrorStore();
  const {
    items,
    headerDismissedIds,
    mergeFromSources,
    markRead,
    markAllRead,
    clearAll,
  } = useNotificationStore();

  const canSend = user?.role === 'admin' || user?.role === 'root';

  const initialTab = searchParams.get('tab');
  const tabIndex = TAB_INDEX[(initialTab as TabKey) || 'history'] ?? 0;

  const [activeTab, setActiveTab] = useState(tabIndex);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [serverNotifications, setServerNotifications] = useState<ServerNotificationItem[]>([]);
  const [inboxActions, setInboxActions] = useState<ActionInboxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [templates, setTemplates] = useState<NonNullable<UserUiPreferencesData['notificationTemplates']>>([]);
  const [templateDialog, setTemplateDialog] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    name: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  } | null>(null);

  const [sendForm, setSendForm] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    target_type: 'tenant' as 'user' | 'tenant' | 'all',
    target_id: '',
    templateId: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [notifRes, inboxRes, prefs] = await Promise.all([
        api.get('/notifications', { params: { page: 1, limit: 100 } }),
        api.get('/notifications/inbox'),
        userUiPreferencesService.get(),
      ]);

      if (notifRes.data?.success) {
        setServerNotifications(Array.isArray(notifRes.data.data) ? notifRes.data.data : []);
      } else {
        setServerNotifications([]);
      }

      if (inboxRes.data?.success && Array.isArray(inboxRes.data.data)) {
        setInboxActions(inboxRes.data.data as ActionInboxRow[]);
      } else {
        setInboxActions([]);
      }

      setSettings({ ...DEFAULT_SETTINGS, ...(prefs.notificationSettings || {}) });
      setTemplates(Array.isArray(prefs.notificationTemplates) ? prefs.notificationTemplates : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const merged = buildNotificationsFromSources({
      serverNotifications,
      clientNotifications: notifications,
      errors,
      inboxActions,
      t,
    });
    mergeFromSources(merged);
  }, [serverNotifications, notifications, errors, inboxActions, t, mergeFromSources]);

  const visibleItems = useMemo(() => {
    const dismissed = new Set(headerDismissedIds);
    return items.filter((item) => !dismissed.has(item.id));
  }, [items, headerDismissedIds]);

  const filteredItems = useMemo(() => {
    const list = filter === 'unread' ? visibleItems.filter((item) => !item.read) : visibleItems;
    return list;
  }, [visibleItems, filter]);

  const unreadCount = useMemo(
    () => visibleItems.filter((item) => !item.read).length,
    [visibleItems]
  );
  const locale = language === 'en' ? 'en-US' : 'ko-KR';

  const handleTabChange = (_: React.SyntheticEvent, value: number) => {
    setActiveTab(value);
    setSearchParams({ tab: INDEX_TAB[value] || 'history' });
  };

  const handleOpenDetail = (item: AppNotification) => {
    setSelected(item);
    setDetailOpen(true);
    markRead(item.id);
  };

  const handleClearAll = () => {
    clearAll();
    clearErrors();
    clearNotifications();
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      let next = settings;
      if (settings.browser) {
        const granted = await enableBrowserNotificationsFromSettings();
        if (!granted) {
          next = { ...settings, browser: false };
          setSettings(next);
          setSnackbar({
            open: true,
            message: isBrowserNotificationSupported()
              ? t('notificationManagement.browserPermissionDenied')
              : t('notificationManagement.browserUnsupported'),
            severity: 'error',
          });
        }
      }
      await userUiPreferencesService.patch({ notificationSettings: next });
      notifyNotificationPrefsUpdated();
      setSnackbar({ open: true, message: t('notificationManagement.settingsSaved'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('notificationManagement.settingsSaveFailed'), severity: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendNotification = async () => {
    if (!sendForm.title.trim() || !sendForm.message.trim()) {
      setSnackbar({ open: true, message: t('notificationManagement.sendRequired'), severity: 'error' });
      return;
    }
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        title: sendForm.title.trim(),
        message: sendForm.message.trim(),
        type: sendForm.type,
        target_type: sendForm.target_type,
      };
      if (sendForm.target_type === 'user' && sendForm.target_id) {
        payload.target_id = Number(sendForm.target_id);
      }
      await api.post('/notifications/send', payload);
      setSnackbar({ open: true, message: t('notificationManagement.sendSuccess'), severity: 'success' });
      setSendForm((prev) => ({ ...prev, title: '', message: '', target_id: '', templateId: '' }));
      void loadData();
      setActiveTab(0);
      setSearchParams({ tab: 'history' });
    } catch (error: any) {
      const msg = error?.response?.data?.message || t('notificationManagement.sendFailed');
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleApplyTemplate = (templateId: string) => {
    const tpl = templates.find((item) => item.id === templateId);
    if (!tpl) return;
    setSendForm((prev) => ({
      ...prev,
      templateId,
      title: tpl.title,
      message: tpl.message,
      type: tpl.type,
    }));
  };

  const handleSaveTemplate = async () => {
    if (!templateDialog) return;
    const { mode, id, name, title, message, type } = templateDialog;
    if (!name.trim() || !title.trim() || !message.trim()) {
      setSnackbar({ open: true, message: t('notificationManagement.templateRequired'), severity: 'error' });
      return;
    }
    const next =
      mode === 'create'
        ? [
            ...templates,
            {
              id: `tpl-${Date.now()}`,
              name: name.trim(),
              title: title.trim(),
              message: message.trim(),
              type,
            },
          ]
        : templates.map((item) =>
            item.id === id
              ? { ...item, name: name.trim(), title: title.trim(), message: message.trim(), type }
              : item
          );
    try {
      await userUiPreferencesService.patch({ notificationTemplates: next });
      setTemplates(next);
      setTemplateDialog(null);
      setSnackbar({ open: true, message: t('notificationManagement.templateSaved'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('notificationManagement.templateSaveFailed'), severity: 'error' });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const next = templates.filter((item) => item.id !== id);
    try {
      await userUiPreferencesService.patch({ notificationTemplates: next });
      setTemplates(next);
      setSnackbar({ open: true, message: t('notificationManagement.templateDeleted'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('notificationManagement.templateSaveFailed'), severity: 'error' });
    }
  };

  const renderHistoryTab = () => (
    <Box>
      <Card elevation={0} sx={mvsBodyCardSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, p: 2, flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          size="small"
          value={filter}
          exclusive
          onChange={(_, value: FilterMode | null) => value && setFilter(value)}
        >
          <ToggleButton value="all">{t('notifications.filterAll')}</ToggleButton>
          <ToggleButton value="unread">
            {t('notifications.filterUnread')}
            {unreadCount > 0 ? ` (${unreadCount})` : ''}
          </ToggleButton>
        </ToggleButtonGroup>
        <Tooltip title={t('notifications.refresh')}>
          <IconButton size="small" onClick={() => void loadData()} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('notifications.markAllAsRead')}>
          <IconButton size="small" onClick={markAllRead} disabled={visibleItems.length === 0}>
            <CheckIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DeleteSweepIcon />}
          onClick={handleClearAll}
          disabled={visibleItems.length === 0}
          sx={mvsBodyOutlinedBtnSx}
        >
          {t('notifications.clearAll')}
        </Button>
        </Box>
      </Card>

      <Card elevation={0} sx={{ ...mvsBodyListZoneSx, ...mvsBodyListTableSx }}>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {loading ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : filteredItems.length === 0 ? (
            <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                {t('notifications.noNotifications')}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filteredItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 ? <Divider component="li" /> : null}
                  <ListItemButton
                    onClick={() => handleOpenDetail(item)}
                    sx={{
                      alignItems: 'flex-start',
                      py: 1.5,
                      px: 2,
                      bgcolor: item.read ? 'transparent' : 'action.hover',
                    }}
                  >
                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip
                          size="small"
                          label={getNotificationChipLabel(item, t)}
                          color={getNotificationChipColor(item)}
                          sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.625rem' } }}
                        />
                        {!item.read ? (
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
                        ) : null}
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                          {new Date(item.timestamp).toLocaleString(locale)}
                        </Typography>
                      </Box>
                      <ListItemText
                        primary={item.title}
                        secondary={item.message}
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem', sx: { mb: 0.25 } }}
                        secondaryTypographyProps={{
                          fontSize: '0.8125rem',
                          color: 'text.primary',
                          sx: {
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          },
                        }}
                      />
                    </Box>
                  </ListItemButton>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );

  const renderSendTab = () => {
    if (!canSend) {
      return (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {t('notificationManagement.sendAdminOnly')}
        </Alert>
      );
    }

    return (
      <Card sx={CARD_SX}>
        <CardContent sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('notificationManagement.templateSelect')}</InputLabel>
                <Select
                  label={t('notificationManagement.templateSelect')}
                  value={sendForm.templateId}
                  onChange={(e) => handleApplyTemplate(String(e.target.value))}
                >
                  <MenuItem value="">{t('notificationManagement.templateNone')}</MenuItem>
                  {templates.map((tpl) => (
                    <MenuItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('notificationManagement.sendType')}</InputLabel>
                <Select
                  label={t('notificationManagement.sendType')}
                  value={sendForm.type}
                  onChange={(e) =>
                    setSendForm((prev) => ({
                      ...prev,
                      type: e.target.value as typeof sendForm.type,
                    }))
                  }
                >
                  <MenuItem value="info">INFO</MenuItem>
                  <MenuItem value="success">SUCCESS</MenuItem>
                  <MenuItem value="warning">WARNING</MenuItem>
                  <MenuItem value="error">ERROR</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('notificationManagement.sendTarget')}</InputLabel>
                <Select
                  label={t('notificationManagement.sendTarget')}
                  value={sendForm.target_type}
                  onChange={(e) =>
                    setSendForm((prev) => ({
                      ...prev,
                      target_type: e.target.value as typeof sendForm.target_type,
                    }))
                  }
                >
                  <MenuItem value="tenant">{t('notificationManagement.targetTenant')}</MenuItem>
                  <MenuItem value="user">{t('notificationManagement.targetUser')}</MenuItem>
                  {user?.role === 'root' ? (
                    <MenuItem value="all">{t('notificationManagement.targetAll')}</MenuItem>
                  ) : null}
                </Select>
              </FormControl>
            </Grid>
            {sendForm.target_type === 'user' ? (
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('notificationManagement.targetUserId')}
                  value={sendForm.target_id}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, target_id: e.target.value }))}
                />
              </Grid>
            ) : null}
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                size="small"
                label={t('notificationManagement.sendTitle')}
                value={sendForm.title}
                onChange={(e) => setSendForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                size="small"
                label={t('notificationManagement.sendMessage')}
                value={sendForm.message}
                onChange={(e) => setSendForm((prev) => ({ ...prev, message: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={() => void handleSendNotification()}
                disabled={sending}
              >
                {sending ? t('common.loading') : t('notificationManagement.sendButton')}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderSettingsTab = () => (
    <Card sx={CARD_SX}>
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          {t('notificationManagement.channelSettings')}
        </Typography>
        <Grid container spacing={1}>
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
                    emailDigest: e.target.value as 'immediate' | 'daily' | 'weekly',
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
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
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

        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={() => void handleSaveSettings()} disabled={savingSettings}>
            {savingSettings ? t('common.loading') : t('common.save')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  const renderTemplatesTab = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() =>
            setTemplateDialog({
              mode: 'create',
              name: '',
              title: '',
              message: '',
              type: 'info',
            })
          }
        >
          {t('notificationManagement.addTemplate')}
        </Button>
      </Box>
      <Card sx={CARD_SX}>
        <TableContainer component={Paper} elevation={0}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('notificationManagement.templateName')}</TableCell>
                <TableCell>{t('notificationManagement.sendTitle')}</TableCell>
                <TableCell>{t('notificationManagement.sendType')}</TableCell>
                <TableCell align="right">{t('notificationManagement.tableActions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {t('notificationManagement.noTemplates')}
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((tpl) => (
                  <TableRow key={tpl.id} hover>
                    <TableCell>{tpl.name}</TableCell>
                    <TableCell>{tpl.title}</TableCell>
                    <TableCell>
                      <Chip size="small" label={tpl.type.toUpperCase()} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setTemplateDialog({
                            mode: 'edit',
                            id: tpl.id,
                            name: tpl.name,
                            title: tpl.title,
                            message: tpl.message,
                            type: tpl.type,
                          })
                        }
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => void handleDeleteTemplate(tpl.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {templateDialog ? (
        <Card sx={{ ...CARD_SX, mt: 2 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              {templateDialog.mode === 'create'
                ? t('notificationManagement.addTemplate')
                : t('notificationManagement.editTemplate')}
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('notificationManagement.templateName')}
                  value={templateDialog.name}
                  onChange={(e) => setTemplateDialog((prev) => prev && { ...prev, name: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('notificationManagement.sendTitle')}
                  value={templateDialog.title}
                  onChange={(e) => setTemplateDialog((prev) => prev && { ...prev, title: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('notificationManagement.sendType')}</InputLabel>
                  <Select
                    label={t('notificationManagement.sendType')}
                    value={templateDialog.type}
                    onChange={(e) =>
                      setTemplateDialog(
                        (prev) =>
                          prev && {
                            ...prev,
                            type: e.target.value as typeof templateDialog.type,
                          }
                      )
                    }
                  >
                    <MenuItem value="info">INFO</MenuItem>
                    <MenuItem value="success">SUCCESS</MenuItem>
                    <MenuItem value="warning">WARNING</MenuItem>
                    <MenuItem value="error">ERROR</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  label={t('notificationManagement.sendMessage')}
                  value={templateDialog.message}
                  onChange={(e) => setTemplateDialog((prev) => prev && { ...prev, message: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Button variant="contained" sx={{ mr: 1 }} onClick={() => void handleSaveTemplate()}>
                  {t('common.save')}
                </Button>
                <Button color="inherit" onClick={() => setTemplateDialog(null)}>
                  {t('common.cancel')}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={t('notificationManagement.title')}
        description={t('notificationManagement.description')}
      />

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 0 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            minHeight: 48,
            '& .MuiTab-root': {
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              color: 'text.secondary',
              '&.Mui-selected': { color: 'primary.main' },
            },
            '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
          }}
        >
          <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label={t('notificationManagement.tabHistory')} />
          <Tab icon={<SendIcon fontSize="small" />} iconPosition="start" label={t('notificationManagement.tabSend')} />
          <Tab icon={<SettingsIcon fontSize="small" />} iconPosition="start" label={t('notificationManagement.tabSettings')} />
          <Tab icon={<TemplateIcon fontSize="small" />} iconPosition="start" label={t('notificationManagement.tabTemplates')} />
        </Tabs>
      </Card>

      <Box sx={{ mt: 2.5 }}>
        {activeTab === 0 && renderHistoryTab()}
        {activeTab === 1 && renderSendTab()}
        {activeTab === 2 && renderSettingsTab()}
        {activeTab === 3 && renderTemplatesTab()}
      </Box>

      <NotificationDetailDialog
        open={detailOpen}
        notification={selected}
        onClose={() => {
          setDetailOpen(false);
          setSelected(null);
        }}
        onNavigate={(href) => navigate(href)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NotificationManagement;
