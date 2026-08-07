import { Fill, Stroke, Style, Circle as CircleStyle, Text as TextStyle } from 'ol/style';

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

/** 하천명 라벨. 배경 판을 깔지 않고 글자 자체에 두꺼운 외곽선을 둘러
 *  영상지도(어두움)와 일반지도(밝음) 양쪽에서 읽히게 한다. 작은 점을 함께 찍어
 *  라벨이 가리키는 위치가 어디인지 남긴다. */
export function labelStyle(text: string, color: string, halo: string, dot: string) {
  return [
    new Style({
      image: new CircleStyle({ radius: 3, fill: new Fill({ color: dot }), stroke: new Stroke({ color: halo, width: 1.5 }) }),
      text: new TextStyle({
        text,
        font: '600 12px Spoqa Han Sans Neo, system-ui, sans-serif',
        offsetY: -12,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: halo, width: 3.5 }),
        overflow: true,
      }),
    }),
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
