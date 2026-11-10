import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useMenuStore } from '../../store';
import {
  AppNotification,
  getNotificationChipColor,
  getNotificationChipLabel,
} from '../../utils/notificationFeed';

interface NotificationDetailDialogProps {
  open: boolean;
  notification: AppNotification | null;
  onClose: () => void;
  onNavigate?: (href: string) => void;
}

const NotificationDetailDialog: React.FC<NotificationDetailDialogProps> = ({
  open,
  notification,
  onClose,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { language } = useMenuStore();

  if (!notification) return null;

  const locale = language === 'en' ? 'en-US' : 'ko-KR';
  const formattedTime = new Date(notification.timestamp).toLocaleString(locale);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          pb: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Chip
              size="small"
              label={getNotificationChipLabel(notification, t)}
              color={getNotificationChipColor(notification)}
              sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.6875rem', fontWeight: 600 } }}
            />
            <Typography variant="caption" color="text.secondary">
              {formattedTime}
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.35 }}>
            {notification.title}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {notification.message}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.close')}
        </Button>
        {notification.href && onNavigate ? (
          <Button
            variant="contained"
            endIcon={<OpenInNewIcon />}
            onClick={() => {
              onNavigate(notification.href!);
              onClose();
            }}
          >
            {t('notifications.goToRelated')}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
};

export default NotificationDetailDialog;
