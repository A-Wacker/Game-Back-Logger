/**
 * Drag-to-reorder rows within a section via the left-side handle.
 * Pointer Events only (works for touch and mouse); the handle sets
 * touch-action: none in CSS so the gesture never fights page scroll.
 * The dragged row follows the pointer with a transform while the DOM
 * reorders live as it crosses sibling midpoints; near the viewport
 * edges the page auto-scrolls so long lists are reachable.
 */
export type ReorderCallback = (id: string, newIndex: number) => void;

interface DragState {
  row: HTMLElement;
  list: HTMLElement;
  id: string;
  pointerId: number;
  startPointerY: number;
  /** Compensation added when the row's natural position shifts on reorder. */
  baseOffset: number;
  pointerY: number;
  raf: number;
}

let drag: DragState | null = null;
let onReorder: ReorderCallback = () => {};

export function initDrag(container: HTMLElement, callback: ReorderCallback): void {
  onReorder = callback;
  container.addEventListener('pointerdown', onPointerDown);
}

function onPointerDown(e: PointerEvent): void {
  const handle = (e.target as HTMLElement).closest<HTMLElement>('.drag-handle');
  if (!handle || drag || !handle.dataset.id) return;
  const row = handle.closest<HTMLElement>('.game-row');
  const list = row?.parentElement;
  if (!row || !list) return;
  e.preventDefault();
  try {
    handle.setPointerCapture(e.pointerId);
  } catch {
    // Capture is best-effort; document-level listeners still see the events.
  }
  drag = {
    row,
    list,
    id: handle.dataset.id,
    pointerId: e.pointerId,
    startPointerY: e.clientY,
    baseOffset: 0,
    pointerY: e.clientY,
    raf: 0,
  };
  row.classList.add('dragging');
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
  drag.raf = requestAnimationFrame(autoScrollTick);
}

function onPointerMove(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointerId) return;
  e.preventDefault();
  drag.pointerY = e.clientY;
  updatePosition();
}

/** Where the element will sit once any in-flight transform animation ends. */
function untransformedRect(el: HTMLElement): DOMRect {
  const rect = el.getBoundingClientRect();
  const transform = getComputedStyle(el).transform;
  if (transform && transform !== 'none') {
    const m = new DOMMatrixReadOnly(transform);
    return new DOMRect(rect.x - m.m41, rect.y - m.m42, rect.width, rect.height);
  }
  return rect;
}

function updatePosition(): void {
  if (!drag) return;
  const { row, list } = drag;
  row.style.transform = `translateY(${drag.pointerY - drag.startPointerY + drag.baseOffset}px)`;

  // Reorder live while the dragged row's visual box crosses a sibling's
  // midpoint. Siblings are measured at their settled (untransformed)
  // position so a mid-slide row can't retrigger a swap and jitter.
  // Loop so a fast fling can pass several rows in one event.
  for (let guard = 0; guard < 100; guard++) {
    const rect = row.getBoundingClientRect();
    const prev = row.previousElementSibling as HTMLElement | null;
    const next = row.nextElementSibling as HTMLElement | null;
    if (prev) {
      const pr = untransformedRect(prev);
      if (rect.top < pr.top + pr.height / 2) {
        moveRow(row, list, prev, prev);
        continue;
      }
    }
    if (next) {
      const nr = untransformedRect(next);
      if (rect.bottom > nr.top + nr.height / 2) {
        moveRow(row, list, next.nextSibling, next);
        continue;
      }
    }
    break;
  }
}

function moveRow(
  row: HTMLElement,
  list: HTMLElement,
  before: Node | null,
  displaced: HTMLElement,
): void {
  if (!drag) return;
  const displacedFrom = displaced.getBoundingClientRect();
  const naturalTop = row.offsetTop;
  list.insertBefore(row, before);
  // The row's natural position jumped; grow/shrink the transform so its
  // visual position under the pointer is unchanged.
  drag.baseOffset += naturalTop - row.offsetTop;
  row.style.transform = `translateY(${drag.pointerY - drag.startPointerY + drag.baseOffset}px)`;
  // FLIP: the displaced sibling slides from where it visually was to its
  // new slot instead of popping there.
  const dy = displacedFrom.top - untransformedRect(displaced).top;
  if (dy !== 0) {
    displaced.style.transition = 'none';
    displaced.style.transform = `translateY(${dy}px)`;
    void displaced.offsetHeight; // flush so the transition below animates
    displaced.style.transition = 'transform 160ms ease';
    displaced.style.transform = '';
    displaced.addEventListener(
      'transitionend',
      () => {
        displaced.style.transition = '';
      },
      { once: true },
    );
  }
}

function autoScrollTick(): void {
  if (!drag) return;
  const margin = 100;
  const maxSpeed = 16;
  let dy = 0;
  if (drag.pointerY < margin) {
    dy = -Math.ceil(((margin - drag.pointerY) / margin) * maxSpeed);
  } else if (drag.pointerY > window.innerHeight - margin) {
    dy = Math.ceil(((drag.pointerY - (window.innerHeight - margin)) / margin) * maxSpeed);
  }
  if (dy !== 0) {
    const before = window.scrollY;
    window.scrollBy(0, dy);
    const scrolled = window.scrollY - before;
    if (scrolled !== 0) {
      // Same pointer position but the document moved under it.
      drag.startPointerY -= scrolled;
      updatePosition();
    }
  }
  drag.raf = requestAnimationFrame(autoScrollTick);
}

function onPointerUp(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const { row, list, id, raf } = drag;
  cancelAnimationFrame(raf);
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('pointercancel', onPointerUp);
  row.classList.remove('dragging');
  row.style.transform = '';
  const newIndex = Array.from(list.children).indexOf(row);
  drag = null;
  onReorder(id, newIndex);
}
