import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { isEqual, sortBy } from 'lodash';
import {NODE_TYPE_ID, Project, UniversalGraphNode} from 'app/drawing-tool/services/interfaces';
import { Subscription } from 'rxjs';
import { ProjectsService } from 'app/drawing-tool/services';
import { BackgroundTask } from 'app/shared/rxjs/background-task';

type SortColumn = 'name' | 'date_modified';

interface SearchParameters {
  term: string;
  filters: {
    personal: boolean;
    community: boolean;
  };
}

@Component({
  selector: 'app-map-list',
  templateUrl: './map-list.component.html',
  styleUrls: ['./map-list.component.scss']
})
export class MapListComponent implements OnInit, OnDestroy {
  @Input() childMode = false;
  @Input() selectedProject: Project = null;
  @Output() projectAPICaller: EventEmitter<any> = new EventEmitter();

  sortColumn: SortColumn = 'name';
  term = '';
  showPersonal = true;
  showCommunity = false;

  /**
   * Used to store the previous set of search parameters for comparison
   * to figure out if the filters have changed.
   */
  private previousSearchParams: SearchParameters;

  @Input() templateView = false;
  projects: Project[] = [];
  private readonly refreshSubscription: Subscription;
  readonly refreshTask: BackgroundTask<SearchParameters, {
    projects: Project[],
  }> = new BackgroundTask(args => this.projectService.searchForMaps(args.term, args.filters), {
    initialDelay: 0,
    retryMaxCount: 0,
  });

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
        community: this.showCommunity
      }
    };
    if (!changeOnly || !isEqual(searchParams, this.previousSearchParams)) {
      this.previousSearchParams = searchParams;
      this.refreshTask.update(this.previousSearchParams);
    }
  }

  clickProject(action: string, project: Project) {
    this.projectAPICaller.emit({
      action,
      project
    });
  }

  createNodeDropData(project: Project) {
    return {
      type: NODE_TYPE_ID,
      node: {
        display_name: project.label,
        label: 'map',
        sub_labels: [],
        data: {
          source: '/dt/map/' + project.id,
        }
      } as Partial<UniversalGraphNode>,
    };
  }
}
