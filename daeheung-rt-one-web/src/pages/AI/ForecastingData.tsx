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
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  CircularProgress,
  List,
  ListItem,
  Divider
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import {
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Assessment as AssessmentIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  Download as DownloadIcon,
  Compare as CompareIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Analytics as AnalyticsIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Area, ComposedChart } from 'recharts';
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
      id={`forecasting-tabpanel-${index}`}
      aria-labelledby={`forecasting-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

// 예측 데이터 타입
interface ForecastingDataPayload {
  salesForecast: Array<{
    period: string;
    actual: number;
    predicted: number;
    confidence: number;
    variance: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  demandForecast: Array<{
    product: string;
    current: number;
    predicted: number;
    growth: number;
    seasonality: number;
    confidence: number;
  }>;
  costForecast: Array<{
    category: string;
    current: number;
    predicted: number;
    inflation: number;
    confidence: number;
  }>;
  resourceForecast: Array<{
    resource: string;
    current: number;
    predicted: number;
    capacity: number;
    utilization: number;
    bottleneck: boolean;
  }>;
  riskFactors: Array<{
    factor: string;
    probability: number;
    impact: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    mitigation: string;
  }>;
  scenarios: Array<{
    name: string;
    probability: number;
    description: string;
    outcomes: Array<{
      metric: string;
      value: number;
      change: number;
    }>;
  }>;
  accuracyMetrics: {
    mape: number;
    rmse: number;
    mae: number;
    r2: number;
  };
  aiInsights: Array<{
    id: string;
    type: 'trend' | 'anomaly' | 'pattern' | 'recommendation';
    title: string;
    description: string;
    confidence: number;
    impact: 'low' | 'medium' | 'high';
    timeframe: string;
  }>;
}

const ForecastingData: React.FC = () => {
  const [forecastingData, setForecastingData] = useState<ForecastingDataPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [forecastType, setForecastType] = useState('sales');
  const [timeHorizon, setTimeHorizon] = useState('6months');

  // 데이터 로드
  useEffect(() => {
    const fetchForecastingData = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/ai/forecasting-data?type=${forecastType}&horizon=${timeHorizon}`);
        if (response.data.success) {
          setForecastingData(response.data.data);
        }
      } catch {
        setError('예측 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchForecastingData();
  }, [forecastType, timeHorizon]);

  // AI 인사이트 생성
  const generateAIInsights = async () => {
    try {
      const response = await api.post('/ai/generate-forecasting-insights', {
        data: forecastingData
      });
      
      if (response.data.success) {
        setForecastingData(prev => prev ? {
          ...prev,
          aiInsights: [...prev.aiInsights, ...response.data.data.insights]
        } : null);
      }
    } catch {
      setError('AI 인사이트 생성에 실패했습니다.');
    }
  };

  // 색상 팔레트

  if (loading) {
    return (
      <Box sx={{ py: 8, px: 0, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>예측 데이터 분석 중...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ ...mvsPageRootSx, maxWidth: '1400px' }}>
      <DaeheungPageHeader
        title="예측 데이터 분석"
        description="AI 기반 미래 예측과 시나리오 분석을 제공합니다."
        icon={<TimelineIcon color="primary" />}
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
              label="예측 유형"
              value={forecastType}
              onChange={(e) => setForecastType(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="sales">매출 예측</MenuItem>
              <MenuItem value="demand">수요 예측</MenuItem>
              <MenuItem value="cost">비용 예측</MenuItem>
              <MenuItem value="resource">리소스 예측</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              select
              label="예측 기간"
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="3months">3개월</MenuItem>
              <MenuItem value="6months">6개월</MenuItem>
              <MenuItem value="1year">1년</MenuItem>
              <MenuItem value="2years">2년</MenuItem>
            </TextField>
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={generateAIInsights}
              size="small"
            >
              AI 인사이트 생성
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              size="small"
            >
              예측 보고서 다운로드
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 예측 정확도 지표 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AnalyticsIcon color="primary" />
            예측 정확도 지표
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {forecastingData?.accuracyMetrics?.mape?.toFixed(1) || 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">MAPE</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {forecastingData?.accuracyMetrics?.rmse?.toFixed(0) || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">RMSE</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {forecastingData?.accuracyMetrics?.mae?.toFixed(0) || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">MAE</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {forecastingData?.accuracyMetrics?.r2?.toFixed(3) || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">R²</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="매출 예측" icon={<AttachMoneyIcon />} />
          <Tab label="수요 예측" icon={<PeopleIcon />} />
          <Tab label="비용 예측" icon={<AssessmentIcon />} />
          <Tab label="리스크 분석" icon={<WarningIcon />} />
          <Tab label="AI 인사이트" icon={<PsychologyIcon />} />
        </Tabs>
      </Box>

      {/* 매출 예측 탭 */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoneyIcon color="primary" />
                매출 예측 차트
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={forecastingData?.salesForecast || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="actual" fill="#8884d8" fillOpacity={0.3} name="실제" />
                  <Line type="monotone" dataKey="predicted" stroke="#82ca9d" strokeWidth={3} name="예측" />
                  <Line type="monotone" dataKey="actual" stroke="#8884d8" strokeWidth={2} name="실제" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChartIcon color="primary" />
                매출 예측 상세
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>기간</TableCell>
                      <TableCell align="right">실제</TableCell>
                      <TableCell align="right">예측</TableCell>
                      <TableCell align="right">신뢰도</TableCell>
                      <TableCell align="right">편차</TableCell>
                      <TableCell align="center">트렌드</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {forecastingData?.salesForecast?.map((forecast, index) => (
                      <TableRow key={index}>
                        <TableCell>{forecast.period}</TableCell>
                        <TableCell align="right">Rs. {forecast.actual.toLocaleString()}</TableCell>
                        <TableCell align="right">Rs. {forecast.predicted.toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={forecast.confidence} 
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="body2">{forecast.confidence}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${forecast.variance > 0 ? '+' : ''}${forecast.variance.toFixed(1)}%`}
                            size="small"
                            color={Math.abs(forecast.variance) < 5 ? 'success' : Math.abs(forecast.variance) < 10 ? 'warning' : 'error'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {forecast.trend === 'up' ? <TrendingUpIcon color="success" /> :
                           forecast.trend === 'down' ? <TrendingDownIcon color="error" /> :
                           <TimelineIcon color="info" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* 수요 예측 탭 */}
      <TabPanel value={activeTab} index={1}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon color="primary" />
                제품별 수요 예측
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={forecastingData?.demandForecast || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="product" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="current" fill="#8884d8" name="현재" />
                  <Bar dataKey="predicted" fill="#82ca9d" name="예측" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PieChartIcon color="primary" />
                수요 예측 상세
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>제품</TableCell>
                      <TableCell align="right">현재</TableCell>
                      <TableCell align="right">예측</TableCell>
                      <TableCell align="right">성장률</TableCell>
                      <TableCell align="center">신뢰도</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {forecastingData?.demandForecast?.map((demand, index) => (
                      <TableRow key={index}>
                        <TableCell>{demand.product}</TableCell>
                        <TableCell align="right">{demand.current.toLocaleString()}</TableCell>
                        <TableCell align="right">{demand.predicted.toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${demand.growth > 0 ? '+' : ''}${demand.growth.toFixed(1)}%`}
                            size="small"
                            color={demand.growth > 0 ? 'success' : 'error'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={demand.confidence} 
                              sx={{ width: 40, height: 6 }}
                            />
                            <Typography variant="body2">{demand.confidence}%</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* 비용 예측 탭 */}
      <TabPanel value={activeTab} index={2}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssessmentIcon color="primary" />
                비용 예측 분석
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={forecastingData?.costForecast || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="current" stroke="#8884d8" strokeWidth={2} name="현재" />
                  <Line type="monotone" dataKey="predicted" stroke="#82ca9d" strokeWidth={2} name="예측" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon color="primary" />
                비용 예측 상세
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>카테고리</TableCell>
                      <TableCell align="right">현재</TableCell>
                      <TableCell align="right">예측</TableCell>
                      <TableCell align="right">인플레이션</TableCell>
                      <TableCell align="center">신뢰도</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {forecastingData?.costForecast?.map((cost, index) => (
                      <TableRow key={index}>
                        <TableCell>{cost.category}</TableCell>
                        <TableCell align="right">Rs. {cost.current.toLocaleString()}</TableCell>
                        <TableCell align="right">Rs. {cost.predicted.toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${cost.inflation > 0 ? '+' : ''}${cost.inflation.toFixed(1)}%`}
                            size="small"
                            color={cost.inflation > 0 ? 'error' : 'success'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={cost.confidence} 
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="body2">{cost.confidence}%</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* 리스크 분석 탭 */}
      <TabPanel value={activeTab} index={3}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="primary" />
                리스크 요인 분석
              </Typography>
              <List>
                {forecastingData?.riskFactors?.map((risk, index) => (
                  <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                      <Typography variant="subtitle1">{risk.factor}</Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip
                          label={`${(risk.probability * 100).toFixed(0)}%`}
                          size="small"
                          color={risk.probability > 0.7 ? 'error' : risk.probability > 0.4 ? 'warning' : 'success'}
                        />
                        <Chip
                          label={risk.impact}
                          size="small"
                          color={risk.impact === 'critical' ? 'error' : risk.impact === 'high' ? 'warning' : 'default'}
                        />
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {risk.description}
                    </Typography>
                    <Typography variant="body2" color="primary">
                      <strong>완화 방안:</strong> {risk.mitigation}
                    </Typography>
                    {index < (forecastingData?.riskFactors?.length || 0) - 1 && <Divider sx={{ mt: 2, width: '100%' }} />}
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CompareIcon color="primary" />
                시나리오 분석
              </Typography>
              <List>
                {forecastingData?.scenarios?.map((scenario, index) => (
                  <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                      <Typography variant="subtitle1">{scenario.name}</Typography>
                      <Chip
                        label={`${(scenario.probability * 100).toFixed(0)}%`}
                        size="small"
                        color="primary"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {scenario.description}
                    </Typography>
                    <Box sx={{ width: '100%' }}>
                      {scenario.outcomes.map((outcome, outcomeIndex) => (
                        <Box key={outcomeIndex} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">{outcome.metric}</Typography>
                          <Typography variant="body2" color={outcome.change > 0 ? 'success.main' : 'error.main'}>
                            {outcome.value} ({outcome.change > 0 ? '+' : ''}{outcome.change.toFixed(1)}%)
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                    {index < (forecastingData?.scenarios?.length || 0) - 1 && <Divider sx={{ mt: 2, width: '100%' }} />}
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* AI 인사이트 탭 */}
      <TabPanel value={activeTab} index={4}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 3 }}>
          {forecastingData?.aiInsights?.map((insight, index) => (
            <Card key={index}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6">{insight.title}</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={insight.type}
                      size="small"
                      color="primary"
                    />
                    <Chip
                      label={insight.impact}
                      size="small"
                      color={insight.impact === 'high' ? 'error' : insight.impact === 'medium' ? 'warning' : 'default'}
                    />
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {insight.description}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {insight.timeframe}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={insight.confidence} 
                      sx={{ width: 60, height: 6 }}
                    />
                    <Typography variant="body2">{insight.confidence}%</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </TabPanel>
    </Box>
  );
};

export default ForecastingData;