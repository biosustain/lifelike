import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { HighlightSnippetComponent } from './highlight-snippet.component';

describe('HighlightSnippetComponent', () => {
    let component: HighlightSnippetComponent;
    let fixture: ComponentFixture<HighlightSnippetComponent>;

    configureTestSuite( () => {
        TestBed.configureTestingModule({
            declarations: [ HighlightSnippetComponent ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(HighlightSnippetComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
