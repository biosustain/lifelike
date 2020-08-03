import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { DirectoryEditDialogComponent } from './directory-edit-dialog.component';
import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/root-store';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

describe('AddContentDialogComponent', () => {
  let component: DirectoryEditDialogComponent;
  let fixture: ComponentFixture<DirectoryEditDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        SharedModule,
        RootStoreModule
      ],
      declarations: [ DirectoryEditDialogComponent ],
      providers: [
        NgbActiveModal
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DirectoryEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
