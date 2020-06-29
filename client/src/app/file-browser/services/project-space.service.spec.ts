import { TestBed } from '@angular/core/testing';

import { ProjectSpaceService } from './project-space.service';

describe('ProjectSpaceService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: ProjectSpaceService = TestBed.get(ProjectSpaceService);
    expect(service).toBeTruthy();
  });
});
