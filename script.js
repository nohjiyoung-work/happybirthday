// ───────────────────────────────────────────
//  설정값
// ───────────────────────────────────────────
const BLOW_THRESHOLD       = 0.15;
const EXTINGUISH_THRESHOLD = 0.40;

// ───────────────────────────────────────────
//  상태
// ───────────────────────────────────────────
let audioCtx  = null;
let analyser  = null;
let micStream = null;
let isRunning = false;
let isBlown   = false;
let startTime = null;

// ───────────────────────────────────────────
//  DOM
// ───────────────────────────────────────────
const flame        = document.getElementById('flame');
const flameWrap    = document.getElementById('flame-wrap');
const micBar       = document.getElementById('mic-bar');
const micBarWrap   = document.getElementById('mic-bar-wrap');
const timerEl      = document.getElementById('timer');
const topText      = document.getElementById('top-text');
const resultScreen = document.getElementById('result-screen');
const resultRecord = document.getElementById('result-record');
const pCanvas      = document.getElementById('particle-canvas');
const pCtx         = pCanvas.getContext('2d');

// ───────────────────────────────────────────
//  화면 터치 → 마이크 시작
//  (처음 터치 한 번만 / 이후 터치는 무시)
// ───────────────────────────────────────────
let started = false;

function onFirstTouch() {
  if (started) return;
  started = true;
  startMic();
}

document.body.addEventListener('click',      onFirstTouch);
document.body.addEventListener('touchstart', onFirstTouch, { passive: true });

// ───────────────────────────────────────────
//  마이크 요청 & 시작
// ───────────────────────────────────────────
async function startMic() {
  try {
    // 브라우저 마이크 권한 팝업 발생
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    audioCtx.createMediaStreamSource(micStream).connect(analyser);

    isRunning = true;
    startTime = Date.now();

    // 허용 후 UI 등장
    topText.classList.add('show');
    timerEl.classList.add('show');
    micBarWrap.classList.add('show');

    tick();

  } catch (e) {
    // 거부 시 재시도 안내
    started = false; // 다시 터치 허용
    topText.classList.add('show');
    topText.textContent = '마이크 권한을 허용해주세요.';
  }
}

// ───────────────────────────────────────────
//  메인 루프
// ───────────────────────────────────────────
function tick() {
  if (!isRunning || isBlown) return;

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  timerEl.textContent = `⏱ ${elapsed}s`;
  micBar.style.width  = Math.min(avg * 3 * 100, 100) + '%';

  if (avg > EXTINGUISH_THRESHOLD) {
    extinguish(elapsed);
    return;
  }

  if (avg > BLOW_THRESHOLD) {
    applyBlowEffect(avg);
  } else {
    resetFlame();
  }

  requestAnimationFrame(tick);
}

// ───────────────────────────────────────────
//  불꽃 반응
// ───────────────────────────────────────────
function applyBlowEffect(avg) {
  const t      = (avg - BLOW_THRESHOLD) / (EXTINGUISH_THRESHOLD - BLOW_THRESHOLD);
  const scaleX = 1 + t * 0.6;
  const scaleY = 1 - t * 0.35;
  const skew   = t * 20;

  flame.classList.add('blown');
  flame.style.transform     = `scaleX(${scaleX}) scaleY(${scaleY}) rotate(${-skew * 0.5}deg)`;
  flame.style.opacity       = String(1 - t * 0.3);
  flameWrap.style.transform = `rotate(${skew * 0.3}deg)`;
  topText.textContent       = t > 0.6 ? '조금만 더! 💨' : '잘 하고 있어요! 💨';
}

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
  isBlown = isRunning = false;
  flame.style.transition = 'opacity 0.15s';
  flame.style.opacity    = '0';
  micStream.getTracks().forEach(t => t.stop());
  startParticles();
  setTimeout(() => { stopParticles(); showResult(elapsed); }, 2000);
}

// ───────────────────────────────────────────
//  결과 화면
// ───────────────────────────────────────────
function showResult(elapsed) {
  resultRecord.textContent   = `${elapsed}초 만에 껐어요!`;
  resultScreen.style.display = 'flex';
  initColorCycle();
}

// ───────────────────────────────────────────
//  HAPPY BIRTHDAY 색상 사이클
// ───────────────────────────────────────────
const PALETTES = [
  ['#ff0000','#ff6600','#ffcc00','#00cc44','#0066ff','#9900cc','#ff0066'],
  ['#ff3399','#ff99cc','#ffccff','#cc99ff','#6633ff','#0099ff','#33ffcc'],
  ['#fff700','#ff6b00','#ff0055','#aa00ff','#0044ff','#00ffaa','#ff00ff'],
  ['#00ffff','#ff00ff','#ffff00','#ff4444','#44ff44','#4444ff','#ff8800'],
  ['#f72585','#7209b7','#3a0ca3','#4361ee','#4cc9f0','#06d6a0','#ffd166'],
];

function initColorCycle() {
  const h1   = document.getElementById('birthday-text');
  const text = h1.textContent;

  h1.innerHTML = text.split('').map(ch =>
    ch === ' '
      ? '<span class="char">&nbsp;</span>'
      : `<span class="char">${ch}</span>`
  ).join('');

  const chars = h1.querySelectorAll('.char');

  function applyColors() {
    const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    chars.forEach((el, i) => { el.style.color = palette[i % palette.length]; });
  }

  applyColors();
  setInterval(applyColors, 500);
}

// ───────────────────────────────────────────
//  파티클
// ───────────────────────────────────────────
let particles  = [];
let pAnimFrame = null;

function startParticles() {
  pCanvas.style.display = 'block';
  pCanvas.width  = window.innerWidth;
  pCanvas.height = window.innerHeight;

  const cx = pCanvas.width / 2;
  const cy = pCanvas.height * 0.6;

  for (let i = 0; i < 80; i++) particles.push(makeParticle(cx, cy));
  drawParticles();
}

function makeParticle(cx, cy) {
  const angle  = Math.random() * Math.PI * 2;
  const speed  = 2 + Math.random() * 5;
  const colors = ['#ff4400','#ff8800','#ffdd00','#ffaa00','#ff6600','#fff'];
  return {
    x: cx, y: cy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 4,
    alpha: 1,
    radius: 3 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    decay: 0.015 + Math.random() * 0.02,
  };
}

function drawParticles() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  particles = particles.filter(p => p.alpha > 0);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.alpha -= p.decay;
    pCtx.save();
    pCtx.globalAlpha = Math.max(p.alpha, 0);
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    pCtx.fillStyle = pCtx.shadowColor = p.color;
    pCtx.shadowBlur = 8;
    pCtx.fill();
    pCtx.restore();
  });
  if (particles.length > 0) pAnimFrame = requestAnimationFrame(drawParticles);
}

function stopParticles() {
  cancelAnimationFrame(pAnimFrame);
  pCanvas.style.display = 'none';
  particles = [];
}
