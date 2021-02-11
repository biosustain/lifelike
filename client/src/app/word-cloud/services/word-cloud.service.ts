import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {defaultSortingAlgorithm} from '../sorting/sorting-algorithms';
import { ApiService } from '../../shared/services/api.service';

@Injectable()
export class WordCloudService {
  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  getSortedCombinedAnnotations(hashId: string, sort: string = defaultSortingAlgorithm.id) {
    return this.http.post(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/counts-sort`, {}, {
        ...this.apiService.getHttpOptions(true),
        params: {sort},
        responseType: 'text',
      },
    );
  }
}
