from pathlib import Path
import json, sys
root=Path(__file__).resolve().parents[1]
required=['vercel.json','tsconfig.functions.json','api/[...path].ts','server/routes/health.ts','server/routes/v1/situations.ts','server/routes/v1/priority-areas/query.ts','server/domain/priorityAreas.ts','apps/web/src/App.tsx','decisions/ADR-006-vercel-typescript-bff.md','server/routes/v1/t3q/readiness.ts','server/routes/v1/t3q/cq-coverage.ts','server/routes/v1/t3q/search-preview.ts','server/providers/t3qGateway.ts','apps/web/src/components/T3qReadinessPanel.tsx']
missing=[p for p in required if not (root/p).exists()]
for old in ['apps/api','global.json','compose.yaml']:
    if (root/old).exists(): missing.append(f'제거되지 않은 .NET 항목: {old}')
for p in ['vercel.json','package.json']:
    json.load(open(root/p,encoding='utf-8'))
api_ts=sorted(str(p.relative_to(root)) for p in (root/'api').rglob('*.ts'))
if len(api_ts)!=1:
    missing.append(f'Vercel Hobby 함수 수 가드 위반: api/ 하위 .ts 파일은 catch-all 1개여야 하는데 {len(api_ts)}개 발견: {api_ts}')
if missing:
    print('\n'.join(missing)); sys.exit(1)
print(f'PASS: Vercel 저장소 구조 검증 ({len(list(root.rglob("*")))} entries)')

assert (root/'server/domain/similarEvents.ts').exists()
assert (root/'server/routes/v1/integrations/status.ts').exists()
assert (root/'apps/web/public/seed/flood_traces_seed.geojson').exists()
