// ================= UTILIDADES =================

function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function movingAverage(arr) {
    return arr.length
        ? arr.reduce((sum, v) => sum + v, 0) / arr.length
        : 0;
}

function median(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

// ================= EAR =================

function toPixel(landmark, canvas) {
    return {
        x: landmark.x * canvas.width,
        y: landmark.y * canvas.height
    };
}

function calculateEAR_px(landmarks, indices, canvas) {
    const [p0, p1, p2, p3, p4, p5] =
        indices.map(i => toPixel(landmarks[i], canvas));

    const vertical1 = dist(p1, p5);
    const vertical2 = dist(p2, p4);
    const horizontal = dist(p0, p3);

    if (horizontal === 0) return 0;
    return (vertical1 + vertical2) / (2 * horizontal);
}

// ================= CONSTANTES =================

const RIGHT_EYE_IDX = [33, 160, 158, 133, 153, 144];
const LEFT_EYE_IDX  = [362, 385, 387, 263, 373, 380];

// ================= ESTADO =================

export function createBlinkDetector(config = {}) {

    const {
        SMOOTHING_WINDOW = 5,
        BASELINE_FRAMES_INIT = 60,
        EMA_ALPHA = 0.03,
        BASELINE_MULTIPLIER = 0.62,
        CLOSED_FRAMES_THRESHOLD = 1,
        MIN_TIME_BETWEEN_BLINKS = 150,
        DERIVATIVE_THRESHOLD = -0.0025
    } = config;

    let blinkCount = 0;
    let blinkStartTime = Date.now();
    let lastBlinkTime = 0;

    let earHistory = [];
    let baselineSamples = [];
    let baselineEMA = null;
    let initialCalibrationDone = false;

    let state = 'open';
    let closedFrameCounter = 0;
    let prevSmoothedEAR = 0;

    // ================= API PRINCIPAL =================

    function processFrame(landmarks, canvas) {

        const rightEAR = calculateEAR_px(landmarks, RIGHT_EYE_IDX, canvas);
        const leftEAR  = calculateEAR_px(landmarks, LEFT_EYE_IDX, canvas);
        const ear_px   = (rightEAR + leftEAR) / 2;

        const xs = landmarks.map(p => p.x * canvas.width);
        const faceWidthPx = Math.max(...xs) - Math.min(...xs);
        const ear_rel = faceWidthPx > 0 ? ear_px / faceWidthPx : ear_px;

        // ----------- Calibración inicial -----------

        if (!initialCalibrationDone) {
            if (ear_rel > 0) baselineSamples.push(ear_rel);

            if (baselineSamples.length >= BASELINE_FRAMES_INIT) {
                baselineEMA = median(baselineSamples);
                if (baselineEMA <= 0) baselineEMA = 0.01;
                initialCalibrationDone = true;
            }

            return {
                calibrated: false,
                remainingFrames: BASELINE_FRAMES_INIT - baselineSamples.length,
                blinkCount: 0
            };
        }

        // ----------- Suavizado -----------

        earHistory.push(ear_rel);
        if (earHistory.length > SMOOTHING_WINDOW) earHistory.shift();

        const smoothedEAR = movingAverage(earHistory);
        const derivative = smoothedEAR - prevSmoothedEAR;
        prevSmoothedEAR = smoothedEAR;

        baselineEMA =
            EMA_ALPHA * smoothedEAR +
            (1 - EMA_ALPHA) * baselineEMA;

        if (baselineEMA <= 0) baselineEMA = 0.01;

        const EAR_THRESHOLD = baselineEMA * BASELINE_MULTIPLIER;
        const rapidDrop = derivative < DERIVATIVE_THRESHOLD;
        const consideredClosed =
            smoothedEAR < EAR_THRESHOLD || rapidDrop;

        const now = Date.now();

        // ----------- Máquina de estados -----------

        if (consideredClosed) {
            closedFrameCounter++;
            if (state === 'open' && closedFrameCounter >= CLOSED_FRAMES_THRESHOLD) {
                state = 'closed';
            }
        } else {
            if (state === 'closed') {
                if (now - lastBlinkTime > MIN_TIME_BETWEEN_BLINKS) {
                    blinkCount++;
                    lastBlinkTime = now;
                }
                state = 'open';
            }
            closedFrameCounter = 0;
        }

        // ----------- BPM -----------

        const elapsedMinutes = (now - blinkStartTime) / 60000;
        if (elapsedMinutes >= 1) {
            blinkCount = 0;
            blinkStartTime = now;
        }

        const bpm = blinkCount / (elapsedMinutes || 1);

        return {
            calibrated: true,
            blinkCount,
            bpm: Number(bpm.toFixed(1)),
            ear: smoothedEAR,
            baseline: baselineEMA,
            threshold: EAR_THRESHOLD,
            derivative
        };
    }

    // ================= RESET =================

    function reset() {
        blinkCount = 0;
        earHistory = [];
        baselineSamples = [];
        baselineEMA = null;
        initialCalibrationDone = false;
        state = 'open';
        closedFrameCounter = 0;
        prevSmoothedEAR = 0;
        blinkStartTime = Date.now();
        lastBlinkTime = 0;
    }

    return { processFrame, reset };
}
