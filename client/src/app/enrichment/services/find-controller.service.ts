import { Injectable, NgZone, OnDestroy } from '@angular/core';

import { escapeRegExp } from 'lodash-es';
import {
  animationFrame,
  animationFrameScheduler,
  asyncScheduler,
  BehaviorSubject,
  combineLatest,
  interval,
  ReplaySubject,
  Subject,
} from 'rxjs';
import {
  map,
  observeOn,
  pairwise,
  share,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

import { NodeTextRange } from 'app/shared/utils/dom';
import { AsyncElementFindController } from 'app/shared/utils/find/async-element-find';
import { idle } from 'app/shared/rxjs/idle-observable';
import { runInAngularZone } from 'app/shared/rxjs/run-in-angular-zone';
import { AsyncTextHighlighter } from 'app/shared/utils/dom/async-text-highlighter';

/**
 * Find controller service for finding items within an DOM element.
 * It:
 * + finds items
 * + highlights them
 * + manages focused one
 * + provides visual feedback for focused item
 *
 * Since it directly interacts with DOM, this class bridges Angular and DOM utils.
 */
@Injectable()
export class FindControllerService implements OnDestroy {
  constructor(private readonly ngZone: NgZone) {}

  // region Service inputs
  public readonly type$ = new ReplaySubject<'text' | 'annotation'>(1);
  public readonly query$ = new ReplaySubject<string | null>(1);
  public readonly target$ = new ReplaySubject<Element>(1);
  // endregion
  private readonly findGenerator$ = this.type$.pipe(
    map((type) =>
      type === 'annotation' ? this.generateAnnotationFindQueue : this.generateTextFindQueue
    )
  );
  private readonly elementFind = new AsyncElementFindController(
    this.query$,
    this.target$,
    this.findGenerator$
  );
  private readonly highlighter = new AsyncTextHighlighter(this.target$, this.elementFind.search$);
  private readonly highlighterSubscription = this.highlighter.render$.subscribe();
  // region Service outputs
  /**
   * Underlying search control - provide access to search results without entering Angular zone.
   */
  public readonly search$ = this.elementFind.search$;
  /**
   * Index of currently focused item.
   */
  public readonly index$ = this.elementFind.search$.pipe(
    switchMap((search) => search.index$),
    runInAngularZone(this.ngZone)
  );
  /**
   * Currently focused item.
   */
  public readonly current$ = this.elementFind.search$.pipe(
    switchMap((search) => search.current$),
    runInAngularZone(this.ngZone)
  );
  /**
   * Number of found items.
   */
  public readonly count$ = this.elementFind.search$.pipe(
    switchMap((search) => search.count$),
    runInAngularZone(this.ngZone)
  );
  // endregion

  // region Service methods
  public next() {
    this.elementFind.next();
  }

  public previous() {
    this.elementFind.previous();
  }
  // endregion

  ngOnDestroy() {
    this.highlighterSubscription.unsubscribe();
  }

  // region Find generator functions
  private *generateAnnotationFindQueue(root: Node, query: string | null) {
    if (!query) {
      return;
    }
    const annotations = Array.from(
      (root as Element).querySelectorAll('[data-annotation-meta]')
    ) as HTMLElement[];
    for (const annoEl of annotations) {
      const data = JSON.parse(annoEl.getAttribute('data-annotation-meta'));

      if (data.id === query) {
        yield {
          // The elements with `data-annotation-meta` should have exactly one child: the TextNode representing the annotated text
          startNode: annoEl.firstChild,
          endNode: annoEl.firstChild,
          start: 0,
          end: annoEl.textContent.length, // IMPORTANT: `end` is EXCLUSIVE!
        };
      }
    }
  }

  private *generateTextFindQueue(
    root: Node,
    query: string | null
  ): IterableIterator<NodeTextRange | undefined> {
    if (!query) {
      return;
    }
    const queue: Node[] = [root];
    const regex = new RegExp(escapeRegExp(query), 'ig');

    while (queue.length !== 0) {
      const node = queue.shift();
      if (node === undefined) {
        break;
      }

      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          const el = node as HTMLElement;
          const style = window.getComputedStyle(el);
          // Should be true when we find the top-level container for the table cell
          if (style.display === 'block') {
            let match = regex.exec(node.textContent);

            // If there's no match in the root, then there's no reason to continue
            if (match === null) {
              break;
            }

            // Since there was a match, get all the descendant text nodes
            const treeWalker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const textNodes: Node[] = [];
            let currentNode = treeWalker.nextNode(); // Using `nextNode` here skips the root node, which is intended
            while (currentNode) {
              textNodes.push(currentNode);
              currentNode = treeWalker.nextNode();
            }

            // Create a map of the root text content indices to the descendant text node corresponding to that index
            let index = 0;
            const textNodeMap = new Map<number, [Node, number]>();
            for (const textNode of textNodes) {
              for (let i = 0; i < textNode.textContent.length; i++) {
                textNodeMap.set(index++, [textNode, i]);
              }
            }

            while (match !== null) {
              // Need to catch the case where regex.lastIndex returns a value greater than the last index of the text
              const lastIndexIsEOS = regex.lastIndex === node.textContent.length;
              const endOfMatch = lastIndexIsEOS ? regex.lastIndex - 1 : regex.lastIndex;

              yield {
                startNode: textNodeMap.get(match.index)[0],
                endNode: textNodeMap.get(endOfMatch)[0],
                start: textNodeMap.get(match.index)[1],
                end: textNodeMap.get(endOfMatch)[1] + (lastIndexIsEOS ? 1 : 0), // IMPORTANT: `end` is EXCLUSIVE!
              };
              match = regex.exec(node.textContent);
            }
            break;
          }
          queue.push(...Array.from(node.childNodes));
          break;
      }
    }
  }
  // endregion
}
