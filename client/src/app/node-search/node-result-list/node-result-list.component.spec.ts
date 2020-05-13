import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NodeResultListComponent } from './node-result-list.component';

describe('NodeResultListComponent', () => {
  let component: NodeResultListComponent;
  let fixture: ComponentFixture<NodeResultListComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NodeResultListComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NodeResultListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
