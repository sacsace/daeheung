import React, { useEffect, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useErrorStore } from '../../store/errorStore';
import type { NotificationInfo } from '../../store/errorStore';

const AUTO_HIDE_DURATION = 4000;

const NotificationSnackbar: React.FC = () => {
  const { notifications, removeNotification } = useErrorStore();
  const [open, setOpen] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<NotificationInfo | null>(null);

  useEffect(() => {
    if (notifications.length > 0 && !currentNotification) {
      setCurrentNotification(notifications[0]);
      setOpen(true);
    }
  }, [notifications, currentNotification]);

  const handleClose = (_?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const handleExited = () => {
    const toRemove = currentNotification;
    setCurrentNotification(null);
    if (toRemove) {
      removeNotification(toRemove.id);
    }
    const remaining = useErrorStore.getState().notifications;
    if (remaining.length > 0) {
      setCurrentNotification(remaining[0]);
      setOpen(true);
    }
  };

  if (!currentNotification) return null;

  return (
    <Snackbar
      open={open}
      autoHideDuration={AUTO_HIDE_DURATION}
      onClose={handleClose}
      TransitionProps={{ onExited: handleExited }}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ mt: 2 }}
    >
      <Alert
        onClose={handleClose}
        severity={currentNotification.severity}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {currentNotification.message}
      </Alert>
    </Snackbar>
  );
};

export default NotificationSnackbar;
