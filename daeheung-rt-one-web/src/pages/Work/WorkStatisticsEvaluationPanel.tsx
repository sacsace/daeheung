import React, { useMemo } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { mvsTableHeadHighlightSx, mvsTableBodyRowSx } from '../../theme/daeheungLayout';

export type EvaluationDurationStats = {
  count: number;
  avgHours: number;
  medianHours: number;
  minHours: number;
  maxHours: number;
};

export type EvaluationAssigneeStat = {
  employeeName: string;
  department: string;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksTodo: number;
  productivity: number;
  personalEfficiencyScore: number;
  onTimeRate: number;
  overdueCount: number;
  completedDuration: EvaluationDurationStats;
  openDuration: EvaluationDurationStats;
};

export type EvaluationStatusSummary = {
  todo: number;
  progress: number;
  done: number;
  unassigned: number;
};

export type EvaluationDurationBucket = {
  name: string;
  value: number;
};

type Props = {
  statistics: EvaluationAssigneeStat[];
  statusSummary: EvaluationStatusSummary;
  completedDurationDistribution: EvaluationDurationBucket[];
  teamCompletedStats: EvaluationDurationStats;
  averageEfficiency: number;
  averageOnTimeRate: number;
  averageProductivity: number;
  totalAssigned: number;
  totalCompleted: number;
  overallCompletionRate: number;
  averageProcessingDays: number;
  periodLabel: string;
  companyLabel: string;
  departmentLabel: string;
  formatDays: (days: number, hasSample: boolean) => string;
};

const hoursToDays = (hours: number) => hours / 24;

const gradeFromScore = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
};

const WorkStatisticsEvaluationPanel: React.FC<Props> = ({
  statistics,
  statusSummary,
  completedDurationDistribution,
  teamCompletedStats,
  averageEfficiency,
  averageOnTimeRate,
  averageProductivity,
  totalAssigned,
  totalCompleted,
  overallCompletionRate,
  averageProcessingDays,
  periodLabel,
  companyLabel,
  departmentLabel,
  formatDays,
}) => {
  const { t } = useTranslation();

  const report = useMemo(() => {
    const active = statistics.filter((s) => s.tasksAssigned > 0);
    const sortedByEfficiency = [...active].sort(
      (a, b) => b.personalEfficiencyScore - a.personalEfficiencyScore
    );
    const topPerformers = sortedByEfficiency.slice(0, 3);
    const bottomPerformers = [...sortedByEfficiency].reverse().slice(0, 3);

    const highOverdue = [...active]
      .filter((s) => s.overdueCount > 0)
      .sort((a, b) => b.overdueCount - a.overdueCount)
      .slice(0, 5);

    const agingOpen = [...active]
      .filter((s) => s.openDuration.count > 0)
      .sort((a, b) => b.openDuration.avgHours - a.openDuration.avgHours)
      .slice(0, 5);

    const statusTotal =
      statusSummary.todo + statusSummary.progress + statusSummary.done + statusSummary.unassigned;
    const statusShares = {
      todo: statusTotal > 0 ? (statusSummary.todo / statusTotal) * 100 : 0,
      progress: statusTotal > 0 ? (statusSummary.progress / statusTotal) * 100 : 0,
      done: statusTotal > 0 ? (statusSummary.done / statusTotal) * 100 : 0,
      unassigned: statusTotal > 0 ? (statusSummary.unassigned / statusTotal) * 100 : 0,
    };

    const over14Bucket = completedDurationDistribution.find((b) =>
      /14/.test(b.name)
    );
    const completedBucketTotal = completedDurationDistribution.reduce((sum, b) => sum + b.value, 0);
    const over14Share =
      over14Bucket && completedBucketTotal > 0
        ? (over14Bucket.value / completedBucketTotal) * 100
        : 0;

    const compositeScore =
      averageEfficiency * 0.4 + averageOnTimeRate * 0.3 + averageProductivity * 0.3;
    const grade = gradeFromScore(compositeScore);

    return {
      activeCount: active.length,
      topPerformers,
      bottomPerformers,
      highOverdue,
      agingOpen,
      statusShares,
      statusTotal,
      over14Share,
      over14Count: over14Bucket?.value || 0,
      completedBucketTotal,
      compositeScore,
      grade,
    };
  }, [
    statistics,
    statusSummary,
    completedDurationDistribution,
    averageEfficiency,
    averageOnTimeRate,
    averageProductivity,
  ]);

  const sectionSx = {
    border: '1px solid #B4B4B4',
    bgcolor: '#FFFFFF',
    mb: 1.5,
  } as const;

  const sectionTitleSx = {
    px: 1.25,
    py: 0.75,
    bgcolor: '#C6EFCE',
    borderBottom: '1px solid #B4B4B4',
    fontWeight: 600,
    fontSize: '0.8125rem',
    color: '#0F172A',
  } as const;

  const bodySx = {
    px: 1.25,
    py: 1,
    fontSize: '0.8125rem',
    lineHeight: 1.55,
    color: '#1E293B',
  } as const;

  const pct = (n: number) => `${n.toFixed(1)}%`;
  const nameList = (rows: EvaluationAssigneeStat[]) =>
    rows.map((r) => r.employeeName).join(', ') || t('workStatistics.evaluation.none');

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ ...sectionSx, mb: 2 }}>
        <Typography sx={sectionTitleSx}>{t('workStatistics.evaluation.reportTitle')}</Typography>
        <Box sx={bodySx}>
          <Typography sx={{ fontSize: '0.8125rem', mb: 0.5 }}>
            {t('workStatistics.evaluation.metaCompany', { company: companyLabel })}
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', mb: 0.5 }}>
            {t('workStatistics.evaluation.metaPeriod', { period: periodLabel })}
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', mb: 0.5 }}>
            {t('workStatistics.evaluation.metaDepartment', { department: departmentLabel })}
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', mb: 1 }}>
            {t('workStatistics.evaluation.metaAssignees', { count: report.activeCount })}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
              border: '1px solid #B4B4B4',
            }}
          >
            {[
              {
                label: t('workStatistics.evaluation.grade'),
                value: report.grade,
              },
              {
                label: t('workStatistics.evaluation.compositeScore'),
                value: pct(report.compositeScore),
              },
              {
                label: t('workStatistics.summary.overallCompletionRate'),
                value: pct(overallCompletionRate),
              },
              {
                label: t('workStatistics.summary.avgProcessingTime'),
                value: formatDays(averageProcessingDays, totalCompleted > 0),
              },
            ].map((cell) => (
              <Box
                key={cell.label}
                sx={{
                  borderRight: '1px solid #B4B4B4',
                  borderBottom: { xs: '1px solid #B4B4B4', sm: 'none' },
                  px: 1,
                  py: 0.75,
                  '&:last-of-type': { borderRight: 'none' },
                }}
              >
                <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>{cell.label}</Typography>
                <Typography sx={{ fontSize: '1rem', fontWeight: 600, mt: 0.25 }}>{cell.value}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box sx={sectionSx}>
        <Typography sx={sectionTitleSx}>{t('workStatistics.evaluation.summaryTitle')}</Typography>
        <Box sx={bodySx}>
          <Typography component="p" sx={{ mb: 1, fontSize: 'inherit' }}>
            {t('workStatistics.evaluation.summaryBody', {
              grade: report.grade,
              efficiency: pct(averageEfficiency),
              onTime: pct(averageOnTimeRate),
              completionAvg: pct(averageProductivity),
              assigned: totalAssigned,
              completed: totalCompleted,
              overall: pct(overallCompletionRate),
              avgDays: formatDays(averageProcessingDays, totalCompleted > 0),
              medianDays: formatDays(
                hoursToDays(teamCompletedStats.medianHours),
                teamCompletedStats.count > 0
              ),
            })}
          </Typography>
        </Box>
      </Box>

      <Box sx={sectionSx}>
        <Typography sx={sectionTitleSx}>{t('workStatistics.evaluation.statusTitle')}</Typography>
        <Box sx={bodySx}>
          <Typography component="p" sx={{ mb: 1, fontSize: 'inherit' }}>
            {t('workStatistics.evaluation.statusBody', {
              total: report.statusTotal,
              todo: statusSummary.todo,
              todoPct: pct(report.statusShares.todo),
              progress: statusSummary.progress,
              progressPct: pct(report.statusShares.progress),
              done: statusSummary.done,
              donePct: pct(report.statusShares.done),
              unassigned: statusSummary.unassigned,
              unassignedPct: pct(report.statusShares.unassigned),
            })}
          </Typography>
        </Box>
      </Box>

      <Box sx={sectionSx}>
        <Typography sx={sectionTitleSx}>{t('workStatistics.evaluation.timeTitle')}</Typography>
        <Box sx={bodySx}>
          <Typography component="p" sx={{ mb: 1, fontSize: 'inherit' }}>
            {t('workStatistics.evaluation.timeBody', {
              medianDays: formatDays(
                hoursToDays(teamCompletedStats.medianHours),
                teamCompletedStats.count > 0
              ),
              avgDays: formatDays(
                hoursToDays(teamCompletedStats.avgHours),
                teamCompletedStats.count > 0
              ),
              minDays: formatDays(
                hoursToDays(teamCompletedStats.minHours),
                teamCompletedStats.count > 0
              ),
              maxDays: formatDays(
                hoursToDays(teamCompletedStats.maxHours),
                teamCompletedStats.count > 0
              ),
              over14Count: report.over14Count,
              over14Pct: pct(report.over14Share),
              completedSamples: report.completedBucketTotal,
            })}
          </Typography>
        </Box>
      </Box>

      <Box sx={sectionSx}>
        <Typography sx={sectionTitleSx}>{t('workStatistics.evaluation.peopleTitle')}</Typography>
        <Box sx={{ ...bodySx, px: 0, py: 0 }}>
          <Typography sx={{ ...bodySx, pb: 0.5 }}>
            {t('workStatistics.evaluation.topPerformers', { names: nameList(report.topPerformers) })}
          </Typography>
          <Typography sx={{ ...bodySx, pt: 0, pb: 1 }}>
            {t('workStatistics.evaluation.needsSupport', { names: nameList(report.bottomPerformers) })}
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  <TableCell>{t('workStatistics.columns.employeeInfo')}</TableCell>
                  <TableCell align="right">{t('workStatistics.columns.personalEfficiency')}</TableCell>
                  <TableCell align="right">{t('workStatistics.columns.completionRate')}</TableCell>
                  <TableCell align="right">{t('workStatistics.columns.onTimeRate')}</TableCell>
                  <TableCell align="right">{t('workStatistics.columns.overdueCards')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...report.topPerformers, ...report.bottomPerformers]
                  .filter(
                    (row, idx, arr) =>
                      arr.findIndex((r) => r.employeeName === row.employeeName) === idx
                  )
                  .map((row) => (
                    <TableRow key={row.employeeName} sx={mvsTableBodyRowSx}>
                      <TableCell>
                        <Typography noWrap sx={{ fontSize: '0.8125rem' }}>
                          {row.employeeName}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {row.department || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{pct(row.personalEfficiencyScore)}</TableCell>
                      <TableCell align="right">{pct(row.productivity)}</TableCell>
                      <TableCell align="right">{pct(row.onTimeRate)}</TableCell>
                      <TableCell align="right">{row.overdueCount}</TableCell>
                    </TableRow>
                  ))}
                {report.activeCount === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography sx={{ py: 2, textAlign: 'center', color: 'text.secondary' }}>
                        {t('workStatistics.empty.noAssigneeStats')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>

      <Box sx={sectionSx}>
        <Typography sx={sectionTitleSx}>{t('workStatistics.evaluation.riskTitle')}</Typography>
        <Box sx={bodySx}>
          <Typography component="p" sx={{ mb: 0.75, fontSize: 'inherit' }}>
            {t('workStatistics.evaluation.riskOverdue', {
              names: nameList(report.highOverdue),
              count: report.highOverdue.reduce((sum, r) => sum + r.overdueCount, 0),
            })}
          </Typography>
          <Typography component="p" sx={{ fontSize: 'inherit' }}>
            {t('workStatistics.evaluation.riskAging', {
              names: nameList(report.agingOpen),
            })}
          </Typography>
        </Box>
      </Box>

      <Box sx={sectionSx}>
        <Typography sx={sectionTitleSx}>{t('workStatistics.evaluation.actionsTitle')}</Typography>
        <Box sx={{ ...bodySx, pl: 2.5 }}>
          <Box component="ol" sx={{ m: 0, pl: 2, fontSize: 'inherit' }}>
            <li>{t('workStatistics.evaluation.action1')}</li>
            <li>{t('workStatistics.evaluation.action2')}</li>
            <li>{t('workStatistics.evaluation.action3')}</li>
            <li>{t('workStatistics.evaluation.action4')}</li>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default WorkStatisticsEvaluationPanel;
