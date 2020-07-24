import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import { KnowledgeMap } from './interfaces';
import { AbstractService } from '../../shared/services/abstract-service';
import { AuthenticationService } from '../../auth/services/authentication.service';

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
})
export class MapService extends AbstractService {
  readonly PROJECTS_BASE_URL = '/api/projects';
  readonly MAPS_BASE_URL = '/api/drawing-tool';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  // ========================================
  // Listing
  // ========================================

  getCommunityMaps(): Observable<KnowledgeMap[]> {
    return this.http.get<KnowledgeMap[]>(
      `/api/drawing-tool/community`,
      this.getHttpOptions(true),
    );
  }

  // ========================================
  // CRUD
  // ========================================

  createMap(projectName: string, directoryId: number, label: string, description: string, publicMap = false): Observable<any> {
    return this.http.post<any>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/map`, {
        label,
        description,
        directoryId,
        public: publicMap,
      }, this.getHttpOptions(true),
    );
  }

  getMap(projectName: string, hashId: string) {
    return this.http.get(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/map/${encodeURIComponent(hashId)}`,
      this.getHttpOptions(true),
    );
  }

  updateMap(projectName: string, map: KnowledgeMap): Observable<any> {
    return this.http.patch(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/map/${encodeURIComponent(map.hash_id)}`,
      map,
      this.getHttpOptions(true),
    );
  }

  deleteMap(projectName: string, hashId: string): Observable<any> {
    return this.http.delete(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/map/${encodeURIComponent(hashId)}`,
      this.getHttpOptions(true),
    );
  }

  // ========================================
  // Export
  // ========================================

  generateExport(projectName: string, hashId: string, format: 'pdf' | 'svg' | 'png'): Observable<any> {
    return this.http.get(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/map/${encodeURIComponent(hashId)}/${encodeURIComponent(format)}`, {
        ...this.getHttpOptions(true),
        responseType: 'blob',
      },
    );
  }

  /**
   * @deprecated use {@link generateExport}
   */
  generatePDF(projectName: string, hashId: string): Observable<any> {
    return this.generateExport(projectName, hashId, 'pdf');
  }

  /**
   * @deprecated use {@link generateExport}
   */
  generateSVG(projectName: string, hashId: string): Observable<any> {
    return this.generateExport(projectName, hashId, 'svg');
  }

  /**
   * @deprecated use {@link generateExport}
   */
  generatePNG(projectName: string, hashId: string): Observable<any> {
    return this.generateExport(projectName, hashId, 'png');
  }

  // ========================================
  // Backup
  // ========================================

  getBackup(projectName: string, hashId: string): Observable<any> {
    return this.http.get(
      `${this.MAPS_BASE_URL}/map/${encodeURIComponent(hashId)}/backup`,
      this.getHttpOptions(true),
    );
  }

  createOrUpdateBackup(projectName: string, map: KnowledgeMap): Observable<any> {
    map.description = map.description && map.description.length ?
      map.description :
      '';

    return this.http.post(
      `${this.MAPS_BASE_URL}/map/${encodeURIComponent(map.hash_id)}/backup`,
      map,
      this.getHttpOptions(true),
    );
  }

  deleteBackup(projectName: string, hashId: string): Observable<any> {
    return this.http.delete(
      `${this.MAPS_BASE_URL}/map/${encodeURIComponent(hashId)}/backup`,
      this.getHttpOptions(true),
    );
  }

  // ========================================
  // Utility
  // ========================================

  isEditableByUser(projectName: string, hashId: string): Observable<any> {
    return this.http.get(
      `${this.MAPS_BASE_URL}/map/${encodeURIComponent(hashId)}/meta`,
      this.getHttpOptions(true),
    );
  }
}
