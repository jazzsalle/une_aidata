from pathlib import Path
import json, sys
root=Path(__file__).resolve().parents[1]
required=['vercel.json','tsconfig.functions.json','api/health.ts','api/v1/situations.ts','api/v1/priority-areas/query.ts','server/domain/priorityAreas.ts','apps/web/src/App.tsx','decisions/ADR-006-vercel-typescript-bff.md','api/v1/t3q/readiness.ts','api/v1/t3q/cq-coverage.ts','api/v1/t3q/search-preview.ts','server/providers/t3qGateway.ts','apps/web/src/components/T3qReadinessPanel.tsx']
missing=[p for p in required if not (root/p).exists()]
for old in ['apps/api','global.json','compose.yaml']:
    if (root/old).exists(): missing.append(f'제거되지 않은 .NET 항목: {old}')
for p in ['vercel.json','package.json']:
    json.load(open(root/p,encoding='utf-8'))
if missing:
    print('\n'.join(missing)); sys.exit(1)
print(f'PASS: Vercel 저장소 구조 검증 ({len(list(root.rglob("*")))} entries)')

assert (root/'server/domain/similarEvents.ts').exists()
assert (root/'api/v1/integrations/status.ts').exists()
assert (root/'apps/web/public/seed/flood_traces_seed.geojson').exists()
