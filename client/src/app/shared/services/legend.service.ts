import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { AbstractService } from './abstract-service';

import {
    NodeLegend,
} from 'app/interfaces';

@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class LegendService extends AbstractService {
    readonly visApi = '/api/visualizer';

    constructor(auth: AuthenticationService, http: HttpClient) {
        super(auth, http);
    }

    getAnnotationLegend() {
        return this.http.get<{result: NodeLegend}>(
            `${this.visApi}/get-annotation-legend`,
            {...this.getHttpOptions(true)}
        ).pipe(map(resp => resp.result));
    }
}
