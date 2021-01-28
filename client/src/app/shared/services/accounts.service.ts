import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { ResultList } from '../schemas/common';
import { map } from 'rxjs/operators';
import { ModalList } from '../models';
import { AppUser } from '../../interfaces';
import { AccountSearchRequest } from '../schema/accounts';

@Injectable()
export class AccountsService {
  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  search(options: AccountSearchRequest): Observable<ModalList<AppUser>> {
    return this.http.post<ResultList<AppUser>>(
      `/api/accounts/search`,
      options,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const list = new ModalList<AppUser>();
        list.results.replace(data.results);
        return list;
      }),
    );
  }

}
