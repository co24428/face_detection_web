import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-webcam',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './webcam.component.html',
  styleUrl: './webcam.component.css'
})
export class WebcamComponent implements OnDestroy {
  @ViewChild('video', { static: true, read: ElementRef })
  videoRef!: ElementRef<HTMLVideoElement>;

  private stream?: MediaStream;
  isRunning = false;
  error = '';

  async start() {
    this.error = '';
    try {
      const videoEl = this.videoRef?.nativeElement as HTMLVideoElement | undefined;
      if (!videoEl) {
        this.error = 'Cannot find video element';
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = this.stream;

      if (typeof (videoEl as any).play === 'function') {
        await videoEl.play();
      }

      this.isRunning = true;
    } catch (e: any) {
      this.error = this.explainError(e);
      this.isRunning = false;
      this.cleanup();
    }
  }

  stop() {
    this.cleanup();
    this.isRunning = false;
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private cleanup() {
    // 스트림 정리
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = undefined;
    }

    const videoEl = this.videoRef?.nativeElement as HTMLVideoElement | undefined;
    if (videoEl) {
      if (typeof (videoEl as any).pause === 'function') {
        try { videoEl.pause(); } catch { }
      }
      videoEl.srcObject = null;
      try { videoEl.currentTime = 0; } catch { }
    }
  }

  private explainError(e: any): string {
    if (!navigator.mediaDevices?.getUserMedia) return 'Not support to camera in this browser';
    if (e?.name === 'NotAllowedError') return 'Denied camera permission';
    if (e?.name === 'NotFoundError') return 'Cannot find camera module';
    if (e?.name === 'NotReadableError') return 'Cannot use camera module (may already used)';
    return 'Error while start on camera';
  }
}