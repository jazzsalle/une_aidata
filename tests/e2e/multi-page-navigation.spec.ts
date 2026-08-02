import { test, expect, type Page } from '@playwright/test';

const pages = [
  { path: '/', title: '지도 기반 재난 상황판 | 재난안전 AI 대응지원', h1: '지도 기반 재난 상황판' },
  { path: '/evidence', title: '위성영상·침수흔적·피해복구 근거 | 재난안전 AI 대응지원', h1: '위성영상·침수흔적·피해복구 근거' },
  { path: '/report', title: '상황보고서 초안 작성 | 재난안전 AI 대응지원', h1: '상황보고서 초안 작성' },
] as const;

function trackApiRequests(page: Page): string[] {
  const collected: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) collected.push(url.pathname);
  });
  return collected;
}

async function expectPage(page: Page, target: (typeof pages)[number]) {
  await expect(page).toHaveTitle(target.title);
  // h1은 상단 여백 축소를 위해 헤더 한 줄 안으로 이동했으므로 `main h1`이 아닌 문서 단일 h1을 검사한다.
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText(target.h1);
}

for (const target of pages) {
  test(`직접 URL ${target.path} 접속과 새로고침에서 고유 title과 단일 h1을 유지한다`, async ({ page }) => {
    const apiRequests = trackApiRequests(page);
    await page.goto(target.path);
    await expectPage(page, target);
    await page.reload();
    await expectPage(page, target);
    expect(apiRequests, 'FORCE_SEED 빌드에서 /api/* 요청이 없어야 한다').toHaveLength(0);
  });
}

test('nav 링크 이동 후 뒤로가기·앞으로가기로 페이지 상태가 복원된다', async ({ page }) => {
  const apiRequests = trackApiRequests(page);
  await page.goto('/');
  await expectPage(page, pages[0]);
  const nav = page.getByRole('navigation', { name: '주요 메뉴' });
  await nav.getByRole('link', { name: '피해·변화 근거' }).click();
  await expect(page).toHaveURL(/\/evidence$/);
  await expectPage(page, pages[1]);
  await nav.getByRole('link', { name: '상황보고서 초안' }).click();
  await expect(page).toHaveURL(/\/report$/);
  await expectPage(page, pages[2]);
  await page.goBack();
  await expect(page).toHaveURL(/\/evidence$/);
  await expectPage(page, pages[1]);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expectPage(page, pages[0]);
  await page.goForward();
  await expect(page).toHaveURL(/\/evidence$/);
  await expectPage(page, pages[1]);
  expect(apiRequests, 'FORCE_SEED 빌드에서 /api/* 요청이 없어야 한다').toHaveLength(0);
});
