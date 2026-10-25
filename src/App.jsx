import { useEffect, useRef, useState } from 'react';
import { profile, socials } from './config.js';
import { playSound, vibrate } from './sounds.js';

const IMG = '/assets/images';

const formatTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

// On iOS, motion/orientation sensors need permission requested from a user gesture.
function useSensor(eventName, PermissionClass, handler) {
  useEffect(() => {
    window.addEventListener(eventName, handler);
    const askPermission = async () => {
      try {
        const Cls = window[PermissionClass];
        if (Cls && typeof Cls.requestPermission === 'function' && (await Cls.requestPermission()) === 'granted') {
          window.addEventListener(eventName, handler);
        }
      } catch {}
    };
    window.addEventListener('click', askPermission, { once: true });
    return () => {
      window.removeEventListener(eventName, handler);
      window.removeEventListener('click', askPermission);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default function App() {
  // Stickers on the front
  const [ironManVisible, setIronManVisible] = useState(true);
  const [spideyVisible, setSpideyVisible] = useState(true);
  // Little click feedbacks
  const [scanning, setScanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tapeBounce, setTapeBounce] = useState(false);
  const [claspSwing, setClaspSwing] = useState(false);
  const [shaking, setShaking] = useState(false);
  // Flip state
  const [flipped, setFlipped] = useState(false);
  const [heroesDown, setHeroesDown] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [swingGwen, setSwingGwen] = useState(false);
  const [swingSpidey, setSwingSpidey] = useState(false);
  const [swingMiles, setSwingMiles] = useState(false);
  // Live data
  const [time, setTime] = useState(formatTime);
  const [battery, setBattery] = useState(94);
  const [charging, setCharging] = useState(true);
  const [sparkles, setSparkles] = useState([]);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [pendingLink, setPendingLink] = useState(null);
  const [portraitIndex, setPortraitIndex] = useState(0);

  const lastSparkle = useRef(0);
  const lastShake = useRef(0);
  const pressStart = useRef(null);
  const flipLock = useRef(false);
  const timers = useRef({});
  const touchStart = useRef(null);
  const mouseStartX = useRef(null);

  const later = (key, fn, ms) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  };
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  // Parallax tilt from the phone's orientation
  useSensor('deviceorientation', 'DeviceOrientationEvent', (e) => {
    const x = Math.max(-20, Math.min(20, e.gamma || 0));
    const y = Math.max(-20, Math.min(20, (e.beta || 0) - 45));
    setTilt({ x: x * 0.35, y: y * 0.35 });
  });

  // Shake the phone to shake the card
  useSensor('devicemotion', 'DeviceMotionEvent', (e) => {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a) return;
    const force = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    const now = Date.now();
    if (force > 16.5 && now - lastShake.current > 1200) {
      lastShake.current = now;
      setShaking(true);
      playSound('tape');
      setTimeout(() => setShaking(false), 550);
    }
  });

  // Clock
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(id);
  }, []);

  // Real battery level where supported
  useEffect(() => {
    navigator
      .getBattery?.()
      .then((b) => {
        setBattery(Math.round(b.level * 100));
        setCharging(b.charging);
        b.addEventListener('levelchange', () => setBattery(Math.round(b.level * 100)));
        b.addEventListener('chargingchange', () => setCharging(b.charging));
      })
      .catch(() => {});
  }, []);

  // Fade out the glint trail
  useEffect(() => {
    const id = setInterval(() => setSparkles((s) => s.slice(1)), 150);
    return () => clearInterval(id);
  }, []);

  const addSparkle = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const now = Date.now();
    if (now - lastSparkle.current < 50) return;
    lastSparkle.current = now;
    const sparkle = {
      id: Math.random(),
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      angle: (Math.random() - 0.5) * 60,
    };
    setSparkles((s) => [...s.slice(-10), sparkle]);
  };

  const flipCard = () => {
    if (flipLock.current) return;
    flipLock.current = true;
    setFlipping(true);
    const unlock = () => {
      flipLock.current = false;
      setFlipping(false);
    };
    if (flipped) {
      playSound('zip');
      setHeroesDown(false);
      later('flip', () => {
        playSound('flip');
        setFlipped(false);
        later('unlock', unlock, 650);
      }, 360);
    } else {
      playSound('flip');
      setFlipped(true);
      later('flip', () => {
        playSound('zip');
        setHeroesDown(true);
        later('unlock', unlock, 600);
      }, 300);
    }
  };

  const switchPortrait = (e) => {
    e.stopPropagation();
    playSound('contact');
    vibrate(25);
    setPortraitIndex((i) => (i + 1) % profile.portraits.length);
  };

  // Ignore clicks that were really drags/swipes
  const openSocial = (social, e) => {
    e.stopPropagation();
    if (flipping) return;
    if (pressStart.current) {
      const dx = Math.abs(e.clientX - pressStart.current.x);
      const dy = Math.abs(e.clientY - pressStart.current.y);
      pressStart.current = null;
      if (dx > 12 || dy > 12) return;
    }
    e.preventDefault();
    playSound('contact');
    vibrate(35);
    setPendingLink(social);
  };

  const tapSticker = (sound, pattern, hide, show, key) => (e) => {
    e.stopPropagation();
    playSound(sound);
    vibrate(pattern);
    hide();
    later(key, () => {
      playSound('respawn');
      vibrate(30);
      show();
    }, 5000);
  };

  const swingHero = (setter, pattern) => (e) => {
    e.stopPropagation();
    playSound('zip');
    vibrate(pattern);
    setter(true);
    setTimeout(() => setter(false), 800);
  };

  const heroes = [
    { src: `${IMG}/gwen.png`, alt: 'Spider-Gwen', width: 'w-10 sm:w-11', swinging: swingGwen, onClick: swingHero(setSwingGwen, 30), idle: 'animate-continuous-swing-gwen', inT: '540ms cubic-bezier(0.18, 0.89, 0.32, 1.2)', outT: '320ms cubic-bezier(0.4, 0, 0.2, 1)' },
    { src: `${IMG}/spiderman_hanging.png`, alt: 'Spider-Man', width: 'w-8 sm:w-9', swinging: swingSpidey, onClick: swingHero(setSwingSpidey, [35, 30, 35]), idle: 'animate-continuous-swing-spidey', inT: '570ms cubic-bezier(0.18, 0.89, 0.32, 1.2) 40ms', outT: '320ms cubic-bezier(0.4, 0, 0.2, 1) 25ms' },
    { src: `${IMG}/miles.png`, alt: 'Miles Morales', width: 'w-9 sm:w-10', swinging: swingMiles, onClick: swingHero(setSwingMiles, 30), idle: 'animate-continuous-swing-miles', inT: '550ms cubic-bezier(0.18, 0.89, 0.32, 1.2) 80ms', outT: '320ms cubic-bezier(0.4, 0, 0.2, 1) 50ms' },
  ];

  const plasticWrap = (screenOpacity, overlayOpacity) => (
    <>
      <img src={`${IMG}/plastic-wrap.png`} alt="" className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-30 select-none mix-blend-screen ${screenOpacity}`} />
      <img src={`${IMG}/plastic-wrap.png`} alt="" className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-30 select-none mix-blend-overlay ${overlayOpacity}`} />
    </>
  );

  return (
    <div className="bg-dark-textured min-h-screen flex flex-col items-center justify-start py-0 px-3 overflow-x-hidden antialiased select-none">
      {/* ---------- Lanyard + clasp ---------- */}
      <header
        onClick={() => {
          playSound('clasp');
          setClaspSwing(true);
          setTimeout(() => setClaspSwing(false), 850);
        }}
        className={`relative z-30 flex flex-col items-center w-full cursor-pointer transition-transform duration-300 ${claspSwing ? 'animate-swing' : ''}`}
        title="Tap to jiggle lanyard clasp"
      >
        <div className="w-10 h-16 bg-[#F5B800] shadow-md border-x border-[#c98e09] flex flex-col justify-end items-center relative">
          <div className="absolute inset-y-0 left-1 w-[1px] bg-amber-600/40" />
          <div className="absolute inset-y-0 right-1 w-[1px] bg-amber-600/40" />
          <div className="w-12 h-3.5 bg-gradient-to-r from-zinc-400 via-zinc-200 to-zinc-400 border border-zinc-500 rounded-sm shadow-sm flex items-center justify-center">
            <div className="w-10 h-[1.5px] bg-zinc-600/60" />
          </div>
        </div>
        <div className="relative flex flex-col items-center -mt-0.5">
          <div className="w-5 h-3 border-2 border-zinc-400 rounded-sm bg-gradient-to-b from-zinc-300 to-zinc-500 shadow-inner" />
          <svg className="w-8 h-10 drop-shadow-md -mt-1" fill="none" stroke="currentColor" viewBox="0 0 36 44">
            <defs>
              <linearGradient id="goldMetal" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#fff4b8" />
                <stop offset="35%" stopColor="#f5b800" />
                <stop offset="70%" stopColor="#d49400" />
                <stop offset="100%" stopColor="#8a5c00" />
              </linearGradient>
            </defs>
            <path d="M14 2 H22 V10 H14 Z" fill="url(#goldMetal)" stroke="#785000" strokeWidth="1" />
            <path d="M18 10 C12.5 15 10.5 21 11.5 29 C12.5 35 15.5 39 18 42 C20.5 39 23.5 35 24.5 29 C25.5 21 23.5 15 18 10 Z" fill="url(#goldMetal)" stroke="#664300" strokeWidth="1.2" />
            <path d="M16 16 L20 26" stroke="#fff9d2" strokeLinecap="round" strokeWidth="1.5" />
          </svg>
        </div>
      </header>

      {/* ---------- Badge ---------- */}
      <main className={`relative -mt-4 w-full max-w-[380px] mb-12 perspective-1000 animate-badge-torsional ${shaking ? 'animate-card-shake' : ''}`}>
        <div
          className={`absolute -inset-8 rounded-[40px] pointer-events-none transition-all duration-700 ease-in-out opacity-80 blur-2xl z-[-1] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] animate-pulse ${flipped ? 'from-red-600/35 via-purple-600/20 to-transparent' : 'from-amber-500/30 via-cyan-500/15 to-transparent'}`}
        />

        <div
          onDoubleClick={flipCard}
          onTouchStart={(e) => {
            touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            if (!touchStart.current) return;
            const dx = e.changedTouches[0].clientX - touchStart.current.x;
            const dy = e.changedTouches[0].clientY - touchStart.current.y;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.1) flipCard();
            touchStart.current = null;
          }}
          onMouseDown={(e) => {
            mouseStartX.current = e.clientX;
          }}
          onMouseUp={(e) => {
            if (mouseStartX.current === null) return;
            if (Math.abs(e.clientX - mouseStartX.current) > 45) flipCard();
            mouseStartX.current = null;
          }}
          className={`relative w-full preserve-3d transition-transform duration-700 ease-in-out cursor-pointer ${flipped ? 'rotate-y-180' : ''}`}
          title="Double click or swipe left/right to flip card"
        >
          {/* ===== FRONT ===== */}
          <div
            onMouseMove={addSparkle}
            className={`relative bg-[#ffffff] rounded-[28px] border border-zinc-200/90 badge-card-shadow px-4 pt-3 pb-5 flex flex-col overflow-hidden backface-hidden transition-opacity duration-300 ${flipped ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'}`}
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-35 overflow-hidden">
              {sparkles.map((s, i) => (
                <line
                  key={s.id}
                  x1={s.x - 14}
                  y1={s.y}
                  x2={s.x + 14}
                  y2={s.y}
                  stroke="rgba(255, 255, 255, 0.75)"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  transform={`rotate(${s.angle} ${s.x} ${s.y})`}
                  style={{ opacity: (i + 1) / sparkles.length }}
                  className="transition-opacity duration-300"
                />
              ))}
            </svg>
            {plasticWrap('opacity-90', 'opacity-40')}

            {/* Header row: name / slot / clock */}
            <section
              className="relative w-full flex items-center justify-between pt-1 pb-2 px-1"
              style={{ transform: `translate(${tilt.x * 0.4}px, ${tilt.y * 0.4}px)`, transition: 'transform 0.1s ease-out' }}
            >
              <div className="flex flex-col text-left leading-tight z-10">
                <span className="font-michroma text-[12px] font-bold text-black tracking-wider">{profile.name}</span>
                <span className="font-michroma text-[7.5px] font-semibold text-black tracking-wider mt-0.5">{profile.role}</span>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 -top-1 flex flex-col items-center z-10">
                <div className="w-12 h-3 bg-[#111111] rounded-full border-[1.5px] border-zinc-400 shadow-inner flex items-center justify-center">
                  <div className="w-2.5 h-3 bg-gradient-to-b from-amber-400 to-amber-600 rounded-sm opacity-95" />
                </div>
              </div>
              <div className="flex items-center justify-end z-10">
                <span className="font-techno-capsule font-extrabold text-[12px] sm:text-[13px] leading-none text-black tracking-tight">{time}</span>
              </div>
            </section>

            {/* Portrait frame */}
            <section
              className="relative w-full mt-1 z-20"
              style={{ transform: `translate(${tilt.x * 0.9}px, ${tilt.y * 0.9}px)`, transition: 'transform 0.1s ease-out' }}
            >
              <div className="w-full relative border-[2.2px] border-black rounded-none overflow-hidden flex items-end justify-center aspect-[1/1.1] bg-[#f4f2ee]">
                <img src={`${IMG}/grid-paper.png`} alt="" className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none" />

                <div
                  onClick={switchPortrait}
                  className="relative w-full h-[98%] flex items-end justify-center z-10 overflow-hidden cursor-pointer pointer-events-auto"
                  title="Click portrait to switch outfit/pose!"
                >
                  {profile.portraits.map((src, i) => (
                    <img
                      key={src}
                      alt={`Portrait ${i + 1}`}
                      src={src}
                      draggable={false}
                      className={`absolute bottom-0 h-full w-auto max-w-full object-contain object-bottom select-none transition-all duration-500 ease-out transform ${portraitIndex === i ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-95 -rotate-1 pointer-events-none'}`}
                    />
                  ))}
                </div>

                {/* Battery pill */}
                <div className="absolute top-2 right-2 z-20 bg-black/75 backdrop-blur-sm text-amber-300 font-techno-capsule text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md border border-amber-500/40 shadow-sm flex items-center gap-1.5 select-none pointer-events-none">
                  <span>{battery}%</span>
                  <div className="w-5 h-2.5 border border-amber-300 rounded-[2px] p-0.5 flex items-center">
                    <div className="h-full bg-amber-400 rounded-[1px] transition-all duration-300" style={{ width: `${Math.max(10, battery)}%` }} />
                  </div>
                  {charging && <span className="text-amber-400 text-[9px]">⚡</span>}
                </div>

                {/* Spider-Man sticker */}
                <div
                  onClick={spideyVisible ? tapSticker('spiderman', [30, 40, 30], () => setSpideyVisible(false), () => setSpideyVisible(true), 'spidey') : undefined}
                  className={`absolute top-0 left-2 z-30 cursor-pointer select-none transition-all duration-1000 ease-in-out transform ${spideyVisible ? '-translate-y-0.5 opacity-100 scale-100 pointer-events-auto animate-spidey-front-float' : '-translate-y-[150%] opacity-0 pointer-events-none scale-75'}`}
                  title={spideyVisible ? 'Tap Spider-Man to zip up and disappear!' : ''}
                >
                  <img src={`${IMG}/spiderman.png`} alt="Spider-Man" className="w-16 sm:w-20 h-auto drop-shadow-md hover:scale-105 active:scale-95 transition-transform duration-200" />
                </div>

                {/* Iron Man sticker */}
                <div
                  onClick={ironManVisible ? tapSticker('ironman', [40, 50, 40], () => setIronManVisible(false), () => setIronManVisible(true), 'ironman') : undefined}
                  className={`absolute bottom-0 right-1 z-20 cursor-pointer select-none transition-all duration-1000 ease-in-out transform ${ironManVisible ? 'translate-y-1 opacity-100 scale-100 pointer-events-auto animate-iron-man-squeeze' : 'translate-y-[135%] opacity-0 pointer-events-none scale-75'}`}
                  title={ironManVisible ? 'Tap Iron Man to slide down and disappear!' : ''}
                >
                  <img src={`${IMG}/ironman.png`} alt="Iron Man" className="w-20 sm:w-24 h-auto drop-shadow-md hover:scale-105 active:scale-95 transition-transform duration-200" />
                </div>
              </div>
            </section>

            {/* Motto + handle */}
            <section className="w-full mt-3 mb-2 px-0.5 flex items-center justify-between gap-2">
              <div className="flex flex-col leading-[1.1] shrink-0 group cursor-default">
                <span className="font-michroma text-[9px] font-bold tracking-wider text-black uppercase transition-colors group-hover:text-amber-600">{profile.mottoLine1}</span>
                <span className="font-michroma text-[9px] font-bold tracking-wider text-black mt-0.5 uppercase transition-colors group-hover:text-amber-600">{profile.mottoLine2}</span>
              </div>
              <div className="flex-1 text-right overflow-hidden group cursor-default">
                <h2 className="font-wide-trotoart text-[21px] sm:text-[23px] font-bold text-black tracking-tight uppercase whitespace-nowrap inline-block transition-colors group-hover:text-amber-600">
                  {profile.handle}
                </h2>
              </div>
            </section>

            {/* Info modules */}
            <section className="w-full grid grid-cols-2 gap-2.5 items-stretch relative mt-0.5 pb-1">
              {/* Bio + barcode */}
              <article
                onClick={(e) => {
                  e.stopPropagation();
                  playSound('barcode');
                  setScanning(true);
                  setTimeout(() => setScanning(false), 800);
                }}
                className="bg-[#111111] rounded-[2px] p-2 flex flex-col justify-between relative shadow-sm text-white min-h-[96px] cursor-pointer hover:border-amber-400/50 border border-transparent transition-all duration-200 hover:scale-[1.015] active:scale-[0.985] overflow-hidden"
                title="Click to scan barcode with sound effect"
              >
                {scanning && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] pointer-events-none z-20 animate-scanline" />
                )}
                <div className="flex justify-between items-start gap-1">
                  <div className="text-[9px] font-space font-medium leading-[1.3] text-zinc-300">
                    {profile.bio.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                  <div className="flex flex-col items-center flex-shrink-0 relative">
                    <svg className={`h-8 w-4 text-white transition-opacity ${scanning ? 'opacity-70' : 'opacity-100'}`} fill="currentColor" viewBox="0 0 20 48">
                      {[[0, 1.8], [3, 0.9], [5.5, 2.4], [9, 1.2], [11.5, 0.8], [13.5, 2.6], [17.2, 1.5]].map(([x, w]) => (
                        <rect key={x} height="40" width={w} x={x} y="0" />
                      ))}
                      <text fill="#ffffff" fontFamily="'Space Grotesk', monospace" fontSize="4.5" letterSpacing="0.5" textAnchor="middle" x="10" y="47">
                        {profile.barcodeNumber}
                      </text>
                    </svg>
                  </div>
                </div>
                <div className="mt-3 leading-none">
                  <p className="font-michroma text-[10.5px] font-extrabold tracking-tight text-[#ffcc00]">{profile.badgeTitleTop}</p>
                  <p className="font-michroma text-[11px] font-black tracking-tight text-white mt-1">{profile.badgeTitleBottom}</p>
                </div>
              </article>

              {/* Contact */}
              <article
                onClick={(e) => {
                  e.stopPropagation();
                  playSound('contact');
                  navigator.clipboard?.writeText(`Phone: ${profile.phone} | Email: ${profile.email}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="bg-white rounded-[2px] p-2 flex flex-col justify-between shadow-sm min-h-[96px] text-black border border-zinc-200/80 cursor-pointer hover:border-black transition-all duration-200 hover:scale-[1.015] active:scale-[0.985] relative"
                title="Click to copy contact details"
              >
                {copied && (
                  <div className="absolute top-1 right-1 bg-emerald-600 text-white text-[6px] font-bold px-1.5 py-0.5 rounded shadow z-20 animate-bounce">COPIED!</div>
                )}
                <div>
                  <div className="w-full h-[1px] bg-zinc-300 mt-1 mb-1.5 opacity-0" />
                  <div className="text-center py-0.5">
                    <h3 className="font-serif-display text-[19px] font-black text-black tracking-wider leading-none">CONTACT</h3>
                    <div className="w-12 h-[1.5px] bg-black mx-auto mt-1" />
                  </div>
                </div>
                <div>
                  <div className="w-full h-[1px] bg-zinc-300 mb-1 mt-1" />
                  <div className="text-[8px] text-zinc-600 font-space text-center leading-[1.4] font-normal break-all">
                    <p>Phone: {profile.phone}</p>
                    <p className="mt-0.5">Email: {profile.email}</p>
                  </div>
                </div>
              </article>

              {/* Tape cross */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  playSound('tape');
                  setTapeBounce(true);
                  setTimeout(() => setTapeBounce(false), 450);
                }}
                className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-40 cursor-pointer"
                title="Tap tape to peel"
              >
                <div className={`relative w-10 h-10 flex items-center justify-center ${tapeBounce ? 'animate-tape-bounce' : ''}`}>
                  <div className="absolute w-10 h-3.5 tape-strip-realistic -rotate-45 transform" />
                  <div className="absolute w-10 h-3.5 tape-strip-realistic rotate-45 transform" />
                </div>
              </div>
            </section>
          </div>

          {/* ===== BACK ===== */}
          <div
            className={`absolute inset-0 bg-[#e1e2de] rounded-[28px] border border-zinc-200/90 badge-card-shadow flex flex-col overflow-hidden backface-hidden rotate-y-180 transition-opacity duration-300 ${flipped ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            <img src={`${IMG}/card-back.png`} alt="" className="absolute inset-0 w-full h-full object-cover select-none" draggable={false} />

            {/* Hanging spider-heroes */}
            <div className="absolute inset-x-0 top-[4.5%] bottom-0 overflow-hidden pointer-events-none z-20">
              <div className="absolute inset-x-0 top-[3.5%] flex items-start justify-center gap-1.5 sm:gap-2.5">
                {heroes.map((h) => (
                  <div
                    key={h.alt + h.src}
                    className="pointer-events-auto"
                    style={{
                      transform: heroesDown ? 'translateY(0)' : 'translateY(-140%)',
                      opacity: heroesDown ? 1 : 0,
                      transition: heroesDown ? `transform ${h.inT}, opacity 320ms ease-out` : `transform ${h.outT}, opacity 240ms ease-in`,
                    }}
                  >
                    <div
                      onClick={h.onClick}
                      className={`cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95 ${h.swinging ? 'animate-swing' : heroesDown ? h.idle : ''}`}
                      title={`Tap ${h.alt} to swing`}
                    >
                      <img src={h.src} alt={h.alt} className={`${h.width} h-auto drop-shadow-md select-none`} draggable={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Socials box */}
            <div className="absolute top-[23.5%] left-1/2 -translate-x-1/2 w-[82%] max-w-[285px] z-10 select-none pointer-events-none">
              <img src={`${IMG}/socials-box.png`} alt="" className="w-full h-auto object-contain select-none drop-shadow-sm" draggable={false} />
            </div>
            <div className="absolute top-[36.5%] left-1/2 -translate-x-1/2 w-[80%] max-w-[265px] z-50 pointer-events-auto grid grid-cols-2 gap-x-3 gap-y-2 items-center justify-items-center text-center">
              {socials.map((s) => (
                <button
                  key={s.platform}
                  type="button"
                  onClick={(e) => openSocial(s, e)}
                  onMouseDown={(e) => {
                    pressStart.current = { x: e.clientX, y: e.clientY };
                  }}
                  onTouchStart={(e) => {
                    if (e.touches[0]) pressStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                  }}
                  className="flex flex-col items-center justify-center group cursor-pointer w-full relative z-50 pointer-events-auto select-none bg-transparent border-none outline-none p-0"
                  title={`${s.platform} Profile`}
                >
                  <img
                    src={s.icon}
                    alt={s.platform}
                    draggable={false}
                    className={`w-[62px] h-[62px] sm:w-[74px] sm:h-[74px] select-none group-hover:scale-110 active:scale-95 transition-transform filter drop-shadow-md pointer-events-none ${s.round ? 'object-cover rounded-full' : 'object-contain'}`}
                  />
                  <span className="font-michroma text-[10px] sm:text-[11.5px] font-black text-black mt-0.5 tracking-tight pointer-events-none">{s.platform}</span>
                </button>
              ))}
            </div>

            {plasticWrap('opacity-75', 'opacity-30')}
          </div>
        </div>

        <div
          onClick={flipCard}
          className="text-center mt-3 text-[10px] text-zinc-400 font-mono tracking-wider opacity-60 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>{flipped ? '🔄 Double-click or swipe to flip back to front' : '🔄 Double-click or swipe left/right to flip card'}</span>
        </div>
      </main>

      {/* ---------- "Open profile?" popup ---------- */}
      {pendingLink && (
        <div onClick={() => setPendingLink(null)} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[320px] bg-yellow-400/90 backdrop-blur-md border-[2.5px] border-yellow-300 rounded-2xl p-5 shadow-[0_0_30px_rgba(250,204,21,0.4)] text-black flex flex-col items-center text-center animate-pop-in relative overflow-hidden"
          >
            <div className="absolute -top-12 -left-12 w-36 h-36 bg-white/40 rounded-full blur-xl pointer-events-none" />
            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center shadow-md mb-3 border border-amber-300/80">
              <span className="font-michroma text-[11px] font-black text-amber-300 tracking-wider uppercase">{pendingLink.short}</span>
            </div>
            <h3 className="font-michroma text-[13px] font-black text-black tracking-wide uppercase mb-1">OPENING PROFILE</h3>
            <p className="font-space text-[12px] font-bold text-zinc-900 leading-snug mb-5 px-1">
              Opening {profile.name.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ')}'s{' '}
              <span className="underline decoration-black underline-offset-2">{pendingLink.platform}</span> page.
            </p>
            <div className="flex items-center justify-center gap-3 w-full">
              <button
                onClick={() => setPendingLink(null)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-black/15 hover:bg-black/25 active:scale-95 text-black font-michroma text-[11px] font-bold tracking-wider transition-all border border-black/25"
              >
                LATER
              </button>
              <button
                onClick={() => {
                  window.open(pendingLink.url, '_blank', 'noopener,noreferrer');
                  setPendingLink(null);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-black hover:bg-zinc-900 active:scale-95 text-amber-300 font-michroma text-[11px] font-black tracking-wider shadow-lg transition-all border border-black"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
