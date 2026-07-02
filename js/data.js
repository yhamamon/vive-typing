"use strict";
/* =========================================================================
   VT_DATA: 曲・フレーズ・敵のデータ。ここを編集して自由に追加・差し替えできます。
   ・phrases: {jp:"画面に出る表示", roman:"実際に打つ文字"} の形
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
        {jp:"君と踊る真夜中",       roman:"kimitoodorumayonaka"},
        {jp:"ネオンが呼んでいる",   roman:"neongayondeiru"},
        {jp:"眠らない街のリズム",   roman:"nemuranaimachinorizumu"},
        {jp:"高鳴る胸の鼓動",       roman:"takanarumunenokodou"},
        {jp:"夜明けまで踊ろう",     roman:"yoakemadeodorou"},
        {jp:"光る街並みを抜けて",   roman:"hikarumachinamiwonukete"},
        {jp:"土曜の夜の魔法",       roman:"doyounoyorunomahou"},
        {jp:"恋はメロウな魔法",     roman:"koihamerounamahou"},
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
        {jp:"燃え上がれ魂",         roman:"moeagaretamashii"},
        {jp:"鋼の咆哮",             roman:"haganenohoukou"},
        {jp:"地獄の業火を越えて",   roman:"jigokunogoukawokoete"},
        {jp:"叫べ限界まで",         roman:"sakebegenkaimade"},
        {jp:"轟音の嵐",             roman:"gouonnoarashi"},
        {jp:"拳を突き上げろ",       roman:"kobushiwotsukiagero"},
        {jp:"闇を切り裂く稲妻",     roman:"yamiwokirisakuinazuma"},
        {jp:"走れ疾風のように",     roman:"hashirehayatenoyouni"},
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
        {jp:"諦めない心",           roman:"akiramenaikokoro"},
        {jp:"奇跡は起こすもの",     roman:"kisekihaokosumono"},
        {jp:"君の名を呼ぶ声",       roman:"kiminonawoyobukoe"},
        {jp:"走り出せ明日へ",       roman:"hashiridaseasuhe"},
        {jp:"仲間と共に立ち上がれ", roman:"nakamatotomonitachiagare"},
        {jp:"涙を拭いて笑おう",     roman:"namidawofuitewaraou"},
        {jp:"必殺の技が光る",       roman:"hissatsunowazagahikaru"},
        {jp:"運命を越えてゆけ",     roman:"unmeiwokoeteyuke"},
      ],
    },
  ],

  // ---- 敵（洗脳された人々とAIボス） ----
  enemies: {
    // 洗脳が解けた（解放された）ときのセリフ
    frees:[
      "ハッ…俺は何を…","目が覚めた…！","この曲…懐かしい…","ありがとう…！",
      "心が…踊ってる！","バイブスを感じる…！","私、戻ってきた…！",
    ],
  },

  // ---- 敵ティア：ステージが進むほどAIの支配が深く食い込み、敵が硬く・別の見た目になる ----
  // minStage以上のステージで出現。hpMult/speedMultはステージ1のzakoHp/baseSpeedへの倍率。
  // hue: CSS hue-rotate(deg) で色味を変えて「違う敵」感を出す。ringColor: HPバー枠の色。
  enemyTiers:[
    { minStage:1, label:"洗脳された人々",   looks:["🧟","🧍","🚶","🧑‍💼","👩‍💻","🧑‍🔧"],
      hpMult:1.0, speedMult:1.0, hue:0,   ringColor:"#22e5ff" },
    { minStage:2, label:"強化戦闘員",       looks:["🥷","🦹","👺","🧌"],
      hpMult:1.9, speedMult:1.12, hue:110, ringColor:"#7dff5a" },
    { minStage:3, label:"機械化兵",         looks:["🤖","👽","💀"],
      hpMult:3.0, speedMult:1.25, hue:260, ringColor:"#c07dff" },
  ],
  // ---- ボスの見た目（ステージごとに切り替わる。足りない分は最後のものをループ） ----
  bossLooks:["🤖","👹","👽","🛸"],

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
