import { combineLatest, merge, Observable } from 'rxjs';
import {
  map,
  mergeMap,
  mergeScan,
  pairwise,
  scan,
  shareReplay,
  startWith,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import { transform } from 'lodash-es';
import { flatMap as _flatMap, forEach as _forEach, partial as _partial } from 'lodash/fp';

import {
  getBoundingClientRectRelativeToContainer,
  NodeTextRange,
  nonStaticPositionPredicate,
  walkParentElements,
} from '../dom';
import { createResizeObservable } from '../../rxjs/resize-observable';
import { ExtendedMap } from '../types';
import { intersection } from '../../rxjs/intersection-observable';
import { debug } from '../../rxjs/debug';
import { animationFrameBatchIterate } from '../../rxjs/animation-frame';
import { Renderer } from './renderer';
import { SearchControl } from '../find/types';

/**
 * Highlights text in a document asynchronously.
 */
export class AsyncTextHighlighter implements Renderer {
  constructor(
    private readonly target$: Observable<Element>,
    private readonly search$: Observable<
      Pick<SearchControl<NodeTextRange, any>, 'results$' | 'current$'>
    >
  ) {}

  private readonly mapping$: Observable<HighlightCollection> = this.search$.pipe(
    mergeScan((prev: HighlightCollection, { results$ }) => {
      prev?.disconnect();
      return results$.pipe(
        // if we just started take all existing, otherwise take only the new ones
        map(({ all, currentBatch }, index) => (index ? currentBatch : all)),
        scan(
          (currentMapping, entities) =>
            transform(
              entities,
              (mapping, entry, index) =>
                mapping
                  .getSet(entry.startNode.parentElement /*element*/, []) /*highlights*/
                  .push(
                    new TextHighlight(
                      entry.startNode,
                      entry.endNode,
                      entry.start,
                      entry.end,
                      !index /*firstResult*/
                    )
                  ),
              currentMapping
            ),
          new HighlightCollection()
        )
      );
    }, null),
    shareReplay(1)
  );

  private readonly highlight$ = this.target$.pipe(
    map((target) => this.findHighlightContainerElement(target)),
    switchMap((container: HTMLElement) => {
      // We create new render queue every time container changes so unrelated tasks are dropped.
      const renderQueue = new RenderQueue();
      return merge(
        /*redraw*/ createResizeObservable(container as HTMLElement).pipe(
          withLatestFrom(
            this.mapping$,
            this.search$.pipe(
              switchMap(({ results$ }) => results$),
              map(({ all }) => all)
            )
          ),
          map(([_, mapping, entries]) =>
            _flatMap(
              (entry) =>
                (mapping.get(entry.startNode.parentElement /*element*/) ?? []) /*highlights*/
                  .map((highlight) => renderQueue.set(highlight, RenderAction.Redraw)),
              entries
            )
          )
        ),
        /*intersection change*/ this.mapping$.pipe(
          mergeMap((mapping) =>
            mapping.intersection$.pipe(
              tap(
                // just run side effect of adding calls to renderQueue
                _forEach((entry: IntersectionObserverEntry) =>
                  (mapping.get(entry.target /*element*/) ?? []) /*highlights*/
                    .forEach((highlight) =>
                      entry.intersectionRatio > 0.5
                        ? renderQueue.set(highlight, RenderAction.Create)
                        : renderQueue.set(highlight, RenderAction.Remove)
                    )
                )
              )
            )
          )
        )
      ).pipe(
        // At this point we are not interested in what arguments we are passed
        // we are just notified that we need to render something from renderQueue.
        mergeMap(
          (
            renderTasks: [TextHighlight, (fragment: DocumentFragment, container: Element) => void][]
          ) =>
            // Iterate with animation frames since we updating DOM.
            animationFrameBatchIterate(function* () {
              const fragment = document.createDocumentFragment();
              for (const func of renderQueue.dequeue()) {
                yield func(fragment, container);
              }
              container.append(fragment);
            })
        ),
        debug('render')
      );
    })
  );

  private readonly focus$ = combineLatest([
    this.mapping$,
    this.search$.pipe(switchMap(({ current$ }) => current$.pipe(startWith(undefined), pairwise()))),
  ]).pipe(
    tap(([mapping, [previous, current]]) => {
      if (previous) {
        for (const highlight of this.walkNodeHighlights(previous, mapping)) {
          highlight.unfocusHighlights();
        }
      }
      if (current) {
        for (const highlight of this.walkNodeHighlights(current, mapping)) {
          highlight.focusHighlights();
        }
      }
    })
  );

  public readonly render$ = merge(this.highlight$, this.focus$).pipe(map(() => undefined));

  private *walkNodeHighlights(node: NodeTextRange, mapping: Map<Element, TextHighlight[]>) {
    const element = node.startNode.parentElement;
    const highlights = mapping.get(element) ?? [];

    for (const highlight of highlights) {
      if (highlight.start === node.start && highlight.end === node.end) {
        yield highlight;
      }
    }
  }

  private findHighlightContainerElement(start: Element): HTMLElement {
    // noinspection LoopStatementThatDoesntLoopJS
    for (const element of walkParentElements(start, nonStaticPositionPredicate)) {
      return element as HTMLElement;
    }
    return document.body;
  }
}

class HighlightCollection extends ExtendedMap<Element, TextHighlight[]> {
  public readonly intersection$ = intersection();

  set(element: Element, highlight: TextHighlight[]) {
    this.intersection$.observe(element);
    return super.set(element, highlight);
  }

  private removeHighlights(highlights: TextHighlight[]) {
    highlights.forEach((highlight) => highlight.removeHighlights());
  }

  delete(key: Element): boolean {
    this.intersection$.unobserve(key);
    this.removeHighlights(this.get(key));
    return super.delete(key);
  }

  clear(): void {
    this.forEach((highlights, key) => this.delete(key));
    super.clear();
  }

  disconnect() {
    this.intersection$.disconnect();
    this.forEach(this.removeHighlights);
  }
}

enum RenderAction {
  Create,
  Redraw,
  Remove,
}

/**
 * Ussing map to:
 * 1. Dedupe render calls for the same highlight.
 *
 *    *Details:*
 *    One of 3 render calls which might be executed on next frame:
 *    + createHighlights - under assumption that DOM representation of the highlight is not yet created,
 *                         we create it and append to the DOM.
 *    + redrawHighlights - remove DOM elements which no longer match the model;
 *                         update position of existing DOM elements;
 *                         create DOM elements to match the model.
 *    + removeHighlights - remove DOM elements for the highlight.
 *    Now considering overwrite of render call for same highlight:
 *    + createHighlights -> redrawHighlights - can use redrawHighlights since it will also
 *                                             "create DOM elements to match the model".
 *    + createHighlights -> removeHighlights - can use removeHighlights, it will simply do nothing
 *                                             since DOM elements are not yet created.
 *    + redrawHighlights -> removeHighlights - can use removeHighlights as we simply want them gone.
 *    + redrawHighlights -> createHighlights - WARNING: this will create DOM elements for the same highlight twice.*
 *    + removeHighlights -> createHighlights - can use createHighlights as we simply want them created.
 *    + removeHighlights -> redrawHighlights - can use redrawHighlights as we simply want them redrawn.
 * 2. Being able to extend it while iterating over it.
 * @protected
 */
class RenderQueue extends Map<TextHighlight, RenderAction> {
  private readonly renderActionMapping = new Map<
    RenderAction,
    (highlight: TextHighlight, fragment: DocumentFragment, container: HTMLElement) => void
  >([
    // TODO renderCalls should not consume container, all of them are simply ussing it to calculate
    //      relative position of the highlight by calling getBoundingClientRect(container).
    //      If we pass containerRect to renderCalls we can call getBoundingClientRect(container) just once.
    [
      RenderAction.Create,
      (highlight, fragment, container) => fragment.append(...highlight.createHighlights(container)),
    ],
    [
      RenderAction.Redraw,
      (highlight, fragment, container) => fragment.append(...highlight.redrawHighlights(container)),
    ],
    [RenderAction.Remove, (highlight) => highlight.removeHighlights()],
  ]);

  set(key: TextHighlight, value: RenderAction) {
    if (value === RenderAction.Create && this.get(key) === RenderAction.Redraw) {
      /**
       * Adressing the case:
       * > WARNING: this will create DOM elements for the same highlight twice.
       * > See details in the comment above.
       */
      return;
    }
    return super.set(key, value);
  }

  *dequeue() {
    for (const [highlight, renderAction] of this) {
      const renderCall = this.renderActionMapping.get(renderAction);
      this.delete(highlight);
      yield _partial(renderCall, [highlight]);
    }
  }
}

class TextHighlight implements NodeTextRange {
  protected elements: Element[] = [];
  private focusOnNextRender = false;

  constructor(
    public readonly startNode: Node,
    public readonly endNode: Node,
    public readonly start: number,
    public readonly end: number,
    public readonly initialFocus: boolean
  ) {
    this.focusOnNextRender = initialFocus;
  }

  get rects() {
    const range = document.createRange();
    range.setStart(this.startNode, this.start);
    range.setEnd(this.endNode, this.end); // IMPORTANT: the `end` param of `setEnd` is EXCLUSIVE!

    // Join the rects where it makes sense, otherwise we'll see a rect for each text node
    const tolerance = 0.5;
    const joinedRects = [];
    let joinRect: { x: number; y: number; width: number; height: number } = null;
    Array.from(range.getClientRects())
      .filter(
        // For some reason, we somestimes see rects generated for " " characters. This filter should remove these spurrious rects.
        // TODO: Because we are merging each rect, we may not need this filter. The downside to removing it is that we might have rects that
        // have a space at the end.
        (rect) => rect.width >= 3.6
      )
      .forEach((rect: DOMRect) => {
        if (joinRect === null) {
          joinRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        } else if (Math.abs(joinRect.y - rect.y) > tolerance) {
          // Looks like the current rect starts on a new line, so start a new join
          joinedRects.push(new DOMRect(joinRect.x, joinRect.y, joinRect.width, joinRect.height));
          joinRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        } else {
          // We sometimes see duplicate rects (not sure why, I think it's related to whitespace), so rather than adding the width of every
          // new rect, add the difference between the end of the new rect and the end of our joinRect.
          joinRect.width += rect.x + rect.width - (joinRect.x + joinRect.width);
          if (rect.height > joinRect.height) {
            joinRect.height = rect.height;
          }
        }
      });
    joinedRects.push(new DOMRect(joinRect.x, joinRect.y, joinRect.width, joinRect.height));
    return joinedRects;
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

  redrawHighlights(container: Element) {
    const rects = this.rects;

    // Remove any elements which are no longer needed due to merging rects. A merge might happen if two rects were on two lines, but due
    // to resizing are now on one line.
    while (this.elements.length > rects.length) {
      this.elements.pop().remove();
    }

    // Then, update any existing elements
    for (const [i, el] of this.elements.entries()) {
      const htmlEl = el as HTMLElement;
      const relativeRect = getBoundingClientRectRelativeToContainer(rects[i], container);
      htmlEl.style.top = relativeRect.y + 'px';
      htmlEl.style.left = relativeRect.x + 'px';
      htmlEl.style.width = relativeRect.width + 'px';
      htmlEl.style.height = relativeRect.height + 'px';
    }

    // Finally, we may need to add new elements if resizing caused a line break, and one rect was broken into several.
    const newElements: Element[] = [];
    while (this.elements.length < rects.length) {
      const relativeRect = getBoundingClientRectRelativeToContainer(
        rects[this.elements.length],
        container
      );
      const el = document.createElement('div');
      el.className = this.focusOnNextRender ? 'highlight-block-focus' : 'highlight-block';
      el.style.position = 'absolute';
      el.style.top = relativeRect.y + 'px';
      el.style.left = relativeRect.x + 'px';
      el.style.width = relativeRect.width + 'px';
      el.style.height = relativeRect.height + 'px';
      newElements.push(el);
      this.elements.push(el);
    }

    return newElements;
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
