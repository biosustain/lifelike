// Copy instead based on: https://github.com/ng-bootstrap/ng-bootstrap/issues/2632
// import { PlacementArray } from '@ng-bootstrap/ng-bootstrap/util/positioning';
declare type Placement = 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left-top' | 'left-bottom' | 'right-top' | 'right-bottom';
declare type PlacementArray = Placement | Array<Placement> | string;
