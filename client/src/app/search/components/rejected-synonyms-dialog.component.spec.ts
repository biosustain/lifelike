import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';

import { RejectedSynonymsDialogComponent } from './rejected-synonyms-dialog.component';
import { ContentSearchService } from '../services/content-search.service';

describe('RejectedSynonymsDialogComponent', () => {
  let component: RejectedSynonymsDialogComponent;
  let fixture: ComponentFixture<RejectedSynonymsDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        RootStoreModule,
        SharedModule,
        BrowserAnimationsModule,
      ],
      declarations: [ RejectedSynonymsDialogComponent ],
      providers: [
        ContentSearchService,
        NgbActiveModal,
      ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RejectedSynonymsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
