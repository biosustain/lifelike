import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminPanelComponent } from 'app/admin/containers/admin-panel-page.component';
import { UserFileImportComponent } from 'app/user-file-import/components/user-file-import.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization/visualization.component';
import { SearchCollectionPageComponent } from 'app/search/containers/search-collection-page.component';
import { FileBrowserComponent } from 'app/file-browser/file-browser.component';
import { LoginComponent } from 'app/auth/components/login.component';
import { LifelikeHomePageComponent } from 'app/home/components/lifelike-home.component';

import { routes as dtRoutes } from './drawing-tool/drawing-tool.module';
import { AdminGuard } from 'app/admin/services/admin-guard.service';
import { AuthGuard } from 'app/auth/guards/auth-guard.service';
import { LoginGuard } from 'app/auth/guards/login-guard.service';
import { PdfViewerComponent } from 'app/drawing-tool/pdf-viewer/pdf-viewer.component';
import { UserSettingsComponent } from 'app/users/components/user-settings.component';

// TODO: Add an unprotected home page
const routes: Routes = [
  { path: '', component: LifelikeHomePageComponent},
  { path: 'admin', component: AdminPanelComponent, canActivate: [AdminGuard]},
  { path: 'neo4j-upload', component: UserFileImportComponent, canActivate: [AuthGuard]},
  { path: 'neo4j-visualizer', component: VisualizationComponent, canActivate: [AuthGuard]},
  { path: 'login', component: LoginComponent, canActivate: [LoginGuard] },
  { path: 'users/:user', component: UserSettingsComponent, canActivate: [AuthGuard] },
  { path: 'search', component: SearchCollectionPageComponent },
  // Used as a work-around for navigation to work when navigating with
  // changing queries
  { path: 'search/:redirect', component: SearchCollectionPageComponent },
  {
    path: 'dt',
    canActivate: [AuthGuard],
    children: dtRoutes
    // TODO - Bring back once pdf-viewer source code integration is resolved
    // loadChildren: () => import(
    //   './drawing-tool/drawing-tool.module'
    // ).then(m => m.DrawingToolModule)
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
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
