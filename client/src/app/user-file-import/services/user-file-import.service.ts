import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { FileNameAndSheets, Neo4jColumnMapping } from 'app/interfaces/user-file-import.interface';

@Injectable()
export class UserFileImportService {
    readonly neo4jAPI = '/api/user-file-import';

    constructor(private http: HttpClient) { }

    getDbLabels(): Observable<string[]> {
        return this.http.get<{result: string[]}>(
            `${this.neo4jAPI}/get-db-labels`,
            ).pipe(map(resp => resp.result));
    }

    getDbRelationshipTypes(): Observable<string[]> {
        return this.http.get<{result: string[]}>(
            `${this.neo4jAPI}/get-db-relationship-types`,
            ).pipe(map(resp => resp.result));
    }

    getNodeProperties(nodeLabel): Observable<{ [key: string]: string[] }> {
        return this.http.get<{result: { [key: string]: string[] }}>(
            `${this.neo4jAPI}/get-node-properties`,
            { params: { nodeLabel }},
        ).pipe(map(resp => resp.result));
    }

    uploadExperimentalDataFile(file: FormData): Observable<FileNameAndSheets> {
        return this.http.post<{result: FileNameAndSheets}>(
            `${this.neo4jAPI}/upload-file`,
            file,
        ).pipe(map(resp => resp.result));
    }

    uploadNodeMapping(mappings: Neo4jColumnMapping): Observable<any> {
        return this.http.post<{result: any}>(
            `${this.neo4jAPI}/upload-node-mapping`,
            mappings,
        ).pipe(map(resp => resp.result));
    }
}
