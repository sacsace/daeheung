import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Alert,
  Tabs,
  Tab,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Divider,
  Avatar,
  Rating,
  Switch,
  FormControlLabel
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import {
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Insights as InsightsIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  Settings as SettingsIcon,
  History as HistoryIcon } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useStore } from '../../store';
import { api } from '../../services/api';

// TabPanel 컴포넌트 정의
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`recommendation-tabpanel-${index}`}
      aria-labelledby={`recommendation-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

// 추천 데이터 타입
interface RecommendationData {
  recommendations: Array<{
    id: string;
    type: 'product' | 'service' | 'content' | 'action';
    title: string;
    description: string;
    score: number;
    confidence: number;
    category: string;
    imageUrl?: string;
    link?: string;
  }>;
  userPreferences: Array<{
    preference: string;
    value: number;
    lastUpdated: string;
  }>;
  recommendationPerformance: Array<{
    month: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
  settings: {
    personalizationEnabled: boolean;
    feedbackCollectionEnabled: boolean;
    recommendationFrequency: 'daily' | 'weekly' | 'monthly';
    algorithmVersion: string;
  };
}

const RecommendationEngine: React.FC = () => {
  const { user } = useStore();
  const [recommendationData, setRecommendationData] = useState<RecommendationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [recommendationType, setRecommendationType] = useState('all');

  // 데이터 로드
  useEffect(() => {
    const fetchRecommendationData = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/ai/recommendation-engine?type=${recommendationType}`);
        if (response.data.success) {
          setRecommendationData(response.data.data);
        }
      } catch {
        setError('추천 엔진 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendationData();
  }, [recommendationType]);

  // 추천 업데이트
  const updateRecommendations = async () => {
    setLoading(true);
    try {
      const response = await api.post('/ai/update-recommendations', {
        userId: user?.id,
        preferences: recommendationData?.userPreferences,
        settings: recommendationData?.settings
      });
      if (response.data.success) {
        setRecommendationData(prev => prev ? {
          ...prev,
          recommendations: response.data.data.newRecommendations
        } : null);
      }
    } catch {
      setError('추천 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 설정 변경 핸들러
  const handleSettingChange = (settingName: keyof RecommendationData['settings'], value: any) => {
    setRecommendationData(prev => prev ? {
      ...prev,
      settings: {
        ...prev.settings,
        [settingName]: value
      }
    } : null);
  };

  if (loading) {
    return (
      <Box sx={{ py: 8, px: 0, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>추천 엔진 분석 중...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ ...mvsPageRootSx, maxWidth: '1400px' }}>
      <DaeheungPageHeader
        title="AI 추천 엔진"
        description="개인화된 추천을 통해 사용자 경험을 향상시키고 비즈니스 성과를 극대화합니다."
        icon={<PsychologyIcon color="primary" />}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 필터 및 액션 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              fullWidth
              size="small"
              select
              label="추천 타입"
              value={recommendationType}
              onChange={(e) => setRecommendationType(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="product">상품</MenuItem>
              <MenuItem value="service">서비스</MenuItem>
              <MenuItem value="content">콘텐츠</MenuItem>
              <MenuItem value="action">액션</MenuItem>
            </TextField>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={updateRecommendations}
              size="small"
            >
              추천 업데이트
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              size="small"
            >
              보고서 다운로드
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="추천 목록" icon={<InsightsIcon />} />
          <Tab label="사용자 선호도" icon={<PersonIcon />} />
          <Tab label="추천 성능" icon={<AssessmentIcon />} />
          <Tab label="설정" icon={<SettingsIcon />} />
        </Tabs>
      </Box>

      {/* 추천 목록 탭 */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 3 }}>
          {recommendationData?.recommendations?.map((rec, index) => (
            <Card key={index}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {rec.imageUrl && (
                    <Avatar src={rec.imageUrl} alt={rec.title} sx={{ width: 56, height: 56, mr: 2 }} />
                  )}
                  <Box>
                    <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {rec.title}
                      <Chip label={rec.type} size="small" variant="outlined" />
                    </Typography>
                    <Rating value={rec.score / 20} precision={0.5} readOnly size="small" />
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {rec.description}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip label={rec.category} size="small" color="primary" />
                  <Button 
                    size="small" 
                    variant="outlined" 
                    component="a"
                    href={rec.link || '#'}
                    target="_blank"
                    disabled={!rec.link}
                  >
                    자세히 보기
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </TabPanel>

      {/* 사용자 선호도 탭 */}
      <TabPanel value={activeTab} index={1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon color="primary" />
                나의 선호도
              </Typography>
              <List>
                {recommendationData?.userPreferences?.map((pref, index) => (
                  <React.Fragment key={index}>
                    <ListItem disablePadding>
                      <ListItemButton>
                        <ListItemIcon>
                          <CategoryIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary={pref.preference} 
                          secondary={`선호도: ${pref.value}점 (최근 업데이트: ${pref.lastUpdated})`} 
                        />
                        <Chip label={`${pref.value}점`} color={pref.value > 70 ? 'success' : pref.value > 40 ? 'warning' : 'error'} size="small" />
                      </ListItemButton>
                    </ListItem>
                    {index < (recommendationData.userPreferences?.length || 0) - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon color="primary" />
                선호도 변화 추이
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={recommendationData?.userPreferences || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="preference" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#8884d8" name="선호도 점수" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* 추천 성능 탭 */}
      <TabPanel value={activeTab} index={2}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssessmentIcon color="primary" />
                월별 추천 성능
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>월</TableCell>
                      <TableCell align="right">클릭 수</TableCell>
                      <TableCell align="right">전환 수</TableCell>
                      <TableCell align="right">매출</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recommendationData?.recommendationPerformance?.map((perf, index) => (
                      <TableRow key={index}>
                        <TableCell>{perf.month}</TableCell>
                        <TableCell align="right">{perf.clicks.toLocaleString()}</TableCell>
                        <TableCell align="right">{perf.conversions.toLocaleString()}</TableCell>
                        <TableCell align="right">Rs. {perf.revenue.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon color="primary" />
                추천 성능 차트
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={recommendationData?.recommendationPerformance || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="clicks" fill="#8884d8" name="클릭 수" />
                  <Bar dataKey="conversions" fill="#82ca9d" name="전환 수" />
                  <Bar dataKey="revenue" fill="#ffc658" name="매출" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* 설정 탭 */}
      <TabPanel value={activeTab} index={3}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon color="primary" />
                추천 엔진 설정
              </Typography>
              <List>
                <ListItem>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={recommendationData?.settings.personalizationEnabled || false}
                        onChange={(e) => handleSettingChange('personalizationEnabled', e.target.checked)}
                      />
                    }
                    label="개인화 추천 활성화"
                  />
                </ListItem>
                <ListItem>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={recommendationData?.settings.feedbackCollectionEnabled || false}
                        onChange={(e) => handleSettingChange('feedbackCollectionEnabled', e.target.checked)}
                      />
                    }
                    label="피드백 수집 활성화"
                  />
                </ListItem>
                <ListItem>
                  <FormControl fullWidth margin="normal">
                    <InputLabel>추천 빈도</InputLabel>
                    <Select
                      value={recommendationData?.settings.recommendationFrequency || 'daily'}
                      label="추천 빈도"
                      onChange={(e) => handleSettingChange('recommendationFrequency', e.target.value)}
                    >
                      <MenuItem value="daily">매일</MenuItem>
                      <MenuItem value="weekly">매주</MenuItem>
                      <MenuItem value="monthly">매월</MenuItem>
                    </Select>
                  </FormControl>
                </ListItem>
                <ListItem>
                  <ListItemText primary="알고리즘 버전" secondary={recommendationData?.settings.algorithmVersion || 'N/A'} />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>
    </Box>
  );
};

export default RecommendationEngine;