import { TestBed } from '@angular/core/testing';

import { ContextMenuControlService } from './context-menu-control.service';

describe('ContextMenuControlService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: ContextMenuControlService = TestBed.get(ContextMenuControlService);
    expect(service).toBeTruthy();
  });
});
