import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { ContentAddDialogComponent } from './content-add-dialog.component';
import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/root-store';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

describe('AddContentDialogComponent', () => {
  let component: ContentAddDialogComponent;
  let fixture: ComponentFixture<ContentAddDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        SharedModule,
        RootStoreModule
      ],
      declarations: [ ContentAddDialogComponent ],
      providers: [
        NgbActiveModal
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ContentAddDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
