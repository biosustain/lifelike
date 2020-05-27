import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SearchLinksComponent } from './search-links.component';
import { DrawingToolModule } from 'app/drawing-tool/drawing-tool.module';

describe('SearchLinksComponent', () => {
  let component: SearchLinksComponent;
  let fixture: ComponentFixture<SearchLinksComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
        imports: [
            DrawingToolModule,
        ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SearchLinksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  xit('should create', () => {
    expect(component).toBeTruthy();
  });
});
