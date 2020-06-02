import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SnippetDisplayComponent } from './snippet-display.component';

// TODO LL-906: Create real tests
describe('SnippetDisplayComponentComponent', () => {
    let component: SnippetDisplayComponent;
    let fixture: ComponentFixture<SnippetDisplayComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ SnippetDisplayComponent ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(SnippetDisplayComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
