// ───────────────────────────────────────────
//  설정값 — 여기만 바꾸면 감도 조절 가능
// ───────────────────────────────────────────
const BLOW_THRESHOLD       = 0.15;  // 이 이상이면 불꽃 흔들림 시작
const EXTINGUISH_THRESHOLD = 0.35;  // 이 이상이면 촛불 꺼짐

// ───────────────────────────────────────────
//  상태 변수
// ───────────────────────────────────────────
let audioCtx  = null;
let analyser  = null;
let micStream = null;
let animFrame = null;
let isRunning = false;
let isBlown   = false;
let startTime = null;

// ───────────────────────────────────────────
//  DOM 참조
// ───────────────────────────────────────────
const flame        = document.getElementById('flame');
const flameWrap    = document.getElementById('flame-wrap');
const micBar       = document.getElementById('mic-bar');
const startBtn     = document.getElementById('start-btn');
const timerEl      = document.getElementById('timer');
const topText      = document.getElementById('top-text');
const resultScreen = document.getElementById('result-screen');
const resultRecord = document.getElementById('result-record');
const pCanvas      = document.getElementById('particle-canvas');
const pCtx         = pCanvas.getContext('2d');

// ───────────────────────────────────────────
//  마이크 시작
// ───────────────────────────────────────────
startBtn.addEventListener('click', async () => {
  if (isRunning) return;

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    audioCtx.createMediaStreamSource(micStream).connect(analyser);

    isRunning = true;
    startTime = Date.now();

    // 버튼 → 레벨 바로 전환
    startBtn.style.display = 'none';
    document.getElementById('mic-bar-wrap').classList.add('active');

    topText.textContent = '초를 힘껏 불어주세요!';

    tick();
  } catch (e) {
    topText.textContent = '마이크 권한을 허용해주세요.';
  }
});

// ───────────────────────────────────────────
//  메인 루프 — 매 프레임 볼륨 읽고 불꽃 제어
// ───────────────────────────────────────────
function tick() {
  if (!isRunning || isBlown) return;

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  // 평균 볼륨 0~1 로 정규화
  const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;

  // 타이머 업데이트
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  timerEl.textContent = `⏱ ${elapsed}s`;

  // 마이크 레벨 바 (시각적 피드백)
  micBar.style.width = Math.min(avg * 3 * 100, 100) + '%';

  if (avg > EXTINGUISH_THRESHOLD) {
    extinguish(elapsed);
    return;
  }

  if (avg > BLOW_THRESHOLD) {
    applyBlowEffect(avg);
  } else {
    resetFlame();
  }

  animFrame = requestAnimationFrame(tick);
}

// ───────────────────────────────────────────
//  불꽃 반응: 바람 세기에 따라 늘어나고 기울어짐
// ───────────────────────────────────────────
function applyBlowEffect(avg) {
  // t: 0(약한 바람) ~ 1(꺼지기 직전)
  const t = (avg - BLOW_THRESHOLD) / (EXTINGUISH_THRESHOLD - BLOW_THRESHOLD);

  const scaleX   = 1 + t * 0.6;       // 옆으로 퍼짐
  const scaleY   = 1 - t * 0.35;      // 세로 줄어듦
  const skewDeg  = t * 20;            // 기울기
  const rotate   = -skewDeg * 0.5;

  flame.classList.add('blown');
  flame.style.transform      = `scaleX(${scaleX}) scaleY(${scaleY}) rotate(${rotate}deg)`;
  flame.style.opacity        = String(1 - t * 0.3);
  flameWrap.style.transform  = `rotate(${skewDeg * 0.3}deg)`;

  topText.textContent = t > 0.6 ? '조금만 더! 💨' : '잘 하고 있어요! 💨';
}

// ───────────────────────────────────────────
//  불꽃 idle 상태 복원
// ───────────────────────────────────────────
function resetFlame() {
  flame.classList.remove('blown');
  flame.style.transform     = '';
  flame.style.opacity       = '1';
  flameWrap.style.transform = '';
  topText.textContent       = '초를 힘껏 불어주세요!';
}

// ───────────────────────────────────────────
//  촛불 끄기
// ───────────────────────────────────────────
function extinguish(elapsed) {
  isBlown   = true;
  isRunning = false;

  // 불꽃 즉시 페이드아웃
  flame.style.transition = 'opacity 0.15s';
  flame.style.opacity    = '0';

  // 마이크 스트림 정지
  micStream.getTracks().forEach(track => track.stop());

  // 파티클 폭발 시작
  startParticles();

  // 3초 후 결과 화면
  setTimeout(() => {
    stopParticles();
    showResult(elapsed);
  }, 3000);
}

// ───────────────────────────────────────────
//  결과 화면 표시
// ───────────────────────────────────────────
function showResult(elapsed) {
  resultRecord.textContent    = `🕯️ ${elapsed}초 만에 껐어요!`;
  resultScreen.style.display  = 'flex';
}

// ───────────────────────────────────────────
//  파티클 시스템
// ───────────────────────────────────────────
let particles  = [];
let pAnimFrame = null;

function startParticles() {
  pCanvas.style.display = 'block';
  pCanvas.width         = window.innerWidth;
  pCanvas.height        = window.innerHeight;

  const cx = pCanvas.width  / 2;
  const cy = pCanvas.height * 0.32;

  for (let i = 0; i < 80; i++) {
    particles.push(makeParticle(cx, cy));
  }

  drawParticles();
}

function makeParticle(cx, cy) {
  const angle  = Math.random() * Math.PI * 2;
  const speed  = 2 + Math.random() * 5;
  const colors = ['#ff4400', '#ff8800', '#ffdd00', '#ffaa00', '#ff6600', '#fff'];

  return {
    x: cx, y: cy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 4,
    alpha:  1,
    radius: 3 + Math.random() * 5,
    color:  colors[Math.floor(Math.random() * colors.length)],
    decay:  0.015 + Math.random() * 0.02,
  };
}

function drawParticles() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

  particles = particles.filter(p => p.alpha > 0);

  particles.forEach(p => {
    p.x     += p.vx;
    p.y     += p.vy;
    p.vy    += 0.12;   // 중력
    p.alpha -= p.decay;

    pCtx.save();
    pCtx.globalAlpha = Math.max(p.alpha, 0);
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    pCtx.fillStyle   = p.color;
    pCtx.shadowBlur  = 8;
    pCtx.shadowColor = p.color;
    pCtx.fill();
    pCtx.restore();
  });

  if (particles.length > 0) {
    pAnimFrame = requestAnimationFrame(drawParticles);
  }
}

function stopParticles() {
  cancelAnimationFrame(pAnimFrame);
  pCanvas.style.display = 'none';
  particles = [];
}
