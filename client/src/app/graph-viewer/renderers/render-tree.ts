export interface RenderTree<T> {
  delete(key: T): void;

  clear(): void;

  enqueueRenderFromKey(key: T): void;
}
