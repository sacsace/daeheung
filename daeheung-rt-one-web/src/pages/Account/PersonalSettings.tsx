import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  LockOutlined as LockIcon,
  PersonOutline as PersonIcon,
  PhotoCameraOutlined as PhotoCameraIcon,
  SaveOutlined as SaveIcon,
  Fingerprint as FingerprintIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsBodyCardSx,
  mvsBodyPrimaryBtnSx,
  mvsPageRootSx,
  mvsSearchFieldSx,
} from '../../theme/daeheungLayout';
import { userService } from '../../services/api';
import { useStore } from '../../store';
import { getUploadUrl } from '../../utils/uploadUrl';
import { formatPositionLabel } from '../../utils/positionLabels';
import {
  canUsePlatformPasskey,
  deletePasskeyCredential,
  listPasskeyCredentials,
  registerPlatformPasskey,
} from '../../utils/webauthn';

type PersonalProfile = {
  userid: string;
  username: string;
  email: string;
  role: string;
  department?: string | null;
  position?: string | null;
  employee_number?: string | null;
  birth_date?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  phone?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  avatar_url?: string | null;
};

const emptyProfile: PersonalProfile = {
  userid: '',
  username: '',
  email: '',
  role: '',
  department: '',
  position: '',
  employee_number: '',
  birth_date: '',
  gender: null,
  phone: '',
  address: '',
  emergency_contact: '',
  emergency_phone: '',
  avatar_url: null,
};

/** 사용자당 등록 가능한 생체 로그인 기기 최대 개수 (서버와 동일) */
const MAX_PASSKEY_DEVICES = 4;

const PersonalSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const updateUser = useStore((state) => state.updateUser);
  const [profile, setProfile] = useState<PersonalProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeys, setPasskeys] = useState<
    Array<{
      id: number;
      deviceName?: string | null;
      lastUsedAt?: string | null;
      createdAt?: string;
    }>
  >([]);
  const [passkeysLoading, setPasskeysLoading] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const loadPasskeys = async () => {
    setPasskeysLoading(true);
    try {
      const rows = await listPasskeyCredentials();
      setPasskeys(rows);
    } catch {
      setPasskeys([]);
    } finally {
      setPasskeysLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    userService
      .getMyProfile()
      .then((response) => {
        if (active && response?.success && response.data) {
          setProfile({ ...emptyProfile, ...response.data });
        }
      })
      .catch((loadError: any) => {
        if (active) {
          setError(
            loadError?.response?.data?.message ||
              t('personalSettings.errors.load')
          );
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
    let active = true;
    void canUsePlatformPasskey().then((ok) => {
      if (active) setPasskeyAvailable(ok);
    });
    void loadPasskeys();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const setField = (field: keyof PersonalProfile, value: string) => {
    setProfile((previous) => ({ ...previous, [field]: value }));
  };

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
      setProfile((previous) => ({ ...previous, avatar_url: nextAvatarUrl }));
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
    if (!profile.username.trim() || !profile.email.trim()) {
      setError(t('personalSettings.errors.required'));
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await userService.updateMyProfile({
        username: profile.username.trim(),
        email: profile.email.trim(),
        birth_date: profile.birth_date || null,
        gender: profile.gender || '',
        phone: profile.phone || '',
        address: profile.address || '',
        emergency_contact: profile.emergency_contact || '',
        emergency_phone: profile.emergency_phone || '',
      });
      if (!response?.success) throw new Error(response?.message);
      setProfile({ ...emptyProfile, ...response.data });
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

  const handleRegisterPasskey = async () => {
    if (passkeys.length >= MAX_PASSKEY_DEVICES) {
      setError(t('personalSettings.errors.passkeyLimit', { max: MAX_PASSKEY_DEVICES }));
      return;
    }
    setPasskeyBusy(true);
    setError('');
    setMessage('');
    try {
      await registerPlatformPasskey(t('personalSettings.passkeyThisDevice'));
      await loadPasskeys();
      setMessage(t('personalSettings.success.passkey'));
    } catch (passkeyError: any) {
      if (passkeyError?.name === 'NotAllowedError') {
        setError(t('personalSettings.errors.passkeyCancelled'));
      } else {
        setError(
          passkeyError?.response?.data?.message ||
            passkeyError?.message ||
            t('personalSettings.errors.passkey')
        );
      }
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleDeletePasskey = async (id: number) => {
    setPasskeyBusy(true);
    setError('');
    setMessage('');
    try {
      await deletePasskeyCredential(id);
      await loadPasskeys();
      setMessage(t('personalSettings.success.passkeyRemoved'));
    } catch (passkeyError: any) {
      setError(
        passkeyError?.response?.data?.message ||
          passkeyError?.message ||
          t('personalSettings.errors.passkeyRemove')
      );
    } finally {
      setPasskeyBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ ...mvsPageRootSx, display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  const fieldSx = {
    ...(mvsSearchFieldSx as Record<string, unknown>),
    '& .MuiOutlinedInput-root': { borderRadius: '8px' },
  };

  const displayAvatarSrc =
    avatarPreviewUrl || (profile.avatar_url ? getUploadUrl(profile.avatar_url) : undefined);

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={t('personalSettings.title')}
        description={t('personalSettings.description')}
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

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(320px, 1fr)' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Card elevation={0} sx={mvsBodyCardSx}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <PersonIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>
                {t('personalSettings.personalInfo')}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
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
                alt={profile.username}
                sx={{ width: 80, height: 80, bgcolor: 'action.selected', flexShrink: 0 }}
              >
                {(profile.username || '?').charAt(0).toUpperCase()}
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
                      savingPhoto ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />
                    }
                    onClick={handlePhotoSave}
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
                value={profile.username}
                onChange={(event) => setField('username', event.target.value)}
                required
                size="small"
                sx={fieldSx}
              />
              <TextField
                label={t('personalSettings.email')}
                type="email"
                value={profile.email}
                onChange={(event) => setField('email', event.target.value)}
                required
                size="small"
                sx={fieldSx}
              />
              <TextField
                label={t('personalSettings.birthDate')}
                type="date"
                value={profile.birth_date || ''}
                onChange={(event) => setField('birth_date', event.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                sx={fieldSx}
              />
              <TextField
                select
                label={t('personalSettings.gender')}
                value={profile.gender || ''}
                onChange={(event) => setField('gender', event.target.value)}
                size="small"
                sx={fieldSx}
              >
                <MenuItem value="">{t('personalSettings.notSet')}</MenuItem>
                <MenuItem value="male">{t('personalSettings.genderMale')}</MenuItem>
                <MenuItem value="female">{t('personalSettings.genderFemale')}</MenuItem>
                <MenuItem value="other">{t('personalSettings.genderOther')}</MenuItem>
              </TextField>
              <TextField
                label={t('personalSettings.phone')}
                value={profile.phone || ''}
                onChange={(event) => setField('phone', event.target.value)}
                size="small"
                sx={fieldSx}
              />
              <TextField
                label={t('personalSettings.emergencyContact')}
                value={profile.emergency_contact || ''}
                onChange={(event) => setField('emergency_contact', event.target.value)}
                size="small"
                sx={fieldSx}
              />
              <TextField
                label={t('personalSettings.emergencyPhone')}
                value={profile.emergency_phone || ''}
                onChange={(event) => setField('emergency_phone', event.target.value)}
                size="small"
                sx={fieldSx}
              />
              <TextField
                label={t('personalSettings.address')}
                value={profile.address || ''}
                onChange={(event) => setField('address', event.target.value)}
                multiline
                minRows={2}
                size="small"
                sx={{ ...fieldSx, gridColumn: { xs: '1', sm: '1 / -1' } }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2.5 }}>
              <Button
                variant="contained"
                disableElevation
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                onClick={handleProfileSave}
                disabled={saving}
                sx={mvsBodyPrimaryBtnSx}
              >
                {t('personalSettings.save')}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
              {t('personalSettings.companyManaged')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('personalSettings.companyManagedHint')}
            </Typography>
            <Box
              sx={{
                mt: 1.5,
                p: 2,
                bgcolor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              {[
                [t('personalSettings.userId'), profile.userid],
                [t('personalSettings.role'), profile.role],
                [t('personalSettings.department'), profile.department || '-'],
                [
                  t('personalSettings.position'),
                  formatPositionLabel(profile.position, i18n.language) || '-',
                ],
                [
                  t('personalSettings.employeeNumber'),
                  profile.employee_number
                    ? String(profile.employee_number).toUpperCase()
                    : '-',
                ],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Card elevation={0} sx={mvsBodyCardSx}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <LockIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>
                {t('personalSettings.passwordTitle')}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              {t('personalSettings.passwordHint')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label={t('personalSettings.currentPassword')}
                type="password"
                autoComplete="current-password"
                value={passwords.currentPassword}
                onChange={(event) =>
                  setPasswords((previous) => ({
                    ...previous,
                    currentPassword: event.target.value,
                  }))
                }
                size="small"
                sx={fieldSx}
              />
              <TextField
                label={t('personalSettings.newPassword')}
                type="password"
                autoComplete="new-password"
                value={passwords.newPassword}
                onChange={(event) =>
                  setPasswords((previous) => ({
                    ...previous,
                    newPassword: event.target.value,
                  }))
                }
                helperText={t('personalSettings.passwordRule')}
                size="small"
                sx={fieldSx}
              />
              <TextField
                label={t('personalSettings.confirmPassword')}
                type="password"
                autoComplete="new-password"
                value={passwords.confirmPassword}
                onChange={(event) =>
                  setPasswords((previous) => ({
                    ...previous,
                    confirmPassword: event.target.value,
                  }))
                }
                size="small"
                sx={fieldSx}
              />
              <Button
                variant="contained"
                disableElevation
                startIcon={
                  changingPassword ? <CircularProgress size={16} color="inherit" /> : <LockIcon />
                }
                onClick={handlePasswordChange}
                disabled={changingPassword}
                sx={{ ...mvsBodyPrimaryBtnSx, alignSelf: 'flex-end' }}
              >
                {t('personalSettings.changePassword')}
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card elevation={0} sx={mvsBodyCardSx}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <FingerprintIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>
                {t('personalSettings.passkeyTitle')}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('personalSettings.passkeyHint', { max: MAX_PASSKEY_DEVICES })}
            </Typography>

            {passkeysLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={22} />
              </Box>
            ) : passkeys.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('personalSettings.passkeyEmpty')}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {t('personalSettings.passkeyCount', {
                    count: passkeys.length,
                    max: MAX_PASSKEY_DEVICES,
                  })}
                </Typography>
                {passkeys.map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      px: 1.25,
                      py: 1,
                      border: '1px solid #E2E8F0',
                      borderRadius: '4px',
                      bgcolor: '#F8FAFC',
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {item.deviceName || t('personalSettings.passkeyThisDevice')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.lastUsedAt
                          ? t('personalSettings.passkeyLastUsed', {
                              date: new Date(item.lastUsedAt).toLocaleString(),
                            })
                          : t('personalSettings.passkeyNeverUsed')}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      disabled={passkeyBusy}
                      onClick={() => void handleDeletePasskey(item.id)}
                      sx={{ textTransform: 'none', flexShrink: 0 }}
                    >
                      {t('personalSettings.passkeyRemove')}
                    </Button>
                  </Box>
                ))}
              </Box>
            )}

            <Button
              variant="contained"
              disableElevation
              disabled={
                !passkeyAvailable ||
                passkeyBusy ||
                passkeys.length >= MAX_PASSKEY_DEVICES
              }
              startIcon={
                passkeyBusy ? <CircularProgress size={16} color="inherit" /> : <FingerprintIcon />
              }
              onClick={() => void handleRegisterPasskey()}
              sx={{ ...mvsBodyPrimaryBtnSx, alignSelf: 'flex-start' }}
            >
              {!passkeyAvailable
                ? t('personalSettings.passkeyUnavailable')
                : passkeys.length >= MAX_PASSKEY_DEVICES
                  ? t('personalSettings.passkeyLimitReached', { max: MAX_PASSKEY_DEVICES })
                  : t('personalSettings.passkeyRegister')}
            </Button>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default PersonalSettings;
