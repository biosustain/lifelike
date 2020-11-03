import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { AbstractService } from './abstract-service';
import { GlobalAnnotation } from 'app/interfaces/annotation';
import { PaginatedRequestOptions, ResultList } from 'app/interfaces/shared.interface';

@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class GlobalAnnotationService extends AbstractService {
    readonly baseUrl = '/api/annotations';

    constructor(auth: AuthenticationService, http: HttpClient) {
        super(auth, http);
    }

    getAnnotations(options: PaginatedRequestOptions = {}): Observable<ResultList<GlobalAnnotation>> {
        return this.http.get<ResultList<GlobalAnnotation>>(
            `${this.baseUrl}/global-list`, {
            ...this.getHttpOptions(true),
            params: options as any,
            }
        );
    }
}
