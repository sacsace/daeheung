import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Autocomplete,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
  LocalHospital as SickIcon,
  Person as PersonIcon,
  School as StudyIcon,
  Event as EventIcon,
  Work as WorkIcon,
  Favorite as FavoriteIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import { useStore, useMenuStore } from '../../store';
import { vacationService } from '../../services/api';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';
import { useTranslation } from 'react-i18next';

const VACATION_MENU_ROUTES = ['/hr/leave', '/my/leave'];

const VACATION_TYPE_KEYS = [
  'annual',
  'sick',
  'personal',
  'study',
  'maternity',
  'paternity',
  'marriage',
  'bereavement',
] as const;
type VacationTypeKey = (typeof VACATION_TYPE_KEYS)[number];

const VACATION_TYPE_ICONS: Record<VacationTypeKey | 'half', React.ReactNode> = {
  annual: <HomeIcon />,
  half: <HomeIcon />,
  sick: <SickIcon />,
  personal: <PersonIcon />,
  study: <StudyIcon />,
  maternity: <EventIcon />,
  paternity: <WorkIcon />,
  marriage: <FavoriteIcon />,
  bereavement: <GroupsIcon />,
};

interface User {
  id: number;
  username: string;
  email: string;
  department?: string;
  position?: string;
}

const VacationRequest: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const leaveBasePath = location.pathname.startsWith('/my/') ? '/my/leave' : '/hr/leave';
  const { id } = useParams<{ id?: string }>();
  const { user } = useStore();
  const { loading: menusLoading } = useMenuStore();

  const menuFlags = useMenuRoutePermissionFlags(VACATION_MENU_ROUTES);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [annualLeaveInfo, setAnnualLeaveInfo] = useState<any>(null);
  const [vacationPolicy, setVacationPolicy] = useState<{ annualLeaveStartDays: number; availableTypes?: string[] } | null>(null);
  const [formData, setFormData] = useState({
    vacationType: 'annual',
    startDate: '',
    endDate: '',
    reason: '',
    approvedBy: null as number | null
  });

  const steps = useMemo(
    () => [
      t('vacationManagement.request.stepLeaveInfo'),
      t('vacationManagement.request.stepApprovalInfo'),
      t('vacationManagement.request.stepReview')
    ],
    [t]
  );

  const allVacationTypes = useMemo(() => {
    const types: Array<{ key: string; name: string; icon: React.ReactNode }> = [];
    for (const key of VACATION_TYPE_KEYS) {
      types.push({
        key,
        name: t(`vacationManagement.${key}`),
        icon: VACATION_TYPE_ICONS[key],
      });
      if (key === 'annual') {
        types.push({
          key: 'half',
          name: t('vacationManagement.half'),
          icon: VACATION_TYPE_ICONS.half,
        });
      }
    }
    return types;
  }, [t]);

  const loadUsers = useCallback(async () => {
    try {
      const allUsers = await useReferenceDataStore.getState().fetchUsers({
        company_id: user?.company_id
      });
      const sameCompanyUsers = allUsers.filter(
        (u: any) => u.status === 'active' && u.company_id === user?.company_id && u.id !== user?.id
      );
      setUsers(sameCompanyUsers);
    } catch {
      /* ignore */
    }
  }, [user?.company_id, user?.id]);

  const loadVacation = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await vacationService.getVacation(parseInt(id));
      if (response.success && response.data) {
        const vacation = response.data;
        setFormData({
          vacationType: vacation.is_half_day && vacation.vacation_type === 'annual' ? 'half' : vacation.vacation_type,
          startDate: vacation.start_date,
          endDate: vacation.end_date,
          reason: vacation.reason,
          approvedBy: vacation.approved_by || null
        });
      } else {
        setError(t('vacationManagement.request.loadFailed'));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('vacationManagement.request.loadError'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    loadUsers();
    loadAnnualLeaveInfo();
    loadVacationPolicy();
    if (id) {
      loadVacation();
    }
  }, [id, loadUsers, loadVacation]);

  useEffect(() => {
    if (menusLoading || !user) return;
    const tabIndex = user.role === 'admin' || user.role === 'root' ? 1 : 0;
    if (!id && !menuFlags.canCreate) {
      setError(t('vacationManagement.noPermissionCreate'));
      const tmr = window.setTimeout(() => navigate(`${leaveBasePath}?tab=${tabIndex}`), 2000);
      return () => window.clearTimeout(tmr);
    }
    if (id && !menuFlags.canEdit) {
      setError(t('vacationManagement.noPermissionEditRequest'));
      const tmr = window.setTimeout(() => navigate(`${leaveBasePath}?tab=${tabIndex}`), 2000);
      return () => window.clearTimeout(tmr);
    }
  }, [
    id,
    user,
    menusLoading,
    menuFlags.canCreate,
    menuFlags.canEdit,
    navigate,
    t,
    leaveBasePath,
  ]);

  const cannotSaveByMenu =
    !menusLoading &&
    ((!id && !menuFlags.canCreate) ||
      (!!id && !menuFlags.canEdit));

  const loadVacationPolicy = async () => {
    try {
      const response = await vacationService.getVacationPolicy();
      if (response.success) {
        setVacationPolicy(response.data);
      }
    } catch {
      /* ignore */
    }
  };

  const loadAnnualLeaveInfo = async () => {
    try {
      const response = await vacationService.getAnnualLeaveInfo();
      if (response.success) {
        setAnnualLeaveInfo(response.data);
      }
    } catch {
      /* ignore */
    }
  };

  const isHalfDay = formData.vacationType === 'half';
  const usesAnnualBalance = formData.vacationType === 'annual' || isHalfDay;

  const calculateDays = (startDate: string, endDate: string, halfDay = isHalfDay): number => {
    if (!startDate || !endDate) return 0;
    if (halfDay) return startDate === endDate ? 0.5 : 0;
    const startYmd = String(startDate).slice(0, 10);
    const endYmd = String(endDate).slice(0, 10);
    const startMatch = startYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const endMatch = endYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!startMatch || !endMatch) return 0;
    const startUtc = Date.UTC(
      Number(startMatch[1]),
      Number(startMatch[2]) - 1,
      Number(startMatch[3])
    );
    const endUtc = Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3]));
    if (endUtc < startUtc) return 0;
    return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!formData.vacationType) {
        setError(t('vacationManagement.request.selectLeaveType'));
        return;
      }
      if (!formData.startDate || !formData.endDate) {
        setError(t('vacationManagement.request.enterDates'));
        return;
      }
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        setError(t('vacationManagement.request.startAfterEnd'));
        return;
      }
      if (isHalfDay && formData.startDate !== formData.endDate) {
        setError(t('vacationManagement.request.halfDaySameDate'));
        return;
      }
      if (usesAnnualBalance) {
        if (!annualLeaveInfo || !annualLeaveInfo.canUseAnnualLeave) {
          setError(t('vacationManagement.request.cannotUseAnnualLeave'));
          return;
        }
        if (annualLeaveInfo.availableDays <= 0) {
          setError(t('vacationManagement.request.noAnnualLeaveAvailable'));
          return;
        }
        const requestedDays = calculateDays(formData.startDate, formData.endDate);
        if (requestedDays > annualLeaveInfo.availableDays) {
          setError(
            t('vacationManagement.request.exceedsAnnualLeave', {
              days: annualLeaveInfo.availableDays
            })
          );
          return;
        }
      }
    } else if (activeStep === 1) {
      if (!formData.approvedBy) {
        setError(t('vacationManagement.request.selectApprover'));
        return;
      }
      if (!formData.reason.trim()) {
        setError(t('vacationManagement.request.enterReason'));
        return;
      }
    }
    setError(null);
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!id && !menuFlags.canCreate) {
      setError(t('vacationManagement.noPermissionCreate'));
      return;
    }
    if (id && !menuFlags.canEdit) {
      setError(t('vacationManagement.noPermissionEditRequest'));
      return;
    }

    const isHalf = formData.vacationType === 'half';
    const startDate = formData.startDate;
    const endDate = isHalf ? formData.startDate : formData.endDate;
    const days = calculateDays(startDate, endDate, isHalf);

    setSaving(true);
    try {
      const vacationData: any = {
        user_id: user?.id,
        vacation_type: isHalf ? 'annual' : formData.vacationType,
        start_date: startDate,
        end_date: endDate,
        days,
        is_half_day: isHalf,
        reason: formData.reason
      };

      if (formData.approvedBy) {
        vacationData.approved_by = formData.approvedBy;
      }

      const response = id
        ? await vacationService.updateVacation(parseInt(id), vacationData)
        : await vacationService.createVacation(vacationData);

      if (response.success) {
        setSuccess(
          id ? t('vacationManagement.request.updateSuccess') : t('vacationManagement.request.createSuccess')
        );
        setTimeout(() => {
          const tabIndex = user?.role === 'admin' || user?.role === 'root' ? 1 : 0;
          navigate(`${leaveBasePath}?tab=${tabIndex}`);
        }, 1500);
      } else {
        setError(response.message || t('vacationManagement.request.submitFailed'));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('vacationManagement.request.submitError'));
    } finally {
      setSaving(false);
    }
  };

  const vacationTypes = useMemo(() => {
    if (!vacationPolicy?.availableTypes || vacationPolicy.availableTypes.length === 0) {
      return allVacationTypes;
    }
    return allVacationTypes.filter((type) =>
      type.key === 'half'
        ? vacationPolicy.availableTypes!.includes('annual')
        : vacationPolicy.availableTypes!.includes(type.key)
    );
  }, [allVacationTypes, vacationPolicy?.availableTypes]);

  useEffect(() => {
    if (vacationTypes.length > 0 && !vacationTypes.find((type) => type.key === formData.vacationType)) {
      setFormData((prev) => ({ ...prev, vacationType: vacationTypes[0].key }));
    }
  }, [vacationTypes, formData.vacationType]);

  const selectedApprover = users.find((u) => u.id === formData.approvedBy);
  const selectedVacationType = vacationTypes.find((type) => type.key === formData.vacationType);

  const navigateToList = () => {
    const tabIndex = user?.role === 'admin' || user?.role === 'root' ? 1 : 0;
    navigate(`${leaveBasePath}?tab=${tabIndex}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0, backgroundColor: 'workArea.main', borderRadius: 2, minHeight: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={navigateToList} sx={{ mr: 2 }}>
          {t('vacationManagement.request.backToList')}
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {id ? t('vacationManagement.request.editLeaveRequest') : t('vacationManagement.request.newLeaveRequest')}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card sx={{ boxShadow: 2, borderRadius: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            <Step>
              <StepLabel>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {steps[0]}
                </Typography>
              </StepLabel>
              <StepContent>
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {t('vacationManagement.request.leaveTypeLabel')} *
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('vacationManagement.request.leaveTypeHint')}
                    </Typography>
                    <FormControl fullWidth required>
                      <Select
                        value={formData.vacationType}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            vacationType: nextType,
                            endDate: nextType === 'half' && prev.startDate ? prev.startDate : prev.endDate,
                          }));
                        }}
                        displayEmpty
                        sx={{
                          '& .MuiSelect-select': {
                            display: 'flex',
                            alignItems: 'center',
                            py: 1.5
                          }
                        }}
                      >
                        {vacationTypes.map((type) => (
                          <MenuItem key={type.key} value={type.key}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
                                {type.icon}
                              </Box>
                              <Typography>{type.name}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    {usesAnnualBalance && annualLeaveInfo && (
                      <Alert
                        severity={annualLeaveInfo.canUseAnnualLeave ? 'info' : 'warning'}
                        sx={{
                          borderRadius: 1,
                          '& .MuiAlert-message': { fontWeight: 500 }
                        }}
                      >
                        {annualLeaveInfo.canUseAnnualLeave ? (
                          <>
                            {annualLeaveInfo.leaveYearLabel && (
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, opacity: 0.85 }}>
                                {t('vacationManagement.annualLeaveYear', {
                                  label: annualLeaveInfo.leaveYearLabel || annualLeaveInfo.fiscalYearLabel,
                                  start: annualLeaveInfo.leaveYearStart || annualLeaveInfo.fiscalYearStart,
                                  end: annualLeaveInfo.leaveYearEnd || annualLeaveInfo.fiscalYearEnd
                                })}
                              </Typography>
                            )}
                            {t('vacationManagement.remainingAnnualLeave', {
                              days: annualLeaveInfo.availableDays
                            })}
                            {annualLeaveInfo.usedDays > 0 && (
                              <> ({t('vacationManagement.usedDays', { days: annualLeaveInfo.usedDays })})</>
                            )}
                            {annualLeaveInfo.totalEarnedDays > 0 && (
                              <> / {t('vacationManagement.totalEarnedDays', { days: annualLeaveInfo.totalEarnedDays })}</>
                            )}
                          </>
                        ) : (
                          <>
                            <Typography component="span">
                              {t('vacationManagement.request.daysUntilEligible', {
                                days: annualLeaveInfo.daysUntilEligible
                              })}
                            </Typography>
                            <br />
                            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                              {vacationPolicy && vacationPolicy.annualLeaveStartDays === 0
                                ? t('vacationManagement.request.annualLeaveImmediate')
                                : t('vacationManagement.request.annualLeaveAfterDays', {
                                    days: vacationPolicy?.annualLeaveStartDays || 240
                                  })}
                            </Typography>
                          </>
                        )}
                      </Alert>
                    )}
                    {formData.startDate && formData.endDate && !usesAnnualBalance && (
                      <Alert severity="info" sx={{ borderRadius: 1, '& .MuiAlert-message': { fontWeight: 500 } }}>
                        {t('vacationManagement.request.totalLeaveDays')}:{' '}
                        <strong>
                          {t('vacationManagement.request.daysCount', {
                            count: calculateDays(formData.startDate, formData.endDate)
                          })}
                        </strong>
                      </Alert>
                    )}
                    {formData.startDate && formData.endDate && usesAnnualBalance && (
                      <Alert severity="info" sx={{ borderRadius: 1, '& .MuiAlert-message': { fontWeight: 500 } }}>
                        {t('vacationManagement.request.requestedLeaveDays')}:{' '}
                        <strong>
                          {t('vacationManagement.request.daysCount', {
                            count: calculateDays(formData.startDate, formData.endDate)
                          })}
                        </strong>
                        {annualLeaveInfo && annualLeaveInfo.canUseAnnualLeave && (
                          <>
                            {' '}
                            / {t('vacationManagement.remainingAnnualLeave', { days: annualLeaveInfo.availableDays })}
                          </>
                        )}
                      </Alert>
                    )}
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {t('vacationManagement.request.startDateLabel')} *
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('vacationManagement.request.startDateHint')}
                    </Typography>
                    <TextField
                      fullWidth
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => {
                        const startDate = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          startDate,
                          endDate: prev.vacationType === 'half' ? startDate : prev.endDate,
                        }));
                      }}
                      required
                      sx={{ '& .MuiInputBase-input': { py: 1.5 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {t('vacationManagement.request.endDateLabel')} *
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {isHalfDay
                        ? t('vacationManagement.request.halfDaySameDateHint')
                        : t('vacationManagement.request.endDateHint')}
                    </Typography>
                    <TextField
                      fullWidth
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      disabled={isHalfDay}
                      required
                      sx={{ '& .MuiInputBase-input': { py: 1.5 } }}
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={
                      usesAnnualBalance &&
                      annualLeaveInfo &&
                      (!annualLeaveInfo.canUseAnnualLeave || annualLeaveInfo.availableDays <= 0)
                    }
                    sx={{
                      minWidth: 100,
                      py: 1.25,
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                  >
                    {t('vacationManagement.request.next')}
                  </Button>
                </Box>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {steps[1]}
                  </Typography>
                  {!formData.approvedBy && (
                    <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500 }}>
                      {t('vacationManagement.request.selectApproverHint')}
                    </Typography>
                  )}
                </Box>
              </StepLabel>
              <StepContent>
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {t('vacationManagement.request.approverLabel')} *
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('vacationManagement.request.approverHint')}
                    </Typography>
                    <Autocomplete
                      options={users}
                      getOptionLabel={(option) =>
                        `${option.username}${option.department ? ` (${option.department})` : ''}`
                      }
                      value={selectedApprover || null}
                      onChange={(_event, newValue) => {
                        setFormData({ ...formData, approvedBy: newValue?.id || null });
                        setError(null);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder={t('vacationManagement.request.approverPlaceholder')}
                          error={!formData.approvedBy}
                          required
                          sx={{
                            '& .MuiInputBase-input': { py: 1.5 },
                            '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' }
                          }}
                        />
                      )}
                      renderOption={(props, option) => (
                        <Box component="li" {...props} sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                              {option.username}
                            </Typography>
                            {option.department && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                {option.department} {option.position ? `· ${option.position}` : ''}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {t('vacationManagement.request.reasonLabel')} *
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('vacationManagement.request.reasonHint')}
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      required
                      placeholder={t('vacationManagement.request.reasonPlaceholder')}
                      sx={{ '& .MuiInputBase-root': { alignItems: 'flex-start' } }}
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    onClick={handleBack}
                    sx={{
                      minWidth: 100,
                      py: 1.25,
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontWeight: 500
                    }}
                  >
                    {t('vacationManagement.request.previous')}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={!formData.approvedBy}
                    sx={{
                      minWidth: 100,
                      py: 1.25,
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                  >
                    {t('vacationManagement.request.next')}
                  </Button>
                </Box>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {steps[2]}
                </Typography>
              </StepLabel>
              <StepContent>
                <Card variant="outlined" sx={{ mt: 1, p: 3, bgcolor: 'grey.50' }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        {t('vacationManagement.request.leaveTypeLabel')}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        {selectedVacationType?.icon}
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {selectedVacationType?.name}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        {t('vacationManagement.request.leaveDaysLabel')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, mb: 2 }}>
                        {formData.startDate && formData.endDate
                          ? t('vacationManagement.request.daysCount', {
                              count: calculateDays(formData.startDate, formData.endDate)
                            })
                          : '-'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        {t('vacationManagement.request.startDateLabel')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, mb: 2 }}>
                        {formData.startDate || '-'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        {t('vacationManagement.request.endDateLabel')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, mb: 2 }}>
                        {formData.endDate || '-'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        {t('vacationManagement.approver')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, mb: 2 }}>
                        {selectedApprover
                          ? `${selectedApprover.username}${
                              selectedApprover.department ? ` (${selectedApprover.department})` : ''
                            }`
                          : t('vacationManagement.unspecified')}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        {t('vacationManagement.reason')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                        {formData.reason || '-'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Card>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    onClick={handleBack}
                    sx={{
                      minWidth: 100,
                      py: 1.25,
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontWeight: 500
                    }}
                  >
                    {t('vacationManagement.request.previous')}
                  </Button>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={navigateToList}
                      disabled={saving}
                      sx={{
                        minWidth: 100,
                        py: 1.25,
                        borderRadius: 1.5,
                        textTransform: 'none',
                        fontWeight: 500
                      }}
                    >
                      {t('vacationManagement.request.cancel')}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                      disabled={saving || cannotSaveByMenu}
                      sx={{
                        minWidth: 120,
                        py: 1.25,
                        borderRadius: 1.5,
                        textTransform: 'none',
                        fontWeight: 600
                      }}
                    >
                      {saving ? t('vacationManagement.request.saving') : t('vacationManagement.request.save')}
                    </Button>
                  </Box>
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </CardContent>
      </Card>
    </Box>
  );
};

export default VacationRequest;
