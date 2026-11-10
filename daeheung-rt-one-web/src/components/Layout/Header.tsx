import React, { useState, useEffect, useMemo } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Button
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Business as BusinessIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  Language as LanguageIcon,
  Check as CheckIcon,
  DeleteSweep as DeleteSweepIcon,
  Menu as MenuIcon,
  OpenInNew as OpenInNewIcon,
  AccessTime as AccessTimeIcon,
  ExpandMore as ExpandMoreIcon,
  Inbox as InboxIcon,
  Download as DownloadIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material';
import { useStore, useMenuStore } from '../../store';
import { api, userUiPreferencesService, userService, companyCalendarScheduleService } from '../../services/api';
import { resolveHeaderCompanyInfo } from '../../store/referenceDataStore';
import { useTranslation } from 'react-i18next';
import { ensureI18nLanguage } from '../../locales/i18n';
import { useErrorStore } from '../../store/errorStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useNavigate, useLocation } from 'react-router-dom';
import FullMenuOverlay from './FullMenuOverlay';
import HeaderNav from './HeaderNav';
import AuthMedia from '../Common/AuthMedia';
import NotificationDetailDialog from '../Notifications/NotificationDetailDialog';
import {
  ActionInboxRow,
  AppNotification,
  buildNotificationsFromSources,
  getNotificationChipColor,
  getNotificationChipLabel,
  ServerNotificationItem } from '../../utils/notificationFeed';
import { useNotificationFeed } from '../../hooks/useNotificationFeed';
import { useBrowserDesktopNotifications } from '../../hooks/useBrowserDesktopNotifications';
import { getUploadUrl } from '../../utils/uploadUrl';

interface CalendarScheduleItem {
  id: string;
  title: string;
  type: 'normal' | 'company_holiday';
}

interface HeaderProps {
  showMobileNav?: boolean;
  mobileNavOpen?: boolean;
  onMobileNavToggle?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  showMobileNav = false,
  mobileNavOpen = false,
  onMobileNavToggle }) => {
  const { user, logout, updateUser } = useStore();
  const { language, setLanguage } = useMenuStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktopNotifierRoute = location.pathname.startsWith('/communication/desktop-notifier');
  const isNoticesRoute =
    location.pathname.startsWith('/my/notices') ||
    location.pathname.startsWith('/communication/notice');
  const userAvatarSrc = getUploadUrl(user?.avatar_url) || undefined;
  const { errors, notifications } = useErrorStore();
  const {
    items: notificationItems,
    headerDismissedIds,
    mergeFromSources,
    markRead,
    markAllRead,
    dismissAllFromHeader } = useNotificationStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [languageAnchorEl, setLanguageAnchorEl] = useState<null | HTMLElement>(null);
  const [updatesAnchorEl, setUpdatesAnchorEl] = useState<null | HTMLElement>(null);
  const [fullMenuOpen, setFullMenuOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [inboxActions, setInboxActions] = useState<ActionInboxRow[]>([]);
  const [serverNotifications, setServerNotifications] = useState<ServerNotificationItem[]>([]);
  const [companyInfo, setCompanyInfo] = useState<{
    name: string;
    logo: string;
  } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const headerClockLabel = useMemo(() => {
    const locale = language === 'en' ? 'en-IN' : 'ko-KR';
    return now.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata' });
  }, [now, language]);

  useEffect(() => {
    if (!user) {
      setCompanyInfo(null);
      return;
    }
    let cancelled = false;
    resolveHeaderCompanyInfo(user).then((info) => {
      if (!cancelled) setCompanyInfo(info);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.company_id, user?.id]);

  /** 기존 세션에도 프로필 사진이 반영되도록 avatar_url을 보강 */
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    userService
      .getMyProfile()
      .then((response) => {
        if (cancelled || !response?.success || !response.data) return;
        const nextAvatar = response.data.avatar_url ?? null;
        if ((user.avatar_url || null) !== nextAvatar) {
          updateUser({ avatar_url: nextAvatar });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, updateUser]);

  const cleanCompanyName = (name: string) => {
    if (!name) return '';
    return name
      .replace(/\s+(Private Limited|Pvt Ltd|LLP|Ltd|Inc|Corp|Corporation|Company|Co\.|Limited)$/gi, '')
      .trim() || '';
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleClose();
    try {
      await api.post(
        '/auth/logout',
        {},
        { headers: { 'x-skip-error-popup': 'true', 'x-skip-session-refresh': 'true' } }
      );
    } catch {
      /* 서버 무효화 실패해도 클라이언트 로그아웃은 진행 */
    }
    logout();
    window.location.href = '/login';
  };

  const handleOpenSettings = () => {
    navigate('/account/settings');
    handleClose();
  };

  const handleLanguageMenu = (event: React.MouseEvent<HTMLElement>) => {
    setLanguageAnchorEl(event.currentTarget);
  };

  const handleLanguageClose = () => {
    setLanguageAnchorEl(null);
  };

  const handleLanguageChange = (lang: 'ko' | 'en') => {
    setLanguage(lang);
    void ensureI18nLanguage(lang);
    userUiPreferencesService.patch({ language: lang }).catch(() => {});
    handleLanguageClose();
  };

  // 컴포넌트 마운트 시 i18n 언어 동기화
  useEffect(() => {
    void ensureI18nLanguage(language);
  }, [language]);

  useEffect(() => {
    if (!user?.id) {
      setServerNotifications([]);
      setInboxActions([]);
      return;
    }
  }, [user?.id]);

  useNotificationFeed({
    userId: user?.id,
    onServerNotifications: setServerNotifications,
    onInboxActions: setInboxActions });

  useBrowserDesktopNotifications(user?.id);

  useEffect(() => {
    const merged = buildNotificationsFromSources({
      serverNotifications,
      clientNotifications: notifications,
      errors,
      inboxActions,
      t });
    mergeFromSources(merged);
  }, [errors, notifications, serverNotifications, inboxActions, t, mergeFromSources]);

  useEffect(() => {
    if (!user?.id) return;

    const toDateKey = (date: Date) => (
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    );

    const checkCompanyHolidayReminder = async () => {
      try {
        const prefs = await userUiPreferencesService.get();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const todayKey = toDateKey(today);
        const tomorrowKey = toDateKey(tomorrow);

        let companyHolidays: Array<{ title?: string }> = [];
        try {
          const res = await companyCalendarScheduleService.list({
            from: tomorrowKey,
            to: tomorrowKey,
          });
          const rows = Array.isArray(res?.data) ? res.data : [];
          companyHolidays = rows.filter((item: any) => item?.isHoliday);
        } catch {
          const parsed = prefs.calendarSchedules || {};
          const tomorrowSchedules = Array.isArray((parsed as Record<string, unknown>)[tomorrowKey])
            ? ((parsed as Record<string, unknown>)[tomorrowKey] as CalendarScheduleItem[])
            : [];
          companyHolidays = tomorrowSchedules.filter((item) => item?.type === 'company_holiday');
        }

        if (companyHolidays.length === 0) return;

        const shownMap = prefs.companyHolidayReminderShown || {};
        if (shownMap[tomorrowKey] === todayKey) return;

        const titles = Array.from(
          new Set(
            companyHolidays
              .map((item) => item.title?.trim())
              .filter((title): title is string => Boolean(title))
          )
        );

        const fallbackTitle = language === 'en' ? 'Company Holiday' : '회사 휴일';
        const visibleTitles = titles.length > 0 ? titles : [fallbackTitle];
        const maxVisible = 2;
        const titleText = visibleTitles.slice(0, maxVisible).join(', ');
        const extraCount = visibleTitles.length - maxVisible;

        const message = language === 'en'
          ? `Reminder: Company holiday is tomorrow (${titleText}${extraCount > 0 ? ` +${extraCount}` : ''}).`
          : `알림: 내일 회사 휴일입니다 (${titleText}${extraCount > 0 ? ` 외 ${extraCount}건` : ''}).`;

        useErrorStore.getState().showNotification(message, 'warning');
        await userUiPreferencesService.patch({
          companyHolidayReminderShown: {
            ...shownMap,
            [tomorrowKey]: todayKey
          }
        });
      } catch {
      /* ignore */
    }
    };

    checkCompanyHolidayReminder();
    const intervalId = window.setInterval(() => {
      void checkCompanyHolidayReminder();
    }, 10 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user?.id, language]);

  const displayNotificationFeed = useMemo(
    () => {
      const dismissed = new Set(headerDismissedIds);
      return notificationItems.filter((item) => !dismissed.has(item.id)).slice(0, 40);
    },
    [notificationItems, headerDismissedIds]
  );

  const unreadCount = useMemo(
    () => displayNotificationFeed.filter((item) => !item.read).length,
    [displayNotificationFeed]
  );

  const handleUpdatesMenu = (event: React.MouseEvent<HTMLElement>) => {
    setUpdatesAnchorEl(event.currentTarget);
  };

  const handleUpdatesClose = () => {
    setUpdatesAnchorEl(null);
  };

  const handleOpenNotificationDetail = (item: AppNotification) => {
    setSelectedNotification(item);
    setDetailDialogOpen(true);
    markRead(item.id);
    handleUpdatesClose();
  };

  const handleOpenNotificationsPage = () => {
    navigate('/notifications');
    handleUpdatesClose();
  };

  const handleClearNotificationFeed = () => {
    dismissAllFromHeader();
    handleUpdatesClose();
  };

  const isUpdatesActive =
    isDesktopNotifierRoute ||
    isNoticesRoute ||
    location.pathname.startsWith('/notifications');

  return (
    <AppBar 
      position="fixed" 
      elevation={0}
      sx={{ 
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        backgroundColor: '#FFFFFF',
        backgroundImage: 'none',
        backdropFilter: 'none',
        border: 'none',
        borderBottom: '1px solid #E2E8F0',
        borderRadius: 0,
        boxShadow: 'none',
        outline: 'none',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        '&::after': {
          display: 'none'
        }
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: '56px !important', sm: '60px !important' },
          px: { xs: 1.5, sm: 2.5 },
          gap: 0,
          borderBottom: 'none !important',
          boxShadow: 'none !important',
          '&::before, &::after': {
            display: 'none !important',
            content: 'none'
          }
        }}
      >
        {showMobileNav ? (
          <IconButton
            edge="start"
            color="inherit"
            aria-label={mobileNavOpen ? (language === 'en' ? 'Close menu' : '메뉴 닫기') : (language === 'en' ? 'Open menu' : '메뉴 열기')}
            onClick={onMobileNavToggle}
            sx={{
              mr: 0.5,
              color: 'text.primary',
              borderRadius: '4px',
              '&:hover': { bgcolor: 'action.hover' } }}
          >
            <MenuIcon />
          </IconButton>
        ) : null}

        {/* 브랜드(로고) 영역 */}
        {companyInfo && (
          <Tooltip title={language === 'en' ? 'Go to dashboard' : '대시보드로 이동'}>
            <Box
              component="button"
              type="button"
              onClick={() => navigate('/dashboard')}
              aria-label={language === 'en' ? 'Go to dashboard' : '대시보드로 이동'}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                flexShrink: 0,
                border: 'none',
                background: 'none',
                p: 0,
                m: 0,
                pr: { xs: 1.5, sm: 2 },
                height: 40,
                textAlign: 'left',
                cursor: 'pointer',
                '&:hover .header-brand-name': {
                  color: 'primary.main',
                },
              }}
            >
            {companyInfo.logo ? (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  background: 'transparent',
                }}
              >
                <AuthMedia
                  src={companyInfo.logo}
                  alt={t('common.companyNameFallback')}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'primary.main',
                }}
              >
                <BusinessIcon sx={{ color: 'white', fontSize: '1.25rem' }} />
              </Box>
            )}
            <Typography
              className="header-brand-name"
              variant="h6"
              component="div"
              sx={{
                fontWeight: 700,
                color: '#0F172A',
                fontSize: { xs: '0.9375rem', sm: '1rem' },
                letterSpacing: '-0.015em',
                lineHeight: 1.2,
                display: { xs: 'none', sm: 'block' },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: { sm: 160, md: 200 },
                transition: 'color 0.12s ease',
              }}
            >
              {cleanCompanyName(companyInfo.name) || t('common.companyNameFallback')}
            </Typography>
            </Box>
          </Tooltip>
        )}

        {/* 로고 | 메뉴 구분 */}
        {!showMobileNav && companyInfo ? (
          <Box
            aria-hidden
            sx={{
              width: '1px',
              alignSelf: 'stretch',
              my: 1.25,
              flexShrink: 0,
              bgcolor: '#CBD5E1',
              mr: { sm: 1.5, md: 2 },
            }}
          />
        ) : null}

        {/* 주 메뉴 */}
        {!showMobileNav ? (
          <Box sx={{ minWidth: 0, flex: '1 1 auto', display: 'flex', alignItems: 'stretch', alignSelf: 'stretch', overflow: 'hidden' }}>
            <HeaderNav />
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, minWidth: 8 }} />
        )}
        
        {/* 유틸 · 계정 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            gap: { xs: 0.25, sm: 0.75 },
            pl: { sm: 1.25 },
            borderLeft: { sm: '1px solid #E2E8F0' },
            ml: { sm: 1 },
          }}
        >
          {/* 알림 프로그램 · 알림을 하나의 드롭다운으로 */}
          <Button
            variant="text"
            size="small"
            onClick={handleUpdatesMenu}
            aria-label={language === 'en' ? 'Notifications' : '알람'}
            aria-controls={Boolean(updatesAnchorEl) ? 'updates-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={Boolean(updatesAnchorEl) ? 'true' : undefined}
            endIcon={
              <ExpandMoreIcon
                sx={{
                  fontSize: '1rem !important',
                  transition: 'transform 0.16s ease',
                  transform: Boolean(updatesAnchorEl) ? 'rotate(180deg)' : 'none',
                }}
              />
            }
            sx={{
              minWidth: 'auto',
              px: 0.85,
              py: 0.5,
              textTransform: 'none',
              fontSize: '0.8125rem',
              fontWeight: isUpdatesActive || Boolean(updatesAnchorEl) ? 600 : 500,
              color: isUpdatesActive || Boolean(updatesAnchorEl) ? 'primary.main' : 'text.secondary',
              borderRadius: 0,
              '& .MuiButton-endIcon': { ml: 0.15 },
              '&:hover': {
                bgcolor: 'transparent',
                color: 'primary.main',
              },
            }}
          >
            <Badge
              badgeContent={unreadCount}
              invisible={unreadCount === 0}
              sx={{
                '& .MuiBadge-badge': {
                  bgcolor: 'rgba(220, 80, 80, 0.92)',
                  color: 'white',
                  fontSize: '0.625rem',
                  fontWeight: 500,
                  minWidth: '16px',
                  height: '16px',
                  top: -2,
                  right: -6,
                },
              }}
            >
              <Box
                component="span"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', pr: unreadCount > 0 ? 0.75 : 0 }}
              >
                <InboxIcon sx={{ fontSize: '1.05rem' }} />
                {language === 'en' ? 'Notifications' : '알람'}
              </Box>
            </Badge>
          </Button>

          {/* 언어 전환 버튼 */}
          <IconButton
            size="small"
            onClick={handleLanguageMenu}
            sx={{
              color: 'text.secondary',
              transition: 'background-color 0.15s ease, color 0.15s ease',
              '&:hover': {
                bgcolor: 'action.hover',
                color: 'text.primary',
              },
            }}
          >
            <LanguageIcon sx={{ fontSize: '1.125rem' }} />
          </IconButton>
          
          {/* 이름 + 아바타 — 클릭 시 설정/로그아웃 메뉴 */}
          <Box
            component="button"
            type="button"
            aria-label={language === 'en' ? 'Account menu' : '계정 메뉴'}
            aria-controls={Boolean(anchorEl) ? 'menu-appbar' : undefined}
            aria-haspopup="true"
            aria-expanded={Boolean(anchorEl) ? 'true' : undefined}
            onClick={handleMenu}
            data-no-photo-preview
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mr: 0.25,
              ml: 0.25,
              py: 0.25,
              pl: 0.75,
              pr: 0.25,
              border: 'none',
              borderRadius: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
              font: 'inherit',
              color: 'inherit',
              transition: 'background-color 0.12s ease',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                color: 'text.primary',
                fontSize: '0.8125rem',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.username || '사용자'}
            </Typography>
            <Avatar
              src={userAvatarSrc}
              alt={user?.username || 'user'}
              data-no-photo-preview
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'primary.main',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                '&:hover': { cursor: 'pointer' },
                '& img': { objectFit: 'cover', cursor: 'pointer', pointerEvents: 'none' },
              }}
            >
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
          </Box>

          {!showMobileNav ? (
          <Tooltip title={language === 'en' ? 'All menus' : '전체 메뉴'}>
            <IconButton
              size="small"
              aria-label={language === 'en' ? 'Open full menu' : '전체 메뉴 열기'}
              aria-expanded={fullMenuOpen}
              onClick={() => setFullMenuOpen((prev) => !prev)}
              sx={{
                width: 34,
                height: 34,
                ml: 0.5,
                borderRadius: '4px',
                bgcolor: fullMenuOpen ? 'primary.main' : '#1D4E7C',
                color: '#FFFFFF',
                transition: 'background-color 0.12s ease',
                '&:hover': {
                  bgcolor: fullMenuOpen ? 'primary.dark' : '#163E63',
                },
              }}
            >
              <MenuIcon sx={{ fontSize: '1.125rem' }} />
            </IconButton>
          </Tooltip>
          ) : null}
          
          <Menu
            id="updates-menu"
            anchorEl={updatesAnchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(updatesAnchorEl)}
            onClose={handleUpdatesClose}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 340,
                maxWidth: 420,
                maxHeight: 480,
                overflowY: 'auto',
                p: 0.5,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
              },
            }}
          >
            <Box
              sx={{
                px: 1.5,
                py: 1,
                mx: 0.5,
                mb: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                bgcolor: '#F8FAFC',
                borderRadius: '6px',
              }}
              aria-label={language === 'en' ? 'India Time (IST)' : '인도 시간 (IST)'}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                {language === 'en' ? 'India Time (IST)' : '인도 시간 (IST)'}
              </Typography>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'text.primary' }}>
                <AccessTimeIcon sx={{ fontSize: '0.95rem', color: 'text.secondary' }} />
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.02em',
                  }}
                >
                  {headerClockLabel}
                </Typography>
              </Box>
            </Box>

            <MenuItem
              onClick={() => {
                navigate('/communication/desktop-notifier');
                handleUpdatesClose();
              }}
              selected={isDesktopNotifierRoute}
              sx={{ borderRadius: '8px', mx: 0.5, my: 0.25, py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <DownloadIcon
                  fontSize="small"
                  color={isDesktopNotifierRoute ? 'primary' : 'inherit'}
                />
              </ListItemIcon>
              <ListItemText
                primary={language === 'en' ? 'Desktop Notifier' : '알림 프로그램'}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: isDesktopNotifierRoute ? 600 : 500,
                }}
              />
            </MenuItem>
            <MenuItem
              onClick={handleOpenNotificationsPage}
              selected={location.pathname.startsWith('/notifications')}
              sx={{ borderRadius: '8px', mx: 0.5, my: 0.25, py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Badge
                  badgeContent={unreadCount}
                  invisible={unreadCount === 0}
                  sx={{
                    '& .MuiBadge-badge': {
                      bgcolor: 'rgba(220, 80, 80, 0.92)',
                      color: 'white',
                      fontSize: '0.55rem',
                      minWidth: 14,
                      height: 14,
                    },
                  }}
                >
                  <NotificationsIcon
                    fontSize="small"
                    color={location.pathname.startsWith('/notifications') ? 'primary' : 'inherit'}
                  />
                </Badge>
              </ListItemIcon>
              <ListItemText
                primary={language === 'en' ? 'Notifications' : '알림'}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: location.pathname.startsWith('/notifications') ? 600 : 500,
                }}
              />
            </MenuItem>
            <MenuItem
              onClick={() => {
                navigate('/my/notices');
                handleUpdatesClose();
              }}
              selected={isNoticesRoute}
              sx={{ borderRadius: '8px', mx: 0.5, my: 0.25, py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CampaignIcon fontSize="small" color={isNoticesRoute ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary={language === 'en' ? 'Notices' : '공지사항'}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: isNoticesRoute ? 600 : 500,
                }}
              />
            </MenuItem>

            <Divider sx={{ my: 0.75 }} />

            <Box sx={{ px: 1.25, py: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.04em' }}>
                {language === 'en' ? 'RECENT' : '최근 알림'}
              </Typography>
              <Tooltip title={t('notifications.markAllAsRead')}>
                <IconButton size="small" onClick={markAllRead}>
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            {displayNotificationFeed.length === 0 ? (
              <Box sx={{ px: 2, py: 2.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {language === 'en' ? 'No notifications yet.' : '새 알림이 없습니다.'}
                </Typography>
              </Box>
            ) : (
              displayNotificationFeed.map((item) => (
                <MenuItem
                  key={item.id}
                  onClick={() => handleOpenNotificationDetail(item)}
                  sx={{
                    alignItems: 'flex-start',
                    whiteSpace: 'normal',
                    py: 1.1,
                    px: 1.1,
                    mx: 0.75,
                    my: 0.6,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: item.read
                      ? (theme) => theme.palette.divider
                      : (theme) =>
                          theme.palette.mode === 'light'
                            ? 'rgba(25, 118, 210, 0.22)'
                            : 'rgba(144, 202, 249, 0.35)',
                    bgcolor: item.read
                      ? 'background.paper'
                      : (theme) =>
                          theme.palette.mode === 'light'
                            ? 'rgba(25, 118, 210, 0.06)'
                            : 'rgba(144, 202, 249, 0.12)',
                    boxShadow: item.read ? 'none' : '0 2px 8px rgba(15, 23, 42, 0.06)',
                    '&:hover': {
                      bgcolor: (theme) =>
                        theme.palette.mode === 'light'
                          ? 'rgba(25, 118, 210, 0.12)'
                          : 'rgba(144, 202, 249, 0.2)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ mt: 0.25, minWidth: 72, mr: 0.5 }}>
                    <Chip
                      size="small"
                      label={getNotificationChipLabel(item, t)}
                      color={getNotificationChipColor(item)}
                      sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.625rem' } }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    secondary={
                      <Box component="span" sx={{ display: 'inline-block', mt: 0.25 }}>
                        <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.primary' }}>
                          {item.message}
                        </Typography>
                        <Typography component="span" variant="caption" color="text.secondary">
                          {new Date(item.timestamp).toLocaleString(language === 'en' ? 'en-US' : 'ko-KR')}
                        </Typography>
                      </Box>
                    }
                    primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 700 }}
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </MenuItem>
              ))
            )}
            <Divider sx={{ mt: displayNotificationFeed.length > 0 ? 0.5 : 0 }} />
            <Box sx={{ px: 1, py: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Tooltip title={t('notifications.openPage')}>
                <IconButton size="small" onClick={handleOpenNotificationsPage} color="primary">
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {displayNotificationFeed.length > 0 ? (
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<DeleteSweepIcon />}
                  onClick={handleClearNotificationFeed}
                  sx={{ fontSize: '0.75rem', textTransform: 'none' }}
                >
                  {t('notifications.clearAll')}
                </Button>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ pr: 0.5 }}>
                  {t('notifications.openPage')}
                </Typography>
              )}
            </Box>
          </Menu>

          <NotificationDetailDialog
            open={detailDialogOpen}
            notification={selectedNotification}
            onClose={() => {
              setDetailDialogOpen(false);
              setSelectedNotification(null);
            }}
            onNavigate={(href) => navigate(href)}
          />

          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right' }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right' }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 180,
                '& .MuiMenuItem-root': {
                  px: 1.5,
                  py: 0.75 }
              }
            }}
          >
            <MenuItem disabled>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                  {user?.username || '사용자'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                  {user?.role === 'root' ? 'Root' : user?.role || 'user'} • {user?.email || 'user@example.com'}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleOpenSettings} sx={{ fontSize: '0.75rem' }}>
              <SettingsIcon sx={{ mr: 1, fontSize: '0.875rem' }} />
              {t('common.settings')}
            </MenuItem>
            <MenuItem onClick={handleLogout} sx={{ fontSize: '0.75rem' }}>
              <LogoutIcon sx={{ mr: 1, fontSize: '0.875rem' }} />
              {t('common.logout')}
            </MenuItem>
          </Menu>

          {/* 언어 선택 메뉴 */}
          <Menu
            id="language-menu"
            anchorEl={languageAnchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right' }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right' }}
            open={Boolean(languageAnchorEl)}
            onClose={handleLanguageClose}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 120,
                '& .MuiMenuItem-root': {
                  px: 1.5,
                  py: 0.75 }
              }
            }}
          >
            <MenuItem 
              onClick={() => handleLanguageChange('ko')} 
              sx={{ 
                fontSize: '0.75rem',
                backgroundColor: language === 'ko' ? 'action.selected' : 'transparent',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
            >
              🇰🇷 {t('common.languageKo')}
            </MenuItem>
            <MenuItem 
              onClick={() => handleLanguageChange('en')} 
              sx={{ 
                fontSize: '0.75rem',
                backgroundColor: language === 'en' ? 'action.selected' : 'transparent',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
            >
              🇺🇸 {t('common.languageEn')}
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>

      <FullMenuOverlay
        open={fullMenuOpen}
        onClose={() => setFullMenuOpen(false)}
        onLanguageClick={handleLanguageMenu}
      />
    </AppBar>
  );
};

export default Header;
