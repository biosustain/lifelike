import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OrganismAutocompleteComponent } from './organism-autocomplete.component';

describe('OrganismAutocompleteComponent', () => {
  let component: OrganismAutocompleteComponent;
  let fixture: ComponentFixture<OrganismAutocompleteComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OrganismAutocompleteComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OrganismAutocompleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
