import type { CurrentSituation } from '../types/contracts';
import type { RouteDefinition } from '../hooks/useRoute';
import { routes } from '../hooks/useRoute';

interface Props {
  route: RouteDefinition;
  situations: CurrentSituation[];
  selected: CurrentSituation | null;
  onNavigate(path: string): void;
  onSelect(id: string): void;
  onSave(): void;
}

export function AppHeader({ route, situations, selected, onNavigate, onSelect, onSave }: Props) {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">본문 바로가기</a>
      <div className="brand-nav-row">
        <div className="brand-block">
          <strong>재난안전 AI 대응지원</strong>
          <span>POC · 현재조건 + 지식데이터</span>
        </div>
        <nav className="global-nav" aria-label="주요 메뉴">
          {routes.map((item) => (
            <a
              key={item.id}
              href={item.path}
              aria-current={route.id === item.id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.path);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="context-bar" aria-label="현재 상황 기준">
        <label className="context-select">
          <span>지역·상황</span>
          <select value={selected?.situation_id ?? ''} onChange={(event) => onSelect(event.target.value)}>
            {situations.map((item) => (
              <option key={item.situation_id} value={item.situation_id}>{item.admin_name}</option>
            ))}
          </select>
        </label>
        <div className="context-item"><span>기준시각</span><strong>{selected ? new Date(selected.reference_time).toLocaleString('ko-KR') : '-'}</strong></div>
        <div className="context-item"><span>모드</span><strong>{selected?.mode === 'scenario' ? '시나리오' : selected?.mode === 'hybrid' ? '공공 API + 입력' : '실시간'}</strong></div>
        <div className="context-item"><span>재난유형</span><strong>{selected?.hazards.join(' · ') ?? '-'}</strong></div>
        <button type="button" className="secondary-action" onClick={onSave}>상황뷰 저장</button>
      </div>
    </header>
  );
}
