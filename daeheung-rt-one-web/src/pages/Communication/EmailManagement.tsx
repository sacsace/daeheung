import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Alert,
  Snackbar,
  InputAdornment,
  Divider,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Badge,
  ToggleButton,
  ToggleButtonGroup,
  Pagination
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Email as EmailIcon,
  Edit as DraftIcon,
  Inbox as InboxIcon,
  Outbox as OutboxIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  Archive as ArchiveIcon,
  Delete as DeleteIcon2,
  MarkEmailRead as MarkEmailReadIcon,
  MarkEmailUnread as MarkEmailUnreadIcon,
  AttachFile as AttachFileIcon } from '@mui/icons-material';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

interface Email {
  id: number;
  subject: string;
  sender: string;
  senderEmail: string;
  recipient: string;
  recipientEmail: string;
  content: string;
  status: 'draft' | 'sent' | 'received' | 'archived' | 'deleted';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  isRead: boolean;
  isStarred: boolean;
  attachments?: string[];
  sentAt?: string;
  receivedAt?: string;
  createdAt: string;
  folder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'archive';
}

const EmailManagement: React.FC = () => {
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const [emails, setEmails] = useState<Email[]>([]);
  const [filteredEmails, setFilteredEmails] = useState<Email[]>([]);
  const [, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'view'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState('inbox');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(15);

  // 샘플 데이터
  const sampleEmails: Email[] = [
    {
      id: 1,
      subject: '월간 보고서 제출 요청',
      sender: '김팀장',
      senderEmail: 'kim.team@company.com',
      recipient: '이직원',
      recipientEmail: 'lee.emp@company.com',
      content: '안녕하세요. 이번 달 월간 보고서를 제출해 주시기 바랍니다. 마감일은 2월 5일까지입니다.',
      status: 'received',
      priority: 'normal',
      isRead: false,
      isStarred: false,
      attachments: ['보고서양식.xlsx'],
      receivedAt: '2024-01-15 09:30:00',
      createdAt: '2024-01-15 09:30:00',
      folder: 'inbox'
    },
    {
      id: 2,
      subject: '회의 일정 변경 안내',
      sender: '박관리자',
      senderEmail: 'park.admin@company.com',
      recipient: '전체 직원',
      recipientEmail: 'all@company.com',
      content: '내일 예정된 회의가 오후 3시로 변경되었습니다. 참석 부탁드립니다.',
      status: 'received',
      priority: 'high',
      isRead: true,
      isStarred: true,
      receivedAt: '2024-01-14 14:20:00',
      createdAt: '2024-01-14 14:20:00',
      folder: 'inbox'
    },
    {
      id: 3,
      subject: '프로젝트 진행 상황 보고',
      sender: '최개발자',
      senderEmail: 'choi.dev@company.com',
      recipient: '김팀장',
      recipientEmail: 'kim.team@company.com',
      content: '현재 진행 중인 프로젝트의 진행 상황을 보고드립니다. 예정대로 진행되고 있습니다.',
      status: 'sent',
      priority: 'normal',
      isRead: true,
      isStarred: false,
      attachments: ['진행상황보고서.pdf'],
      sentAt: '2024-01-13 16:45:00',
      createdAt: '2024-01-13 16:45:00',
      folder: 'sent'
    },
    {
      id: 4,
      subject: '신규 시스템 도입 안내',
      sender: 'IT팀',
      senderEmail: 'it.team@company.com',
      recipient: '전체 직원',
      recipientEmail: 'all@company.com',
      content: '새로운 업무 시스템이 도입됩니다. 교육 일정은 별도 안내드리겠습니다.',
      status: 'draft',
      priority: 'urgent',
      isRead: false,
      isStarred: false,
      createdAt: '2024-01-12 11:00:00',
      folder: 'drafts'
    }
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterEmails();
  }, [emails, searchTerm, statusFilter, priorityFilter, folderFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setEmails(sampleEmails);
    } catch {
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const filterEmails = () => {
    let filtered = emails.filter(email => email.folder === folderFilter);

    if (searchTerm) {
      filtered = filtered.filter(email =>
        email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(email => email.status === statusFilter);
    }

    if (priorityFilter) {
      filtered = filtered.filter(email => email.priority === priorityFilter);
    }

    setFilteredEmails(filtered);
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'draft':
        return <Chip label="임시저장" color="default" size="small" />;
      case 'sent':
        return <Chip label="발송됨" color="success" size="small" />;
      case 'received':
        return <Chip label="수신됨" color="info" size="small" />;
      case 'archived':
        return <Chip label="보관됨" color="warning" size="small" />;
      case 'deleted':
        return <Chip label="삭제됨" color="error" size="small" />;
      default:
        return <Chip label="알 수 없음" color="default" size="small" />;
    }
  };

  const getPriorityChip = (priority: string) => {
    switch (priority) {
      case 'low':
        return <Chip label="낮음" color="default" size="small" />;
      case 'normal':
        return <Chip label="보통" color="info" size="small" />;
      case 'high':
        return <Chip label="높음" color="warning" size="small" />;
      case 'urgent':
        return <Chip label="긴급" color="error" size="small" />;
      default:
        return <Chip label="알 수 없음" color="default" size="small" />;
    }
  };

  const handleViewEmail = (email: Email) => {
    setSelectedEmail(email);
    setViewMode('view');
    // 읽음 처리
    if (!email.isRead) {
      setEmails(prev =>
        prev.map(e =>
          e.id === email.id ? { ...e, isRead: true } : e
        )
      );
    }
  };

  const handleStarEmail = (id: number) => {
    setEmails(prev =>
      prev.map(email =>
        email.id === id ? { ...email, isStarred: !email.isStarred } : email
      )
    );
  };

  const handleDeleteEmail = (id: number) => {
    showConfirm(
      '정말로 이 이메일을 삭제하시겠습니까?',
      () => {
        try {
          setEmails((prev) =>
            prev.map((email) => (email.id === id ? { ...email, folder: 'trash' as const } : email))
          );
          setSuccess('이메일이 삭제되었습니다.');
        } catch {
          setError('삭제 중 오류가 발생했습니다.');
        }
      },
      { title: '삭제 확인', confirmColor: 'error', confirmText: '삭제', cancelText: '취소' }
    );
  };

  const handleArchiveEmail = (id: number) => {
    setEmails(prev =>
      prev.map(email =>
        email.id === id ? { ...email, folder: 'archive' as const } : email
      )
    );
    setSuccess('이메일이 보관되었습니다.');
  };

  const inboxCount = emails.filter(email => email.folder === 'inbox' && !email.isRead).length;
  const sentCount = emails.filter(email => email.folder === 'sent').length;
  const draftCount = emails.filter(email => email.folder === 'drafts').length;
  const starredCount = emails.filter(email => email.isStarred).length;

  const paginatedEmails = filteredEmails.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  if (viewMode === 'view' && selectedEmail) {
    return (
      <Box sx={{ ...mvsPageRootSx }}>
        <DaeheungPageHeader
          title="이메일 상세"
          icon={<EmailIcon />}
          actions={
            <Button variant="outlined" onClick={() => setViewMode('list')}>
              목록으로
            </Button>
          }
        />

        <Card>
          <CardContent>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {selectedEmail.subject}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {getStatusChip(selectedEmail.status)}
                {getPriorityChip(selectedEmail.priority)}
                {selectedEmail.isStarred && (
                  <Chip label="중요" color="warning" size="small" />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                보낸이: {selectedEmail.sender} ({selectedEmail.senderEmail}) • 
                받는이: {selectedEmail.recipient} ({selectedEmail.recipientEmail}) • 
                {selectedEmail.sentAt ? `발송일: ${selectedEmail.sentAt}` : `수신일: ${selectedEmail.receivedAt}`}
              </Typography>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                {selectedEmail.content}
              </Typography>
            </Box>

            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>첨부파일</Typography>
                <List>
                  {selectedEmail.attachments.map((attachment, index) => (
                    <ListItem key={index}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <AttachFileIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={attachment}
                        secondary="다운로드"
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<ReplyIcon />}
              >
                답장
              </Button>
              <Button
                variant="outlined"
                startIcon={<ForwardIcon />}
              >
                전달
              </Button>
              <Button
                variant="outlined"
                startIcon={<ArchiveIcon />}
                onClick={() => handleArchiveEmail(selectedEmail.id)}
              >
                보관
              </Button>
              <Button
                variant="outlined"
                startIcon={<DeleteIcon2 />}
                onClick={() => handleDeleteEmail(selectedEmail.id)}
              >
                삭제
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title="이메일 관리"
        icon={<EmailIcon />}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={{ borderRadius: 2 }}
          >
            이메일 작성
          </Button>
        }
      />

      {/* 통계 카드 */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 2, 
        mb: 3 
      }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              받은편지함
            </Typography>
            <Typography variant="h4" color="primary.main">
              {inboxCount}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              보낸편지함
            </Typography>
            <Typography variant="h4" color="success.main">
              {sentCount}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              임시저장함
            </Typography>
            <Typography variant="h4" color="warning.main">
              {draftCount}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              중요 메일
            </Typography>
            <Typography variant="h4" color="error.main">
              {starredCount}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 폴더 선택 */}
      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={folderFilter}
          exclusive
          onChange={(_, newFolder) => newFolder && setFolderFilter(newFolder)}
          aria-label="folder selection"
        >
          <ToggleButton value="inbox" aria-label="inbox">
            <InboxIcon sx={{ mr: 1 }} />
            받은편지함
            {inboxCount > 0 && <Badge badgeContent={inboxCount} color="error" sx={{ ml: 1 }} />}
          </ToggleButton>
          <ToggleButton value="sent" aria-label="sent">
            <OutboxIcon sx={{ mr: 1 }} />
            보낸편지함
          </ToggleButton>
          <ToggleButton value="drafts" aria-label="drafts">
            <DraftIcon sx={{ mr: 1 }} />
            임시저장함
          </ToggleButton>
          <ToggleButton value="archive" aria-label="archive">
            <ArchiveIcon sx={{ mr: 1 }} />
            보관함
          </ToggleButton>
          <ToggleButton value="trash" aria-label="trash">
            <DeleteIcon2 sx={{ mr: 1 }} />
            휴지통
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 필터 및 검색 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr 1fr' },
            gap: 2, 
            alignItems: 'center' 
          }}>
            <TextField
              fullWidth
              size="small"
              label="검색"
              placeholder="제목, 발신자, 내용 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ) }}
            />
            <TextField
              fullWidth
              size="small"
              select
              label="상태"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">전체</MenuItem>
              <MenuItem value="draft">임시저장</MenuItem>
              <MenuItem value="sent">발송됨</MenuItem>
              <MenuItem value="received">수신됨</MenuItem>
              <MenuItem value="archived">보관됨</MenuItem>
              <MenuItem value="deleted">삭제됨</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              select
              label="우선순위"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">전체</MenuItem>
              <MenuItem value="low">낮음</MenuItem>
              <MenuItem value="normal">보통</MenuItem>
              <MenuItem value="high">높음</MenuItem>
              <MenuItem value="urgent">긴급</MenuItem>
            </TextField>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setPriorityFilter('');
              }}
            >
              초기화
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 이메일 목록 테이블 */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>중요</TableCell>
                <TableCell>읽음</TableCell>
                <TableCell>제목</TableCell>
                <TableCell>발신자</TableCell>
                <TableCell>우선순위</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>날짜</TableCell>
                <TableCell>작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedEmails.map((email) => (
                <TableRow key={email.id} hover>
                  <TableCell>
                    <IconButton 
                      size="small" 
                      onClick={() => handleStarEmail(email.id)}
                    >
                      {email.isStarred ? <StarIcon color="warning" /> : <StarBorderIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    {email.isRead ? (
                      <MarkEmailReadIcon color="action" />
                    ) : (
                      <MarkEmailUnreadIcon color="primary" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="subtitle2" 
                      fontWeight={email.isRead ? "normal" : "bold"}
                    >
                      {email.subject}
                    </Typography>
                    {email.attachments && email.attachments.length > 0 && (
                      <AttachFileIcon fontSize="small" color="action" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {email.sender}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {email.senderEmail}
                    </Typography>
                  </TableCell>
                  <TableCell>{getPriorityChip(email.priority)}</TableCell>
                  <TableCell>{getStatusChip(email.status)}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {email.sentAt || email.receivedAt}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="보기">
                        <IconButton size="small" onClick={() => handleViewEmail(email)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="답장">
                        <IconButton size="small">
                          <ReplyIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="보관">
                        <IconButton 
                          size="small" 
                          onClick={() => handleArchiveEmail(email.id)}
                        >
                          <ArchiveIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="삭제">
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteEmail(email.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 페이지네이션 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination
            count={Math.ceil(filteredEmails.length / itemsPerPage)}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      </Card>

      {/* 이메일 작성 다이얼로그 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          이메일 작성
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              이메일 정보를 입력해주세요.
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              이메일 작성 기능은 개발 중입니다.
        </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>취소</Button>
          <Button variant="contained">작성</Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
      >
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
      >
        <Alert onClose={() => setSuccess('')} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        confirmColor={dialogState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
};

export default EmailManagement;
