"use strict";
/* =========================================================================
   VT_DATA: 曲・フレーズ・敵のデータ。ここを編集して自由に追加・差し替えできます。
   ・phrases: {section, jp:"画面に出る表示", roman:"実際に打つ文字"} の配列。
     シャッフルせず先頭から順番に再生される＝曲の構成そのもの。
     section: "verseA"(Aメロ) / "verseB"(Bメロ) / "chorus"(サビ＝中ボス出現)
              / "finalChorus"(大サビ＝ボス出現) / "outro"(戦闘なし。歌い切って終わる)
   ・melody : 正解キーを打つたびに1音ずつ鳴る音符（ループする）
   ・bass   : 1小節ごとのベース音（ループする）
   ・歌詞・曲名はすべてオリジナル（実在曲のオマージュ「風」）。
     実在の曲の歌詞をそのまま入れると著作権に触れるため注意。
   ========================================================================= */
const VT_DATA = {

  // ---- ジャンル定義（敵の相性アイコンにも使う） ----
  genres: {
    pop:    { icon:"🎤", label:"J-POP" },
    metal:  { icon:"🤘", label:"メタル" },
    anison: { icon:"⭐", label:"アニソン" },
  },

  // ---- 曲リスト ----
  songs: [
    {
      id:"tokyo_groove",
      title:"トーキョー・グルーヴ",
      genre:"pop", bpm:122,
      desc:"眠らない街を駆けるシティポップ風",
      melody:["E4","G4","A4","B4","D5","B4","A4","G4",
              "E4","G4","A4","C5","B4","A4","G4","E4"],
      bass:["E2","C2","D2","E2"],
      phrases:[
        {section:"verseA", jp:"静かな夜が始まる",     roman:"shizukanayorugahajimaru"},
        {section:"verseA", jp:"窓の外は雨上がり",     roman:"madonosotohaameagari"},
        {section:"verseA", jp:"君を待つこの部屋で",   roman:"kimiwomatsukonoheyade"},
        {section:"verseB", jp:"電話越しの声が揺れる", roman:"denwagoshinokoegayureru"},
        {section:"verseB", jp:"少しだけ大人になった", roman:"sukoshidakeotonaninatta"},
        {section:"verseB", jp:"答えはまだ出せなくて", roman:"kotaehamadadasenakute"},
        {section:"chorus", jp:"君と踊る真夜中",       roman:"kimitoodorumayonaka"},
        {section:"chorus", jp:"ネオンが呼んでいる",   roman:"neongayondeiru"},
        {section:"chorus", jp:"眠らない街のリズム",   roman:"nemuranaimachinorizumu"},
        {section:"finalChorus", jp:"高鳴る胸の鼓動",     roman:"takanarumunenokodou"},
        {section:"finalChorus", jp:"夜明けまで踊ろう",   roman:"yoakemadeodorou"},
        {section:"finalChorus", jp:"光る街並みを抜けて", roman:"hikarumachinamiwonukete"},
        {section:"finalChorus", jp:"土曜の夜の魔法",     roman:"doyounoyorunomahou"},
        {section:"outro", jp:"恋はメロウな魔法",       roman:"koihamerounamahou"},
      ],
    },
    {
      id:"hellfire",
      title:"業火のバイブス",
      genre:"metal", bpm:164,
      desc:"魂を燃やす疾走メタル風",
      melody:["E3","E3","G3","E3","A3","G3","F3","E3",
              "E3","E3","G3","A3","B3","A3","G3","E3"],
      bass:["E1","E1","F1","G1"],
      phrases:[
        {section:"verseA", jp:"牙を研ぎ澄ませ",       roman:"kibawotogisumase"},
        {section:"verseA", jp:"血が滾る夜明け前",     roman:"chigatagiruyoakemae"},
        {section:"verseA", jp:"闇の中で目覚めろ",     roman:"yaminonakademezamero"},
        {section:"verseB", jp:"拳を握りしめて",       roman:"kobushiwonigirishimete"},
        {section:"verseB", jp:"心臓が加速する",       roman:"shinzougakasokusuru"},
        {section:"verseB", jp:"限界などない",         roman:"genkainadonai"},
        {section:"chorus", jp:"燃え上がれ魂",         roman:"moeagaretamashii"},
        {section:"chorus", jp:"鋼の咆哮",             roman:"haganenohoukou"},
        {section:"chorus", jp:"叫べ限界まで",         roman:"sakebegenkaimade"},
        {section:"finalChorus", jp:"地獄の業火を越えて", roman:"jigokunogoukawokoete"},
        {section:"finalChorus", jp:"轟音の嵐",           roman:"gouonnoarashi"},
        {section:"finalChorus", jp:"拳を突き上げろ",     roman:"kobushiwotsukiagero"},
        {section:"finalChorus", jp:"闇を切り裂く稲妻",   roman:"yamiwokirisakuinazuma"},
        {section:"outro", jp:"走れ疾風のように",       roman:"hashirehayatenoyouni"},
      ],
    },
    {
      id:"genkai_dreamer",
      title:"限界突破ドリーマー",
      genre:"anison", bpm:148,
      desc:"熱血と友情の王道アニソン風",
      melody:["C4","E4","G4","C5","B4","G4","A4","G4",
              "F4","A4","C5","A4","G4","E4","D4","C4"],
      bass:["C2","A1","F1","G1"],
      phrases:[
        {section:"verseA", jp:"夜明け前の静けさ",       roman:"yoakemaenoshizukesa"},
        {section:"verseA", jp:"一人じゃないと気づいた", roman:"hitorijanaitokizuita"},
        {section:"verseA", jp:"小さな一歩からでいい",   roman:"chiisanaippokaradeii"},
        {section:"verseB", jp:"涙の数だけ強くなる",     roman:"namidanokazudaketsuyokunaru"},
        {section:"verseB", jp:"夢を諦めきれなくて",     roman:"yumewoakiramekirenakute"},
        {section:"verseB", jp:"この手を離さないで",     roman:"konotewohanasanaide"},
        {section:"chorus", jp:"諦めない心",             roman:"akiramenaikokoro"},
        {section:"chorus", jp:"奇跡は起こすもの",       roman:"kisekihaokosumono"},
        {section:"chorus", jp:"君の名を呼ぶ声",         roman:"kiminonawoyobukoe"},
        {section:"finalChorus", jp:"走り出せ明日へ",           roman:"hashiridaseasuhe"},
        {section:"finalChorus", jp:"仲間と共に立ち上がれ",     roman:"nakamatotomonitachiagare"},
        {section:"finalChorus", jp:"必殺の技が光る",           roman:"hissatsunowazagahikaru"},
        {section:"finalChorus", jp:"運命を越えてゆけ",         roman:"unmeiwokoeteyuke"},
        {section:"outro", jp:"涙を拭いて笑おう",         roman:"namidawofuitewaraou"},
      ],
    },
  ],

  // ---- 敵（洗脳された人々とAIボス） ----
  enemies: {
    // 一部はただの市民、一部はimage5参考のミュージシャン（洗脳された演奏者）
    zakoLooks:["citizen1","citizen2","guitarist1","guitarist2","singer"],
    // 洗脳が解けた（解放された）ときのセリフ
    frees:[
      "ハッ…俺は何を…","目が覚めた…！","この曲…懐かしい…","ありがとう…！",
      "心が…踊ってる！","バイブスを感じる…！","私、戻ってきた…！",
    ],
  },

  // ---- 中ボス（サビで1体出現）・ボス（大サビで1体出現）の見た目 ----
  midBossLook:"rockstar",  // AIに支配された暴走ロックスター
  bossLook:"robot",        // AIそのもの（機械的な最終ボス）

  // ---- 敵の見た目（フラットベクターSVG）。VTUI.createEnemyElがlook文字列からここを引いて描画する ----
  // 主人公と同じ「単色フラット塗り・角のあるシルエット」のテイストで統一。
  // ミュージシャン系（guitarist1/2, singer, rockstar）はimage5のロックバンドイラストを参考にした構図。
  enemyArt: {
    citizen1:
      '<svg viewBox="0 -4 60 96">'+
      '<ellipse cx="30" cy="11" rx="10" ry="9" fill="#e8b088"/>'+
      '<path d="M19 6 Q22 -2 30 -1 Q38 -2 41 6 Q41 12 36 12 L24 12 Q19 11 19 6Z" fill="#3a2a1f"/>'+
      '<rect x="24" y="17" width="12" height="9" fill="#e8b088"/>'+
      '<rect x="14" y="24" width="32" height="34" fill="#4a9fd8"/>'+
      '<rect x="4" y="26" width="10" height="28" fill="#e8b088"/>'+
      '<rect x="46" y="26" width="10" height="28" fill="#e8b088"/>'+
      '<rect x="16" y="58" width="12" height="30" fill="#52525e"/>'+
      '<rect x="32" y="58" width="12" height="30" fill="#494956"/>'+
      '<rect x="14" y="86" width="14" height="6" fill="#20222c"/>'+
      '<rect x="32" y="86" width="14" height="6" fill="#20222c"/>'+
      '</svg>',
    citizen2:
      '<svg viewBox="0 -4 60 96">'+
      '<ellipse cx="30" cy="11" rx="10" ry="9" fill="#e8b088"/>'+
      '<path d="M17 14 Q15 -4 30 -4 Q45 -4 43 14 Q43 22 36 20 L24 20 Q17 22 17 14Z" fill="#ff9d3d"/>'+
      '<rect x="24" y="17" width="12" height="9" fill="#e8b088"/>'+
      '<rect x="14" y="20" width="32" height="38" fill="#ff9d3d"/>'+
      '<rect x="4" y="26" width="10" height="28" fill="#ff9d3d"/>'+
      '<rect x="46" y="26" width="10" height="28" fill="#ff9d3d"/>'+
      '<rect x="4" y="50" width="10" height="6" fill="#e8b088"/>'+
      '<rect x="46" y="50" width="10" height="6" fill="#e8b088"/>'+
      '<rect x="16" y="58" width="12" height="30" fill="#26262e"/>'+
      '<rect x="32" y="58" width="12" height="30" fill="#26262e"/>'+
      '<rect x="14" y="86" width="14" height="6" fill="#111219"/>'+
      '<rect x="32" y="86" width="14" height="6" fill="#111219"/>'+
      '</svg>',
    guitarist1:
      '<svg viewBox="0 -4 60 96">'+
      '<ellipse cx="30" cy="11" rx="10" ry="9" fill="#e8b088"/>'+
      '<path d="M19 6 Q22 -2 30 -1 Q38 -2 41 6 Q41 12 36 12 L24 12 Q19 11 19 6Z" fill="#241a12"/>'+
      '<rect x="24" y="17" width="12" height="9" fill="#e8b088"/>'+
      '<rect x="14" y="24" width="32" height="34" fill="#ffd83b"/>'+
      '<polygon points="12,58 30,62 20,88 8,84" fill="#24242c"/>'+
      '<polygon points="48,58 30,62 40,88 52,84" fill="#1c1c22"/>'+
      '<polygon points="6,84 22,88 22,92 4,90" fill="#111219"/>'+
      '<polygon points="38,88 54,84 56,90 38,92" fill="#111219"/>'+
      '<ellipse cx="30" cy="52" rx="15" ry="12" fill="#3b6fd1"/>'+
      '<rect x="12" y="46" width="30" height="7" fill="#5c3a22" transform="rotate(-10 27 49)"/>'+
      '<rect x="4" y="26" width="10" height="24" fill="#e8b088" transform="rotate(14 9 38)"/>'+
      '<rect x="46" y="26" width="10" height="24" fill="#e8b088" transform="rotate(-18 51 38)"/>'+
      '</svg>',
    guitarist2:
      '<svg viewBox="0 -4 60 96">'+
      '<ellipse cx="30" cy="11" rx="10" ry="9" fill="#e8b088"/>'+
      '<path d="M18 4 Q22 -4 30 -3 Q40 -3 42 8 Q43 14 36 12 Q30 8 24 12 Q18 13 18 4Z" fill="#161616"/>'+
      '<rect x="24" y="17" width="12" height="9" fill="#e8b088"/>'+
      '<rect x="14" y="24" width="32" height="34" fill="#2a2a33"/>'+
      '<polygon points="12,58 30,62 20,88 8,84" fill="#3b6fd1"/>'+
      '<polygon points="48,58 30,62 40,88 52,84" fill="#3468c4"/>'+
      '<polygon points="6,84 22,88 22,92 4,90" fill="#111219"/>'+
      '<polygon points="38,88 54,84 56,90 38,92" fill="#111219"/>'+
      '<ellipse cx="30" cy="52" rx="15" ry="12" fill="#e8483c"/>'+
      '<rect x="12" y="46" width="30" height="7" fill="#2a1c10" transform="rotate(-10 27 49)"/>'+
      '<rect x="4" y="26" width="10" height="24" fill="#e8b088" transform="rotate(14 9 38)"/>'+
      '<rect x="46" y="26" width="10" height="24" fill="#e8b088" transform="rotate(-18 51 38)"/>'+
      '</svg>',
    singer:
      '<svg viewBox="0 -4 60 96">'+
      '<ellipse cx="30" cy="11" rx="10" ry="9" fill="#e8b088"/>'+
      '<path d="M18 4 Q22 -4 30 -3 Q40 -3 42 6 Q44 20 38 26 Q36 14 30 12 Q24 14 22 26 Q16 20 18 4Z" fill="#6b3d20"/>'+
      '<rect x="24" y="17" width="12" height="8" fill="#e8b088"/>'+
      '<rect x="16" y="24" width="28" height="18" fill="#ff5fa8"/>'+
      '<rect x="4" y="26" width="10" height="22" fill="#e8b088" transform="rotate(-20 9 37)"/>'+
      '<rect x="46" y="26" width="10" height="22" fill="#e8b088" transform="rotate(24 51 37)"/>'+
      '<polygon points="16,44 44,44 40,60 20,60" fill="#e8b088"/>'+
      '<polygon points="14,60 32,63 24,88 10,84" fill="#3b6fd1"/>'+
      '<polygon points="46,60 28,63 36,88 50,84" fill="#3468c4"/>'+
      '<polygon points="6,84 20,88 20,92 4,90" fill="#20222c"/>'+
      '<polygon points="34,88 50,84 52,90 34,92" fill="#20222c"/>'+
      '<rect x="52" y="10" width="3" height="70" fill="#8a8a94"/>'+
      '<circle cx="53.5" cy="8" r="5" fill="#cfcfd6"/>'+
      '</svg>',
    rockstar:
      '<svg viewBox="0 -10 60 102">'+
      '<ellipse cx="30" cy="11" rx="10" ry="9" fill="#e0a878"/>'+
      '<path d="M14 2 L20 -6 L24 2 L30 -8 L36 2 L40 -6 L46 2 Q46 12 38 12 L22 12 Q14 12 14 2Z" fill="#cc1f3d"/>'+
      '<rect x="24" y="17" width="12" height="9" fill="#e0a878"/>'+
      '<rect x="12" y="22" width="36" height="38" fill="#1a1a20"/>'+
      '<polygon points="10,60 30,64 18,90 4,86" fill="#0e0e12"/>'+
      '<polygon points="50,60 30,64 42,90 56,86" fill="#0a0a0e"/>'+
      '<polygon points="2,86 18,90 18,94 0,92" fill="#000"/>'+
      '<polygon points="42,90 58,86 60,92 42,94" fill="#000"/>'+
      '<ellipse cx="30" cy="54" rx="17" ry="13" fill="#ff2d55"/>'+
      '<rect x="10" y="47" width="34" height="8" fill="#1a1210" transform="rotate(-12 27 51)"/>'+
      '<rect x="0" y="24" width="12" height="26" fill="#e0a878" transform="rotate(16 6 37)"/>'+
      '<rect x="48" y="24" width="12" height="26" fill="#e0a878" transform="rotate(-20 54 37)"/>'+
      '</svg>',
    robot:
      '<svg viewBox="0 -14 60 106">'+
      '<rect x="28" y="-6" width="4" height="10" fill="#5c6479"/>'+
      '<circle cx="30" cy="-8" r="4" fill="#ff3bd4"/>'+
      '<polygon points="16,4 44,4 46,20 14,20" fill="#9aa3b8"/>'+
      '<circle cx="30" cy="12" r="6" fill="#22e5ff"/>'+
      '<rect x="24" y="20" width="12" height="6" fill="#5c6479"/>'+
      '<polygon points="12,26 48,26 44,60 16,60" fill="#8a95a8"/>'+
      '<rect x="22" y="36" width="16" height="10" fill="#5c6479"/>'+
      '<rect x="2" y="28" width="10" height="30" fill="#6b7488"/>'+
      '<rect x="48" y="28" width="10" height="30" fill="#6b7488"/>'+
      '<rect x="0" y="54" width="14" height="8" fill="#5c6479"/>'+
      '<rect x="46" y="54" width="14" height="8" fill="#5c6479"/>'+
      '<polygon points="16,60 30,63 26,88 12,86" fill="#6b7488"/>'+
      '<polygon points="44,60 30,63 34,88 48,86" fill="#5c6479"/>'+
      '<rect x="8" y="86" width="20" height="6" fill="#3a3f4d"/>'+
      '<rect x="32" y="86" width="20" height="6" fill="#3a3f4d"/>'+
      '</svg>',
  },

  // ---- 仲間ダメージボーナス：s.allies.length に応じてダメージ倍率が伸びる ----
  allyDamagePerAlly: 0.06,

  // ---- 称号（上から順に判定。score以上かつ正確率acc以上） ----
  ranks:[
    {score:5000, acc:90, name:"伝説のバイブス覇者"},
    {score:3000, acc:0,  name:"グルーヴマスター"},
    {score:1500, acc:0,  name:"バイブスの使い手"},
    {score:600,  acc:0,  name:"ストリートの踊り手"},
    {score:0,    acc:0,  name:"見習いグルーヴァー"},
  ],
};
