// 3D Particle Background Canvas
(function() {
    const canvas = document.getElementById('bgCanvas');
    const ctx = canvas.getContext('2d');
  
    let particles = [];
    let W, H;
  
    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
  
    window.addEventListener('resize', resize);
    resize();
  
    // Create particles
    function createParticles() {
      particles = [];
      const count = Math.floor((W * H) / 18000);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          z: Math.random() * 800 + 100,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          vz: (Math.random() - 0.5) * 0.5,
          r: Math.random() * 2 + 0.5,
          color: Math.random() > 0.5 ? '#4f8ef7' : '#7c5cfc',
          opacity: Math.random() * 0.6 + 0.1,
        });
      }
    }
  
    createParticles();
    window.addEventListener('resize', createParticles);
  
    let mouse = { x: W / 2, y: H / 2 };
    window.addEventListener('mousemove', e => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
  
    function project(x, y, z) {
      const fov = 500;
      const scale = fov / (fov + z);
      return {
        sx: W / 2 + (x - W / 2) * scale,
        sy: H / 2 + (y - H / 2) * scale,
        scale
      };
    }
  
    function drawConnections() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i], p2 = particles[j];
          const proj1 = project(p1.x, p1.y, p1.z);
          const proj2 = project(p2.x, p2.y, p2.z);
          const dx = proj1.sx - proj2.sx;
          const dy = proj1.sy - proj2.sy;
          const dist = Math.sqrt(dx * dx + dy * dy);
  
          if (dist < 100) {
            const opacity = (1 - dist / 100) * 0.12;
            ctx.beginPath();
            ctx.moveTo(proj1.sx, proj1.sy);
            ctx.lineTo(proj2.sx, proj2.sy);
            ctx.strokeStyle = `rgba(79, 142, 247, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }
  
    function animate() {
      ctx.clearRect(0, 0, W, H);
  
      // Draw subtle gradient overlay
      const gradient = ctx.createRadialGradient(
        mouse.x, mouse.y, 0,
        mouse.x, mouse.y, 400
      );
      gradient.addColorStop(0, 'rgba(79, 142, 247, 0.03)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);
  
      drawConnections();
  
      for (const p of particles) {
        // Mouse influence
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          p.vx += (dx / dist) * 0.01;
          p.vy += (dy / dist) * 0.01;
        }
  
        // Velocity damping
        p.vx *= 0.99;
        p.vy *= 0.99;
  
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
  
        // Bounds
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        if (p.z < 50) p.vz = Math.abs(p.vz);
        if (p.z > 900) p.vz = -Math.abs(p.vz);
  
        const proj = project(p.x, p.y, p.z);
        const size = p.r * proj.scale * 2.5;
        const opacity = p.opacity * proj.scale;
  
        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
  
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy, size, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(')', `, ${opacity})`).replace('rgb', 'rgba');
        ctx.fillStyle = `rgba(${p.color === '#4f8ef7' ? '79,142,247' : '124,92,252'}, ${opacity})`;
        ctx.fill();
      }
  
      ctx.shadowBlur = 0;
      requestAnimationFrame(animate);
    }
  
    animate();
  })();