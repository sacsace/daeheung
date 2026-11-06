import React, { Component, Suspense, lazy, useState, ComponentType } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';

export const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
    <CircularProgress size={32} />
  </Box>
);

type PageModule = { default: ComponentType<any> };
type PageLoaderFactory = () => Promise<PageModule>;

const routeLoaders = new Map<string, PageLoaderFactory>();
const prefetched = new Set<string>();
const lazyCache = new WeakMap<PageLoaderFactory, ReturnType<typeof lazy>>();

function getLazy(factory: PageLoaderFactory) {
  const cached = lazyCache.get(factory);
  if (cached) return cached;
  const created = lazy(factory);
  lazyCache.set(factory, created);
  return created;
}

function normalizeRoute(path: string): string {
  const raw = String(path || '').split('?')[0].trim();
  if (!raw) return '';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

export function registerRouteLoader(path: string, factory: PageLoaderFactory) {
  const key = normalizeRoute(path);
  if (key) routeLoaders.set(key, factory);
}

/** 메뉴에 마우스를 올렸을 때만 해당 화면 조각을 미리 받는다. 첫 로딩 묶음은 그대로다. */
function findRouteLoader(path: string): { key: string; factory: PageLoaderFactory } | null {
  const exact = routeLoaders.get(path);
  if (exact) return { key: path, factory: exact };
  let found: { key: string; factory: PageLoaderFactory } | null = null;
  routeLoaders.forEach((factory, pattern) => {
    if (found || !pattern.includes(':')) return;
    const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`);
    if (regex.test(path)) found = { key: pattern, factory };
  });
  return found;
}

export function prefetchRoute(path?: string | null) {
  const normalized = normalizeRoute(String(path || ''));
  const found = normalized ? findRouteLoader(normalized) : null;
  if (!found || prefetched.has(found.key)) return;
  prefetched.add(found.key);
  void found.factory().catch(() => {
    prefetched.delete(found.key);
  });
}

type BoundaryProps = {
  attempt: number;
  onRetry: () => void;
  children: React.ReactNode;
};

type BoundaryState = { hasError: boolean; attempt: number };

class ChunkBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    if (props.attempt !== state.attempt) {
      return { hasError: false, attempt: props.attempt };
    }
    return null;
  }

  componentDidCatch() {
    if (this.props.attempt < 1) this.props.onRetry();
  }

  render() {
    if (this.state.hasError && this.props.attempt >= 1) {
      return (
        <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            화면을 불러오지 못했습니다.
          </Typography>
          <Button variant="outlined" onClick={this.props.onRetry}>
            다시 열기
          </Button>
        </Box>
      );
    }
    if (this.state.hasError) return <PageLoader />;
    return this.props.children;
  }
}

function LazyRoute({ factory }: { factory: PageLoaderFactory }) {
  const [attempt, setAttempt] = useState(0);
  const [retryLazy, setRetryLazy] = useState<ReturnType<typeof lazy> | null>(null);
  const Lazy = attempt === 0 ? getLazy(factory) : retryLazy || getLazy(factory);
  const retry = () => {
    lazyCache.delete(factory);
    setRetryLazy(lazy(factory));
    setAttempt((value) => value + 1);
  };
  return (
    <ChunkBoundary attempt={attempt} onRetry={retry}>
      <Suspense fallback={<PageLoader />}>
        <Lazy />
      </Suspense>
    </ChunkBoundary>
  );
}

/** props 없는 페이지 라우트용 lazy 래퍼. 실패한 조각은 다음 진입 때 다시 받는다. */
export function lazyPage(factory: PageLoaderFactory): React.FC {
  const Page: React.FC = () => <LazyRoute factory={factory} />;
  return Page;
}

/** 경로를 등록하고, 메뉴 hover 시 그 화면만 미리 받게 한다. */
export function lazyRoute(paths: string | string[], factory: PageLoaderFactory): React.FC {
  const list = Array.isArray(paths) ? paths : [paths];
  list.forEach((path) => registerRouteLoader(path, factory));
  return lazyPage(factory);
}
