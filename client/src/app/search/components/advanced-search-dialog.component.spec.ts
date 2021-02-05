import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';

import { AdvancedSearchDialogComponent } from './advanced-search-dialog.component';
import { ContentSearchService } from '../services/content-search.service';

describe('AdvancedSearchDialogComponent', () => {
  let component: AdvancedSearchDialogComponent;
  let fixture: ComponentFixture<AdvancedSearchDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        RootStoreModule,
        SharedModule,
        BrowserAnimationsModule,
      ],
      declarations: [ AdvancedSearchDialogComponent ],
      providers: [
        ContentSearchService,
        NgbActiveModal,
      ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdvancedSearchDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
