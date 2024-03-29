import { defer, Subject } from 'rxjs';
import { map, shareReplay, startWith } from 'rxjs/operators';

import { GraphEntity, UniversalGraphEntity } from 'app/drawing-tool/services/interfaces';

import { GraphView } from '../renderers/graph-view';
import { CanvasGraphView } from '../renderers/canvas/canvas-graph-view';
import { Behavior } from '../renderers/behaviors';

/**
 * Manages a list of entities that will be invalidated when the set of
 * items is updated.
 */
export class CacheGuardedEntityList {
  private items: GraphEntity[] = [];
  /**
   * Stream of changes.
   */
  readonly changeObservable: Subject<[GraphEntity[], GraphEntity[]]> = new Subject();
  public readonly items$ = defer(() =>
    this.changeObservable.pipe(
      map(([newItems]) => newItems),
      startWith(this.items),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  );

  constructor(private readonly graphView: GraphView<Behavior>) {}

  replace(items: GraphEntity[]) {
    if (items == null) {
      throw new Error('API use incorrect: pass empty array for no selection');
    }

    const invalidationMap: Map<UniversalGraphEntity, GraphEntity> = new Map();
    for (const item of this.items) {
      invalidationMap.set(item.entity, item);
    }
    for (const item of items) {
      const existed = invalidationMap.delete(item.entity);
      if (!existed) {
        // Item is new, so invalidate!
        (this.graphView as CanvasGraphView).invalidateEntity(item);
      }
    }

    // Invalidate items that got removed
    for (const item of invalidationMap.values()) {
      (this.graphView as CanvasGraphView).invalidateEntity(item);
    }

    // Emit event if it changed
    if (
      !this.arraysEqual(
        this.items.map((item) => item.entity),
        items.map((item) => item.entity)
      )
    ) {
      this.changeObservable.next([[...items], this.items]);
    }

    this.items = items;
  }

  add(items: GraphEntity[]) {
    const found = new Set<UniversalGraphEntity>();
    const newItems: GraphEntity[] = [];
    for (const item of this.items) {
      found.add(item.entity);
    }
    for (const item of items) {
      if (!found.has(item.entity)) {
        newItems.push(item);
      }
    }
    return this.replace([...this.items, ...newItems]);
  }

  get(): GraphEntity[] {
    return this.items;
  }

  getEntitySet(): Set<UniversalGraphEntity> {
    const set: Set<UniversalGraphEntity> = new Set();
    for (const item of this.items) {
      set.add(item.entity);
    }
    return set;
  }

  arraysEqual<T>(a: T[], b: T[]) {
    if (a.length !== b.length) {
      return false;
    }
    if (b.length > a.length) {
      const aSet = new Set(a);
      for (const item of b) {
        if (!aSet.has(item)) {
          return false;
        }
      }
    } else {
      const bSet = new Set(b);
      for (const item of a) {
        if (!bSet.has(item)) {
          return false;
        }
      }
    }
    return true;
  }
}
