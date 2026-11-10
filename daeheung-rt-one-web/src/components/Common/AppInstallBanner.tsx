import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useMenuStore } from '../../store';
import { useAppInstallPrompt } from '../../hooks/useAppInstallPrompt';
import { useIsMobileOrTablet, isIOSDevice } from '../../utils/isMobileOrTablet';

const AppInstallBanner: React.FC = () => {
  const { language } = useMenuStore();
  const isMobileOrTablet = useIsMobileOrTablet();
  const isEn = language === 'en';
  const isIos = isIOSDevice();

  const {
    shouldShow,
    canPromptInstall,
    iosGuideOpen,
    install,
    dismiss,
    closeIosGuide,
  } = useAppInstallPrompt(isMobileOrTablet);

  if (!shouldShow) return null;

  const title = isEn ? 'Install MVS' : 'MVS 설치';
  const description = isEn
    ? 'Open MVS without going through the browser.'
    : '브라우저 없이 MVS를 바로 열 수 있습니다.';
  const actionLabel =
    canPromptInstall || !isIos
      ? isEn
        ? 'Install'
        : '설치'
      : isEn
        ? 'Steps'
        : '방법';
  const iosGuideTitle = isEn ? 'Install MVS' : 'MVS 설치';
  const iosSteps = isEn
    ? [
        'Tap Share in Safari.',
        'Choose Add to Home Screen.',
        'Tap Add.',
      ]
    : [
        'Safari에서 공유를 누릅니다.',
        '홈 화면에 추가를 선택합니다.',
        '추가를 누릅니다.',
      ];

  return (
    <>
      <Box
        role="region"
        aria-label={title}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (theme) => theme.zIndex.snackbar + 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          bgcolor: '#F8FAFC',
          borderTop: '1px solid #CBD5E1',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              lineHeight: 1.3,
              color: '#0F172A',
            }}
          >
            {title}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.75rem',
              lineHeight: 1.35,
              color: '#64748B',
            }}
          >
            {description}
          </Typography>
        </Box>

        <Button
          size="small"
          variant="outlined"
          disableElevation
          onClick={() => void install()}
          sx={{
            flexShrink: 0,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.8125rem',
            borderRadius: '4px',
            borderColor: '#94A3B8',
            color: '#0F172A',
            px: 1.25,
            minWidth: 0,
            bgcolor: '#FFFFFF',
            '&:hover': {
              borderColor: '#64748B',
              bgcolor: '#FFFFFF',
            },
          }}
        >
          {actionLabel}
        </Button>

        <IconButton
          size="small"
          aria-label={isEn ? 'Close' : '닫기'}
          onClick={dismiss}
          sx={{ flexShrink: 0, color: '#64748B', p: 0.5 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Dialog open={iosGuideOpen} onClose={closeIosGuide} maxWidth="xs" fullWidth>
        <DialogTitle
          sx={{
            fontSize: '0.9375rem',
            fontWeight: 700,
            pb: 0.75,
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          {iosGuideTitle}
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Box
            component="ol"
            sx={{
              m: 0,
              pl: 2.25,
              color: '#334155',
              fontSize: '0.875rem',
              lineHeight: 1.6,
            }}
          >
            {iosSteps.map((step) => (
              <Box component="li" key={step} sx={{ mb: 0.5 }}>
                {step}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5, borderTop: '1px solid #E2E8F0' }}>
          <Button
            onClick={closeIosGuide}
            variant="outlined"
            size="small"
            disableElevation
            sx={{
              textTransform: 'none',
              borderRadius: '4px',
              borderColor: '#94A3B8',
              color: '#0F172A',
            }}
          >
            {isEn ? 'OK' : '확인'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AppInstallBanner;
