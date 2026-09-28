import React, { useEffect, useRef } from 'react';

interface PaperAirplaneTransitionProps {
  durationMs?: number;
  textureCanvas?: HTMLCanvasElement | null;
}

export const PaperAirplaneTransition: React.FC<PaperAirplaneTransitionProps> = ({ 
  durationMs = 850,
  textureCanvas = null 
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime: number | null = null;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; size: number }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // 3D Point Perspective Projection
    function project3D(p: { x: number; y: number; z: number }, center: { x: number; y: number }, fov = 850) {
      const z = p.z + fov;
      const scale = fov / Math.max(1, z);
      return {
        x: center.x + p.x * scale,
        y: center.y + p.y * scale,
        z: p.z,
        scale: scale,
      };
    }

    // PowerPoint Classic Flight Curve
    function getFlightTransform(flightProgress: number, w: number, h: number) {
      const t = flightProgress;
      const ease = Math.pow(t, 1.8);
      const pos = {
        x: (w / 2) + ease * (w * 0.88),
        y: (h / 2) - ease * (h * 0.95),
        z: -ease * 350,
      };
      const rot = {
        pitch: -0.3 - ease * 0.45,
        roll: 0.5 + ease * 0.65,
        yaw: 0.4 + ease * 0.25,
      };
      return { pos, rot };
    }

    // Affine texture mapping on 3D Origami triangles
    function draw3DTriangleWithTexture(
      context: CanvasRenderingContext2D,
      tex: HTMLCanvasElement | null,
      srcP0: { x: number; y: number },
      srcP1: { x: number; y: number },
      srcP2: { x: number; y: number },
      dstP0: { x: number; y: number },
      dstP1: { x: number; y: number },
      dstP2: { x: number; y: number },
      lighting: number,
      screenW: number,
      screenH: number
    ) {
      context.save();
      context.beginPath();
      context.moveTo(dstP0.x, dstP0.y);
      context.lineTo(dstP1.x, dstP1.y);
      context.lineTo(dstP2.x, dstP2.y);
      context.closePath();
      context.clip();

      if (tex && tex.width > 0 && tex.height > 0) {
        const scaleX = tex.width / screenW;
        const scaleY = tex.height / screenH;

        const x0 = srcP0.x * scaleX, y0 = srcP0.y * scaleY;
        const x1 = srcP1.x * scaleX, y1 = srcP1.y * scaleY;
        const x2 = srcP2.x * scaleX, y2 = srcP2.y * scaleY;

        const u0 = dstP0.x, v0 = dstP0.y;
        const u1 = dstP1.x, v1 = dstP1.y;
        const u2 = dstP2.x, v2 = dstP2.y;

        const delta = (x0 * (y1 - y2) - x1 * (y0 - y2) + x2 * (y0 - y1));
        if (Math.abs(delta) > 0.001) {
          const a = (u0 * (y1 - y2) - u1 * (y0 - y2) + u2 * (y0 - y1)) / delta;
          const b = (x0 * (u1 - u2) - x1 * (u0 - u2) + x2 * (u0 - u1)) / delta;
          const c = (x0 * (y1 * u2 - y2 * u1) - x1 * (y0 * u2 - y2 * u0) + x2 * (y0 * u1 - y1 * u0)) / delta;

          const d = (v0 * (y1 - y2) - v1 * (y0 - y2) + v2 * (y0 - y1)) / delta;
          const e = (x0 * (v1 - v2) - x1 * (v0 - v2) + x2 * (v0 - v1)) / delta;
          const f = (x0 * (y1 * v2 - y2 * v1) - x1 * (y0 * v2 - y2 * v0) + x2 * (y0 * v1 - y1 * v0)) / delta;

          context.transform(a, d, b, e, c, f);
          context.drawImage(tex, 0, 0);
        }
      } else {
        const base = Math.floor(235 * lighting);
        context.fillStyle = `rgb(${base}, ${base}, ${base})`;
        context.fill();
      }

      // Realistic 3D shading overlay reflecting folded paper surface
      if (lighting < 1.0) {
        context.fillStyle = `rgba(0, 0, 0, ${Math.min(0.65, (1.0 - lighting) * 0.85)})`;
        context.fill();
      } else if (lighting > 1.0) {
        context.fillStyle = `rgba(255, 255, 255, ${Math.min(0.35, (lighting - 1.0) * 0.5)})`;
        context.fill();
      }

      // Crisp paper fold crease outline
      context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      context.lineWidth = 1.2;
      context.stroke();

      context.restore();
    }

    const render = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const overallProgress = Math.min(1.0, elapsed / durationMs);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const foldProgress = Math.min(1.0, overallProgress / 0.38);
      const flightProgress = Math.max(0.0, (overallProgress - 0.38) / 0.62);

      const center = { x: w / 2, y: h / 2 };
      const f = foldProgress;

      // 3D fold heights
      const centerCreaseZ = f * (-h * 0.22);
      const wingFoldZ = f * (h * 0.16);
      const wingTipFoldZ = f * (-h * 0.09);

      let flight = { pos: { x: center.x, y: center.y, z: 0 }, rot: { pitch: 0, roll: 0, yaw: 0 } };
      if (flightProgress > 0) {
        flight = getFlightTransform(flightProgress, w, h);
      }

      function transformPoint(localX: number, localY: number, localZ: number) {
        let x = localX;
        let y = localY;
        let z = localZ;

        if (flightProgress > 0) {
          const cosP = Math.cos(flight.rot.pitch), sinP = Math.sin(flight.rot.pitch);
          const y1 = y * cosP - z * sinP;
          const z1 = y * sinP + z * cosP;

          const cosR = Math.cos(flight.rot.roll), sinR = Math.sin(flight.rot.roll);
          const x2 = x * cosR - y1 * sinR;
          const y2 = x * sinR + y1 * cosR;

          const cosY = Math.cos(flight.rot.yaw), sinY = Math.sin(flight.rot.yaw);
          const x3 = x2 * cosY + z1 * sinY;
          const z3 = -x2 * sinY + z1 * cosY;

          x = x3; y = y2; z = z3;
        }

        const worldX = (flightProgress > 0 ? flight.pos.x : center.x) + x;
        const worldY = (flightProgress > 0 ? flight.pos.y : center.y) + y;
        const worldZ = (flightProgress > 0 ? flight.pos.z : 0) + z;

        return project3D({ x: worldX - center.x, y: worldY - center.y, z: worldZ }, center);
      }

      // Source UV coordinates (full screen)
      const srcPoints = {
        nose: { x: w / 2, y: 0 },
        tailCenter: { x: w / 2, y: h },
        leftWingTip: { x: 0, y: h },
        rightWingTip: { x: w, y: h },
        leftCrease: { x: w * 0.22, y: h },
        rightCrease: { x: w * 0.78, y: h },
        leftTopCorner: { x: 0, y: 0 },
        rightTopCorner: { x: w, y: 0 },
      };

      // Destination 3D Origami folded coordinates
      // Nose at top center
      const pNose = transformPoint(0, -h / 2, 0);

      // Tail keel center
      const pTailCenter = transformPoint(0, h / 2, centerCreaseZ);

      // Creases along wings (interpolating from flat source to paper plane wing creases)
      const pLeftCrease = transformPoint(
        -w * 0.28 * (1 - f) - (w * 0.14) * f,
        (h / 2) * (1 - f) + (h * 0.22) * f,
        wingFoldZ
      );

      const pRightCrease = transformPoint(
        w * 0.28 * (1 - f) + (w * 0.14) * f,
        (h / 2) * (1 - f) + (h * 0.22) * f,
        wingFoldZ
      );

      // Outer Wing Tips
      const pLeftWingTip = transformPoint(
        -(w / 2) * (1 - f * 0.25),
        (h / 2) * (1 - f * 0.35),
        wingTipFoldZ
      );

      const pRightWingTip = transformPoint(
        (w / 2) * (1 - f * 0.25),
        (h / 2) * (1 - f * 0.35),
        wingTipFoldZ
      );

      // Top corner folds
      const pLeftTopCorner = transformPoint(
        -(w / 2) * (1 - f),
        (-h / 2) * (1 - f) + (h * 0.1) * f,
        wingFoldZ * 0.8
      );

      const pRightTopCorner = transformPoint(
        (w / 2) * (1 - f),
        (-h / 2) * (1 - f) + (h * 0.1) * f,
        wingFoldZ * 0.8
      );

      // Origami Lighting Simulation
      const lightLeftFuselage = 0.85 + f * 0.25;
      const lightRightFuselage = 0.65 - f * 0.2;
      const lightLeftWing = 1.05 + f * 0.1;
      const lightRightWing = 0.80 - f * 0.15;

      // Draw all 6 paper plane panels mapped with the actual current page texture!
      // Panel 1: Left Fuselage
      draw3DTriangleWithTexture(
        ctx, textureCanvas,
        srcPoints.nose, srcPoints.tailCenter, srcPoints.leftCrease,
        pNose, pTailCenter, pLeftCrease,
        lightLeftFuselage, w, h
      );

      // Panel 2: Right Fuselage
      draw3DTriangleWithTexture(
        ctx, textureCanvas,
        srcPoints.nose, srcPoints.tailCenter, srcPoints.rightCrease,
        pNose, pTailCenter, pRightCrease,
        lightRightFuselage, w, h
      );

      // Panel 3: Left Main Wing
      draw3DTriangleWithTexture(
        ctx, textureCanvas,
        srcPoints.nose, srcPoints.leftCrease, srcPoints.leftWingTip,
        pNose, pLeftCrease, pLeftWingTip,
        lightLeftWing, w, h
      );

      // Panel 4: Right Main Wing
      draw3DTriangleWithTexture(
        ctx, textureCanvas,
        srcPoints.nose, srcPoints.rightCrease, srcPoints.rightWingTip,
        pNose, pRightCrease, pRightWingTip,
        lightRightWing, w, h
      );

      // Panel 5: Top Left Corner Fold
      draw3DTriangleWithTexture(
        ctx, textureCanvas,
        srcPoints.nose, srcPoints.leftTopCorner, srcPoints.leftWingTip,
        pNose, pLeftTopCorner, pLeftWingTip,
        lightLeftWing * 0.9, w, h
      );

      // Panel 6: Top Right Corner Fold
      draw3DTriangleWithTexture(
        ctx, textureCanvas,
        srcPoints.nose, srcPoints.rightTopCorner, srcPoints.rightWingTip,
        pNose, pRightTopCorner, pRightWingTip,
        lightRightWing * 0.9, w, h
      );

      // Wind particles trailing behind the airplane during flight
      if (flightProgress > 0.05 && flightProgress < 0.95) {
        [pLeftWingTip, pRightWingTip].forEach((tip) => {
          for (let i = 0; i < 2; i++) {
            particles.push({
              x: tip.x + (Math.random() - 0.5) * 6,
              y: tip.y + (Math.random() - 0.5) * 6,
              vx: (Math.random() - 0.5) * 2 - 2,
              vy: (Math.random() - 0.5) * 2 + 1,
              life: 1.0,
              size: Math.random() * 4 + 2,
            });
          }
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.035;
        p.size *= 0.96;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.45})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (overallProgress < 1.0) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [durationMs, textureCanvas]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
};
