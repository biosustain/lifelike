import { Injectable } from '@angular/core';

import { Subject } from 'rxjs';

@Injectable()
export class EnrichmentVisualisationSelectService {
  public readonly goTerm$ = new Subject<string>();
  public readonly geneName$ = new Subject<string>();
}
