import { GraphEntity, UniversalGraphEntity } from '../../drawing-tool/services/interfaces';
import { Subject } from 'rxjs';

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

  constructor(private readonly graphView: any) {
  }

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
        this.graphView.invalidateEntity(item);
      }
    }

    // Invalidate items that got removed
    for (const item of invalidationMap.values()) {
      this.graphView.invalidateEntity(item);
    }

    // Emit event if it changed
    if (!this.arraysEqual(this.items.map(item => item.entity), items.map(item => item.entity))) {
      this.changeObservable.next([[...items], this.items]);
    }

    this.items = items;
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
    const aSet = new Set(a);
    for (const item of b) {
      if (!aSet.has(item)) {
        return false;
      }
    }
    return true;
  }
}
