/* detection.js - Detección de parpadeos y análisis facial */
let camera = null; // Cámara compartida
let detectionState = {
    blinkCount: 0,
    blinkStartTime: Date.now(),
    lastBlinkTime: 0,
    earHistory: [],
    baselineSamples: [],
    baselineEMA: null,
    initialCalibrationDone: false,
    state: 'open',
    closedFrameCounter: 0,
    prevSmoothedEAR: 0
};

// Función para iniciar la detección
export async function startDetection(rol, videoElement, canvasElement, estado) {
    if (!videoElement || !canvasElement || !estado) return;
    const isDev = rol === 'Dev';

    const canvasCtx = canvasElement.getContext('2d');

    // Parámetros de detección
    const SMOOTHING_WINDOW = 5;
    const BASELINE_FRAMES_INIT = 60;
    const EMA_ALPHA = 0.03;
    const BASELINE_MULTIPLIER = 0.62;
    const CLOSED_FRAMES_THRESHOLD = 1;
    const MIN_TIME_BETWEEN_BLINKS = 150;
    const DERIVATIVE_THRESHOLD = -0.0025;

    function toPixel(l) { return { x: l.x * canvasElement.width, y: l.y * canvasElement.height }; }
    function dist(a,b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function movingAverage(arr) { return arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : 0; }
    function median(arr) { if (!arr.length) return 0; const a=[...arr].sort((x,y)=>x-y); const m=Math.floor(a.length/2); return arr.length%2===0?(a[m-1]+a[m])/2:a[m]; }
    function calculateEAR_px(landmarks, indices) {
        const [p0,p1,p2,p3,p4,p5] = indices.map(i => toPixel(landmarks[i]));
        const vertical1 = dist(p1,p5), vertical2 = dist(p2,p4), horizontal = dist(p0,p3);
        if(horizontal===0) return 0;
        return (vertical1 + vertical2) / (2.0 * horizontal);
    }

    const RIGHT_EYE_IDX = [33,160,158,133,153,144];
    const LEFT_EYE_IDX  = [362,385,387,263,373,380];

    const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
    faceMesh.setOptions({ maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.55, minTrackingConfidence:0.55 });

    faceMesh.onResults((results) => {
        if (!results.image) return;

        if (isDev) {
            canvasElement.width = results.image.width || canvasElement.width;
            canvasElement.height = results.image.height || canvasElement.height;

            canvasCtx.save();
            canvasCtx.clearRect(0,0,canvasElement.width,canvasElement.height);
            canvasCtx.drawImage(results.image,0,0,canvasElement.width,canvasElement.height);
        }

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length>0) {
            const lm = results.multiFaceLandmarks[0];

            if (isDev) {
                drawConnectors(canvasCtx,lm,FACEMESH_TESSELATION,{color:'#00C853',lineWidth:0.5});
                drawConnectors(canvasCtx,lm,FACEMESH_RIGHT_EYE,{color:'#FF5722',lineWidth:1});
                drawConnectors(canvasCtx,lm,FACEMESH_LEFT_EYE,{color:'#FF5722',lineWidth:1});
            }

            const rightEAR_px = calculateEAR_px(lm,RIGHT_EYE_IDX);
            const leftEAR_px = calculateEAR_px(lm,LEFT_EYE_IDX);
            const ear_px = (rightEAR_px+leftEAR_px)/2;

            const xs = lm.map(p=>p.x*canvasElement.width);
            const faceWidthPx = Math.max(...xs)-Math.min(...xs);
            const ear_rel = faceWidthPx>0 ? ear_px/faceWidthPx : ear_px;

            // Calibración inicial
            if(!detectionState.initialCalibrationDone){
                if(ear_rel>0) detectionState.baselineSamples.push(ear_rel);
                const remaining = Math.max(0, BASELINE_FRAMES_INIT-detectionState.baselineSamples.length);
                estado.innerHTML = `<p>✅ Rostro detectado — calibrando... (${remaining} frames)</p>
                                    <p>Parpadeos: ${detectionState.blinkCount}</p>`;
                if(detectionState.baselineSamples.length>=BASELINE_FRAMES_INIT){
                    detectionState.baselineEMA = median(detectionState.baselineSamples);
                    if(detectionState.baselineEMA<=0) detectionState.baselineEMA=0.01;
                    detectionState.initialCalibrationDone = true;
                }
                if(isDev) canvasCtx.restore();
                return;
            }

            // Actualización EAR
            detectionState.earHistory.push(ear_rel);
            if(detectionState.earHistory.length>SMOOTHING_WINDOW) detectionState.earHistory.shift();
            const smoothedEAR = movingAverage(detectionState.earHistory);
            const derivative = smoothedEAR - detectionState.prevSmoothedEAR;
            detectionState.prevSmoothedEAR = smoothedEAR;

            detectionState.baselineEMA = detectionState.baselineEMA===null?smoothedEAR:(EMA_ALPHA*smoothedEAR+(1-EMA_ALPHA)*detectionState.baselineEMA);
            if(!detectionState.baselineEMA || detectionState.baselineEMA<=0)detectionState.baselineEMA=0.01;

            const EAR_THRESHOLD = detectionState.baselineEMA*BASELINE_MULTIPLIER;
            const rapidDrop = derivative<DERIVATIVE_THRESHOLD;
            const consideredClosed = (smoothedEAR<EAR_THRESHOLD)||rapidDrop;

            const now = Date.now();

            if(consideredClosed){
                detectionState.closedFrameCounter++;
                if(detectionState.state==='open' && detectionState.closedFrameCounter>=CLOSED_FRAMES_THRESHOLD) detectionState.state='closed';
            }else{
                if(detectionState.state==='closed'){
                    if(now-detectionState.lastBlinkTime>MIN_TIME_BETWEEN_BLINKS){
                        detectionState.blinkCount++;
                        detectionState.lastBlinkTime = now;
                    }
                    detectionState.state='open';
                }
                detectionState.closedFrameCounter=0;
            }

            const elapsedMinutes = (now-detectionState.blinkStartTime)/60000;
            if(elapsedMinutes>=1){
                detectionState.blinkCount=0;
                detectionState.blinkStartTime=now;
            }
            const bpm = (detectionState.blinkCount/(elapsedMinutes||1)).toFixed(1);

            estado.innerHTML = `<p>✅ Rostro detectado</p>
                                <p>Parpadeos: ${detectionState.blinkCount}</p>
                                <p>Parpadeos por minuto: ${bpm}</p>
                                <p>EAR(smooth): ${smoothedEAR.toFixed(6)}</p>
                                <p>Baseline EMA: ${detectionState.baselineEMA.toFixed(6)}</p>
                                <p>Umbral: ${EAR_THRESHOLD.toFixed(6)}</p>
                                <p>Derivada: ${derivative.toFixed(6)}</p>`;
        } else {
            estado.innerHTML = `<p>❌ No se detecta rostro</p>`;
        }

        if(isDev) canvasCtx.restore();
    });

    camera = new Camera(videoElement,{
        onFrame: async()=>{await faceMesh.send({image:videoElement})},
        width:480,
        height:360
    });
    camera.start();
}

// Función para detener la detección
export function stopDetection(){
    if(camera){
        camera.stop();
        camera=null;
    }
    // Reset detección si quieres empezar limpio
    detectionState = {
        blinkCount:0,
        blinkStartTime:Date.now(),
        lastBlinkTime:0,
        earHistory:[],
        baselineSamples:[],
        baselineEMA:null,
        initialCalibrationDone:false,
        state:'open',
        closedFrameCounter:0,
        prevSmoothedEAR:0
    };
}
