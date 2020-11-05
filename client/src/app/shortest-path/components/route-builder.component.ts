import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-route-builder',
  templateUrl: './route-builder.component.html',
  styleUrls: ['./route-builder.component.scss']
})
export class RouteBuilderComponent implements OnInit {

  routeBuilderContainerClass: string;

  routeBuilderOpen: boolean;

  constructor() {
    this.routeBuilderContainerClass = 'route-builder-container-open';
    this.routeBuilderOpen = true;
  }

  ngOnInit() {
  }

  toggleRouteBuilderOpen() {
    this.routeBuilderOpen = !this.routeBuilderOpen;
    this.routeBuilderContainerClass = this.routeBuilderOpen ? 'route-builder-container-open' : 'route-builder-container-closed';
  }

}
