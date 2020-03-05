import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SidenavEdgeViewComponent } from './sidenav-edge-view.component';

describe('SidenavEdgeViewComponent', () => {
  let component: SidenavEdgeViewComponent;
  let fixture: ComponentFixture<SidenavEdgeViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SidenavEdgeViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SidenavEdgeViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
