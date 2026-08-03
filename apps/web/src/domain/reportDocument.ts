// 보고서 초안을 "문자열"이 아니라 "문서 구조"로 다루기 위한 순수 모델 모듈.
// 구조(ReportDocument) → 표현은 두 갈래로만 파생한다: toMarkdown(다운로드/원문)과 화면 렌더(ReportEditor).
// 마크다운 문자열을 다시 파싱하지 않으며, 외부 마크다운 라이브러리를 사용하지 않는다.
// 본 모듈은 표현 규칙만 담당하고 업무판단(피해예측·공식 위험도·자동 조치결정)을 만들지 않는다.

/** 목록 항목. children은 항목에 종속된 보조행(마크다운 2칸 들여쓰기)으로 직렬화된다. */
export interface ReportListItem {
  text: string;
  children?: string[];
}

/** 순위표시가 있는 항목(우선 확인지역 등). marker는 표시용 번호이며 배열 순서와 무관하게 보존한다. */
export interface ReportRankedItem {
  marker: number;
  text: string;
}

export type ReportBlock =
  | { kind: 'text'; value: string }
  | { kind: 'list'; items: ReportListItem[] }
  | { kind: 'ranked-list'; items: ReportRankedItem[] }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  | { kind: 'note'; value: string };

/** level 2/3은 마크다운 `##`/`###`에 대응한다(문서 제목은 ReportDocument.title). */
export interface ReportSection {
  id: string;
  level: 2 | 3;
  heading: string;
  blocks: ReportBlock[];
}

export interface ReportDocument {
  title: string;
  sections: ReportSection[];
  /** 문서 말미 안내(검토용 초안 고지 등). */
  closing: ReportBlock[];
}

export function textBlock(value: string): ReportBlock {
  return { kind: 'text', value };
}

export function listBlock(items: ReportListItem[]): ReportBlock {
  return { kind: 'list', items };
}

export function rankedListBlock(items: ReportRankedItem[]): ReportBlock {
  return { kind: 'ranked-list', items };
}

export function noteBlock(value: string): ReportBlock {
  return { kind: 'note', value };
}

export function tableBlock(columns: string[], rows: string[][]): ReportBlock {
  return { kind: 'table', columns, rows };
}

/** `지표: 값 (자료상태)` 한 줄. 값 뒤 괄호는 선택이다. */
const MEASUREMENT_LINE = /^\s*([^:]+?)\s*:\s*(.+?)\s*$/;
const TRAILING_STATUS = /^(.*?)\s*\(([^()]*)\)\s*$/;
/** 표로 바꿀 최소 줄 수. 1줄짜리를 표로 만들면 오히려 읽기 나쁘다. */
const MIN_TABLE_ROWS = 2;

/**
 * 지표가 여러 줄 나열된 본문을 표 블록으로 바꾼다(그 외 줄은 아래 문단으로 남긴다).
 *
 * 담당자가 자유롭게 고쳐 쓰는 칸이므로 형식을 강제하지 않는다 — `지표: 값` 꼴이 아닌 줄은
 * 표에 넣지 않고, 그런 줄만 있거나 표에 넣을 줄이 {@link MIN_TABLE_ROWS}개 미만이면
 * 예전처럼 문단 하나로 렌더한다. 즉 산문을 쓰면 산문 그대로 나온다.
 * `자료상태` 열은 괄호 표기가 하나라도 있을 때만 만든다.
 */
export function measurementBlocks(value: string): ReportBlock[] {
  const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
  const rows: string[][] = [];
  const rest: string[] = [];
  let hasStatus = false;
  for (const line of lines) {
    const matched = MEASUREMENT_LINE.exec(line);
    if (!matched) { rest.push(line); continue; }
    const label = matched[1] ?? '';
    const status = TRAILING_STATUS.exec(matched[2] ?? '');
    if (status) hasStatus = true;
    rows.push([label, (status ? status[1] : matched[2]) ?? '', status ? (status[2] ?? '') : '']);
  }
  if (rows.length < MIN_TABLE_ROWS) return [textBlock(value)];
  const columns = hasStatus ? ['지표', '값', '자료상태'] : ['지표', '값'];
  const table = tableBlock(columns, hasStatus ? rows : rows.map((row) => row.slice(0, 2)));
  return rest.length > 0 ? [table, textBlock(rest.join('\n'))] : [table];
}

function blockToMarkdown(block: ReportBlock): string {
  switch (block.kind) {
    case 'text':
      return block.value;
    case 'list':
      return block.items
        .map((item) => [`- ${item.text}`, ...(item.children ?? []).map((child) => `  - ${child}`)].join('\n'))
        .join('\n');
    case 'ranked-list':
      return block.items.map((item) => `${item.marker}. ${item.text}`).join('\n');
    case 'table': {
      // GFM 파이프 표. 셀 안의 `|`는 표 구분자로 읽히므로 이스케이프한다.
      const cell = (value: string) => value.replace(/\|/g, '\\|');
      const head = `| ${block.columns.map(cell).join(' | ')} |`;
      const divider = `| ${block.columns.map(() => '---').join(' | ')} |`;
      const body = block.rows.map((row) => `| ${row.map(cell).join(' | ')} |`);
      return [head, divider, ...body].join('\n');
    }
    case 'note':
      return `> ${block.value}`;
  }
}

function blocksToMarkdown(blocks: ReportBlock[]): string {
  return blocks.map(blockToMarkdown).join('\n\n');
}

/**
 * 문서 구조를 마크다운 문자열로 직렬화한다(다운로드 파일 본문 = 이 함수 결과).
 * 규칙: 제목/절 제목 뒤 본문은 1개 개행, 절 사이는 빈 줄 1개,
 * 본문 없는 절(상위 절 바로 뒤에 하위 절이 오는 경우)은 개행 1개로 붙인다.
 */
export function toMarkdown(doc: ReportDocument): string {
  let out = `# ${doc.title}`;
  let gap = '\n\n';
  for (const section of doc.sections) {
    out += `${gap}${'#'.repeat(section.level)} ${section.heading}`;
    if (section.blocks.length > 0) {
      out += `\n${blocksToMarkdown(section.blocks)}`;
      gap = '\n\n';
    } else {
      gap = '\n';
    }
  }
  if (doc.closing.length > 0) {
    out += `\n\n${blocksToMarkdown(doc.closing)}`;
  }
  return out;
}
