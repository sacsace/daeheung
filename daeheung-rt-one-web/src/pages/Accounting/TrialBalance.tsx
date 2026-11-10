import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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

const TrialBalance: React.FC = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await accountingService.getTrialBalance({
        from: from || undefined,
        to: to || undefined,
      });
      setData(response?.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || '시산표 조회에 실패했습니다.');
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title="시산표"
        description="계정과목별 차변·대변 합계와 잔액을 확인합니다."
      />

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField size="small" type="date" label="시작일" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField size="small" type="date" label="종료일" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="contained" onClick={load}>조회</Button>
        </CardContent>
      </Card>

      <Card elevation={0} sx={mvsBodyCardSx}>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>코드</TableCell>
                  <TableCell>계정과목</TableCell>
                  <TableCell align="right">차변 (Dr)</TableCell>
                  <TableCell align="right">대변 (Cr)</TableCell>
                  <TableCell align="right">잔액</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data?.rows || []).map((row: any) => (
                  <TableRow key={row.accountId}>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell align="right">{Number(row.debit || 0).toLocaleString()}</TableCell>
                    <TableCell align="right">{Number(row.credit || 0).toLocaleString()}</TableCell>
                    <TableCell align="right">{Number(row.balance || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {data && (
                  <TableRow>
                    <TableCell colSpan={2} align="right" sx={{ fontWeight: 700 }}>합계</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{Number(data.totalDebit || 0).toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{Number(data.totalCredit || 0).toLocaleString()}</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {data && Math.abs(Number(data.totalDebit || 0) - Number(data.totalCredit || 0)) > 0.01 && (
            <Typography variant="caption" color="error.main" sx={{ mt: 1, display: 'block' }}>
              차변·대변 합계가 일치하지 않습니다.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError('')}>
        <Alert severity="error">{error}</Alert>
      </Snackbar>
    </Box>
  );
};

export default TrialBalance;
