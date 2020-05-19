import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient, HttpHeaders} from '@angular/common/http';

import {
  Project,
  UniversalGraph,
  UniversalGraphEdge,
  UniversalGraphNode,
} from './interfaces';

import {
  utiProject,
  microbiomeProject
} from './mock_data';
import {isNullOrUndefined} from 'util';


@Injectable({
  providedIn: 'root'
})
export class ProjectsService {

  projects: Project[] = [utiProject, microbiomeProject];

  readonly baseUrl = '/api/drawing-tool';

  constructor(private http: HttpClient) {
  }

  /**
   * Create http options with authorization
   * header if boolean set to true
   * @param withJwt boolean representing whether to use jwt or not
   */
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

  /**
   * Pull map by hashId
   * @param hashId - act as uri for map
   */
  public serveProject(hashId) {
    return this.http.get(
      this.baseUrl + `/map/${hashId}`,
      this.createHttpOptions(true)
    );
  }


  /**
   * Return a list of projects made public within
   * user base
   */
  public pullCommunityProjects() {
    return this.http.get(
      this.baseUrl + '/community',
      this.createHttpOptions(true)
    );
  }


  /**
   * Return a list of projects owned by user
   */
  public pullProjects(): Observable<any> {
    return this.http.get(
      this.baseUrl + '/projects',
      this.createHttpOptions(true),
    );
  }

  /**
   * Return results based on search terms
   * inside of nodes in drawing-tool map
   */
  public searchForMaps(term: string): Observable<any> {
    return this.http.post(
      this.baseUrl + '/search',
      {term},
      this.createHttpOptions(true)
    );
  }

  /**
   * Return PDF version of the project
   * @param project represents a Project
   */
  public getPDF(project: Project): Observable<any> {
    return this.http.get(
      this.baseUrl + `/projects/${project.id}/pdf`,
      this.createHttpOptions(true, true)
    );
  }

  /**
   * Return SVG version of the project
   * @param project represents a Project
   */
  public getSVG(project: Project): Observable<any> {
    return this.http.get(
      this.baseUrl + `/projects/${project.id}/svg`,
      this.createHttpOptions(true, true)
    );
  }

  /**
   * Return PNG version of the project
   * @param project represents a Project
   */
  public getPNG(project: Project): Observable<any> {
    return this.http.get(
      this.baseUrl + `/projects/${project.id}/png`,
      this.createHttpOptions(true, true)
    );
  }

  /**
   * Add project to user's collection
   * @param project represents a Project
   */
  public addProject(project: Project): Observable<any> {
    return this.http.post(
      this.baseUrl + '/projects',
      project,
      this.createHttpOptions(true)
    );
  }

  /**
   * Update a project owned by user
   * @param project represents a Project
   */
  public updateProject(project: Project): Observable<any> {
    return this.http.put(
      this.baseUrl + `/projects/${project.id}`,
      project,
      this.createHttpOptions(true)
    );
  }

  /**
   * Delete a project owned by user
   * @param project represents a Project
   */
  public deleteProject(project: Project): Observable<any> {
    return this.http.delete(
      this.baseUrl + `/projects/${project.id}`,
      this.createHttpOptions(true)
    );
  }
}
