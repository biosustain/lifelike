import {
  getBoundingClientRectRelativeToContainer, isElementVisible,
  nonStaticPositionPredicate, scrollRectIntoView,
  walkParentElements,
} from '../dom';
import { escapeRegExp } from 'lodash';

/**
 * A find controller for finding items within an element.
 */
export class ElementFind implements FindController {

  target: Element;
  scrollToOffset = 100;
  query = '';
  protected activeQuery: string | undefined = null;
  protected index = -1;
  protected results: FindResult[] = [];

  constructor(target: Element = null) {
    this.target = target;
  }

  isStarted(): boolean {
    return this.activeQuery != null;
  }

  start() {
    if (this.target == null) {
      return;
    }

    this.activeQuery = this.query;
    this.removeHighlights(this.results);

    if (this.query.length) {
      this.results = this.findMatches(this.target);
    } else {
      this.results = [];
    }

    this.createHighlights(this.results);
    this.index = 0;
    this.visitResult();
  }

  stop() {
    this.activeQuery = null;
    this.removeHighlights(this.results);
    this.results = [];
  }

  nextOrStart() {
    if (this.query.length && this.activeQuery === this.query) {
      this.next();
    } else {
      this.start();
    }
  }

  previous(): boolean {
    if (this.target == null) {
      return false;
    }

    if (!this.results.length) {
      return false;
    }

    this.leaveResult();
    this.index--;
    if (this.index < 0) {
      this.index = this.results.length - 1;
    }
    this.visitResult();
    return true;
  }

  next(): boolean {
    if (this.target == null) {
      return false;
    }

    if (!this.results.length) {
      return false;
    }

    this.leaveResult();
    this.index++;
    if (this.index >= this.results.length) {
      this.index = 0;
    }
    this.visitResult();
    return true;
  }

  redraw() {
    this.removeHighlights(this.results);
    this.createHighlights(this.results);
  }

  private findHighlightContainerElement(start: Element): Element {
    // noinspection LoopStatementThatDoesntLoopJS
    for (const element of walkParentElements(start, nonStaticPositionPredicate)) {
      return element;
    }
    return document.body;
  }

  private leaveResult() {
    const result = this.results[this.index];
    if (result != null) {
      for (const highlightElement of result.highlightElements) {
        highlightElement.classList.remove('highlight-block-focus');
      }
    }
  }

  private visitResult() {
    const result = this.results[this.index];
    if (result != null) {
      const rects = result.rects;
      if (rects.length) {
        const rect = rects[0];
        //scrollRectIntoView(result.node.parentElement, rect);
      }
      for (const highlightElement of result.highlightElements) {
        highlightElement.classList.add('highlight-block-focus');
      }
    }
  }

  private removeHighlights(results: FindResult[]) {
    for (const result of results) {
      for (const highlightElement of result.highlightElements) {
        highlightElement.remove();
      }
      result.highlightElements = [];
    }
  }

  private createHighlights(results: FindResult[]) {
    const container = this.findHighlightContainerElement(this.target);
    const fragment = document.createDocumentFragment();
    for (const result of results) {
      const rects = result.rects;
      for (const rect of Array.from(rects)) {
        if (isElementVisible(result.node.parentElement, rect)) {
          const relativeRect = getBoundingClientRectRelativeToContainer(rect, container);
          const highlightElement = document.createElement('div');
          highlightElement.className = 'highlight-block';
          highlightElement.style.position = 'absolute';
          highlightElement.style.top = relativeRect.y + 'px';
          highlightElement.style.left = relativeRect.x + 'px';
          highlightElement.style.width = relativeRect.width + 'px';
          highlightElement.style.height = relativeRect.height + 'px';
          fragment.appendChild(highlightElement);
          result.highlightElements.push(highlightElement);
        }
      }
    }
    container.appendChild(fragment);
  }

  private findMatches(node: Node, results: FindResult[] = []) {
    switch (node.nodeType) {
      case 1:
        for (let child = node.firstChild; child; child = child.nextSibling) {
          this.findMatches(child, results);
        }
        break;
      case 3:
        const regex = new RegExp(escapeRegExp(this.query), 'ig');
        while (true) {
          const match = regex.exec(node.nodeValue);
          if (match === null) {
            break;
          }
          results.push(new FindResult(
            node,
            match.index,
            regex.lastIndex,
          ));
        }
    }
    return results;
  }

  getResultIndex(): number {
    return this.index;
  }

  getResultCount(): number {
    return this.results.length;
  }

}

class FindResult {
  highlightElements: Element[] = [];

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
}
