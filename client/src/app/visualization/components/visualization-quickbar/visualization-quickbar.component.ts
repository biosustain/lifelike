import {
    Component,
    EventEmitter,
    Output,
} from '@angular/core';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

@Component({
    selector: 'app-visualization-quickbar',
    template: `
        <mat-toolbar id="vis-quickbar">
            <mat-slide-toggle (change)="animationToggle($event)" [checked]="true">Animation</mat-slide-toggle>
        </mat-toolbar>
    `,
    styleUrls: ['./visualization-quickbar.component.scss'],
})
export class VisualizationQuickbarComponent {
    @Output() animationStatus = new EventEmitter<boolean>();

    constructor() {}

    animationToggle($event: MatSlideToggleChange) {
        this.animationStatus.emit($event.checked);
    }
}
