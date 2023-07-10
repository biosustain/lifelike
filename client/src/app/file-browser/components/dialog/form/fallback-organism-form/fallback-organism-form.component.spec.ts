import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FallbackOrganismFormComponent } from './fallback-organism-form.component';

describe('FallbackOrganismFormComponent', () => {
  let component: FallbackOrganismFormComponent;
  let fixture: ComponentFixture<FallbackOrganismFormComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FallbackOrganismFormComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FallbackOrganismFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
