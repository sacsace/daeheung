import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsPageRootSx,
} from '../../theme/daeheungLayout';
import { useTranslation } from 'react-i18next';

const DOWNLOAD_HREF = `${process.env.PUBLIC_URL || ''}/downloads/daeheung-rt-one-notifier/Daeheung-RT-One-Notifier.zip`;

/** 알람 > 알림 프로그램 다운로드 */
const DesktopNotifierDownload: React.FC = () => {
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const txt = (ko: string, en: string) => (isEn ? en : ko);

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={txt('알림 프로그램', 'Desktop Notifier')}
        description={txt(
          '브라우저를 켜지 않아도 Windows 트레이에서 MVS 알림을 받을 수 있습니다.',
          'Receive MVS alerts in the Windows tray without keeping the browser open.'
        )}
      />

      <Card elevation={0} sx={mvsBodyCardSx}>
        <CardContent sx={{ p: 2.5 }}>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 0 }}>
            {txt(
              'v1.2: 웹에서 다른 기기로 로그인해도 알람 앱은 로그아웃되지 않습니다. 토큰을 자동 갱신합니다. 시작 프로그램 자동 등록은 기본 꺼짐입니다. 설치 후 트레이에서 다시 로그인하세요.',
              'v1.2: Signing in on the web elsewhere will not sign out this app. Tokens refresh automatically. Startup is off by default. Re-login in the tray after install.'
            )}
          </Alert>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            {txt('구성', 'Contents')}
          </Typography>
          <List dense disablePadding sx={{ mb: 2 }}>
            <ListItem disableGutters>
              <ListItemText
                primary={txt('Windows 트레이 상주', 'Windows tray resident')}
                secondary={txt('풍선 알림으로 새 알림 표시', 'Balloon tips for new alerts')}
              />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText
                primary={txt('웹과 독립 세션', 'Independent of web session')}
                secondary={txt(
                  '다른 곳 웹 로그인·중복 로그인에 영향받지 않음',
                  'Unaffected by web login on another device'
                )}
              />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText
                primary={txt('설치 / 제거 스크립트', 'Install / uninstall scripts')}
                secondary={txt('Install.bat · Uninstall.bat', 'Install.bat · Uninstall.bat')}
              />
            </ListItem>
          </List>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            {txt('설치 방법', 'How to install')}
          </Typography>
          <Typography variant="body2" color="text.secondary" component="div" sx={{ mb: 2 }}>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>{txt('ZIP 다운로드 후 압축 해제', 'Download ZIP and extract')}</li>
              <li>{txt('Install.bat 실행', 'Run Install.bat')}</li>
              <li>
                {txt(
                  'API 주소 입력 (예: https://서버주소/api) 후 MVS 계정으로 로그인',
                  'Enter API base (e.g. https://your-host/api) and sign in with your MVS account'
                )}
              </li>
            </ol>
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="contained"
              disableElevation
              startIcon={<DownloadIcon />}
              href={DOWNLOAD_HREF}
              download="Daeheung-RT-One-Notifier.zip"
              sx={mvsBodyPrimaryBtnSx}
            >
              {txt('알림 프로그램 다운로드', 'Download notifier')}
            </Button>
            <Button
              variant="outlined"
              href={DOWNLOAD_HREF}
              target="_blank"
              rel="noopener noreferrer"
              sx={mvsBodyOutlinedBtnSx}
            >
              {txt('새 탭에서 열기', 'Open in new tab')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DesktopNotifierDownload;
