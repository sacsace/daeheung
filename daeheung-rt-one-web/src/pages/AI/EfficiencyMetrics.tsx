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
  CircularProgress
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import {
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Assessment as AssessmentIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  Download as DownloadIcon,
  Timeline as TimelineIcon,
  Work as WorkIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon,
  Schedule as ScheduleIcon } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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
      id={`efficiency-tabpanel-${index}`}
      aria-labelledby={`efficiency-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

// 효율성 지표 데이터 타입
interface EfficiencyData {
  overallScore: number;
  departmentMetrics: Array<{
    department: string;
    efficiency: number;
    productivity: number;
    quality: number;
    timeliness: number;
    costEffectiveness: number;
    trend: 'up' | 'down' | 'stable';
    lastUpdated: string;
  }>;
  processMetrics: Array<{
    process: string;
    cycleTime: number;
    throughput: number;
    errorRate: number;
    automation: number;
    improvement: number;
  }>;
  resourceUtilization: Array<{
    resource: string;
    utilization: number;
    capacity: number;
    efficiency: number;
    waste: number;
  }>;
  timeSeries: Array<{
    date: string;
    efficiency: number;
    productivity: number;
    quality: number;
  }>;
  benchmarks: Array<{
    metric: string;
    current: number;
    target: number;
    industry: number;
    best: number;
    unit: string;
  }>;
  aiRecommendations: Array<{
    id: string;
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    category: string;
    estimatedImprovement: number;
  }>;
}

const EfficiencyMetrics: React.FC = () => {
  const [efficiencyData, setEfficiencyData] = useState<EfficiencyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [timeRange, setTimeRange] = useState('3months');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // 데이터 로드
  useEffect(() => {
    const fetchEfficiencyData = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/ai/efficiency-metrics?range=${timeRange}&department=${selectedDepartment}`);
        if (response.data.success) {
          setEfficiencyData(response.data.data);
        }
      } catch {
        setError('효율성 지표 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchEfficiencyData();
  }, [timeRange, selectedDepartment]);

  // AI 추천 생성
  const generateAIRecommendations = async () => {
    try {
      const response = await api.post('/ai/generate-efficiency-recommendations', {
        data: efficiencyData
      });
      
      if (response.data.success) {
        setEfficiencyData(prev => prev ? {
          ...prev,
          aiRecommendations: [...prev.aiRecommendations, ...response.data.data.recommendations]
        } : null);
      }
    } catch {
      setError('AI 추천 생성에 실패했습니다.');
    }
  };

  // 색상 팔레트
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff6b6b', '#4ecdc4', '#45b7d1'];

  if (loading) {
    return (
      <Box sx={{ py: 8, px: 0, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>효율성 지표 분석 중...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ ...mvsPageRootSx, maxWidth: '1400px' }}>
      <DaeheungPageHeader
        title="효율성 지표 분석"
        description="AI 기반 효율성 측정과 개선 제안을 제공합니다."
        icon={<SpeedIcon color="primary" />}
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
              label="기간"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="1month">1개월</MenuItem>
              <MenuItem value="3months">3개월</MenuItem>
              <MenuItem value="6months">6개월</MenuItem>
              <MenuItem value="1year">1년</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              select
              label="부서"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="sales">영업</MenuItem>
              <MenuItem value="marketing">마케팅</MenuItem>
              <MenuItem value="development">개발</MenuItem>
              <MenuItem value="operations">운영</MenuItem>
            </TextField>
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={generateAIRecommendations}
              size="small"
            >
              AI 추천 생성
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

      {/* 전체 효율성 점수 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssessmentIcon color="primary" />
              전체 효율성 점수
            </Typography>
            <Chip
              label={efficiencyData?.overallScore ? `${efficiencyData.overallScore}점` : '0점'}
              color={efficiencyData?.overallScore && efficiencyData.overallScore > 80 ? 'success' : 
                     efficiencyData?.overallScore && efficiencyData.overallScore > 60 ? 'warning' : 'error'}
              sx={{ fontSize: '1.1rem', height: '32px' }}
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={efficiencyData?.overallScore || 0}
            sx={{ height: 12, borderRadius: 6 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {efficiencyData?.overallScore && efficiencyData.overallScore > 80 ? '우수한 효율성을 보이고 있습니다.' :
             efficiencyData?.overallScore && efficiencyData.overallScore > 60 ? '양호한 효율성을 보이고 있습니다.' :
             '효율성 개선이 필요합니다.'}
          </Typography>
        </CardContent>
      </Card>

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="부서별 지표" icon={<PeopleIcon />} />
          <Tab label="프로세스 분석" icon={<WorkIcon />} />
          <Tab label="리소스 활용" icon={<AttachMoneyIcon />} />
          <Tab label="AI 추천" icon={<PsychologyIcon />} />
        </Tabs>
      </Box>

      {/* 부서별 지표 탭 */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon color="primary" />
                부서별 효율성 지표
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>부서</TableCell>
                      <TableCell align="center">효율성</TableCell>
                      <TableCell align="center">생산성</TableCell>
                      <TableCell align="center">품질</TableCell>
                      <TableCell align="center">신속성</TableCell>
                      <TableCell align="center">비용효과</TableCell>
                      <TableCell align="center">트렌드</TableCell>
                      <TableCell align="center">상태</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {efficiencyData?.departmentMetrics?.map((dept, index) => (
                      <TableRow key={index}>
                        <TableCell>{dept.department}</TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={dept.efficiency} 
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="body2">{dept.efficiency}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={dept.productivity} 
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="body2">{dept.productivity}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={dept.quality} 
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="body2">{dept.quality}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={dept.timeliness} 
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="body2">{dept.timeliness}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={dept.costEffectiveness} 
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="body2">{dept.costEffectiveness}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          {dept.trend === 'up' ? <TrendingUpIcon color="success" /> :
                           dept.trend === 'down' ? <TrendingDownIcon color="error" /> :
                           <TimelineIcon color="info" />}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={dept.efficiency > 80 ? '우수' : dept.efficiency > 60 ? '양호' : '개선필요'}
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

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimelineIcon color="primary" />
                효율성 트렌드
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={efficiencyData?.timeSeries || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="efficiency" stroke="#8884d8" strokeWidth={2} name="효율성" />
                  <Line type="monotone" dataKey="productivity" stroke="#82ca9d" strokeWidth={2} name="생산성" />
                  <Line type="monotone" dataKey="quality" stroke="#ffc658" strokeWidth={2} name="품질" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* 프로세스 분석 탭 */}
      <TabPanel value={activeTab} index={1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WorkIcon color="primary" />
                프로세스 효율성 분석
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>프로세스</TableCell>
                      <TableCell align="center">사이클 타임</TableCell>
                      <TableCell align="center">처리량</TableCell>
                      <TableCell align="center">오류율</TableCell>
                      <TableCell align="center">자동화</TableCell>
                      <TableCell align="center">개선도</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {efficiencyData?.processMetrics?.map((process, index) => (
                      <TableRow key={index}>
                        <TableCell>{process.process}</TableCell>
                        <TableCell align="center">{process.cycleTime}일</TableCell>
                        <TableCell align="center">{process.throughput}건/일</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${process.errorRate}%`}
                            size="small"
                            color={process.errorRate < 5 ? 'success' : process.errorRate < 10 ? 'warning' : 'error'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={process.automation} 
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="body2">{process.automation}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={process.improvement} 
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="body2">{process.improvement}%</Typography>
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

      {/* 리소스 활용 탭 */}
      <TabPanel value={activeTab} index={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoneyIcon color="primary" />
                리소스 활용률
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={efficiencyData?.resourceUtilization || []}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="utilization"
                    label={({ resource, utilization }) => `${resource} ${utilization}%`}
                  >
                    {(efficiencyData?.resourceUtilization || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon color="primary" />
                리소스 상세 분석
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>리소스</TableCell>
                      <TableCell align="center">활용률</TableCell>
                      <TableCell align="center">효율성</TableCell>
                      <TableCell align="center">낭비</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {efficiencyData?.resourceUtilization?.map((resource, index) => (
                      <TableRow key={index}>
                        <TableCell>{resource.resource}</TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={resource.utilization} 
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="body2">{resource.utilization}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={resource.efficiency} 
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="body2">{resource.efficiency}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${resource.waste}%`}
                            size="small"
                            color={resource.waste < 10 ? 'success' : resource.waste < 20 ? 'warning' : 'error'}
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

      {/* AI 추천 탭 */}
      <TabPanel value={activeTab} index={3}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 3 }}>
          {efficiencyData?.aiRecommendations?.map((recommendation, index) => (
            <Card key={index}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6">{recommendation.title}</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={recommendation.impact}
                      size="small"
                      color={recommendation.impact === 'high' ? 'error' : recommendation.impact === 'medium' ? 'warning' : 'default'}
                    />
                    <Chip
                      label={recommendation.effort}
                      size="small"
                      color={recommendation.effort === 'low' ? 'success' : recommendation.effort === 'medium' ? 'warning' : 'error'}
                    />
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {recommendation.description}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip label={recommendation.category} size="small" variant="outlined" />
                  <Typography variant="body2" color="primary">
                    예상 개선: +{recommendation.estimatedImprovement}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </TabPanel>
    </Box>
  );
};

export default EfficiencyMetrics;