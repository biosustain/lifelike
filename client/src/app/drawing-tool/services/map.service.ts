import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient, HttpHeaders} from '@angular/common/http';

import {
  Map,
  UniversalGraph,
  UniversalGraphEdge,
  UniversalGraphNode,
} from './interfaces';

import {
  DrawingUploadPayload
} from 'app/interfaces/drawing.interface';

import {
  utiProject,
  microbiomeProject
} from './mock_data';
import {isNullOrUndefined} from 'util';
import { encode } from 'punycode';


@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class MapService {
  readonly baseUrl = '/api/drawing-tool';

  constructor(private http: HttpClient) {
  }

  // ========================================
  // CRUD
  // ========================================

  get(projectName: string, hashId: string) {
    return this.http.get(
      `/api/projects/${encodeURIComponent(projectName)}/map/${encodeURIComponent(hashId)}`,
      this.createHttpOptions(true)
    );
  }

  update(projectName: string, map: Map): Observable<any> {
    return this.http.patch(
      `/api/projects/${encodeURIComponent(projectName)}/map/${encodeURIComponent(map.hash_id)}`,
      map,
      this.createHttpOptions(true)
    );
  }

  delete(projectName: string, hashId: string): Observable<any> {
    return this.http.delete(
      `/api/projects/${encodeURIComponent(projectName)}/map/${encodeURIComponent(hashId)}`,
      this.createHttpOptions(true)
    );
  }

  // ========================================
  // Export
  // ========================================

  generatePDF(projectName: string, hashId: string): Observable<any> {
    return this.http.get(
      `/api/projects/${encodeURIComponent(projectName)}/map/${encodeURIComponent(hashId)}/pdf`,
      this.createHttpOptions(true, true)
    );
  }

  generateSVG(projectName: string, hashId: string): Observable<any> {
    return this.http.get(
      `/api/projects/${encodeURIComponent(projectName)}/map/${encodeURIComponent(hashId)}/svg`,
      this.createHttpOptions(true, true)
    );
  }

  generatePNG(projectName: string, hashId: string): Observable<any> {
    return this.http.get(
      `/api/projects/${encodeURIComponent(projectName)}/map/${encodeURIComponent(hashId)}/png`,
      this.createHttpOptions(true, true)
    );
  }

  // ========================================
  // Backup
  // ========================================

  getBackup(projectName: string, hashId: string): Observable<any> {
    return this.http.get(
      `${this.baseUrl}/map/${encodeURIComponent(hashId)}/backup`,
      this.createHttpOptions(true)
    );
  }

  createOrUpdateBackup(projectName: string, map: Map): Observable<any> {
    map.description = map.description && map.description.length ?
      map.description :
      '';

    return this.http.post(
      `${this.baseUrl}/map/${encodeURIComponent(map.hash_id)}/backup`,
      map,
      this.createHttpOptions(true)
    );
  }

  deleteBackup(projectName: string, hashId: string): Observable<any> {
    return this.http.delete(
      `${this.baseUrl}/map/${encodeURIComponent(hashId)}/backup`,
      this.createHttpOptions(true)
    );
  }

  // ========================================
  // Utility
  // ========================================

  isEditableByUser(projectName: string, hashId: string): Observable<any> {
    return this.http.get(
      `${this.baseUrl}/map/${encodeURIComponent(hashId)}/meta`,
      this.createHttpOptions(true)
    );
  }

  // ========================================

  createHttpOptions(withJwt = false, blob = false) {
    let headers;

    if (withJwt) {
      headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + localStorage.getItem('access_jwt')
      };
    } else {
      headers = {
        'Content-Type': 'application/json'
      };
    }
    let httpOptions: any;

    if (blob) {
      httpOptions = {
        headers: new HttpHeaders(headers),
        responseType: 'blob'
      };
    } else {
      httpOptions = {
        headers: new HttpHeaders(headers)
      };
    }
    return httpOptions;
  }
}
