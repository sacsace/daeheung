import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import EmployeePersonalRecordContent from './EmployeePersonalRecordContent';
import { buildEmployeePersonalRecordSections } from './buildEmployeePersonalRecordSections';
import { getUploadUrl } from '../../utils/uploadUrl';
import { shortCompanyName, toPayslipCompanyInfo } from '../HR/PayslipContent';

type UserPersonalRecordDialogProps = {
  open: boolean;
  onClose: () => void;
  user: Record<string, any> | null;
  company?: Record<string, any> | null;
};

const UserPersonalRecordDialog: React.FC<UserPersonalRecordDialogProps> = ({
  open,
  onClose,
  user,
  company,
}) => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'ko' ? 'ko-KR' : 'en-IN';

  const companyInfo = useMemo(() => {
    if (!company) return { name: '', logo: '', contact: '' };
    const info = toPayslipCompanyInfo(company);
    const name = shortCompanyName(info.name) || info.name || '';
    const contact = [info.address, info.phone, info.email]
      .filter((x) => !!String(x || '').trim())
      .join(' · ');
    return { name, logo: info.logo || '', contact };
  }, [company]);

  const sections = useMemo(() => {
    if (!user) return [];
    return buildEmployeePersonalRecordSections({
      user,
      t,
      dateLocale,
      language: i18n.language,
    });
  }, [user, t, dateLocale, i18n.language]);

  if (!user) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { maxHeight: '92vh', borderRadius: 1 } }}
    >
      <DialogTitle sx={{ px: 2.5, py: 2, pb: 1 }}>
        <Typography component="span" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
          {t('userManagement.personalRecordTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {user.username || user.userid}
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, bgcolor: '#F8FAFC' }}>
        <Box sx={{ p: 1.5 }}>
          <EmployeePersonalRecordContent
            documentTitle={t('userManagement.personalRecordTitle')}
            companyName={companyInfo.name || '—'}
            companyLogoUrl={companyInfo.logo || null}
            companyContact={companyInfo.contact || undefined}
            photoUrl={user.avatar_url ? getUploadUrl(user.avatar_url) || null : null}
            photoAlt={user.username || user.userid}
            employeeName={user.username || user.userid || 'Employee'}
            generatedAtLabel={t('userManagement.personalRecordGeneratedAt')}
            generatedAt={new Date().toLocaleDateString(dateLocale)}
            sections={sections}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button onClick={onClose} variant="outlined" size="small">
          {t('common.close', '닫기')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserPersonalRecordDialog;
