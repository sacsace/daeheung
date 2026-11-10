import React from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { ensureI18nLanguage } from '../../locales/i18n';
import { Link as RouterLink } from 'react-router-dom';
import { useStore, useMenuStore } from '../../store';
import { mvsMainSurfaceSx } from '../../theme/daeheungLayout';

interface PublicInfoPageLayoutProps {
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

const PublicInfoPageLayout: React.FC<PublicInfoPageLayoutProps> = ({
  title,
  subtitle,
  lastUpdated,
  children,
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const setMenuLanguage = useMenuStore((s) => s.setLanguage);

  const handleLanguageChange = (_event: React.MouseEvent<HTMLElement>, newLang: 'ko' | 'en' | null) => {
    if (newLang === null) return;
    void ensureI18nLanguage(newLang);
    setMenuLanguage(newLang);
  };

  const titleBlock = (
    <>
      <Typography
        component="h1"
        sx={{
          fontWeight: 700,
          fontSize: { xs: '1.35rem', sm: '1.5rem' },
          letterSpacing: '-0.03em',
          mb: subtitle ? 0.75 : 1.5,
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.65 }}>
          {subtitle}
        </Typography>
      )}
      {lastUpdated && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 3,
            color: alpha(theme.palette.text.secondary, 0.85),
            fontWeight: 500,
          }}
        >
          {t('legalPages.lastUpdated', { date: lastUpdated })}
        </Typography>
      )}
    </>
  );

  // 로그인 후 사이드바에서 열면 AppLayout body 영역에 표시
  if (isAuthenticated) {
    return (
      <Box
        sx={{
          ...mvsMainSurfaceSx,
          width: '100%',
          borderRadius: '8px',
          border: '1px solid #CBD5E1',
          boxShadow: '0 2px 10px rgba(36, 52, 71, 0.06)',
          px: { xs: 2, sm: 3 },
          py: { xs: 2.5, sm: 3 },
        }}
      >
        {titleBlock}
        {children}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor:
          theme.palette.mode === 'light' ? '#F1F5F9' : theme.palette.grey[900],
        py: { xs: 2.5, sm: 4 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="md">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            mb: 2.5,
            flexWrap: 'wrap',
          }}
        >
          <Button
            component={RouterLink}
            to="/login"
            startIcon={<ArrowBackIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              color: 'text.secondary',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
            }}
          >
            {t('legalPages.backToLogin')}
          </Button>
          <ToggleButtonGroup
            exclusive
            value={i18n.language?.startsWith('en') ? 'en' : 'ko'}
            onChange={handleLanguageChange}
            aria-label={t('login.languageToggleAria')}
            size="small"
            sx={{
              bgcolor: theme.palette.background.paper,
              p: 0.35,
              borderRadius: '6px',
              border: `1px solid ${theme.palette.divider}`,
              '& .MuiToggleButtonGroup-grouped': {
                border: 0,
                mx: 0.15,
                borderRadius: '4px !important',
                px: 1.5,
                py: 0.4,
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'none',
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

        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '8px',
            px: { xs: 2.5, sm: 4 },
            py: { xs: 3, sm: 4 },
            bgcolor: 'background.paper',
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: 'none',
          }}
        >
          {titleBlock}
          {children}
        </Paper>
      </Container>
    </Box>
  );
};

export default PublicInfoPageLayout;
