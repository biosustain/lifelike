import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PageAnnotationsComponent } from './page-annotations.component';

describe('PageAnnotationsComponent', () => {
  let component: PageAnnotationsComponent;
  let fixture: ComponentFixture<PageAnnotationsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PageAnnotationsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PageAnnotationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
