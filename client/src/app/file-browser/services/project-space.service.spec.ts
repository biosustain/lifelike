import { TestBed } from '@angular/core/testing';

import { ProjectSpaceService } from './project-space.service';
import { configureTestSuite } from 'ng-bullet';
import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

describe('ProjectSpaceService', () => {
  configureTestSuite(() => TestBed.configureTestingModule({
    imports: [
      SharedModule,
      RootStoreModule
    ]
  }));

  it('should be created', () => {
    const service: ProjectSpaceService = TestBed.get(ProjectSpaceService);
    expect(service).toBeTruthy();
  });
});
