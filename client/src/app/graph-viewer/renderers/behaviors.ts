/**
 * Keeps track of a set of behaviors and provides methods to call them.
 */
export class BehaviorList<T extends Behavior> {
  private behaviorsMap: Map<string, {
    priority: number,
    behavior: T
  }> = new Map();
  private behaviorsIndexedByMethod: Map<string, Set<T>> = new Map();

  /**
   * Create a new instance.
   * @param indexedMethods a list of method names that will be called with {@link call}
   */
  constructor(indexedMethods: string[]) {
    for (const name of indexedMethods) {
      this.behaviorsIndexedByMethod.set(name, new Set<T>());
    }
  }

  /**
   * Add a behavior.
   * @param key a unique key per behavior
   * @param behavior the behavior
   * @param priority higher numbers run first
   */
  add(key: string, behavior: T, priority: number) {
    if (this.behaviorsMap.has(key)) {
      throw new Error(`behavior by key '${key}' already added`);
    }

    const behaviors: [string, { priority: number, behavior: T }][] = [
      ...this.behaviorsMap.entries(),
      [key, {behavior, priority}],
    ];

    // Slow priority queue
    behaviors.sort((a, b) => {
      if (a[1].priority > b[1].priority) {
        return -1;
      } else if (a[1].priority < b[1].priority) {
        return 1;
      } else {
        return 0;
      }
    });
    this.behaviorsMap = new Map(behaviors);

    for (const [methodName, behaviorIndex] of this.behaviorsIndexedByMethod.entries()) {
      if (methodName in behavior) {
        behaviorIndex.add(behavior);
      }
    }

    behavior.setup();
  }

  /**
   * Delete a behavior
   * @param key the behavior key
   * @return true iof the behavior existed
   */
  delete(key: string): boolean {
    const behaviorEntry = this.behaviorsMap.get(key);
    if (behaviorEntry) {
      behaviorEntry.behavior.destroy();

      for (const behaviorIndex of this.behaviorsIndexedByMethod.values()) {
        behaviorIndex.delete(behaviorEntry.behavior);
      }
      this.behaviorsMap.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Run all destructors.
   */
  destroy() {
    for (const behavior of this.getBehaviors()) {
      behavior.destroy();
    }
    this.behaviorsMap.clear();
    for (const behaviors of this.behaviorsIndexedByMethod.values()) {
      behaviors.clear();
    }
  }

  /**
   * Apply the given callable to all behaviors.
   * @param callable the callable
   * @return the final result
   */
  apply(callable: (behavior: T) => BehaviorResult): BehaviorResult {
    for (const [key, {behavior, priority}] of this.behaviorsMap.entries()) {
      const result = callable(behavior);
      if (result === BehaviorResult.Stop) {
        return BehaviorResult.Stop;
      } else if (result === BehaviorResult.RemoveAndContinue) {
        this.behaviorsMap.delete(key);
      } else if (result === BehaviorResult.RemoveAndStop) {
        this.behaviorsMap.delete(key);
        return BehaviorResult.Stop;
      }
    }
    return BehaviorResult.Continue;
  }

  /**
   * Call the given method on behaviors that have the method defined. The
   * method name must have been listed in the constructor of this instance.
   * @param method the method name
   * @param args the arguments
   */
  call(method, ...args) {
    const behaviors = this.behaviorsIndexedByMethod.get(method);
    if (!behaviors) {
      throw new Error(`method ${method} is not indexed`);
    }
    for (const behavior of behaviors) {
      const ret = behavior[method](...args);
      if (ret !== undefined) {
        return ret;
      }
    }
    return undefined;
  }

  /**
   * Get a list of behaviors.
   */
  * getBehaviors(): IterableIterator<T> {
    for (const [key, {behavior, priority}] of this.behaviorsMap.entries()) {
      yield behavior;
    }
  }
}

/**
 * The result returned from a behavior call.
 */
export enum BehaviorResult {
  /**
   * Run other behaviors.
   */
  Continue = 'CONTINUE',
  /**
   * After this behavior returns, don't run any more for this event.
   */
  Stop = 'STOP',
  /**
   * Remove this behavior but keep executing behaviors for this event.
   */
  RemoveAndContinue = 'REMOVE_AND_CONTINUE',
  /**
   * Remove this behavior, and don't run any more for this event.
   */
  RemoveAndStop = 'REMOVE_AND_STOP',
}

/**
 * Check if the result means to 'stop processing.'
 * @param result the result to check
 */
export function isStopResult(result: BehaviorResult): boolean {
  return result === BehaviorResult.Stop || result === BehaviorResult.RemoveAndStop;
}

/**
 * A behavior adds way to interact with a graph.
 */
export interface Behavior {
  setup();

  destroy();
}

/**
 * A behavior that is for the canvas renderer.
 */
export interface CanvasBehavior extends Behavior {
  keyDown(event: KeyboardEvent): BehaviorResult;
  click(event: MouseEvent): BehaviorResult;
  doubleClick(event: MouseEvent): BehaviorResult;
  mouseMove(event: MouseEvent): BehaviorResult;
  dragStart(event: MouseEvent): BehaviorResult;
  drag(event: MouseEvent): BehaviorResult;
  dragEnd(event: MouseEvent): BehaviorResult;
  draw(ctx: CanvasRenderingContext2D, transform: any);
}

/**
 * An abstract behavior that has all methods already implemented.
 */
export abstract class AbstractCanvasBehavior implements CanvasBehavior {
  setup() {
  }

  destroy() {
  }

  keyDown(event: KeyboardEvent): BehaviorResult {
    return BehaviorResult.Continue;
  }

  click(event: MouseEvent): BehaviorResult {
    return BehaviorResult.Continue;
  }

  doubleClick(event: MouseEvent): BehaviorResult {
    return BehaviorResult.Continue;
  }

  mouseMove(event: MouseEvent): BehaviorResult {
    return BehaviorResult.Continue;
  }

  dragStart(event: MouseEvent): BehaviorResult {
    return BehaviorResult.Continue;
  }

  drag(event: MouseEvent): BehaviorResult {
    return BehaviorResult.Continue;
  }

  dragEnd(event: MouseEvent): BehaviorResult {
    return BehaviorResult.Continue;
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
  }
}
