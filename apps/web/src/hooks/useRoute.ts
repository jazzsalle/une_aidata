import { useEffect, useMemo, useState } from 'react';

export type RouteId = 'dashboard' | 'evidence' | 'report';

export interface RouteDefinition {
  id: RouteId;
  path: string;
  label: string;
  title: string;
  description: string;
}

export const routes: RouteDefinition[] = [
  {
    id: 'dashboard',
    path: '/',
    label: '재난 상황판',
    title: '지도 기반 재난 상황판',
    description: '현재 조건, 위험지구, 유사사례와 대응절차를 지도 중심으로 확인합니다.',
  },
  {
    id: 'evidence',
    path: '/evidence',
    label: '피해·변화 근거',
    title: '위성영상·침수흔적·피해복구 근거',
    description: '취약지역의 시점별 변화와 과거 피해·대응·복구 Seed를 함께 비교합니다.',
  },
  {
    id: 'report',
    path: '/report',
    label: '상황보고서 초안',
    title: '상황보고서 초안 작성',
    description: '현재 상황, 판단근거, 조치결과를 검토 가능한 보고서 초안으로 정리합니다.',
  },
];

function routeFromPath(pathname: string): RouteDefinition {
  return routes.find((route) => route.path === pathname) ?? routes[0]!;
}

export function useRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const route = useMemo(() => routeFromPath(pathname), [pathname]);

  function navigate(path: string) {
    if (path === window.location.pathname) return;
    window.history.pushState({}, '', path);
    setPathname(path);
  }

  return { route, navigate };
}
