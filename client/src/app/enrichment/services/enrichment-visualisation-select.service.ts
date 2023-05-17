import { Injectable } from '@angular/core';

import { Subject } from 'rxjs';


@Injectable()
export class EnrichmentVisualisationSelectService {
  public goTerm$ = new Subject<string>();
  public geneName$ = new Subject<string>();
}
