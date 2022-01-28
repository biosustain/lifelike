import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { ErrorLog } from '../schemas/common';

@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class LoggingService {

    readonly baseUrl = '/api/logging';

    constructor(private readonly http: HttpClient) {}

    sendLogs(error: ErrorLog) {
        return this.http.post(
            `${this.baseUrl}/`,
            error,
        );
    }
}
