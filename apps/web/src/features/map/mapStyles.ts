import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style';

/** 선(면 경계)은 casing(바깥 테두리) + 본선 2겹으로 그려 영상지도·일반지도 모두에서 배경과 분리되게 한다. */
export function lineStyle(color: string, casing: string, width: number, fill?: string, dash?: number[]) {
  return [
    new Style({ stroke: new Stroke({ color: casing, width: width + 3, lineDash: dash, lineCap: 'round', lineJoin: 'round' }) }),
    new Style({ stroke: new Stroke({ color, width, lineDash: dash, lineCap: 'round', lineJoin: 'round' }), fill: fill ? new Fill({ color: fill }) : undefined }),
  ];
}

/** 점은 casing 원판 위에 본체 원을 얹어 밝은 영상 위에서도 윤곽이 남게 한다. */
export function pointStyle(radius: number, color: string, casing: string, ring: string) {
  return [
    new Style({ image: new CircleStyle({ radius: radius + 3, fill: new Fill({ color: casing }) }) }),
    new Style({ image: new CircleStyle({ radius, fill: new Fill({ color }), stroke: new Stroke({ color: ring, width: 1.6 }) }) }),
  ];
}

/** 영상지도: 어두운 casing + 형광 계열 본선 / 일반지도: 흰 casing + 짙은 본선.
 *  선택상태는 두 모드 모두 색·굵기·casing이 함께 바뀐다. */
export function palette(satellite: boolean) {
  return {
    casing: satellite ? 'rgba(10,12,16,.92)' : 'rgba(255,255,255,.92)',
    activeCasing: satellite ? '#ffffff' : 'rgba(46,26,0,.55)',
    activeLine: satellite ? '#ff2d95' : '#ff8c00',
    activeFill: satellite ? 'rgba(255,45,149,.26)' : 'rgba(255,152,0,.18)',
  };
}
