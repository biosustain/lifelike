import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminPanelComponent } from 'app/admin/components/admin-panel.component';
import { UserFileImportComponent } from 'app/user-file-import/components/user-file-import.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization/visualization.component';
import { SearchCollectionPageComponent } from 'app/search/containers/search-collection-page.component';
import { FileBrowserComponent } from 'app/file-browser/components/file-browser.component';
import { LoginComponent } from 'app/auth/components/login.component';
import { LifelikeHomePageComponent } from 'app/home/components/***ARANGO_DB_NAME***-home.component';

import { routes as dtRoutes } from './drawing-tool/drawing-tool.module';
import { AdminGuard } from 'app/admin/services/admin-guard.service';
import { AuthGuard } from 'app/auth/guards/auth-guard.service';
import { LoginGuard } from 'app/auth/guards/login-guard.service';
import { PdfViewerComponent } from 'app/drawing-tool/components/pdf-viewer.component';
import { UserSettingsComponent } from 'app/users/components/user-settings.component';
import { KgStatisticsComponent } from './kg-statistics/kg-statistics.component';
import { TermsOfServiceComponent } from './users/components/terms-of-service.component';
import { WorkspaceComponent } from './workspace.component';
import { WorkspaceWelcomeComponent } from './workspace-welcome.component';
import { UnloadConfirmationGuard } from './shared/guards/UnloadConfirmation.guard';

// TODO: Add an unprotected home page
const routes: Routes = [
  {
    path: '',
    component: LifelikeHomePageComponent,
    data: {
      title: 'Dashboard',
    },
  },
  {
    path: 'admin',
    component: AdminPanelComponent,
    canActivate: [AdminGuard],
    data: {
      title: 'Administration',
    },
  },
  {path: 'neo4j-upload', component: UserFileImportComponent, canActivate: [AuthGuard]},
  {
    path: 'neo4j-visualizer',
    component: VisualizationComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'KG Visualizer',
      fontAwesomeIcon: 'search',
    },
  },
  {path: 'login', component: LoginComponent, canActivate: [LoginGuard]},
  {path: 'users/:user', component: UserSettingsComponent, canActivate: [AuthGuard]},
  {path: 'terms-of-service', component: TermsOfServiceComponent},
  {path: 'search', component: SearchCollectionPageComponent},
  // Used as a work-around for navigation to work when navigating with
  // changing queries
  {
    path: 'search/:redirect',
    component: SearchCollectionPageComponent,
    data: {
      title: 'Knowledge Graph Explorer',
    },
  },
  {
    path: 'dt',
    canActivate: [AuthGuard],
    children: dtRoutes,
    data: {
      title: 'Knowledge Reconstruction',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  {
    path: 'pdf-viewer/:file_id',
    component: PdfViewerComponent,
    data: {
      title: 'PDF Viewer',
      fontAwesomeIcon: 'file-pdf',
    },
  },
  {
    path: 'file-browser',
    component: FileBrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'File Browser',
      fontAwesomeIcon: 'folder',
    },
  },
  {
    path: 'kg-statistics',
    component: KgStatisticsComponent,
    data: {
      fontAwesomeIcon: 'tachometer-alt',
    },
  },
  {
    path: 'workspace/:space_id',
    component: WorkspaceComponent,
    data: {
      title: 'Knowledge Reconstruction Workspace',
    },
    canDeactivate: [UnloadConfirmationGuard],
  },
  {
    path: 'welcome',
    component: WorkspaceWelcomeComponent,
    data: {
      title: 'Choose Module',
      fontAwesomeIcon: 'question',
    },
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {
}
