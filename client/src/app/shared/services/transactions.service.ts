import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';


@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class TransactionService {
  readonly baseUrl = '/api/transactions';

  constructor(private readonly http: HttpClient) {}

  getTransactionTask<T>(transactionId: string): Observable<GetTransactionTaskResponse<T>> {
    return this.http.get<GetTransactionTaskResponse<T>>(
      `${this.baseUrl}/${transactionId}`
    );
  }
}

interface GetTransactionTaskResponse<T> {
  id: number;
  taxId: string;
  detail: T;
}
