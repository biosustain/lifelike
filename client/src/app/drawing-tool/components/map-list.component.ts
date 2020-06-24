import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { isEqual, sortBy } from 'lodash';
import { NODE_TYPE_ID, Project, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { Subscription } from 'rxjs';
import { ProjectsService } from 'app/drawing-tool/services';
import { BackgroundTask } from 'app/shared/rxjs/background-task';

@Component({
  selector: 'app-map-list',
  templateUrl: './map-list.component.html',
  styleUrls: ['./map-list.component.scss'],
})
export class MapListComponent implements OnInit, OnDestroy {
  @Input() selectedMap: Project = null;
  @Output() mapCreate = new EventEmitter<any>();
  @Output() mapSelect = new EventEmitter<Project>();
  @Output() mapUpload = new EventEmitter<any>();

  term = '';
  showPersonal = true;
  showCommunity = false;

  /**
   * Used to store the previous set of search parameters for comparison
   * to figure out if the filters have changed.
   */
  private previousSearchParams: SearchParameters;

  projects: Project[] = [];

  readonly refreshTask: BackgroundTask<SearchParameters, {
    projects: Project[],
  }> = new BackgroundTask(args => this.projectService.searchForMaps(args.term, args.filters), {
    initialDelay: 0,
    retryMaxCount: 0,
  });

  private readonly refreshSubscription: Subscription;

  constructor(private readonly projectService: ProjectsService) {
    this.refreshSubscription = this.refreshTask.results$.subscribe(result => {
      this.projects = sortBy(result.result.projects, ['date_modified']);
    });
  }

  ngOnInit(): void {
    this.refresh();
  }

  ngOnDestroy(): void {
    this.refreshSubscription.unsubscribe();
  }

  /**
   * Refresh the project list.
   * @param changeOnly set to true to only refresh if the search params changed
   */
  refresh(changeOnly: boolean = false): void {
    const searchParams = {
      term: this.term.trim(),
      filters: {
        personal: this.showPersonal,
        community: this.showCommunity,
      },
    };
    if (!changeOnly || !isEqual(searchParams, this.previousSearchParams)) {
      this.previousSearchParams = searchParams;
      this.refreshTask.update(this.previousSearchParams);
    }
  }

  /**
   * Select the given map.
   * @param map the map
   */
  select(map: Project) {
    this.mapSelect.emit(map);
  }

  /**
   * Handle the initial dragging of a map.
   * @param event the event
   * @param map the map
   */
  mapDragStarted(event: DragEvent, map: Project) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', map.label);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: map.label,
      label: 'map',
      sub_labels: [],
      data: {
        source: '/dt/map/' + map.id,
      },
    } as Partial<UniversalGraphNode>));
    // TODO: Add text/uri-list for a link
    // TODO: Maybe also add an image?
  }
}

/**
 * Current search parameters.
 */
interface SearchParameters {
  term: string;
  filters: {
    personal: boolean;
    community: boolean;
  };
}
