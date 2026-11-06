import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Collapse,
  Drawer,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import { prefetchRoute } from '../Common/LazyPage';
import { useTranslation } from 'react-i18next';
import { useMenuStore } from '../../store';
import type { Menu } from '../../services/menuService';
import {
  collectMenuRoutes,
  filterNavMenus,
  getBestMatchingRoute,
  getMenuIcon,
  getMenuLabel,
  isMenuBranchActive,
  normalizeMenuPath,
} from './navMenu';

/** AppBar Toolbar 높이 — Header.tsx와 동일 */
const HEADER_HEIGHT_PX = 60;

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
}

const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { menus, language, loading, error } = useMenuStore();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const navMenus = useMemo(() => filterNavMenus(menus || [], language), [menus, language]);
  const allRoutes = useMemo(() => collectMenuRoutes(navMenus), [navMenus]);
  const bestRoute = useMemo(
    () => getBestMatchingRoute(allRoutes, location.pathname),
    [allRoutes, location.pathname]
  );

  /** 현재 경로가 속한 가지는 열어둔다 */
  useEffect(() => {
    if (!open) return;
    const next = new Set<number>();
    const walk = (items: Menu[]) => {
      for (const menu of items) {
        if (menu.children?.length && isMenuBranchActive(menu, location.pathname, navMenus)) {
          next.add(menu.id);
          walk(menu.children);
        }
      }
    };
    walk(navMenus);
    setExpandedIds(next);
  }, [open, navMenus, location.pathname]);

  const toggle = (menuId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  };

  const handleClick = (menu: Menu) => {
    if (menu.children?.length) {
      toggle(menu.id);
      return;
    }
    if (!menu.route) return;
    navigate(menu.route);
    onClose();
  };

  const renderItem = (menu: Menu, level = 0) => {
    const hasChildren = Boolean(menu.children?.length);
    const isExpanded = expandedIds.has(menu.id);
    const normalized = normalizeMenuPath(menu.route || '');
    const active = hasChildren
      ? isMenuBranchActive(menu, location.pathname, navMenus)
      : !!normalized && bestRoute === normalized;

    return (
      <React.Fragment key={menu.id}>
        <ListItem disablePadding sx={{ mb: 0.15 }}>
          <ListItemButton
            onMouseEnter={() => prefetchRoute(menu.route)}
            onFocus={() => prefetchRoute(menu.route)}
            onClick={() => handleClick(menu)}
            sx={{
              mx: 1,
              pl: 1.25 + level * 1.5,
              pr: 1,
              py: level === 0 ? 0.8 : 0.55,
              minHeight: level === 0 ? 40 : 34,
              borderRadius: '10px',
              color: active ? 'primary.main' : level === 0 ? 'text.primary' : 'text.secondary',
              bgcolor: active
                ? (theme) => alpha(theme.palette.primary.main, 0.1)
                : 'transparent',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.07),
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: level === 0 ? 28 : 24,
                color: 'inherit',
                opacity: active ? 1 : 0.75,
                '& .MuiSvgIcon-root': { fontSize: level === 0 ? '1.05rem' : '0.95rem' },
              }}
            >
              {getMenuIcon(menu)}
            </ListItemIcon>
            <ListItemText
              primary={getMenuLabel(menu, language)}
              primaryTypographyProps={{ component: 'span' }}
              sx={{
                my: 0,
                minWidth: 0,
                '& .MuiListItemText-primary': {
                  fontSize: level === 0 ? '13.5px' : '13px',
                  fontWeight: active ? 600 : level === 0 ? 500 : 400,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }}
            />
            {hasChildren ? (
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  color: isExpanded ? 'primary.main' : 'text.disabled',
                  '& .MuiSvgIcon-root': { fontSize: '1.05rem' },
                }}
              >
                {isExpanded ? <ExpandLess fontSize="inherit" /> : <ExpandMore fontSize="inherit" />}
              </Box>
            ) : null}
          </ListItemButton>
        </ListItem>

        {hasChildren ? (
          <Collapse in={isExpanded} timeout={160} unmountOnExit>
            <List component="div" disablePadding sx={{ mb: 0.4 }}>
              {menu.children!.map((child) => renderItem(child, level + 1))}
            </List>
          </Collapse>
        ) : null}
      </React.Fragment>
    );
  };

  return (
    <Drawer
      variant="temporary"
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        '& .MuiDrawer-paper': {
          width: 288,
          maxWidth: '85vw',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          top: `${HEADER_HEIGHT_PX}px`,
          height: `calc(100vh - ${HEADER_HEIGHT_PX}px)`,
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid',
          borderColor: 'divider',
          borderRadius: 0,
          overflowX: 'hidden',
        },
      }}
    >
      {loading ? (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2">{language === 'en' ? 'Loading menus…' : '메뉴 로딩 중…'}</Typography>
        </Box>
      ) : error ? (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, overflowY: 'auto', pt: 0.75, pb: 1 }}>
          <List sx={{ p: 0 }}>{navMenus.map((menu) => renderItem(menu))}</List>
        </Box>
      )}

      <Box
        sx={{
          mt: 'auto',
          px: 1.5,
          py: 1.25,
          textAlign: 'center',
          flexShrink: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 0.5,
            mb: 0.35,
          }}
        >
          {[
            { to: '/legal/terms', label: t('login.footerTerms') },
            { to: '/legal/privacy', label: t('login.footerPrivacy') },
            { to: '/legal/support', label: t('login.footerSupport') },
          ].map((item, index) => (
            <React.Fragment key={item.to}>
              {index > 0 && (
                <Typography
                  component="span"
                  sx={{ fontSize: '0.625rem', color: 'text.secondary', opacity: 0.55, lineHeight: 1 }}
                >
                  ·
                </Typography>
              )}
              <Typography
                component={RouterLink}
                to={item.to}
                onClick={onClose}
                sx={{
                  fontSize: '0.625rem',
                  fontWeight: 500,
                  color: 'text.secondary',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                  '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                }}
              >
                {item.label}
              </Typography>
            </React.Fragment>
          ))}
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '0.6875rem', letterSpacing: '0.02em', opacity: 0.5, display: 'block' }}
        >
          © {new Date().getFullYear()}{' '}
          <Link
            href="https://www.msventures.in"
            target="_blank"
            rel="noopener noreferrer"
            underline="none"
            color="inherit"
            sx={{ fontSize: 'inherit', '&:hover': { color: 'primary.main' } }}
          >
            Minsub Ventures
          </Link>
        </Typography>
      </Box>
    </Drawer>
  );
};

export default MobileNavDrawer;
