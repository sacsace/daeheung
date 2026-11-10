import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Fade,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography
} from '@mui/material';
import {
  Close as CloseIcon,
  HomeOutlined as HomeOutlinedIcon,
  Language as LanguageIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { prefetchRoute } from '../Common/LazyPage';
import { useTranslation } from 'react-i18next';
import { useMenuStore } from '../../store';
import type { Menu } from '../../services/menuService';
import { isRemovedNavMenuRoute } from '../../utils/isRemovedNavMenuRoute';

/** AppBar Toolbar 높이 — Header.tsx 와 동일 */
const HEADER_HEIGHT_PX = 60;

interface FullMenuOverlayProps {
  open: boolean;
  onClose: () => void;
  onLanguageClick: (event: React.MouseEvent<HTMLElement>) => void;
}

const filterMenus = (items: Menu[], language: string): Menu[] =>
  items
    .filter((m) => !isRemovedNavMenuRoute(m.route))
    .filter((m) => {
      const label = language === 'ko' ? m.name_ko : m.name_en;
      return label !== '시스템관리' && label !== 'System Management';
    })
    .map((m) => {
      if (m.children?.length) {
        const children = filterMenus(m.children, language);
        return children.length ? { ...m, children } : m;
      }
      return m;
    })
    .filter((m) => m.route || (m.children && m.children.length > 0));

const getMenuLabel = (menu: Menu, language: string) => {
  if (language === 'ko' && menu.name_ko === '지출보고서') return '지출결의서';
  return language === 'ko'
    ? menu.name_ko
    : String(menu.name_en ?? '').trim() || menu.name_ko;
};

type FlatMenuItem = { id: number; label: string; route: string; trail: string };

const flattenMenus = (items: Menu[], language: string, parents: string[] = []): FlatMenuItem[] => {
  const rows: FlatMenuItem[] = [];
  for (const menu of items) {
    const label = getMenuLabel(menu, language);
    const trailParts = [...parents, label];
    if (menu.route && !isRemovedNavMenuRoute(menu.route)) {
      rows.push({
        id: menu.id,
        label,
        route: menu.route,
        trail: trailParts.join(' › '),
      });
    }
    if (menu.children?.length) {
      rows.push(...flattenMenus(menu.children, language, trailParts));
    }
  }
  return rows;
};

const FullMenuOverlay: React.FC<FullMenuOverlayProps> = ({
  open,
  onClose,
  onLanguageClick
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { menus, language } = useMenuStore();
  const [query, setQuery] = useState('');

  const menuTree = useMemo(() => filterMenus(menus || [], language), [menus, language]);
  const flatMenus = useMemo(() => flattenMenus(menuTree, language), [menuTree, language]);
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flatMenus
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) || item.trail.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [flatMenus, query]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const goTo = useCallback(
    (route?: string) => {
      if (!route) return;
      prefetchRoute(route);
      navigate(route);
      onClose();
    },
    [navigate, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && query.trim() && searchResults.length > 0) {
        e.preventDefault();
        goTo(searchResults[0].route);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, query, searchResults, goTo]);

  const renderLeafLink = (menu: Menu, indent = false) => (
    <Link
      key={menu.id}
      component="button"
      type="button"
      underline="none"
      onMouseEnter={() => prefetchRoute(menu.route)}
      onFocus={() => prefetchRoute(menu.route)}
      onClick={() => goTo(menu.route)}
      sx={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        p: 0,
        mb: 0.85,
        pl: indent ? 0.5 : 0,
        fontSize: '0.8125rem',
        lineHeight: 1.45,
        color: '#374151',
        transition: 'color 0.15s ease',
        '&:hover': { color: 'primary.main' },
      }}
    >
      {getMenuLabel(menu, language)}
    </Link>
  );

  const renderSection = (menu: Menu) => {
    const hasChildren = menu.children && menu.children.length > 0;
    if (!hasChildren) {
      return renderLeafLink(menu);
    }

    return (
      <Box key={menu.id} sx={{ mb: 2.25 }}>
        <Typography
          component="button"
          type="button"
          onClick={() => goTo(menu.route)}
          sx={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            border: 'none',
            background: 'none',
            cursor: menu.route ? 'pointer' : 'default',
            p: 0,
            mb: 1,
            fontSize: '0.8125rem',
            fontWeight: 700,
            letterSpacing: '0.01em',
            color: '#C2410C',
            transition: 'color 0.15s ease',
            ...(menu.route && {
              '&:hover': { color: 'primary.main' },
            }),
          }}
        >
          {getMenuLabel(menu, language)}
        </Typography>
        <Box sx={{ pl: 0.25 }}>
          {menu.children!.map((child) => {
            if (child.children?.length) {
              return (
                <Box key={child.id} sx={{ mb: 1.5 }}>
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#9A3412',
                      mb: 0.65,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {getMenuLabel(child, language)}
                  </Typography>
                  {child.children.map((leaf) => renderLeafLink(leaf, true))}
                </Box>
              );
            }
            return renderLeafLink(child);
          })}
        </Box>
      </Box>
    );
  };

  if (!open) return null;

  return (
    <Fade in={open} timeout={220}>
      <Box
        role="dialog"
        aria-modal="true"
        aria-label={language === 'en' ? 'Full menu' : '전체 메뉴'}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: (theme) => theme.zIndex.modal + 2,
          bgcolor: 'rgba(15, 23, 42, 0.28)',
        }}
        onClick={onClose}
      >
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: 'absolute',
            top: `${HEADER_HEIGHT_PX}px`,
            left: 0,
            right: 0,
            maxHeight: `calc(100vh - ${HEADER_HEIGHT_PX}px)`,
            bgcolor: '#FFFFFF',
            boxShadow: '0 24px 64px rgba(15, 23, 42, 0.18)',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 상단 유틸 바 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              px: { xs: 2, sm: 4 },
              py: 1.5,
              borderBottom: '1px solid #F1F5F9',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                startIcon={<HomeOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
                onClick={() => goTo('/dashboard')}
                sx={{ textTransform: 'none', fontWeight: 600, color: '#0F172A' }}
              >
                {language === 'en' ? 'Home' : '홈'}
              </Button>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#E5E7EB' }} />
              <Button
                size="small"
                onClick={() => goTo('/communication/desktop-notifier')}
                sx={{ textTransform: 'none', fontWeight: 500, color: '#4B5563' }}
              >
                {language === 'en' ? 'Desktop Notifier' : '알림 프로그램'}
              </Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton size="small" onClick={onLanguageClick} aria-label={t('common.language')}>
                <LanguageIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={onClose} aria-label={language === 'en' ? 'Close menu' : '메뉴 닫기'}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ px: { xs: 2, sm: 4 }, py: 1.25, borderBottom: '1px solid #F1F5F9' }}>
            <TextField
              fullWidth
              size="small"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={language === 'en' ? 'Search menus… (Enter to open)' : '메뉴 검색… (Enter로 이동)'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  e.preventDefault();
                  goTo(searchResults[0].route);
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: '#9CA3AF' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                maxWidth: 480,
                '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#F9FAFB' },
              }}
            />
            {query.trim() && (
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5, maxWidth: 480 }}>
                {searchResults.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    {language === 'en' ? 'No matching menus.' : '일치하는 메뉴가 없습니다.'}
                  </Typography>
                ) : (
                  searchResults.map((item) => (
                    <Button
                      key={item.id}
                      size="small"
                      onClick={() => goTo(item.route)}
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        color: '#374151',
                        fontWeight: 500,
                      }}
                    >
                      {item.trail}
                    </Button>
                  ))
                )}
              </Box>
            )}
          </Box>

          {/* 메가 메뉴 그리드 */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: { xs: 2, sm: 4, md: 5 },
              py: { xs: 2.5, sm: 3.5 },
            }}
          >
            {menuTree.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                {language === 'en' ? 'No menus available.' : '표시할 메뉴가 없습니다.'}
              </Typography>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(3, minmax(0, 1fr))',
                    lg: 'repeat(4, minmax(0, 1fr))',
                    xl: 'repeat(5, minmax(0, 1fr))',
                  },
                  gap: { xs: 3, md: 4 },
                  alignItems: 'start',
                }}
              >
                {menuTree.map((topMenu) => (
                  <Box key={topMenu.id} sx={{ minWidth: 0 }}>
                    <Typography
                      component="button"
                      type="button"
                      onClick={() => goTo(topMenu.route)}
                      sx={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        background: 'none',
                        cursor: topMenu.route ? 'pointer' : 'default',
                        p: 0,
                        mb: 2,
                        fontSize: '0.9375rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: '#0F172A',
                        transition: 'color 0.15s ease',
                        ...(topMenu.route && {
                          '&:hover': { color: 'primary.main' },
                        }),
                      }}
                    >
                      {getMenuLabel(topMenu, language)}
                    </Typography>
                    {topMenu.children?.length
                      ? topMenu.children.map((section) => renderSection(section))
                      : topMenu.route
                        ? renderLeafLink(topMenu)
                        : null}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Fade>
  );
};

export default FullMenuOverlay;
