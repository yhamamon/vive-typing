"use strict";
/* =========================================================================
   VTGame: ゲーム本体（状態管理・敵・ダメージ計算・メインループ）
   ========================================================================= */
(function(){
  const $ = id => document.getElementById(id);
  const field = $("field");

  // ---- ゲームバランス調整値 ----
  // 1プレイ＝1曲を最後まで歌いきること。敵（ザコ＋ボス1体）は有限の編成で、
  // 曲が終われば道中の状況に関わらずCLEAR（全員解放できていればNICE）。
  // 敵にHPを削られてプレイヤーHPが0になったらGAME OVER。
  const CFG = {
    songLength: 16,          // 1プレイで歌いきるフレーズ数（＝曲の長さ）
    zakoUntilProgress: 0.62, // 曲の進行度がこの割合に達するまでザコを出し続ける（体数ではなく進行度で管理）
                             // 残りはボス戦＋「敵を倒し切ってあとは歌うだけ」の合唱パートに充てる
    zakoHp: 12,              // ザコの洗脳度（HP）
    bossHp: 90,              // ボスの洗脳度（ザコが出し切られて画面が空いたら1度だけ出現）
    spawnEveryStart: 1.7,    // 曲の始めの敵出現間隔（秒）
    spawnEveryEnd: 0.9,      // 曲の終盤の敵出現間隔（秒。短いほど同時に出る敵が増える＝後半の難化）
    baseSpeed: 0.05,         // 敵の接近速度（奥行き1.0を何秒で詰めるかの割合/秒。tier.speedMultで倍率）
    reachDamage: 15,         // 敵に到達されたときのダメージ
    bossReachDamage: 30,
    phraseBonus: 4,          // フレーズ完走ボーナスダメージ
    judge: { perfectMs:70, goodMs:140, perfectMult:2.0, goodMult:1.5 },
    affinityMult: 1.5,       // 「刺さってる」（ジャンル一致）倍率
    grooveCombo: 10,         // このコンボ以上でノリノリポーズになる
    idleAfterMs: 1000,       // 何ms打鍵がないと待機ポーズに戻るか
    allyVisualCap: 20,       // 仲間アイコンを画面に並べる最大数（それ以降は+N表示。軽量なDOM要素なので増やしても負荷は問題ない）
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
      songLength: CFG.songLength, phrasesDone:0,
      enemies:[], target:null, enemyId:0,
      spawnTimer:0, bossActive:false, bossSpawned:false, bossDefeated:false,
      zakoFreed:0, zakoLeaked:0,   // zakoLeaked>0ならNICE達成不可
      victoryShown:false,          // 「敵を倒し切った」バナーを一度だけ出すためのフラグ
      allies:[],                       // 解放して仲間になった人の見た目リスト（永続バフの源）
      running:true,
      startTime: performance.now(),
    };
  }

  // ---- 曲の進行度（0〜1）。フレーズをどれだけ歌い終えたか ----
  function songProgress(s){
    return Math.min(1, s.phrasesDone / s.songLength);
  }

  // ---- 現在の進行度の敵ティアを取得（minProgress以下の中で最も高いもの） ----
  function currentTier(progress){
    const tiers = VT_DATA.enemyTiers;
    let best = tiers[0];
    for(const t of tiers){ if(t.minProgress <= progress) best = t; }
    return best;
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

  // ---- 敵の生成（曲の進行度に応じたティアから見た目・強さを決める） ----
  function spawnEnemy(isBoss){
    const s = state;
    const genreKeys = Object.keys(VT_DATA.genres);
    const tier = currentTier(songProgress(s));
    // ボスはAIなので相性なし。ザコはランダムなジャンルが「刺さる」
    const genre = isBoss ? null : genreKeys[Math.floor(Math.random()*genreKeys.length)];
    const icon  = isBoss ? "⚡" : VT_DATA.genres[genre].icon;
    const look  = isBoss ? VT_DATA.bossLook : tier.looks[Math.floor(Math.random()*tier.looks.length)];
    const vibed = !isBoss && genre === s.song.genre;
    const zakoHp = Math.round(CFG.zakoHp * tier.hpMult);
    const el = VTUI.createEnemyEl(look, icon, isBoss, vibed, isBoss ? "#ff3bd4" : tier.ringColor, tier.hue);
    const enemy = {
      id: ++s.enemyId, el,
      hpEl: el.querySelector(".hpfill"),
      genre, isBoss, look,
      maxHp: isBoss ? CFG.bossHp : zakoHp,
      hp:    isBoss ? CFG.bossHp : zakoHp,
      // 地平線上のどこから湧くか（横に散らばる。ボスは正面）
      spawnX: isBoss ? 0.5 : 0.08 + Math.random()*0.84,
      z: 1.0,    // 奥行き：1.0=地平線（最奥）→ 0=プレイヤー
      speed: CFG.baseSpeed * (isBoss ? 0.45 : tier.speedMult) * (0.9 + Math.random()*0.3),
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

      if(complete && s.running){
        s.phrasesDone++;
        if(s.phrasesDone >= s.songLength){
          finishClear();      // 曲を最後まで歌いきった
        }else{
          nextPhrase();
        }
      }
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

  // ---- ターゲットへダメージ（相性一致・仲間ボーナスでさらに増加） ----
  function damageTarget(dmg){
    const s = state;
    if(!s.target) pickTarget();
    const t = s.target;
    if(!t) return;
    if(t.genre && t.genre === s.song.genre) dmg *= CFG.affinityMult;
    dmg *= 1 + s.allies.length * VT_DATA.allyDamagePerAlly;   // 仲間が増えるほど攻撃力アップ
    t.hp -= dmg;
    VTUI.setEnemyHp(t);
    t.el.classList.remove("dmg"); void t.el.offsetWidth; t.el.classList.add("dmg");
    if(t.hp <= 0) free(t);
  }

  // ---- 解放（洗脳が解けた→仲間になって一緒に歌う） ----
  function free(e){
    const s = state;
    s.freed++;
    s.score += e.isBoss ? 1000 : 100;
    VTAudio.freeChime();
    VTUI.showFree(e.el);
    s.allies.push({ look: e.look });
    VTUI.updateAllies(s.allies, CFG.allyVisualCap);
    removeEnemy(e);

    if(e.isBoss){
      s.bossActive = false;
      s.bossDefeated = true;
      pickTarget();
      return;
    }
    s.zakoFreed++;
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

    // 敵の出現：曲の進行度（実時間ではなくフレーズの進み具合）が zakoUntilProgress に
    // 達するまでザコを出し続ける。体数で管理しないので、曲の長さや打鍵速度が変わっても
    // 「曲の大部分でずっと敵が来る」バランスが自然に保たれる。
    // 進行度が達して画面が空いたら、最後に1度だけボスが出現する。
    s.spawnTimer += dt;
    const progress = songProgress(s);
    const spawnEvery = CFG.spawnEveryStart +
      (CFG.spawnEveryEnd - CFG.spawnEveryStart) * progress;
    if(!s.bossSpawned && progress >= CFG.zakoUntilProgress && s.enemies.length === 0){
      s.bossSpawned = true;
      s.bossActive = true;
      spawnEnemy(true);
      pickTarget();
    }else if(!s.bossActive && progress < CFG.zakoUntilProgress && s.spawnTimer >= spawnEvery){
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
          e.z = 0.6;           // ボスはノックバックして再度向かってくる（倒すまで居座る）
        }else{
          s.zakoLeaked++;      // 倒せず素通りされた＝NICE達成不可
          removeEnemy(e);
        }
        pickTarget();
        if(s.hp <= 0){
          s.hp = 0;
          VTUI.updateHUD(s);
          finishGameOver();
          return;
        }
      }
    }

    // 敵を全て倒し切った（ボスが出た場合はそれも撃破済み）瞬間に一度だけ、
    // 「あとはみんなで歌うだけ」の合唱パートへの切り替わりを知らせる
    if(!s.victoryShown && progress >= CFG.zakoUntilProgress && s.bossSpawned && !s.bossActive && s.enemies.length === 0){
      s.victoryShown = true;
      VTUI.showVictoryBanner();
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
    VTUI.updateAllies(state.allies, CFG.allyVisualCap);
    nextPhrase();
    VTUI.showScreen(null);
    VTUI.updateHUD(state);
    VTAudio.startBGM(song);
    lastTime = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function finishGameOver(){
    finish({ result:"gameover" });
  }
  function finishClear(){
    const s = state;
    // ザコを一人も逃さず、ボスが出た場合はそれも倒していれば「NICE」
    const nice = s.zakoLeaked === 0 && (!s.bossSpawned || s.bossDefeated);
    finish({ result:"clear", nice });
  }
  function finish(outcome){
    const s = state;
    s.running = false;
    cancelAnimationFrame(rafId);
    VTAudio.stopBGM();
    if(outcome.result === "clear") VTAudio.freeChime();
    VTUI.showResult(s, outcome);
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
