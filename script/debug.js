window.debugAdvanceTime = function (days = 0, years = 0) {
    console.log(`[Before] 現在の日付: ${gameDate.toLocaleDateString()}`);

    // 年数が指定されていたら日数に換算する（1年＝365日として計算）
    const totalDaysToAdvance = days + (years * 365);
    
    // turnmove() は 1回で 3日 進む仕様なので、回数を計算
    const turnsToRun = Math.ceil(totalDaysToAdvance / 3);

    console.log(`⚡ ${turnsToRun} ターン分 turnmove() を連続実行します...`);

    // 指定ターン分 turnmove() を高速ループ実行！
    for (let i = 0; i < turnsToRun; i++) {
        // 未処理のブロック通知があれば途中で安全に止める
        const hasBlockingNotice = document.querySelectorAll(".block-notice").length > 0;
        if (hasBlockingNotice) {
            console.warn(`⚠️ 途中で未処理の重要イベント（ブロック通知）が発生したため、${i} ターン目で停止しました。`);
            break;
        }

        turnmove();
    }

    console.log(`[After] 進めた後の日付: ${gameDate.toLocaleDateString()}`);
};
// ==========================================
// 🛠️ 政治・選挙ゲーム用 デバッグ拡張キット
// ==========================================

/**
 * 1. 待機中のイベント（タイマー）を一覧表示する
 * 「次の一大イベントがいつ起きるか」を一発で確認
 */
window.debugListEvents = function () {
    if (!gameEventManager || !gameEventManager.events.length) {
        console.log("📅 待機中のイベントはありません。");
        return;
    }
    console.log("📋 --- 待機中のイベント一覧 ---");
    gameEventManager.events.forEach(e => {
        const diffTime = new Date(e.targetDate) - gameDate;
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        console.log(`🆔 ID: ${e.id} | 📅 予定日: ${new Date(e.targetDate).toLocaleDateString()} (あと ${daysLeft} 日)`);
    });
};

/**
 * 2. プレイヤーのパラメータを強制変更する
 * 資金や世論の支持率を操作して、有利・不利な状況をテスト
 * (※変数名はあなたのゲームに合わせて変更してください)
 */
window.debugSetPlayerStatus = function (paramName, value) {
    // 例: player.money や player.support などの構造に合わせる
    if (typeof player !== 'undefined' && player[paramName] !== undefined) {
        player[paramName] = value;
        console.log(`✅ プレイヤーの [${paramName}] を ${value} に変更しました。`);
        if (typeof updateStatusUI === 'function') updateStatusUI();
    } else {
        console.error(`❌ パラメータ [${paramName}] が見つかりません。`);
    }
};

/**
 * 3. 特定のNPCのパラメータを書き換える
 * 今回接戦だった「勝元 武子」などの票数や支持率をバグらせてテストする用
 */
window.debugSetNpcStatus = function (npcName, paramName, value) {
    if (typeof npcs === 'undefined') return;
    const targetNpc = npcs.find(n => n.name === npcName);
    if (targetNpc) {
        targetNpc[paramName] = value;
        console.log(`✅ NPC [${npcName}] の [${paramName}] を ${value} に変更しました。`);
    } else {
        console.error(`❌ NPC [${npcName}] が見つかりません。`);
    }
};

/**
 * 4. 指定したイベントを「今すぐ」強制発火させる
 * 日付を進めず、そのイベントの処理（コールバック）だけをテストしたい時用
 */
window.debugTriggerEventNow = function (eventId) {
    if (!gameEventManager) return;
    const index = gameEventManager.events.findIndex(e => e.id === eventId);
    if (index !== -1) {
        console.log(`🔥 イベント [${eventId}] を強制発火します...`);
        gameEventManager.events[index].callback();
        gameEventManager.events.splice(index, 1); // 実行したので削除
    } else {
        console.error(`❌ ID: [${eventId}] のイベントは見つかりませんでした。`);
    }
};


function switchControlTo(targetNpcId) {
    if (!player) return;

    // 1. 操作対象のNPCを事前に探す（見つからない場合は処理を中断）
    const newPlayerIndex = npcs.findIndex(n => n.id === targetNpcId);
    if (newPlayerIndex === -1) {
        console.warn(`❌ ID: ${targetNpcId} のNPCが見つかりませんでした。`);
        return;
    }

    const newPlayer = npcs[newPlayerIndex];

    // 2. 旧プレイヤーのステータスを変更し、NPCリストへ追加
    player.isPlayer = false;
    npcs.push(player);

    // 3. 新プレイヤーのステータスを変更し、グローバル変数に設定
    newPlayer.isPlayer = true;
    player = newPlayer;

    // 4. 新プレイヤーをNPCリストから削除（修正箇所）
    npcs.splice(newPlayerIndex, 1);

    console.log(`🎮 操作キャラクターを 【${newPlayer.name}】 に変更しました！`);
    // UIやカメラの位置などを新プレイヤーに追従・更新する関数を呼ぶ
}
