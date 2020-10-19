import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { AbstractService } from './abstract-service';

@Injectable({providedIn: 'root'})
export class StorageService extends AbstractService {
    readonly baseUrl = '/api/storage';

    constructor(auth: AuthenticationService, http: HttpClient) {
        super(auth, http);
    }

    getUserManual(): Observable<Blob> {
        return this.http.get(
            `${this.baseUrl}/manual`, {
            ...this.getHttpOptions(true),
            responseType: 'blob',
        });
    }
}
