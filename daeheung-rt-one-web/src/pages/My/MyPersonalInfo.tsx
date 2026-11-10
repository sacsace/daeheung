import React, { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  LockOutlined as LockIcon,
  PhotoCameraOutlined as PhotoCameraIcon,
  SaveOutlined as SaveIcon,
  VisibilityOutlined as VisibilityIcon,
  VisibilityOffOutlined as VisibilityOffIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsBodyCardSx,
  mvsBodyPrimaryBtnSx,
  mvsOutlinedLabelProps,
  mvsPageRootSx,
  mvsSearchFieldSx,
} from '../../theme/daeheungLayout';
import { userService } from '../../services/api';
import { useStore } from '../../store';
import { getUploadUrl } from '../../utils/uploadUrl';
import { formatPositionLabel } from '../../utils/positionLabels';

type CareerEntry = {
  company_name: string;
  position: string;
  start_date: string;
  end_date: string;
  description: string;
};

type EducationEntry = {
  school_name: string;
  degree: string;
  major: string;
  start_date: string;
  end_date: string;
  description: string;
};

type ProfileDetail = {
  userid?: string;
  username?: string;
  email?: string;
  role?: string;
  department?: string | null;
  position?: string | null;
  employee_number?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  avatar_url?: string | null;
  hire_date?: string | null;
  employment_type?: string | null;
  salary?: number | string | null;
  has_salary?: boolean;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_ifsc?: string | null;
  ot_eligible?: boolean | null;
  pt_eligible?: boolean | null;
  pf_calc_mode?: 'cap_1800' | 'basic_12pct' | 'total_12pct' | 'none' | null;
  pf_cap_1800?: boolean | null;
  is_payment_officer?: boolean | null;
  career_history?: CareerEntry[] | null;
  education_history?: EducationEntry[] | null;
  created_at?: string | null;
};

const toDateInput = (raw?: string | null): string => {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
};

const normalizeCareer = (raw: unknown): CareerEntry[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row: any) => ({
      company_name: String(row?.company_name ?? '').trim(),
      position: String(row?.position ?? '').trim(),
      start_date: String(row?.start_date ?? '').trim(),
      end_date: String(row?.end_date ?? '').trim(),
      description: String(row?.description ?? '').trim(),
    }))
    .filter((c) => c.company_name);
};

const normalizeEducation = (raw: unknown): EducationEntry[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row: any) => ({
      school_name: String(row?.school_name ?? '').trim(),
      degree: String(row?.degree ?? '').trim(),
      major: String(row?.major ?? '').trim(),
      start_date: String(row?.start_date ?? '').trim(),
      end_date: String(row?.end_date ?? '').trim(),
      description: String(row?.description ?? '').trim(),
    }))
    .filter((e) => e.school_name);
};

const formatSalaryInr = (value: unknown): string => {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n)) return '—';
  return `₹${Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const formatPhone = (raw: string): string => {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 5) return d;
  return `${d.slice(0, Math.max(0, d.length - 5))} ${d.slice(-5)}`.trim();
};

const formatBankAccount = (raw: string): string => {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  const parts: string[] = [];
  for (let i = 0; i < d.length; i += 4) parts.push(d.slice(i, i + 4));
  return parts.join(' ');
};

const formatIfsc = (raw: string): string =>
  String(raw || '')
    .replace(/\s/g, '')
    .toUpperCase();

/** 내 정보·업무 > 개인 정보 — 연락처 등은 수정, 인사/급여는 조회 전용 */
const MyPersonalInfo: React.FC = () => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const updateUser = useStore((s) => s.updateUser);
  const isEn = i18n.language?.startsWith('en');
  const dateLocale = isEn ? 'en-US' : 'ko-KR';

  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [form, setForm] = useState({
    username: '',
    email: '',
    birth_date: '',
    gender: '' as '' | 'male' | 'female' | 'other',
    phone: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [salaryRevealed, setSalaryRevealed] = useState<number | string | null>(null);
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [salaryPassword, setSalaryPassword] = useState('');
  const [salaryRevealing, setSalaryRevealing] = useState(false);
  const [salaryDialogError, setSalaryDialogError] = useState('');

  const labelSx = useMemo(
    () => ({
      mb: 0.5,
      fontWeight: 500 as const,
      color: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.85) : theme.palette.grey[800],
      fontSize: '0.8125rem',
    }),
    [theme]
  );
  const valueSx = useMemo(
    () => ({
      color:
        theme.palette.mode === 'dark'
          ? alpha(theme.palette.common.white, 0.95)
          : alpha(theme.palette.text.primary, 0.92),
    }),
    [theme]
  );
  const sectionTitleSx = useMemo(
    () => ({
      fontWeight: 700,
      fontSize: '1rem',
      letterSpacing: '-0.02em',
    }),
    []
  );
  const fieldSx = {
    ...(mvsSearchFieldSx as Record<string, unknown>),
    '& .MuiOutlinedInput-root': { borderRadius: '8px' },
  };

  const accordionSx = {
    mb: 1.5,
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '4px !important',
    boxShadow: 'none',
    overflow: 'hidden',
    '&:before': { display: 'none' },
  };

  const applyProfile = (data: ProfileDetail) => {
    setProfile(data);
    setSalaryRevealed(null);
    setForm({
      username: data.username || '',
      email: data.email || '',
      birth_date: toDateInput(data.birth_date),
      gender: (data.gender as '' | 'male' | 'female' | 'other') || '',
      phone: data.phone || '',
      address: data.address || '',
      emergency_contact: data.emergency_contact || '',
      emergency_phone: data.emergency_phone || '',
    });
  };

  useEffect(() => {
    let active = true;
    userService
      .getMyProfile()
      .then((res) => {
        if (!active) return;
        if (res?.success && res.data) applyProfile(res.data);
        else setError(res?.message || t('personalSettings.errors.load'));
      })
      .catch((err: any) => {
        if (active) {
          setError(err?.response?.data?.message || t('personalSettings.errors.load'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const setFormField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const employmentLabel = (type?: string | null) => {
    switch (type) {
      case 'fulltime':
        return t('userManagement.empFulltime');
      case 'daily':
        return t('userManagement.empDaily');
      case 'service':
        return t('userManagement.empService');
      case 'contract':
        return t('userManagement.empContract');
      case 'parttime':
        return t('userManagement.empParttime');
      case 'intern':
        return t('userManagement.empIntern');
      default:
        return type || '-';
    }
  };

  const openSalaryRevealDialog = () => {
    setSalaryPassword('');
    setSalaryDialogError('');
    setSalaryDialogOpen(true);
  };

  const handleSalaryReveal = async () => {
    if (!salaryPassword.trim()) {
      setSalaryDialogError(t('personalSettings.salaryPasswordRequired'));
      return;
    }
    setSalaryRevealing(true);
    setSalaryDialogError('');
    try {
      const res = await userService.revealMySalary(salaryPassword);
      if (res?.success) {
        setSalaryRevealed(res.data?.salary ?? null);
        setSalaryDialogOpen(false);
        setSalaryPassword('');
      } else {
        setSalaryDialogError(res?.message || t('personalSettings.salaryRevealFailed'));
      }
    } catch (err: any) {
      setSalaryDialogError(
        err?.response?.data?.message || t('personalSettings.salaryRevealFailed')
      );
    } finally {
      setSalaryRevealing(false);
    }
  };

  const salaryDisplay = (() => {
    if (salaryRevealed != null && salaryRevealed !== '') {
      return formatSalaryInr(salaryRevealed);
    }
    if (profile?.has_salary) {
      return t('personalSettings.salaryMasked');
    }
    return '-';
  })();

  const ReadField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <Box>
      <Typography variant="body2" sx={labelSx}>
        {label}
      </Typography>
      <Typography variant="body1" sx={valueSx}>
        {children}
      </Typography>
    </Box>
  );

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError(t('personalSettings.errors.avatarInvalidType'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('personalSettings.errors.avatarTooLarge'));
      return;
    }
    setError('');
    setMessage('');
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const handlePhotoSave = async () => {
    if (!avatarFile) {
      setError(t('personalSettings.errors.avatarRequired'));
      return;
    }
    setSavingPhoto(true);
    setError('');
    setMessage('');
    try {
      const response = await userService.uploadMyAvatar(avatarFile);
      if (!response?.success) throw new Error(response?.message);
      const nextAvatarUrl = response.data?.avatar_url || null;
      setProfile((prev) => (prev ? { ...prev, avatar_url: nextAvatarUrl } : prev));
      updateUser({ avatar_url: nextAvatarUrl });
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarFile(null);
      setAvatarPreviewUrl('');
      setMessage(response.message || t('personalSettings.success.photo'));
    } catch (photoError: any) {
      setError(
        photoError?.response?.data?.message ||
          photoError?.message ||
          t('personalSettings.errors.photo')
      );
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleProfileSave = async () => {
    if (!form.username.trim() || !form.email.trim()) {
      setError(t('personalSettings.errors.required'));
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await userService.updateMyProfile({
        username: form.username.trim(),
        email: form.email.trim(),
        birth_date: form.birth_date || null,
        gender: form.gender || '',
        phone: form.phone || '',
        address: form.address || '',
        emergency_contact: form.emergency_contact || '',
        emergency_phone: form.emergency_phone || '',
      });
      if (!response?.success) throw new Error(response?.message);
      applyProfile({ ...profile, ...response.data });
      updateUser({
        username: response.data.username,
        email: response.data.email,
        avatar_url: response.data.avatar_url,
      });
      setMessage(response.message || t('personalSettings.success.profile'));
    } catch (saveError: any) {
      setError(
        saveError?.response?.data?.message ||
          saveError?.message ||
          t('personalSettings.errors.save')
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwords.currentPassword || !passwords.newPassword) {
      setError(t('personalSettings.errors.passwordRequired'));
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError(t('personalSettings.errors.passwordMismatch'));
      return;
    }
    setChangingPassword(true);
    setError('');
    setMessage('');
    try {
      const response = await userService.changeMyPassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      if (!response?.success) throw new Error(response?.message);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage(response.message || t('personalSettings.success.password'));
    } catch (passwordError: any) {
      setError(
        passwordError?.response?.data?.message ||
          passwordError?.message ||
          t('personalSettings.errors.password')
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const careers = normalizeCareer(profile?.career_history);
  const educations = normalizeEducation(profile?.education_history);
  const displayAvatarSrc =
    avatarPreviewUrl || (profile?.avatar_url ? getUploadUrl(profile.avatar_url) : undefined);

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={isEn ? 'Personal Information' : '개인 정보'}
        description={
          isEn
            ? 'Update your contact details. HR-managed fields below remain read-only.'
            : '연락처·개인 정보를 수정할 수 있습니다. 하단 인사 관리 항목은 조회 전용입니다.'
        }
      />

      {message ? (
        <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>
          {message}
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Card elevation={0} sx={mvsBodyCardSx}>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : !profile ? (
            <Typography color="text.secondary">—</Typography>
          ) : (
            <Box>
              <Accordion defaultExpanded sx={accordionSx}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={sectionTitleSx}>{t('userManagement.sectionBasic')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('personalSettings.personalInfoHint')}
                  </Typography>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 1.5,
                      mb: 2.5,
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: '8px',
                      bgcolor: '#F8FAFC',
                    }}
                  >
                    <Avatar
                      src={displayAvatarSrc || undefined}
                      alt={form.username}
                      sx={{ width: 80, height: 80, bgcolor: 'action.selected', flexShrink: 0 }}
                    >
                      {(form.username || '?').trim().charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {t('personalSettings.profilePhoto')}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        <Button
                          component="label"
                          variant="outlined"
                          size="small"
                          startIcon={<PhotoCameraIcon />}
                          sx={{ textTransform: 'none', borderRadius: '8px' }}
                        >
                          {avatarFile
                            ? t('personalSettings.changePhoto')
                            : t('personalSettings.selectPhoto')}
                          <input
                            hidden
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={handleAvatarSelect}
                          />
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          disableElevation
                          disabled={!avatarFile || savingPhoto}
                          startIcon={
                            savingPhoto ? (
                              <CircularProgress size={14} color="inherit" />
                            ) : (
                              <SaveIcon />
                            )
                          }
                          onClick={() => void handlePhotoSave()}
                          sx={{ ...mvsBodyPrimaryBtnSx, py: 0.5 }}
                        >
                          {t('personalSettings.savePhoto')}
                        </Button>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {avatarFile?.name || t('personalSettings.avatarHelper')}
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                      gap: 2,
                    }}
                  >
                    <TextField
                      label={t('personalSettings.name')}
                      value={form.username}
                      onChange={(e) => setFormField('username', e.target.value)}
                      required
                      size="small"
                      sx={fieldSx}
                      {...mvsOutlinedLabelProps}
                    />
                    <TextField
                      label={t('personalSettings.email')}
                      type="email"
                      value={form.email}
                      onChange={(e) => setFormField('email', e.target.value)}
                      required
                      size="small"
                      sx={fieldSx}
                      {...mvsOutlinedLabelProps}
                    />
                    <TextField
                      label={t('personalSettings.birthDate')}
                      type="date"
                      value={form.birth_date}
                      onChange={(e) => setFormField('birth_date', e.target.value)}
                      size="small"
                      sx={fieldSx}
                      {...mvsOutlinedLabelProps}
                    />
                    <TextField
                      select
                      label={t('personalSettings.gender')}
                      value={form.gender}
                      onChange={(e) => setFormField('gender', e.target.value)}
                      size="small"
                      sx={fieldSx}
                      {...mvsOutlinedLabelProps}
                    >
                      <MenuItem value="">{t('personalSettings.notSet')}</MenuItem>
                      <MenuItem value="male">{t('personalSettings.genderMale')}</MenuItem>
                      <MenuItem value="female">{t('personalSettings.genderFemale')}</MenuItem>
                      <MenuItem value="other">{t('personalSettings.genderOther')}</MenuItem>
                    </TextField>
                    <TextField
                      label={t('personalSettings.phone')}
                      value={form.phone}
                      onChange={(e) => setFormField('phone', e.target.value)}
                      size="small"
                      sx={fieldSx}
                      {...mvsOutlinedLabelProps}
                    />
                    <TextField
                      label={t('personalSettings.emergencyContact')}
                      value={form.emergency_contact}
                      onChange={(e) => setFormField('emergency_contact', e.target.value)}
                      size="small"
                      sx={fieldSx}
                      {...mvsOutlinedLabelProps}
                    />
                    <TextField
                      label={t('personalSettings.emergencyPhone')}
                      value={form.emergency_phone}
                      onChange={(e) => setFormField('emergency_phone', e.target.value)}
                      size="small"
                      sx={fieldSx}
                      {...mvsOutlinedLabelProps}
                    />
                    <Box>
                      <Typography variant="body2" sx={labelSx}>
                        {t('userManagement.paymentOfficer')}
                      </Typography>
                      <FormControlLabel
                        control={<Checkbox checked={Boolean(profile.is_payment_officer)} disabled />}
                        label={
                          profile.is_payment_officer
                            ? t('userManagement.paymentOfficerAssigned')
                            : t('userManagement.paymentOfficerNotAssigned')
                        }
                      />
                    </Box>
                    <TextField
                      label={t('personalSettings.address')}
                      value={form.address}
                      onChange={(e) => setFormField('address', e.target.value)}
                      multiline
                      minRows={2}
                      size="small"
                      sx={{ ...fieldSx, gridColumn: { xs: '1', sm: '1 / -1' } }}
                      {...mvsOutlinedLabelProps}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2.5 }}>
                    <Button
                      variant="contained"
                      disableElevation
                      startIcon={
                        saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />
                      }
                      onClick={() => void handleProfileSave()}
                      disabled={saving}
                      sx={mvsBodyPrimaryBtnSx}
                    >
                      {t('personalSettings.save')}
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>

              <Accordion defaultExpanded sx={accordionSx}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={sectionTitleSx}>{t('personalSettings.passwordTitle')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('personalSettings.passwordHint')}
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                      gap: 2,
                      maxWidth: 720,
                    }}
                  >
                    <TextField
                      label={t('personalSettings.currentPassword')}
                      type="password"
                      value={passwords.currentPassword}
                      onChange={(e) =>
                        setPasswords((p) => ({ ...p, currentPassword: e.target.value }))
                      }
                      size="small"
                      sx={fieldSx}
                      autoComplete="current-password"
                      {...mvsOutlinedLabelProps}
                    />
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
                    <TextField
                      label={t('personalSettings.newPassword')}
                      type="password"
                      value={passwords.newPassword}
                      onChange={(e) =>
                        setPasswords((p) => ({ ...p, newPassword: e.target.value }))
                      }
                      size="small"
                      sx={fieldSx}
                      helperText={t('personalSettings.passwordRule')}
                      autoComplete="new-password"
                      {...mvsOutlinedLabelProps}
                    />
                    <TextField
                      label={t('personalSettings.confirmPassword')}
                      type="password"
                      value={passwords.confirmPassword}
                      onChange={(e) =>
                        setPasswords((p) => ({ ...p, confirmPassword: e.target.value }))
                      }
                      size="small"
                      sx={fieldSx}
                      autoComplete="new-password"
                      {...mvsOutlinedLabelProps}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button
                      variant="contained"
                      disableElevation
                      startIcon={
                        changingPassword ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <LockIcon />
                        )
                      }
                      onClick={() => void handlePasswordChange()}
                      disabled={changingPassword}
                      sx={mvsBodyPrimaryBtnSx}
                    >
                      {t('personalSettings.changePassword')}
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>

              <Accordion defaultExpanded sx={accordionSx}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={sectionTitleSx}>{t('userManagement.sectionHr')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Alert severity="info" sx={{ mb: 2, borderRadius: 0 }}>
                    {t('personalSettings.companyManagedHint')}
                  </Alert>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      gap: 2.25,
                    }}
                  >
                    <ReadField label={t('userManagement.employeeNumber')}>
                      {profile.employee_number
                        ? String(profile.employee_number).toUpperCase()
                        : '-'}
                    </ReadField>
                    <ReadField label={t('userManagement.hireDate')}>
                      {profile.hire_date
                        ? new Date(profile.hire_date).toLocaleDateString(dateLocale)
                        : '-'}
                    </ReadField>
                    <ReadField label={t('userManagement.employmentType')}>
                      {employmentLabel(profile.employment_type)}
                    </ReadField>
                    <ReadField label={t('userManagement.department')}>
                      {profile.department || '-'}
                    </ReadField>
                    <ReadField label={t('userManagement.positionTitle')}>
                      {formatPositionLabel(profile.position, i18n.language) || '-'}
                    </ReadField>
                    <Box>
                      <Typography variant="body2" sx={labelSx}>
                        {t('userManagement.salary')}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body1" sx={valueSx}>
                          {salaryDisplay}
                        </Typography>
                        {profile.has_salary ? (
                          salaryRevealed != null && salaryRevealed !== '' ? (
                            <IconButton
                              size="small"
                              aria-label={t('personalSettings.salaryHide')}
                              onClick={() => setSalaryRevealed(null)}
                              sx={{ p: 0.25 }}
                            >
                              <VisibilityOffIcon fontSize="small" />
                            </IconButton>
                          ) : (
                            <IconButton
                              size="small"
                              aria-label={t('personalSettings.salaryReveal')}
                              onClick={openSalaryRevealDialog}
                              sx={{ p: 0.25 }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          )
                        ) : null}
                      </Box>
                    </Box>
                    <ReadField label={t('userManagement.otEligible')}>
                      {profile.ot_eligible === true
                        ? t('userManagement.otEligibleYes')
                        : t('userManagement.otEligibleNo')}
                    </ReadField>
                    <ReadField label={t('userManagement.ptEligible')}>
                      {profile.pt_eligible === false
                        ? t('userManagement.ptEligibleNo')
                        : t('userManagement.ptEligibleYes')}
                    </ReadField>
                    <ReadField label={t('userManagement.pfCap')}>
                      {(() => {
                        const m = String(profile.pf_calc_mode ?? '').trim();
                        if (m === 'none') return t('userManagement.pfCapNone');
                        if (m === 'total_12pct') return t('userManagement.pfCapTotal12pct');
                        if (m === 'basic_12pct' || profile.pf_cap_1800 === false)
                          return t('userManagement.pfCap12pct');
                        return t('userManagement.pfCap1800');
                      })()}
                    </ReadField>
                  </Box>
                </AccordionDetails>
              </Accordion>

              <Accordion defaultExpanded sx={accordionSx}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={sectionTitleSx}>{t('userManagement.sectionCareer')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {careers.length === 0 ? (
                    <Typography variant="body1" sx={valueSx}>
                      {t('userManagement.careerEmpty')}
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {careers.map((c, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            borderBottom:
                              idx < careers.length - 1
                                ? `1px solid ${theme.palette.divider}`
                                : 'none',
                            pb: idx < careers.length - 1 ? 1.5 : 0,
                          }}
                        >
                          <Typography variant="body1" sx={{ ...valueSx, fontWeight: 600 }}>
                            {c.company_name}
                            {c.position ? ` · ${c.position}` : ''}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {(c.start_date
                              ? new Date(c.start_date).toLocaleDateString(dateLocale)
                              : '—') +
                              ' ~ ' +
                              (c.end_date
                                ? new Date(c.end_date).toLocaleDateString(dateLocale)
                                : t('userManagement.careerPresent'))}
                          </Typography>
                          {c.description ? (
                            <Typography variant="body2" sx={{ ...valueSx, mt: 0.75 }}>
                              {c.description}
                            </Typography>
                          ) : null}
                        </Box>
                      ))}
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>

              <Accordion defaultExpanded sx={accordionSx}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={sectionTitleSx}>{t('userManagement.sectionEducation')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {educations.length === 0 ? (
                    <Typography variant="body1" sx={valueSx}>
                      {t('userManagement.educationEmpty')}
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {educations.map((e, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            borderBottom:
                              idx < educations.length - 1
                                ? `1px solid ${theme.palette.divider}`
                                : 'none',
                            pb: idx < educations.length - 1 ? 1.5 : 0,
                          }}
                        >
                          <Typography variant="body1" sx={{ ...valueSx, fontWeight: 600 }}>
                            {e.school_name}
                            {e.degree ? ` · ${e.degree}` : ''}
                            {e.major ? ` · ${e.major}` : ''}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {(e.start_date
                              ? new Date(e.start_date).toLocaleDateString(dateLocale)
                              : '—') +
                              ' ~ ' +
                              (e.end_date
                                ? new Date(e.end_date).toLocaleDateString(dateLocale)
                                : t('userManagement.educationPresent'))}
                          </Typography>
                          {e.description ? (
                            <Typography variant="body2" sx={{ ...valueSx, mt: 0.75 }}>
                              {e.description}
                            </Typography>
                          ) : null}
                        </Box>
                      ))}
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>

              <Accordion defaultExpanded sx={accordionSx}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={sectionTitleSx}>{t('userManagement.sectionBank')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      gap: 2.25,
                    }}
                  >
                    <ReadField label={t('userManagement.bankName')}>
                      {profile.bank_name || '—'}
                    </ReadField>
                    <ReadField label={t('userManagement.accountNumber')}>
                      {profile.bank_account
                        ? formatBankAccount(String(profile.bank_account))
                        : '—'}
                    </ReadField>
                    <ReadField label={t('userManagement.ifscCode')}>
                      {profile.bank_ifsc ? formatIfsc(String(profile.bank_ifsc)) : '—'}
                    </ReadField>
                  </Box>
                </AccordionDetails>
              </Accordion>

              <Accordion defaultExpanded sx={accordionSx}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={sectionTitleSx}>{t('userManagement.sectionAccount')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      gap: 2.25,
                    }}
                  >
                    <ReadField label={t('userManagement.userId')}>
                      <Box component="span" sx={{ fontWeight: 600 }}>
                        {profile.userid || '-'}
                      </Box>
                    </ReadField>
                    <ReadField label={t('userManagement.roleLabel')}>
                      {profile.role || '-'}
                    </ReadField>
                    <ReadField label={t('userManagement.createdAt')}>
                      {profile.created_at
                        ? new Date(profile.created_at).toLocaleDateString(dateLocale)
                        : '-'}
                    </ReadField>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={salaryDialogOpen}
        onClose={() => !salaryRevealing && setSalaryDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('personalSettings.salaryRevealTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('personalSettings.salaryRevealHint')}
          </Typography>
          {salaryDialogError ? (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>
              {salaryDialogError}
            </Alert>
          ) : null}
          <TextField
            autoFocus
            fullWidth
            type="password"
            label={t('personalSettings.currentPassword')}
            value={salaryPassword}
            onChange={(e) => setSalaryPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSalaryReveal();
              }
            }}
            disabled={salaryRevealing}
            sx={fieldSx}
            {...mvsOutlinedLabelProps}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSalaryDialogOpen(false)} disabled={salaryRevealing}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSalaryReveal()}
            disabled={salaryRevealing}
            sx={mvsBodyPrimaryBtnSx}
          >
            {salaryRevealing ? <CircularProgress size={18} color="inherit" /> : t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MyPersonalInfo;
