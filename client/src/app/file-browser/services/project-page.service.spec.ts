import { TestBed } from '@angular/core/testing';

import { ProjectPageService } from './project-page.service';

describe('ProjectPageService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: ProjectPageService = TestBed.get(ProjectPageService);
    expect(service).toBeTruthy();
  });
});
