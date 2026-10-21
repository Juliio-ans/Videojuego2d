const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreLabel = document.getElementById("score");
const musicBtn = document.getElementById("musicBtn");
const restartBtn = document.getElementById("restartBtn");

const ghostImage = new Image();
ghostImage.src = "assets/ghost.svg";
const skullImage = new Image();
skullImage.src = "assets/skull.svg";
const backgroundImage = new Image();
backgroundImage.src = "assets/fondo.jpg";

const TOTAL_GHOSTS = 25;
let ghosts = [];
let particles = [];
let score = 0;
let musicOscillators = [];
let musicOn = false;
let lastTime = 0;

function random(min, max) { return Math.random() * (max - min) + min; }

function makeGhost() {
  const radius = random(17, 28);
  const modes = ["upDown", "diagonal", "circular"];
  const mode = modes[Math.floor(Math.random() * modes.length)];
  return {
    type: Math.random() < 0.2 ? "skull" : "ghost",
    x: random(radius, canvas.width - radius),
    y: random(radius, canvas.height - radius),
    radius,
    speed: random(45, 125),
    vx: random(-1, 1) || 0.5,
    vy: random(-1, 1) || 0.5,
    mode,
    angle: random(0, Math.PI * 2),
    orbit: random(18, 65),
    centerX: random(50, canvas.width - 50),
    centerY: random(50, canvas.height - 50),
    phase: random(0, 8),
    wobble: random(0.5, 2.2)
  };
}

function resetGame() {
  ghosts = [];
  particles = [];
  score = 0;
  scoreLabel.textContent = score;
  for (let i = 0; i < TOTAL_GHOSTS; i++) ghosts.push(makeGhost());
}
resetGame();

function drawBackground() {
  if (backgroundImage.complete && backgroundImage.naturalWidth) {
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = "#10182b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // ligera neblina para dar ambiente
  const haze = ctx.createLinearGradient(0, canvas.height * .45, 0, canvas.height);
  haze.addColorStop(0, "rgba(30,45,68,0)");
  haze.addColorStop(1, "rgba(7,12,25,.42)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}


function drawGhost(g) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(Math.sin(g.phase * 2) * 0.08);

  ctx.shadowColor = "#a8f5ff";
  ctx.shadowBlur = 13;

  const sprite = g.type === "skull"
    ? skullImage
    : ghostImage;

  if (sprite.complete && sprite.naturalWidth) {
    ctx.drawImage(
      sprite,
      -g.radius,
      -g.radius,
      g.radius * 2,
      g.radius * 2
    );
  } else {
    ctx.fillStyle = "#e7faff";
    ctx.beginPath();
    ctx.arc(0, 0, g.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}


function spawnImpact(x, y) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = random(50, 180);
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: .42, maxLife: .42, size: random(2, 5) });
  }
}

function updateGhost(g, dt, elapsed) {
  g.phase += dt * g.wobble;
  const oldX = g.x, oldY = g.y;

  if (g.mode === "circular") {
    g.angle += dt * (g.speed / 42);
    g.x = g.centerX + Math.cos(g.angle) * g.orbit;
    g.y = g.centerY + Math.sin(g.angle) * g.orbit;
    // El centro también se desplaza suavemente
    g.centerX += Math.sin(elapsed * .35 + g.phase) * 9 * dt;
    g.centerY += Math.cos(elapsed * .31 + g.phase) * 7 * dt;
  } else {
    if (g.mode === "upDown") {
      g.vx *= .985;
      if (Math.abs(g.vx) < .12) g.vx = random(-.7, .7);
    }
    g.x += g.vx * g.speed * dt;
    g.y += g.vy * g.speed * dt;
  }

  // Aleatoriedad suave en la trayectoria
  if (Math.random() < .012) {
    g.vx += random(-.18, .18);
    g.vy += random(-.18, .18);
    const mag = Math.hypot(g.vx, g.vy) || 1;
    g.vx /= mag; g.vy /= mag;
  }

  // Rebote contra los bordes del canvas
  if (g.x < g.radius || g.x > canvas.width - g.radius) {
    g.vx *= -1; g.x = Math.max(g.radius, Math.min(canvas.width - g.radius, g.x));
    spawnImpact(g.x, g.y);
  }
  if (g.y < g.radius || g.y > canvas.height - g.radius) {
    g.vy *= -1; g.y = Math.max(g.radius, Math.min(canvas.height - g.radius, g.y));
    spawnImpact(g.x, g.y);
  }

  // En ocasiones un fantasma aparece en otra zona del escenario
  if (Math.random() < .0007) {
    g.x = random(g.radius, canvas.width - g.radius);
    g.y = random(g.radius, canvas.height - g.radius);
    g.centerX = g.x; g.centerY = g.y;
  }
}

function resolveCollisions() {
  for (let i = 0; i < ghosts.length; i++) {
    for (let j = i + 1; j < ghosts.length; j++) {
      const a = ghosts[i], b = ghosts[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const minDistance = a.radius + b.radius;
      if (distance > 0 && distance < minDistance) {
        const nx = dx / distance, ny = dy / distance;
        // Intercambio simple de componentes de velocidad en la dirección del choque
        const av = a.vx * nx + a.vy * ny;
        const bv = b.vx * nx + b.vy * ny;
        a.vx += (bv - av) * nx;
        a.vy += (bv - av) * ny;
        b.vx += (av - bv) * nx;
        b.vy += (av - bv) * ny;
        const overlap = (minDistance - distance) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        spawnImpact((a.x + b.x) / 2, (a.y + b.y) / 2);
      }
    }
  }
}

function updateParticles(dt) {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= .96; p.vy *= .96;
    p.life -= dt;
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = "#ffd166";
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function frame(time) {
  const dt = Math.min((time - lastTime) / 1000 || 0, .035);
  lastTime = time;
  const elapsed = time / 1000;
  drawBackground();
  ghosts.forEach(g => updateGhost(g, dt, elapsed));
  resolveCollisions();
  ghosts.forEach(drawGhost);
  updateParticles(dt);
  drawParticles();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

canvas.addEventListener("click", event => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  // Se revisa desde el último dibujado para seleccionar el fantasma más cercano al clic
  let hitIndex = -1;
  for (let i = ghosts.length - 1; i >= 0; i--) {
    const g = ghosts[i];
    if (Math.hypot(g.x - x, g.y - y) <= g.radius * 1.15) { hitIndex = i; break; }
  }
  if (hitIndex !== -1) {
    const caught = ghosts[hitIndex];
    spawnImpact(caught.x, caught.y);
    ghosts.splice(hitIndex, 1);
    ghosts.push(makeGhost()); // siempre conserva 25 fantasmas
    playCatchSound(caught.type);
    score += caught.type === "skull" ? 3 : 1;
    scoreLabel.textContent = score;
  }
});

restartBtn.addEventListener("click", resetGame);

// Música ambiental sintetizada con Web Audio API; no requiere descargar archivos externos.
// El navegador solo permite iniciar audio después de una interacción del usuario.

let audioContext;
let musicGain;
let musicTimer;
let musicPlaying = false;
let musicStep = 0;

function startMusic() {
  if (musicPlaying) return;

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    console.log("Este navegador no admite Web Audio.");
    return;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  audioContext.resume().then(() => {
    if (musicPlaying) return;

    musicGain = audioContext.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(audioContext.destination);

    musicPlaying = true;

    const melody = [
      220, 261.63, 293.66, 261.63,
      196, 220, 164.81, 196,
      220, 329.63, 293.66, 220,
      174.61, 196, 146.83, 164.81
    ];

    function playNote() {
      if (!musicPlaying) return;

      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const volume = audioContext.createGain();

      osc.type = "triangle";
      osc.frequency.value = melody[musicStep % melody.length];

      volume.gain.setValueAtTime(0.001, now);
      volume.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
      volume.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(volume);
      volume.connect(musicGain);

      osc.start(now);
      osc.stop(now + 0.5);

      musicStep++;
    }

    playNote();
    musicTimer = setInterval(playNote, 400);
  }).catch(error => {
    console.error("No se pudo iniciar el audio:", error);
  });
}


function stopMusic() {
  musicPlaying = false;

  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }

  if (musicGain && audioContext) {
    musicGain.gain.cancelScheduledValues(
      audioContext.currentTime
    );

    musicGain.gain.setValueAtTime(
      0,
      audioContext.currentTime
    );
  }
}



musicBtn.addEventListener("click", () => {
  if (musicPlaying) {
    stopMusic();
    musicBtn.textContent = "🔇 Activar música";
  } else {
    startMusic();
    musicBtn.textContent = "🔊 Desactivar música";
  }
});


// Ajuste de tamaño visual manteniendo las coordenadas lógicas del canvas.
window.addEventListener("resize", () => {});



function playCatchSound(type = "ghost") {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  audioContext.resume().then(() => {
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const volume = audioContext.createGain();

    if (type === "skull") {
      // Sonido especial para el cráneo
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(
        180, now + 0.35
      );
    } else {
      // Sonido corto y mágico para el fantasma
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(
        440, now + 0.15
      );
    }

    volume.gain.setValueAtTime(0.001, now);
    volume.gain.linearRampToValueAtTime(0.3, now + 0.02);
    volume.gain.exponentialRampToValueAtTime(
      0.001, now + 0.28
    );

    osc.connect(volume);
    volume.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }).catch(error => {
    console.error("No se pudo reproducir el efecto:", error);
  });
}
