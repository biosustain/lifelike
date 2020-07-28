import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { GeneImportRelationship } from 'app/interfaces/kg-import.interface';

@Injectable({
  providedIn: 'root'
})
export class KgImportService {
    readonly importApi = '/api/user-file-import';

    constructor(
        private http: HttpClient,
    ) { }

    importGeneRelationships(
      fileName: string,
      sheetName: string,
      worksheetNodeName: string,
      relationships: GeneImportRelationship[],
    ): Observable<any> {
        return this.http.post<{result: any}>(
            `${this.importApi}/import-genes`, { fileName, sheetName, worksheetNodeName, relationships }
        ).pipe(map(resp => resp.result));
    }
}
