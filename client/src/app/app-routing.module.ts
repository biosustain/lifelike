import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { Neo4jUploadComponent } from 'app/upload/components/neo4j-upload.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization/visualization.component';


const routes: Routes = [
  { path: 'neo4j-upload', component: Neo4jUploadComponent },
  { path: 'neo4j-visualizer', component: VisualizationComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
