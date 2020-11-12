import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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

    deleteAnnotations(pids: number[]): Observable<string> {
        return this.http.post<{result: string}>(
            `${this.baseUrl}/global-list`,
            {pids},
            {...this.getHttpOptions(true)}
        ).pipe(map(res => res.result));
    }

    exportGlobalExclusions(): Observable<HttpEvent<Blob>> {
        return this.http.get(
            `${this.baseUrl}/global-list/exclusions`, {
            ...this.getHttpOptions(true),
            responseType: 'blob',
            observe: 'events',
            reportProgress: true,
        });
    }

    exportGlobalInclusions(): Observable<HttpEvent<Blob>> {
        return this.http.get(
            `${this.baseUrl}/global-list/inclusions`, {
            ...this.getHttpOptions(true),
            responseType: 'blob',
            observe: 'events',
            reportProgress: true,
            }
        );
    }
}
