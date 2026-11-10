import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Balance as BalanceIcon } from '@mui/icons-material';
import { mvsSearchFieldSx } from '../../theme/daeheungLayout';
import { getGlAccountLabel } from '../../utils/glAccountLabel';

export type VoucherLineRow = {
  lineNo: number;
  accountId?: number;
  accountName: string;
  debit: number;
  credit: number;
  narration?: string;
};

type GlAccountOption = {
  id: number;
  code: string;
  name: string;
  name_en?: string | null;
  account_type: string;
};

type Props = {
  lines: VoucherLineRow[];
  accounts: GlAccountOption[];
  onChange: (lines: VoucherLineRow[]) => void;
  readOnly?: boolean;
  compact?: boolean;
};

const VoucherLinesEditor: React.FC<Props> = ({
  lines,
  accounts,
  onChange,
  readOnly = false,
  compact = false,
}) => {
  const { t, i18n } = useTranslation();
  const ledgerAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'ledger'),
    [accounts]
  );

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const credit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    return { debit, credit, diff: debit - credit, balanced: Math.abs(debit - credit) < 0.01 };
  }, [lines]);

  const updateLine = (index: number, patch: Partial<VoucherLineRow>) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch, lineNo: i + 1 } : line)));
  };

  const addLine = () => {
    onChange([...lines, { lineNo: lines.length + 1, accountName: '', debit: 0, credit: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    onChange(lines.filter((_, i) => i !== index).map((line, i) => ({ ...line, lineNo: i + 1 })));
  };

  const autoBalanceLastLine = () => {
    if (lines.length < 2 || Math.abs(totals.diff) < 0.01) return;
    const lastIdx = lines.length - 1;
    const last = lines[lastIdx];
    const payable = ledgerAccounts.find((a) => a.code === '2101') || ledgerAccounts[0];
    const patch: Partial<VoucherLineRow> =
      totals.diff > 0
        ? { credit: Math.abs(totals.diff), debit: 0 }
        : { debit: Math.abs(totals.diff), credit: 0 };
    if (!last.accountId && payable) {
      patch.accountId = payable.id;
      patch.accountName = payable.name;
    }
    updateLine(lastIdx, patch);
  };

  const resolveSelected = (line: VoucherLineRow) =>
    ledgerAccounts.find((a) => a.id === line.accountId) ||
    ledgerAccounts.find((a) => a.name === line.accountName) ||
    null;

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={40}>{t('voucherLines.no')}</TableCell>
            <TableCell>{t('voucherLines.account')}</TableCell>
            <TableCell align="right" width={compact ? 110 : 130}>
              {t('voucherLines.debit')}
            </TableCell>
            <TableCell align="right" width={compact ? 110 : 130}>
              {t('voucherLines.credit')}
            </TableCell>
            {!readOnly && <TableCell width={40} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((line, index) => {
            const selected = resolveSelected(line);
            const displayName = selected
              ? getGlAccountLabel(selected, i18n.language)
              : line.accountName || '-';
            return (
              <TableRow key={`line-${index}`} hover={!readOnly}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  {readOnly ? (
                    <Typography variant="body2">{displayName}</Typography>
                  ) : (
                    <Autocomplete
                      size="small"
                      options={ledgerAccounts}
                      value={selected}
                      onChange={(_, account) =>
                        updateLine(index, {
                          accountId: account?.id,
                          accountName: account ? (account.name_en || account.name || '') : '',
                        })
                      }
                      getOptionLabel={(o) => getGlAccountLabel(o, i18n.language)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder={t('voucherLines.searchAccount')}
                          sx={mvsSearchFieldSx}
                        />
                      )}
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  {readOnly ? (
                    Number(line.debit || 0).toLocaleString()
                  ) : (
                    <TextField
                      size="small"
                      type="number"
                      value={line.debit || ''}
                      onChange={(e) =>
                        updateLine(index, { debit: Number(e.target.value) || 0, credit: 0 })
                      }
                      sx={{ ...mvsSearchFieldSx, width: 110 }}
                      inputProps={{ min: 0, style: { textAlign: 'right' } }}
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  {readOnly ? (
                    Number(line.credit || 0).toLocaleString()
                  ) : (
                    <TextField
                      size="small"
                      type="number"
                      value={line.credit || ''}
                      onChange={(e) =>
                        updateLine(index, { credit: Number(e.target.value) || 0, debit: 0 })
                      }
                      sx={{ ...mvsSearchFieldSx, width: 110 }}
                      inputProps={{ min: 0, style: { textAlign: 'right' } }}
                    />
                  )}
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    <IconButton size="small" onClick={() => removeLine(index)} disabled={lines.length <= 2}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell colSpan={2} align="right" sx={{ fontWeight: 700 }}>
              {t('voucherLines.total')}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
              {totals.debit.toLocaleString()}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
              {totals.credit.toLocaleString()}
            </TableCell>
            {!readOnly && <TableCell />}
          </TableRow>
        </TableBody>
      </Table>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" fontWeight={600} color={totals.balanced ? 'success.main' : 'error.main'}>
          {totals.balanced
            ? t('voucherLines.balanced')
            : t('voucherLines.unbalanced', { diff: Math.abs(totals.diff).toLocaleString() })}
        </Typography>
        {!readOnly && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {!totals.balanced && (
              <Button size="small" startIcon={<BalanceIcon />} onClick={autoBalanceLastLine}>
                {t('voucherLines.balanceLastLine')}
              </Button>
            )}
            <IconButton size="small" onClick={addLine}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default VoucherLinesEditor;
