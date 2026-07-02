"use strict";
/* =========================================================================
   VTUI: DOM描画・画面遷移・エフェクト
   ========================================================================= */
const VTUI = (function(){
  const $ = id => document.getElementById(id);
  const field = () => $("field");

  function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  // ---- 画面遷移（null で全オーバーレイを閉じる＝プレイ中） ----
  function showScreen(id){
    ["titleScreen","songScreen","resultScreen"].forEach(k => {
      $(k).classList.toggle("hidden", k !== id);
    });
  }

  // ---- 曲選択ボタンの生成 ----
  function buildSongList(onSelect){
    const box = $("songList");
    box.innerHTML = "";
    VT_DATA.songs.forEach(song => {
      const g = VT_DATA.genres[song.genre];
      const b = document.createElement("button");
      b.className = "btn song";
      b.innerHTML =
        '<span class="g">'+g.icon+" "+esc(g.label)+'</span>'+
        '<span class="t">'+esc(song.title)+'</span>'+
        '<small>'+esc(song.desc)+'　BPM '+song.bpm+'</small>';
      b.addEventListener("click", () => onSelect(song));
      box.appendChild(b);
    });
  }

  function setRhythmButtons(on){
    $("rhythmOn").classList.toggle("sel", on);
    $("rhythmOff").classList.toggle("sel", !on);
  }

  // ---- フレーズ表示（打った done / 今打つ now / 残り rest のハイライト） ----
  function renderPhrase(phrase, typed){
    $("phraseJp").textContent = phrase ? phrase.jp : "";
    if(!phrase){ $("phraseRoman").innerHTML = ""; return; }
    const r = phrase.roman;
    $("phraseRoman").innerHTML =
      '<span class="done">'+esc(r.slice(0, typed))+'</span>'+
      '<span class="now">'+esc(r.charAt(typed))+'</span>'+
      '<span class="rest">'+esc(r.slice(typed+1))+'</span>';
  }

  // ---- 敵のDOM生成（HPバー・ジャンルアイコン付き。isSpecialは中ボス/ボスの大きめ表示、ringColorで種別を色分け） ----
  function createEnemyEl(look, genreIcon, isSpecial, vibed, ringColor, hue){
    const el = document.createElement("div");
    el.className = "enemy" + (isSpecial ? " boss" : "") + (vibed ? " vibed" : "");
    el.innerHTML =
      '<div class="hpbar"><div class="hpfill"></div></div>'+
      '<div class="glabel">'+genreIcon+'</div>'+
      '<div class="body">'+look+'</div>';
    if(ringColor) el.querySelector(".hpbar").style.borderColor = ringColor;
    if(hue){
      const shadow = isSpecial ? "drop-shadow(0 0 20px var(--pink))" : "drop-shadow(0 3px 4px #000)";
      el.querySelector(".body").style.filter = "hue-rotate(" + hue + "deg) " + shadow;
    }
    field().appendChild(el);
    return el;
  }
  function setEnemyHp(e){
    e.hpEl.style.width = Math.max(0, e.hp/e.maxHp*100) + "%";
  }

  // ---- リズム判定ポップ（PERFECT / GOOD） ----
  function showJudge(text, cls){
    const el = $("judgePop");
    el.textContent = text;
    el.className = "show " + cls;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = ""; }, 360);
  }

  // ---- 解放セリフ（洗脳が解けた） ----
  function showFree(enemyEl){
    const list = VT_DATA.enemies.frees;
    const c = document.createElement("div");
    c.className = "cry";
    c.textContent = list[Math.floor(Math.random()*list.length)];
    const rect = enemyEl.getBoundingClientRect();
    const fr = field().getBoundingClientRect();
    c.style.left = (rect.left - fr.left + rect.width/2) + "px";
    c.style.top  = (rect.top  - fr.top  + rect.height/3) + "px";
    field().appendChild(c);
    setTimeout(() => c.remove(), 1100);
  }

  // ---- コンボ表示（5コンボ刻みで出す） ----
  function showCombo(n){
    if(n < 5 || n % 5 !== 0) return;
    const el = $("comboPop");
    el.textContent = n + " COMBO!";
    el.style.opacity = 1;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.style.opacity = 0, 700);
  }

  function flashMiss(){
    const f = $("flash");
    f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");
  }
  function heroHit(){
    const h = $("hero");
    h.classList.remove("hit"); void h.offsetWidth; h.classList.add("hit");
  }

  // ---- 主人公のポーズ切替（idle=待機 / play=演奏 / groove=ノリノリ） ----
  function setHeroPose(pose){
    const h = $("hero");
    if(h.classList.contains(pose)) return;
    h.classList.remove("idle","play","groove");
    h.classList.add(pose);
  }

  // ---- ギュイーン！ポップ（ノリノリ中のPERFECTで出る） ----
  function showGyuin(){
    const f = field();
    const c = document.createElement("div");
    c.className = "gyuin";
    c.textContent = "ギュイーン！";
    c.style.left = (f.clientWidth/2 + (Math.random()*180 - 90)) + "px";
    c.style.top  = (f.clientHeight*0.58 + Math.random()*36) + "px";
    f.appendChild(c);
    setTimeout(() => c.remove(), 750);
  }

  // ---- 「敵を倒し切った」バナー（あとは合唱パート、という区切りを一度だけ知らせる） ----
  function showVictoryBanner(){
    const el = $("victoryBanner");
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  }

  // ---- 仲間表示（解放した人をプレイヤーの左右に交互に並べる。タイピングパネルとは重ならない位置） ----
  function updateAllies(allies, cap){
    const box = $("allies");
    box.innerHTML = "";
    const shown = allies.slice(-cap);
    shown.forEach((a, i) => {
      const side = i % 2 === 0 ? -1 : 1;   // 偶数=左、奇数=右
      const row = Math.floor(i / 2);        // 外側の人ほど後の段へ
      const el = document.createElement("span");
      el.className = "allyIcon";
      el.textContent = a.look;
      el.style.setProperty("--side", side);
      el.style.setProperty("--row", row);
      el.style.animationDelay = (i * 0.06) + "s";
      box.appendChild(el);
    });
    const extra = allies.length - shown.length;
    if(extra > 0){
      const badge = document.createElement("span");
      badge.className = "allyMore";
      badge.textContent = "+" + extra;
      box.appendChild(badge);
    }
  }

  // ---- ビートインジケータ（拍の頭で強く光る） ----
  function beatPulse(phase){
    const el = $("beatPulse");
    if(phase == null){ el.style.opacity = .15; el.style.transform = "scale(1)"; return; }
    const v = Math.max(0, 1 - phase*3); // 拍頭直後だけ強く
    el.style.opacity = .15 + v*.85;
    el.style.transform = "scale(" + (1 + v*.35) + ")";
  }

  // ---- HUD更新 ----
  function updateHUD(s){
    $("hpfill").style.width = s.hp + "%";
    $("score").textContent = s.score;
    $("remain").textContent = Math.max(0, s.song.phrases.length - s.phraseIdx);
    $("combo").textContent = s.combo;
    $("freed").textContent = s.freed;
    const mins = (performance.now() - s.startTime) / 60000;
    $("wpm").textContent = mins > 0 ? Math.round((s.correct/5)/mins) : 0;
    const total = s.correct + s.wrong;
    $("acc").textContent = (total > 0 ? Math.round(s.correct/total*100) : 100) + "%";
  }

  // ---- 結果画面（outcome = {result:"clear"|"gameover", nice?:boolean}） ----
  function showResult(s, outcome){
    const title = $("resultTitle");
    const cleared = outcome.result === "clear";
    title.textContent = cleared ? "CLEAR!" : "GAME OVER";
    title.classList.toggle("clear", cleared);
    $("niceBadge").classList.toggle("show", cleared && outcome.nice);

    const mins = (performance.now() - s.startTime) / 60000;
    const wpm = mins > 0 ? Math.round((s.correct/5)/mins) : 0;
    const total = s.correct + s.wrong;
    const acc = total > 0 ? Math.round(s.correct/total*100) : 100;
    const perfectRate = s.onsets > 0 ? Math.round(s.perfect/s.onsets*100) : 0;

    let rank = VT_DATA.ranks[VT_DATA.ranks.length-1].name;
    for(const r of VT_DATA.ranks){
      if(s.score >= r.score && acc >= r.acc){ rank = r.name; break; }
    }
    $("rank").textContent = rank;
    $("rScore").textContent = s.score;
    $("rPhrase").textContent = s.phraseIdx + " / " + s.song.phrases.length;
    $("rFreed").textContent = s.freed;
    $("rWpm").textContent = wpm + " WPM";
    $("rAcc").textContent = acc + "%";
    $("rCombo").textContent = s.maxCombo;
    $("rPerfect").textContent = s.rhythmOn ? perfectRate + "%" : "-";
    showScreen("resultScreen");
  }

  return {
    showScreen, buildSongList, setRhythmButtons, renderPhrase,
    createEnemyEl, setEnemyHp, showJudge, showFree, showCombo,
    flashMiss, heroHit, setHeroPose, showGyuin, updateAllies, showVictoryBanner,
    beatPulse, updateHUD, showResult,
  };
})();
