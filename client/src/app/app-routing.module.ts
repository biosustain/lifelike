import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { Neo4jUploadComponent } from 'app/upload/components/neo4j-upload.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization.component';
import { SearchCollectionPageComponent } from 'app/search/containers/search-collection-page.component';

import {
  ProjectListViewComponent,
  DrawingToolComponent,
  LoginComponent,
  PdfViewerComponent,
  PendingChangesGuard
} from './drawing-tool';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  { path: 'neo4j-upload', component: Neo4jUploadComponent },
  { path: 'neo4j-visualizer', component: VisualizationComponent },
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
