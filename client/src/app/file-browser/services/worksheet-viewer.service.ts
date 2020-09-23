import { Injectable } from '@angular/core';
import {
    HttpClient,
    HttpHeaders,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AbstractService } from 'app/shared/services/abstract-service';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { Project } from './project-space.service';

export interface Worksheet {
  id: number;
  filename: string;
  sheetname: string;
  neo4jNodeId: number;
  creationDate: string;
  modifiedDate: string;
  contentID: number;
}

@Injectable({
  providedIn: 'root'
})
export class WorksheetViewerService extends AbstractService {
  readonly worksheetAPI = '/api/worksheet-viewer';
  readonly kgAPI = '/api/kg';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  getWorksheet(worksheetId): Observable<Worksheet> {
    return this.http.get<any>(
      `${this.worksheetAPI}/get-neo4j-worksheet/${encodeURIComponent(worksheetId)}`,
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBINodes(nodeId): Observable<any> {
    return this.http.get<any>(
      `${this.worksheetAPI}/get-ncbi-nodes/${encodeURIComponent(nodeId)}`,
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIUniprot(nodeIds): Observable<any> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/uniprot`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIString(nodeIds): Observable<any> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/string`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIMolecularGo(nodeIds): Observable<any> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/molecular-go`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIBiologicalGo(nodeIds): Observable<any> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/biological-go`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBICellularGo(nodeIds): Observable<any> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/cellular-go`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIEcocyc(nodeIds): Observable<any> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/ecocyc`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIRegulon(nodeIds): Observable<any> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/regulon`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }
}