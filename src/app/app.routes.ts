import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { WebcamComponent } from './pages/webcam/webcam.component';
import { DetectFaceComponent } from './pages/detect-face/detect-face.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Home' },
  { path: 'webcam', component: WebcamComponent, title: 'Webcam' },
  { path: 'detect-face', component: DetectFaceComponent, title: 'Detect Face' },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule { }
