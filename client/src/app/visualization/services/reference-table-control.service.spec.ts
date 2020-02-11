import { TestBed } from '@angular/core/testing';

import { ReferenceTableControlService } from './reference-table-control.service';

describe('ReferenceTableControlService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: ReferenceTableControlService = TestBed.get(ReferenceTableControlService);
    expect(service).toBeTruthy();
  });
});
