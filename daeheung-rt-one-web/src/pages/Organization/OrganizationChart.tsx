import React, { useState, useCallback, useMemo } from 'react';
import type { NodeMouseHandler } from 'reactflow';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Alert,
  Snackbar,
  Paper,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Group as GroupIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import ReactFlow, {
  BaseEdge,
  Edge,
  EdgeProps,
  EdgeTypes,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  MarkerType,
  BackgroundVariant,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../../store';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { departmentService, positionService } from '../../services/api';
import { getUploadUrl } from '../../utils/uploadUrl';
import { formatPositionLabel } from '../../utils/positionLabels';
import { useTranslation } from 'react-i18next';
import UserPersonalRecordDialog from '../Users/UserPersonalRecordDialog';

/** 직책명 폴백 순위 (낮을수록 상위). DB sort_order / position_id 우선 */
const POSITION_NAME_RANK: Record<string, number> = {
  대표이사: 1,
  대표: 1,
  ceo: 1,
  'chief executive officer': 1,
  부사장: 2,
  부대표: 2,
  'vice president': 2,
  vp: 2,
  'executive vice president': 2,
  전무: 3,
  상무: 4,
  'executive director': 4,
  이사: 5,
  director: 5,
  부장: 6,
  차장: 7,
  과장: 8,
  manager: 8,
  대리: 9,
  'senior accountant': 9,
  'account executive': 9,
  주임: 10,
  사원: 11,
  staff: 11,
};

function normalizePositionName(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** 대표이사(CEO) — 조직도에서 회사 바로 아래 고정 */
function isCeoUser(userData: any): boolean {
  const normalized = normalizePositionName(userData?.position);
  return (
    normalized === '대표이사' ||
    normalized === '대표' ||
    normalized === 'ceo' ||
    normalized === 'chief executive officer'
  );
}

/** 부사장 — 대표이사 바로 아래 고정 */
function isVicePresidentUser(userData: any): boolean {
  if (isCeoUser(userData)) return false;
  const normalized = normalizePositionName(userData?.position);
  return (
    normalized === '부사장' ||
    normalized === '부대표' ||
    normalized === 'vice president' ||
    normalized === 'vp' ||
    normalized === 'executive vice president' ||
    normalized === 'executive director'
  );
}

function getUserPositionRank(
  userData: any,
  rankByPositionId: Map<number, number>,
  rankByPositionName: Map<string, number>
): number {
  const positionId = userData?.position_id != null ? Number(userData.position_id) : NaN;
  if (Number.isFinite(positionId) && rankByPositionId.has(positionId)) {
    return rankByPositionId.get(positionId)!;
  }
  const rawName = String(userData?.position || '').trim();
  const normalized = normalizePositionName(rawName);
  if (rawName && rankByPositionName.has(rawName)) {
    return rankByPositionName.get(rawName)!;
  }
  if (normalized && rankByPositionName.has(normalized)) {
    return rankByPositionName.get(normalized)!;
  }
  if (normalized && POSITION_NAME_RANK[normalized] != null) {
    return POSITION_NAME_RANK[normalized];
  }
  return 999;
}

const ORG_NODE_W = 260;
const ORG_COMPANY_H = 178;
const ORG_PERSON_H = 170;
const ORG_DEPT_H = 148;
const ORG_LAYER_GAP = 48;
const ORG_COL_GAP = 80;
/** 동일 직책 동료를 가로로 배치할 때 간격 */
const ORG_PEER_GAP = 40;
/** 부서 미지정 내부 키 (표시는 i18n) */
const UNASSIGNED_DEPT = '__unassigned__';

function groupUsersBySamePosition(deptUsers: any[]): { key: string; users: any[] }[] {
  const groups: { key: string; users: any[] }[] = [];
  deptUsers.forEach((u) => {
    const key = normalizePositionName(u?.position) || '__none__';
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.users.push(u);
    } else {
      groups.push({ key, users: [u] });
    }
  });
  return groups;
}

function rowWidthForCount(count: number): number {
  const n = Math.max(1, count);
  return n * ORG_NODE_W + Math.max(0, n - 1) * ORG_PEER_GAP;
}

const orgHandleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  border: '2px solid #94a3b8',
  background: '#fff',
  opacity: 0,
};

const orgEdgeStyle = { stroke: '#94a3b8', strokeWidth: 1.75 };
const orgEdgeMarker = {
  type: MarkerType.ArrowClosed,
  width: 14,
  height: 14,
  color: '#94a3b8',
} as const;

/** 대각선 금지: 같은 X면 수직선, 아니면 직교(┐└) 선 */
const OrgEdge = React.memo(function OrgEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}: EdgeProps) {
  const aligned = Math.abs(sourceX - targetX) < 2;
  const path = aligned
    ? `M ${(sourceX + targetX) / 2},${sourceY} L ${(sourceX + targetX) / 2},${targetY}`
    : (() => {
        const midY = sourceY + Math.max(28, (targetY - sourceY) * 0.5);
        return `M ${sourceX},${sourceY} L ${sourceX},${midY} L ${targetX},${midY} L ${targetX},${targetY}`;
      })();

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{ ...orgEdgeStyle, ...style }}
      markerEnd={markerEnd}
    />
  );
});

function makeOrgEdge(source: string, target: string): Edge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    type: 'org',
    animated: false,
    style: orgEdgeStyle,
    markerEnd: orgEdgeMarker,
  };
}

type OrgSnapshot = {
  company: any | null;
  activeUsers: any[];
  ceoUsers: any[];
  vpUsers: any[];
  deptNames: string[];
  departments: Record<string, any[]>;
};

interface OrganizationNode {
  id: string;
  type: 'person' | 'department' | 'company';
  data: {
    label: string;
    name: string;
    position?: string;
    department?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    employeeCount?: number;
    userId?: number;
    managerId?: string;
    level: number;
  };
  position: { x: number; y: number };
  draggable?: boolean;
  selectable?: boolean;
}

const orgCardSx = {
  width: ORG_NODE_W,
  boxShadow: 'none',
  borderRadius: 1,
  border: '1px solid',
  borderColor: 'divider',
  position: 'relative' as const,
  boxSizing: 'border-box' as const,
};

const PersonNode = ({ data }: { data: any }) => {
  const { i18n } = useTranslation();
  const positionLabel = formatPositionLabel(data.position, i18n.language) || data.position || '—';
  return (
  <Card
    sx={{
      ...orgCardSx,
      borderTop: '3px solid',
      borderTopColor: 'primary.main',
      cursor: 'pointer',
      transition: 'border-color 0.15s ease',
      '&:hover': {
        borderColor: 'primary.light',
        borderTopColor: 'primary.main',
        bgcolor: 'action.hover',
      },
    }}
  >
    <Handle type="target" position={Position.Top} style={orgHandleStyle} />
    <Handle type="source" position={Position.Bottom} style={orgHandleStyle} />
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Avatar
          src={data.avatar || undefined}
          alt={data.name || ''}
          sx={{ mr: 1, bgcolor: 'primary.main', '& img': { objectFit: 'cover' } }}
        >
          {data.name ? String(data.name).charAt(0).toUpperCase() : <PersonIcon />}
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight="bold" noWrap>
            {data.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap title={positionLabel}>
            {positionLabel}
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary" noWrap>
          {data.email}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {data.phone}
        </Typography>
      </Box>
    </CardContent>
  </Card>
  );
};

const DepartmentNode = ({ data }: { data: any }) => {
  const { t } = useTranslation();
  const displayName =
    data.name === UNASSIGNED_DEPT || data.name === '미지정'
      ? t('organizationChart.unassigned')
      : data.name;
  return (
  <Card
    sx={{
      ...orgCardSx,
      borderTop: '3px solid',
      borderTopColor: 'secondary.main',
      transition: 'border-color 0.15s ease',
      '&:hover': {
        borderColor: 'secondary.light',
        borderTopColor: 'secondary.main',
      },
    }}
  >
    <Handle type="target" position={Position.Top} style={orgHandleStyle} />
    <Handle type="source" position={Position.Bottom} style={orgHandleStyle} />
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Avatar sx={{ mr: 1, bgcolor: 'secondary.main' }}>
          <GroupIcon />
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight="bold" noWrap>
            {displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('organizationChart.department')}
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {t('organizationChart.employeeCount')}
        </Typography>
        <Chip label={data.employeeCount || 0} size="small" color="secondary" />
      </Box>
    </CardContent>
  </Card>
  );
};

const CompanyNode = ({ data }: { data: any }) => {
  const { t } = useTranslation();
  return (
  <Card
    sx={{
      ...orgCardSx,
      borderTop: '3px solid',
      borderTopColor: 'success.main',
      transition: 'border-color 0.15s ease',
      '&:hover': {
        borderColor: 'success.light',
        borderTopColor: 'success.main',
      },
    }}
  >
    <Handle type="source" position={Position.Bottom} style={orgHandleStyle} />
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Avatar sx={{ mr: 1.5, bgcolor: 'success.main', width: 44, height: 44 }}>
          <BusinessIcon />
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight="bold" noWrap>
            {data.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('organizationChart.company')}
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {t('organizationChart.totalEmployees')}
        </Typography>
        <Chip label={data.employeeCount || 0} color="success" size="small" />
      </Box>
    </CardContent>
  </Card>
  );
};

const nodeTypes: NodeTypes = {
  person: PersonNode,
  department: DepartmentNode,
  company: CompanyNode,
};

const edgeTypes: EdgeTypes = {
  org: OrgEdge,
};

function buildOrgLayout(
  snapshot: OrgSnapshot,
  deptFilter: string
): { nodes: OrganizationNode[]; edges: Edge[] } {
  const { company, activeUsers, ceoUsers, vpUsers, deptNames, departments } = snapshot;
  const visibleDeptNames =
    deptFilter === 'all' ? deptNames : deptNames.filter((name) => name === deptFilter);

  const orgNodes: OrganizationNode[] = [];
  const orgEdges: Edge[] = [];

  const fixedExecUsers = [
    ...ceoUsers.map((u) => ({ user: u, roleLabel: '대표이사', level: 1 })),
    ...vpUsers.map((u) => ({ user: u, roleLabel: '부사장', level: 2 })),
  ];

  // 부서별: 직책 순위는 세로, 같은 직책은 가로
  const deptLayouts = visibleDeptNames.map((deptName) => {
    const deptUsers = departments[deptName] || [];
    const groups = groupUsersBySamePosition(deptUsers);
    const maxPeers = Math.max(1, ...groups.map((g) => g.users.length), 1);
    const columnWidth = rowWidthForCount(maxPeers);
    return { deptName, deptUsers, groups, columnWidth };
  });

  const branchSideways = deptLayouts.length > 1;
  const totalTreeWidth =
    deptLayouts.length === 0
      ? ORG_NODE_W
      : deptLayouts.reduce((sum, d) => sum + d.columnWidth, 0) +
        Math.max(0, deptLayouts.length - 1) * ORG_COL_GAP;

  const spineCenterX = Math.max(ORG_NODE_W, totalTreeWidth) / 2;
  const nodeLeft = (centerX: number) => centerX - ORG_NODE_W / 2;

  const companyY = 24;
  let cursorY = companyY + ORG_COMPANY_H + ORG_LAYER_GAP;
  const execPositions: number[] = [];
  fixedExecUsers.forEach(() => {
    execPositions.push(cursorY);
    cursorY += ORG_PERSON_H + ORG_LAYER_GAP;
  });
  if (fixedExecUsers.length === 0) {
    cursorY = companyY + ORG_COMPANY_H + ORG_LAYER_GAP;
  }
  const deptY = cursorY;
  const personStartY = deptY + ORG_DEPT_H + ORG_LAYER_GAP;

  const deptLevel = fixedExecUsers.length > 0 ? 3 : 1;
  const personBaseLevel = deptLevel + 1;
  const companyNodeId = company ? `company-${company.id}` : '';

  if (company) {
    orgNodes.push({
      id: companyNodeId,
      type: 'company',
      data: {
        label: company.name,
        name: company.name,
        level: 0,
        employeeCount: activeUsers.length,
      },
      position: { x: nodeLeft(spineCenterX), y: companyY },
    });
  }

  let spineAnchorId = companyNodeId;
  fixedExecUsers.forEach(({ user: userData, roleLabel, level }, execIndex) => {
    const userId = `user-${userData.id}`;
    const sourceId =
      execIndex === 0 ? companyNodeId : `user-${fixedExecUsers[execIndex - 1].user.id}`;
    orgNodes.push({
      id: userId,
      type: 'person',
      data: {
        label: userData.username,
        name: userData.username,
        userId: userData.id,
        position: userData.position || roleLabel,
        department: userData.department || '',
        email: userData.email || '',
        phone: userData.phone || '',
        avatar: getUploadUrl(userData.avatar_url) || undefined,
        level,
        managerId: sourceId,
      },
      position: { x: nodeLeft(spineCenterX), y: execPositions[execIndex] },
    });
    if (sourceId) orgEdges.push(makeOrgEdge(sourceId, userId));
    spineAnchorId = userId;
  });

  let cursorX = spineCenterX - totalTreeWidth / 2;
  deptLayouts.forEach(({ deptName, deptUsers, groups, columnWidth }) => {
    const colCenterX = branchSideways ? cursorX + columnWidth / 2 : spineCenterX;
    const deptNodeId = `dept-${deptName}`;

    orgNodes.push({
      id: deptNodeId,
      type: 'department',
      data: {
        label: deptName,
        name: deptName,
        level: deptLevel,
        employeeCount: deptUsers.length,
      },
      position: { x: nodeLeft(colCenterX), y: deptY },
    });

    if (spineAnchorId) orgEdges.push(makeOrgEdge(spineAnchorId, deptNodeId));

    let rowParentId = deptNodeId;
    let rowY = personStartY;
    let personLevel = personBaseLevel;

    groups.forEach((group, groupIndex) => {
      const peers = group.users;
      const rowW = rowWidthForCount(peers.length);
      let peerLeft = colCenterX - rowW / 2;
      const peerIds: string[] = [];

      peers.forEach((userData) => {
        const userId = `user-${userData.id}`;
        orgNodes.push({
          id: userId,
          type: 'person',
          data: {
            label: userData.username,
            name: userData.username,
            userId: userData.id,
            position: userData.position || '',
            department: userData.department || deptName,
            email: userData.email || '',
            phone: userData.phone || '',
            avatar: getUploadUrl(userData.avatar_url) || undefined,
            level: personLevel,
            managerId: rowParentId,
          },
          position: { x: peerLeft, y: rowY },
        });
        orgEdges.push(makeOrgEdge(rowParentId, userId));
        peerIds.push(userId);
        peerLeft += ORG_NODE_W + ORG_PEER_GAP;
      });

      personLevel += 1;

      if (groupIndex < groups.length - 1) {
        // 다음 직책 행의 부모: 동료가 여러 명이면 가운데 사람
        rowParentId = peerIds[Math.floor((peerIds.length - 1) / 2)] || rowParentId;
        rowY += ORG_PERSON_H + ORG_LAYER_GAP;
      }
    });

    if (branchSideways) cursorX += columnWidth + ORG_COL_GAP;
  });

  return { nodes: orgNodes, edges: orgEdges };
}

const OrganizationChart: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useStore();
  const displayDeptName = useCallback(
    (name: string) =>
      name === UNASSIGNED_DEPT || name === '미지정'
        ? t('organizationChart.unassigned')
        : name,
    [t]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [snapshot, setSnapshot] = useState<OrgSnapshot | null>(null);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [layoutNonce, setLayoutNonce] = useState(0);
  const [personalRecordOpen, setPersonalRecordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Record<string, any> | null>(null);

  const usersById = useMemo(() => {
    const map = new Map<number, Record<string, any>>();
    if (!snapshot) return map;
    snapshot.activeUsers.forEach((member: any) => {
      if (member?.id != null) map.set(Number(member.id), member);
    });
    return map;
  }, [snapshot]);

  const applyLayout = useCallback(
    (nextSnapshot: OrgSnapshot, filter: string) => {
      const { nodes: nextNodes, edges: nextEdges } = buildOrgLayout(nextSnapshot, filter);
      setNodes(nextNodes);
      setEdges(nextEdges);
      setLayoutNonce((n) => n + 1);
    },
    [setNodes, setEdges]
  );

  const loadOrganizationData = useCallback(async () => {
    try {
      setLoading(true);

      const myCompanyId =
        user?.company_id != null && Number.isFinite(Number(user.company_id))
          ? Number(user.company_id)
          : null;

      if (!myCompanyId) {
        setSnapshot(null);
        setNodes([]);
        setEdges([]);
        setDepartmentCount(0);
        setError(t('organizationChart.noCompany'));
        return;
      }

      setError('');

      const company = await useReferenceDataStore.getState().fetchCompanyById(myCompanyId);

      const [users, positionsRes, departmentsRes] = await Promise.all([
        useReferenceDataStore.getState().fetchUsers({ company_id: myCompanyId }, true),
        positionService.list(false, myCompanyId).catch(() => ({ data: [] })),
        departmentService.list(false, myCompanyId).catch(() => ({ data: [] })),
      ]);

      const activeUsers = (Array.isArray(users) ? users : []).filter((u: any) => {
        if (u.status !== 'active') return false;
        const uidCompany = u.company_id != null ? Number(u.company_id) : null;
        return uidCompany == null || uidCompany === myCompanyId;
      });

      const positions = Array.isArray(positionsRes?.data) ? positionsRes.data : [];
      const departmentsMaster = Array.isArray(departmentsRes?.data) ? departmentsRes.data : [];

      const rankByPositionId = new Map<number, number>();
      const rankByPositionName = new Map<string, number>();
      positions.forEach((p: any) => {
        const order = Number(p.sort_order);
        const rank = Number.isFinite(order) ? order : 999;
        if (p.id != null) rankByPositionId.set(Number(p.id), rank);
        const name = String(p.name || '').trim();
        if (name) {
          rankByPositionName.set(name, rank);
          rankByPositionName.set(normalizePositionName(name), rank);
        }
      });

      const deptSortByName = new Map<string, number>();
      departmentsMaster.forEach((d: any) => {
        const name = String(d.name || '').trim();
        if (!name) return;
        const order = Number(d.sort_order);
        deptSortByName.set(name, Number.isFinite(order) ? order : 999);
      });

      const byName = (a: any, b: any) =>
        String(a.username || '').localeCompare(String(b.username || ''), 'ko');
      const ceoUsers = activeUsers.filter((member: any) => isCeoUser(member)).sort(byName);
      const vpUsers = activeUsers.filter((member: any) => isVicePresidentUser(member)).sort(byName);
      const fixedExecIdSet = new Set([...ceoUsers, ...vpUsers].map((u: any) => u.id));

      const departmentMap = new Map<string, any[]>();
      activeUsers.forEach((member: any) => {
        if (fixedExecIdSet.has(member.id)) return;
        const dept = String(member.department || '').trim() || UNASSIGNED_DEPT;
        if (!departmentMap.has(dept)) departmentMap.set(dept, []);
        departmentMap.get(dept)!.push(member);
      });

      const sortedDeptNames = Array.from(departmentMap.keys()).sort((a, b) => {
        const sa = deptSortByName.has(a) ? deptSortByName.get(a)! : a === UNASSIGNED_DEPT ? 9999 : 500;
        const sb = deptSortByName.has(b) ? deptSortByName.get(b)! : b === UNASSIGNED_DEPT ? 9999 : 500;
        if (sa !== sb) return sa - sb;
        return a.localeCompare(b, i18n.language === 'en' ? 'en' : 'ko');
      });

      sortedDeptNames.forEach((deptName) => {
        departmentMap.get(deptName)!.sort((a, b) => {
          const ra = getUserPositionRank(a, rankByPositionId, rankByPositionName);
          const rb = getUserPositionRank(b, rankByPositionId, rankByPositionName);
          if (ra !== rb) return ra - rb;
          return String(a.username || '').localeCompare(String(b.username || ''), 'ko');
        });
      });

      const departments: Record<string, any[]> = {};
      sortedDeptNames.forEach((name) => {
        departments[name] = departmentMap.get(name) || [];
      });

      const nextSnapshot: OrgSnapshot = {
        company,
        activeUsers,
        ceoUsers,
        vpUsers,
        deptNames: sortedDeptNames,
        departments,
      };

      setDepartmentCount(sortedDeptNames.filter((d) => d !== UNASSIGNED_DEPT).length);
      setSnapshot(nextSnapshot);
      setDeptFilter((prev) => {
        const next = prev === 'all' || sortedDeptNames.includes(prev) ? prev : 'all';
        applyLayout(nextSnapshot, next);
        return next;
      });
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || err.message || t('organizationChart.loadFailed');
      setError(errorMessage);
      setSnapshot(null);
      setNodes([]);
      setEdges([]);
      setDepartmentCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.company_id, setNodes, setEdges, applyLayout, t, i18n.language]);

  React.useEffect(() => {
    if (user?.company_id) {
      loadOrganizationData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.company_id]);

  const handleDeptFilterChange = (nextFilter: string) => {
    setDeptFilter(nextFilter);
    if (snapshot) applyLayout(snapshot, nextFilter);
  };

  const handleResetLayout = () => {
    if (snapshot) applyLayout(snapshot, deptFilter);
  };

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type !== 'person') return;
      const rawId = node.data?.userId ?? String(node.id).replace(/^user-/, '');
      const userId = Number(rawId);
      if (!Number.isFinite(userId)) return;
      const member = usersById.get(userId);
      if (!member) return;
      setSelectedUser(member);
      setPersonalRecordOpen(true);
    },
    [usersById]
  );

  const reviewMembers = useMemo(() => {
    if (!snapshot || deptFilter === 'all') return [];
    return snapshot.departments[deptFilter] || [];
  }, [snapshot, deptFilter]);

  const stats = useMemo(() => {
    const visiblePeople = nodes.filter((node) => node.type === 'person').length;
    return {
      totalEmployees: snapshot?.activeUsers.length ?? visiblePeople,
      totalDepartments: departmentCount,
      visibleEmployees: visiblePeople,
    };
  }, [nodes, departmentCount, snapshot]);

  return (
    <Box sx={{ ...mvsPageRootSx, height: 'calc(100vh - 200px)' }}>
      <DaeheungPageHeader
        title={t('organizationChart.title')}
        description={t('organizationChart.description')}
        actions={
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              onClick={handleResetLayout}
              sx={{ borderRadius: 2 }}
              disabled={loading || !snapshot}
            >
              {t('organizationChart.resetLayout')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadOrganizationData}
              sx={{ borderRadius: 2 }}
              disabled={loading}
            >
              {t('organizationChart.refresh')}
            </Button>
          </Box>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 2,
        }}
      >
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography color="textSecondary" gutterBottom>
              {t('organizationChart.totalEmployees')}
            </Typography>
            <Typography variant="h4" color="primary.main">
              {stats.totalEmployees}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography color="textSecondary" gutterBottom>
              {t('organizationChart.departmentCount')}
            </Typography>
            <Typography variant="h4" color="secondary.main">
              {stats.totalDepartments}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
          {t('organizationChart.reviewByDepartment')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: deptFilter === 'all' ? 0 : 1.5 }}>
          <Chip
            label={t('organizationChart.all')}
            color={deptFilter === 'all' ? 'primary' : 'default'}
            variant={deptFilter === 'all' ? 'filled' : 'outlined'}
            onClick={() => handleDeptFilterChange('all')}
            size="small"
            sx={{ borderRadius: '4px' }}
          />
          {(snapshot?.deptNames || []).map((name) => (
            <Chip
              key={name}
              label={`${displayDeptName(name)} (${(snapshot?.departments[name] || []).length})`}
              color={deptFilter === name ? 'primary' : 'default'}
              variant={deptFilter === name ? 'filled' : 'outlined'}
              onClick={() => handleDeptFilterChange(name)}
              size="small"
              sx={{ borderRadius: '4px' }}
            />
          ))}
        </Box>
        {deptFilter !== 'all' && (
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              {t('organizationChart.reviewDeptSummary', {
                dept: displayDeptName(deptFilter),
                count: reviewMembers.length,
              })}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {reviewMembers.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  {t('organizationChart.reviewEmpty')}
                </Typography>
              ) : (
                reviewMembers.map((member: any) => (
                  <Typography key={member.id} variant="body2" color="text.secondary" noWrap>
                    {member.username}
                    {member.position
                      ? ` · ${formatPositionLabel(member.position, i18n.language)}`
                      : ''}
                    {member.email ? ` · ${member.email}` : ''}
                  </Typography>
                ))
              )}
            </Box>
          </Box>
        )}
      </Paper>

      <Paper
        sx={{
          height: 'calc(100vh - 480px)',
          minHeight: 500,
          borderRadius: 1,
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <Typography variant="h6" color="text.secondary">
              {t('organizationChart.loading')}
            </Typography>
          </Box>
        ) : nodes.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="h6" color="text.secondary">
              {t('organizationChart.emptyTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('organizationChart.emptyHint')}
            </Typography>
            <Button variant="contained" startIcon={<RefreshIcon />} onClick={loadOrganizationData}>
              {t('organizationChart.refresh')}
            </Button>
          </Box>
        ) : (
          <ReactFlow
            key={`org-${layoutNonce}`}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesConnectable={false}
            elementsSelectable
            nodesDraggable
            panOnDrag
            preventScrolling={false}
            defaultEdgeOptions={{
              type: 'org',
              style: orgEdgeStyle,
              markerEnd: orgEdgeMarker,
            }}
            fitView
            fitViewOptions={{ padding: 0.25, minZoom: 0.35, maxZoom: 1.25 }}
            minZoom={0.25}
            maxZoom={1.5}
            attributionPosition="bottom-left"
            proOptions={{ hideAttribution: true }}
          >
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'company':
                    return '#22c55e';
                  case 'department':
                    return '#3b82f6';
                  case 'person':
                    return '#0d8aff';
                  default:
                    return '#64748b';
                }
              }}
              nodeStrokeWidth={3}
              nodeBorderRadius={8}
            />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          </ReactFlow>
        )}
      </Paper>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <UserPersonalRecordDialog
        open={personalRecordOpen}
        onClose={() => {
          setPersonalRecordOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        company={snapshot?.company ?? null}
      />
    </Box>
  );
};

export default OrganizationChart;
