import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Save as SaveIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { payrollService } from '../../services/api';
import {
  mvsBodyCardSx,
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsBodyPrimaryBtnSx,
  mvsBodySectionHeaderSx,
  mvsOutlinedLabelProps,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsTableBodyRowSx,
  mvsTableHeadHighlightSx,
} from '../../theme/daeheungLayout';

const FIELD_SX = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;

export type EmploymentTypeCode =
  | 'fulltime'
  | 'daily'
  | 'service'
  | 'contract'
  | 'parttime'
  | 'intern';

export type EmploymentSalaryBasis = 'monthly' | 'daily' | 'fixed_rest_monthly';

export type EmploymentTypePayConfig = {
  code: EmploymentTypeCode;
  isActive: boolean;
  salaryBasis: EmploymentSalaryBasis;
  noAttendance: 'full_month' | 'zero';
  prorateByAttendance: boolean;
  fixedRestDays: number;
};

const TYPE_ORDER: EmploymentTypeCode[] = [
  'fulltime',
  'daily',
  'service',
  'contract',
  'parttime',
  'intern',
];

const DEFAULT_FIXED_REST_DAYS = 4;

function defaultRow(code: EmploymentTypeCode): EmploymentTypePayConfig {
  if (code === 'daily') {
    return {
      code,
      isActive: true,
      salaryBasis: 'daily',
      noAttendance: 'zero',
      prorateByAttendance: false,
      fixedRestDays: DEFAULT_FIXED_REST_DAYS,
    };
  }
  if (code === 'service') {
    return {
      code,
      isActive: true,
      salaryBasis: 'fixed_rest_monthly',
      noAttendance: 'full_month',
      prorateByAttendance: false,
      fixedRestDays: DEFAULT_FIXED_REST_DAYS,
    };
  }
  return {
    code,
    isActive: true,
    salaryBasis: 'monthly',
    noAttendance: 'full_month',
    prorateByAttendance: true,
    fixedRestDays: DEFAULT_FIXED_REST_DAYS,
  };
}

function normalizeTypes(raw: unknown): EmploymentTypePayConfig[] {
  const list = Array.isArray((raw as any)?.types)
    ? ((raw as any).types as unknown[])
    : Array.isArray(raw)
      ? raw
      : [];
  const map = new Map<EmploymentTypeCode, EmploymentTypePayConfig>();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const code = (item as any).code as EmploymentTypeCode;
    if (!TYPE_ORDER.includes(code)) continue;
    const def = defaultRow(code);
    const salaryBasis: EmploymentSalaryBasis =
      (item as any).salaryBasis === 'daily' ||
      (item as any).salaryBasis === 'monthly' ||
      (item as any).salaryBasis === 'fixed_rest_monthly'
        ? (item as any).salaryBasis
        : def.salaryBasis;
    const restRaw = Math.floor(Number((item as any).fixedRestDays));
    map.set(code, {
      code,
      isActive: (item as any).isActive === false ? false : true,
      salaryBasis,
      noAttendance:
        (item as any).noAttendance === 'zero' || (item as any).noAttendance === 'full_month'
          ? (item as any).noAttendance
          : def.noAttendance,
      prorateByAttendance:
        salaryBasis === 'daily' || salaryBasis === 'fixed_rest_monthly'
          ? false
          : (item as any).prorateByAttendance === false
            ? false
            : true,
      fixedRestDays:
        Number.isFinite(restRaw) && restRaw >= 0 && restRaw <= 15
          ? restRaw
          : def.fixedRestDays,
    });
  }
  return TYPE_ORDER.map((code) => map.get(code) || defaultRow(code));
}

/** embedded: 사용자 관리 탭 */
export const EmploymentTypeManagementPanel: React.FC<{
  embedded?: boolean;
  companyId?: number | null;
  canEdit?: boolean;
}> = ({ embedded = false, companyId = null, canEdit = true }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [rows, setRows] = useState<EmploymentTypePayConfig[]>(() =>
    TYPE_ORDER.map((c) => defaultRow(c))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const scopedCompanyId =
    companyId != null && Number.isFinite(Number(companyId)) && Number(companyId) > 0
      ? Number(companyId)
      : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await payrollService.getEmploymentTypePaySettings(
        scopedCompanyId != null ? { company_id: scopedCompanyId } : undefined
      );
      if (res?.success) {
        setRows(normalizeTypes(res.data));
      } else {
        setRows(TYPE_ORDER.map((c) => defaultRow(c)));
      }
    } catch (e: any) {
      setError(e?.message || t('employmentTypeManagement.loadFailed'));
      setRows(TYPE_ORDER.map((c) => defaultRow(c)));
    } finally {
      setLoading(false);
    }
  }, [scopedCompanyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchRow = (code: EmploymentTypeCode, patch: Partial<EmploymentTypePayConfig>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.code !== code) return r;
        const next = { ...r, ...patch };
        if (next.salaryBasis === 'daily' || next.salaryBasis === 'fixed_rest_monthly') {
          next.prorateByAttendance = false;
        }
        if (next.salaryBasis === 'fixed_rest_monthly' && !next.fixedRestDays) {
          next.fixedRestDays = DEFAULT_FIXED_REST_DAYS;
        }
        return next;
      })
    );
  };

  const handleSave = async () => {
    if (scopedCompanyId == null) {
      setError(t('employmentTypeManagement.selectCompanyFirst'));
      return;
    }
    if (!canEdit) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await payrollService.updateEmploymentTypePaySettings({
        types: rows,
        company_id: scopedCompanyId,
      });
      if (res?.success) {
        setRows(normalizeTypes(res.data));
        setSuccess(t('employmentTypeManagement.saveSuccess'));
      } else {
        setError(res?.message || t('employmentTypeManagement.saveFailed'));
      }
    } catch (e: any) {
      setError(e?.message || t('employmentTypeManagement.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const headSx =
    typeof mvsTableHeadHighlightSx === 'function'
      ? mvsTableHeadHighlightSx(theme)
      : mvsTableHeadHighlightSx;
  const bodySx =
    typeof mvsTableBodyRowSx === 'function' ? mvsTableBodyRowSx(theme) : mvsTableBodyRowSx;

  const typeLabel = useMemo(
    () =>
      ({
        fulltime: t('userManagement.empFulltime'),
        daily: t('userManagement.empDaily'),
        service: t('userManagement.empService'),
        contract: t('userManagement.empContract'),
        parttime: t('userManagement.empParttime'),
        intern: t('userManagement.empIntern'),
      }) as Record<EmploymentTypeCode, string>,
    [t]
  );

  const content = (
    <>
      {error ? (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      ) : null}

      <Card elevation={0} sx={mvsBodyCardSx}>
        <Box sx={mvsBodySectionHeaderSx}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              {t('employmentTypeManagement.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {t('employmentTypeManagement.description')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            disableElevation
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            disabled={!canEdit || saving || loading || scopedCompanyId == null}
            onClick={() => void handleSave()}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('common.save')}
          </Button>
        </Box>

        <Box sx={{ ...mvsBodyListZoneSx, px: { xs: 1.5, sm: 2 }, pb: 2 }}>
          {scopedCompanyId == null ? (
            <Alert severity="info">{t('employmentTypeManagement.selectCompanyFirst')}</Alert>
          ) : loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <TableContainer sx={{ ...mvsBodyListTableSx, boxShadow: 'none' }}>
              <Table size="small">
                <TableHead sx={headSx}>
                  <TableRow>
                    <TableCell>{t('employmentTypeManagement.colType')}</TableCell>
                    <TableCell>{t('employmentTypeManagement.colActive')}</TableCell>
                    <TableCell>{t('employmentTypeManagement.colSalaryBasis')}</TableCell>
                    <TableCell>{t('employmentTypeManagement.colNoAttendance')}</TableCell>
                    <TableCell>{t('employmentTypeManagement.colProrate')}</TableCell>
                    <TableCell>{t('employmentTypeManagement.colFixedRestDays')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={bodySx}>
                  {rows.map((row) => {
                    const isFixedRest = row.salaryBasis === 'fixed_rest_monthly';
                    const isDaily = row.salaryBasis === 'daily';
                    return (
                      <TableRow key={row.code}>
                        <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {typeLabel[row.code]}
                        </TableCell>
                        <TableCell>
                          <FormControlLabel
                            control={
                              <Switch
                                size="small"
                                checked={row.isActive}
                                disabled={!canEdit}
                                onChange={(_, v) => patchRow(row.code, { isActive: v })}
                              />
                            }
                            label={
                              row.isActive
                                ? t('employmentTypeManagement.activeOn')
                                : t('employmentTypeManagement.activeOff')
                            }
                            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 180 }}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            value={row.salaryBasis}
                            disabled={!canEdit}
                            onChange={(e) =>
                              patchRow(row.code, {
                                salaryBasis: e.target.value as EmploymentSalaryBasis,
                              })
                            }
                            sx={FIELD_SX}
                            {...mvsOutlinedLabelProps}
                          >
                            <MenuItem value="monthly">
                              {t('employmentTypeManagement.basisMonthly')}
                            </MenuItem>
                            <MenuItem value="daily">
                              {t('employmentTypeManagement.basisDaily')}
                            </MenuItem>
                            <MenuItem value="fixed_rest_monthly">
                              {t('employmentTypeManagement.basisFixedRest')}
                            </MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell sx={{ minWidth: 160 }}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            value={row.noAttendance}
                            disabled={!canEdit}
                            onChange={(e) =>
                              patchRow(row.code, {
                                noAttendance: e.target.value as 'full_month' | 'zero',
                              })
                            }
                            sx={FIELD_SX}
                            {...mvsOutlinedLabelProps}
                          >
                            <MenuItem value="full_month">
                              {isFixedRest
                                ? t('employmentTypeManagement.noAttFullMonthFixedRest')
                                : t('employmentTypeManagement.noAttFullMonth')}
                            </MenuItem>
                            <MenuItem value="zero">
                              {t('employmentTypeManagement.noAttZero')}
                            </MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell>
                          <FormControlLabel
                            control={
                              <Switch
                                size="small"
                                checked={isDaily || isFixedRest ? false : row.prorateByAttendance}
                                disabled={!canEdit || isDaily || isFixedRest}
                                onChange={(_, v) => patchRow(row.code, { prorateByAttendance: v })}
                              />
                            }
                            label={
                              isDaily
                                ? t('employmentTypeManagement.prorateDailyN_A')
                                : isFixedRest
                                  ? t('employmentTypeManagement.prorateFixedRestN_A')
                                  : row.prorateByAttendance
                                    ? t('employmentTypeManagement.prorateOn')
                                    : t('employmentTypeManagement.prorateOff')
                            }
                            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 100 }}>
                          <TextField
                            type="number"
                            size="small"
                            fullWidth
                            disabled={!canEdit || !isFixedRest}
                            value={row.fixedRestDays}
                            inputProps={{ min: 0, max: 15, step: 1 }}
                            onChange={(e) => {
                              const n = Math.floor(Number(e.target.value));
                              patchRow(row.code, {
                                fixedRestDays:
                                  Number.isFinite(n) && n >= 0 && n <= 15
                                    ? n
                                    : DEFAULT_FIXED_REST_DAYS,
                              });
                            }}
                            sx={FIELD_SX}
                            {...mvsOutlinedLabelProps}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {t('employmentTypeManagement.hint')}
          </Typography>
        </Box>
      </Card>
    </>
  );

  if (embedded) return <Box>{content}</Box>;
  return <Box sx={{ p: { xs: 2, sm: 3 } }}>{content}</Box>;
};

export default EmploymentTypeManagementPanel;
