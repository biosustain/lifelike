import {
  AfterViewInit,
  ContentChild,
  Directive,
  ElementRef,
  forwardRef,
  HostBinding,
  HostListener,
  Inject,
  NgZone,
  OnDestroy,
  Renderer2,
} from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Directive that marks the body of a context menu.
 */
@Directive({
  selector: '[appContextMenuBody]',
})
export class ContextMenuBodyDirective {
  /**
   * Sets the styles for the menu and also sets display: none.
   */
  @HostBinding('class.dropdown-menu') _dropdownMenuClass = true;
  @HostBinding('class.context-menu-body') _contextMenuBodyClass = true;
  /**
   * Makes the menu scrollable if the viewport is too small.
   */
  @HostBinding('style.overflow') _overflowStyle = 'auto';

  constructor(@Inject(forwardRef(() => ContextMenuDirective))
              readonly contextMenu: ContextMenuDirective) {
  }
}

/**
 * The context menu.
 */
@Directive({
  selector: '[appContextMenu]',
})
export class ContextMenuDirective implements AfterViewInit, OnDestroy {
  @ContentChild(ContextMenuBodyDirective, {static: false, read: ElementRef})
  private bodyDirective: ElementRef;

  private _open = false;
  protected readonly subscriptions = new Subscription();
  protected mousePosition = [0, 0];
  private readonly viewportSpacing = 5;
  private mouseMovedBound = this.mouseMoved.bind(this);

  constructor(protected readonly element: ElementRef,
              protected readonly renderer: Renderer2,
              protected readonly ngZone: NgZone) {
  }

  ngAfterViewInit() {
    // This forces all context menus to close on any right click, so we don't need to
    // keep track of which context menu is supposed to be open, although this means you cannot
    // right click on the contents of context menus
    this.subscriptions.add(fromEvent(document.body, 'contextmenu', {
      capture: true,
    }).pipe(map(() => this.open = false)).subscribe());

    this.ngZone.runOutsideAngular(() => {
      // Register this event outside because NgZone may be slow
      document.addEventListener('mousemove', this.mouseMovedBound);
    });
  }

  ngOnDestroy(): void {
    this.removeFromBody();
    this.subscriptions.unsubscribe();
    document.removeEventListener('mousemove', this.mouseMovedBound);
  }

  get open(): boolean {
    return this._open;
  }

  set open(open: boolean) {
    const wasOpen = this._open;
    this._open = open;
    if (open) {
      this.showBody();
    } else {
      if (wasOpen) {
        this.hideBody();
      }
    }
  }

  toggle() {
    this.open = !this.open;
  }

  /**
   * Listener to track where the mouse was last.
   * @param e the event
   */
  mouseMoved(e: MouseEvent) {
    this.mousePosition = [e.pageX, e.pageY];
  }

  @HostListener('window:resize', ['$event'])
  windowResized(e: MouseEvent) {
    this.open = false;
  }

  @HostListener('contextmenu', ['$event'])
  contextMenuClicked(e) {
    e.stopPropagation();
    e.preventDefault();
    this.open = true;
  }

  @HostListener('document:click', ['$event'])
  documentClicked(e: MouseEvent) {
    this.open = false;
  }

  /**
   * Move the menu back to the original container.
   */
  private removeFromBody() {
    this.renderer.appendChild(this.element.nativeElement, this.bodyDirective.nativeElement);
  }

  /**
   * Move the menu to <body> so it doesn't get ruined by elements with overflow.
   */
  private placeInBody() {
    this.removeFromBody();
    this.renderer.appendChild(document.body, this.bodyDirective.nativeElement);
  }

  /**
   * Internal method to show and position the dropdown. Can be called when already open.
   */
  private showBody() {
    this.placeInBody();

    const bodyElement = this.bodyDirective.nativeElement;

    let x = this.mousePosition[0];
    let y = this.mousePosition[1];
    const viewportWidth = document.documentElement.clientWidth - this.viewportSpacing;
    const viewportHeight = document.documentElement.clientHeight - this.viewportSpacing;

    // Need to show the element to measure it
    bodyElement.classList.add('show');

    let width = bodyElement.offsetWidth;
    let height = bodyElement.offsetHeight;

    let forceWidth: number = null;
    let forceHeight: number = null;

    if (width > viewportWidth) {
      forceWidth = viewportWidth;
      width = viewportWidth;
    }

    if (height > viewportHeight) {
      forceHeight = viewportHeight;
      height = viewportHeight;
    }

    if (x + width > viewportWidth) {
      x += (viewportWidth - (x + width));
    }

    if (y + height > viewportHeight) {
      y += (viewportHeight - (y + height));
    }

    bodyElement.style.left = x + 'px';
    bodyElement.style.top = y + 'px';

    if (forceWidth != null) {
      bodyElement.style.width = forceWidth + 'px';
    }

    if (forceHeight != null) {
      bodyElement.style.height = forceHeight + 'px';
    }

    // Deal with the fact that we move the menu to <body>, which screws up tabbing
    bodyElement.setAttribute('tabindex', '-1');
    bodyElement.focus();
    bodyElement.setAttribute('tabindex', '');
  }

  /**
   * Get rid of the menu.
   */
  private hideBody() {
    const bodyElement = this.bodyDirective.nativeElement;
    bodyElement.style.width = '';
    bodyElement.style.height = '';
    bodyElement.classList.remove('show');

    this.removeFromBody();
  }
}
