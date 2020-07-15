import { TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { EditGuard } from './edit.guard';
import { RootStoreModule } from 'app/root-store';
import { RouterTestingModule } from '@angular/router/testing';
import { DrawingToolModule } from '../drawing-tool.module';

describe('EditGuardService', () => {

  configureTestSuite(
    () => {
      TestBed.configureTestingModule({
        imports: [
          RootStoreModule,
          RouterTestingModule,
          DrawingToolModule
        ]
      });
    }
  );

  it('should be created', () => {
    const service: EditGuard = TestBed.get(EditGuard);
    expect(service).toBeTruthy();
  });
});
