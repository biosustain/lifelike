import { getBoundingClientRectRelativeToContainer, NodeTextRange } from '../dom';

/**
 * Highlights text in a document asynchronously.
 */
export class AsyncTextHighlighter {

  // TODO: Implement the ability to highlight a specific entry even more (add the .highlight-block-focus CSS class)
  // TODO: Redraw on DOM changes / scroll
  // TODO: Adjust throttling to reduce even minor freezing in browser during scroll

  renderTimeBudget = 1;
  protected readonly mapping: Map<Element, TextHighlight[]> = new Map();
  protected readonly intersectionObserver = new IntersectionObserver(this.intersectionChange.bind(this));
  protected readonly renderQueue = new Map<TextHighlight, (fragment: DocumentFragment) => any>();

  constructor(public container: Element) {
  }

  /**
   * Call this every render frame.
   */
  tick() {
    if (this.mapping.size) {
      const startTime = window.performance.now();
      const fragment = document.createDocumentFragment();

      for (const [highlight, func] of this.renderQueue.entries()) {
        func(fragment);
        this.renderQueue.delete(highlight);

        // Check find time budget and abort
        // We'll get back to this point on the next animation frame
        if (window.performance.now() - startTime > this.renderTimeBudget) {
          break;
        }
      }

      this.container.appendChild(fragment);
    }
  }

  addAll(entries: NodeTextRange[]) {
    for (const entry of entries) {
      const element = entry.node.parentElement;

      let highlights = this.mapping.get(element);
      if (highlights == null) {
        highlights = [];
        this.mapping.set(element, highlights);
        this.intersectionObserver.observe(element);
      }

      highlights.push(new TextHighlight(entry.node, entry.start, entry.end));
    }
  }

  clear() {
    this.renderQueue.clear();
    this.intersectionObserver.disconnect();

    for (const highlights of this.mapping.values()) {
      for (const highlight of highlights) {
        highlight.removeHighlights();
      }
    }

    this.mapping.clear();
  }

  private intersectionChange(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
    for (const entry of entries) {
      const highlights = this.mapping.get(entry.target);
      if (highlights != null) {
        for (const highlight of highlights) {
          if (entry.intersectionRatio > 0) {
            this.renderQueue.set(highlight, fragment => fragment.append(...highlight.createHighlights(this.container)));
          } else {
            this.renderQueue.set(highlight, () => highlight.removeHighlights());
          }
        }
      }
    }
  }

  get results() {
    return Array.from(this.mapping.values());
  }

  get length(): number {
    return this.mapping.size;
  }

}

class TextHighlight implements NodeTextRange {
  protected elements: Element[] = [];

  constructor(public readonly node: Node,
              public readonly start: number,
              public readonly end: number) {
  }

  get rects() {
    const range = document.createRange();
    range.setStart(this.node, this.start);
    range.setEnd(this.node, this.end);
    return range.getClientRects();
  }

  createHighlights(container: Element): Element[] {
    const elements: Element[] = [];

    for (const rect of Array.from(this.rects)) {
      const relativeRect = getBoundingClientRectRelativeToContainer(rect, container);
      const el = document.createElement('div');
      el.className = 'highlight-block';
      el.style.position = 'absolute';
      el.style.top = relativeRect.y + 'px';
      el.style.left = relativeRect.x + 'px';
      el.style.width = relativeRect.width + 'px';
      el.style.height = relativeRect.height + 'px';
      elements.push(el);
      this.elements.push(el);
    }

    return elements;
  }

  removeHighlights() {
    for (const el of this.elements) {
      el.remove();
    }
    this.elements = [];
  }
}
