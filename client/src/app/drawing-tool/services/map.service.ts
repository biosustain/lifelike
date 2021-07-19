import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { KnowledgeMap } from './interfaces';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { Project } from 'app/file-browser/services/project-space.service';
import { AppUser } from 'app/interfaces';
import { AbstractService } from 'app/shared/services/abstract-service';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { PaginatedRequestOptions, ResultList } from '../../shared/schemas/common';

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

  getCommunityMaps(options: PaginatedRequestOptions = {}): Observable<ResultList<PublicMap>> {
    return this.http.get<ResultList<PublicMap>>(
      `${this.MAPS_BASE_URL}/community`, {
        ...this.getHttpOptions(true),
        params: options as any,
      },
    );
  }

  // ========================================
  // CRUD
  // ========================================

  createMap(
    projectName: string,
    directoryId: number,
    label: string,
    description: string,
    publicMap = false
  ): Observable<any> {
    return this.http.post<any>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/map`,
      {
        label,
        description,
        directoryId,
        public: publicMap,
      },
      this.getHttpOptions(true)
    );
  }

  getMap(projectName: string, hashId: string) {
    return this.http.get(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(
        projectName
      )}/map/${encodeURIComponent(hashId)}`,
      this.getHttpOptions(true)
    );
  }

  updateMap(projectName: string, target: KnowledgeMap): Observable<any> {
    return this.http.patch(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/map/${encodeURIComponent(target.hash_id)}`,
      target,
      this.getHttpOptions(true),
    );
  }

  moveMap(projectName: string,
          hashId: string,
          destinationDirectoryId: number): Observable<any> {
    return this.http.post<PdfFile>(
        `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/maps/${encodeURIComponent(hashId)}/move`, {
          destination: {
            directoryId: destinationDirectoryId,
          },
        },
        this.getHttpOptions(true),
    );
  }

  deleteMap(projectName: string, hashId: string): Observable<any> {
    return this.http.delete(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(
        projectName
      )}/map/${encodeURIComponent(hashId)}`,
      this.getHttpOptions(true)
    );
  }

  getMapVersions(
    projectName: string,
    hashId: string,
  ): Observable<any> {
    return this.http.get(
      `${this.MAPS_BASE_URL}/${encodeURIComponent(
        projectName
      )}/map/${encodeURIComponent(hashId)}/version/`,
      this.getHttpOptions(true)
    );
  }

  getMapVersionbyID(
    projectName: string,
    hashId: string,
    versionID: number
  ): Observable<{version: KnowledgeMap}> {
    return this.http.get<{version: KnowledgeMap}>(
      `${this.MAPS_BASE_URL}/${encodeURIComponent(
        projectName
      )}/map/${encodeURIComponent(hashId)}/version/${encodeURIComponent(versionID)}`,
      this.getHttpOptions(true)
    );
  }

  // ========================================
  // Export
  // ========================================

  generateExport(
    projectName: string,
    hashId: string,
    format: 'pdf' | 'svg' | 'png'
  ): Observable<any> {
    return this.http.get(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(
        projectName
      )}/map/${encodeURIComponent(hashId)}/${encodeURIComponent(format)}`,
      {
        ...this.getHttpOptions(true),
        responseType: 'blob',
      }
    );
  }

  // ========================================
  // Backup
  // ========================================

  getBackup(projectName: string, hashId: string): Observable<any> {
    return this.http.get(
      `${this.MAPS_BASE_URL}/map/${encodeURIComponent(hashId)}/backup`,
      this.getHttpOptions(true)
    );
  }

  createOrUpdateBackup(projectName: string, target: KnowledgeMap): Observable<any> {
    target.description = target.description && target.description.length ?
      target.description :
      '';

    return this.http.post(
      `${this.MAPS_BASE_URL}/map/${encodeURIComponent(target.hash_id)}/backup`,
      target,
      this.getHttpOptions(true),
    );
  }

  deleteBackup(projectName: string, hashId: string): Observable<any> {
    return this.http.delete(
      `${this.MAPS_BASE_URL}/map/${encodeURIComponent(hashId)}/backup`,
      this.getHttpOptions(true)
    );
  }

  // ========================================
  // Utility
  // ========================================

  isEditableByUser(projectName: string, hashId: string): Observable<any> {
    return this.http.get(
      `${this.MAPS_BASE_URL}/map/${encodeURIComponent(hashId)}/meta`,
      this.getHttpOptions(true)
    );
  }
}

export interface PublicMap {
  map: KnowledgeMap;
  user: AppUser;
  project: Project;
}