// Define YouTube initialization early to avoid missing the API callback
let ytPlayer; // global player reference
const VIDEO_ID = "4sZmPHJPvZE";
let playerReady = false;
let pendingUnmute = false;
let unmuted = false;
let confettiTriggered = false; // track confetti state

function initYouTubePlayer() {
  if (ytPlayer) return;
  const container = document.getElementById('youtubePlayerContainer');
  if (!container) return;
  if (!(window.YT && window.YT.Player)) return;
  ytPlayer = new YT.Player('youtubePlayerContainer', {
    height: '0', width: '0', videoId: VIDEO_ID,
    playerVars: { autoplay: 1, mute: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
    events: {
      onReady: () => {
        playerReady = true;
        try { ytPlayer.mute(); } catch(e){}
        try { ytPlayer.playVideo(); } catch(e){}
        if (pendingUnmute) performUnmute();
      },
      onStateChange: (e) => {
        if (e.data === 0) { // ended
          try { ytPlayer.playVideo(); } catch(_){}
        }
      }
    }
  });
}
// Assign global callback BEFORE DOMContentLoaded so API can call it
window.onYouTubeIframeAPIReady = function() { initYouTubePlayer(); };

document.addEventListener("DOMContentLoaded", function () {
  const cake = document.querySelector(".cake");
  const candleCountDisplay = document.getElementById("candleCount");
  let candles = [];
  let audioContext;
  let analyser;
  let microphone;

  // If API already loaded before DOMContentLoaded, ensure player is initialized
  if (window.YT && window.YT.Player) initYouTubePlayer();

  function performUnmute(){
    if (!playerReady) { pendingUnmute = true; return; }
    if (unmuted) return;
    try { ytPlayer.unMute(); } catch(e){}
    try { ytPlayer.setVolume(100); } catch(e){}
    try { ytPlayer.playVideo(); } catch(e){}
    unmuted = true;
  }
  function unmuteAndEnsurePlaying(){ performUnmute(); }

  // First user gesture (anywhere) will unmute
  ['pointerdown','keydown','touchstart'].forEach(evt => {
    document.addEventListener(evt, () => { unmuteAndEnsurePlaying(); }, { once:true, passive:true });
  });

  // Microphone permission also counts as gesture; unmute when granted
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      setInterval(blowOutCandles, 200);
      unmuteAndEnsurePlaying();
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

  // Fallback iframe if API blocked
  setTimeout(() => {
    if (!ytPlayer) {
      const container = document.getElementById('youtubePlayerContainer');
      if (container && !container.querySelector('iframe')) {
        const iframe = document.createElement('iframe');
        iframe.width='0'; iframe.height='0';
        iframe.src=`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&mute=1&playsinline=1&controls=0`;
        iframe.allow='autoplay';
        container.appendChild(iframe);
      }
    }
  }, 5000);

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
