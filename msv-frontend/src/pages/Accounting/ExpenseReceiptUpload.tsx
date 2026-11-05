import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  Stack,
  FormControlLabel,
  Radio,
  RadioGroup,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { accountingService } from '../../services/api';
import { ensureI18nLanguage } from '../../locales/i18n';
import { useMenuStore } from '../../store';

const ExpenseReceiptUpload: React.FC = () => {
  const { t, i18n } = useTranslation();
  const setMenuLanguage = useMenuStore((s) => s.setLanguage);
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [file, setFile] = useState<File | null>(null);
  const [invoiceType, setInvoiceType] = useState<'tax' | 'proforma'>('tax');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const lang = i18n.language?.startsWith('en') ? 'en' : 'ko';

  const handleLanguage = (_event: React.MouseEvent<HTMLElement>, newLang: 'ko' | 'en' | null) => {
    if (newLang === null) return;
    void ensureI18nLanguage(newLang);
    setMenuLanguage(newLang);
    setSuccess('');
    setError('');
  };

  const handleUpload = async () => {
    if (!token) {
      setError(t('expenseApproval.dialog.receiptPhone.tokenMissing'));
      return;
    }
    if (!file) {
      setError(t('expenseApproval.dialog.receiptPhone.fileRequired'));
      return;
    }
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const response = await accountingService.uploadExpenseReceipt(token, file, invoiceType);
      if (!response?.success) {
        throw new Error(response?.message || t('expenseApproval.dialog.receiptPhone.uploadFailed'));
      }
      setSuccess(
        invoiceType === 'proforma'
          ? t('expenseApproval.dialog.receiptPhone.successProforma')
          : t('expenseApproval.dialog.receiptPhone.successTax')
      );
      setFile(null);
    } catch (uploadError: any) {
      setError(uploadError?.message || t('expenseApproval.dialog.receiptPhone.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ p: 2, minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Card sx={{ maxWidth: 520, mx: 'auto', mt: { xs: 2, sm: 6 } }}>
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={lang}
                onChange={handleLanguage}
                aria-label={t('login.languageToggleAria')}
              >
                <ToggleButton value="ko" disableRipple sx={{ textTransform: 'none', px: 1.25 }}>
                  {t('login.langKo')}
                </ToggleButton>
                <ToggleButton value="en" disableRipple sx={{ textTransform: 'none', px: 1.25 }}>
                  {t('login.langEn')}
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Typography variant="h5" fontWeight="bold">
              {t('expenseApproval.dialog.receiptPhone.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('expenseApproval.dialog.receiptPhone.description')}
            </Typography>

            {!token && (
              <Alert severity="warning">
                {t('expenseApproval.dialog.receiptPhone.tokenMissing')}
              </Alert>
            )}

            <RadioGroup
              value={invoiceType}
              onChange={(e) => setInvoiceType(e.target.value as 'tax' | 'proforma')}
            >
              <FormControlLabel
                value="tax"
                control={<Radio size="small" />}
                label={t('expenseApproval.dialog.receiptPhone.invoiceTypeTax')}
              />
              <FormControlLabel
                value="proforma"
                control={<Radio size="small" />}
                label={t('expenseApproval.dialog.receiptPhone.invoiceTypeProforma')}
              />
            </RadioGroup>

            <Button variant="outlined" component="label" disabled={!token}>
              {t('expenseApproval.dialog.receiptPhone.pickPhoto')}
              <input
                hidden
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Button>

            {file && (
              <Typography variant="body2">
                {t('expenseApproval.dialog.receiptPhone.selectedFile', { name: file.name })}
              </Typography>
            )}

            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={handleUpload}
              disabled={!token || !file || uploading}
            >
              {uploading
                ? t('expenseApproval.dialog.receiptPhone.uploading')
                : t('expenseApproval.dialog.receiptPhone.upload')}
            </Button>

            {success && <Alert severity="success">{success}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ExpenseReceiptUpload;
