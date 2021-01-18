import {AbstractService} from 'app/shared/services/abstract-service';
import {Injectable} from '@angular/core';
import {AuthenticationService} from 'app/auth/services/authentication.service';
import {HttpClient} from '@angular/common/http';
import {DefaultSortingAlgorithm} from '../sorting-algorithms';

@Injectable()
export class WordCloudService extends AbstractService {
  protected readonly SEARCH_BASE_URL = '/api/annotations';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  getCombinedAnnotations(projectName: string, fileId: string) {
    return this.http.get(`${this.SEARCH_BASE_URL}/${projectName}/${fileId}`, {
      headers: this.getAuthHeader(), responseType: 'text'
    });
  }

  getSortedCombinedAnnotations(projectName: string, fileId: string, sort: string = DefaultSortingAlgorithm.id) {
    return this.http.get(
      `${this.SEARCH_BASE_URL}/${projectName}/${fileId}`,
      {
        params: {sort},
        headers: this.getAuthHeader(), responseType: 'text'
      }
    );
  }

  getCombinedAnnotationsProject(projectName: string) {
    return this.http.get(`${this.SEARCH_BASE_URL}/${projectName}`, {
      headers: this.getAuthHeader(), responseType: 'text',
    });
  }

  getSortedCombinedAnnotationsProject(projectName: string, sort: string = DefaultSortingAlgorithm.id) {
    return this.http.get(`${this.SEARCH_BASE_URL}/${projectName}`, {
      params: {sort},
      headers: this.getAuthHeader(), responseType: 'text',
    });
  }

  private getAuthHeader() {
    return {Authorization: `Bearer ${this.auth.getAccessToken()}`};
  }

}
