import { CollectionModalOptions, CollectionModel } from './utils/collection-model';
import { ResultQuery } from './schemas/common';

export class ModelList<T> {
  constructor(items: T[] = [], options: CollectionModalOptions<T> = { multipleSelection: true }, query?) {
    this.results = new CollectionModel<T>(items, options);
    this.collectionSize = items.length;
    this.query = query;
  }

  public collectionSize: number;
  public readonly results: CollectionModel<T>;
  public query?: ResultQuery;
}
