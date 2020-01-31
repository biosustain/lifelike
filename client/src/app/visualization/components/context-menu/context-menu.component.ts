import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from '@angular/core';

import { createPopper, VirtualElement, Instance } from '@popperjs/core';
import { IdType } from 'vis-network';

import { ContextMenuControlService, ContextMenuDetails } from '../../services/context-menu-control.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
})
export class ContextMenuComponent implements OnInit, OnDestroy {
  @Input() selectedNodes: IdType[];
  @Input() selectedEdges: IdType[];

  virtualElement: VirtualElement;
  popper: Instance;
  contextMenu: HTMLElement;
  subMenus: string[] = ['group-1-submenu'];

  hideContextMenuSubscription: Subscription;
  updatePopperSubscription: Subscription;

  constructor(
    private contextMenuControlService: ContextMenuControlService,
  ) {
    this.hideContextMenuSubscription = this.contextMenuControlService.hideContextMenu$.subscribe(hideContextMenu => {
      if (hideContextMenu) {
        this.hideMenu();
      } else {
        this.showMenu();
      }
    });

    this.updatePopperSubscription = this.contextMenuControlService.updatePopper$.subscribe((details: ContextMenuDetails) => {
      this.updatePopper(details.posX, details.posY);
    });
  }

  ngOnInit() {
    this.contextMenu = document.querySelector('#***ARANGO_USERNAME***-menu');
    this.setupPopper();
  }

  ngOnDestroy() {
    this.hideContextMenuSubscription.unsubscribe();
    this.updatePopperSubscription.unsubscribe();
  }

  // TODO KG-17: Need to use Tippy so we can set a delay on the tooltip appearing for submenus

  generateRect(x = 0, y = 0) {
    return () => ({
      width: 0,
      height: 0,
      top: y,
      right: x,
      bottom: y,
      left: x,
    });
  }

  setupPopper() {
    this.virtualElement = {
      getBoundingClientRect: this.generateRect(),
    };
    this.popper = createPopper(this.virtualElement, this.contextMenu, {
      modifiers: [
        {
          name: 'offset',
          options: {
            offset: [0, 0],
          },
        },
      ],
      placement: 'right-start',
    });
  }

  updatePopper(posX: number, posY: number) {
    this.virtualElement.getBoundingClientRect = this.generateRect(posX, posY);
    this.popper.update();
  }

  showMenu() {
    // First hide any submenus that might have been open (e.g. a user opened a context menu,
    // hovered over a submenu, then opened a new context menu)
    this.hideAllSubMenus();
    this.contextMenu.style.display = 'block';
  }

  hideMenu() {
    this.contextMenu.style.display = 'none';
    this.hideAllSubMenus();
  }

  showGroupByRelSubMenu() {
    this.hideAllSubMenus();

    const contextMenuItem = document.querySelector('#group-by-rel-menu-item');
    const tooltip = document.querySelector('#group-1-submenu') as HTMLElement;
    tooltip.style.display = 'block';
    createPopper(contextMenuItem, tooltip, {
      modifiers: [
        {
          name: 'offset',
          options: {
            offset: [0, 0],
          },
        },
      ],
      placement: 'right-start',
    });
  }

  hideAllSubMenus() {
    this.subMenus.forEach(subMenu => {
      const tooltip = document.querySelector(`#${subMenu}`) as HTMLElement;
      tooltip.style.display = 'none';
    });

  }
}
