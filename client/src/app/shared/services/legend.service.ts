import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';

import { NodeLegend, } from 'app/interfaces';

import { retryWhenOnline } from '../rxjs/online-observable';


@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class LegendService {
    readonly visApi = '/api/visualizer';

    constructor(private http: HttpClient) { }

    getAnnotationLegend() {
        return this.http.get<{result: NodeLegend}>(
            `${this.visApi}/get-annotation-legend`,
        ).pipe(
          retryWhenOnline(),
          map(resp => resp.result)
        );
    }
}
