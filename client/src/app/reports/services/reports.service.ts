import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { CopyrightInfringementRequest } from 'app/interfaces/reports.interface';

@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class ReportsService {
  readonly reportsApi = '/api/reports';

  constructor(
    private http: HttpClient
  ) { }

  copyrightInfringementRequest(request: CopyrightInfringementRequest) {
    return this.http.post(`${this.reportsApi}/copyright-infringement-report`, request);
  }
}
