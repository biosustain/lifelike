import { PaginatedRequestOptions, ResultList } from 'app/shared/schemas/common';
import { promiseOfOne } from 'app/shared/rxjs/to-promise';

import { ResultListComponent } from './result-list.component';

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
