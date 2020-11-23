import { Injectable } from '@angular/core';
import { ApiService } from '../../shared/services/api.service';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { ProjectList } from '../models/project-list';
import { ResultList } from '../../interfaces/shared.interface';
import { Observable } from 'rxjs';
import { ProjectImpl } from '../models/filesystem-object';
import { ProjectData } from '../schema';

@Injectable()
export class ProjectService {

  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  getProjects(): Observable<ProjectList> {
    return this.http.get<ResultList<ProjectData>>(
      `/api/projects/`, this.apiService.getHttpOptions(true)
    ).pipe(
      map(data => {
        const projectList = new ProjectList();
        projectList.collectionSize = data.results.length;
        projectList.results.replace(data.results.map(
          itemData => new ProjectImpl().update(itemData)));
        return projectList;
      })
    );
  }

}
