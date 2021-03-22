import { escapeRegExp } from 'lodash';

import {
  NodeTextRange,
  nonStaticPositionPredicate,
  scrollRectIntoView,
  walkParentElements,
} from '../dom';
import { AsyncTextHighlighter } from '../dom/async-text-highlighter';

import { AsyncFindController } from './find-controller';

/**
 * A find controller for finding items within an element.
 */
export class AsyncElementFind implements AsyncFindController {

  private pendingJump = false;

  target: Element;
  scrollToOffset = 100;
  query = '';
  protected readonly textFinder = new AsyncElementTextFinder(this.matchFind.bind(this));
  protected results: NodeTextRange[] = [];
  protected readonly highlighter = new AsyncTextHighlighter(document.body);
  protected activeQuery: string | undefined = null;
  protected index = -1;

  constructor(target: Element = null) {
    this.target = target;
  }

  isStarted(): boolean {
    return this.activeQuery != null;
  }

  tick() {
    this.textFinder.tick();
    this.highlighter.tick();
  }

  start() {
    if (this.target == null) {
      return;
    }

    // Make sure we put the highlights in the right container
    this.highlighter.container = this.findHighlightContainerElement(this.target);

    // Keep track of what the current find is for
    this.activeQuery = this.query;

    this.results = [];

    // Delete existing highlights
    this.highlighter.clear();

    // Start find process if needed
    if (this.query.length) {
      this.textFinder.find(this.target, this.query);
      this.pendingJump = true;
    } else {
      this.textFinder.stop();
    }

    this.index = 0;
  }

  stop() {
    this.activeQuery = null;
    this.results = [];
    this.textFinder.stop();
    this.highlighter.clear();
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
    // TODO: Redraw on DOM changes / scroll
  }

  /**
   * Callback for when the async finder finds new entries.
   */
  private matchFind(matches: NodeTextRange[]) {
    this.highlighter.addAll(matches);
    this.results.push(...matches);

    if (this.pendingJump) {
      this.pendingJump = false;
      this.visitResult();
    }
  }

  private findHighlightContainerElement(start: Element): Element {
    // noinspection LoopStatementThatDoesntLoopJS
    for (const element of walkParentElements(start, nonStaticPositionPredicate)) {
      return element;
    }
    return document.body;
  }

  /**
   * No longer highlight the current find index.
   */
  private leaveResult() {
    this.highlighter.unfocus(this.results[this.index]);
  }

  /**
   * Highlight the current findindex.
   */
  private visitResult() {
    scrollRectIntoView(this.results[this.index].node.parentElement, undefined);
    this.highlighter.focus(this.results[this.index]);
  }

  getResultIndex(): number {
    return this.index;
  }

  getResultCount(): number {
    return this.results.length;
  }

}

/**
 * Asynchronously finds text in a document.
 */
class AsyncElementTextFinder {

  // TODO: Handle DOM changes mid-find
  // TODO: Handle text matches between elements (like <span>find <strong>this</strong></span>

  private findQueue: IterableIterator<NodeTextRange> | undefined;
  findTimeBudget = 10;

  constructor(protected readonly callback: (matches: NodeTextRange[]) => void) {
  }

  find(***ARANGO_USERNAME***: Node, query: string) {
    this.findQueue = this.generateFindQueue(***ARANGO_USERNAME***, query);
  }

  stop() {
    this.findQueue = null;
  }

  tick() {
    if (this.findQueue) {
      const startTime = window.performance.now();
      const results: NodeTextRange[] = [];

      while (true) {
        const result: IteratorResult<NodeTextRange | undefined> = this.findQueue.next();

        if (result.value != null) {
          results.push(result.value);
        }

        if (result.done) {
          // Finished finding!
          this.findQueue = null;
          break;
        }

        // Check find time budget and abort
        // We'll get back to this point on the next animation frame
        if (window.performance.now() - startTime > this.findTimeBudget) {
          break;
        }
      }

      if (results.length) {
        this.callback(results);
      }
    }
  }

  private* generateFindQueue(***ARANGO_USERNAME***: Node, query: string): IterableIterator<NodeTextRange | undefined> {
    const queue: Node[] = [
      ***ARANGO_USERNAME***,
    ];

    while (true) {
      const node = queue.shift();
      if (node == null) {
        break;
      }

      switch (node.nodeType) {
        case 1:
          for (let child = node.firstChild; child; child = child.nextSibling) {
            queue.push(child);
          }
          break;

        case 3:
          const regex = new RegExp(escapeRegExp(query), 'ig');
          while (true) {
            const match = regex.exec(node.nodeValue);
            if (match === null) {
              break;
            }
            yield {
              node,
              start: match.index,
              end: regex.lastIndex,
            };
          }
      }
    }
  }
}
