"""T3Q 재난메타 인스턴스(260813 전달분)를 POC 시드로 변환한다 — 메타 표본 3지역.

    입력  GIS_data/25. ★원시데이터 목록 및 재난 메타 스키마 데이터_260813/유엔이_전달_20260813/
            인스턴스/{자연재해저감종합계획·하천기본계획·소하천정비종합계획} 보고서/
              …_인스턴스_의미구조.json  · …_역량질문.json
    출력  data/seed/current_situations_seed.json          메타 상황 3건 추가 (배열 끝)
          data/reference/districts.json                   메타 지구 행 추가
          data/reference/rivers.json                      메타 하천 행 추가
          data/seed/meta_demo_cq_answers_seed.json        역량질문 답변 (Agent·지식 패널용)
          data/seed/meta_demo_event_timeline_seed.json    사건 마스터ID 타임라인 표본
          data/seed/response_procedures_seed.json         target_admin_codes 에 3코드 추가
          (apps/web/public/seed·reference 사본 동기화)

**비교본이다.** 기존 3지역(의왕·구미·남원)의 계획 판독 자료는 건드리지 않고, 실제 올 예상
데이터(T3Q 메타 인스턴스)를 같은 계약으로 변환해 나란히 놓는다. 표본 지역은 인스턴스가
실제로 가리키는 곳이다 — 자연재해저감(대구 2016)은 후보지가 서구에 밀집해 **대구 서구
(27170)**, 하천기본(동진강·정읍천)은 **정읍시(52180)**, 소하천정비는 **김해시(48250)**.

**구분 규약** (실데이터 도착 시 이번 반영분을 되짚기 위한 것):
- districts·rivers 신규 행: `data_status: 'meta_demo'` + `provenance{source_file·page}`
- situations: 스키마가 additionalProperties:false 라 필드를 못 늘린다 —
  **situation_id 에 `-META-` 를 넣는 규약**으로 식별한다(SIT-DG-META-001 등)
- 화면은 이 표시를 읽어 텍스트를 구분색(.meta-demo-text)으로 그린다

**멱등이다.** meta_demo 행(situations 는 -META- id)을 지우고 다시 넣으므로 몇 번을 돌려도
같은 결과다. 기존 행은 순서까지 그대로 둔다 — smoke_evidence_console 이 situations[0] 을
쓰므로 새 상황은 반드시 배열 끝에 붙인다.

**넣지 않는 것**: 주민 설문의 성명(마스킹돼 있어도 개인정보다) · 좌표(원문에 없다 — 주소
텍스트만 옮기고 coordinates 는 null. 없는 값을 만들지 않는다) · 관측값(상황의 observations
는 기존 3지역과 같은 시나리오 값이며 계획서 유래가 아니다 — value_status: 'scenario').
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from source_data import GIS_DATA, REPO, require  # noqa: E402

META_BASE = GIS_DATA / '25. ★원시데이터 목록 및 재난 메타 스키마 데이터_260813' / '유엔이_전달_20260813'
PLANS = {
    'jgp': ('자연재해저감종합계획', '27170', '대구광역시 서구', '대구광역시 2016'),
    'rmp': ('하천기본계획', '52180', '전북특별자치도 정읍시', '동진강(정읍천) 2017'),
    'sgp': ('소하천정비종합계획', '48250', '경상남도 김해시', '김해시'),
}
SOURCE_NOTE = 'T3Q 재난메타 인스턴스 표본(2026-08-13 전달분) — 실지역 공식자료가 아닌 비교본'


def load_instances(plan_name: str) -> dict:
    path = META_BASE / '인스턴스' / f'{plan_name} 보고서' / f'{plan_name} 보고서_인스턴스_의미구조.json'
    return json.loads(require(path, f'{plan_name} 인스턴스').read_text(encoding='utf-8'))


def load_cq(plan_name: str) -> dict:
    path = META_BASE / '인스턴스' / f'{plan_name} 보고서' / f'{plan_name} 보고서_역량질문.json'
    return json.loads(require(path, f'{plan_name} 역량질문').read_text(encoding='utf-8'))


def clean(value) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def is_header_row(attrs: dict) -> bool:
    """표 헤더가 값 자리로 추출된 행(라벨==값)을 거른다."""
    if not attrs:
        return True
    return all(clean(k) == clean(v) for k, v in attrs.items())


def provenance_of(inst: dict) -> dict:
    prov = inst.get('prov:wasDerivedFrom') or {}
    return {
        'source_file': prov.get('source_file'),
        'page': prov.get('page'),
        'set_id': prov.get('set_id'),
        'instance_id': inst.get('@id'),
    }


# ---------------------------------------------------------------- 지구(districts)

def daegu_districts(payload: dict) -> list:
    """내수재해 후보지(주민 설문 유래) 중 서구 소재. 성명은 옮기지 않는다."""
    rows = []
    for inst in payload['instances']:
        if not inst['@type'].endswith('risk-district') or inst.get('instance_kind') != 'entity':
            continue
        attrs = inst.get('attributes') or {}
        name = clean(attrs.get('후보지명'))
        location = clean(attrs.get('위 치') or attrs.get('위치'))
        opinion = clean(attrs.get('의 견') or attrs.get('의견'))
        if not name or not location.startswith('서구') or is_header_row(attrs):
            continue
        rows.append({
            'district_code': f'DG-META-{len(rows) + 1:02d}',
            'ledger_code': None,
            'code_origin': 'T3Q 메타 인스턴스 후보지명 기반 임의 부여',
            'district_name': f'{name}지구(후보)',
            'admin_code': '27170',
            'admin_name': '대구광역시 서구',
            'disaster_type': '내수재해',
            'disaster_subtype': '침수위험 후보지',
            'hazard_codes': ['T10107', 'T10206'],
            'location': f'대구광역시 {location}',
            'river_name': None,
            'station': None,
            'risk_factors': [opinion] if opinion else [],
            'risk_thresholds': [],
            'grade': '후보지(위험도 미판정)',
            'mitigation': [],
            'project_status': '후보지 검토',
            'priority': None,
            'coordinates': None,
            'note': '주민설문 유래 후보지 — 설문자 성명은 개인정보로 옮기지 않았다',
            'evidence': None,
            'data_status': 'meta_demo',
            'source_note': SOURCE_NOTE,
            'provenance': provenance_of(inst),
        })
        if len(rows) >= 6:
            break
    return rows


def jeongeup_districts(payload: dict) -> list:
    """기수립 하천사업 정비지구(축제 지구) — 하천재해 지구로 옮긴다."""
    rows = []
    for inst in payload['instances']:
        if not inst['@type'].endswith('prior-plan-reference') or inst.get('instance_kind') != 'entity':
            continue
        attrs = inst.get('attributes') or {}
        name = clean(attrs.get('지구명'))
        river = clean(attrs.get('하천명'))
        # '계'·'합계' 는 표의 합계 행이지 지구가 아니다 — 처음에 걸러 넣지 않으면 '계 지구' 카드가 생긴다.
        if not name or is_header_row(attrs) or re.match(r'^(지구명|계|합\s*계|소계)', name):
            continue
        station = clean(attrs.get('측 점(No.)') or attrs.get('측점(No.)'))
        length = clean(attrs.get('연장(m)'))
        rows.append({
            'district_code': f'JE-META-{len(rows) + 1:02d}',
            'ledger_code': None,
            'code_origin': 'T3Q 메타 인스턴스 지구명 기반 임의 부여',
            'district_name': name,
            'admin_code': '52180',
            'admin_name': '전북특별자치도 정읍시',
            'disaster_type': '하천재해',
            'disaster_subtype': '기수립 정비지구',
            'hazard_codes': ['T10206'],
            'location': f'정읍시 {river} {station}'.strip(),
            'river_name': river or None,
            'station': station or None,
            'risk_factors': [f'{clean(attrs.get("구분"))} {clean(attrs.get("공 종") or attrs.get("공종"))} 지구'
                             + (f' · 연장 {length}m' if length else '')],
            'risk_thresholds': [],
            'grade': '기수립 계획 정비지구',
            'mitigation': [f'{clean(attrs.get("공 종") or attrs.get("공종"))} L={length}m'] if length else [],
            'project_status': '기수립',
            'priority': None,
            'coordinates': None,
            'note': None,
            'evidence': None,
            'data_status': 'meta_demo',
            'source_note': SOURCE_NOTE,
            'provenance': provenance_of(inst),
        })
        if len(rows) >= 4:
            break
    return rows


def gimhae_districts(payload: dict) -> list:
    """정비대상 소하천(과업 소하천 조서) — 소하천 정비대상 지구로 옮긴다. 기점 행만 쓴다."""
    rows = []
    seen = set()
    for inst in payload['instances']:
        if not inst['@type'].endswith('target-stream') or inst.get('instance_kind') != 'entity':
            continue
        attrs = inst.get('attributes') or {}
        name = clean(attrs.get('소하천명'))
        if not name or name == '소하천명' or name in seen or is_header_row(attrs):
            continue
        seen.add(name)
        length = clean(attrs.get('과업연장(㎞)'))
        rows.append({
            'district_code': f'GH-META-{len(rows) + 1:02d}',
            'ledger_code': clean(attrs.get('소하천 번 호') or attrs.get('소하천번호')) or None,
            'code_origin': 'T3Q 메타 인스턴스 소하천번호',
            'district_name': f'{name} 정비대상',
            'admin_code': '48250',
            'admin_name': '경상남도 김해시',
            'disaster_type': '소하천재해',
            'disaster_subtype': '정비대상 소하천',
            'hazard_codes': ['T10206', 'T10107'],
            'location': f'김해시 {name}',
            'river_name': f'{name}(소하천)',
            'station': None,
            'risk_factors': [f'소하천정비종합계획 과업 대상 · 과업연장 {length}km' if length else '소하천정비종합계획 과업 대상'],
            'risk_thresholds': [],
            'grade': '정비대상',
            'mitigation': [],
            'project_status': '계획수립',
            'priority': None,
            'coordinates': None,
            'note': None,
            'evidence': None,
            'data_status': 'meta_demo',
            'source_note': SOURCE_NOTE,
            'provenance': provenance_of(inst),
        })
        if len(rows) >= 4:
            break
    return rows


# ---------------------------------------------------------------- 하천(rivers)

def jeongeup_river(payload: dict) -> dict | None:
    """정읍천(국가) — 과업구간 현황 + 종점 계획홍수량."""
    survey = None
    for inst in payload['instances']:
        attrs = inst.get('attributes') or {}
        if (inst['@type'].endswith('basin-survey') and clean(attrs.get('하천명')) == '정읍천'
                and clean(attrs.get('하천 등급')) == '국가'):
            survey = inst
            break
    if not survey:
        return None
    attrs = survey['attributes']
    flood = None
    for inst in payload['instances']:
        if (inst.get('instance_kind') == 'measurement'
                and clean(inst.get('measured_property')) == '금회 홍수량'
                and '정읍천(국가) 종점' in clean(inst.get('subject'))):
            flood = inst
            break
    stations = []
    if flood:
        stations.append({
            'station_code': None,
            'station_name': '정읍천(국가) 종점',
            'design_flood_m3s': flood.get('value'),
            'design_frequency_yr': None,
            'evidence': (flood.get('passage') or {}).get('passage_text'),
        })
    return {
        'river_id': 'RIV-JE-META-01',
        'name': '정읍천',
        'grade': '국가하천',
        'admin_code': '52180',
        'admin_name': '전북특별자치도 정읍시',
        'basin_area_km2': float(clean(attrs.get('유역 면적 (km2)')) or 0) or None,
        'length_km': float(clean(attrs.get('과업연장 (km)') or attrs.get('과업 연장 (km)')) or 0) or None,
        'plan_name': '동진강(정읍천) 하천기본계획(2017)',
        'profile_evidence': (survey.get('passage') or {}).get('passage_text'),
        'stations': stations,
        'data_status': 'meta_demo',
        'source_note': SOURCE_NOTE,
        'provenance': provenance_of(survey),
    }


def gimhae_river(payload: dict) -> dict | None:
    """김해 과업 소하천 대표 1건(안평천)."""
    for inst in payload['instances']:
        attrs = inst.get('attributes') or {}
        if inst['@type'].endswith('target-stream') and clean(attrs.get('소하천명')) == '안평천':
            length = clean(attrs.get('과업연장(㎞)'))
            return {
                'river_id': 'RIV-GH-META-01',
                'name': '안평천',
                'grade': '소하천',
                'admin_code': '48250',
                'admin_name': '경상남도 김해시',
                'basin_area_km2': None,
                'length_km': float(length) if length else None,
                'plan_name': '김해시 소하천정비종합계획',
                'profile_evidence': (inst.get('passage') or {}).get('passage_text'),
                'stations': [],
                'data_status': 'meta_demo',
                'source_note': SOURCE_NOTE,
                'provenance': provenance_of(inst),
            }
    return None


# ---------------------------------------------------------------- 상황(situations)

def meta_situations() -> list:
    """기존 3지역과 같은 형식의 시나리오 상황. 관측값은 계획서 유래가 아닌 시나리오 값이다."""
    def obs(kind, station, value, unit, **extra):
        row = {'type': kind, 'station_id': station, 'value': value, 'unit': unit,
               'observed_at': '2026-08-21T14:50:00+09:00',
               'source_provider': 'ScenarioObservationProvider',
               'value_status': 'scenario', 'official_data': False}
        row.update(extra)
        return row

    def situation(sid, code, name, hazards, symptoms, location, objects, checks, observations):
        return {
            'situation_id': sid, 'admin_code': code, 'admin_name': name,
            'reference_time': '2026-08-21T15:00:00+09:00', 'mode': 'scenario',
            'hazards': hazards,
            'user_input': {'field_symptoms': symptoms, 'location_text': location,
                           'affected_objects': objects, 'required_checks': checks},
            'observations': observations,
            'data_quality': {'latest_at': '2026-08-21T14:50:00+09:00',
                             'missing': ['official_public_api_response'], 'delayed': [],
                             'fallback_used': True},
        }

    return [
        situation('SIT-DG-META-001', '27170', '대구광역시 서구', ['HEAVY_RAIN', 'FLOOD'],
                  ['비산동·평리동 일대 하수관거 월류 신고'], '서구 비산동 일원',
                  ['지하공간', '반지하 주택', '이면도로'],
                  ['하수관거 월류 지점 확인', '침수 후보지 배수 상태'],
                  [obs('WEATHER_ALERT', None, '주의보', None, name='호우주의보'),
                   obs('RAINFALL_3H', 'DG-RF-01', 68.0, 'mm')]),
        situation('SIT-JE-META-001', '52180', '전북특별자치도 정읍시', ['HEAVY_RAIN', 'FLOOD'],
                  ['정읍천 수위 상승 현장 확인 요청'], '정읍천 시가지 구간',
                  ['하천변 도로', '교량 접근로'],
                  ['정읍천 수위 확인', '기수립 정비지구 제방 상태'],
                  [obs('WEATHER_ALERT', None, '주의보', None, name='호우주의보'),
                   obs('RAINFALL_3H', 'JE-RF-01', 74.0, 'mm'),
                   obs('WATER_LEVEL', 'JE-WL-01', 2.1, 'm', trend='rising')]),
        situation('SIT-GH-META-001', '48250', '경상남도 김해시', ['HEAVY_RAIN', 'FLOOD'],
                  ['소하천 유역 국지성 호우'], '김해시 소하천 유역',
                  ['소하천 인접 농경지', '마을 진입로'],
                  ['정비대상 소하천 월류 여부'],
                  [obs('WEATHER_ALERT', None, '주의보', None, name='호우주의보'),
                   obs('RAINFALL_3H', 'GH-RF-01', 61.0, 'mm')]),
    ]


# ---------------------------------------------------------------- 역량질문 답변

def river_nav_table() -> dict:
    """하천명 → (지도 이동 좌표, 지나는 시군구). 하천망도 카탈로그의 내부점(label_point)이다.
    동명 하천은 링크를 붙일 지역(admin_code)을 지나는 것을 고른다."""
    path = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers' / 'river_network_catalog.json'
    table: dict = {}
    for river in json.loads(require(path, '하천망도 카탈로그').read_text(encoding='utf-8'))['rivers']:
        table.setdefault(river['river_name'], []).append(river)
    return table


def build_cq_answers() -> dict:
    """보고서 3종 × CQ 별로 실값 인스턴스의 passage 를 골라 답변을 만든다.

    답변 문장은 passage 원문을 나열하는 형식이다 — 값을 요약하거나 재계산하지 않는다.
    links 는 화면이 클릭 칩으로 그릴 이동 대상(지역·하천·지구)이다.
    """
    entries = []
    nav_table = river_nav_table()
    for key, (plan_name, admin_code, admin_name, set_label) in PLANS.items():
        payload = load_instances(plan_name)
        cq_doc = load_cq(plan_name)
        def broken_passage(text: str) -> bool:
            """'관측소 관측소; 수계 수계' 처럼 라벨이 값 자리에 반복된 조각(깨진 표 행).
            토큰 끝의 구두점(; , .)을 떼고 비교한다 — '관측소'와 '관측소;' 도 반복이다."""
            tokens = [t.strip(';,.·—-') for t in text.split()]
            return sum(1 for a, b in zip(tokens, tokens[1:]) if a == b and len(a) >= 2) >= 2

        by_cq: dict[str, list] = {}
        for inst in payload['instances']:
            attrs = inst.get('attributes') or {}
            text = clean((inst.get('passage') or {}).get('passage_text'))
            if not text or len(text) < 60 or broken_passage(text):
                continue
            if inst.get('instance_kind') == 'entity' and is_header_row(attrs):
                continue
            # 성명 필드가 있는 인스턴스는 답변 소재에서 제외한다(마스킹돼 있어도 개인정보).
            if any('성명' in clean(k) for k in attrs):
                continue
            prop_tail = clean(inst.get('measured_property')).split()[-1] if clean(inst.get('measured_property')) else ''
            for cq_id in inst.get('answers_cq') or []:
                bucket = by_cq.setdefault(cq_id, {'general': [], 'by_prop': {}})
                if len(bucket['general']) < 20:
                    bucket['general'].append(inst)
                # 측정항목별로도 담아 둔다 — CQ 인스턴스가 만 건이 넘어 앞쪽만 보면 요구 항목
                # (계획홍수량 등)이 버킷에 못 든다.
                if prop_tail:
                    prop_bucket = bucket['by_prop'].setdefault(prop_tail, [])
                    if len(prop_bucket) < 3:
                        prop_bucket.append(inst)

        questions = []
        for axis in cq_doc.get('axis_questions') or []:
            questions.extend(axis.get('questions') or [])
        questions.extend(cq_doc.get('additional_questions') or [])

        for question in questions:
            cq_id = question.get('cq_id')
            bucket = by_cq.get(cq_id, {'general': [], 'by_prop': {}})
            # 질문이 요구하는 측정항목(계획홍수량 등)을 먼저 뽑는다. '계획홍수량' 요구에
            # measured_property 가 '금회 홍수량' 으로 오는 식이라 끝 어절('홍수량')로 닿게 한다.
            wanted = [clean(m.get('measured_property')) for m in question.get('required_measurements') or []]
            tails = [w.split()[-1] for w in wanted if w]
            picked = []
            for tail in tails:
                for prop_tail, insts in bucket['by_prop'].items():
                    if tail in prop_tail or prop_tail in tail:
                        for inst in insts:
                            if inst not in picked and len(picked) < 3:
                                picked.append(inst)
            for inst in bucket['general']:
                if inst not in picked and len(picked) < 3:
                    picked.append(inst)
            links = [{'kind': 'region', 'label': admin_name, 'admin_code': admin_code}]
            river_names = set()
            for inst in picked:
                river = clean(((inst.get('keys') or {}).get('domain') or {}).get('river_name'))
                # '하천'·'확률강' 같은 값은 표에서 잘려 나온 조각이지 하천명이 아니다 — 링크를 만들면
                # 동명의 실제 하천(창녕 '하천' 등)으로 엉뚱하게 이동한다.
                broken = {'하천', '소하천', '확률강', '월별강', '하천명'}
                if river and len(river) >= 3 and river not in broken and river not in river_names and not river.endswith(('강(', '천(')):
                    river_names.add(river)
                    link = {'kind': 'river', 'label': river, 'name': river}
                    # 지도 이동 좌표 — 하천망도에 있는 하천만. 동명이면 이 지역을 지나는 것을 고른다.
                    # 없는 하천(소하천 등)은 nav 없이 지역 이동만 된다. 좌표를 만들어내지 않는다.
                    candidates = nav_table.get(river, [])
                    match = next((c for c in candidates if admin_code in (c.get('admin_codes') or [])),
                                 candidates[0] if len(candidates) == 1 else None)
                    if match and match.get('label_point'):
                        link['nav'] = match['label_point']
                        link['nav_kind'] = 'derived_interior'
                        link['river_code'] = match['river_code']
                    links.append(link)
            entries.append({
                'cq_key': f'{key}:{cq_id}',
                'plan_type': plan_name,
                'set_label': set_label,
                'admin_code': admin_code,
                'admin_name': admin_name,
                'cq_id': cq_id,
                'axis': question.get('axis'),
                'question': clean(question.get('question')),
                'answerable': bool(picked),
                'answer_passages': [{
                    'passage_text': clean((inst.get('passage') or {}).get('passage_text')),
                    'class_iri': inst.get('@type'),
                    'instance_kind': inst.get('instance_kind'),
                    'provenance': provenance_of(inst),
                } for inst in picked],
                'links': links if picked else [],
                'data_status': 'meta_demo',
            })
    return {
        'dataset': 'meta_demo_cq_answers',
        'version': '1.0',
        'source_note': SOURCE_NOTE,
        'notice': ('역량질문(CQ) 답변 표본. 답변은 T3Q 메타 인스턴스의 passage 원문 나열이며 '
                   '요약·재계산하지 않았다. T3Q 실 API 연결 전의 Mock 시범이다.'),
        'runtime_policy': 'MOCK_FIRST_PROVIDER_NEUTRAL',
        'entries': entries,
    }


# ---------------------------------------------------------------- 사건 타임라인

def build_event_timeline() -> dict:
    """재난메타 정의서 v0.96 「참고4. 적용 사례·항목 바인딩」의 2022 수도권 집중호우 예시 전사.

    좌=실제 원천 자료 / 중앙=사건 마스터ID / 우=정의서 요소 — 그 구조를 시점 축으로 편다.
    값은 정의서 시트에 적힌 그대로이고 새로 만든 값이 없다.
    """
    return {
        'dataset': 'meta_demo_event_timeline',
        'version': '1.0',
        'source_note': '재난메타_정의서_v0.96.xlsx 「참고4. 적용 사례·항목 바인딩」 전사 표본',
        'notice': ('사건 마스터ID 를 축으로 시점별 연결 자료를 보여 주는 표본이다. '
                   'KDSA 채번·연결 관계는 정의서 예시 그대로이며 실제 등록된 사건이 아니다.'),
        'event': {
            'event_master_id': 'KDSA-20220808-1168010800-001',
            'id_rule': 'KDSA-{YYYYMMDD}-{법정동코드 10자리}-{순번 3자리}',
            'event_name': '2022 수도권 집중호우(강남 도심침수)',
            'region': '서울특별시 강남구 역삼동',
            'legal_region_code_10': '1168010800',
            'hazard_codes': ['T10206', 'T10107'],
            'poc_event_id_note': ('POC 내부 event_id 형식은 EVT::{YYYYMMDD}-{TYPE}-{REGION5}-{SEQ3} 로 '
                                  '다르다. 실연계 시 KDSA ↔ EVT:: 매핑을 Adapter 가 맡는다.'),
        },
        'timeline': [
            {'at': '2022-08-08T00:00:00+09:00', 'stage': '경보', 'title': '호우경보 발령(기상청 CAP)',
             'element_binding': 'ALT-07 경보 종류 · ALT-17 사건참조(경보)', 'qname': 'cap:alert · dsafe:aboutEvent'},
            {'at': '2022-08-08T21:00:00+09:00', 'stage': '관측', 'title': '시간강수량 98.5 mm (AWS 종로, 기상청)',
             'element_binding': 'HZ-O06 시간당 강우량 · CLX-01 기후극값', 'qname': 'sosa:Observation'},
            {'at': '2022-08-09T00:00:00+09:00', 'stage': '공간', 'title': '침수구역 경계(GeoJSON Polygon)',
             'element_binding': 'SPT-01 공간객체 · EVT-07 공간범위', 'qname': 'locn:geometry · geo:geoJSONLiteral'},
            {'at': '2022-08-09T09:00:00+09:00', 'stage': '보고', 'title': '중대본 상황보고 3보',
             'element_binding': 'REC-02 사건참조', 'qname': 'foaf:Document · dsafe:aboutEvent'},
            {'at': '2022-08-22T00:00:00+09:00', 'stage': '선포', 'title': '특별재난지역 선포',
             'element_binding': 'EVT-11 선포상태', 'qname': 'dsafe:declarationStatus'},
            {'at': '2026-07-08T09:30:00+09:00', 'stage': 'AI 데이터', 'title': 'SAR 홍수탐지 학습데이터셋 등재',
             'element_binding': 'AID-01 AI 데이터셋ID · AID-12 사건참조(데이터셋)', 'qname': 'dcat:Dataset · dsafe:aboutEvent'},
        ],
        'data_status': 'meta_demo',
    }


# ---------------------------------------------------------------- 파일 갱신

def write_pair(rel: str, payload) -> None:
    """data/ 정본과 apps/web/public/seed/ 사본을 같은 내용으로 쓴다.

    사본 위치는 data/seed·data/reference 구분 없이 전부 public/seed/ 다 —
    validate_vercel_repo 가 그 짝으로 일치를 검사한다."""
    text = json.dumps(payload, ensure_ascii=False, indent=1)
    (REPO / rel).write_text(text, encoding='utf-8')
    mirror = REPO / 'apps' / 'web' / 'public' / 'seed' / Path(rel).name
    mirror.parent.mkdir(parents=True, exist_ok=True)
    mirror.write_text(text, encoding='utf-8')


def main() -> int:
    jgp = load_instances(PLANS['jgp'][0])
    rmp = load_instances(PLANS['rmp'][0])
    sgp = load_instances(PLANS['sgp'][0])

    # ── districts
    new_districts = daegu_districts(jgp) + jeongeup_districts(rmp) + gimhae_districts(sgp)
    path = REPO / 'data' / 'reference' / 'districts.json'
    doc = json.loads(path.read_text(encoding='utf-8'))
    doc['districts'] = [d for d in doc['districts'] if d.get('data_status') != 'meta_demo'] + new_districts
    doc['counts'] = {'total': len(doc['districts'])}
    write_pair('data/reference/districts.json', doc)
    print(f'districts: 메타 지구 {len(new_districts)}건 (대구 {sum(1 for d in new_districts if d["admin_code"]=="27170")} · '
          f'정읍 {sum(1 for d in new_districts if d["admin_code"]=="52180")} · 김해 {sum(1 for d in new_districts if d["admin_code"]=="48250")})')

    # ── rivers
    new_rivers = [r for r in (jeongeup_river(rmp), gimhae_river(sgp)) if r]
    path = REPO / 'data' / 'reference' / 'rivers.json'
    doc = json.loads(path.read_text(encoding='utf-8'))
    doc['rivers'] = [r for r in doc['rivers'] if r.get('data_status') != 'meta_demo'] + new_rivers
    write_pair('data/reference/rivers.json', doc)
    print(f'rivers: 메타 하천 {len(new_rivers)}건 ({", ".join(r["name"] for r in new_rivers)})')

    # ── situations (배열 끝에 — smoke_evidence_console 이 [0] 을 쓴다)
    path = REPO / 'data' / 'seed' / 'current_situations_seed.json'
    doc = json.loads(path.read_text(encoding='utf-8'))
    doc['situations'] = [s for s in doc['situations'] if '-META-' not in s['situation_id']] + meta_situations()
    write_pair('data/seed/current_situations_seed.json', doc)
    print(f'situations: {len(doc["situations"])}건 (메타 3건 포함)')

    # ── procedures 대상 코드 확장 (잠정 절차를 메타 3지역에도 보여 준다)
    path = REPO / 'data' / 'seed' / 'response_procedures_seed.json'
    doc = json.loads(path.read_text(encoding='utf-8'))
    steps = doc.get('steps') or doc.get('procedures') or []
    for step in steps:
        targets = step.get('target_admin_codes') or []
        for code in ('27170', '52180', '48250'):
            if code not in targets:
                targets.append(code)
        step['target_admin_codes'] = targets
    write_pair('data/seed/response_procedures_seed.json', doc)
    print(f'procedures: {len(steps)}건에 메타 3지역 코드 추가')

    # ── CQ 답변·타임라인
    cq = build_cq_answers()
    write_pair('data/seed/meta_demo_cq_answers_seed.json', cq)
    answerable = sum(1 for e in cq['entries'] if e['answerable'])
    print(f'CQ 답변: {len(cq["entries"])}문 중 답변 소재 확보 {answerable}문')

    write_pair('data/seed/meta_demo_event_timeline_seed.json', build_event_timeline())
    print('사건 타임라인: KDSA-20220808-1168010800-001 · 6개 시점')

    # 검산 — 설문자 성명 값이 산출물에 남지 않았는지. 원자료의 성명은 '장*수' 처럼 마스킹된
    # 형태이므로 그 패턴을 찾는다('성명' 낱말 검사는 안내 문구까지 잡아 오탐이다).
    masked_name = re.compile(r'[가-힣]\*[가-힣]')
    for rel in ('data/reference/districts.json', 'data/seed/meta_demo_cq_answers_seed.json'):
        text = (REPO / rel).read_text(encoding='utf-8')
        hit = masked_name.search(text)
        if hit:
            print(f'FAIL {rel} 에 마스킹 성명 패턴({hit.group()})이 남아 있다')
            return 1
    print('PASS 메타 표본 시드 생성 (마스킹 성명 미포함 확인)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
