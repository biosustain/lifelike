import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import {
  Project,
  UniversalGraph,
  UniversalGraphEdge,
  UniversalGraphNode,
  VisNetworkGraph,
  VisNetworkGraphEdge,
  VisNetworkGraphNode
} from './interfaces';

import {
  utiProject,
  microbiomeProject
} from './mock_data';
import { isNullOrUndefined } from 'util';


@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class ProjectsService {

  projects: Project[] = [utiProject, microbiomeProject];

  baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  /**
   * Create http options with authorization
   * header if boolean set to true
   * @param withJwt boolean representing whether to use jwt or not
   */
  createHttpOptions(withJwt= false, blob= false) {
    let headers;

    if (withJwt) {
      headers = {
            'Content-Type':  'application/json',
            Authorization: 'Bearer ' + localStorage.getItem('access_jwt')
          };
    } else {
      headers = {
        'Content-Type':  'application/json'
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
   * Return a list of projects owned by user
   */
  public pullProjects(): Observable<any> {
    return this.http.get(
      this.baseUrl + '/drawing-tool/projects',
      this.createHttpOptions(true),
    );
  }

  /**
   * Return PDF version of the project
   * @param project represents a Project
   */
  public getPDF(project: Project): Observable<any> {
    return this.http.get(
      this.baseUrl + `/drawing-tool/projects/${project.id}/pdf`,
      this.createHttpOptions(true, true)
    );
  }

  /**
   * Add project to user's collection
   * @param project represents a Project
   */
  public addProject(project: Project): Observable<any> {
    return this.http.post(
      this.baseUrl + '/drawing-tool/projects',
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
      this.baseUrl + `/drawing-tool/projects/${project.id}`,
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
      this.baseUrl + `/drawing-tool/projects/${project.id}`,
      this.createHttpOptions(true)
    );
  }

  /**
   * Convert a graph to universal representation
   * from Vis.js Network representation
   */
  public vis2Universe(graph: VisNetworkGraph): UniversalGraph {
    const nodes: UniversalGraphNode[] = graph.nodes.map(
      (n: VisNetworkGraphNode): UniversalGraphNode => {
        return {
          data: {
            x: n.x,
            y: n.y,
            hyperlink: isNullOrUndefined(n.data.hyperlink) ? '' : n.data.hyperlink
          },
          display_name: n.label,
          hash: n.id,
          label: n.group,
          sub_labels: []
        };
      }
    );

    const edges: UniversalGraphEdge[] = graph.edges.map(
      (e: VisNetworkGraphEdge): UniversalGraphEdge => {
        return {
          label: e.label,
          from: e.from,
          to: e.to,
          data: {}
        };
      }
    );

    const visGraph: UniversalGraph = {
      edges,
      nodes
    };

    return visGraph;
  }

  /**
   * Convert a graph to Vis.js Network Representation
   * from Universal representation
   * @param graph represents a UniversalGraph
   */
  public universe2Vis(graph: UniversalGraph): VisNetworkGraph {
    const nodes: VisNetworkGraphNode[] = graph.nodes.map(
      (n: UniversalGraphNode): VisNetworkGraphNode => {
        return {
          label: n.display_name,
          x: n.data.x,
          y: n.data.y,
          id: n.hash,
          group: n.label,
          data: {
            hyperlink: isNullOrUndefined(n.data.hyperlink) ? '' : n.data.hyperlink
          }
        };
      }
    );

    const edges: VisNetworkGraphEdge[] = graph.edges.map(
      (e: UniversalGraphEdge): VisNetworkGraphEdge => {
        return {
          from: e.from,
          to: e.to,
          label: e.label,
          id: e.data.hash,
        };
      }
    );

    const visGraph: VisNetworkGraph = {
      edges,
      nodes
    };

    return visGraph;
  }
}
