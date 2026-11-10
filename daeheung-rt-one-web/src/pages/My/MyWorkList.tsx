import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsPageRootSx,
  mvsTableBodyRowSx,
  mvsTableHeadHighlightSx,
  mvsTableScrollSx,
} from '../../theme/daeheungLayout';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { showErrorPopup } from '../../utils/errorHandler';

type MyWorkTask = {
  id: string;
  boardId?: number;
  cardId?: number | null;
  boardName?: string;
  listName?: string;
  title?: string;
  status?: string;
  dueDate?: string | null;
};

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

/** 내 업무 > 내 업무 리스트 — 본인 담당 카드만 (MSV body 리스트 패턴) */
const MyWorkList: React.FC = () => {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const txt = (ko: string, en: string) => (isEn ? en : ko);
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<MyWorkTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/my-tasks', { params: { limit: 200 } });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setTasks(res.data.data);
      } else {
        setTasks([]);
      }
    } catch (error: any) {
      setTasks([]);
      showErrorPopup(error, txt('내 업무 목록을 불러오지 못했습니다.', 'Failed to load my work list.'));
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatStatus = (status?: string) => {
    switch (String(status || '').toLowerCase()) {
      case 'done':
      case 'completed':
        return txt('완료', 'Done');
      case 'in_progress':
      case 'progress':
        return txt('진행 중', 'In Progress');
      case 'todo':
      case 'pending':
        return txt('할 일', 'To Do');
      default:
        return status ? String(status) : '-';
    }
  };

  const headSx =
    typeof mvsTableHeadHighlightSx === 'function'
      ? mvsTableHeadHighlightSx(theme)
      : mvsTableHeadHighlightSx;
  const bodyRowSx =
    typeof mvsTableBodyRowSx === 'function' ? mvsTableBodyRowSx(theme) : mvsTableBodyRowSx;

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={txt('내 업무 리스트', 'My Work List')}
        description={txt(
          '본인에게 배정된 업무를 확인합니다.',
          'View tasks assigned to you.'
        )}
      />

      <Box sx={mvsBodyListZoneSx}>
        {loading ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {txt('내 업무 목록을 불러오는 중...', 'Loading my work list...')}
            </Typography>
          </Box>
        ) : tasks.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}
            >
              {txt('담당 업무가 없습니다.', 'No assigned work.')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              {txt(
                '보드에서 본인에게 배정된 업무가 여기 표시됩니다.',
                'Tasks assigned to you on boards will appear here.'
              )}
            </Typography>
          </Box>
        ) : (
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
              }}
            >
              <TableHead
                sx={{
                  ...(headSx as object),
                  '& .MuiTableCell-head': {
                    py: 0.75,
                    px: { xs: 1, sm: 1.25 },
                  },
                }}
              >
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      width: 56,
                      textAlign: 'center',
                    }}
                  >
                    {txt('No.', 'No.')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', width: '16%' }}>
                    {txt('보드', 'Board')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', width: '14%' }}>
                    {txt('리스트', 'List')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{txt('업무', 'Task')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', width: '12%' }}>
                    {txt('상태', 'Status')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', width: '14%' }}>
                    {txt('기한', 'Due')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={bodyRowSx}>
                {tasks.map((task, index) => {
                  const cardId =
                    task.cardId != null && Number(task.cardId) > 0
                      ? Number(task.cardId)
                      : (() => {
                          const m = String(task.id || '').match(/-(\d+)$/);
                          return m ? Number(m[1]) : 0;
                        })();
                  const canOpen = Boolean(task.boardId);
                  return (
                  <TableRow
                    key={task.id}
                    hover
                    sx={{ cursor: canOpen ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (!task.boardId) return;
                      const qs =
                        Number.isInteger(cardId) && cardId > 0 ? `?card=${cardId}` : '';
                      navigate(`/work/projects/${task.boardId}${qs}`);
                    }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'center', color: 'text.secondary' }}>
                      {index + 1}
                    </TableCell>
                    <TableCell
                      sx={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {task.boardName || '-'}
                    </TableCell>
                    <TableCell
                      sx={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {task.listName || '-'}
                    </TableCell>
                    <TableCell
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.title || '-'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatStatus(task.status)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString(isEn ? 'en-US' : 'ko-KR')
                        : '-'}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
};

export default MyWorkList;
