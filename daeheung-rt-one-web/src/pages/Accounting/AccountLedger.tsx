import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsBodyCardSx, mvsPageRootSx } from '../../theme/daeheungLayout';
import { accountingService } from '../../services/api';

const AccountLedger: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState<number | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const loadAccounts = useCallback(async () => {
    const response = await accountingService.getGlAccounts({ ledgerOnly: true });
    const rows = Array.isArray(response?.data) ? response.data : [];
    setAccounts(rows);
    if (!accountId && rows[0]?.id) setAccountId(rows[0].id);
  }, [accountId]);

  const loadLedger = useCallback(async () => {
    if (!accountId) return;
    try {
      const response = await accountingService.getAccountLedger({
        accountId: Number(accountId),
        from: from || undefined,
        to: to || undefined,
      });
      setData(response?.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || '장부 조회에 실패했습니다.');
    }
  }, [accountId, from, to]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title="장부"
        description="계정과목별 원장을 조회합니다. Post된 전표만 반영됩니다."
      />

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>계정과목</InputLabel>
            <Select label="계정과목" value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField size="small" type="date" label="시작일" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField size="small" type="date" label="종료일" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="contained" onClick={loadLedger}>조회</Button>
        </CardContent>
      </Card>

      {data?.account && (
        <Card elevation={0} sx={mvsBodyCardSx}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              {data.account.code} · {data.account.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              기초잔액 {Number(data.openingBalance || 0).toLocaleString()} / 현재잔액 {Number(data.currentBalance || 0).toLocaleString()}
            </Typography>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>일자</TableCell>
                    <TableCell>전표번호</TableCell>
                    <TableCell>적요</TableCell>
                    <TableCell align="right">차변 (Dr)</TableCell>
                    <TableCell align="right">대변 (Cr)</TableCell>
                    <TableCell align="right">잔액</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data.entries || []).map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.voucherDate}</TableCell>
                      <TableCell>{entry.voucherNo}</TableCell>
                      <TableCell>{entry.narration || '-'}</TableCell>
                      <TableCell align="right">{Number(entry.debit || 0).toLocaleString()}</TableCell>
                      <TableCell align="right">{Number(entry.credit || 0).toLocaleString()}</TableCell>
                      <TableCell align="right">{Number(entry.runningBalance || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {(data.entries || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">해당 기간 장부 내역이 없습니다.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError('')}>
        <Alert severity="error">{error}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AccountLedger;
