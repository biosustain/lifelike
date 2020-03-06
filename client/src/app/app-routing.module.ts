import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { Neo4jUploadComponent } from 'app/upload/components/neo4j-upload.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization.component';

import {
  ProjectListViewComponent,
  DrawingToolComponent,
  LoginComponent,
  PdfViewerComponent,
  PendingChangesGuard
} from './drawing-tool';

const routes: Routes = [
  { path: 'neo4j-upload', component: Neo4jUploadComponent },
  { path: 'neo4j-visualizer', component: VisualizationComponent },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'dt/project-list',
    component: ProjectListViewComponent
  },
  {
    path: 'dt/drawing-tool',
    component: DrawingToolComponent,
    canDeactivate: [PendingChangesGuard]
  },
  {
    path: 'dt/pdf-viewer',
    component: PdfViewerComponent
  },
  {
    path: 'dt',
    redirectTo: '/dt/project-list',
    pathMatch: 'full'
  },
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
