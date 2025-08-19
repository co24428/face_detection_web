import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import * as ort from 'onnxruntime-web';

@Component({
  selector: 'app-detect-face',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './detect-face.component.html',
  styleUrls: ['./detect-face.component.css']
})
export class DetectFaceComponent implements OnDestroy {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) { }
  get isBrowser() { return isPlatformBrowser(this.platformId); }

  @ViewChild('video', { static: false }) videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasBg', { static: false }) canvasBgRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasOv', { static: false }) canvasOvRef?: ElementRef<HTMLCanvasElement>;

  private stream?: MediaStream;
  private session?: ort.InferenceSession;

  // Divide loop for render & inference
  private rafId?: number;
  private running = false;
  private busy = false;   // Allow only one inference
  isRunning = false;
  error = '';

  // Model parameter (adjustable)
  private modelPath = '/assets/yolov8n-face-lindevs.onnx';
  private inputName = 'images';
  private inputSize = 640;
  private confThresh = 0.3;
  private iouThresh = 0.45;

  // Result of inference
  private lastBoxes: { x1: number; y1: number; x2: number; y2: number; score: number }[] = [];

  async start() {
    if (!this.isBrowser) return;

    const videoEl = this.videoRef?.nativeElement;
    const bgEl = this.canvasBgRef?.nativeElement;
    const ovEl = this.canvasOvRef?.nativeElement;
    if (!videoEl || !bgEl || !ovEl) { this.error = 'View component is not ready'; return; }

    try {
      // Start webcam(camera)
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      videoEl.srcObject = this.stream;

      await new Promise<void>(res => videoEl.addEventListener('loadedmetadata', () => res(), { once: true }));
      await videoEl.play();

      // Set canvas and video size same
      [bgEl.width, bgEl.height] = [videoEl.videoWidth || 640, videoEl.videoHeight || 480];
      [ovEl.width, ovEl.height] = [bgEl.width, bgEl.height];

      // onnxruntime-web environment (once before creation session)
      ort.env.wasm.wasmPaths = '/assets/ort/';
      ort.env.wasm.numThreads = 1; // recommend 1 thread, if without "COOP/COEP"
      ort.env.wasm.proxy = true;

      // Session for inference (Precheck 404/HTML by byte loading)
      if (!this.session) {
        const resp = await fetch(this.modelPath);
        if (!resp.ok) throw new Error(`Model HTTP ${resp.status}`);
        const bytes = new Uint8Array(await resp.arrayBuffer());
        this.session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
      }

      this.running = true;
      this.isRunning = true;
      this.renderLoop(); // Every frame video and bounding box render
      this.inferLoop();  // Asynchonous inference loop
    } catch (e: any) {
      this.error = e?.message ?? 'Error';
      this.stop();
    }
  }

  stop() {
    if (!this.isBrowser) return;

    this.running = false;
    this.isRunning = false;

    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = undefined;
    }

    const v = this.videoRef?.nativeElement;
    if (v && typeof (v as any).pause === 'function') {
      try { v.pause(); } catch { }
      (v as any).srcObject = null;
    }

    // Set default canvas
    const bg = this.canvasBgRef?.nativeElement;
    const ov = this.canvasOvRef?.nativeElement;
    bg?.getContext('2d')?.clearRect(0, 0, bg.width, bg.height);
    ov?.getContext('2d')?.clearRect(0, 0, ov.width, ov.height);

    this.lastBoxes = [];
    this.busy = false;
  }

  ngOnDestroy() { this.stop(); }

  private renderLoop = () => {
    if (!this.running) return;

    const video = this.videoRef?.nativeElement;
    const bg = this.canvasBgRef?.nativeElement;
    const ov = this.canvasOvRef?.nativeElement;

    if (video && bg && ov && video.readyState >= 2) {
      // Set background
      const bgCtx = bg.getContext('2d')!;
      bgCtx.drawImage(video, 0, 0, bg.width, bg.height);

      // Render boundingbox to background
      const ovCtx = ov.getContext('2d')!;
      ovCtx.clearRect(0, 0, ov.width, ov.height);
      ovCtx.lineWidth = 2;
      ovCtx.font = '12px system-ui';

      for (const b of this.lastBoxes) {
        const w = b.x2 - b.x1, h = b.y2 - b.y1;
        ovCtx.strokeStyle = '#00e676';
        ovCtx.fillStyle = 'rgba(0,230,118,0.15)';
        ovCtx.strokeRect(b.x1, b.y1, w, h);
        ovCtx.fillRect(b.x1, b.y1, w, h);

        const label = `face ${(b.score * 100).toFixed(0)}%`;
        const tw = ovCtx.measureText(label).width + 8;
        const th = 18;
        ovCtx.fillStyle = '#00e676';
        ovCtx.fillRect(b.x1, Math.max(0, b.y1 - th), tw, th);
        ovCtx.fillStyle = '#000';
        ovCtx.fillText(label, b.x1 + 4, Math.max(12, b.y1 - 6));
      }
    }

    this.rafId = requestAnimationFrame(this.renderLoop);
  };

  private async inferLoop() {
    if (!this.running || !this.session) return;
    if (this.busy) { requestAnimationFrame(() => this.inferLoop()); return; }
    this.busy = true;

    try {
      const video = this.videoRef?.nativeElement;
      const ov = this.canvasOvRef?.nativeElement;
      if (video && ov && video.readyState >= 2) {
        // Preprocesing: Video, 640x640 RGB CHW float32
        const S = this.inputSize;
        const tmp = document.createElement('canvas');
        tmp.width = S; tmp.height = S;
        const tctx = tmp.getContext('2d')!;
        tctx.drawImage(video, 0, 0, S, S);
        const img = tctx.getImageData(0, 0, S, S).data;

        const data = new Float32Array(3 * S * S);
        let i = 0;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const idx = (y * S + x) * 4;
          data[i] = img[idx] / 255;
          data[i + S * S] = img[idx + 1] / 255;
          data[i + 2 * S * S] = img[idx + 2] / 255;
          i++;
        }
        const tensor = new ort.Tensor('float32', data, [1, 3, S, S]);

        const outMap = await this.session.run({ [this.inputName]: tensor });

        // Show log for debugging
        // if (!(this as any)._loggedOnce) {
        //   const keys = Object.keys(outMap);
        //   const first = outMap[keys[0]] as ort.Tensor;
        //   console.log('[YOLO] output keys:', keys);
        //   console.log('[YOLO] dims:', first.dims, 'type:', first.type);
        //   console.log('[YOLO] length:', first.data.length);
        //   console.log('[YOLO] sample[0:40]:', Array.from(first.data as any).slice(0, 40));
        //   (this as any)._loggedOnce = true;
        // }

        const out = outMap[Object.keys(outMap)[0]] as ort.Tensor;

        // Decoding, update result
        this.lastBoxes = this.decodeYolo(out, ov.width, ov.height);
      }
    } catch (e) {
      console.warn('infer error', e);
    } finally {
      this.busy = false;
      // 추론 주기 조절 (너무 바쁘면 30~100ms 정도로 올려도 됨)
      // manage render speed ( set 30-100ms if too busy )
      setTimeout(() => this.inferLoop(), 0);
    }
  }

  // ----- 디코더/NMS 동일 (dims [1,5,8400] 가정) -----
  // ----- decoder/NMS (dims [1,5,8400]) -----
  private iou(a: { x1: number; y1: number; x2: number; y2: number },
    b: { x1: number; y1: number; x2: number; y2: number }) {
    const xx1 = Math.max(a.x1, b.x1);
    const yy1 = Math.max(a.y1, b.y1);
    const xx2 = Math.min(a.x2, b.x2);
    const yy2 = Math.min(a.y2, b.y2);
    const w = Math.max(0, xx2 - xx1);
    const h = Math.max(0, yy2 - yy1);
    const inter = w * h;
    const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
    const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
    const uni = areaA + areaB - inter + 1e-6;
    return inter / uni;
  }

  private nms(
    boxes: { x1: number; y1: number; x2: number; y2: number; score: number }[],
    iouThresh = this.iouThresh
  ) {
    boxes.sort((a, b) => b.score - a.score);
    const keep: typeof boxes = [];
    for (const b of boxes) {
      if (!keep.some(k => this.iou(k, b) > iouThresh)) keep.push(b);
    }
    return keep;
  }

  private decodeYolo(out: ort.Tensor, frameW: number, frameH: number) {
    const data = out.data as Float32Array;     // len = 1*5*8400
    const [B, C, N] = out.dims;                // [1,5,8400]
    if (B !== 1 || C < 5) return [];

    const inputSz = this.inputSize;
    const scaleX = frameW / inputSz;
    const scaleY = frameH / inputSz;

    const x1o = 0 * N, y1o = 1 * N, x2o = 2 * N, y2o = 3 * N, sco = 4 * N;
    const boxes: { x1: number; y1: number; x2: number; y2: number; score: number }[] = [];

    for (let i = 0; i < N; i++) {
      let x1 = data[x1o + i];
      let y1 = data[y1o + i];
      let x2 = data[x2o + i];
      let y2 = data[y2o + i];
      const score = data[sco + i];

      if (score < this.confThresh) continue;

      // pixel coordinate, apply scale
      x1 *= scaleX; y1 *= scaleY; x2 *= scaleX; y2 *= scaleY;

      // cx,cy,w,h
      if (x2 < x1 || y2 < y1) {
        const cx = x1, cy = y1, w = x2, h = y2;
        x1 = (cx - w / 2); y1 = (cy - h / 2);
        x2 = (cx + w / 2); y2 = (cy + h / 2);
      }

      x1 = Math.max(0, Math.min(frameW, x1));
      y1 = Math.max(0, Math.min(frameH, y1));
      x2 = Math.max(0, Math.min(frameW, x2));
      y2 = Math.max(0, Math.min(frameH, y2));

      if (x2 - x1 > 2 && y2 - y1 > 2) boxes.push({ x1, y1, x2, y2, score });
    }

    return this.nms(boxes);
  }
}
