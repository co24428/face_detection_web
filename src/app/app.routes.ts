import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { WebcamComponent } from './pages/webcam/webcam.component';
import { DetectFaceComponent } from './pages/detect-face/detect-face.component';
import { DetectFaceYolov8sComponent } from './pages/detect-face-yolov8s/detect-face-yolov8s.component';
import { BenchmarkComponent } from './pages/benchmark/benchmark.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Home' },
  { path: 'webcam', component: WebcamComponent, title: 'Webcam' },
  { path: 'detect-face', component: DetectFaceComponent, title: 'Detect Face YOLOv8n' },
  { path: 'detect-face-yolov8s', component: DetectFaceYolov8sComponent, title: 'Detect Face YOLOv8s' },
  { path: 'benchmark', component: BenchmarkComponent, title: 'Benchmark' },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule { }
