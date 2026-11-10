import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  ClickAwayListener,
  Grow,
  Paper,
  Popper,
  Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMenuStore } from '../../store';
import type { Menu } from '../../services/menuService';
import {
  collectMenuRoutes,
  filterNavMenus,
  findFirstRoute,
  getBestMatchingRoute,
  getMenuIcon,
  getMenuLabel,
  isMenuBranchActive,
  normalizeMenuPath,
} from './navMenu';

/** AppBar Toolbar 높이 — Header.tsx와 동일 */
const HEADER_HEIGHT_PX = 60;
const DROPDOWN_MAX_COLUMNS = 4;
/** 좌/우 가장자리 자동 스크롤 감지 비율 */
const EDGE_ZONE = 0.28;
const MAX_SCROLL_SPEED = 14;

const HeaderNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { menus, language } = useMenuStore();
  const [openId, setOpenId] = useState<number | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const anchorsRef = useRef<Map<number, HTMLElement>>(new Map());
  const scrollVelocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const navMenus = useMemo(() => filterNavMenus(menus || [], language), [menus, language]);
  const allRoutes = useMemo(() => collectMenuRoutes(navMenus), [navMenus]);
  const bestRoute = useMemo(
    () => getBestMatchingRoute(allRoutes, location.pathname),
    [allRoutes, location.pathname]
  );

  const closeMenu = useCallback(() => setOpenId(null), []);

  const stopAutoScroll = useCallback(() => {
    scrollVelocityRef.current = 0;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      const el = navRef.current;
      const velocity = scrollVelocityRef.current;
      if (!el || velocity === 0) {
        rafRef.current = null;
        return;
      }
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) {
        scrollVelocityRef.current = 0;
        rafRef.current = null;
        return;
      }
      const next = Math.min(maxScroll, Math.max(0, el.scrollLeft + velocity));
      el.scrollLeft = next;
      if ((velocity < 0 && next <= 0) || (velocity > 0 && next >= maxScroll)) {
        scrollVelocityRef.current = 0;
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const onMove = (event: MouseEvent) => {
      const el = navRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) {
        scrollVelocityRef.current = 0;
        return;
      }
      const rect = el.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1);
      let velocity = 0;
      if (ratio < EDGE_ZONE) {
        const intensity = (EDGE_ZONE - ratio) / EDGE_ZONE;
        velocity = -MAX_SCROLL_SPEED * intensity * intensity;
      } else if (ratio > 1 - EDGE_ZONE) {
        const intensity = (ratio - (1 - EDGE_ZONE)) / EDGE_ZONE;
        velocity = MAX_SCROLL_SPEED * intensity * intensity;
      }
      scrollVelocityRef.current = velocity;
      if (velocity !== 0 && rafRef.current == null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const el = navRef.current;
    if (!el) return undefined;
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', stopAutoScroll);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', stopAutoScroll);
      stopAutoScroll();
    };
  }, [stopAutoScroll, navMenus.length]);

  useEffect(() => {
    closeMenu();
  }, [location.pathname, closeMenu]);

  useEffect(() => {
    const activeTop = navMenus.find((menu) =>
      isMenuBranchActive(menu, location.pathname, navMenus)
    );
    if (!activeTop) return;
    const el = anchorsRef.current.get(activeTop.id);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [location.pathname, navMenus]);

  useEffect(() => {
    if (openId === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openId, closeMenu]);

  const goTo = useCallback(
    (route?: string) => {
      if (!route) return;
      navigate(route);
      closeMenu();
    },
    [navigate, closeMenu]
  );

  const isLeafActive = useCallback(
    (menu: Menu) => {
      const normalized = normalizeMenuPath(menu.route || '');
      return !!normalized && bestRoute === normalized;
    },
    [bestRoute]
  );

  const handleTopClick = (menu: Menu) => {
    if (menu.children?.length) {
      setOpenId((prev) => (prev === menu.id ? null : menu.id));
      return;
    }
    goTo(findFirstRoute(menu));
  };

  const handleTopHover = (menu: Menu) => {
    if (openId === null) return;
    setOpenId(menu.children?.length ? menu.id : null);
  };

  const handleClickAway = (event: MouseEvent | TouchEvent) => {
    if (navRef.current?.contains(event.target as Node)) return;
    closeMenu();
  };

  const openMenu = useMemo(
    () => navMenus.find((menu) => menu.id === openId) || null,
    [navMenus, openId]
  );

  const renderLeaf = (menu: Menu, indented = false) => {
    const active = isLeafActive(menu);
    return (
      <Box
        key={menu.id}
        component="button"
        type="button"
        onClick={() => goTo(menu.route)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          width: '100%',
          textAlign: 'left',
          border: 'none',
          cursor: 'pointer',
          font: 'inherit',
          borderRadius: '4px',
          px: 1.25,
          py: 0.75,
          pl: indented ? 2 : 1.25,
          color: active ? '#1D4E7C' : '#475569',
          fontSize: '0.8125rem',
          fontWeight: active ? 600 : 400,
          lineHeight: 1.4,
          bgcolor: active ? '#EFF3F8' : 'transparent',
          '&:hover': {
            bgcolor: '#F8FAFC',
            color: '#1D4E7C',
          },
        }}
      >
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            flexShrink: 0,
            color: 'inherit',
            opacity: active ? 1 : 0.7,
            '& .MuiSvgIcon-root': { fontSize: '1rem' },
          }}
        >
          {getMenuIcon(menu)}
        </Box>
        <Box
          component="span"
          sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {getMenuLabel(menu, language)}
        </Box>
      </Box>
    );
  };

  const renderGroup = (menu: Menu) => {
    if (!menu.children?.length) return renderLeaf(menu);
    return (
      <Box key={menu.id} sx={{ minWidth: 0, mb: 0.75 }}>
        <Typography
          component={menu.route ? 'button' : 'div'}
          type={menu.route ? 'button' : undefined}
          onClick={menu.route ? () => goTo(menu.route) : undefined}
          sx={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            border: 'none',
            background: 'none',
            p: 0,
            px: 1.25,
            mb: 0.4,
            mt: 0.25,
            font: 'inherit',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#0F172A',
            cursor: menu.route ? 'pointer' : 'default',
            ...(menu.route ? { '&:hover': { color: '#1D4E7C' } } : {}),
          }}
        >
          {getMenuLabel(menu, language)}
        </Typography>
        {menu.children.map((child) => renderLeaf(child, true))}
      </Box>
    );
  };

  const renderDropdown = (menu: Menu) => {
    const children = menu.children || [];
    const hasGroups = children.some((child) => child.children?.length);

    if (!hasGroups) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.15, minWidth: 196, p: 0.5 }}>
          {children.map((child) => renderLeaf(child))}
        </Box>
      );
    }

    const columns = Math.min(children.length, DROPDOWN_MAX_COLUMNS);
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(160px, 1fr))`,
          gap: 1,
          alignItems: 'start',
          p: 0.75,
        }}
      >
        {children.map((child) => renderGroup(child))}
      </Box>
    );
  };

  if (navMenus.length === 0) return null;

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box
        ref={navRef}
        component="nav"
        aria-label={language === 'en' ? 'Main navigation' : '주 메뉴'}
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          alignSelf: 'stretch',
          gap: 0.25,
          minWidth: 0,
          flexShrink: 1,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {navMenus.map((menu) => {
          const active = isMenuBranchActive(menu, location.pathname, navMenus);
          const isOpen = openId === menu.id;
          const hasChildren = Boolean(menu.children?.length);
          const selected = active || isOpen;

          return (
            <Button
              key={menu.id}
              disableRipple
              ref={(node: HTMLButtonElement | null) => {
                if (node) anchorsRef.current.set(menu.id, node);
                else anchorsRef.current.delete(menu.id);
              }}
              onClick={() => handleTopClick(menu)}
              onMouseEnter={() => handleTopHover(menu)}
              aria-haspopup={hasChildren ? 'true' : undefined}
              aria-expanded={hasChildren ? isOpen : undefined}
              aria-current={active ? 'page' : undefined}
              endIcon={
                hasChildren ? (
                  <ExpandMore
                    sx={{
                      fontSize: '0.875rem !important',
                      color: selected ? '#1D4E7C' : '#94A3B8',
                      transition: 'transform 0.12s ease',
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                    }}
                  />
                ) : undefined
              }
              sx={{
                position: 'relative',
                flexShrink: 0,
                alignSelf: 'stretch',
                px: 1.5,
                py: 0,
                minHeight: '100%',
                minWidth: 'auto',
                textTransform: 'none',
                fontSize: '0.8125rem',
                fontWeight: selected ? 600 : 500,
                letterSpacing: 0,
                whiteSpace: 'nowrap',
                borderRadius: 0,
                color: selected ? '#1D4E7C' : '#475569',
                bgcolor: 'transparent',
                boxShadow: 'none',
                '& .MuiButton-endIcon': { ml: 0.25, mr: 0 },
                '&:hover': {
                  bgcolor: 'transparent',
                  color: '#1D4E7C',
                  '& .MuiButton-endIcon .MuiSvgIcon-root': { color: '#1D4E7C' },
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  left: 12,
                  right: 12,
                  bottom: 0,
                  height: selected ? 2 : 0,
                  bgcolor: '#1D4E7C',
                },
              }}
            >
              {getMenuLabel(menu, language)}
            </Button>
          );
        })}

        <Popper
          open={Boolean(openMenu)}
          anchorEl={openId !== null ? anchorsRef.current.get(openId) ?? null : null}
          placement="bottom-start"
          transition
          modifiers={[
            { name: 'offset', options: { offset: [0, 0] } },
            { name: 'preventOverflow', options: { padding: 12 } },
          ]}
          sx={{ zIndex: (theme) => theme.zIndex.modal }}
        >
          {({ TransitionProps }) => (
            <Grow {...TransitionProps} timeout={100} style={{ transformOrigin: 'top left' }}>
              <Paper
                elevation={0}
                sx={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
                  maxWidth: 'min(920px, calc(100vw - 24px))',
                  maxHeight: `calc(100vh - ${HEADER_HEIGHT_PX + 24}px)`,
                  overflowY: 'auto',
                  mt: 0.5,
                }}
              >
                {openMenu ? renderDropdown(openMenu) : null}
              </Paper>
            </Grow>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default HeaderNav;
