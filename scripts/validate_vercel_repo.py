from pathlib import Path
import json, sys
root=Path(__file__).resolve().parents[1]
required=['vercel.json','tsconfig.functions.json','api/index.ts','server/routes/health.ts','server/routes/v1/situations.ts','server/routes/v1/priority-areas/query.ts','server/domain/priorityAreas.ts','apps/web/src/App.tsx','decisions/ADR-006-vercel-typescript-bff.md','server/routes/v1/t3q/readiness.ts','server/routes/v1/t3q/cq-coverage.ts','server/routes/v1/t3q/search-preview.ts','server/providers/t3qGateway.ts','apps/web/src/components/T3qReadinessPanel.tsx']
missing=[p for p in required if not (root/p).exists()]
for old in ['apps/api','global.json','compose.yaml']:
    if (root/old).exists(): missing.append(f'제거되지 않은 .NET 항목: {old}')
for p in ['vercel.json','package.json']:
    json.load(open(root/p,encoding='utf-8'))
api_ts=sorted(str(p.relative_to(root)) for p in (root/'api').rglob('*.ts'))
if len(api_ts)!=1:
    missing.append(f'Vercel Hobby 함수 수 가드 위반: api/ 하위 .ts 파일은 catch-all 1개여야 하는데 {len(api_ts)}개 발견: {api_ts}')

# --- 이중 사본 동기화 -------------------------------------------------------
# 같은 파일이 서버용(data/)과 프런트용(apps/web/public/seed/) 두 벌로 존재한다.
# 한쪽만 고치면 실서버 경로와 seed 폴백 화면이 조용히 달라진다 — 실제로 Phase 4 에서
# report_draft_seed 형식 불일치로 한 번 겪었다. 이름이 같은 파일은 내용도 같아야 한다.
# geo.json 이 2MB 라 전체 비교 대신 SHA-256 으로 본다.
import hashlib

def digest(path:Path)->str:
    h=hashlib.sha256()
    with open(path,'rb') as fp:
        for chunk in iter(lambda: fp.read(1<<20), b''):
            h.update(chunk)
    return h.hexdigest()

def compare(left:Path,right:Path,label:str)->None:
    if not left.is_dir() or not right.is_dir():
        return
    shared=sorted({p.name for p in left.iterdir() if p.is_file()}
                  & {p.name for p in right.iterdir() if p.is_file()})
    for name in shared:
        if digest(left/name)!=digest(right/name):
            missing.append(f'사본 불일치({label}): {name} — {left.relative_to(root)} 와 {right.relative_to(root)} 내용이 다르다')
    return

public_seed=root/'apps/web/public/seed'
compare(root/'data/seed',public_seed,'data/seed ↔ public/seed')
compare(root/'data/reference',public_seed,'data/reference ↔ public/seed')

if missing:
    print('\n'.join(missing)); sys.exit(1)
print(f'PASS: Vercel 저장소 구조 검증 ({len(list(root.rglob("*")))} entries)')

assert (root/'server/domain/similarEvents.ts').exists()
assert (root/'server/routes/v1/integrations/status.ts').exists()
assert (root/'apps/web/public/seed/flood_traces_seed.geojson').exists()
