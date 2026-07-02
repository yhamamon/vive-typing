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
    zakoLooks:["🧟","🧍","🚶","🧑‍💼","👩‍💻","🧑‍🔧"],
    // 洗脳が解けた（解放された）ときのセリフ
    frees:[
      "ハッ…俺は何を…","目が覚めた…！","この曲…懐かしい…","ありがとう…！",
      "心が…踊ってる！","バイブスを感じる…！","私、戻ってきた…！",
    ],
  },

  // ---- 中ボス（サビで1体出現）・ボス（大サビで1体出現）の見た目 ----
  midBossLook:"👹",
  bossLook:"🤖",

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
