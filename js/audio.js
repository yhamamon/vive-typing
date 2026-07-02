"use strict";
/* =========================================================================
   VTAudio: Web Audio API による音楽エンジン（音源ファイル不要・すべて合成）
   ・BGM は lookahead スケジューラ方式（AudioContext.currentTime が基準時計）
   ・リズム判定用に「最寄りの8分音符からのズレ(ms)」を提供する
   ========================================================================= */
const VTAudio = (function(){
  let ctx = null, master = null;

  // ---- 音名("C4"等) → 周波数(Hz) ----
  const NOTE_INDEX = {"C":0,"C#":1,"D":2,"D#":3,"E":4,"F":5,"F#":6,"G":7,"G#":8,"A":9,"A#":10,"B":11};
  function noteHz(name){
    const m = /^([A-G]#?)(\d)$/.exec(name);
    if(!m) return 440;
    const midi = NOTE_INDEX[m[1]] + (parseInt(m[2],10)+1)*12;
    return 440 * Math.pow(2, (midi-69)/12);
  }

  // AudioContext はユーザー操作（クリック等）の後でないと音が出ない
  function ensure(){
    if(!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if(ctx.state === "suspended") ctx.resume();
  }

  // ---- 共通部品 ----
  let noiseBuf = null;
  function noiseSrc(){ // ホワイトノイズ（スネア・ハイハット用）
    if(!noiseBuf){
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate*0.3), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  }
  function envGain(t, vol, dur){ // 減衰エンベロープ付き GainNode
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    g.connect(master);
    return g;
  }

  // ---- ドラム・ベース（時刻tにスケジュール） ----
  function kick(t){
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t+0.12);
    o.connect(envGain(t, .9, .15)); o.start(t); o.stop(t+0.16);
  }
  function snare(t){
    const s = noiseSrc();
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = .8;
    s.connect(f); f.connect(envGain(t, .5, .12)); s.start(t); s.stop(t+0.13);
  }
  function hat(t){
    const s = noiseSrc();
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000;
    s.connect(f); f.connect(envGain(t, .18, .04)); s.start(t); s.stop(t+0.05);
  }
  function bass(t, hz, dur, genre){
    const o = ctx.createOscillator();
    o.type = (genre === "metal") ? "sawtooth" : "triangle";
    o.frequency.value = hz;
    const f = ctx.createBiquadFilter(); f.type = "lowpass";
    f.frequency.value = (genre === "metal") ? 900 : 500;
    o.connect(f); f.connect(envGain(t, .35, dur));
    o.start(t); o.stop(t+dur+0.02);
  }

  // ---- ジャンル別ドラムパターン（1小節 = 8分音符×8ステップ） ----
  const PATTERNS = {
    pop:    { kick:[1,0,1,0,1,0,1,0], snare:[0,0,1,0,0,0,1,0], hat:[1,1,1,1,1,1,1,1], bassOn:[1,0,0,1,0,0,1,0] },
    metal:  { kick:[1,1,0,1,1,0,1,1], snare:[0,0,1,0,0,0,1,0], hat:[1,1,1,1,1,1,1,1], bassOn:[1,1,1,1,1,1,1,1] },
    anison: { kick:[1,0,1,0,1,0,1,0], snare:[0,0,1,0,0,0,1,1], hat:[0,1,0,1,0,1,0,1], bassOn:[1,0,1,1,0,1,1,0] },
  };

  // ---- BGM スケジューラ ----
  const bgm = { playing:false, song:null, startTime:0, stepDur:0, step:0, nextTime:0, timer:null };

  function startBGM(song){
    ensure();
    stopBGM();
    bgm.song = song;
    bgm.stepDur = 60/song.bpm/2;             // 8分音符の長さ（秒）
    bgm.startTime = ctx.currentTime + 0.15;
    bgm.nextTime = bgm.startTime;
    bgm.step = 0;
    bgm.playing = true;
    bgm.timer = setInterval(schedule, 25);   // 25ms間隔で先読みスケジュール
  }
  function schedule(){
    while(bgm.nextTime < ctx.currentTime + 0.12){
      const p = PATTERNS[bgm.song.genre];
      const s = bgm.step % 8;
      const bar = Math.floor(bgm.step/8) % bgm.song.bass.length;
      if(p.kick[s])   kick(bgm.nextTime);
      if(p.snare[s])  snare(bgm.nextTime);
      if(p.hat[s])    hat(bgm.nextTime);
      if(p.bassOn[s]) bass(bgm.nextTime, noteHz(bgm.song.bass[bar]), bgm.stepDur*0.9, bgm.song.genre);
      bgm.step++;
      bgm.nextTime += bgm.stepDur;
    }
  }
  function stopBGM(){
    if(bgm.timer){ clearInterval(bgm.timer); bgm.timer = null; }
    bgm.playing = false;
  }

  // ---- リズム判定：最寄りの8分音符からのズレ(ms)。BGM停止中は null ----
  function beatOffsetMs(){
    if(!bgm.playing) return null;
    const t = ctx.currentTime - bgm.startTime;
    if(t < 0) return null;
    const off = t % bgm.stepDur;
    return Math.min(off, bgm.stepDur - off) * 1000;
  }

  // ---- 拍（4分音符）内の位相 0..1（ビートインジケータの脈動用） ----
  function beatPhase(){
    if(!bgm.playing) return null;
    const beat = bgm.stepDur * 2;
    const t = ctx.currentTime - bgm.startTime;
    if(t < 0) return null;
    return (t % beat) / beat;
  }

  // ---- メロディ音（正解キーを打つと1音鳴る） ----
  function melody(noteName, genre){
    ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = (genre === "metal") ? "sawtooth" : "square";
    o.frequency.value = noteHz(noteName);
    o.connect(envGain(t, .22, .28));
    o.start(t); o.stop(t+0.3);
  }

  // ---- ミス音（外れた不協和音） ----
  function miss(){
    ensure();
    const t = ctx.currentTime;
    [110, 116].forEach(hz => {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz;
      o.connect(envGain(t, .25, .18)); o.start(t); o.stop(t+0.2);
    });
  }

  // ---- 解放音（洗脳が解けた・上昇アルペジオ） ----
  function freeChime(){
    ensure();
    const t = ctx.currentTime;
    ["C5","E5","G5","C6"].forEach((n, i) => {
      const st = t + i*0.06;
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = noteHz(n);
      o.connect(envGain(st, .3, .25)); o.start(st); o.stop(st+0.3);
    });
  }

  // ---- 被ダメージ音（敵に到達された） ----
  function damage(){
    ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "square";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(55, t+0.25);
    o.connect(envGain(t, .4, .3)); o.start(t); o.stop(t+0.32);
  }

  return { ensure, startBGM, stopBGM, beatOffsetMs, beatPhase, melody, miss, freeChime, damage };
})();
