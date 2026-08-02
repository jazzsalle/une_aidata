#!/usr/bin/env python3
"""UNE 디자인 시스템 폰트(Spoqa Han Sans Neo) → WOFF2 서브셋 생성 스크립트.

- 원본: 리포 루트 `SpoqaHanSansNeo-Regular/*.ttf` (각 약 13MB, 배포 번들에 넣지 않는다)
- 산출물: `apps/web/public/fonts/SpoqaHanSansNeo-{Regular,Medium,Bold}.subset.woff2`
- 굵기는 화면에서 실제 사용하는 400/500/700 3종만 생성한다.
- 서브셋 범위: 한글 음절 전체(11,172) + 한글 자모 + 라틴 + 숫자 + 문장부호 +
  단위/기호(㎥ ㎢ ℃ · → × ± 등) + 리포 소스에서 수집한 실제 사용 문자.
  (KS X 1001 2,350자만 담으면 사용자 입력 한글이 폴백 폰트로 튈 수 있어 음절 전체를 담는다.
   전체 음절을 담아도 굵기당 약 0.6MB로 목표 크기 1.5MB 이하를 만족한다.)

사용법:
    pip install fonttools brotli
    python scripts/build_web_fonts.py            # 생성 + 커버리지 검증
    python scripts/build_web_fonts.py --verify-only
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = ROOT / 'SpoqaHanSansNeo-Regular'
DEFAULT_OUTPUT_DIR = ROOT / 'apps' / 'web' / 'public' / 'fonts'

# (원본 파일 스타일, CSS font-weight, 산출물 이름)
WEIGHTS: tuple[tuple[str, int, str], ...] = (
    ('Regular', 400, 'SpoqaHanSansNeo-Regular.subset.woff2'),
    ('Medium', 500, 'SpoqaHanSansNeo-Medium.subset.woff2'),
    ('Bold', 700, 'SpoqaHanSansNeo-Bold.subset.woff2'),
)

MAX_FILE_BYTES = 1_500_000
MAX_TOTAL_BYTES = 4_000_000

# 화면에 노출될 수 있는 문자열이 들어있는 경로(정적 문구 + Seed 데이터 + Provider 응답 문구)
SCAN_GLOBS: tuple[str, ...] = (
    'apps/web/index.html',
    'apps/web/src/**/*',
    'apps/web/public/**/*',
    'apps/web/tests/**/*',
    'data/seed/**/*',
    'server/**/*',
    'api/**/*',
    'tests/**/*',
)
SCAN_SUFFIXES = {'.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.geojson', '.svg'}


def _ranges(*pairs: tuple[int, int]) -> set[int]:
    out: set[int] = set()
    for start, end in pairs:
        out.update(range(start, end + 1))
    return out


def base_unicodes() -> set[int]:
    """굵기와 무관하게 항상 포함하는 코드포인트 집합."""
    codepoints = _ranges(
        (0x0020, 0x007E),  # 라틴 기본·숫자·문장부호
        (0x00A0, 0x00FF),  # 라틴-1 보충(°, ±, ·, ×, ÷, ², ³, § 포함)
        (0x1100, 0x11FF),  # 한글 자모(조합형·NFD 대비)
        (0x2010, 0x205E),  # 일반 문장부호(대시·따옴표·…·※ 등)
        (0x2100, 0x214F),  # 문자꼴 기호(℃, ℉, №, ™ 등)
        (0x2190, 0x21FF),  # 화살표(→ ↔ ↺ 등)
        (0x2460, 0x24FF),  # 원문자(①②③)
        (0x2500, 0x257F),  # 괘선
        (0x25A0, 0x25FF),  # 도형(▶ ◀ ● ○ ■ □)
        (0x3000, 0x303F),  # CJK 문장부호(「」 등)
        (0x3130, 0x318F),  # 한글 호환 자모
        (0x3200, 0x32FF),  # 괄호·원 한글/단위
        (0x3300, 0x33FF),  # 단위 기호(㎥ ㎢ ㎡ ㎜ ㎞ ㏊ 등)
        (0xAC00, 0xD7A3),  # 한글 음절 전체
        (0xFF01, 0xFF5E),  # 전각 영숫자·문장부호
    )
    codepoints.update(
        {
            0x2200, 0x2202, 0x2206, 0x220F, 0x2211, 0x2212, 0x2213, 0x221A, 0x221E,
            0x2229, 0x222A, 0x2248, 0x2260, 0x2261, 0x2264, 0x2265, 0x2282, 0x2283,
            0x2318, 0x2600, 0x2605, 0x2606, 0x2610, 0x2611, 0x2612, 0x261C, 0x261E,
            0x26A0, 0x2713, 0x2714, 0x2715, 0x2716, 0x2717, 0x2718, 0x274C, 0x2757,
            0xFFE6,
        }
    )
    return codepoints


def collect_source_chars(root: Path = ROOT) -> tuple[set[str], int]:
    """리포 소스에서 화면 노출 가능 문자를 수집한다(누락 검증용)."""
    chars: set[str] = set()
    files = 0
    seen: set[Path] = set()
    for pattern in SCAN_GLOBS:
        for path in root.glob(pattern):
            if not path.is_file() or path.suffix.lower() not in SCAN_SUFFIXES:
                continue
            if path in seen:
                continue
            seen.add(path)
            try:
                text = path.read_text(encoding='utf-8')
            except (UnicodeDecodeError, OSError):
                continue
            files += 1
            chars.update(text)
    # 제어문자·공백류는 글리프 검증 대상이 아니다
    printable = {c for c in chars if ord(c) > 0x20 and c not in {' ', '﻿'}}
    return printable, files


def build_subsets(source_dir: Path, output_dir: Path, unicodes: set[int]) -> list[tuple[str, int]]:
    from fontTools import subset  # 지연 import: --verify-only 경로에서도 동작

    output_dir.mkdir(parents=True, exist_ok=True)
    results: list[tuple[str, int]] = []
    for style, _weight, out_name in WEIGHTS:
        src = source_dir / f'SpoqaHanSansNeo-{style}.ttf'
        if not src.exists():
            raise SystemExit(f'ERROR: 원본 폰트를 찾을 수 없습니다: {src}')
        options = subset.Options()
        options.flavor = 'woff2'
        options.hinting = True
        options.desubroutinize = False
        options.notdef_outline = True
        options.layout_features = ['*']
        options.name_IDs = ['*']       # OFL 저작권·라이선스 name 레코드 보존
        options.name_legacy = True
        options.name_languages = ['*']
        options.drop_tables += ['DSIG']
        font = subset.load_font(str(src), options)
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=sorted(unicodes))
        subsetter.subset(font)
        out_path = output_dir / out_name
        subset.save_font(font, str(out_path), options)
        font.close()
        results.append((out_name, out_path.stat().st_size))
    return results


def source_cmap(source_dir: Path, style: str) -> set[int]:
    from fontTools.ttLib import TTFont

    font = TTFont(str(source_dir / f'SpoqaHanSansNeo-{style}.ttf'))
    keys = set(font.getBestCmap().keys())
    font.close()
    return keys


def verify_coverage(source_dir: Path, output_dir: Path, required: set[str]) -> dict[str, tuple[list[str], list[str]]]:
    """산출물 cmap과 실제 사용 문자를 대조한다.

    반환값: {파일명: (서브셋 누락, 원본 폰트 자체 미보유)}
    원본 TTF에도 없는 문자는 서브셋 결함이 아니라 브라우저 폰트 폴백 대상이다.
    """
    from fontTools.ttLib import TTFont

    result: dict[str, tuple[list[str], list[str]]] = {}
    for style, _weight, out_name in WEIGHTS:
        path = output_dir / out_name
        if not path.exists():
            result[out_name] = (['<파일 없음>'], [])
            continue
        font = TTFont(str(path))
        cmap = set(font.getBestCmap().keys())
        font.close()
        absent = sorted(c for c in required if ord(c) not in cmap)
        origin = source_cmap(source_dir, style)
        unsupported = [c for c in absent if ord(c) not in origin]
        dropped = [c for c in absent if ord(c) in origin]
        result[out_name] = (dropped, unsupported)
    return result


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # type: ignore[union-attr]
    except Exception:
        pass
    parser = argparse.ArgumentParser(description='Spoqa Han Sans Neo → WOFF2 서브셋 생성')
    parser.add_argument('--source-dir', default=str(DEFAULT_SOURCE_DIR), help='원본 TTF 폴더')
    parser.add_argument('--out-dir', default=str(DEFAULT_OUTPUT_DIR), help='WOFF2 산출 폴더')
    parser.add_argument('--verify-only', action='store_true', help='생성 없이 커버리지만 검증')
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    output_dir = Path(args.out_dir)

    required, scanned_files = collect_source_chars()
    hangul = {c for c in required if 0xAC00 <= ord(c) <= 0xD7A3}
    print(f'스캔 파일 {scanned_files}개 · 사용 문자 {len(required)}종(한글 음절 {len(hangul)}종)')

    if not args.verify_only:
        unicodes = base_unicodes() | {ord(c) for c in required}
        print(f'서브셋 대상 코드포인트 {len(unicodes)}개 · 생성 시작')
        for name, size in build_subsets(source_dir, output_dir, unicodes):
            print(f'  {name}: {size / 1024:.0f} KB')

    total = 0
    over_budget: list[str] = []
    for _style, _weight, out_name in WEIGHTS:
        path = output_dir / out_name
        if not path.exists():
            print(f'FAIL: 산출물 없음 {path}')
            return 1
        size = path.stat().st_size
        total += size
        if size > MAX_FILE_BYTES:
            over_budget.append(f'{out_name} {size / 1024:.0f} KB')
    print(f'합계 {total / 1024:.0f} KB (파일당 상한 {MAX_FILE_BYTES / 1024:.0f} KB · 합계 상한 {MAX_TOTAL_BYTES / 1024:.0f} KB)')

    failed = False
    if over_budget or total > MAX_TOTAL_BYTES:
        print(f'FAIL: 크기 초과 {over_budget or ""} total={total}')
        failed = True

    coverage = verify_coverage(source_dir, output_dir, required)
    for name, (dropped, unsupported) in coverage.items():
        if dropped:
            failed = True
            print(f'FAIL: {name} 서브셋 누락 {len(dropped)}자 → {"".join(dropped[:60])}')
        else:
            print(f'PASS: {name} 서브셋 누락 0자')
        if unsupported:
            print(
                f'INFO: {name} 원본 Spoqa 폰트 자체 미보유 {len(unsupported)}자 → '
                f'{"".join(unsupported)} (브라우저 폰트 폴백으로 표시)'
            )

    if failed:
        print('FAIL: build_web_fonts')
        return 1
    print('PASS: build_web_fonts')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
