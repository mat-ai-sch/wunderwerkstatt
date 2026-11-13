(() => {
  const region = document.querySelector(".brand-home-whisper");
  if (!region) return;

  region.querySelectorAll(".brand-home-confetti").forEach(el => { el.hidden = true; });

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "30",
    pointerEvents: "none"
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });
  const palette = ["#f04f78", "#ff8b52", "#f2c94c", "#42b7a0", "#4f79d8", "#a86bd1", "#82a45f", "#ef6fa5", "#f6a83a", "#54a7c5"];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let active = false;
  let particles = [];
  let frame = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  const random = (min, max) => min + Math.random() * (max - min);

  function burstFrom(point, scale, delay, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = random(-Math.PI * 0.92, -Math.PI * 0.08);
      const speed = random(170, 500) * scale;
      const life = random(3.95, 4.58);
      particles.push({
        x: point.x + random(-12, 12),
        y: point.y + random(-8, 8),
        vx: Math.cos(angle) * speed + random(-65, 65),
        vy: Math.sin(angle) * speed + random(-85, 65),
        gravity: random(175, 285),
        sway: random(-70, 70),
        rotation: random(0, Math.PI * 2),
        spin: random(-8, 8),
        width: random(5, 10) * scale,
        length: random(9, 17) * scale,
        color: palette[Math.floor(Math.random() * palette.length)],
        born: performance.now() + delay,
        life
      });
    }
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.length / 2);
    ctx.bezierCurveTo(p.width * 0.85, -p.length * 0.23, p.width * 0.8, p.length * 0.24, 0, p.length / 2);
    ctx.bezierCurveTo(-p.width * 0.8, p.length * 0.24, -p.width * 0.85, -p.length * 0.23, 0, -p.length / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -p.length * 0.33);
    ctx.quadraticCurveTo(p.width * 0.12, 0, 0, p.length * 0.34);
    ctx.stroke();
    ctx.restore();
  }

  function animate(now) {
    ctx.clearRect(0, 0, width, height);
    let remaining = 0;

    for (const p of particles) {
      const elapsed = (now - p.born) / 1000;
      if (elapsed < 0) {
        remaining += 1;
        continue;
      }
      if (elapsed >= p.life) continue;

      remaining += 1;
      const fadeIn = Math.min(1, elapsed / 0.18);
      const fadeOut = Math.min(1, (p.life - elapsed) / 1.25);
      ctx.globalAlpha = Math.min(fadeIn, fadeOut) * 0.98;

      p.x += (p.vx + Math.sin(elapsed * 5 + p.rotation) * p.sway) / 60;
      p.y += p.vy / 60;
      p.vy += p.gravity / 60;
      p.rotation += p.spin / 60;
      drawPetal(p);
    }

    ctx.globalAlpha = 1;
    particles = particles.filter(p => now - p.born < p.life * 1000);
    if (remaining > 0) {
      frame = requestAnimationFrame(animate);
    } else {
      active = false;
      particles = [];
      ctx.clearRect(0, 0, width, height);
    }
  }

  function celebrate() {
    if (active) return;
    active = true;
    particles = [];
    const reduced = reducedMotion.matches;
    const scale = reduced ? 0.72 : 1;
    const count = reduced ? 9 : 18;
    const copy = region.querySelector(".brand-home-whisper-copy");
    const cabinet = region.querySelector(".brand-home-main-button");
    const points = [copy, cabinet].filter(Boolean).map(el => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    if (!points.length) {
      active = false;
      return;
    }

    const waves = reduced ? 5 : 10;
    for (let wave = 0; wave < waves; wave += 1) {
      const delay = wave * (reduced ? 55 : 48);
      points.forEach((point, index) => {
        burstFrom(point, scale, delay + index * 28, count);
      });
    }
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(animate);
  }

  region.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") celebrate();
  });
  region.addEventListener("focusin", celebrate);
})();
