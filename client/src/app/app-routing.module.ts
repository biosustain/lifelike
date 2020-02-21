import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { UserFileImportComponent } from 'app/user-file-import/components/user-file-import.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization.component';


const routes: Routes = [
  { path: 'neo4j-upload', component: UserFileImportComponent },
  { path: 'neo4j-visualizer', component: VisualizationComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
