import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
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
  uti_project,
  microbiome_project
} from './mock_data';


@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class ProjectsService {

  projects:Project[] = [uti_project, microbiome_project];

  base_url = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private route: Router
  ) { }

  /**
   * Create http options with authorization
   * header if boolean set to true
   * @param with_jwt 
   */
  createHttpOptions(with_jwt=false) {
    const headers = {
      'Content-Type':  'application/json'
    }

    if (with_jwt) {
      headers['Authorization'] = 'Token ' + localStorage.getItem('access_jwt');
    }

    const httpOptions = {
      headers: new HttpHeaders(headers)
    };
    return httpOptions
  }

  /**
   * Return a list of projects made public within
   * user base
   */
  public pullCommunityProjects() {
    return this.http.get(
      this.base_url + '/drawing-tool/community',
      this.createHttpOptions(true)
    );
  }


  /**
   * Return a list of projects owned by user
   */
  public pullProjects(): Observable<Object> {
    return this.http.get(
      this.base_url + '/drawing-tool/projects',
      this.createHttpOptions(true)
    );
  }

  /**
   * Add project to user's collection
   * @param project 
   */
  public addProject(project: Project): Observable<Object> {
    return this.http.post(
      this.base_url + '/drawing-tool/projects',
      project,
      this.createHttpOptions(true)
    );
  }

  /**
   * Update a project owned by user
   * @param project
   */
  public updateProject(project: Project): Observable<Object> {
    return this.http.put(
      this.base_url + `/drawing-tool/projects/${project.id}`,
      project,
      this.createHttpOptions(true)
    );
  }

  /**
   * Delete a project owned by user
   * @param project
   */
  public deleteProject(project: Project): Observable<Object> {
    return this.http.delete(
      this.base_url + `/drawing-tool/projects/${project.id}`,
      this.createHttpOptions(true)
    );
  }

  /**
   * Convert a graph to universal representation
   * from Vis.js Network representation
   */
  public vis2Universe(graph:VisNetworkGraph): UniversalGraph {
    let nodes: UniversalGraphNode[] = graph.nodes.map(
      (n:VisNetworkGraphNode): UniversalGraphNode => {
        return {
          data: {
            x: n.x,
            y: n.y,
            hyperlink: Object.is(n.data.hyperlink, undefined) ? '' : n.data.hyperlink
          },
          display_name: n.label,
          hash: n.id,
          label: n.group,
          sub_labels: []
        }
      }
    );

    let edges: UniversalGraphEdge[] = graph.edges.map(
      (e:VisNetworkGraphEdge):UniversalGraphEdge => {
        return {
          label: e.label,
          from: e.from,
          to: e.to,
          data: {}
        }
      }
    );

    let vis_graph: UniversalGraph = {
      edges: edges,
      nodes: nodes
    }

    return vis_graph;
  }

  /**
   * Convert a graph to Vis.js Network Representation
   * from Universal representation
   * @param graph 
   */
  public universe2Vis(graph:UniversalGraph): VisNetworkGraph {
    let nodes: VisNetworkGraphNode[] = graph.nodes.map(
      (n:UniversalGraphNode): VisNetworkGraphNode => {
        return {
          label: n.display_name,
          x: n.data['x'],
          y: n.data['y'],
          id: n.hash,
          group: n.label,
          data: {
            hyperlink: Object.is(n.data.hyperlink, undefined) ? '' : n.data.hyperlink
          }
        }
      }
    );
    
    let edges: VisNetworkGraphEdge[] = graph.edges.map(
      (e:UniversalGraphEdge): VisNetworkGraphEdge => {
        return {
          from: e.from,
          to: e.to,
          label: e.label,
          id: e.data['hash']
        }
      }
    );

    let vis_graph:VisNetworkGraph = {
      edges: edges,
      nodes: nodes
    }

    return vis_graph;
  }
}
