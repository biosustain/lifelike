import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AppUser } from 'app/interfaces';
import { AccountSearchRequest } from 'app/shared/schemas/accounts';
import { ModelList } from 'app/shared/utils/models';
import { ResultList } from 'app/shared/schemas/common';

@Injectable()
export class AccountsService {
  constructor(protected readonly http: HttpClient) {}

  search(options: AccountSearchRequest): Observable<ModelList<AppUser>> {
    return this.http.post<ResultList<AppUser>>(`/api/accounts/search`, options).pipe(
      map((data) => {
        const list = new ModelList<AppUser>();
        list.results.replace(data.results);
        return list;
      })
    );
  }
}