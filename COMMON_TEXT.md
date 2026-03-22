# Common Events — Translated File Names
> Source: `engine_test/月咲流ホノカver1.03/dump/common/`

## ○ Public API (callable by game events)

| # | Japanese | English |
|---|----------|---------|
| 0 | ○アイテム増減 | Item Increase/Decrease |
| 1 | ○武器増減 | Weapon Increase/Decrease |
| 2 | ○防具増減 | Armor Increase/Decrease |
| 3 | ○お金の増減 | Money Increase/Decrease |
| 4 | ○回復・ダメージ処理 | Recovery / Damage Processing |
| 5 | ○メンバーの増減 | Party Member Increase/Decrease |
| 6 | ○主人公情報の変更 | Hero Info Change |
| 7 | ○能力値増減 | Stat Increase/Decrease |
| 8 | ○特殊技能増減 | Special Skill Increase/Decrease |
| 9 | ○状態異常変化 | Status Ailment Change |
| 10 | ○経験値・Lv増減 | EXP / Level Increase/Decrease |
| 11 | ○装備武器の変更 | Equipped Weapon Change |
| 12 | ○装備防具の変更 | Equipped Armor Change |
| 13 | ○戦闘コマンドの変更 | Battle Command Change |
| 14 | ○各種メニュー呼出 | Various Menu Call |
| 15 | ○セーブ許可・禁止設定 | Save Allow/Prohibit Setting |

## ▲ Getters (return values)

| # | Japanese | English |
|---|----------|---------|
| 17 | ▲アイテム所持数取得 | Get Item Count |
| 18 | ▲武器所持数取得 | Get Weapon Count |
| 19 | ▲防具所持数取得 | Get Armor Count |
| 20 | ▲所持金取得 | Get Money Amount |
| 21 | ▲装備取得 | Get Equipment |
| 22 | ▲メンバー情報取得[数値] | Get Member Info [Numeric] |
| 23 | ▲メンバー情報取得[文字列] | Get Member Info [String] |
| 24 | ▲状態異常の取得 | Get Status Ailment |
| 25 | ▲特殊技能の有無取得 | Check Special Skill Presence |
| 26 | ▲戦闘コマンド有無の判定 | Check Battle Command Presence |

## ◆ Battle (public)

| # | Japanese | English |
|---|----------|---------|
| 28 | ◆バトルの発生 | Start Battle |
| 29 | ◆[戦闘用]敵キャラの追加 | [Battle] Add Enemy |
| 30 | ◆[戦闘用]メッセージ表示 | [Battle] Show Message |
| 31 | ◆[戦闘用]ダメージ処理 | [Battle] Damage Processing |

## 【】 Shop (public)

| # | Japanese | English |
|---|----------|---------|
| 33 | 【1】お店 初期化 | [1] Shop Initialize |
| 34 | 【2】お店 商品の追加 | [2] Shop Add Item |
| 35 | 【3】お店処理 実行 | [3] Shop Execute |

## ◇ Encounter

| # | Japanese | English |
|---|----------|---------|
| 37 | ◇ランダムエンカウント処理 | Random Encounter Processing |

---

## X[共] Internal — Common (do not call directly)

| # | Japanese | English |
|---|----------|---------|
| 48 | X[共]基本ｼｽﾃﾑ自動初期化 | [Common] Basic System Auto-Init |
| 49 | X[共]システムSE再生 | [Common] System SE Playback |
| 50 | X[共]アイテム増減 | [Common] Item Increase/Decrease |
| 51 | X[共]武器増減 | [Common] Weapon Increase/Decrease |
| 52 | X[共]防具増減 | [Common] Armor Increase/Decrease |
| 53 | X[共]所持金増減 | [Common] Money Increase/Decrease |
| 54 | X[共]ｱｲﾃﾑ所持数取得 | [Common] Get Item Count |
| 55 | X[共]武器所持数取得 | [Common] Get Weapon Count |
| 56 | X[共]防具所持数取得 | [Common] Get Armor Count |
| 57 | X[共]所持金取得 | [Common] Get Money Amount |
| 58 | X[共]技能の習得・消去 | [Common] Learn / Remove Skill |
| 59 | X[共]ウェイト(キー押しで中断) | [Common] Wait (key interrupt) |
| 60 | X[共]ウェイト2(キー押しで加速) | [Common] Wait 2 (key accelerate) |
| 61 | X[共]キー押し加速ｳｪｲﾄ計算 | [Common] Key Accelerate Wait Calc |
| 63 | X[共]メッセージウィンドウ | [Common] Message Window |
| 64 | X[共]万能ｳｨﾝﾄﾞｳ描画処理 | [Common] Universal Window Draw |
| 65 | X[共]万能ｳｨﾝﾄﾞｳ選択実行 | [Common] Universal Window Select Execute |
| 66 | X[共]万能ｳｨﾝﾄﾞｳ説明欄変更 | [Common] Universal Window Description Change |
| 67 | X[共]全体エフェクト実行 | [Common] Global Effect Execute |

## X[移] Internal — Movement/Overworld

| # | Japanese | English |
|---|----------|---------|
| 70 | X[移]パラメータ増減 | [Map] Parameter Increase/Decrease |
| 71 | X[移]パラメータ取得 | [Map] Get Parameter |
| 72 | X[移]パラメータ変更(文字列) | [Map] Change Parameter (String) |
| 73 | X[移]パラメータ取得(文字列) | [Map] Get Parameter (String) |
| 74 | X[移]レベルアップ処理 | [Map] Level Up Processing |
| 75 | X[移]状態付与_消去 | [Map] Apply / Remove Status |
| 76 | X[移]状態更新 | [Map] Status Update |
| 77 | X[移]戦闘コマンド変更 | [Map] Battle Command Change |
| 78 | X[移]戦闘コマンド取得 | [Map] Get Battle Command |
| 79 | X[移]パーティー情報計算 | [Map] Party Info Calculation |
| 80 | X[移]パーティー画像再設定 | [Map] Party Image Reset |
| 82 | X[移]お店商品初期化 | [Map] Shop Item Init |
| 83 | X[移]お店商品追加 | [Map] Add Shop Item |
| 84 | X[移]お店実行 | [Map] Shop Execute |
| 85 | X[移]┣ お店　描画 | [Map] Shop Draw |
| 86 | X[移]┗ お店内部情報更新 | [Map] Shop Internal Info Update |
| 88 | X[移]メニュー描画 | [Map] Menu Draw |
| 89 | X┗[移]メニューコマンド算出 | [Map] Menu Command Calculation |
| 90 | X[移]キャラクター欄描画 | [Map] Character Panel Draw |
| 91 | X[移]ｷｬﾗｸﾀｰ欄_座標算出 | [Map] Character Panel Coordinate Calc |
| 92 | X[移]キャラ欄_全員描画 | [Map] Character Panel Draw All |
| 93 | X[移]装備画面描画 | [Map] Equipment Screen Draw |
| 94 | X[移]セーブ・ロード画面描画 | [Map] Save/Load Screen Draw |
| 95 | X[移]システム画面描画 | [Map] System Screen Draw |
| 96 | X[移]ﾀﾞﾒｰｼﾞ・回復ﾎﾟｯﾌﾟｱｯﾌﾟ | [Map] Damage/Recovery Popup |
| 97 | X[移]指定ｷｬﾗHP_SP回復表示 | [Map] Specified Char HP/SP Recovery Display |
| 98 | X[移]指定ｷｬﾗ状態付与表示 | [Map] Specified Char Status Apply Display |
| 99 | X[移]残りアイテム数表示 | [Map] Remaining Item Count Display |
| 100 | X[移]ミニウィンドウ表示 | [Map] Mini Window Display |
| 101 | X[移]メニュー時文章表示 | [Map] Menu Text Display |
| 102 | X[移]上部ステータス描画 | [Map] Top Status Draw |
| 104 | X[移]選択位置主人公ID設定 | [Map] Set Selected Hero ID |
| 105 | X[移]選択位置主人公ID取得 | [Map] Get Selected Hero ID |
| 106 | X[移]選択箇所装備コード取得 | [Map] Get Selected Equipment Code |
| 107 | X[移]選択箇所装備コード設定 | [Map] Set Selected Equipment Code |
| 108 | X[移]ｷｬﾗｸﾀｰ欄_選択実行 | [Map] Character Panel Select Execute |
| 109 | X[移]装備欄_選択実行 | [Map] Equipment Panel Select Execute |
| 110 | X[移]ｱｲﾃﾑ一覧算出 | [Map] Item List Calculation |
| 111 | X[移]技能一覧算出 | [Map] Skill List Calculation |
| 112 | X[移]装備一覧算出 | [Map] Equipment List Calculation |
| 113 | X[移]装備装着・解除 | [Map] Equip / Unequip |
| 114 | X[移]装備ﾊﾟﾗﾒｰﾀ差分算出 | [Map] Equipment Parameter Diff Calc |
| 115 | X[移]キーリピート設定 | [Map] Key Repeat Setting |
| 116 | X[移]記憶キー位置取得 | [Map] Get Memory Key Position |
| 117 | X[移]記憶キー位置設定 | [Map] Set Memory Key Position |
| 118 | X[移]ｱｲﾃﾑ使用効果処理 | [Map] Item Use Effect Processing |
| 119 | X[移]技能使用効果処理 | [Map] Skill Use Effect Processing |
| 120 | X[移]ｱｲﾃﾑ使用_消費処理 | [Map] Item Use/Consume Processing |
| 121 | X[移]技能使用_消費処理 | [Map] Skill Use/Consume Processing |
| 122 | X[移]一時ｽﾃ計算_初期化_ | [Map] Temp Stat Calc Init |
| 123 | X[移]一時ｽﾃ計算_装備補正_ | [Map] Temp Stat Calc Equipment Correction |
| 124 | X[移]一時ｽﾃ計算_状態補正_ | [Map] Temp Stat Calc Status Correction |
| 126 | X[移]歩行時_並列キー処理 | [Map] Walk Parallel Key Processing |
| 127 | X[移]メニュー起動 | [Map] Menu Launch |
| 128 | X┣[移]アイテム欄実行 | [Map] Item Panel Execute |
| 129 | X┣[移]技能欄実行 | [Map] Skill Panel Execute |
| 130 | X┣[移]装備欄実行 | [Map] Equipment Panel Execute |
| 131 | X┣[移]セーブ欄実行 | [Map] Save Panel Execute |
| 132 | X┗[移]システム欄実行 | [Map] System Panel Execute |

## X[戦] Internal — Battle

| # | Japanese | English |
|---|----------|---------|
| 135 | X[戦]パラメータ増減 | [Battle] Parameter Increase/Decrease |
| 136 | X[戦]パラメータ取得 | [Battle] Get Parameter |
| 137 | X[戦]状態付与_消去 | [Battle] Apply / Remove Status |
| 138 | X[戦]┗状態変化ﾒｯｾｰｼﾞ | [Battle] Status Change Message |
| 139 | X[戦]状態更新 | [Battle] Status Update |
| 140 | X[戦]戦闘変数初期化 | [Battle] Battle Variable Init |
| 141 | X[戦]ｽﾛｯﾄから主人公ID取得 | [Battle] Get Hero ID from Slot |
| 142 | X[戦]指定主人公更新処理 | [Battle] Specified Hero Update |
| 143 | X[戦]主人公DB→戦闘DBコピー | [Battle] Hero DB → Battle DB Copy |
| 144 | X[戦]敵DB→戦闘DBコピー | [Battle] Enemy DB → Battle DB Copy |
| 145 | X[戦]選択箇所装備コード取得 | [Battle] Get Selected Equipment Code |
| 146 | X[戦]一時ｽﾃ計算_初期化_ | [Battle] Temp Stat Calc Init |
| 147 | X[戦]一時ｽﾃ計算_装備補正_ | [Battle] Temp Stat Calc Equipment Correction |
| 148 | X[戦]一時ｽﾃ計算_状態補正_ | [Battle] Temp Stat Calc Status Correction |
| 149 | X[戦]戦闘DB→主人公DBへ戻す | [Battle] Battle DB → Hero DB Restore |
| 150 | X[戦]戦闘コマンド取得 | [Battle] Get Battle Command |
| 151 | X[戦]戦闘コマンド設定 | [Battle] Set Battle Command |
| 152 | X[戦]戦闘ｺﾏﾝﾄﾞ一覧算出 | [Battle] Battle Command List Calc |
| 153 | X[戦]ｱｲﾃﾑ一覧算出 | [Battle] Item List Calc |
| 154 | X[戦]技能一覧算出 | [Battle] Skill List Calc |
| 155 | X[戦]記憶キー位置取得 | [Battle] Get Memory Key Position |
| 156 | X[戦]記憶キー位置設定 | [Battle] Set Memory Key Position |
| 157 | X[戦]コマンド登録 | [Battle] Command Registration |
| 158 | X[戦]ｱｲﾃﾑ選択実行 | [Battle] Item Select Execute |
| 159 | X[戦]技能選択実行 | [Battle] Skill Select Execute |
| 160 | X[戦]AI実行 | [Battle] AI Execute |
| 161 | X[戦]味方対象選択実行 | [Battle] Ally Target Select Execute |
| 162 | X[戦]敵対象選択実行 | [Battle] Enemy Target Select Execute |
| 163 | X[戦]敵･味方行動対象算出 | [Battle] Enemy/Ally Action Target Calc |
| 164 | X[戦]行動実行結果算出 | [Battle] Action Result Calc |
| 165 | X[戦]┗単体処理 | [Battle] Single Target Processing |
| 166 | X[戦]　　┗ｶｳﾝﾀｰ判定 | [Battle] Counter Check |
| 167 | X[戦]ｶｳﾝﾀｰ実行結果算出 | [Battle] Counter Result Calc |
| 168 | X[戦]変身判定 | [Battle] Transform Check |
| 169 | X[戦]ｱｲﾃﾑ使用_消費処理 | [Battle] Item Use/Consume Processing |
| 170 | X[戦]技能使用_消費処理 | [Battle] Skill Use/Consume Processing |
| 171 | X[戦]敵撃破処理 | [Battle] Enemy Defeat Processing |
| 172 | X[戦]敵_味方・勝敗判定 | [Battle] Win/Lose Check |
| 173 | X[戦]┗ 残りターン数表示 | [Battle] Remaining Turn Display |
| 174 | X[戦]味方欄_座標算出 | [Battle] Ally Panel Coordinate Calc |
| 175 | X[戦]敵キャラ_座標算出 | [Battle] Enemy Coordinate Calc |
| 176 | X[戦]基本状態取得 | [Battle] Get Base Status |
| 178 | X[戦]味方欄_単体描画 | [Battle] Ally Panel Single Draw |
| 179 | X[戦]敵キャラ_単体描画 | [Battle] Enemy Single Draw |
| 180 | X[戦]バックグラウンド描画 | [Battle] Background Draw |
| 181 | X[戦]ﾀﾞﾒｰｼﾞ・回復ﾎﾟｯﾌﾟｱｯﾌﾟ | [Battle] Damage/Recovery Popup |
| 182 | X[戦]戦闘メッセージ表示 | [Battle] Battle Message Display |
| 183 | X[戦]技能エフェクト描画 | [Battle] Skill Effect Draw |
| 184 | X[戦]警告文章表示 | [Battle] Warning Text Display |
| 185 | X[戦]上部ステータス描画 | [Battle] Top Status Draw |
| 186 | X[戦]戦利品獲得画面 | [Battle] Loot Acquisition Screen |
| 188 | X◆戦闘処理 | Battle Processing (main) |
| 189 | X┣◆戦闘初期化 | Battle Init |
| 190 | X┣◆戦闘キャラ配置 | Battle Character Placement |
| 191 | X┣◆行動内容のセット | Set Action Content |
| 192 | X┃┣◆味方コマンド選択 | Ally Command Select |
| 193 | X┃┗◆敵・味方AI計算 | Enemy/Ally AI Calculation |
| 194 | X┣◆行動順の計算 | Action Order Calculation |
| 195 | X┣◆１ターンの処理を実行 | Execute 1 Turn |
| 196 | X┃┣◆行動可能判定 | Action Possible Check |
| 197 | X┃┗◆１行動ループ | 1 Action Loop |
| 198 | X┣◆ターン終了処理 | Turn End Processing |
| 199 | X┣◆主人公ＤＢ復元 | Hero DB Restore |
| 200 | X┣◆戦利品獲得処理 | Loot Acquisition Processing |
| 201 | X┗◆戦闘終了処理 | Battle End Processing |

## ○[変更可] Modifiable hooks

| # | Japanese | English |
|---|----------|---------|
| 203 | ○[変更可]戦闘開始時処理 | [Modifiable] Battle Start Hook |
| 204 | ○[変更可]1ﾀｰﾝ開始時処理 | [Modifiable] Turn Start Hook |
| 205 | ○[変更可]1ﾀｰﾝ終了時処理 | [Modifiable] Turn End Hook |
| 206 | ○[変更可]戦闘終了後処理 | [Modifiable] Post-Battle Hook |

---

## Game-specific events (free-use zone)

| # | Japanese | English |
|---|----------|---------|
| 208 | 【基本ｼｽﾃﾑVer2.24説明書】 | Basic System Ver2.24 Manual |
| 212 | 相談コマンド | Consultation Command |
| 213 | ゲームオーバーイベント | Game Over Event |
| 214 | WOLF RPGエディター使用Ev | WOLF RPG Editor Usage Event |
| 215 | ゲーム終了 | Game End |
| 216 | ステータス表示 | Status Display |
| 217 | 増減 | Increase/Decrease |
| 218 | [北]ぴぽや感情・状態ｱｲｺﾝ表示 | [North] Pipoya Emotion/Status Icon Display |
| 219 | ほのか立ち絵 | Honoka Standing CG |
| 220 | はづき立ち絵 | Hazuki Standing CG |
| 221 | 利息計算 | Interest Calculation |
| 222 | いぶき立ち絵 | Ibuki Standing CG |
| 223 | 返済 | Repayment |
| 224 | 訓練レベル1 | Training Level 1 |
| 225 | 訓練画像 | Training Image |
| 226 | 修行メニュー | Training Menu |
| 227 | パチンコ | Pachinko |
| 228 | 訓練レベル2 | Training Level 2 |
| 229 | 訓練レベル3 | Training Level 3 |
| 230 | だんご屋 | Dango Shop |
| 231 | 手マン | Hand Job (adult content) |
| 232 | イベント2 | Event 2 |
| 233 | フラッシュ | Flash |
| 234 | イベント3 | Event 3 |
| 235 | イベント4 | Event 4 |
| 236 | イブキいべ | Ibuki Event |
| 237 | イベント5 | Event 5 |
| 238 | イベント6 | Event 6 |
| 239 | イベント7 | Event 7 |
| 240 | イベント8 | Event 8 |
| 241 | イベント9 | Event 9 |
| 242 | 敗北仮1 | Defeat Draft 1 |
| 243 | イベント10 | Event 10 |
| 244 | イベント11 | Event 11 |
| 245 | イベント12 | Event 12 |
| 246 | イベント13 | Event 13 |
| 247 | 手マン2 | Hand Job 2 (adult content) |
| 248 | イベント14 | Event 14 |
| 249 | イベント15 | Event 15 |
| 250 | イベント16 | Event 16 |
| 251 | イベント17 | Event 17 |
| 252 | イベント18 | Event 18 |
| 253 | イベント19 | Event 19 |
| 254 | イベント20 | Event 20 |
| 255 | イベント21 | Event 21 |
| 256 | イベント22 | Event 22 |
| 257 | イベント23 | Event 23 |
| 258 | イベント24 | Event 24 |
| 259 | イベント25 | Event 25 |
| 260 | イベント26 | Event 26 |
| 261 | 手マン3 | Hand Job 3 (adult content) |
| 262 | イベント27 | Event 27 |
| 263 | イベント28 | Event 28 |
| 264 | イベント29 | Event 29 |
| 265 | イベント30 | Event 30 |
| 266 | イベント31 | Event 31 |
| 267 | よわフラッシュ | Weak Flash |
| 268 | 敗北仮2 | Defeat Draft 2 |
| 269 | 敗北仮3 | Defeat Draft 3 |
| 270 | 敗北仮4 | Defeat Draft 4 |
| 271 | えんでぃんぐ | Ending |

---

## Notes on prefixes

| Prefix | Meaning |
|--------|---------|
| ○ | Public API — safe to call from map events |
| ▲ | Getter — returns a value |
| ◆ | Battle-specific public command |
| 【n】 | Numbered step in a multi-step sequence |
| ◇ | Utility |
| X[共] | Internal common — **do not call directly** |
| X[移] | Internal map/overworld — **do not call directly** |
| X[戦] | Internal battle — **do not call directly** |
| ○[変更可] | Modifiable hook — intended for game-specific customization |
