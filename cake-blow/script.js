// Define YouTube initialization early to avoid missing the API callback
// Remove YouTube-related globals
// let ytPlayer; const VIDEO_ID = "4sZmPHJPvZE"; let playerReady = false; let pendingUnmute = false; let unmuted = false;
let confettiTriggered = false; // track confetti state

document.addEventListener("DOMContentLoaded", function () {
  // Set up local audio instead of YouTube
  const bgAudio = document.getElementById('bgMusic') || new Audio('cake-blow/music.mp3');
  bgAudio.loop = true;
  try { bgAudio.volume = 0.8; } catch(_){}
  function tryPlay() { return bgAudio.play(); }
  // Aggressive autoplay retries: initial, periodic, on visibility change, and after mic permission
  let autoplaySucceeded = false;
  function attemptAutoplay() {
    if (autoplaySucceeded) return;
    tryPlay().then(()=>{ autoplaySucceeded = true; }).catch(()=>{});
  }
  attemptAutoplay();
  const retryTimer = setInterval(()=>{ if (!autoplaySucceeded) attemptAutoplay(); else clearInterval(retryTimer); }, 1200);
  document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'visible') attemptAutoplay(); });

  const cake = document.querySelector(".cake");
  const candleCountDisplay = document.getElementById("candleCount");
  let candles = [];
  let audioContext;
  let analyser;
  let microphone;

  // Microphone permission also counts as gesture; retry autoplay when granted
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      setInterval(blowOutCandles, 200);
      attemptAutoplay();
    }).catch(err => { console.log("Unable to access microphone: " + err); });
  }

  // Candle logic
  function updateCandleCount() {
    const active = candles.filter(c => !c.classList.contains("out")).length;
    candleCountDisplay.textContent = active;
  }
  function addCandle(left, top) {
    const candle = document.createElement("div");
    candle.className = "candle";
    candle.style.left = left + "px";
    candle.style.top = top + "px";
    const flame = document.createElement("div");
    flame.className = "flame";
    candle.appendChild(flame);
    cake.appendChild(candle);
    candles.push(candle);
    confettiTriggered = false; // allow retrigger after new candle added
    updateCandleCount();
  }
  cake.addEventListener("click", (event) => {
    const rect = cake.getBoundingClientRect();
    addCandle(event.clientX - rect.left, event.clientY - rect.top);
  });

  // Blow detection
  function isBlowing() {
    if (!analyser) return false;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
    return (sum / bufferLength) > 40;
  }
  function blowOutCandles() {
    if (!isBlowing()) return;
    let changed = false;
    candles.forEach(c => {
      if (!c.classList.contains("out") && Math.random() > 0.5) {
        c.classList.add("out");
        changed = true;
      }
    });
    if (changed) {
      updateCandleCount();
      // If all candles are out, fire confetti
      const anyCandles = candles.length > 0;
      const allOut = anyCandles && candles.every(c => c.classList.contains('out'));
      if (allOut && !confettiTriggered) {
        triggerConfetti();
        confettiTriggered = true;
      }
    }
  }

  // Birthday cat GIF loader fallback (enhanced debugging)
  const catImg = document.getElementById('birthdayCatGif');
  if (catImg) {
    const gifDebugStart = performance.now();
    const t = () => ( (performance.now() - gifDebugStart)/1000 ).toFixed(3);
    function dbg(msg){ console.log(`[GIF Debug ${t()}s] ${msg}`); }
    dbg('Init: found birthdayCatGif element');
    const initialSrc = catImg.getAttribute('src')||'(empty)';
    dbg('Initial src attribute: ' + initialSrc);

    // Directory presence hint (no birthday-cat.gif in list previously) - manual check
    if (typeof window !== 'undefined') {
      dbg('Hint: Ensure a real file named "birthday-cat.gif" exists in cake-blow/ (directory listing earlier showed none).');
    }

    // Allow external override: set window.BIRTHDAY_CAT_GIF_URL before DOMContentLoaded
    if (window.BIRTHDAY_CAT_GIF_URL) {
      dbg('Override detected: using window.BIRTHDAY_CAT_GIF_URL=' + window.BIRTHDAY_CAT_GIF_URL);
      catImg.src = window.BIRTHDAY_CAT_GIF_URL;
    }

    // Fetch probe
    try {
      fetch(catImg.src, { method:'GET' }).then(r => {
        dbg(`Fetch probe: url=${catImg.src} status=${r.status} ok=${r.ok}`);
        if(!r.ok) dbg('Fetch probe indicates missing or blocked resource');
      }).catch(e => dbg('Fetch probe error: ' + e));
    } catch(e){ dbg('Fetch initiation error: '+e); }

    // Resource timing observer
    try {
      const po = new PerformanceObserver((list)=>{
        for(const entry of list.getEntries()){
          if(entry.initiatorType === 'img' && entry.name === catImg.src){
            dbg(`ResourceTiming: duration=${entry.duration.toFixed(2)}ms transferSize=${entry.transferSize}`);
          }
        }
      });
      po.observe({ entryTypes:['resource'] });
    } catch(e){ dbg('PerformanceObserver unsupported: '+e); }

    let pollCount = 0;
    const poll = () => {
      pollCount++;
      dbg(`Poll ${pollCount}: naturalWidth=${catImg.naturalWidth} naturalHeight=${catImg.naturalHeight} complete=${catImg.complete}`);
      if (catImg.complete && catImg.naturalWidth > 4 && catImg.naturalHeight > 4) {
        dbg('Poll success: GIF appears loaded');
        return;
      }
      if (pollCount < 12) setTimeout(poll, 500); else dbg('Polling stopped after 12 attempts');
    };
    setTimeout(poll, 300);

    catImg.addEventListener('load', ()=>{
      dbg(`load event: naturalWidth=${catImg.naturalWidth} naturalHeight=${catImg.naturalHeight}`);
      if (catImg.naturalWidth < 5 || catImg.naturalHeight < 5) dbg('Loaded dimensions too small; likely placeholder or error response.');
    });
    catImg.addEventListener('error', ()=>{ dbg('error event: image failed to load (check path/filename/casing).'); });

    // Positioning logic to avoid overlap with cake
    function repositionCat() {
      const cakeEl = document.querySelector('.cake');
      const catFigure = catImg.closest('.birthday-cat');
      if (!cakeEl || !catFigure) return;
      // Temporarily ensure figure is visible to measure
      catFigure.style.visibility = 'hidden';
      catFigure.style.top = '0px';
      const cakeRect = cakeEl.getBoundingClientRect();
      const catRect = catFigure.getBoundingClientRect();
      const spacing = 16; // gap between cake and gif
      const viewportH = window.innerHeight;
      let targetTop;
      // Prefer placing above cake if room
      if (cakeRect.top - (catRect.height + spacing) >= 0) {
        targetTop = cakeRect.top - catRect.height - spacing;
      } else {
        // Place below cake
        targetTop = cakeRect.bottom + spacing;
        // If goes off bottom, clamp
        if (targetTop + catRect.height + spacing > viewportH) {
          targetTop = Math.max(0, viewportH - catRect.height - spacing);
        }
      }
      catFigure.style.top = targetTop + 'px';
      catFigure.style.visibility = 'visible';
    }

    function scheduleReposition() {
      requestAnimationFrame(()=>{ repositionCat(); });
    }

    // Reposition after load events & window resize
    window.addEventListener('resize', scheduleReposition);
    // Attempt periodic reposition in case cake animates
    setTimeout(scheduleReposition, 800);
    setTimeout(scheduleReposition, 1600);

    catImg.addEventListener('load', scheduleReposition);
    // If already complete (cached)
    if (catImg.complete) scheduleReposition();
  } else {
    console.log('[GIF Debug] No element with id birthdayCatGif found in DOM');
  }
});

// Confetti trigger function
function triggerConfetti() {
  const existing = document.querySelector('.confetti-container');
  if (existing) existing.remove();
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  const pieces = 120;
  const colors = ['#ff595e','#ffca3a','#8ac926','#1982c4','#6a4b18','#ad030f','#ff9f1c'];
  for (let i=0;i<pieces;i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const size = Math.random()*8 + 6;
    piece.style.width = size + 'px';
    piece.style.height = size*0.4 + 'px';
    piece.style.background = colors[i % colors.length];
    piece.style.left = (Math.random()*100) + 'vw';
    piece.style.animationDelay = (Math.random()*0.7) + 's';
    const fallDur = (Math.random()*2.5 + 4.5).toFixed(2);
    piece.style.animationDuration = fallDur + 's';
    piece.style.transform = `rotate(${Math.random()*360}deg)`;
    container.appendChild(piece);
  }
  // Auto cleanup after longest duration + delay margin
  const maxDuration = 7.5; // approximate
  setTimeout(()=>{ container.classList.add('fade'); setTimeout(()=>{ container.remove(); }, 1200); }, maxDuration*1000);
}

// Mobile fallback: tap a candle to blow it out if mic isn't available
function enableTapToBlowFallback() {
  const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!supportsTouch) return;
  document.addEventListener('pointerdown', (e) => {
    const target = e.target;
    const candleEl = target.closest && target.closest('.candle');
    if (!candleEl) return;
    // If analyser not ready or mic blocked, allow manual blow
    const micReady = !!analyser;
    if (!micReady) {
      if (!candleEl.classList.contains('out')) {
        candleEl.classList.add('out');
        updateCandleCount();
        const anyCandles = candles.length > 0;
        const allOut = anyCandles && candles.every(c => c.classList.contains('out'));
        if (allOut && !confettiTriggered) { triggerConfetti(); confettiTriggered = true; }
      }
    }
  });
}
enableTapToBlowFallback();
