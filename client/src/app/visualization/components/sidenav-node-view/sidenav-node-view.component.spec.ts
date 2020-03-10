import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SidenavNodeViewComponent } from './sidenav-node-view.component';

describe('SidenavNodeViewComponent', () => {
  let component: SidenavNodeViewComponent;
  let fixture: ComponentFixture<SidenavNodeViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SidenavNodeViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SidenavNodeViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
