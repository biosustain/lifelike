import { Injectable, NgZone, OnDestroy } from '@angular/core';

import { escapeRegExp, isNil } from 'lodash-es';
import { asyncScheduler, ReplaySubject, Subject } from 'rxjs';
import {
  map,
  observeOn,
  pairwise,
  scan,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
  withLatestFrom,
} from 'rxjs/operators';

import { NodeTextRange } from 'app/shared/utils/dom';
import { AsyncElementFind } from 'app/shared/utils/find/async-element-find';

@Injectable()
export class FindControllerService implements OnDestroy {
  constructor(private ngZone: NgZone) {
    this.query$
      .pipe(
        withLatestFrom(this.elementFind$), // changing elementFind$ should not rerun query
        observeOn(asyncScheduler),
        takeUntil(this.destroy$)
      )
      .subscribe(([query, elementFind]) => {
        elementFind.query = query;
        elementFind.start();
      });
    this.elementFind$
      .pipe(
        takeUntil(this.destroy$),
        scan(
          (runRef: { handle: number }, elementFind) => {
            // animationFrameScheduler runs in Angular context
            this.ngZone.runOutsideAngular(() => {
              if (isNil(runRef.handle)) {
                cancelAnimationFrame(runRef.handle);
              }
              const step = () => {
                elementFind.tick();
                runRef.handle = requestAnimationFrame(step);
              };
              runRef.handle = requestAnimationFrame(step);
            });
            return { handle: runRef.handle };
          },
          { handle: null },
        )
      )
      .subscribe();
    this.target$
      .pipe(
        // lazy init
        takeUntil(this.destroy$),
        withLatestFrom(this.elementFind$)
      )
      .subscribe(([target, elementFind]) => {
        elementFind.target = target;
        elementFind.start();
      });
  }

  destroy$ = new Subject<any>();
  type$ = new ReplaySubject<'text' | 'annotation'>(1);
  query$ = new ReplaySubject<string>(1);
  target$ = new ReplaySubject<Element | null>(null);
  elementFind$ = this.type$.pipe(
    withLatestFrom(this.target$.pipe(startWith(null))), // lazy init
    map(
      ([type, target]) =>
        new AsyncElementFind(
          target,
          type === 'annotation' ? this.generateAnnotationFindQueue : this.generateTextFindQueue
        )
    ),
    startWith(null),
    pairwise(),
    map(([prev, next]) => {
      prev?.stop();
      return next;
    }),
    shareReplay({ refCount: true, bufferSize: 1 })
  );
  focusElement$ = this.elementFind$.pipe(switchMap((elementMap) => elementMap.current$));

  ngOnDestroy() {
    this.destroy$.next();
  }

  private* generateAnnotationFindQueue(***ARANGO_USERNAME***: Node, query: string) {
    const annotations = Array.from(
      (***ARANGO_USERNAME*** as Element).querySelectorAll('[data-annotation-meta]')
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

  private* generateTextFindQueue(
    ***ARANGO_USERNAME***: Node,
    query: string
  ): IterableIterator<NodeTextRange | undefined> {
    const queue: Node[] = [***ARANGO_USERNAME***];

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
            const regex = new RegExp(escapeRegExp(query), 'ig');
            let match = regex.exec(node.textContent);

            // If there's no match in the ***ARANGO_USERNAME***, then there's no reason to continue
            if (match === null) {
              break;
            }

            // Since there was a match, get all the descendant text nodes
            const treeWalker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const textNodes: Node[] = [];
            let currentNode = treeWalker.nextNode(); // Using `nextNode` here skips the ***ARANGO_USERNAME*** node, which is intended
            while (currentNode) {
              textNodes.push(currentNode);
              currentNode = treeWalker.nextNode();
            }

            // Create a map of the ***ARANGO_USERNAME*** text content indices to the descendant text node corresponding to that index
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
}
