import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AdminPanelComponent } from 'app/admin/components/admin-panel.component';
import { UserFileImportComponent } from 'app/user-file-import/components/user-file-import.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization/visualization.component';
import { GraphSearchComponent } from 'app/search/components/graph-search.component';
import { FileBrowserComponent } from 'app/file-browser/components/file-browser.component';
import { LoginComponent } from 'app/auth/components/login.component';
import { DashboardComponent } from 'app/dashboard.component';

import { AdminGuard } from 'app/admin/services/admin-guard.service';
import { AuthGuard } from 'app/auth/guards/auth-guard.service';
import { LoginGuard } from 'app/auth/guards/login-guard.service';
import { FileViewComponent } from 'app/file-browser/components/file-view.component';
import { UserSettingsComponent } from 'app/users/components/user-settings.component';
import { KgStatisticsComponent } from './kg-statistics.component';
import { TermsOfServiceComponent } from './users/components/terms-of-service.component';
import { WorkspaceComponent } from './workspace.component';
import { UnloadConfirmationGuard } from './shared/guards/UnloadConfirmation.guard';
import { MapEditorComponent } from './drawing-tool/components/map-editor/map-editor.component';
import { MapViewComponent } from './drawing-tool/components/map-view.component';
import { CommunityBrowserComponent } from './file-browser/components/community-browser.component';
import { BrowserComponent } from './file-browser/components/browser/browser.component';
// import { KgImportWizardComponent } from './kg-import/containers/kg-import-wizard/kg-import-wizard.component';
// import { GeneImportWizardComponent } from './kg-import/containers/gene-import-wizard/gene-import-wizard.component';
import { ContentSearchComponent } from './search/components/content-search.component';
import { EnrichmentTableViewerComponent } from './file-browser/components/enrichment-table-viewer.component';
import { EnrichmentVisualisationViewerComponent } from './file-browser/components/enrichment-visualisation-viewer.component';
import { FileNavigatorComponent } from './file-navigator/file-navigator.component';
import { WordCloudProjectComponent } from './word-cloud/word-cloud-project.component';
import { ShortestPathComponent } from './shortest-path/containers/shortest-path.component';

// TODO: Add an unprotected home page
const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Dashboard',
      fontAwesomeIcon: 'home',
    },
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Dashboard',
      fontAwesomeIcon: 'home',
    },
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [LoginGuard],
    data: {
      title: 'Login',
      fontAwesomeIcon: 'sign-in-alt',
    },
  },
  {
    path: 'terms-of-service',
    component: TermsOfServiceComponent,
    data: {
      title: 'Terms of Service',
    },
  },
  {
    path: 'admin',
    component: AdminPanelComponent,
    canActivate: [AdminGuard],
    data: {
      title: 'Administration',
      fontAwesomeIcon: 'cog',
    },
  },
  {
    path: 'users/:user',
    component: UserSettingsComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Profile',
      fontAwesomeIcon: 'user-circle',
    },
  },
  {
    path: 'search/graph',
    component: GraphSearchComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Visualizer',
      fontAwesomeIcon: 'search',
    },
  },
  {
    path: 'search/content',
    canActivate: [AuthGuard],
    component: ContentSearchComponent,
    data: {
      title: 'Search',
      fontAwesomeIcon: 'search',
    },
  },
  {
    path: 'pathway-browser-prototype',
    canActivate: [AuthGuard],
    component: ShortestPathComponent,
  },
  {
    path: 'projects/:project_name/enrichment-table/:file_id',
    canActivate: [AuthGuard],
    component: EnrichmentTableViewerComponent,
    data: {
      title: 'Enrichment Table',
      fontAwesomeIcon: 'table',
    },
  },
  {
    path: 'projects/:project_name/enrichment-visualisation/:file_id',
    canActivate: [AuthGuard],
    component: EnrichmentVisualisationViewerComponent,
    data: {
      title: 'Enrichment Visualisation',
      fontAwesomeIcon: 'chart-bar',
    },
  },
  {
    path: 'kg-visualizer',
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: '/search',
        pathMatch: 'full',
        canActivate: [AuthGuard],
      },
      {
        path: 'graph',
        component: VisualizationComponent,
        canActivate: [AuthGuard],
        data: {
          title: 'Visualizer',
          fontAwesomeIcon: 'search',
        },
      },
      {
        path: 'upload',
        component: UserFileImportComponent,
        canActivate: [AuthGuard],
        data: {
          title: 'KG Visualizer Upload',
          fontAwesomeIcon: 'search',
        },
      },
    ],
  },
  {
    path: 'workspaces/:space_id',
    component: WorkspaceComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Workbench',
    },
    canDeactivate: [UnloadConfirmationGuard],
  },
  {
    path: 'community',
    component: CommunityBrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Community Content',
      fontAwesomeIcon: 'globe',
    },
  },
  {
    path: 'projects',
    component: BrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Browser',
      fontAwesomeIcon: 'layer-group',
    },
  },
  {
    path: 'projects/:project_name',
    component: FileBrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Projects',
      fontAwesomeIcon: 'layer-group',
    },
  },
  {
    path: 'projects/:project_name/folders',
    redirectTo: 'projects/:project_name',
    pathMatch: 'full',
  },
  {
    path: 'projects/:project_name/folders/:dir_id',
    component: FileBrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Projects',
      fontAwesomeIcon: 'layer-group',
    },
  },
  {
    path: 'projects/:project_name/files/:file_id',
    component: FileViewComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'PDF Viewer',
      fontAwesomeIcon: 'file-pdf',
    },
  },
  {
    path: 'projects/:project_name/maps/:hash_id',
    canActivate: [AuthGuard],
    component: MapViewComponent,
    data: {
      title: 'Map',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  {
    path: 'projects/:project_name/maps/:hash_id/edit',
    component: MapEditorComponent,
    canActivate: [AuthGuard],
    canDeactivate: [UnloadConfirmationGuard],
    data: {
      title: 'Map Editor',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  /* TODO Refactor import
  {
    path: 'kg-import',
    canActivate: [AuthGuard],
    children: [
      {path: '', component: KgImportWizardComponent},
      {path: 'genes', component: GeneImportWizardComponent},
    ],
  },
  */
  {
    path: 'kg-statistics',
    component: KgStatisticsComponent,
    canActivate: [AuthGuard],
    data: {
      fontAwesomeIcon: 'tachometer-alt',
    },
  },
  {
    path: 'file-navigator/:project_name/:file_id',
    component: FileNavigatorComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'File Navigator',
      fontAwesomeIcon: 'fas fa-compass',
    },
  },
  {
    path: 'entity-cloud/:project_name',
    component: WordCloudProjectComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Project Entity Cloud',
      fontAwesomeIcon: 'fas fa-compass',
    }
  },
  // Old links
  {path: 'file-browser', redirectTo: 'projects', pathMatch: 'full'},
  {path: 'pdf-viewer/:file_id', redirectTo: 'projects/beta-project/files/:file_id', pathMatch: 'full'},
  {path: 'dt/map', redirectTo: 'projects', pathMatch: 'full'},
  {path: 'dt/map/:hash_id', redirectTo: 'projects/beta-project/maps/maps/:hash_id', pathMatch: 'full'},
  {path: 'dt/map/edit/:hash_id', redirectTo: 'projects/beta-project/maps/:hash_id/edit', pathMatch: 'full'},
  {path: 'neo4j-upload', redirectTo: 'kg-visualizer/upload', pathMatch: 'full'},
  {path: 'neo4j-visualizer', redirectTo: 'kg-visualizer', pathMatch: 'full'},
  {path: 'search', redirectTo: 'search/graph', pathMatch: 'full'},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {
}
