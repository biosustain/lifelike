import { PaginatedRequestOptions, ResultList } from '../../schemas/common';
import { ResultListComponent } from './result-list.component';
import { promiseOfOne } from '../../rxjs/to-promise';

export abstract class PaginatedResultListComponent<
  O extends PaginatedRequestOptions,
  R,
  RL extends ResultList<R> = ResultList<R>
> extends ResultListComponent<O, R, RL> {
  goToPage(page: number) {
    return promiseOfOne(this.params$).then((params) =>
      this.workspaceManager.navigate(
        this.route.snapshot.url.map((item) => item.path),
        {
          queryParams: this.serializeParams(
            {
              ...params,
              page,
            },
            false
          ),
        }
      )
    );
  }
}
