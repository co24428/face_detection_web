import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppRoutingModule } from './app.routes';
import { AppComponent } from './app.component';

import { MenuBarComponent } from './menu-bar/menu-bar.component';
import { HomeComponent } from './pages/home/home.component';
import { WebcamComponent } from './pages/webcam/webcam.component';
import { DetectFaceComponent } from './pages/detect-face/detect-face.component';

@NgModule({
    declarations: [
    ],
    imports: [CommonModule, AppRoutingModule,
        MenuBarComponent,
        HomeComponent,
        WebcamComponent,
        DetectFaceComponent,],
})

export class AppModule { }