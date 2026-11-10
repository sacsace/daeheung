import React from 'react';
import {
  Box,
  Typography,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Paper
} from '@mui/material';
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';

const RightSidebar: React.FC = () => {
  const location = useLocation();

  // 현재 페이지에 따른 컨텍스트 정보
  const getPageContext = () => {
    const path = location.pathname;
    
    if (path.includes('/company')) {
      return {
        title: '회사정보관리',
        icon: <BusinessIcon />,
        description: '회사 기본 정보, 은행 정보, 이미지 관리',
        status: 'active',
        items: [
          { label: '기본 정보', status: 'completed' },
          { label: '은행 정보', status: 'completed' },
          { label: '회사 로고', status: 'pending' },
          { label: '인감 이미지', status: 'pending' },
          { label: '대표 서명', status: 'pending' }
        ]
      };
    } else if (path.includes('/dashboard')) {
      return {
        title: '대시보드',
        icon: <TimelineIcon />,
        description: '시스템 현황 및 주요 지표',
        status: 'active',
        items: [
          { label: '시스템 상태', status: 'completed' },
          { label: '사용자 활동', status: 'completed' },
          { label: '성능 지표', status: 'completed' },
          { label: '알림 현황', status: 'pending' }
        ]
      };
    } else if (path.includes('/inventory')) {
      const stockIn = path.includes('/stock-in');
      const stockOut = path.includes('/stock-out');
      return {
        title: '재고관리',
        icon: <BusinessIcon />,
        description: '재고 현황 및 관리',
        status: 'active',
        items: [
          { label: '재고 현황', status: 'completed' },
          { label: '출고 관리', status: stockOut ? 'completed' : 'pending' },
          { label: '입고(품목 등록)', status: stockIn ? 'completed' : 'pending' },
          { label: '재고 조정', status: 'pending' }
        ]
      };
    } else if (path.includes('/quotation')) {
      return {
        title: '견적서관리',
        icon: <BusinessIcon />,
        description: '견적서 생성 및 관리',
        status: 'active',
        items: [
          { label: '견적서 목록', status: 'completed' },
          { label: '견적서 작성', status: 'pending' },
          { label: '승인 워크플로우', status: 'pending' },
          { label: '템플릿 관리', status: 'pending' }
        ]
      };
    } else if (path.includes('/e-invoice')) {
      return {
        title: 'E-인보이스',
        icon: <SecurityIcon />,
        description: 'GST 규정 준수 전자 인보이스',
        status: 'active',
        items: [
          { label: 'GST 설정', status: 'completed' },
          { label: 'IRN 생성', status: 'completed' },
          { label: 'QR 코드', status: 'completed' },
          { label: 'GST 포털 연동', status: 'pending' }
        ]
      };
    } else if (path.includes('/eway-bill')) {
      return {
        title: 'E-Way Bill',
        icon: <BusinessIcon />,
        description: '전자 운송장 관리',
        status: 'active',
        items: [
          { label: '운송 정보', status: 'completed' },
          { label: 'QR 코드 생성', status: 'completed' },
          { label: '상태 추적', status: 'pending' },
          { label: '자동 생성', status: 'pending' }
        ]
      };
    } else {
      return {
        title: '시스템관리',
        icon: <SettingsIcon />,
        description: '시스템 설정 및 관리',
        status: 'active',
        items: [
          { label: '기본 설정', status: 'completed' },
          { label: '사용자 관리', status: 'completed' },
          { label: '권한 관리', status: 'pending' },
          { label: '시스템 모니터링', status: 'pending' }
        ]
      };
    }
  };

  const context = getPageContext();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon sx={{ fontSize: '0.8rem' }} />;
      case 'pending': return <WarningIcon sx={{ fontSize: '0.8rem' }} />;
      default: return <InfoIcon sx={{ fontSize: '0.8rem' }} />;
    }
  };

  return (
    <Box
      sx={{
        width: 200,
        height: '100vh',
        position: 'fixed',
        right: 0,
        top: 64, // 헤더 높이만큼 아래
        bgcolor: 'background.paper',
        borderLeft: '1px solid',
        borderColor: 'divider',
        overflow: 'auto',
        zIndex: 1000
      }}
    >
      <Box sx={{ p: 2 }}>
        {/* 페이지 제목 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 32,
              height: 32,
              mr: 1
            }}
          >
            {context.icon}
          </Avatar>
          <Typography
            variant="h6"
            sx={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontSize: '1rem',
              fontWeight: 'bold',
              color: 'primary.main'
            }}
          >
            {context.title}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* 상태 표시 */}
        <Paper
          elevation={1}
          sx={{
            p: 2,
            mb: 2,
            bgcolor: context.status === 'active' ? 'success.light' : 'warning.light'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Chip
              label={context.status === 'active' ? '활성' : '대기'}
              size="small"
              color={context.status === 'active' ? 'success' : 'warning'}
              sx={{ fontSize: '0.7rem' }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {context.description}
          </Typography>
        </Paper>

        {/* 기능 목록 */}
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
            기능 현황
          </Typography>
          <List dense>
            {context.items.map((item, index) => (
              <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  {getStatusIcon(item.status)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                      {item.label}
                    </Typography>
                  }
                />
                <Chip
                  label={item.status === 'completed' ? '완료' : '대기'}
                  size="small"
                  color={getStatusColor(item.status) as any}
                  sx={{ fontSize: '0.6rem', height: 16 }}
                />
              </ListItem>
            ))}
          </List>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 시스템 정보 */}
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
            시스템 정보
          </Typography>
          <List dense>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <SecurityIcon sx={{ fontSize: '0.8rem' }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    보안 상태
                  </Typography>
                }
              />
              <Chip
                label="정상"
                size="small"
                color="success"
                sx={{ fontSize: '0.6rem', height: 16 }}
              />
            </ListItem>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <PersonIcon sx={{ fontSize: '0.8rem' }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    활성 사용자
                  </Typography>
                }
              />
              <Chip
                label="12"
                size="small"
                color="primary"
                sx={{ fontSize: '0.6rem', height: 16 }}
              />
            </ListItem>
          </List>
        </Box>
      </Box>
    </Box>
  );
};

export default RightSidebar;
