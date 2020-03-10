import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SidenavClusterViewComponent } from './sidenav-cluster-view.component';

describe('SidenavClusterViewComponent', () => {
  let component: SidenavClusterViewComponent;
  let fixture: ComponentFixture<SidenavClusterViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SidenavClusterViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SidenavClusterViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
