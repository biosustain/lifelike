import { TestBed } from '@angular/core/testing';

import { SankeyUpdateService } from './sankey-update.service';

describe('SankeyDragService', () => {
  let service: SankeyUpdateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SankeyUpdateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
