import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { FileNameAndSheets, Neo4jColumnMapping } from '../../interfaces/neo4j.interface';

@Injectable()
export class Neo4jService {
    readonly neo4jAPI = '/api/neo4j';

    constructor(private http: HttpClient) {}

    uploadNeo4jFile(file: FormData): Observable<FileNameAndSheets> {
        return this.http.post<{result: FileNameAndSheets}>(`${this.neo4jAPI}/upload-file`,
            file).pipe(map(resp => resp.result));
    }

    uploadNeo4jColumnMappingFile(mappings: Neo4jColumnMapping): Observable<FileNameAndSheets> {
        return this.http.post<{result: any}>(`${this.neo4jAPI}/upload-mapping-file`,
            mappings).pipe(map(resp => resp.result));
    }
}
