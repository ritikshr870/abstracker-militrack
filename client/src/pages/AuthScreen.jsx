import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { LogIn, User, Key, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';

function LiveSkyCanvas() {
  const canvasRef = useRef(null);
  const shootingStarsRef = useRef([]);
  const lastSpawnRef = useRef(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 1. Generate 250+ twinkling realistic stars across multiple depths
    const starCount = Math.min(260, Math.floor((width * height) / 5500));
    const stars = [];
    const starPalettes = ['#ffffff', '#f8fafc', '#e0f2fe', '#bae6fd', '#fef08a', '#e9d5ff'];

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() < 0.78 ? Math.random() * 0.9 + 0.4 : Math.random() * 1.8 + 1.1,
        baseAlpha: Math.random() * 0.6 + 0.25,
        twinkleSpeed: Math.random() * 0.035 + 0.008,
        phase: Math.random() * Math.PI * 2,
        color: starPalettes[Math.floor(Math.random() * starPalettes.length)],
        isCross: Math.random() < 0.08
      });
    }

    // Function to spawn shooting stars (standard or fast)
    function spawnShootingStar(isFast = false, originX = null, originY = null) {
      const startX = originX !== null ? originX : Math.random() * (width * 0.85);
      const startY = originY !== null ? originY : Math.random() * (height * 0.45);
      const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.3; // 40-50 deg diagonal sweep
      const speed = isFast ? Math.random() * 12 + 22 : Math.random() * 8 + 12; // Fast: 22-34 px/frame!
      const length = isFast ? Math.random() * 120 + 140 : Math.random() * 80 + 100;

      shootingStarsRef.current.push({
        x: startX,
        y: startY,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        length: length,
        life: 0,
        maxLife: isFast ? Math.floor(Math.random() * 25 + 35) : Math.floor(Math.random() * 30 + 45),
        size: isFast ? Math.random() * 1.8 + 1.8 : Math.random() * 1.4 + 1.3,
        color: Math.random() < 0.35 ? '#fef08a' : '#ffffff',
        isFast
      });
    }

    // Initial idle spawn
    spawnShootingStar(false);

    // Global listener for fast shooting star bursts on mousemove and touch tap
    let lastInteractionTime = 0;
    const triggerInteractiveFastShooting = (e) => {
      const now = Date.now();
      if (now - lastInteractionTime > 80) { // Throttle slightly for smooth performance
        lastInteractionTime = now;
        const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
        const clientY = e.touches ? e.touches[0]?.clientY : e.clientY;
        
        // Spawn 2 to 3 fast shooting stars near cursor or sky
        const count = e.touches ? 3 : 2;
        for (let i = 0; i < count; i++) {
          const spawnX = (clientX || Math.random() * width) + (Math.random() - 0.5) * 200;
          const spawnY = Math.max(10, (clientY || Math.random() * height * 0.5) - Math.random() * 150);
          spawnShootingStar(true, spawnX, spawnY);
        }
        if (onScreenInteraction) onScreenInteraction();
      }
    };

    window.addEventListener('mousemove', triggerInteractiveFastShooting);
    window.addEventListener('touchstart', triggerInteractiveFastShooting);
    window.addEventListener('touchmove', triggerInteractiveFastShooting);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep realistic night cosmos gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#020617'); // Space black
      skyGrad.addColorStop(0.35, '#050b1a'); // Midnight celestial blue
      skyGrad.addColorStop(0.75, '#091026'); // Deep starry indigo
      skyGrad.addColorStop(1, '#0c1638'); // Horizon nebula glow
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Diagonal Milky Way Cosmic Band
      ctx.save();
      const milkyWay = ctx.createLinearGradient(0, 0, width, height);
      milkyWay.addColorStop(0.2, 'rgba(59, 130, 246, 0.03)');
      milkyWay.addColorStop(0.5, 'rgba(147, 197, 253, 0.07)');
      milkyWay.addColorStop(0.8, 'rgba(168, 85, 247, 0.04)');
      ctx.fillStyle = milkyWay;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // Ambient Nebulae
      const nebula1 = ctx.createRadialGradient(width * 0.15, height * 0.25, 40, width * 0.15, height * 0.25, width * 0.5);
      nebula1.addColorStop(0, 'rgba(59, 130, 246, 0.09)');
      nebula1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, width, height);

      const nebula2 = ctx.createRadialGradient(width * 0.85, height * 0.7, 50, width * 0.85, height * 0.7, width * 0.55);
      nebula2.addColorStop(0, 'rgba(239, 68, 68, 0.06)');
      nebula2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, width, height);

      // Draw Twinkling Stars
      const now = Date.now() * 0.002;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const alpha = Math.min(1, Math.max(0.12, s.baseAlpha + Math.sin(now * s.twinkleSpeed * 10 + s.phase) * 0.45));

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.color;
        ctx.shadowBlur = s.radius > 1.2 ? 6 : 2;
        ctx.shadowColor = s.color;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();

        // 4-point sparkle cross for bright stars
        if (s.isCross && alpha > 0.55) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(s.x - 5, s.y);
          ctx.lineTo(s.x + 5, s.y);
          ctx.moveTo(s.x, s.y - 5);
          ctx.lineTo(s.x, s.y + 5);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Check spawn for idle shooting stars (every 1.5 to 2.8s)
      const currentTime = Date.now();
      if (currentTime - lastSpawnRef.current > Math.random() * 1300 + 1500) {
        spawnShootingStar(false);
        lastSpawnRef.current = currentTime;
      }

      // Update and Draw Shooting Stars (Meteors)
      const shootingStars = shootingStarsRef.current;
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += ss.dx;
        ss.y += ss.dy;
        ss.life++;

        // Smooth fade-in & fade-out
        let alpha = 1.0;
        if (ss.life < 6) {
          alpha = ss.life / 6;
        } else if (ss.life > ss.maxLife - 12) {
          alpha = Math.max(0, (ss.maxLife - ss.life) / 12);
        }

        if (ss.life >= ss.maxLife || ss.x > width + 250 || ss.y > height + 250) {
          shootingStars.splice(i, 1);
          continue;
        }

        const tailX = ss.x - (ss.dx / Math.hypot(ss.dx, ss.dy)) * ss.length;
        const tailY = ss.y - (ss.dy / Math.hypot(ss.dx, ss.dy)) * ss.length;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Radiant Meteor Tail Gradient
        const trailGrad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        trailGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        trailGrad.addColorStop(0.5, ss.color === '#fef08a' ? 'rgba(254, 240, 138, 0.45)' : 'rgba(147, 197, 253, 0.45)');
        trailGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.9)');
        trailGrad.addColorStop(1, '#ffffff');

        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = ss.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.stroke();

        // Brilliant glowing head
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = ss.isFast ? 18 : 12;
        ctx.shadowColor = ss.color === '#fef08a' ? '#fef08a' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, ss.size * 1.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', triggerInteractiveFastShooting);
      window.removeEventListener('touchstart', triggerInteractiveFastShooting);
      window.removeEventListener('touchmove', triggerInteractiveFastShooting);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
}

export default function AuthScreen() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Authentication failed. Verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full min-h-[100dvh] bg-slate-950 flex items-center justify-center p-4 overflow-hidden relative select-none">
      
      {/* Live Animated Starry Sky with Fast Shooting Stars on Mouse Hover & Touch */}
      <LiveSkyCanvas />

      {/* Atmospheric Cosmic Glow Effects */}
      <div className="absolute w-[550px] h-[550px] bg-red-600/12 rounded-full blur-[120px] -top-28 -left-28 pointer-events-none z-0"></div>
      <div className="absolute w-[550px] h-[550px] bg-blue-600/12 rounded-full blur-[120px] -bottom-28 -right-28 pointer-events-none z-0"></div>
      <div className="absolute w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"></div>

      {/* Glassmorphic Login Card */}
      <div className="relative z-10 bg-slate-900/85 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 max-w-md w-full shadow-2xl border border-white/10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="w-16 h-16 sm:w-18 sm:h-18 mx-auto rounded-2xl p-1 bg-slate-800/90 shadow-xl flex items-center justify-center overflow-hidden border border-white/15">
            <img src="https://ik.imagekit.io/xgxpgvop9/abstracker.jpg" alt="Abstracker Logo" className="w-full h-full object-cover rounded-xl" />
          </div>

          <div>
            {/* Refined Brand Logo Look */}
            <div className="flex items-center justify-center gap-0.5 tracking-[0.22em] text-xl sm:text-2xl font-black uppercase font-sans py-0.5">
              <span className="text-white drop-shadow-sm">ABSTR</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.45)]">ACKER</span>
            </div>
            <p className="text-[11px] font-bold tracking-wider mt-1 uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 flex items-center justify-center gap-1.5 drop-shadow-xs">
              <Sparkles size={12} className="text-amber-400 animate-pulse" />
              <span>Unconditional Aftersales Service</span>
              <Sparkles size={12} className="text-amber-400 animate-pulse" />
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Username / Email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <User size={16} />
              </span>
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition placeholder:text-slate-500" 
                placeholder="Enter username or email" 
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Key size={16} />
              </span>
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition placeholder:text-slate-500" 
                placeholder="Enter password" 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-red-600 via-red-500 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-red-600/25 disabled:opacity-60 cursor-pointer mt-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
          </button>
        </form>

        {error && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-center font-bold">
            {error}
          </div>
        )}

        {/* Centered Footer */}
        <div className="pt-4 border-t border-slate-800/80 text-center flex items-center justify-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span>Powered by</span>
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 font-mono text-sm tracking-wide drop-shadow-sm">
              Abstracker Team
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
