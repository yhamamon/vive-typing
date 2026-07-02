"use strict";
/* =========================================================================
   VTGame: ゲーム本体（状態管理・敵・ダメージ計算・メインループ）
   ・1プレイ＝1曲を最後まで歌いきること。曲は Aメロ/Bメロ/サビ/大サビ/アウトロという
     実際のポップスの構成で組まれており（js/data.js の各曲 phrases の section）、
     フレーズはシャッフルせず先頭から順番に再生される＝曲の長さも構成もデータ側で決まる。
   ・敵はセクションに応じて出現する：
       verseA/verseB（Aメロ/Bメロ） … タイマーでザコが湧く
       chorus（サビ）              … 入った瞬間に中ボスが1体出現
       finalChorus（大サビ）       … 入った瞬間にボスが1体出現
       outro（アウトロ）           … 戦闘なし。歌い切るだけ
   ・曲が終われば道中の状況に関わらずCLEAR（ザコを一人も逃さず・中ボス/ボスも
     倒していればNICE）。敵にHPを削られてプレイヤーHPが0になったらGAME OVER。
   ========================================================================= */
(function(){
  const $ = id => document.getElementById(id);
  const field = $("field");

  // ---- ゲームバランス調整値 ----
  const CFG = {
    zakoHp: 12,              // ザコの洗脳度（HP）
    midBossHp: 36,           // 中ボス（サビ）の洗脳度
    bossHp: 90,              // ボス（大サビ）の洗脳度
    spawnEveryStart: 1.7,    // 曲の始めの敵出現間隔（秒）
    spawnEveryEnd: 0.9,      // 曲の終盤の敵出現間隔（秒。短いほど同時に出る敵が増える）
    baseSpeed: 0.05,         // 敵の接近速度（奥行き1.0を何秒で詰めるかの割合/秒）
    reachDamage: 15,         // ザコに到達されたときのダメージ
    specialReachDamage: 30,  // 中ボス・ボスに到達されたときのダメージ
    phraseBonus: 4,          // フレーズ完走ボーナスダメージ
    judge: { perfectMs:70, goodMs:140, perfectMult:2.0, goodMult:1.5 },
    affinityMult: 1.5,       // 「刺さってる」（ジャンル一致）倍率
    grooveCombo: 10,         // このコンボ以上でノリノリポーズになる
    idleAfterMs: 1000,       // 何ms打鍵がないと待機ポーズに戻るか
    allyVisualCap: 20,       // 仲間アイコンを画面に並べる最大数（それ以降は+N表示）
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

  function resetState(song){
    return {
      song, rhythmOn: settings.rhythmOn,
      hp:100, score:0, combo:0, maxCombo:0,
      correct:0, wrong:0, perfect:0, good:0, onsets:0,
      freed:0, melodyIdx:0,
      phraseIdx:0, phrase:null, typed:0, section:null,
      enemies:[], target:null, enemyId:0,
      spawnTimer:0, specialActive:false,
      midBossSpawned:false, midBossDefeated:false,
      finalBossSpawned:false, finalBossDefeated:false,
      zakoFreed:0, zakoLeaked:0,   // zakoLeaked>0ならNICE達成不可
      victoryShown:false,          // 「敵を倒し切った」バナーを一度だけ出すためのフラグ
      allies:[],                   // 解放して仲間になった人の見た目リスト（永続バフの源）
      running:true,
      startTime: performance.now(),
    };
  }

  // ---- 曲の進行度（0〜1）。フレーズをどれだけ歌い終えたか（出現間隔のペース配分にのみ使用） ----
  function songProgress(s){
    return Math.min(1, s.phraseIdx / s.song.phrases.length);
  }

  // ---- フレーズを次へ（曲の構成通り先頭から順番に再生。ループやシャッフルはしない） ----
  function nextPhrase(){
    const s = state;
    s.phrase = s.song.phrases[s.phraseIdx];
    s.typed = 0;
    VTUI.renderPhrase(s.phrase, 0);
    enterSection(s.phrase.section);
  }

  // ---- セクションが切り替わった瞬間に反応する（サビ→中ボス、大サビ→ボス） ----
  function enterSection(section){
    const s = state;
    if(section === s.section) return;
    s.section = section;
    if(section === "chorus" && !s.midBossSpawned){
      s.midBossSpawned = true;
      s.specialActive = true;
      spawnEnemy("midboss");
      pickTarget();
    }else if(section === "finalChorus" && !s.finalBossSpawned){
      s.finalBossSpawned = true;
      s.specialActive = true;
      spawnEnemy("boss");
      pickTarget();
    }
  }

  // ---- 敵の生成（kind: "zako" | "midboss" | "boss"） ----
  function spawnEnemy(kind){
    const s = state;
    const genreKeys = Object.keys(VT_DATA.genres);
    const isSpecial = kind !== "zako";
    const genre = kind === "zako" ? genreKeys[Math.floor(Math.random()*genreKeys.length)] : null;
    const icon  = kind === "zako" ? VT_DATA.genres[genre].icon : (kind === "midboss" ? "🔥" : "⚡");
    const look  = kind === "zako" ? VT_DATA.enemies.zakoLooks[Math.floor(Math.random()*VT_DATA.enemies.zakoLooks.length)]
                : kind === "midboss" ? VT_DATA.midBossLook : VT_DATA.bossLook;
    const vibed = kind === "zako" && genre === s.song.genre;
    const hp = kind === "zako" ? CFG.zakoHp : kind === "midboss" ? CFG.midBossHp : CFG.bossHp;
    const ringColor = kind === "zako" ? "#22e5ff" : kind === "midboss" ? "#ff8a3d" : "#ff3bd4";
    const el = VTUI.createEnemyEl(look, icon, isSpecial, vibed, ringColor, 0);
    const enemy = {
      id: ++s.enemyId, el,
      hpEl: el.querySelector(".hpfill"),
      genre, kind, look,
      maxHp: hp, hp,
      // 地平線上のどこから湧くか（横に散らばる。中ボス・ボスは正面）
      spawnX: kind === "zako" ? 0.08 + Math.random()*0.84 : 0.5,
      z: 1.0,    // 奥行き：1.0=地平線（最奥）→ 0=プレイヤー
      speed: CFG.baseSpeed * (kind === "zako" ? 1 : kind === "midboss" ? 0.55 : 0.45) * (0.9 + Math.random()*0.3),
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
    const scale = (VIEW.minScale + (VIEW.maxScale - VIEW.minScale)*t) * (e.kind !== "zako" ? 1.15 : 1);
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
        s.phraseIdx++;
        if(s.phraseIdx >= s.song.phrases.length){
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
    s.score += e.kind === "boss" ? 1000 : e.kind === "midboss" ? 400 : 100;
    VTAudio.freeChime();
    VTUI.showFree(e.el);
    s.allies.push({ look: e.look });
    VTUI.updateAllies(s.allies, CFG.allyVisualCap);
    removeEnemy(e);

    if(e.kind === "midboss"){
      s.specialActive = false;
      s.midBossDefeated = true;
      pickTarget();
      return;
    }
    if(e.kind === "boss"){
      s.specialActive = false;
      s.finalBossDefeated = true;
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

    // 敵の出現：Aメロ/Bメロの間だけタイマーでザコが湧く（サビ・大サビ・アウトロでは湧かない）。
    // サビ/大サビに入った瞬間の中ボス/ボス出現は enterSection() が担当する。
    s.spawnTimer += dt;
    const inVerse = s.section === "verseA" || s.section === "verseB";
    const spawnEvery = CFG.spawnEveryStart +
      (CFG.spawnEveryEnd - CFG.spawnEveryStart) * songProgress(s);
    if(inVerse && !s.specialActive && s.spawnTimer >= spawnEvery){
      s.spawnTimer = 0;
      spawnEnemy("zako");
      if(!s.target) pickTarget();
    }

    // 敵の接近と到達判定（奥→手前へ迫ってくる）
    for(const e of [...s.enemies]){
      e.z -= e.speed * dt;
      positionEnemy(e);
      if(e.z <= VIEW.reachZ){
        s.hp -= e.kind === "zako" ? CFG.reachDamage : CFG.specialReachDamage;
        s.combo = 0;
        VTUI.heroHit(); VTUI.flashMiss(); VTAudio.damage();
        if(e.kind === "zako"){
          s.zakoLeaked++;      // 倒せず素通りされた＝NICE達成不可
          removeEnemy(e);
        }else{
          e.z = 0.6;           // 中ボス・ボスはノックバックして再度向かってくる（倒すまで居座る）
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

    // 大サビのボスを倒し切った瞬間に一度だけ、「あとはみんなで歌うだけ」の
    // アウトロパートへの切り替わりを知らせる
    if(!s.victoryShown && s.finalBossSpawned && s.finalBossDefeated && s.enemies.length === 0){
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
    // ザコを一人も逃さず、中ボス・ボスが出た場合はそれも倒していれば「NICE」
    const nice = s.zakoLeaked === 0
      && (!s.midBossSpawned || s.midBossDefeated)
      && (!s.finalBossSpawned || s.finalBossDefeated);
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
