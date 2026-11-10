import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  TextField,
  Alert,
  CircularProgress,
  Autocomplete,
  InputAdornment,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import { RestartAlt as ResetIcon, Search as SearchIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { loginInfoService } from '../../services/api';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { useStore } from '../../store';
import { canAccessSystemLoginHistory } from '../../utils/canAccessSystemLoginHistory';
import {
  mvsKpiCardSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsTableHeadHighlightSx,
  mvsTableScrollSx,
  mvsBodyPaginationSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
} from '../../theme/daeheungLayout';
import { type SxProps, type Theme } from '@mui/material/styles';

const LOGS_PER_PAGE = 15;
const LOGIN_FILTER_OUTLINED = mvsOutlinedLabelProps;
const loginFilterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;

const loginHistoryTableBodyRowSx: SxProps<Theme> = (theme) => {
  const rowBg = theme.palette.mode === 'light' ? '#FFFFFF' : theme.palette.background.paper;
  const hoverBg = theme.palette.mode === 'light' ? '#EFF6FF' : theme.palette.action.hover;
  return {
    '& .MuiTableRow-root': { bgcolor: rowBg, cursor: 'pointer' },
    '& .MuiTableRow-root:hover': { bgcolor: hoverBg },
    '& .MuiTableCell-body': {
      py: 1,
      px: 1,
      fontSize: '0.8125rem',
      borderBottom: `1px solid ${theme.palette.mode === 'light' ? '#D1DAE4' : theme.palette.divider}`,
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
    },
    '& .MuiTableRow-root:last-of-type .MuiTableCell-body': { borderBottom: 'none' },
  };
};

interface Company {
  id: number;
  name: string;
}

interface LoginLog {
  id: number;
  tenant_id?: number | null;
  company_id?: number | null;
  user_id?: number | null;
  userid?: string | null;
  status: 'success' | 'failure';
  event_type?: string | null;
  reason?: string | null;
  resource?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  logged_at?: string;
  user?: {
    id: number;
    username?: string;
    userid?: string;
  } | null;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** 목록·상세용 로컬 시각 (초 단위까지, 잘림 없는 고정 포맷) */
function formatDateTimeExact(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** MSV 시스템 로그인 감사 로그 (시스템 설정 탭) */
const SystemLoginHistoryTab: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useStore();
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<LoginLog | null>(null);
  const [logFilters, setLogFilters] = useState({
    userid: '',
    status: '' as '' | 'success' | 'failure',
    event_type: '' as '' | 'login' | 'logout' | 'delete' | 'create' | 'update' | 'security',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const allowed = await canAccessSystemLoginHistory(user);
      if (cancelled) return;
      setHasAccess(allowed);
      setAccessChecked(true);
      if (!allowed) {
        setCompanies([]);
        setSelectedCompanyId('');
        setLoginLogs([]);
        setErrorMessage(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.company_id]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId),
    [companies, selectedCompanyId]
  );

  const logStats = useMemo(
    () => ({
      total: loginLogs.length,
      success: loginLogs.filter((log) => log.status === 'success').length,
      failure: loginLogs.filter((log) => log.status === 'failure').length,
    }),
    [loginLogs]
  );

  const totalPages = Math.max(1, Math.ceil(loginLogs.length / LOGS_PER_PAGE));
  const paginatedLogs = useMemo(
    () => loginLogs.slice((page - 1) * LOGS_PER_PAGE, page * LOGS_PER_PAGE),
    [loginLogs, page]
  );

  const hasActiveFilters = Boolean(
    logFilters.userid.trim() ||
      logFilters.status ||
      logFilters.event_type ||
      logFilters.start_date ||
      logFilters.end_date
  );

  const listStateBoxSx = {
    ...mvsBodyListTableSx,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    py: { xs: 6, sm: 8 },
    px: 3,
    gap: 1.5,
  } as const;

  const loadCompanies = useCallback(async () => {
    if (!hasAccess) {
      setCompanies([]);
      setSelectedCompanyId('');
      return;
    }
    try {
      const companyList = await useReferenceDataStore.getState().fetchCompanies();
      setCompanies(companyList);

      if (!companyList.length) {
        setSelectedCompanyId('');
        return;
      }

      const hasSelectedCompany =
        selectedCompanyId !== '' && companyList.some((company: Company) => company.id === selectedCompanyId);

      if (hasSelectedCompany) {
        return;
      }

      const userCompanyId = user?.company_id;
      const hasUserCompany = !!userCompanyId && companyList.some((company: Company) => company.id === userCompanyId);

      setSelectedCompanyId(hasUserCompany ? Number(userCompanyId) : companyList[0].id);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || t('loginInfoManagement.errors.loadCompaniesFailed'));
    }
  }, [hasAccess, selectedCompanyId, t, user?.company_id]);

  const loadLoginLogs = useCallback(
    async (companyId?: number, filters = logFilters) => {
      if (!hasAccess) {
        setLoginLogs([]);
        return;
      }
      setLogLoading(true);
      setErrorMessage(null);
      try {
        const response = await loginInfoService.getLoginLogs({
          company_id: companyId,
          userid: filters.userid.trim() || undefined,
          status: filters.status || undefined,
          event_type: filters.event_type || undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          limit: 300,
        });
        if (response?.success) {
          setLoginLogs(response.data || []);
        } else {
          setLoginLogs([]);
        }
      } catch (error: any) {
        setLoginLogs([]);
        setErrorMessage(error?.response?.data?.message || t('loginInfoManagement.errors.loadLogsFailed'));
      } finally {
        setLogLoading(false);
      }
    },
    [hasAccess, logFilters, t]
  );

  useEffect(() => {
    if (!accessChecked || !hasAccess) return;
    void loadCompanies();
  }, [accessChecked, hasAccess, loadCompanies]);

  useEffect(() => {
    if (!hasAccess) {
      setLoginLogs([]);
      return;
    }
    if (selectedCompanyId) {
      void loadLoginLogs(Number(selectedCompanyId));
    } else {
      setLoginLogs([]);
    }
  }, [hasAccess, loadLoginLogs, selectedCompanyId]);

  useEffect(() => {
    setPage(1);
  }, [selectedCompanyId, logFilters]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleLogSearch = async () => {
    if (!selectedCompanyId) {
      setErrorMessage(t('loginInfoManagement.errors.selectCompanyFirst'));
      return;
    }
    await loadLoginLogs(Number(selectedCompanyId));
  };

  const handleLogFilterReset = async () => {
    const nextFilters = {
      userid: '',
      status: '' as '' | 'success' | 'failure',
      event_type: '' as '' | 'login' | 'logout' | 'delete' | 'create' | 'update' | 'security',
      start_date: '',
      end_date: '',
    };
    setLogFilters(nextFilters);

    if (!selectedCompanyId) {
      setLoginLogs([]);
      return;
    }

    await loadLoginLogs(Number(selectedCompanyId), nextFilters);
  };

  const formatEventType = (value?: string | null) => {
    const key = String(value || 'login');
    const i18nKey = `loginInfoManagement.eventTypes.${key}`;
    const label = t(i18nKey);
    return label === i18nKey ? key : label;
  };

  const formatReason = (value?: string | null) => {
    if (!value) return '-';
    const i18nKey = `loginInfoManagement.reasonLabels.${value}`;
    const label = t(i18nKey);
    return label === i18nKey ? value : label;
  };

  const detailRows = useMemo(() => {
    if (!selectedLog) return [];
    const log = selectedLog;
    return [
      { label: t('loginInfoManagement.fields.loginAt'), value: formatDateTimeExact(log.logged_at) },
      { label: t('loginInfoManagement.fields.eventType'), value: formatEventType(log.event_type) },
      {
        label: t('loginInfoManagement.fields.result'),
        value:
          log.status === 'success'
            ? t('loginInfoManagement.status.success')
            : t('loginInfoManagement.status.failure'),
      },
      { label: t('loginInfoManagement.fields.userId'), value: log.userid || log.user?.userid || '-' },
      { label: t('loginInfoManagement.fields.userName'), value: log.user?.username || '-' },
      { label: 'IP', value: log.ip_address || '-' },
      { label: t('loginInfoManagement.fields.resource'), value: log.resource || '-' },
      { label: t('loginInfoManagement.fields.reason'), value: formatReason(log.reason) },
      {
        label: t('loginInfoManagement.fields.userAgent', { defaultValue: 'User-Agent' }),
        value: log.user_agent || '-',
      },
      { label: 'Log ID', value: String(log.id) },
      { label: 'User ID (DB)', value: log.user_id != null ? String(log.user_id) : '-' },
      { label: 'Company ID', value: log.company_id != null ? String(log.company_id) : '-' },
    ];
  }, [selectedLog, t]);

  if (!accessChecked) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {t('systemSettings.loginHistoryHint')}
      </Typography>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2.5,
          mb: 3,
        }}
      >
        {[
          { key: 'total', label: t('systemSettings.stats.logTotal'), value: logStats.total },
          { key: 'success', label: t('systemSettings.stats.logSuccess'), value: logStats.success },
          { key: 'failure', label: t('systemSettings.stats.logFailure'), value: logStats.failure },
        ].map((item) => (
          <Card key={item.key} elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {item.label}
              </Typography>
              <Typography
                variant="h5"
                sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}
              >
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card elevation={0} sx={mvsBodyCardSx}>
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            bgcolor: '#FFFFFF',
            ...(mvsSearchFieldSx as Record<string, unknown>),
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'minmax(220px, 300px) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto auto',
            },
            gap: 2,
            alignItems: 'flex-end',
          }}
        >
          <Autocomplete
            options={companies}
            value={selectedCompany || null}
            onChange={(_, newValue) => setSelectedCompanyId(newValue?.id ?? '')}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            sx={{ width: '100%', minWidth: 0 }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label={t('loginInfoManagement.fields.company')}
                {...LOGIN_FILTER_OUTLINED}
                placeholder={t('loginInfoManagement.placeholders.selectCompany')}
                sx={loginFilterFieldSx}
              />
            )}
          />
          <TextField
            fullWidth
            size="small"
            label={t('loginInfoManagement.fields.searchUserId')}
            {...LOGIN_FILTER_OUTLINED}
            placeholder={t('loginInfoManagement.placeholders.searchUserId')}
            value={logFilters.userid}
            onChange={(event) => setLogFilters((prev) => ({ ...prev, userid: event.target.value }))}
            sx={loginFilterFieldSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '1.125rem', color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            size="small"
            select
            label={t('loginInfoManagement.fields.result')}
            {...LOGIN_FILTER_OUTLINED}
            value={logFilters.status}
            SelectProps={{ displayEmpty: true }}
            onChange={(event) =>
              setLogFilters((prev) => ({
                ...prev,
                status: event.target.value as '' | 'success' | 'failure',
              }))
            }
            sx={loginFilterFieldSx}
          >
            <MenuItem value="">{t('loginInfoManagement.filters.all')}</MenuItem>
            <MenuItem value="success">{t('loginInfoManagement.status.success')}</MenuItem>
            <MenuItem value="failure">{t('loginInfoManagement.status.failure')}</MenuItem>
          </TextField>
          <TextField
            fullWidth
            size="small"
            select
            label={t('loginInfoManagement.fields.eventType')}
            {...LOGIN_FILTER_OUTLINED}
            value={logFilters.event_type}
            SelectProps={{ displayEmpty: true }}
            onChange={(event) =>
              setLogFilters((prev) => ({
                ...prev,
                event_type: event.target.value as typeof logFilters.event_type,
              }))
            }
            sx={loginFilterFieldSx}
          >
            <MenuItem value="">{t('loginInfoManagement.eventTypes.all')}</MenuItem>
            <MenuItem value="login">{t('loginInfoManagement.eventTypes.login')}</MenuItem>
            <MenuItem value="logout">{t('loginInfoManagement.eventTypes.logout')}</MenuItem>
            <MenuItem value="delete">{t('loginInfoManagement.eventTypes.delete')}</MenuItem>
            <MenuItem value="security">{t('loginInfoManagement.eventTypes.security')}</MenuItem>
          </TextField>
          <TextField
            fullWidth
            size="small"
            type="date"
            label={t('loginInfoManagement.fields.startDate')}
            {...LOGIN_FILTER_OUTLINED}
            value={logFilters.start_date}
            onChange={(event) => setLogFilters((prev) => ({ ...prev, start_date: event.target.value }))}
            InputLabelProps={{ ...LOGIN_FILTER_OUTLINED.InputLabelProps, shrink: true }}
            sx={loginFilterFieldSx}
          />
          <TextField
            fullWidth
            size="small"
            type="date"
            label={t('loginInfoManagement.fields.endDate')}
            {...LOGIN_FILTER_OUTLINED}
            value={logFilters.end_date}
            onChange={(event) => setLogFilters((prev) => ({ ...prev, end_date: event.target.value }))}
            InputLabelProps={{ ...LOGIN_FILTER_OUTLINED.InputLabelProps, shrink: true }}
            sx={loginFilterFieldSx}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<ResetIcon fontSize="small" />}
            onClick={() => void handleLogFilterReset()}
            sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap' }}
          >
            {t('loginInfoManagement.actions.reset')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            size="small"
            startIcon={<SearchIcon fontSize="small" />}
            onClick={() => void handleLogSearch()}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('loginInfoManagement.actions.search')}
          </Button>
        </Box>
      </Card>

      <Box sx={{ ...mvsBodyListZoneSx, mt: 2.5 }}>
        {logLoading ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {t('loginInfoManagement.empty.loading')}
            </Typography>
          </Box>
        ) : loginLogs.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
              {hasActiveFilters ? t('loginInfoManagement.empty.noResults') : t('loginInfoManagement.empty.noData')}
            </Typography>
            {hasActiveFilters ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ResetIcon fontSize="small" />}
                onClick={() => void handleLogFilterReset()}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('loginInfoManagement.actions.reset')}
              </Button>
            ) : null}
          </Box>
        ) : (
          <>
            <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
              <Table
                size="small"
                sx={{
                  tableLayout: 'fixed',
                  width: '100%',
                  borderCollapse: 'collapse',
                  bgcolor: 'transparent',
                  '& .MuiTableCell-root': {
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                  },
                  '& .MuiTableCell-head': {
                    px: 1,
                    py: 1,
                    whiteSpace: 'nowrap',
                  },
                }}
              >
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell sx={{ width: 44 }}>No</TableCell>
                    <TableCell sx={{ width: 158 }}>{t('loginInfoManagement.fields.loginAt')}</TableCell>
                    <TableCell sx={{ width: 72 }}>{t('loginInfoManagement.fields.eventType')}</TableCell>
                    <TableCell sx={{ width: 72 }}>{t('loginInfoManagement.fields.result')}</TableCell>
                    <TableCell sx={{ width: 168 }}>{t('loginInfoManagement.fields.userId')}</TableCell>
                    <TableCell sx={{ width: 120 }}>{t('loginInfoManagement.fields.userName')}</TableCell>
                    <TableCell sx={{ width: 118 }}>IP</TableCell>
                    <TableCell sx={{ width: 88 }}>{t('loginInfoManagement.fields.resource')}</TableCell>
                    <TableCell sx={{ width: 'auto' }}>{t('loginInfoManagement.fields.reason')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={loginHistoryTableBodyRowSx}>
                  {paginatedLogs.map((log, index) => (
                    <TableRow key={log.id} hover onClick={() => setSelectedLog(log)}>
                      <TableCell>{(page - 1) * LOGS_PER_PAGE + index + 1}</TableCell>
                      <TableCell
                        sx={{
                          fontVariantNumeric: 'tabular-nums',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                          fontSize: '0.75rem',
                        }}
                      >
                        {formatDateTimeExact(log.logged_at)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={formatEventType(log.event_type)}
                          color={
                            log.event_type === 'delete'
                              ? 'error'
                              : log.event_type === 'logout'
                                ? 'warning'
                                : 'default'
                          }
                          variant="outlined"
                          sx={{ height: 22, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={
                            log.status === 'success'
                              ? t('loginInfoManagement.status.success')
                              : t('loginInfoManagement.status.failure')
                          }
                          color={log.status === 'success' ? 'success' : 'error'}
                          variant={log.status === 'success' ? 'filled' : 'outlined'}
                          sx={{ height: 22, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } }}
                        />
                      </TableCell>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.userid || '-'}>
                        {log.userid || '-'}
                      </TableCell>
                      <TableCell
                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                        title={log.user?.username || '-'}
                      >
                        {log.user?.username || '-'}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                          fontSize: '0.75rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={log.ip_address || '-'}
                      >
                        {log.ip_address || '-'}
                      </TableCell>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.resource || '-'}>
                        {log.resource || '-'}
                      </TableCell>
                      <TableCell
                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                        title={formatReason(log.reason)}
                      >
                        {formatReason(log.reason)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={mvsBodyPaginationSx}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
                shape="rounded"
                sx={{
                  '& .MuiPaginationItem-root': {
                    borderRadius: '10px',
                    fontWeight: 500,
                  },
                }}
              />
            </Box>
          </>
        )}
      </Box>

      <Dialog
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
          {t('loginInfoManagement.detailTitle', { defaultValue: '로그인 이력 상세' })}
        </DialogTitle>
        <DialogContent dividers sx={{ px: 2.5, py: 1.5 }}>
          {detailRows.map((row, idx) => (
            <Box key={`${row.label}-${idx}`}>
              {idx > 0 ? <Divider sx={{ my: 1.25 }} /> : null}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, display: 'block', mb: 0.35 }}
              >
                {row.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: 'text.primary',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  fontFamily:
                    row.label === 'IP' ||
                    row.label === 'Log ID' ||
                    row.label === 'User ID (DB)' ||
                    row.label === 'Company ID'
                      ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
                      : 'inherit',
                  fontVariantNumeric:
                    row.label === t('loginInfoManagement.fields.loginAt') ? 'tabular-nums' : undefined,
                }}
              >
                {row.value}
              </Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={() => setSelectedLog(null)} variant="contained" disableElevation>
            {t('common.close', { defaultValue: '닫기' })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SystemLoginHistoryTab;
