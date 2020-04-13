import { Component, OnInit, Input, Output, EventEmitter, ViewChild, TemplateRef, ViewContainerRef } from '@angular/core';
import { Project } from 'app/drawing-tool/services/interfaces';
import { MatTabChangeEvent } from '@angular/material';
import { OverlayRef, Overlay } from '@angular/cdk/overlay';
import { Subscription, fromEvent } from 'rxjs';
import { isNullOrUndefined } from 'util';
import { take, filter } from 'rxjs/operators';
import { TemplatePortal } from '@angular/cdk/portal';

/**
 * Sort project by most recent modified date
 * @param a - item to sort
 * @param b - item to sort against
 */
const sort = (a: Project, b: Project) => {
  if (
    a.date_modified < b.date_modified
  ) {
    return 1;
  } else if (
    a.date_modified === b.date_modified
  ) {
    return 0;
  } else {
    return -1;
  }
};

@Component({
  selector: 'app-map-list',
  templateUrl: './map-list.component.html',
  styleUrls: ['./map-list.component.scss']
})
export class MapListComponent implements OnInit {
  /** Template to inject contextmenu in */
  @ViewChild('projectMenu', {static: false}) projectMenu: TemplateRef<any>;
  overlayRef: OverlayRef | null = null;
  /** Hold subscribe function to click events on context menu */
  sub: Subscription;

  @Input() childMode = false;

  @Input() selectedProject: Project = null;
  @Input() projects: Project[] = [];
  @Input() publicProjects: Project[] = [];

  @Output() projectAPICaller: EventEmitter<any> = new EventEmitter();

  /** Whether to show community or personal maps */
  privateDisplayMode = 'personal';
  displayIndex = 0;

  get displayMode() {
    return this.privateDisplayMode;
  }
  set displayMode(val) {
    this.privateDisplayMode = val;
    this.displayIndex = val === 'personal' ? 0 : 1;
    this.projects.sort(sort);
  }

  constructor(
    public overlay: Overlay,
    public viewContainerRef: ViewContainerRef
  ) { }

  ngOnInit() {

  }

  clickHandler(action: string, project: Project) {
    if (this.overlayRef) { return; }

    this.projectAPICaller.emit({
      action,
      project
    });
  }

  contextHandler(action: string, project: Project) {
    this.projectAPICaller.emit({
      action,
      project
    });
  }

  /**
   * Switch between personal or community view
   */
  toggleView(tab: MatTabChangeEvent) {
    this.selectedProject = null;
    this.displayMode = tab.tab.textLabel.toLocaleLowerCase();
  }

  reset() {
    this.displayMode = 'personal';
  }

  /**
   * Function handler for contextmenu click event
   * to spin up rendered contextmenu for project actions
   * @param event represents a oncontext event
   * @param project represents a project object
   */
  open(event: MouseEvent, project) {
    // prevent event bubbling
    event.preventDefault();

    const {x, y} = event;

    // Close previous context menu if open
    this.close();

    // Position overlay to top right corner
    // of cursor context menu click
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo({ x, y })
      .withPositions([
        {
          originX: 'end',
          originY: 'bottom',
          overlayX: 'end',
          overlayY: 'top',
        }
      ]);

    // Create and render overlay near cursor position
    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close()
    });

    this.overlayRef.attach(new TemplatePortal(this.projectMenu, this.viewContainerRef, {
      $implicit: project
    }));

    // Listen for click event after context menu has been
    // render on project item
    this.sub = fromEvent<MouseEvent>(document, 'click')
      .pipe(
        filter(mouseEvent => {
          const clickTarget = mouseEvent.target as HTMLElement;

          // TODO: Not sure what the purpose of this is?
          // Check if right click event
          //   let isRightClick = false;
          //   if ('which' in mouseEvent) {
          //     isRightClick = mouseEvent.which === 3;
          //   } else if ('button' in event) {
          //     isRightClick = mouseEvent.button === 2;
          //   }

          // Return whether or not click event is on context menu or outside
          return !!this.overlayRef && !this.overlayRef.overlayElement.contains(clickTarget);
        }),
        take(1)
      ).subscribe(() => this.close());
  }

  /**
   * Close and remove the context menu
   * while unsubscribing from click streams
   * to it
   */
  close() {
    if (!isNullOrUndefined(this.sub)) {
        this.sub.unsubscribe();
    }
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
  }
}
