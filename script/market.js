let todayaction = [];

// 市場に残っている株数を計算する関数
function getAvailableShares(stock) {
    if (!stock.maxShares) return 999999; // 上限未設定なら無限扱い

    // 1. 全NPCが持っているこの株の合計
    let totalNpcShares = 0;
    [player, ...npcs].forEach(npc => {
        if (npc.portfolio && npc.portfolio[stock.id]) {
            totalNpcShares += npc.portfolio[stock.id];
        }
    });

    // 2. プレイヤーが持っているこの株の数
    const playerShares = stock.sharesOwned || 0;

    // 残り株数 ＝ 発行総数 − 発行済み（買われた）合計
    const remaining = stock.maxShares - (totalNpcShares + playerShares);
    return Math.max(0, remaining);
}

function buyStock(stockId, amount = 1) {
    const stock = stockmarket.find(s => s.id === stockId);
    if (!stock) return;

    // 💡 残り株数のチェック！
    const available = getAvailableShares(stock);
    if (available <= 0) {
        if (typeof showModal === 'function') {
            showModal("⚠️ 売り切れ", "この株は市場で売り切れています！（売り注文が出るのを待ちましょう）", [{ text: "OK", value: "ok" }]);
        } else {
            alert("この株は売り切れています！");
        }
        return;
    }

    // 買い注文数が残り株数を超えてたら、買える分だけに調整
    const actualBuyAmount = Math.min(amount, available);
    const totalCost = stock.price * actualBuyAmount;

    if ((player.money || 0) < totalCost) {
        if (typeof showModal === 'function') {
            showModal("⚠️ 資金不足", "所持金が足りません！", [{ text: "OK", value: "ok" }]);
        } else {
            alert("資金が足りません！");
        }
        return;
    }

    player.money -= totalCost;
    stock.sharesOwned = (stock.sharesOwned || 0) + actualBuyAmount;

    // 📈 売買量のカウント（株価変動用）
    stock.buyVolume = (stock.buyVolume || 0) + actualBuyAmount;

    openstockmarketModal(); // 画面更新
}

function sellStock(stockId, amount = 1) {
    const stock = stockmarket.find(s => s.id === stockId);
    if (!stock || (stock.sharesOwned || 0) < amount) {
        if (typeof showModal === 'function') {
            showModal("⚠️ 売却不可", "売却できる株を持っていません！", [{ text: "OK", value: "ok" }]);
        } else {
            alert("売却できる株を持っていません！");
        }
        return;
    }

    const totalEarnings = stock.price * amount;
    player.money += totalEarnings;
    stock.sharesOwned -= amount;

    // 💡【追加】売却量（sellVolume）を記録！
    // これにより、次の updatestockmarket() で売り圧力として判定されて株価が下がる！
    stock.sellVolume = (stock.sellVolume || 0) + amount;

    // ニュースログ（プレイヤーの大量売却もログに出すと臨場感アップ！）
    if (amount >= 50) {
        recentMarketNews = `🚨 プレイヤーが 【${stock.name}】 を ${amount}株 売却し利益確定しました！`;
    }

    openstockmarketModal(); // 画面更新
}

// 最後に起きたNPCの取引履歴（画面に表示して「生きてる感」を出す用）
let recentMarketNews = "市場は穏やかです。";

// === 2. 株価変動 ＆ NPCの売買シミュレーション（1日/1ターンごとに呼ぶ） ===
function updatestockmarket() {
    // ターンごとの売買量を記録するオブジェクト（初期化）
    stockmarket.forEach(stock => {
        if (typeof stock.sharesOwned === 'undefined') {
            stock.sharesOwned = 0
        }
        stock.buyVolume = 0;  // 買われた株数
        stock.sellVolume = 0; // 売られた株数
    });

    // ① まずNPCやプレイヤーが売買を行う！（ここで buyVolume / sellVolume が増える）
    simulateNpcTrading();
    checkAndIssueNewShares();

    // ② 売買された「量」に応じて株価が変動！
    stockmarket.forEach(stock => {
        stock.prevPrice = stock.price;

        // 売り買いの差（買われた量 - 売られた量）
        const netDemand = stock.buyVolume - stock.sellVolume;

        // 買いが多いとプラス、売りが多いとマイナスの変動率を作る
        // 例: 1株あたり 0.1% 動く（100株買われたら +10%）
        let demandImpact = netDemand * 0.001;

        // 影響が大きすぎないように±15%でガード（ストップ高・ストップ安）
        demandImpact = Math.max(-0.15, Math.min(0.15, demandImpact));

        // 世の中のランダムなノイズ（微変動 ±2%）
        const randomNoise = (Math.random() * 0.04) - 0.02;

        // 【最終株価】＝ 元の価格 × ( 1 + 買いの勢い + ランダムノイズ )
        const totalChange = demandImpact + randomNoise;
        stock.price = Math.max(10, Math.round(stock.price * (1 + totalChange)));
    });
}

function simulateNpcTrading() {
    const liveNpcs = npcs.filter(n => n.isAlive !== false);
    if (!liveNpcs.length) return;

    const activeCount = Math.min(10, liveNpcs.length);

    for (let i = 0; i < activeCount; i++) {
        const activeNpc = liveNpcs[Math.floor(Math.random() * liveNpcs.length)];
        const targetStock = stockmarket[Math.floor(Math.random() * stockmarket.length)];

        if (activeNpc.money === undefined) activeNpc.money = Math.floor(Math.random() * 50000) + 5000;
        if (!activeNpc.portfolio) activeNpc.portfolio = {};
        if (!activeNpc.portfolio[targetStock.id]) activeNpc.portfolio[targetStock.id] = 0;

        // 💡 NPCの平均購入価格（コスト）を記録するオブジェクトを用意
        if (!activeNpc.avgPrice) activeNpc.avgPrice = {};
        if (!activeNpc.avgPrice[targetStock.id]) activeNpc.avgPrice[targetStock.id] = targetStock.price;

        const isPriceDown = targetStock.price < targetStock.prevPrice;
        const currentOwned = activeNpc.portfolio[targetStock.id];
        const buyCost = activeNpc.avgPrice[targetStock.id];

        // 📉 1. 【リアルな爆死】：損切り＆パニック売り（含み損が30%を超えたら発動！）
        const lossRate = (buyCost - targetStock.price) / buyCost; // 下落率

        if (currentOwned > 0 && lossRate > 0.3) {
            // 価格が購入時より30%以上暴落！パニックになって全株〜8割を投げ売り！
            const panicSellAmount = Math.ceil(currentOwned * (Math.random() * 0.5 + 0.5));

            activeNpc.money += targetStock.price * panicSellAmount;
            activeNpc.portfolio[targetStock.id] -= panicSellAmount;
            targetStock.sellVolume = (targetStock.sellVolume || 0) + panicSellAmount;

            recentMarketNews = `😱 ${activeNpc.name} が含み損に耐えかね【${targetStock.name}】を ${panicSellAmount}株 狼狽売り（損切り）しました！`;
            continue; // 次の処理へ
        }

        // 2. 【買い処理】：値下がり時の押し目買い（高値掴みの罠）
        if (isPriceDown && activeNpc.money >= targetStock.price) {
            const available = getAvailableShares(targetStock);
            if (available <= 0) continue;

            const maxBuyableByMoney = Math.floor(activeNpc.money / targetStock.price);
            const maxLimit = Math.min(maxBuyableByMoney, available);

            const desiredAmount = Math.floor(Math.random() * Math.min(500, maxLimit)) + 1;
            const buyAmount = Math.min(desiredAmount, maxLimit);

            if (buyAmount > 0) {
                // 平均購入単価の更新（移動平均）
                const totalCost = (currentOwned * buyCost) + (buyAmount * targetStock.price);
                activeNpc.portfolio[targetStock.id] += buyAmount;
                activeNpc.avgPrice[targetStock.id] = Math.round(totalCost / activeNpc.portfolio[targetStock.id]);

                activeNpc.money -= targetStock.price * buyAmount;
                targetStock.buyVolume = (targetStock.buyVolume || 0) + buyAmount;

                if (buyAmount >= 100) {
                    recentMarketNews = `💥 ${activeNpc.name} が 【${targetStock.name}】 を ${buyAmount}株 爆買いしました！`;
                } else {
                    recentMarketNews = `📈 ${activeNpc.name} が 【${targetStock.name}】 を ${buyAmount}株 購入しました！`;
                }
            }
        }
        // 3. 【売り処理】：通常の利確（高値圏）
        else if (!isPriceDown && currentOwned > 0) {
            const isMarketFull = getAvailableShares(targetStock) === 0;

            if (isMarketFull || Math.random() < 0.4) {
                const sellAmount = Math.max(1, Math.floor(currentOwned * (Math.random() * 0.4 + 0.1)));

                activeNpc.money += targetStock.price * sellAmount;
                activeNpc.portfolio[targetStock.id] -= sellAmount;
                targetStock.sellVolume = (targetStock.sellVolume || 0) + sellAmount;

                if (sellAmount >= 100) {
                    recentMarketNews = `🚨 ${activeNpc.name} が 【${targetStock.name}】 を ${sellAmount}株 大量売却し市場に放出！`;
                } else {
                    recentMarketNews = `📉 ${activeNpc.name} が 【${targetStock.name}】 を ${sellAmount}株 売却し利確しました！`;
                }
            }
        }
    }
}

// 市場の全在庫が0になったかチェックして増資する関数
function checkAndIssueNewShares() {
    const totalAvailable = stockmarket.reduce((sum, stock) => sum + getAvailableShares(stock), 0);

    // 市場全体の在庫が完全消失したら発動
    if (totalAvailable === 0) {
        const randomStock = stockmarket[Math.floor(Math.random() * stockmarket.length)];
        const additionalShares = 200; // 200株追加発行

        randomStock.maxShares = (randomStock.maxShares || 0) + additionalShares;
        recentMarketNews = `📢 【${randomStock.name}】 が公募増資を発表！ ${additionalShares}株 が新たに市場へ供給されました！`;
    }
}

function getTopShareholder(stockId) {
    let topHolder = null;
    let maxShares = 0;

    // 1. 全NPCをチェック
    [player, ...npcs].forEach(npc => {
        if (npc.portfolio && npc.portfolio[stockId]) {
            const count = npc.portfolio[stockId];
            if (count > maxShares) {
                maxShares = count;
                topHolder = npc.name;
            }
        }
    });

    // 2. プレイヤーもチェック！（もしプレイヤーがNPCより持ってたらプレイヤーが筆頭株主に！）
    if (player.portfolio && player.portfolio[stockId]) {
        const playerCount = player.portfolio[stockId];
        if (playerCount > maxShares) {
            maxShares = playerCount;
            topHolder = player.name + "（あなた）";
        }
    }

    if (maxShares === 0) return { name: "なし", shares: 0, ratio: 0 };

    return {
        name: topHolder,
        shares: maxShares
    };
}

// === 3. 取引画面UI（ニュース機能つき） ===
function openstockmarketModal() {

    let bodyHtml = `
        <div style="text-align:center;margin-bottom:12px;">
            <span style="font-size:12px;color:#a0aec0;">現在の所持金</span><br>
            <strong style="font-size:22px;color:#48bb78;">¥${(player.money || 0).toLocaleString()}</strong>
        </div>

        <!-- 💡 NPCの動きがリアルタイムで見えるニュース欄 -->
        <div style="background:#11141a; border:1px solid #2d3748; padding:8px 12px; border-radius:6px; font-size:12px; color:#ecc94b; margin-bottom:15px; text-align:center;">
            🗣️ <b>市場ニュース:</b> ${recentMarketNews}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
    `;


    stockmarket.forEach(stock => {

        const isUp = stock.price >= stock.prevPrice;
        const diff = stock.price - stock.prevPrice;
        const priceColor = isUp ? "#7df565" : "#ff0000";
        const arrow = isUp ? "▲" : "▼";
        const top = getTopShareholder(stock.id);
        const ratio = stock.maxShares ? ((top.shares / stock.maxShares) * 100).toFixed(1) : 0;

        const topShareholderText = top.shares > 0
            ? `👑 筆頭株主: <b>${top.name}</b> (${top.shares}株 / ${ratio}%)`
            : `👑 筆頭株主: なし`;
        // 保有率（％）を計算
        const available = getAvailableShares(stock);
        const max = stock.maxShares || '∞';
        bodyHtml += `
            <div style="background:#1a202c;border:1px solid #2d3748;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <strong style="color:#fff;font-size:15px;">${stock.name}</strong>
                    <div style="font-size:12px;color:#a0aec0;margin-top:4px;">
                        あなたの保有数:<span style="color:#ecc94b;font-weight:bold;">${stock.sharesOwned || 0}株</span><br />
                        <span style="color:#ecc94b;font-weight:bold;">${topShareholderText}</span><br />
                        📦 残り在庫: <span style="color:#fff;font-weight:bold;"><b>${available}</b> / ${max} 株</span><br />
                        発行数: <span style="color:#fff;font-weight:bold;">${stock.maxShares || 0}株</span>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:15px;font-weight:bold;color:${priceColor};">
                        ¥${stock.price.toLocaleString()} <span style="font-size:11px;">(${arrow}${Math.abs(diff)}円)</span>
                    </div>
                    <div style="margin-top:6px;display:flex;gap:6px;justify-content:flex-end;">
                        <button onclick="buyStock('${stock.id}', 1)" style="background:#38a169;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">${available <= 0 ? '売り切れ' : '買 (1株)'}</button>
                        <button onclick="sellStock('${stock.id}', 1)" style="background:#e53e3e;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">売 (1株)</button>
                    </div>
                </div>
            </div>
        `;
    });

    bodyHtml += `</div>`;

    if (typeof showModal === 'function') {
        showModal("📈 株式取引市場", bodyHtml, [{ text: "閉じる", value: "close" }]);
    }
}

// 共通のお仕事・金稼ぎ処理（引数で誰がやるかを指定）
function workJob(jobType, targetEntity = player) {
    let earnings = 0;
    let jobTitle = "";
    let message = "";

    const isPlayer = (targetEntity.id === player.id);
    const entityName = targetEntity.name;
    if (todayaction.includes(targetEntity.id)) {
        if (isPlayer) {
            alert("あなたはすでに仕事をしました！（次のターンへ進めてください）")
        }
        return;
    }
    switch (jobType) {
        // ① 極限の庶民（ノーリスク・小銭）
        case 'vending':
            jobTitle = "自販機の下をチェック";
            earnings = Math.floor(Math.random() * 150); // 0〜149円
            message = earnings > 0
                ? `${entityName}は100円玉を見つけた！ lucky!`
                : `${entityName}の釣り銭口チェックは不発に終わった…`;
            break;

        // ② 定番のバイト（確実な手取り）
        case 'tissue':
            jobTitle = "ティッシュ配り";
            earnings = Math.floor(Math.random() * 300) + 800; // 800〜1,099円
            message = `${entityName}は街頭でティッシュを配り切った！`;
            break;

        case 'night_shift':
            jobTitle = "コンビニ深夜ワンオペ";
            earnings = Math.floor(Math.random() * 1000) + 3500; // 3,500〜4,499円
            message = `${entityName}はワンオペの修羅場を耐え抜いた！`;
            break;

        // ③ ちょっとしたギャンブル/商売（せどり）
        case 'flea_market':
            jobTitle = "掘り出し物の転売（せどり）";
            const isSuccess = Math.random() < 0.7; // 70%で成功
            if (isSuccess) {
                earnings = Math.floor(Math.random() * 2000) + 1000; // 1,000〜2,999円
                message = `${entityName}がフリマで買ったジャンク品が高値で売れた！`;
            } else {
                earnings = -500; // 損切り
                message = `${entityName}の仕入れた商品が売れ残って赤字になった…`;
            }
            break;
    }

    // 対象の所持金を更新（マイナスガード）
    targetEntity.money = Math.max(0, (targetEntity.money || 0) + earnings);
    targetEntity.xp += getRandomRange(1, 10);
    // ニュースログ（NPCの行動もニュースに流れる！）
    recentMarketNews = `🛠️ ${entityName}が【${jobTitle}】を実施！（結果: ${earnings >= 0 ? '+' : ''}¥${earnings.toLocaleString()}）`;
    todayaction.push(targetEntity.id)
    // プレイヤーが実行した場合のみモーダル表示
    if (isPlayer) {
        if (typeof showModal === 'function') {
            showModal(`💼 ${jobTitle}`, `${message}\n手取り: ${earnings >= 0 ? '+' : ''}¥${earnings.toLocaleString()}\n\n現在の所持金: ¥${targetEntity.money.toLocaleString()}`, [{ text: "OK", value: "ok" }]);
        }
    }
}

function simulateNpcDailyLife() {
    const poorNpcs = npcs.filter(n => (n.money || 0) < 100000); // 所持金1,000円未満の貧乏NPC

    if (poorNpcs.length > 0 && Math.random() < 0.4) { // 40%の確率で発動
        const npc = poorNpcs[Math.floor(Math.random() * poorNpcs.length)];
        const jobs = ['vending', 'tissue', 'night_shift', 'flea_market'];
        const randomJob = jobs[Math.floor(Math.random() * jobs.length)];

        // NPCにお仕事をさせる！
        workJob(randomJob, npc);
    }
}

function openJobModal() {
    const html = `
        <div style="font-size: 13px; color: #555; margin-bottom: 12px;">
            現在の所持金: <b style="font-size: 16px; color: #111;">¥${(player.money || 0).toLocaleString()}</b>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
            <button onclick="workJob('vending')" style="padding: 10px; text-align: left; cursor: pointer;">
                <b>🪙 自販機の下をチェック</b><br>
                <small style="color: #666;">報酬: ¥0 〜 ¥149 （ノーリスク）</small>
            </button>

            <button onclick="workJob('tissue')" style="padding: 10px; text-align: left; cursor: pointer;">
                <b>📄 ティッシュ配り</b><br>
                <small style="color: #666;">報酬: ¥800 〜 ¥1,099 （安定収入）</small>
            </button>

            <button onclick="workJob('night_shift')" style="padding: 10px; text-align: left; cursor: pointer;">
                <b>🏪 コンビニ深夜ワンオペ</b><br>
                <small style="color: #666;">報酬: ¥3,500 〜 ¥4,499 （高給だが過酷）</small>
            </button>

            <button onclick="workJob('flea_market')" style="padding: 10px; text-align: left; cursor: pointer;">
                <b>📦 掘り出し物の転売（せどり）</b><br>
                <small style="color: #666;">報酬: +¥1,000 〜 +¥2,999 （失敗時 -¥500）</small>
            </button>
        </div>
    `;

    if (typeof showModal === 'function') {
        showModal("💼 ちょっとしたお金稼ぎ", html, [{ text: "閉じる", value: "close" }]);
    }
}

// === 🎁 配当金支払い処理（10ターンに1回実行） ===
function processDividends() {

    // --- 1. プレイヤーへの配当金計算 ---
    let playerTotalDividend = 0;
    let playerDetailsHtml = "";

    stockmarket.forEach(stock => {
        if (stock.sharesOwned > 0) {
            const rate = stockmarket[stock.id] || 20;
            const amount = stock.sharesOwned * rate;
            playerTotalDividend += amount;
            playerDetailsHtml += `・${stock.name} (${stock.sharesOwned}株): <b style="color:#fff;">+¥${amount.toLocaleString()}</b><br>`;
        }
    });

    // プレイヤーが1株でも持っていたら通知＆口座振り込み
    if (playerTotalDividend > 0) {
        player.money = (player.money || 0) + playerTotalDividend;

        pushNotificationTray(
            `💰【株式配当】配当金振込のお知らせ`,
            `決算に伴い、保有株式の配当金が入金されました！`,
            {
                title: `🏛️ 株式決算・配当金支払い`,
                body: `本日は決算期（第${currentTurn}期）です。保有する株式の業績に応じ、以下の配当金があなたの口座へ入金されました。<br><br>` +
                    `<div style="background:#11141a; padding:10px; color:#fff; border-radius:6px; font-size:13px; line-height:1.6; border:1px solid #2d3748;">` +
                    `${playerDetailsHtml}` +
                    `<hr style="border:none; border-top:1px solid #333; margin:8px 0;">` +
                    `受取合計額: <strong style="color:#fff; font-size:16px;">¥${playerTotalDividend.toLocaleString()}</strong></div>`,
                buttons: [{ text: "口座を確認", className: "scout-btn" }]
            },
            false
        );
    }

    // --- 2. NPCたちへの配当金処理（裏で一括振り込み） ---
    const liveNpcs = npcs.filter(n => n.isAlive !== false);
    liveNpcs.forEach(npc => {
        if (!npc.portfolio) return;

        let npcTotalDividend = 0;
        stockmarket.forEach(stock => {
            const shares = npc.portfolio[stock.id] || 0;
            if (shares > 0) {
                const rate = stockmarket[stock.id] || 20;
                npcTotalDividend += shares * rate;
            }
        });

        if (npcTotalDividend > 0) {
            npc.money = (npc.money || 0) + npcTotalDividend;
        }
    });
}