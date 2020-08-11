import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class KgImportService {
    readonly importApi = '/api/user-file-import';

    constructor(
        private http: HttpClient,
    ) { }

    importGeneRelationships(data: FormData): Observable<any> {
        return this.http.post<{result: any}>(
            `${this.importApi}/import-genes`, data
        ).pipe(map(resp => resp.result));
    }
}
