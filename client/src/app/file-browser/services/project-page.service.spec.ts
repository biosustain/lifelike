import { TestBed } from '@angular/core/testing';

import { ProjectPageService } from './project-page.service';
import { configureTestSuite } from 'ng-bullet';
import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/root-store';

describe('ProjectPageService', () => {
  configureTestSuite(() => TestBed.configureTestingModule({
    imports: [
      SharedModule,
      RootStoreModule
    ]
  }));

  it('should be created', () => {
    const service: ProjectPageService = TestBed.get(ProjectPageService);
    expect(service).toBeTruthy();
  });
});
