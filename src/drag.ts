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

function updatePosition(): void {
  if (!drag) return;
  const { row, list } = drag;
  row.style.transform = `translateY(${drag.pointerY - drag.startPointerY + drag.baseOffset}px)`;

  // Reorder live while the dragged row's visual box crosses a sibling's
  // midpoint. Loop so a fast fling can pass several rows in one event.
  for (let guard = 0; guard < 100; guard++) {
    const rect = row.getBoundingClientRect();
    const prev = row.previousElementSibling as HTMLElement | null;
    const next = row.nextElementSibling as HTMLElement | null;
    if (prev) {
      const pr = prev.getBoundingClientRect();
      if (rect.top < pr.top + pr.height / 2) {
        moveRow(row, list, prev);
        continue;
      }
    }
    if (next) {
      const nr = next.getBoundingClientRect();
      if (rect.bottom > nr.top + nr.height / 2) {
        moveRow(row, list, next.nextSibling);
        continue;
      }
    }
    break;
  }
}

function moveRow(row: HTMLElement, list: HTMLElement, before: Node | null): void {
  if (!drag) return;
  const naturalTop = row.offsetTop;
  list.insertBefore(row, before);
  // The row's natural position jumped; grow/shrink the transform so its
  // visual position under the pointer is unchanged.
  drag.baseOffset += naturalTop - row.offsetTop;
  row.style.transform = `translateY(${drag.pointerY - drag.startPointerY + drag.baseOffset}px)`;
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
