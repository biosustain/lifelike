import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminPanelComponent } from 'app/admin/containers/admin-panel-page.component';
import { UserFileImportComponent } from 'app/user-file-import/components/user-file-import.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization.component';
import { SearchCollectionPageComponent } from 'app/search/containers/search-collection-page.component';

import {
  ProjectListViewComponent,
  DrawingToolComponent,
  LoginComponent,
  PdfViewerComponent,
  PendingChangesGuard
} from './drawing-tool';

import { AdminGuard } from 'app/admin/services/admin-guard.service';

const routes: Routes = [
  { path: 'admin', component: AdminPanelComponent, canActivate: [AdminGuard]},
  { path: 'neo4j-upload', component: UserFileImportComponent },
  { path: 'neo4j-visualizer', component: VisualizationComponent },
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  { path: 'search', component: SearchCollectionPageComponent },
  // Used as a work-around for navigation to work when navigating with
  // changing queries
  { path: 'search/:redirect', component: SearchCollectionPageComponent },
  {
    path: 'dt',
    children: [
      {
        path: 'project-list',
        component: ProjectListViewComponent
      },
      {
        path: 'drawing-tool',
        component: DrawingToolComponent,
        canDeactivate: [PendingChangesGuard]
      }
    ],
  },
  {
    path: 'pdf-viewer',
    component: PdfViewerComponent
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
