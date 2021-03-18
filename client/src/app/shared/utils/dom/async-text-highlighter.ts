import { getBoundingClientRectRelativeToContainer, NodeTextRange } from '../dom';

/**
 * Highlights text in a document asynchronously.
 */
export class AsyncTextHighlighter {

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
    let firstResult = true;
    for (const entry of entries) {
      const element = entry.node.parentElement;

      let highlights = this.mapping.get(element);
      if (highlights == null) {
        highlights = [];
        this.mapping.set(element, highlights);
        this.intersectionObserver.observe(element);
      }

      highlights.push(new TextHighlight(entry.node, firstResult, entry.start, entry.end));

      if (firstResult) {
        firstResult = false;
      }
    }
  }

  focus(entry: NodeTextRange) {
    const element = entry.node.parentElement;
    const highlights = this.mapping.get(element);

    for (const highlight of highlights) {
      if (highlight.start === entry.start && highlight.end === entry.end) {
        this.renderQueue.set(highlight, () => highlight.focusHighlights());
      }
    }
  }

  unfocus(entry: NodeTextRange) {
    const element = entry.node.parentElement;
    const highlights = this.mapping.get(element);

    for (const highlight of highlights) {
      if (highlight.start === entry.start && highlight.end === entry.end) {
        this.renderQueue.set(highlight, () => highlight.unfocusHighlights());
      }
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
  private focusOnNextRender = false;

  constructor(public readonly node: Node,
              public readonly initialFocus: boolean,
              public readonly start: number,
              public readonly end: number) {
    this.focusOnNextRender = initialFocus;
  }

  get rects() {
    const range = document.createRange();
    range.setStart(this.node, this.start);
    range.setEnd(this.node, this.end);
    // When the range contains a line break, we often see an additional DOMRect representing a space just before the break. We attempt to
    // filter these spurrious rects so we don't draw them.
    // TODO: Is this browser-safe? Would be worthwhile to make sure this doesn't break in different environments.
    return Array.from(range.getClientRects()).filter((rect) => rect.width >= 3.6);
  }

  createHighlights(container: Element): Element[] {
    const elements: Element[] = [];

    for (const rect of this.rects) {
      const relativeRect = getBoundingClientRectRelativeToContainer(rect, container);
      const el = document.createElement('div');
      el.className = this.focusOnNextRender ? 'highlight-block-focus' : 'highlight-block';
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

  /**
   * Immediately changes this highlight to use the focused styling. Also sets this highlight to be focused on future renders.
   */
  focusHighlights() {
    this.focusOnNextRender = true;
    for (const el of this.elements) {
      el.className = 'highlight-block-focus';
    }
  }

  /**
   * Immediately changes this highlight to use the unfocused styling. Also sets this highlight to be unfocused on future renders.
   */
  unfocusHighlights() {
    this.focusOnNextRender = false;
    for (const el of this.elements) {
      el.className = 'highlight-block';
    }
  }

  removeHighlights() {
    for (const el of this.elements) {
      el.remove();
    }
    this.elements = [];
  }
}
