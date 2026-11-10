import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Checkbox,
  Typography,
  Box,
  LinearProgress,
  Alert
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { PayrollGridRow } from './payroll/payrollGridTypes';
import { toPayslipCompanyInfo, type PayslipCompanyInfo, type PayslipHeaderLayout } from './PayslipContent';
import { generatePayslipEmailArtifacts, payslipBlobToBase64 } from './payrollPayslipPdf';
import { buildDefaultPayslipMailIntro, buildPayslipEmailHtml } from './payslipEmailHtml';
import { payrollService } from '../../services/api';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { useStore } from '../../store';

type Props = {
  open: boolean;
  rows: PayrollGridRow[];
  /** 급여 확정 직후에는 이메일이 등록된 직원 전체에 즉시 발송 */
  autoSend?: boolean;
  headerLayout?: PayslipHeaderLayout;
  /** root 회사 선택 시 해당 회사 정보로 명세서·발송 (미지정 시 로그인 회사) */
  companyId?: number | null;
  onClose: () => void;
  onSent: (message: string) => void;
  onError: (message: string) => void;
};

const PayrollSendPayslipsDialog: React.FC<Props> = ({
  open,
  rows,
  autoSend = false,
  headerLayout = 'standard',
  companyId = null,
  onClose,
  onSent,
  onError
}) => {
  const { t } = useTranslation();
  const user = useStore((s) => s.user);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [companyInfo, setCompanyInfo] = useState<PayslipCompanyInfo | null>(null);
  const [companyInfoLoaded, setCompanyInfoLoaded] = useState(false);
  const autoSendStarted = useRef(false);
  const cancelRequestedRef = useRef(false);

  const resolvedCompanyId = useMemo(() => {
    if (companyId != null && Number(companyId) > 0) return Number(companyId);
    const loginId = Number(user?.company_id);
    return Number.isFinite(loginId) && loginId > 0 ? loginId : null;
  }, [companyId, user?.company_id]);

  useEffect(() => {
    if (open && rows.length) {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }, [open, rows]);

  useEffect(() => {
    let mounted = true;
    const loadCompanyInfo = async () => {
      setCompanyInfoLoaded(false);
      if (!open || resolvedCompanyId == null) {
        if (mounted) setCompanyInfo(null);
        if (mounted) setCompanyInfoLoaded(true);
        return;
      }
      try {
        const company = await useReferenceDataStore.getState().fetchCompanyById(resolvedCompanyId);
        if (!mounted) return;
        setCompanyInfo(toPayslipCompanyInfo(company));
      } catch {
        if (mounted) setCompanyInfo(null);
      } finally {
        if (mounted) setCompanyInfoLoaded(true);
      }
    };
    void loadCompanyInfo();
    return () => {
      mounted = false;
    };
  }, [open, resolvedCompanyId]);

  const rowsWithEmail = useMemo(
    () =>
      rows.map((r) => ({
        row: r,
        hasEmail: !!String(r.employee_email || '').trim()
      })),
    [rows]
  );

  const toggle = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const allIds = rowsWithEmail.filter((x) => x.hasEmail).map((x) => x.row.id);
    if (selected.size === allIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }, [rowsWithEmail, selected.size]);

  const handleCancelSend = useCallback(() => {
    if (sending) {
      cancelRequestedRef.current = true;
      return;
    }
    onClose();
  }, [onClose, sending]);

  const handleSend = useCallback(async (sendAllWithEmail = false) => {
    const toSend = rowsWithEmail.filter(
      (x) => x.hasEmail && (sendAllWithEmail || selected.has(x.row.id))
    );
    if (toSend.length === 0) {
      onError(t('payrollManagement.payslip.sendNoSelection'));
      return;
    }

    cancelRequestedRef.current = false;
    setSending(true);
    setProgress({ done: 0, total: toSend.length });
    let ok = 0;
    let fail = 0;
    let cancelled = false;

    try {
      for (let i = 0; i < toSend.length; i++) {
        if (cancelRequestedRef.current) {
          cancelled = true;
          break;
        }
        const { row } = toSend[i];
        try {
          const { pdfBlob, imageBlob } = await generatePayslipEmailArtifacts(row, companyInfo, {
            locale: 'en',
            headerLayout,
            companyId: resolvedCompanyId,
            purpose: 'email',
          });
          if (cancelRequestedRef.current) {
            cancelled = true;
            break;
          }
          const pdfB64 = await payslipBlobToBase64(pdfBlob);
          const imageB64 = await payslipBlobToBase64(imageBlob);
          const introText = buildDefaultPayslipMailIntro({
            name: row.employee_name,
            company: companyInfo?.name,
            period: row.working_month,
          });
          const htmlBody = buildPayslipEmailHtml(row, {
            companyInfo,
            companyId: resolvedCompanyId,
            introText,
            inlineImageCid: 'payslip@mvs',
          });
          if (cancelRequestedRef.current) {
            cancelled = true;
            break;
          }
          const res = await payrollService.sendPayrollPayslip(
            row.id,
            pdfB64,
            {
              ...(resolvedCompanyId != null ? { company_id: resolvedCompanyId } : {}),
              html_body: htmlBody,
              image_base64: imageB64,
              net_salary: Number(row.net_salary_payable) || undefined,
            }
          );
          if (res.success) ok += 1;
          else fail += 1;
        } catch {
          if (cancelRequestedRef.current) {
            cancelled = true;
            break;
          }
          fail += 1;
        }
        setProgress({ done: i + 1, total: toSend.length });
      }
      if (cancelled) {
        onSent(t('payrollManagement.payslip.sendCancelled', { ok, fail }));
      } else {
        onSent(t('payrollManagement.payslip.sendResult', { ok, fail }));
      }
      onClose();
    } catch (e: any) {
      onError(e?.message || t('payrollManagement.payslip.sendFailed'));
    } finally {
      cancelRequestedRef.current = false;
      setSending(false);
    }
  }, [
    companyInfo,
    headerLayout,
    onClose,
    onError,
    onSent,
    resolvedCompanyId,
    rowsWithEmail,
    selected,
    t
  ]);

  useEffect(() => {
    if (!open) {
      autoSendStarted.current = false;
      return;
    }
    if (!autoSend || sending || !companyInfoLoaded || autoSendStarted.current) return;
    autoSendStarted.current = true;
    void handleSend(true);
  }, [autoSend, companyInfoLoaded, handleSend, open, sending]);

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('payrollManagement.payslip.sendTitle')}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('payrollManagement.payslip.sendHint')}
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('payrollManagement.payslip.sendEmailNote')}
        </Alert>
        {sending ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('payrollManagement.payslip.sendCancelHint')}
          </Alert>
        ) : null}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={
                    selected.size > 0 && selected.size < rowsWithEmail.filter((x) => x.hasEmail).length
                  }
                  checked={
                    rowsWithEmail.filter((x) => x.hasEmail).length > 0 &&
                    selected.size === rowsWithEmail.filter((x) => x.hasEmail).length
                  }
                  onChange={toggleAll}
                  disabled={sending}
                />
              </TableCell>
              <TableCell>{t('payrollManagement.payslip.colName')}</TableCell>
              <TableCell>{t('payrollManagement.payslip.colEmail')}</TableCell>
              <TableCell>{t('payrollManagement.payslip.colPeriod')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rowsWithEmail.map(({ row, hasEmail }) => (
              <TableRow key={row.id} sx={{ opacity: hasEmail ? 1 : 0.5 }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    disabled={sending || !hasEmail}
                  />
                </TableCell>
                <TableCell>{row.employee_name}</TableCell>
                <TableCell>{hasEmail ? row.employee_email : t('payrollManagement.payslip.noEmail')}</TableCell>
                <TableCell>{row.working_month}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {sending && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100} />
            <Typography variant="caption" color="text.secondary">
              {progress.done} / {progress.total}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancelSend} color={sending ? 'warning' : 'inherit'}>
          {sending ? t('payrollManagement.payslip.cancelSending') : t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSend(false)}
          disabled={sending || rows.length === 0}
        >
          {t('payrollManagement.payslip.sendAction')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PayrollSendPayslipsDialog;
