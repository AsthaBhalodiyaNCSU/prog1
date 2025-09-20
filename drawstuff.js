/* ---------- small Color helper ---------- */
class Color {
  constructor(r,g,b,a=255) {
    if ([r,g,b,a].some(c=>typeof c!=='number')) throw new Error('Color components must be numbers');
    this.r = Math.max(0,Math.min(255,Math.round(r)));
    this.g = Math.max(0,Math.min(255,Math.round(g)));
    this.b = Math.max(0,Math.min(255,Math.round(b)));
    this.a = Math.max(0,Math.min(255,Math.round(a)));
  }
  toRGBA(){ return `rgba(${this.r},${this.g},${this.b},${this.a/255})`; }
}

/* ---------- utilities ---------- */
function resizeCanvasForDisplay(canvas){
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return ctx;
}
function rand(min=0,max=1){ return Math.random()*(max-min)+min; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

/* ---------- shape helpers (same as before) ---------- */
// ... keep all: drawBackgroundGradient, drawTranslucentEllipses,
// drawStrokedTriangles, drawBoxGridWithSimpleLighting,
// drawCentralMandala, drawSparks, applyNoise, etc.

/* ---------- main draw orchestration ---------- */
function drawUniqueDesign(canvas, variant=1) {
  const ctx = canvas.getContext('2d');
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  ctx.clearRect(0,0,cssW,cssH);

  if (variant === 1) {
    // FIRST IMAGE
    drawBackgroundGradient(ctx, cssW, cssH);
    drawTranslucentEllipses(ctx, cssW, cssH, 8);
    drawStrokedTriangles(ctx, cssW, cssH, 10);
    drawCentralMandala(ctx, cssW, cssH);
    drawBoxGridWithSimpleLighting(ctx, cssW, cssH);
    drawSparks(ctx, cssW, cssH, 120);
    applyNoise(ctx, cssW, cssH, 0.08);
  } else {
    // SECOND IMAGE
    drawBackgroundGradient(ctx, cssW, cssH);
    drawTranslucentEllipses(ctx, cssW, cssH, 3);
    drawStrokedTriangles(ctx, cssW, cssH, 20);
    drawCentralMandala(ctx, cssW, cssH);
    drawBoxGridWithSimpleLighting(ctx, cssW, cssH);
    drawSparks(ctx, cssW, cssH, 200);
    applyNoise(ctx, cssW, cssH, 0.12);
  }

  // vignette
  ctx.save();
  const vign = ctx.createRadialGradient(cssW/2, cssH/2, cssW*0.2, cssW/2, cssH/2, Math.max(cssW,cssH));
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vign;
  ctx.fillRect(0,0,cssW,cssH);
  ctx.restore();

  // signature
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.font = '600 18px system-ui,Segoe UI,Roboto';
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillText(`design variant ${variant}`, 18, cssH-18);
  ctx.restore();
}

/* ---------- init & toggle handler ---------- */
(function init(){
  const canvas = document.getElementById('viewport');
  let variant = 1;

  function fit(){
    const desiredW = Math.min(window.innerWidth - 60, 1000);
    const desiredH = Math.min(window.innerHeight - 120, 700);
    canvas.style.width = desiredW + 'px';
    canvas.style.height = desiredH + 'px';
    resizeCanvasForDisplay(canvas);
    drawUniqueDesign(canvas, variant);
  }
  window.addEventListener('resize', fit);
  fit();

  canvas.addEventListener('click', function(){
    const ctx = canvas.getContext('2d');
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    let s = 0, steps = 6;

    function fadeOut(){
      s++;
      ctx.fillStyle = `rgba(7,9,18,${s/steps * 0.9})`;
      ctx.fillRect(0,0,cssW,cssH);
      if(s < steps) requestAnimationFrame(fadeOut);
      else {
        variant = (variant === 1 ? 2 : 1);
        drawUniqueDesign(canvas, variant);
        s = 0;
        requestAnimationFrame(fadeIn);
      }
    }
    function fadeIn(){
      s++;
      ctx.fillStyle = `rgba(7,9,18,${(1 - s/steps) * 0.6})`;
      ctx.fillRect(0,0,cssW,cssH);
      if(s < steps) requestAnimationFrame(fadeIn);
    }
    fadeOut();
  });
})();
