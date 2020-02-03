import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { FileNameAndSheets, Neo4jColumnMapping } from '../../interfaces/neo4j.interface';

@Injectable()
export class Neo4jService {
    readonly neo4jAPI = '/api/neo4j';

    constructor(private http: HttpClient) {}

    getDbLabels(): Observable<string[]> {
        return this.http.get<{result: string[]}>(
            `${this.neo4jAPI}/get-db-labels`).pipe(map(resp => resp.result));
    }

    getNodeProperties(nodeLabel): Observable<{ [key: string]: string[] }> {
        return this.http.get<{result: { [key: string]: string[] }}>(
            `${this.neo4jAPI}/get-node-properties`,
            { params: new HttpParams().set('nodeLabel', nodeLabel) },
        ).pipe(map(resp => resp.result));
    }

    uploadNeo4jFile(file: FormData): Observable<FileNameAndSheets> {
        return this.http.post<{result: FileNameAndSheets}>(`${this.neo4jAPI}/upload-file`,
            file).pipe(map(resp => resp.result));
    }

    uploadNodeMapping(mappings: Neo4jColumnMapping): Observable<any> {
        return this.http.post<{result: any}>(`${this.neo4jAPI}/upload-node-mapping`,
            mappings).pipe(map(resp => resp.result));
    }

    uploadRelationshipMapping(mappings: Neo4jColumnMapping): Observable<any> {
        return this.http.post<{result: any}>(`${this.neo4jAPI}/upload-relationship-mapping`,
            mappings).pipe(map(resp => resp.result));
    }
}
