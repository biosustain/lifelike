import { ResultListComponent } from './result-list.component';
import { PaginatedRequestOptions, ResultList } from '../../../interfaces/shared.interface';

export abstract class PaginatedResultListComponent<O extends PaginatedRequestOptions, R,
    RL extends ResultList<R> = ResultList<R>> extends ResultListComponent<O, R, RL> {

  goToPage(page: number): void {
    this.workspaceManager.navigate([], {
      queryParams: this.serializeParams({
        ...this.params,
        page,
      }, false),
    });
  }
}
