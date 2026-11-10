import React, { useMemo } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMenuStore } from '../../store';
import { findMenuByPath } from '../../utils/findMenuByPath';
import { resolvePageIcon } from '../../utils/pageMenuIcon';
import { mvsPageDescriptionSx, mvsPageTitleSx } from '../../theme/daeheungLayout';

export type DaeheungPageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** 아이콘 자동 매핑용 경로 (미지정 시 현재 location) */
  iconPath?: string;
  actions?: React.ReactNode;
  backTo?: string;
  onBack?: () => void;
  mb?: number;
  hideIcon?: boolean;
};

const DaeheungPageHeader: React.FC<DaeheungPageHeaderProps> = ({
  title,
  description,
  icon,
  iconPath,
  actions,
  backTo,
  onBack,
  mb = 3,
  hideIcon = false,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { menus } = useMenuStore();

  const path = iconPath || location.pathname;
  const pageIcon = useMemo(() => {
    if (icon) return icon;
    const menu = findMenuByPath(menus, path);
    return resolvePageIcon(path, menu);
  }, [icon, menus, path]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (backTo) navigate(backTo);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 2,
        mb,
        width: '100%',
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, flex: { xs: '1 1 100%', sm: '1 1 280px' }, minWidth: 0 }}>
        {backTo || onBack ? (
          <IconButton
            size="small"
            onClick={handleBack}
            aria-label="back"
            sx={{
              mt: 0.15,
              borderRadius: '10px',
              color: 'text.secondary',
              '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.9) },
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        ) : null}
        {!hideIcon ? (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              '& .MuiSvgIcon-root': { fontSize: 20 },
            }}
          >
            {pageIcon}
          </Box>
        ) : null}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="h1"
            sx={{
              ...mvsPageTitleSx,
              mb: description ? 0.75 : 0,
              color: 'text.primary',
            }}
          >
            {title}
          </Typography>
          {description ? <Typography sx={mvsPageDescriptionSx}>{description}</Typography> : null}
        </Box>
      </Box>
      {actions ? (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'flex-end',
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            flexShrink: 0,
            width: { xs: '100%', sm: 'auto' },
            maxWidth: { xs: '100%', sm: '58%' },
            overflow: 'visible',
            // outlined shrink 라벨·포커스 링 여유
            pt: 1.5,
          }}
        >
          {actions}
        </Box>
      ) : null}
    </Box>
  );
};

export default DaeheungPageHeader;
