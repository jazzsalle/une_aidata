import type { KeyboardEvent } from 'react';

export function moveTabFocus<T extends string>(
  event: KeyboardEvent<HTMLElement>,
  values: readonly T[],
  active: T,
  setActive: (value: T) => void,
  idPrefix: string,
) {
  const horizontalKeys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!horizontalKeys.includes(event.key)) return;
  event.preventDefault();
  const currentIndex = Math.max(0, values.indexOf(active));
  let nextIndex = currentIndex;
  if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + values.length) % values.length;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % values.length;
  if (event.key === 'Home') nextIndex = 0;
  if (event.key === 'End') nextIndex = values.length - 1;
  const next = values[nextIndex]!;
  setActive(next);
  requestAnimationFrame(() => document.getElementById(`${idPrefix}-${nextIndex}`)?.focus());
}
