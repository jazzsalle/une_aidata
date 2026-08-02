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
