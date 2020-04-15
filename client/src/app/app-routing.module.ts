import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminPanelComponent } from 'app/admin/containers/admin-panel-page.component';
import { UserFileImportComponent } from 'app/user-file-import/components/user-file-import.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization/visualization.component';
import { SearchCollectionPageComponent } from 'app/search/containers/search-collection-page.component';
import { FileBrowserComponent } from 'app/file-browser/file-browser.component';
import { KgStatisticsComponent } from './kg-statistics/kg-statistics.component';
import { LoginComponent } from 'app/auth/components/login.component';
import { LifelikeHomePageComponent } from 'app/home/components/***ARANGO_DB_NAME***-home.component';
import { UserSettingsComponent } from 'app/users/components/user-settings.component';

import {
  ProjectListViewComponent,
  DrawingToolComponent,
  PdfViewerComponent,
  PendingChangesGuard
} from './drawing-tool';
import {
  SplitterComponent
} from './drawing-tool/splitter/splitter.component';

import { AdminGuard } from 'app/admin/services/admin-guard.service';
import { AuthGuard } from 'app/auth/guards/auth-guard.service';
import { LoginGuard } from 'app/auth/guards/login-guard.service';

// TODO: Add an unprotected home page
const routes: Routes = [
  { path: '', component: LifelikeHomePageComponent},
  { path: 'admin', component: AdminPanelComponent, canActivate: [AdminGuard]},
  { path: 'neo4j-upload', component: UserFileImportComponent, canActivate: [AuthGuard]},
  { path: 'neo4j-visualizer', component: VisualizationComponent, canActivate: [AuthGuard]},
  { path: 'login', component: LoginComponent, canActivate: [LoginGuard] },
  { path: 'search', component: SearchCollectionPageComponent },
  {
    path: 'users/:user',
    component: UserSettingsComponent,
    canActivate: [AuthGuard],
    data: { group: 'SELF' },
  },
  // Used as a work-around for navigation to work when navigating with
  // changing queries
  { path: 'search/:redirect', component: SearchCollectionPageComponent },
  {
    path: 'dt',
    canActivate: [AuthGuard],
    children: [
      {
        path: 'project-list',
        component: ProjectListViewComponent
      },
      {
        path: 'drawing-tool',
        component: DrawingToolComponent,
        canDeactivate: [PendingChangesGuard]
      },
      {
        path: 'splitter',
        component: SplitterComponent
      }
    ],
  },
  {
    path: 'pdf-viewer',
    component: PdfViewerComponent
  },
  {
    path: 'file-browser',
    component: FileBrowserComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'kg-statistics',
    component: KgStatisticsComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
