import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Typography
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { accountingService } from '../../services/api';
import { useStore } from '../../store';

const formatJson = (value: any) => {
  if (!value) return '-';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const ExpenseTransferLog: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useStore();
  const [loading, setLoading] = useState(true);
  const [expense, setExpense] = useState<any>(null);
  const [error, setError] = useState('');
  const canViewTransferLog = Boolean(user?.is_payment_officer);

  useEffect(() => {
    const loadExpense = async () => {
      if (!id) return;
      if (!canViewTransferLog) {
        setError('송금 로그를 볼 권한이 없습니다.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await accountingService.getExpenseReport(Number(id));
        if (!response?.success) {
          throw new Error(response?.message || '지출결의서 조회 실패');
        }
        setExpense(response.data);
      } catch (err: any) {
        setError(err?.message || '송금 로그를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    loadExpense();
  }, [id, canViewTransferLog]);

  if (loading) {
    return (
      <Box sx={{ p: 0 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 0 }}>
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          돌아가기
        </Button>
      </Box>
    );
  }

  if (!expense) {
    return (
      <Box sx={{ p: 0 }}>
        <Typography>데이터가 없습니다.</Typography>
        <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          돌아가기
        </Button>
      </Box>
    );
  }

  const logs = Array.isArray(expense.bank_transfer_logs) ? expense.bank_transfer_logs : [];

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">송금 실행 로그 상세</Typography>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          돌아가기
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold">
            {expense.title || '지출결의서'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {expense.expense_id}
          </Typography>
          <Typography variant="body2">
            신청자: {expense.requester_name || '-'} · 금액: {expense.currency || 'INR'} {Number(expense.total_amount || 0).toLocaleString()}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`상태: ${expense.bank_transfer_status || '-'}`} />
            <Chip label={`은행: ${expense.bank_transfer_provider || '-'}`} />
            <Chip label={`참조: ${expense.bank_transfer_reference || '-'}`} />
          </Box>
          {expense.bank_transfer_error && (
            <Typography color="error" sx={{ mt: 2 }}>
              오류: {expense.bank_transfer_error}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            실행 내역
          </Typography>
          {logs.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              기록된 송금 로그가 없습니다.
            </Typography>
          )}
          {logs.map((log: any, index: number) => (
            <Box key={`${log.timestamp || index}`} sx={{ mb: 3 }}>
              <Typography variant="subtitle2">
                {log.timestamp ? new Date(log.timestamp).toLocaleString('ko-KR') : '-'}
                {' · '}
                {log.action || '-'}
                {' · '}
                {log.status || '-'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Provider: {log.provider || '-'}
              </Typography>
              {log.error && (
                <Typography color="error" sx={{ mb: 1 }}>
                  오류: {log.error}
                </Typography>
              )}
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Payload:
              </Typography>
              <Box component="pre" sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto' }}>
                {formatJson(log.payload)}
              </Box>
              <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
                Response:
              </Typography>
              <Box component="pre" sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto' }}>
                {formatJson(log.response)}
              </Box>
              {index < logs.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ExpenseTransferLog;
