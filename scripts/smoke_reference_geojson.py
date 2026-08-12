#!/usr/bin/env python3
"""`apps/web/public/reference/` 참조 GeoJSON 구조 검증.

하천 3종·하천명·전국 관측소는 전처리 스크립트가 만들어 리포에 반입한 자료인데,
지금까지 **어떤 게이트도 이 파일들을 보지 않았다.** Seed 는 계약·스모크로 지켜지고
있으므로 같은 수준의 최소 검증을 둔다. 재생성이 잘못되거나 파일이 깨지면 여기서 걸린다.

검사
  1. 유효한 FeatureCollection 이고 피처가 1건 이상인가
  2. 좌표가 대한민국 범위(위경도) 안인가 — 재투영 사고를 잡는다
  3. 파일명이 약속한 도형종류·행정코드와 실제 속성이 일치하는가
  4. 관측소: station_code 중복 없음, 필수 속성 존재, **관측값처럼 보이는 필드가 없음**
  5. 하천: river_id 는 `rivers.json` 에 실재하는 값만, semantic 은 허용값만
  6. 하천명(LABEL): 하천명당 대표점 1개(중복 이름 없음)

네트워크를 쓰지 않는다. 파일만 읽는다.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # type: ignore[union-attr]
except Exception:
    pass

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / 'apps/web/public/reference'

# 대한민국 본토+도서 대략 범위. 재투영 실패(미터 좌표가 그대로 남는 등)를 잡는 용도다.
KR_BBOX = (124.0, 32.5, 132.5, 39.5)
SEMANTICS = {'channel', 'zone', 'centerline', 'label'}
# 서비스 범위는 국가·지방·소하천 3종이다. 실폭·경계는 등급 속성이 없어 중심선에서
# 공간조인해 붙이며, 중심선이 지나지 않으면 '등급미확인'으로 남긴다(추정하지 않는다).
RIVER_CLASSES = {'국가하천', '지방하천', '소하천', '등급미확인'}
RIVER_KIND_GEOM = {'TN_RIVER_BT': 'Polygon', 'TN_RIVER_BNDRY': 'Polygon',
                   'TN_RIVER_CTLN': 'LineString', 'TN_RIVER_LABEL': 'Point'}
# 관측소 파일은 '제원'이다. 관측값이 섞여 들어오면 화면이 실측값으로 오인시킬 수 있다.
OBSERVATION_LIKE = {'value', 'observed_at', 'water_level', 'rainfall', 'obsrValue', 'value_status'}

failures: list[str] = []


def fail(message: str) -> None:
    failures.append(message)


def coordinates(geometry) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []

    def walk(node):
        if isinstance(node, (list, tuple)) and node and isinstance(node[0], (int, float)):
            out.append((float(node[0]), float(node[1])))
            return
        for child in node:
            walk(child)

    walk(geometry['coordinates'])
    return out


def check_common(path: Path, features: list) -> None:
    rel = path.relative_to(REPO)
    x0, y0, x1, y1 = KR_BBOX
    outside = 0
    for feature in features:
        for lon, lat in coordinates(feature['geometry']):
            if not (x0 <= lon <= x1 and y0 <= lat <= y1):
                outside += 1
                break
    if outside:
        fail(f'{rel}: 대한민국 범위를 벗어난 좌표를 가진 피처 {outside}건 (재투영 확인)')


def check_rivers(path: Path, features: list, river_ids: set[str]) -> None:
    rel = path.relative_to(REPO)
    match = re.fullmatch(r'(TN_RIVER_[A-Z]+)_(\d{5})', path.stem)
    if not match:
        fail(f'{rel}: 파일명이 TN_RIVER_<종류>_<행정코드5> 형식이 아니다')
        return
    kind, admin = match.groups()
    expected = RIVER_KIND_GEOM.get(kind)
    if expected is None:
        fail(f'{rel}: 알 수 없는 하천 자료 종류 {kind}')
        return

    names: dict[str, int] = {}
    for feature in features:
        props = feature['properties']
        geom = feature['geometry']['type'].replace('Multi', '')
        if geom != expected:
            fail(f'{rel}: {kind} 는 {expected} 여야 하는데 {feature["geometry"]["type"]} 이 있다')
            break
        if props.get('admin_code') != admin:
            fail(f'{rel}: 파일명 행정코드 {admin} 와 속성 admin_code {props.get("admin_code")} 가 다르다')
            break
        if props.get('semantic') not in SEMANTICS:
            fail(f'{rel}: 허용되지 않은 semantic {props.get("semantic")}')
            break
        river_class = props.get('river_class')
        if river_class and river_class not in RIVER_CLASSES:
            fail(f'{rel}: 서비스 범위 밖 river_class {river_class} (국가·지방·소하천 3종 + 등급미확인만 허용)')
            break
        river_id = props.get('river_id')
        if river_id and river_id not in river_ids:
            fail(f'{rel}: rivers.json 에 없는 river_id {river_id}')
            break
        if kind == 'TN_RIVER_LABEL':
            name = props.get('RIVER_NM')
            if not name:
                fail(f'{rel}: 하천명 레이어인데 RIVER_NM 이 없는 피처가 있다')
                break
            names[name] = names.get(name, 0) + 1

    duplicated = [n for n, c in names.items() if c > 1]
    if duplicated:
        fail(f'{rel}: 하천명 대표점이 중복이다(하천당 1개여야 한다) — {duplicated[:5]}')


def check_stations(path: Path, features: list) -> None:
    rel = path.relative_to(REPO)
    seen: set[str] = set()
    duplicated: list[str] = []
    for feature in features:
        props = feature['properties']
        code = props.get('station_code')
        if not code:
            fail(f'{rel}: station_code 가 없는 피처가 있다')
            break
        if code in seen:
            duplicated.append(code)
        seen.add(code)
        for key in ('name', 'station_type', 'source', 'fetched_at'):
            if not props.get(key):
                fail(f'{rel}: {code} 에 {key} 가 없다')
                break
        if props.get('data_kind') != 'station_metadata':
            fail(f'{rel}: {code} 의 data_kind 가 station_metadata 가 아니다 — 관측값으로 오인될 수 있다')
            break
        leaked = OBSERVATION_LIKE & set(props)
        if leaked:
            fail(f'{rel}: {code} 에 관측값처럼 보이는 속성이 있다 {sorted(leaked)} — 제원 파일에 값이 섞였다')
            break
    if duplicated:
        fail(f'{rel}: station_code 중복 {len(duplicated)}건 — {duplicated[:5]}')


def main() -> int:
    if not ROOT.is_dir():
        print(f'{ROOT.relative_to(REPO)} 가 없다')
        return 1
    rivers = json.loads((REPO / 'data/reference/rivers.json').read_text(encoding='utf-8'))
    rows = rivers if isinstance(rivers, list) else rivers.get('rivers', [])
    river_ids = {row['river_id'] for row in rows}

    paths = sorted(ROOT.rglob('*.geojson'))
    if not paths:
        print('참조 GeoJSON 이 하나도 없다')
        return 1

    total = 0
    for path in paths:
        try:
            payload = json.loads(path.read_text(encoding='utf-8'))
        except Exception as error:
            fail(f'{path.relative_to(REPO)}: JSON 파싱 실패 {error}')
            continue
        if payload.get('type') != 'FeatureCollection':
            fail(f'{path.relative_to(REPO)}: FeatureCollection 이 아니다')
            continue
        features = payload.get('features') or []
        if not features:
            fail(f'{path.relative_to(REPO)}: 피처가 0건이다')
            continue
        total += len(features)
        check_common(path, features)
        if path.parent.name == 'rivers':
            check_rivers(path, features, river_ids)
        elif path.parent.name == 'stations':
            check_stations(path, features)

    print(f'참조 GeoJSON: {len(paths)}개 파일 · 피처 {total:,}건')
    if failures:
        print(f'FAIL reference geojson: {len(failures)}건')
        for item in failures:
            print(f'  - {item}')
        return 1
    print('PASS reference geojson: 구조·좌표범위·식별자 정합 확인')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
