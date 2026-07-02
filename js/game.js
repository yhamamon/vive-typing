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
    baseSpeed: 0.05,         // 敵の接近速度（奥行き1.0を何秒で詰めるかの割合/秒）
    reachDamage: 15,         // 敵に到達されたときのダメージ
    bossReachDamage: 30,
    phraseBonus: 4,          // フレーズ完走ボーナスダメージ
    judge: { perfectMs:70, goodMs:140, perfectMult:2.0, goodMult:1.5 },
    affinityMult: 1.5,       // 「刺さってる」（ジャンル一致）倍率
    grooveCombo: 10,         // このコンボ以上でノリノリポーズになる
    idleAfterMs: 1000,       // 何ms打鍵がないと待機ポーズに戻るか
  };

  // ---- 疑似3D視点の設定（敵は地平線から湧き、下中央のプレイヤーへ包囲接近） ----
  const VIEW = {
    horizonY: 0.36,   // 地平線の縦位置（fieldの高さ比）
    playerY:  0.82,   // プレイヤーの足元の縦位置
    reachZ:   0.06,   // この奥行きまで来たら攻撃される
    minScale: 0.4,    // 地平線での敵の大きさ
    maxScale: 1.15,   // 手前まで来たときの敵の大きさ
  };

  const settings = { rhythmOn: true };
  let state = null, rafId = null, lastTime = 0;

  // ---- 主人公ポーズの状態管理 ----
  let heroPose = "idle", lastTypeAt = 0;
  function setPose(p){
    if(heroPose !== p){ heroPose = p; VTUI.setHeroPose(p); }
  }

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
      correct:0, wrong:0, perfect:0, good:0, onsets:0,
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
      // 地平線上のどこから湧くか（横に散らばる。ボスは正面）
      spawnX: isBoss ? 0.5 : 0.08 + Math.random()*0.84,
      z: 1.0,    // 奥行き：1.0=地平線（最奥）→ 0=プレイヤー
      speed: CFG.baseSpeed * (isBoss ? 0.45 : 1) * (0.9 + Math.random()*0.3),
    };
    s.enemies.push(enemy);
    VTUI.setEnemyHp(enemy);
    positionEnemy(enemy);
    return enemy;
  }

  // ---- 疑似3D配置：奥行きzから画面上の位置・大きさを決める ----
  function positionEnemy(e){
    const t = 1 - e.z;                            // 0=最奥 → 1=手前
    const conv = 0.25 + 0.75*e.z;                 // 近づくほど中央（プレイヤー）へ収束＝包囲
    const sx = 0.5 + (e.spawnX - 0.5)*conv;
    const sy = VIEW.horizonY + (VIEW.playerY - VIEW.horizonY)*t*t; // 手前ほど速く見える
    const scale = (VIEW.minScale + (VIEW.maxScale - VIEW.minScale)*t) * (e.isBoss ? 1.15 : 1);
    e.el.style.left = (sx*100) + "%";
    e.el.style.top  = (sy*100) + "%";
    e.el.style.transform = "translate(-50%,-100%) scale(" + scale.toFixed(3) + ")";
    e.el.style.zIndex = 3 + Math.round(t*10);     // 手前の敵ほど前に描画
  }

  // ---- ターゲット選択：一番手前（プレイヤーに近い）の敵 ----
  function pickTarget(){
    const s = state;
    let best = null;
    for(const e of s.enemies){ if(!best || e.z < best.z) best = e; }
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

      // --- リズム判定：フレーズの「入り」（1文字目）だけに適用。
      //     2文字目以降は自由な速さで打ってよく、タイピング速度がそのままスコアに効く。
      //     入りのタイミングが合うほどダメージ・スコアが伸びる設計。
      const isOnset = s.typed === 0;
      let mult = 1;
      if(isOnset){
        s.onsets++;
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
      }

      s.combo++;
      if(s.combo > s.maxCombo) s.maxCombo = s.combo;
      VTUI.showCombo(s.combo);

      // ポーズ更新：打鍵中は演奏、コンボが乗るとノリノリ
      lastTypeAt = performance.now();
      setPose(s.combo >= CFG.grooveCombo ? "groove" : "play");
      if(mult === CFG.judge.perfectMult && heroPose === "groove") VTUI.showGyuin();

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
      lastTypeAt = performance.now();
      setPose("play");   // コンボが切れたのでノリノリ解除
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

    // 敵の接近と到達判定（奥→手前へ迫ってくる）
    for(const e of [...s.enemies]){
      e.z -= e.speed * dt;
      positionEnemy(e);
      if(e.z <= VIEW.reachZ){
        s.hp -= e.isBoss ? CFG.bossReachDamage : CFG.reachDamage;
        s.combo = 0;
        VTUI.heroHit(); VTUI.flashMiss(); VTAudio.damage();
        if(e.isBoss){
          e.z = 0.6;           // ボスはノックバックして再襲来
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

    // 1秒打鍵がなければ待機ポーズ（ギターを背負って立つ）に戻る
    if(heroPose !== "idle" && performance.now() - lastTypeAt > CFG.idleAfterMs){
      setPose("idle");
    }

    VTUI.beatPulse(VTAudio.beatPhase());
    VTUI.updateHUD(s);
    rafId = requestAnimationFrame(loop);
  }

  // ---- ゲーム開始・終了 ----
  function startGame(song){
    field.querySelectorAll(".enemy,.cry,.gyuin").forEach(n => n.remove());
    state = resetState(song);
    lastTypeAt = 0;
    setPose("idle");
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
