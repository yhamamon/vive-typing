"use strict";
/* =========================================================================
   VTGame: ゲーム本体（状態管理・敵・ダメージ計算・メインループ）
   ========================================================================= */
(function(){
  const $ = id => document.getElementById(id);
  const field = $("field");

  // ---- ゲームバランス調整値 ----
  const CFG = {
    zakoHp: 12,              // ザコの洗脳度（HP）
    bossHp: 70,              // ボスの洗脳度
    zakoToBoss: 10,          // 何人解放でボス出現か
    spawnEvery: 1.7,         // 敵の出現間隔（秒）
    baseSpeed: 0.035,        // 敵の速さ（画面横幅に対する割合/秒）
    reachDamage: 15,         // 敵に到達されたときのダメージ
    bossReachDamage: 30,
    phraseBonus: 4,          // フレーズ完走ボーナスダメージ
    judge: { perfectMs:70, goodMs:140, perfectMult:2.0, goodMult:1.5 },
    affinityMult: 1.5,       // 「刺さってる」（ジャンル一致）倍率
  };

  const settings = { rhythmOn: true };
  let state = null, rafId = null, lastTime = 0;

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function resetState(song){
    return {
      song, rhythmOn: settings.rhythmOn,
      hp:100, score:0, combo:0, maxCombo:0,
      correct:0, wrong:0, perfect:0, good:0,
      freed:0, melodyIdx:0,
      phraseOrder: shuffle(song.phrases.map((_,i)=>i)), phrasePos:0,
      phrase:null, typed:0,
      enemies:[], target:null, enemyId:0,
      spawnTimer:0, bossPending:false, bossActive:false,
      running:true,
      startTime: performance.now(),
    };
  }

  // ---- フレーズを次へ（使い切ったらシャッフルし直してループ） ----
  function nextPhrase(){
    const s = state;
    if(s.phrasePos >= s.phraseOrder.length){
      shuffle(s.phraseOrder);
      s.phrasePos = 0;
    }
    s.phrase = s.song.phrases[s.phraseOrder[s.phrasePos++]];
    s.typed = 0;
    VTUI.renderPhrase(s.phrase, 0);
  }

  // ---- 敵の生成 ----
  function spawnEnemy(isBoss){
    const s = state;
    const E = VT_DATA.enemies;
    const genreKeys = Object.keys(VT_DATA.genres);
    // ボスはAIなので相性なし。ザコはランダムなジャンルが「刺さる」
    const genre = isBoss ? null : genreKeys[Math.floor(Math.random()*genreKeys.length)];
    const icon  = isBoss ? "⚡" : VT_DATA.genres[genre].icon;
    const look  = isBoss ? E.bossLook : E.zakoLooks[Math.floor(Math.random()*E.zakoLooks.length)];
    const vibed = !isBoss && genre === s.song.genre;
    const el = VTUI.createEnemyEl(look, icon, isBoss, vibed);
    const enemy = {
      id: ++s.enemyId, el,
      hpEl: el.querySelector(".hpfill"),
      genre, isBoss,
      maxHp: isBoss ? CFG.bossHp : CFG.zakoHp,
      hp:    isBoss ? CFG.bossHp : CFG.zakoHp,
      x: 1.05,   // 1.0=右端。少し外側から登場
      speed: CFG.baseSpeed * (isBoss ? 0.45 : 1) * (0.9 + Math.random()*0.3),
    };
    if(isBoss) el.style.bottom = "30%";
    s.enemies.push(enemy);
    VTUI.setEnemyHp(enemy);
    return enemy;
  }

  // ---- ターゲット選択：一番手前（左）の敵 ----
  function pickTarget(){
    const s = state;
    let best = null;
    for(const e of s.enemies){ if(!best || e.x < best.x) best = e; }
    s.target = best;
    for(const e of s.enemies) e.el.classList.toggle("target", e === s.target);
  }

  // ---- キー入力 ----
  function onKey(ev){
    if(!state || !state.running) return;
    if(ev.key.length !== 1) return;   // Shift等の特殊キーは無視
    const ch = ev.key.toLowerCase();
    ev.preventDefault();
    const s = state;
    if(!s.phrase) return;

    if(ch === s.phrase.roman.charAt(s.typed)){
      // --- 正解：メロディを1音演奏 ---
      s.correct++;
      const mel = s.song.melody;
      VTAudio.melody(mel[s.melodyIdx % mel.length], s.song.genre);
      s.melodyIdx++;

      // --- リズム判定（ビートに近いほどダメージ増） ---
      let mult = 1;
      if(s.rhythmOn){
        const off = VTAudio.beatOffsetMs();
        if(off != null){
          if(off <= CFG.judge.perfectMs){
            mult = CFG.judge.perfectMult; s.perfect++;
            VTUI.showJudge("PERFECT", "perfect");
          }else if(off <= CFG.judge.goodMs){
            mult = CFG.judge.goodMult; s.good++;
            VTUI.showJudge("GOOD", "good");
          }
        }
      }

      s.combo++;
      if(s.combo > s.maxCombo) s.maxCombo = s.combo;
      VTUI.showCombo(s.combo);

      s.typed++;
      const complete = s.typed >= s.phrase.roman.length;
      VTUI.renderPhrase(s.phrase, s.typed);

      // --- ダメージとスコア ---
      damageTarget(1*mult + (complete ? CFG.phraseBonus : 0));
      s.score += Math.round(10 * mult * (1 + Math.min(s.combo,50)*0.05));

      if(complete && s.running) nextPhrase();
    }else{
      // --- ミス：外れた音が鳴りコンボが切れる ---
      s.wrong++;
      s.combo = 0;
      VTAudio.miss();
      VTUI.flashMiss();
    }
    VTUI.updateHUD(s);
  }

  // ---- ターゲットへダメージ（相性一致でさらに増加） ----
  function damageTarget(dmg){
    const s = state;
    if(!s.target) pickTarget();
    const t = s.target;
    if(!t) return;
    if(t.genre && t.genre === s.song.genre) dmg *= CFG.affinityMult;
    t.hp -= dmg;
    VTUI.setEnemyHp(t);
    t.el.classList.remove("dmg"); void t.el.offsetWidth; t.el.classList.add("dmg");
    if(t.hp <= 0) free(t);
  }

  // ---- 解放（洗脳が解けた） ----
  function free(e){
    const s = state;
    s.freed++;
    s.score += e.isBoss ? 1000 : 100;
    VTAudio.freeChime();
    VTUI.showFree(e.el);
    removeEnemy(e);
    if(e.isBoss){ finish(true); return; }
    if(s.freed >= CFG.zakoToBoss && !s.bossActive && !s.bossPending){
      s.bossPending = true;
    }
    pickTarget();
  }

  function removeEnemy(e){
    const s = state;
    s.enemies = s.enemies.filter(x => x !== e);
    e.el.remove();
    if(s.target === e) s.target = null;
  }

  // ---- メインループ ----
  function loop(now){
    if(!state || !state.running) return;
    const dt = Math.min((now - lastTime)/1000, 0.05);
    lastTime = now;
    const s = state;

    // 敵の出現（規定数解放後、画面が空いたらボス登場）
    s.spawnTimer += dt;
    if(s.bossPending && s.enemies.length === 0){
      s.bossPending = false;
      s.bossActive = true;
      spawnEnemy(true);
      pickTarget();
    }else if(!s.bossActive && !s.bossPending && s.spawnTimer >= CFG.spawnEvery){
      s.spawnTimer = 0;
      spawnEnemy(false);
      if(!s.target) pickTarget();
    }

    // 敵の移動と到達判定
    const w = field.clientWidth;
    const heroX = 90 / w;
    for(const e of [...s.enemies]){
      e.x -= e.speed * dt;
      e.el.style.left = (e.x * 100) + "%";
      if(e.x <= heroX){
        s.hp -= e.isBoss ? CFG.bossReachDamage : CFG.reachDamage;
        s.combo = 0;
        VTUI.heroHit(); VTUI.flashMiss(); VTAudio.damage();
        if(e.isBoss){
          e.x = 0.95;          // ボスはノックバックして再襲来
        }else{
          removeEnemy(e);
        }
        pickTarget();
        if(s.hp <= 0){
          s.hp = 0;
          VTUI.updateHUD(s);
          finish(false);
          return;
        }
      }
    }

    if(!s.target && s.enemies.length) pickTarget();
    VTUI.beatPulse(VTAudio.beatPhase());
    VTUI.updateHUD(s);
    rafId = requestAnimationFrame(loop);
  }

  // ---- ゲーム開始・終了 ----
  function startGame(song){
    field.querySelectorAll(".enemy,.cry").forEach(n => n.remove());
    state = resetState(song);
    nextPhrase();
    VTUI.showScreen(null);
    VTUI.updateHUD(state);
    VTAudio.startBGM(song);
    lastTime = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function finish(cleared){
    const s = state;
    s.running = false;
    cancelAnimationFrame(rafId);
    VTAudio.stopBGM();
    if(cleared) VTAudio.freeChime();
    VTUI.showResult(s, cleared);
  }

  // ---- イベント登録 ----
  document.addEventListener("keydown", onKey);
  $("startBtn").addEventListener("click", () => {
    VTAudio.ensure();               // ユーザー操作のタイミングでAudioContextを起こす
    VTUI.showScreen("songScreen");
  });
  $("rhythmOn").addEventListener("click", () => { settings.rhythmOn = true;  VTUI.setRhythmButtons(true); });
  $("rhythmOff").addEventListener("click", () => { settings.rhythmOn = false; VTUI.setRhythmButtons(false); });
  $("retryBtn").addEventListener("click", () => startGame(state.song));
  $("selectBtn").addEventListener("click", () => VTUI.showScreen("songScreen"));
  VTUI.buildSongList(song => startGame(song));
  VTUI.setRhythmButtons(settings.rhythmOn);
})();
