import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminPanelComponent } from 'app/admin/components/admin-panel.component';
import { UserFileImportComponent } from 'app/user-file-import/components/user-file-import.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization/visualization.component';
import { SearchCollectionPageComponent } from 'app/search/containers/search-collection-page.component';
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
import { MapBrowserComponent } from './drawing-tool/components/map-browser.component';
import { MapEditorComponent } from './drawing-tool/components/map-editor/map-editor.component';
import { MapViewComponent } from './drawing-tool/components/map-view.component';

// TODO: Add an unprotected home page
const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
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
    path: 'kg-visualizer',
    canActivate: [AuthGuard],
    children: [
        {
            path: '',
            redirectTo: 'search',
            pathMatch: 'full',
        },
        {
            path: 'search',
            component: SearchCollectionPageComponent,
            data: {
                title: 'Search',
            },
        },
        {
            path: 'graph',
            component: VisualizationComponent,
            data: {
              title: 'KG Visualizer',
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
    ]
  },
  {
    path: 'workspaces/:space_id',
    component: WorkspaceComponent,
    data: {
      title: 'Knowledge Reconstruction Workspace',
    },
    canDeactivate: [UnloadConfirmationGuard],
  },
  {
    path: 'files',
    component: FileBrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'File Browser',
      fontAwesomeIcon: 'folder',
    },
  },
  {
    path: 'files/:file_id',
    component: FileViewComponent,
    data: {
      title: 'PDF Viewer',
      fontAwesomeIcon: 'file-pdf',
    },
  },
  {
    path: 'maps',
    component: MapBrowserComponent,
    data: {
      title: 'Map Browser',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  {
    path: 'maps/:hash_id/edit',
    component: MapEditorComponent,
    canDeactivate: [UnloadConfirmationGuard],
    data: {
      title: 'Map Editor',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  {
    path: 'maps/:hash_id',
    component: MapViewComponent,
    data: {
      title: 'Map',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  {
    path: 'kg-statistics',
    component: KgStatisticsComponent,
    data: {
      fontAwesomeIcon: 'tachometer-alt',
    },
  },
  // Old links
  {path: 'file-browser', redirectTo: '/files', pathMatch: 'full'},
  {path: 'pdf-viewer/:file_id', redirectTo: '/files/:file_id', pathMatch: 'full'},
  {path: 'dt/map', redirectTo: '/maps', pathMatch: 'full'},
  {path: 'dt/map/:hash_id', redirectTo: '/maps/:hash_id', pathMatch: 'full'},
  {path: 'dt/map/edit/:hash_id', redirectTo: '/maps/:hash_id/edit', pathMatch: 'full'},
  {path: 'neo4j-upload', redirectTo: '/kg-visualizer/upload', pathMatch: 'full'},
  {path: 'neo4j-visualizer', redirectTo: '/kg-visualizer', pathMatch: 'full'},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {
}
