import React, { useState, useEffect, useCallback } from 'react';
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
  Divider,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import { alpha, useTheme } from '@mui/material/styles';
import { AutoAwesome as AutoAwesomeIcon, Download as DownloadIcon } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Area, PieChart, Pie, Cell } from 'recharts';
import { useMenuStore } from '../../store';
import { api } from '../../services/api';
import { mvsFilterToolbarSx, mvsSearchFieldSx, mvsInnerCardSx } from '../../theme/daeheungLayout';

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
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ px: { xs: 0, sm: 0.5 }, py: { xs: 2, sm: 2.5 } }}>{children}</Box>}
    </div>
  );
}

// AI 인사이트 타입 정의
interface AIInsight {
  id: string;
  type: 'cost_optimization' | 'workflow_improvement' | 'risk_alert' | 'efficiency_gain' | 'sustainability';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  data: any;
  createdAt: string;
  status: 'new' | 'reviewed' | 'implemented' | 'dismissed';
  priority: number;
  category: string;
  tags: string[];
  estimatedSavings?: number;
  implementationEffort?: 'low' | 'medium' | 'high';
  timeline?: string;
}

// 비용 분석 데이터 타입
interface CostAnalysisData {
  totalCost: number;
  monthlyTrend: Array<{
    month: string;
    cost: number;
    budget: number;
    variance: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
    color: string;
  }>;
  departmentCosts: Array<{
    department: string;
    cost: number;
    budget: number;
    efficiency: number;
  }>;
  costDrivers: Array<{
    driver: string;
    impact: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    recommendation: string;
  }>;
  aiInsights: AIInsight[];
  predictions: Array<{
    period: string;
    predictedCost: number;
    confidence: number;
    factors: string[];
  }>;
  benchmarks: Array<{
    metric: string;
    current: number;
    industry: number;
    best: number;
    unit: string;
  }>;
}

const CostAnalysis: React.FC = () => {
  const theme = useTheme();
  const { language } = useMenuStore();
  const txt = useCallback((ko: string, en: string) => (language === 'en' ? en : ko), [language]);
  /** API는 0~1 소수 또는 이미 퍼센트 값을 줄 수 있음 */
  const formatConfidencePercent = useCallback((value: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    if (n > 0 && n <= 1) return Math.round(n * 100);
    return Math.round(Math.min(100, Math.max(0, n)));
  }, []);
  const [analysisData, setAnalysisData] = useState<CostAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);
  const [openInsightDialog, setOpenInsightDialog] = useState(false);
  const [timeRange, setTimeRange] = useState('6months');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [aiProcessing, setAiProcessing] = useState(false);

  // 데이터 로드
  useEffect(() => {
    const fetchAnalysisData = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/ai/cost-analysis?range=${timeRange}&category=${selectedCategory}`);
        if (response.data.success) {
          setAnalysisData(response.data.data);
        }
      } catch {
        setError(
          language === 'en'
            ? 'Failed to load cost analysis data.'
            : '비용 분석 데이터를 불러오는데 실패했습니다.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, [timeRange, selectedCategory, language]);

  // AI 인사이트 생성
  const generateAIInsights = async () => {
    setAiProcessing(true);
    try {
      const response = await api.post('/ai/generate-insights', {
        type: 'cost_analysis',
        data: analysisData
      });
      
      if (response.data.success) {
        setAnalysisData(prev => prev ? {
          ...prev,
          aiInsights: [...prev.aiInsights, ...response.data.data.insights]
        } : null);
      }
    } catch {
      setError(
        language === 'en' ? 'Failed to generate insights.' : '인사이트 생성에 실패했습니다.'
      );
    } finally {
      setAiProcessing(false);
    }
  };

  // 인사이트 상태 업데이트
  const handleInsightStatusUpdate = async (insightId: string, status: string) => {
    try {
      await api.put(`/ai/insights/${insightId}/status`, { status });
      setAnalysisData(prev => prev ? {
        ...prev,
        aiInsights: prev.aiInsights.map(insight => 
          insight.id === insightId ? { ...insight, status: status as any } : insight
        )
      } : null);
    } catch {
      /* ignore */
    }
  };

  // 인사이트 상세 보기
  const handleInsightView = (insight: AIInsight) => {
    setSelectedInsight(insight);
    setOpenInsightDialog(true);
  };

  if (loading) {
    return (
      <Box sx={{ py: 8, px: 0, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2, fontSize: '0.9375rem' }}>{txt('분석 중...', 'Analyzing...')}</Typography>
      </Box>
    );
  }

  const cardShellSx = {
    borderRadius: '8px',
    border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.35 : 0.65)}`,
    boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)',
    bgcolor: 'background.paper',
    overflow: 'hidden' as const };

  const filterBarSx = {
    borderRadius: '8px',
    border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.35 : 0.65)}`,
    boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)',
    overflow: 'hidden' as const };

  const sectionTitleSx = {
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    lineHeight: 1.35,
    mb: 2,
    color: 'text.primary' };

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={txt('비용 분석', 'Cost Analysis')}
        description={txt(
          '최근 비용 추이와 카테고리별 지출을 분석하고, 절감 포인트와 향후 비용을 예측합니다.',
          'Analyzes recent spending by category and suggests savings and cost forecasts.'
        )}
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: '8px' }}
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}

      {/* 필터 및 액션 */}
      <Card elevation={0} sx={{ mb: 3, ...mvsFilterToolbarSx, ...mvsSearchFieldSx, ...filterBarSx }}>
        <CardContent sx={{ py: 2.5, px: { xs: 2, sm: 2.5 }, '&:last-child': { pb: 2.5 } }}>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              flexWrap: 'wrap',
              '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
              '& .MuiSelect-select': { fontSize: '0.875rem', fontWeight: 500, py: 1.1 },
              '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          >
            <FormControl size="small" sx={{ minWidth: 128 }}>
              <InputLabel shrink>{txt('기간', 'Period')}</InputLabel>
              <Select
                value={timeRange}
                label={txt('기간', 'Period')}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <MenuItem value="1month">{txt('1개월', '1 month')}</MenuItem>
                <MenuItem value="3months">{txt('3개월', '3 months')}</MenuItem>
                <MenuItem value="6months">{txt('6개월', '6 months')}</MenuItem>
                <MenuItem value="1year">{txt('1년', '1 year')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel shrink>{txt('카테고리', 'Category')}</InputLabel>
              <Select
                value={selectedCategory}
                label={txt('카테고리', 'Category')}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <MenuItem value="all">{txt('전체', 'All')}</MenuItem>
                <MenuItem value="operational">{txt('운영비', 'Operational')}</MenuItem>
                <MenuItem value="personnel">{txt('인사비', 'Personnel')}</MenuItem>
                <MenuItem value="technology">{txt('기술비', 'Technology')}</MenuItem>
                <MenuItem value="marketing">{txt('마케팅비', 'Marketing')}</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              disableElevation
              startIcon={<AutoAwesomeIcon />}
              onClick={generateAIInsights}
              disabled={aiProcessing}
              size="medium"
              sx={{
                fontSize: '0.875rem',
                fontWeight: 600,
                px: 2.25,
                py: 1.1,
                borderRadius: '8px',
                textTransform: 'none' }}
            >
              {aiProcessing ? txt('분석 중...', 'Analyzing...') : txt('인사이트 생성', 'Generate insights')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              size="medium"
              sx={{
                fontSize: '0.875rem',
                fontWeight: 600,
                px: 2.25,
                py: 1.1,
                borderRadius: '8px',
                textTransform: 'none',
                borderColor: alpha(theme.palette.divider, 0.95) }}
            >
              {txt('보고서 다운로드', 'Download report')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 탭 — 세그먼트 컨트롤 스타일 */}
      <Box
        sx={{
          mb: 3,
          p: 0.5,
          borderRadius: '8px',
          bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.12 : 0.08),
          border: `1px solid ${alpha(theme.palette.divider, 0.55)}` }}
      >
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
          sx={{
            minHeight: 44,
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTab-root': {
              fontSize: '0.8125rem',
              fontWeight: 600,
              minHeight: 40,
              py: 1,
              textTransform: 'none',
              letterSpacing: '-0.01em',
              borderRadius: '8px',
              mx: 0.25,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'text.primary',
                bgcolor: 'background.paper',
                boxShadow: '0 1px 4px rgba(15, 23, 42, 0.08)' } } }}
        >
          <Tab label={txt('개요', 'Overview')} />
          <Tab label={txt('인사이트', 'Insights')} />
          <Tab label={txt('예측 분석', 'Forecast')} />
          <Tab label={txt('벤치마킹', 'Benchmarks')} />
        </Tabs>
      </Box>

      {/* 개요 탭 */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
          {/* 총 비용 카드 */}
          <Card elevation={0} sx={{ ...mvsInnerCardSx, ...cardShellSx }}>
            <CardContent sx={{ py: 2.75, px: { xs: 2.25, sm: 3 }, '&:last-child': { pb: 2.75 } }}>
              <Typography component="h2" variant="h6" sx={sectionTitleSx}>
                {txt('총 비용', 'Total cost')}
              </Typography>
              <Typography variant="h4" color="primary.main" sx={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Rs. {analysisData?.totalCost?.toLocaleString() || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mt: 0.5 }}>
                {txt('현재 기간 기준', 'For the selected period')}
              </Typography>
            </CardContent>
          </Card>

          {/* 월별 트렌드 */}
          <Card elevation={0} sx={{ gridColumn: 'span 2', ...mvsInnerCardSx, ...cardShellSx }}>
            <CardContent sx={{ py: 2.75, px: { xs: 2.25, sm: 3 }, '&:last-child': { pb: 2.75 } }}>
              <Typography component="h2" variant="h6" sx={sectionTitleSx}>
                {txt('월별 비용 트렌드', 'Monthly cost trend')}
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={analysisData?.monthlyTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="cost" fill="#8884d8" fillOpacity={0.3} />
                  <Line type="monotone" dataKey="budget" stroke="#82ca9d" strokeWidth={2} />
                  <Line type="monotone" dataKey="cost" stroke="#8884d8" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 카테고리별 분석 */}
          <Card elevation={0} sx={{ gridColumn: 'span 2', ...mvsInnerCardSx, ...cardShellSx }}>
            <CardContent sx={{ py: 2.75, px: { xs: 2.25, sm: 3 }, '&:last-child': { pb: 2.75 } }}>
              <Typography component="h2" variant="h6" sx={sectionTitleSx}>
                {txt('카테고리별 비용 분석', 'Cost by category')}
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analysisData?.categoryBreakdown || []}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="amount"
                    label={({ category, percentage }) => `${category} ${percentage}%`}
                  >
                    {(analysisData?.categoryBreakdown || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 부서별 비용 */}
          <Card elevation={0} sx={{ gridColumn: 'span 2', ...mvsInnerCardSx, ...cardShellSx }}>
            <CardContent sx={{ py: 2.75, px: { xs: 2.25, sm: 3 }, '&:last-child': { pb: 2.75 } }}>
              <Typography component="h2" variant="h6" sx={sectionTitleSx}>
                {txt('부서별 비용 효율성', 'Department cost efficiency')}
              </Typography>
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  borderRadius: '8px',
                  border: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
                  overflow: 'hidden' }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{txt('부서', 'Department')}</TableCell>
                      <TableCell align="right">{txt('비용', 'Cost')}</TableCell>
                      <TableCell align="right">{txt('예산', 'Budget')}</TableCell>
                      <TableCell align="right">{txt('효율성', 'Efficiency')}</TableCell>
                      <TableCell align="center">{txt('상태', 'Status')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysisData?.departmentCosts?.map((dept, index) => (
                      <TableRow key={index}>
                        <TableCell>{dept.department}</TableCell>
                        <TableCell align="right">Rs. {dept.cost.toLocaleString()}</TableCell>
                        <TableCell align="right">Rs. {dept.budget.toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={dept.efficiency} 
                              sx={{ width: 100, height: 8 }}
                            />
                            <Typography variant="body2">{dept.efficiency}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={
                              dept.efficiency > 80
                                ? txt('우수', 'Excellent')
                                : dept.efficiency > 60
                                  ? txt('양호', 'Good')
                                  : txt('개선필요', 'Needs improvement')
                            }
                            size="small"
                            color={dept.efficiency > 80 ? 'success' : dept.efficiency > 60 ? 'warning' : 'error'}
                          />
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

      {/* AI 인사이트 탭 */}
      <TabPanel value={activeTab} index={1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {analysisData?.aiInsights?.map((insight) => (
            <Card
              key={insight.id}
              elevation={0}
              sx={{ ...mvsInnerCardSx, ...cardShellSx, cursor: 'pointer' }}
              onClick={() => handleInsightView(insight)}
            >
              <CardContent sx={{ py: 2.75, px: { xs: 2.25, sm: 3 }, '&:last-child': { pb: 2.75 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
                    <Typography variant="subtitle1" component="h2" sx={{ fontSize: '1.0625rem', fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.02em' }}>
                      {insight.title}
                    </Typography>
                    <Chip
                      label={insight.type}
                      size="small"
                      color={insight.type === 'cost_optimization' ? 'success' : 'primary'}
                      sx={{ '& .MuiChip-label': { fontSize: '0.6875rem', fontFamily: 'ui-monospace, monospace' } }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Chip
                      label={insight.impact}
                      size="small"
                      color={insight.impact === 'high' ? 'error' : insight.impact === 'medium' ? 'warning' : 'default'}
                      sx={{ '& .MuiChip-label': { fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' } }}
                    />
                    <Chip
                      label={`${formatConfidencePercent(insight.confidence)}% ${txt('신뢰도', 'confidence')}`}
                      size="small"
                      color="info"
                      sx={{ '& .MuiChip-label': { fontSize: '0.75rem', fontWeight: 600 } }}
                    />
                  </Box>
                </Box>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2, fontSize: '0.9375rem', lineHeight: 1.65 }}>
                  {insight.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {insight.tags.map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      size="small"
                      variant="outlined"
                      sx={{ '& .MuiChip-label': { fontSize: '0.75rem' } }}
                    />
                  ))}
                </Box>
                {insight.estimatedSavings && (
                  <Box sx={{ mt: 2, px: 2, py: 1.5, bgcolor: 'success.main', borderRadius: 1 }}>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'success.contrastText' }}>
                      {txt('예상 절약액:', 'Est. savings:')} Rs. {insight.estimatedSavings.toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      </TabPanel>

      {/* 예측 분석 탭 */}
      <TabPanel value={activeTab} index={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 3 }}>
          <Card elevation={0} sx={{ ...mvsInnerCardSx, ...cardShellSx }}>
            <CardContent sx={{ py: 2.75, px: { xs: 2.25, sm: 3 }, '&:last-child': { pb: 2.75 } }}>
              <Typography component="h2" variant="h6" sx={sectionTitleSx}>
                {txt('비용 예측', 'Cost forecast')}
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analysisData?.predictions || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="predictedCost" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ ...mvsInnerCardSx, ...cardShellSx }}>
            <CardContent sx={{ py: 2.75, px: { xs: 2.25, sm: 3 }, '&:last-child': { pb: 2.75 } }}>
              <Typography component="h2" variant="h6" sx={sectionTitleSx}>
                {txt('예측 요인', 'Forecast factors')}
              </Typography>
              <List>
                {analysisData?.predictions?.map((prediction, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={prediction.period}
                      secondary={`Rs. ${prediction.predictedCost.toLocaleString()} (${txt('신뢰도', 'confidence')}: ${formatConfidencePercent(prediction.confidence)}%)`}
                    />
                    <Chip
                      label={prediction.factors.length} 
                      size="small" 
                      color="primary"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* 벤치마킹 탭 */}
      <TabPanel value={activeTab} index={3}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
          {analysisData?.benchmarks?.map((benchmark, index) => (
            <Card key={index} elevation={0} sx={{ ...mvsInnerCardSx, ...cardShellSx }}>
              <CardContent sx={{ py: 2.75, px: { xs: 2.25, sm: 3 }, '&:last-child': { pb: 2.75 } }}>
                <Typography component="h2" variant="h6" sx={{ ...sectionTitleSx, mb: 2 }}>
                  {benchmark.metric}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">{txt('현재', 'Current')}</Typography>
                    <Typography variant="h6">{benchmark.current} {benchmark.unit}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">{txt('업계 평균', 'Industry avg.')}</Typography>
                    <Typography variant="body2">{benchmark.industry} {benchmark.unit}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">{txt('최고 수준', 'Best in class')}</Typography>
                    <Typography variant="body2">{benchmark.best} {benchmark.unit}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(benchmark.current / benchmark.best) * 100}
                    sx={{ mt: 1 }}
                  />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </TabPanel>

      {/* 인사이트 상세 다이얼로그 */}
      <Dialog
        open={openInsightDialog}
        onClose={() => setOpenInsightDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '8px' } }}
      >
        <DialogTitle sx={{ pb: 1, pt: 2.5, px: 3 }}>
          <Typography component="span" sx={{ fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.02em' }}>
            {selectedInsight?.title}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedInsight && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body1" sx={{ fontSize: '0.9375rem', lineHeight: 1.65, color: 'text.secondary' }}>
                {selectedInsight.description}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={selectedInsight.type}
                  size="small"
                  color="primary"
                  sx={{ '& .MuiChip-label': { fontSize: '0.6875rem', fontFamily: 'ui-monospace, monospace' } }}
                />
                <Chip
                  label={selectedInsight.impact}
                  size="small"
                  color="secondary"
                  sx={{ '& .MuiChip-label': { fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' } }}
                />
                <Chip
                  label={`${formatConfidencePercent(selectedInsight.confidence)}% ${txt('신뢰도', 'confidence')}`}
                  size="small"
                  color="info"
                  sx={{ '& .MuiChip-label': { fontSize: '0.75rem', fontWeight: 600 } }}
                />
              </Box>

              <Divider />

              <Typography variant="h6" sx={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                {txt('추천 사항', 'Recommendations')}
              </Typography>
              <List disablePadding>
                {selectedInsight.recommendations.map((recommendation, index) => (
                  <ListItem key={index} sx={{ alignItems: 'flex-start', py: 1, pl: 0, pr: 0 }}>
                    <Box
                      component="span"
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        mt: 0.85,
                        mr: 2,
                        flexShrink: 0 }}
                    />
                    <ListItemText
                      primary={recommendation}
                      primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.9375rem', lineHeight: 1.65 } }}
                    />
                  </ListItem>
                ))}
              </List>

              {selectedInsight.estimatedSavings && (
                <Box sx={{ px: 2, py: 1.5, bgcolor: 'success.main', borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'success.contrastText' }}>
                    {txt('예상 절약액:', 'Est. savings:')} Rs. {selectedInsight.estimatedSavings.toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInsightDialog(false)}>{txt('닫기', 'Close')}</Button>
          <Button 
            onClick={() => handleInsightStatusUpdate(selectedInsight?.id || '', 'implemented')} 
            variant="contained"
            disabled={selectedInsight?.status === 'implemented'}
          >
            {txt('구현하기', 'Mark implemented')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CostAnalysis;