import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NodeSearchBarComponent } from './node-search-bar.component';

describe('NodeSearchBarComponent', () => {
  let component: NodeSearchBarComponent;
  let fixture: ComponentFixture<NodeSearchBarComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NodeSearchBarComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NodeSearchBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
