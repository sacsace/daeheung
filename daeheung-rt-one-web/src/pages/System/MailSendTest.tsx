import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Divider
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import SendIcon from '@mui/icons-material/Send';
import EmailIcon from '@mui/icons-material/Email';
import { useTranslation } from 'react-i18next';
import { systemSettingsService } from '../../services/api';
import { useStore } from '../../store';

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.07)',
  bgcolor: 'background.paper',
  overflow: 'hidden',
  maxWidth: 560
} as const;

const MailSendTest: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useStore();
  const canManage = user?.role === 'root' || user?.role === 'admin';

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  const handleSend = async () => {
    const trimmed = to.trim();
    if (!trimmed) {
      setSnackbar({
        open: true,
        message: t('mailSendTest.toRequired'),
        severity: 'error'
      });
      return;
    }

    try {
      setSending(true);
      const res = await systemSettingsService.sendTestMail({
        to: trimmed,
        ...(subject.trim() ? { subject: subject.trim() } : {})
      });
      if (res?.success) {
        setSnackbar({
          open: true,
          message: res.message || t('mailSendTest.sent'),
          severity: 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: (res as any)?.message || t('mailSendTest.failed'),
          severity: 'error'
        });
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        t('mailSendTest.failed');
      setSnackbar({ open: true, message: String(msg), severity: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader title={t('mailSendTest.title')} />

      {!canManage && (
        <Alert severity="warning" sx={{ mb: 2, maxWidth: 560 }}>
          {t('mailSendTest.noPermission')}
        </Alert>
      )}

      <Card sx={CARD_SX}>
        <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <EmailIcon sx={{ color: 'primary.main', fontSize: 22 }} />
            <Typography variant="subtitle2" fontWeight={600}>
              {t('mailSendTest.cardTitle')}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.8125rem' }}>
            {t('mailSendTest.description')}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TextField
            fullWidth
            size="small"
            label={t('mailSendTest.to')}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={!canManage || sending}
            placeholder="name@example.com"
            sx={{ mb: 2 }}
            autoComplete="email"
          />
          <TextField
            fullWidth
            size="small"
            label={t('mailSendTest.subjectOptional')}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!canManage || sending}
            placeholder={t('mailSendTest.subjectPlaceholder')}
            helperText={t('mailSendTest.subjectHint')}
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            onClick={handleSend}
            disabled={!canManage || sending}
          >
            {t('mailSendTest.send')}
          </Button>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MailSendTest;
