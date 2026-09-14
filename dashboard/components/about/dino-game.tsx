"use client";

import { useEffect, useRef } from "react";

const HEIGHT = 200;
const GROUND = 166;
const PX = 2;
const DINO_X = 36;
const GRAVITY = 2400;
const JUMP_V = -760;
const START_SPEED = 360;
const MAX_SPEED = 880;
const BEST_KEY = "recon.dino.best";

const INK = "#283044";
const DIM = "#767775";
const CLOUD = "rgba(118,119,117,0.35)";

const BODY = [
  "          ######## ",
  "         ##.#######",
  "         ##########",
  "         ##########",
  "         #####     ",
  "         #######   ",
  "#       #####      ",
  "#      #######     ",
  "##    ##########   ",
  "###  #########  #  ",
  "##############     ",
  " #############     ",
  "  ###########      ",
  "   #########       ",
  "    #######        ",
];
const LEGS = {
  stand: ["     ###  ##", "     ##    #", "     #     #", "     ##    ##"],
  runA: ["     ###  ##", "     ##    #", "           #", "           ##"],
  runB: ["     ###  ##", "     ##    #", "     #      ", "     ##     "],
};
const DINO_W = BODY[0].length * PX;
const DINO_H = (BODY.length + 4) * PX;

type Status = "idle" | "playing" | "over";
type Obstacle = { x: number; count: number; unit: number; h: number };

function drawBitmap(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === "#") ctx.fillRect(Math.round(x + c * PX), Math.round(y + r * PX), PX, PX);
    }
  }
}

function drawCactus(ctx: CanvasRenderingContext2D, x: number, unit: number, h: number) {
  const trunkW = Math.round(unit * 0.42);
  const tx = x + Math.round((unit - trunkW) / 2);
  const top = GROUND - h;
  ctx.fillRect(tx, top, trunkW, h);
  const armW = Math.max(3, Math.round(unit * 0.2));
  ctx.fillRect(x, top + h * 0.3, armW, h * 0.32);
  ctx.fillRect(x, top + h * 0.58, tx - x, armW);
  ctx.fillRect(x + unit - armW, top + h * 0.18, armW, h * 0.3);
  ctx.fillRect(tx + trunkW, top + h * 0.44, x + unit - tx - trunkW, armW);
}

/** A Chrome-offline-style runner. Space / ↑ / tap to jump. Only listens while on screen. */
export function DinoGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;

    let width = 0;
    let visible = false;
    let raf = 0;
    let last = 0;

    let status: Status = "idle";
    let overAt = 0;
    let dinoY = GROUND - DINO_H;
    let vy = 0;
    let speed = START_SPEED;
    let score = 0;
    let best = 0;
    let runClock = 0;
    let obstacles: Obstacle[] = [];
    let nextGap = 500;
    const clouds = [
      { x: 120, y: 42 },
      { x: 420, y: 70 },
      { x: 700, y: 34 },
    ];
    let pebbles: { x: number; y: number; w: number }[] = [];

    try {
      best = Number(window.localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      // storage unavailable
    }

    const seedPebbles = () => {
      pebbles = Array.from({ length: Math.ceil(width / 28) }, () => ({
        x: Math.random() * width,
        y: GROUND + 4 + Math.random() * 10,
        w: 1 + Math.random() * 4,
      }));
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = wrap.clientWidth;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${HEIGHT}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedPebbles();
      draw();
    };

    const reset = () => {
      status = "playing";
      dinoY = GROUND - DINO_H;
      vy = 0;
      speed = START_SPEED;
      score = 0;
      runClock = 0;
      obstacles = [];
      nextGap = width * 0.6;
    };

    const action = () => {
      if (status === "playing") {
        if (dinoY >= GROUND - DINO_H) vy = JUMP_V;
      } else if (status === "idle" || performance.now() - overAt > 450) {
        reset();
        vy = JUMP_V;
      }
    };

    const update = (dt: number) => {
      runClock += dt;
      speed = Math.min(MAX_SPEED, speed + 11 * dt);
      score += (speed * dt) / 40;

      vy += GRAVITY * dt;
      dinoY = Math.min(GROUND - DINO_H, dinoY + vy * dt);
      if (dinoY >= GROUND - DINO_H) vy = 0;

      const dx = speed * dt;
      for (const o of obstacles) o.x -= dx;
      obstacles = obstacles.filter((o) => o.x + o.count * o.unit > -10);
      const tail = obstacles.length ? obstacles[obstacles.length - 1] : null;
      const tailEnd = tail ? tail.x + tail.count * tail.unit : -Infinity;
      if (width - tailEnd >= nextGap) {
        const large = Math.random() < 0.45;
        obstacles.push({
          x: width + 10,
          count: 1 + Math.floor(Math.random() * (speed > 520 ? 3 : 2)),
          unit: large ? 22 : 15,
          h: large ? 44 + Math.random() * 6 : 30 + Math.random() * 6,
        });
        nextGap = speed * 0.75 + 140 + Math.random() * 360;
      }

      for (const c of clouds) {
        c.x -= dx * 0.15;
        if (c.x < -60) {
          c.x = width + Math.random() * 200;
          c.y = 28 + Math.random() * 60;
        }
      }
      for (const p of pebbles) {
        p.x -= dx;
        if (p.x < -6) p.x += width + 6;
      }

      // Forgiving hitbox: trimmed well inside the sprite.
      const hx = DINO_X + 8;
      const hy = dinoY + 4;
      const hw = DINO_W - 18;
      const hh = DINO_H - 8;
      for (const o of obstacles) {
        const ox = o.x + 3;
        const ow = o.count * o.unit - 6;
        const oy = GROUND - o.h + 3;
        if (hx < ox + ow && hx + hw > ox && hy < GROUND && hy + hh > oy) {
          status = "over";
          overAt = performance.now();
          if (Math.floor(score) > best) {
            best = Math.floor(score);
            try {
              window.localStorage.setItem(BEST_KEY, String(best));
            } catch {
              // ignore
            }
          }
          break;
        }
      }
    };

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, HEIGHT);

      ctx.fillStyle = CLOUD;
      for (const c of clouds) {
        ctx.fillRect(c.x + 8, c.y, 30, 4);
        ctx.fillRect(c.x, c.y + 4, 46, 4);
        ctx.fillRect(c.x + 14, c.y - 4, 14, 4);
      }

      ctx.fillStyle = DIM;
      ctx.fillRect(0, GROUND - 1, width, 1.5);
      for (const p of pebbles) ctx.fillRect(p.x, p.y, p.w, 1.5);

      ctx.fillStyle = INK;
      for (const o of obstacles) {
        for (let i = 0; i < o.count; i++) drawCactus(ctx, o.x + i * o.unit, o.unit, o.h - (i % 2) * 6);
      }

      const grounded = dinoY >= GROUND - DINO_H;
      const legs = status !== "playing" || !grounded ? LEGS.stand : Math.floor(runClock * 10) % 2 ? LEGS.runA : LEGS.runB;
      drawBitmap(ctx, BODY, DINO_X, dinoY);
      drawBitmap(ctx, legs, DINO_X, dinoY + BODY.length * PX);
      if (status === "over") {
        // x-ed out eye
        ctx.fillStyle = "#b3261e";
        ctx.fillRect(DINO_X + 11 * PX, dinoY + PX, PX, PX);
        ctx.fillStyle = INK;
      }

      ctx.font = "600 13px ui-monospace, 'SF Mono', Menlo, monospace";
      ctx.textAlign = "right";
      ctx.fillStyle = DIM;
      const pad = (n: number) => String(Math.floor(n)).padStart(5, "0");
      ctx.fillText(`HI ${pad(best)}`, width - 90, 24);
      ctx.fillStyle = INK;
      ctx.fillText(pad(score), width - 16, 24);

      ctx.textAlign = "center";
      if (status === "idle") {
        ctx.fillStyle = INK;
        ctx.fillText("PRESS SPACE OR TAP TO START", width / 2, 92);
      } else if (status === "over") {
        ctx.fillStyle = INK;
        ctx.font = "700 18px ui-monospace, 'SF Mono', Menlo, monospace";
        ctx.fillText("G A M E   O V E R", width / 2, 84);
        ctx.font = "500 12px ui-monospace, 'SF Mono', Menlo, monospace";
        ctx.fillStyle = DIM;
        ctx.fillText("space / tap to run again", width / 2, 108);
      }
    }

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      if (status === "playing") update(dt);
      draw();
      raf = visible ? requestAnimationFrame(frame) : 0;
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(wrap);

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const onKey = (e: KeyboardEvent) => {
      if (!visible || e.repeat) return;
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        action();
      }
    };
    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointer);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Dino runner game. Press Space, the up arrow, or tap to jump over cacti."
        className="block touch-manipulation cursor-pointer"
        style={{ height: HEIGHT }}
      />
    </div>
  );
}
