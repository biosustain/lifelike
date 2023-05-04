import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class TransactionService {
  readonly baseUrl = '/api/transactions';

  constructor(private readonly http: HttpClient) {}

  getRemainingTasksCount(transactionId: string): Observable<TransactionTasksCountResponse> {
    return this.http.get<TransactionTasksCountResponse>(
      `${this.baseUrl}/list/${transactionId}`
    );
  }
}

interface TransactionTasksCountResponse {
  total: number;
}