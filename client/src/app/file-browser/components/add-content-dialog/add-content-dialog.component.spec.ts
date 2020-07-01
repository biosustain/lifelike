import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { AddContentDialogComponent } from './add-content-dialog.component';
import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

describe('AddContentDialogComponent', () => {
  let component: AddContentDialogComponent;
  let fixture: ComponentFixture<AddContentDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        SharedModule,
        RootStoreModule
      ],
      declarations: [ AddContentDialogComponent ],
      providers: [
        NgbActiveModal
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddContentDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
