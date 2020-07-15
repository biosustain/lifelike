import { TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { EditGuard } from './edit.guard';
import { RootStoreModule } from 'app/root-store';
import { RouterTestingModule } from '@angular/router/testing';
import { DrawingToolModule } from '../drawing-tool.module';
import { NodeSearchModule } from 'app/node-search/node-search.module';
import {PdfSearchModule} from '../../pdf-search/pdf-search.module';

describe('EditGuardService', () => {

  configureTestSuite(
    () => {
      TestBed.configureTestingModule({
        imports: [
          RootStoreModule,
          RouterTestingModule,
          DrawingToolModule,
          NodeSearchModule,
          PdfSearchModule
        ]
      });
    }
  );

  it('should be created', () => {
    const service: EditGuard = TestBed.get(EditGuard);
    expect(service).toBeTruthy();
  });
});
