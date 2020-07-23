import { Injectable } from '@angular/core';
import {
    HttpClient,
    HttpHeaders,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface Project {
  creationDate: string;
  description: string;
  id: number;
  projectName: string;
  // Collection of user ids access to
  // the project
  users: number[];
  // Root directory associated with proejct
  directory?: Directory;
}

export interface Directory {
  directoryParentId: number;
  id: number;
  name?: string;
  projectsId: number;
  type?: string;
  routeLink?: string;
  dirPath?: {
    dir: string[];
    id: number[];
  };
}

export enum Role {
  read = 'project-read',
  edit = 'project-edit',
  admin = 'project-admin'
}

export interface Collaborator {
  // Id of the AppUser
  id?: number;
  role: string;
  username: string;
}

@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class ProjectSpaceService {
  readonly projectsAPI = '/api/projects';

  constructor(private http: HttpClient) {}

  /**
   * Create http options with authorization
   * header if boolean set to true
   * @param withJwt - boolean representing whether to return the options with a jwt
   */
  createHttpOptions(withJwt = false) {
    if (withJwt) {
      return {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('access_jwt'),
        }),
      };
    } else {
      return {
          headers: new HttpHeaders({
          'Content-Type': 'application/json',
          }),
      };
    }
  }

  /**
   * GET Request for projects resources
   * or specific project if projectName specified
   * @param projectName - name of project to load resource by
   */
  getProject(projectName= ''): Observable<any> {
    projectName = encodeURIComponent(projectName.trim());
    return this.http.get<any>(
      `${this.projectsAPI}/${projectName}`,
      this.createHttpOptions(true),
    ).pipe(
      map(resp => resp.results)
    );
  }

  /**
   * POST Rquest to create a project
   * @param projectMeta - meta dict to create project
   */
  createProject(
    projectMeta: { projectName, description }
  ): Observable<Project> {
    return this.http.post<any>(
      `${this.projectsAPI}/`,
      projectMeta,
      this.createHttpOptions(true),
    ).pipe(
      map(resp => resp.results)
    );
  }

  /** TODO - Add DELETE project endpoint */
  /** TODO - Add PUT/PATCH project endpoint */

  /**
   * Return list of collaborators for a given project
   * @param projectName - project to load resource by
   */
  getCollaborators(projectName): Observable<Collaborator[]> {
    projectName = encodeURIComponent(projectName.trim());
    return this.http.get<any>(
      `${this.projectsAPI}/${projectName}/collaborators`,
      this.createHttpOptions(true),
    ).pipe(
      map(resp => resp.results)
    );
  }

  /**
   * Add a collaborator to a project
   * @param projectName - project for which you're granting user role to
   * @param username - user to grant role to
   * @param role - role to grant to user
   */
  addCollaborator(
    projectName,
    username,
    role
  ): Observable<any> {
    projectName = encodeURIComponent(projectName.trim());
    return this.http.post<any>(
        `${this.projectsAPI}/${projectName}/collaborators/${username}`,
        { role },
        this.createHttpOptions(true)
    );
  }

  /**
   * Remove collaborator from a project
   * @param projectName - project for which your removing user from
   * @param username - the user to remove collab rights from
   */
  removeCollaborator(
    projectName,
    username
  ): Observable<any> {
    projectName = encodeURIComponent(projectName.trim());
    return this.http.delete<any>(
      `${this.projectsAPI}/${projectName}/collaborators/${username}`,
      this.createHttpOptions(true)
    );
  }

  /**
   * Edit collaborator from a project
   * @param projectName - project for which your updating user from
   * @param username - the user to modify collab rights from
   * @param role - role to change to user
   */
  editCollaborator(
    projectName,
    username,
    role
  ): Observable<any> {
    return this.http.put(
      `${this.projectsAPI}/${projectName}/collaborators/${username}`,
      { role },
      this.createHttpOptions(true)
    );
  }
}
