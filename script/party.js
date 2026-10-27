let parties = {
    "independents": {
        id: "independents",
        name: "無所属",
        leaderId: null,
        members: [], // どの政党にも属していないNPCのIDを入れる
        color: "#a0aec0",
        ideology: [
            50,
            50,
            50,
        ]
    }
};

// 最後尾（共通）
const commonSuffixes = ["同盟", "党", "倶楽部", "クラブ", "連盟", "の会", "戦線", "新党", "党", "党", "党", "新党", "連合", "連合", "連合"];

// 思想別の名前パーツ
const partyNameComponents = {
    right: { // 右派・保守・国家主義系
        prefixes: ["新しい", "新たな", "自由", "共に", "改革", "保守", "みんなの", "国家", "右派", "全国"],
        cores: ["改革", "同盟", "労働", "保守", "友愛", "保守", "自由", "民主", "愛国"]
    },
    center: { // 中道・ポピュリズム・自由主義系
        prefixes: ["新しい", "新たな", "改革", "中立", "共に", "みんなの", "中央", "中道", "全国"],
        cores: ["民主", "未来", "改革", "改革", "みらい", "未来", "中央"]
    },
    left: { // 左派・共産・環境主義系
        prefixes: ["革新", "社会", "社会", "社会", "民主", "民主", "民主", "自由", "あたらしい", "新たな", "共に", "真・", "労働", "民主", "革命", "左派", "みどりの", "みらいの", "進歩", "統合", "全国"],
        cores: ["労働", "共産", "社会", "環境", "平等", "生活", "民主", "平和", "共和", "自由",
            "労働", "労働者", "団結", "進歩", "統合", "民主", "民主", "社会", "社会", "農工", "農民", "自由"
        ]
    }
};

// 1日に1回呼び出されるメイン関数
function dailyPartyCreationCheck() {
    if (iselection) return;

    const activePartyCount = Object.keys(parties).length - 1;

    // --- 🚨 【ケースA】政党が0個の時は「右派」「左派」をそれぞれ確定で作成 ---
    // ※初期の政党は除外（対象外）とのことなので、元の条件をそのまま維持しています
    if (activePartyCount === 0) {
        const qualifiedNpcs = npcs.filter(npc => {
            if (npc.partyId !== null) return false;
            const xp = npc.xp || 0;
            const isSeat = npc.rep || npc.sen || false;
            const isPres = (typeof president !== 'undefined' && president) ? (president.id === npc.id) : false;
            return isSeat || isPres || xp >= 100;
        });

        const rightWingNpcs = [];
        const leftWingNpcs = [];

        qualifiedNpcs.forEach(npc => {
            if (npc.ideology && npc.ideology[1] > 65) {
                rightWingNpcs.push(npc);
            } else if (npc.ideology && (npc.ideology[0] < 35 || npc.ideology[2] > 65)) {
                leftWingNpcs.push(npc);
            }
        });

        if (rightWingNpcs.length >= 3) {
            createInitialParty("right", rightWingNpcs);
        }
        if (leftWingNpcs.length >= 3) {
            createInitialParty("left", leftWingNpcs);
        }

        return;
    }

    // --- 🚨 【ケースB】通常時の確率判定 ---
    let creationChance = 0.01;

    const unalignedNpcs = npcs.filter(npc => npc.partyId === null);
    creationChance += activePartyCount * 0.005 + (unalignedNpcs.length * 0.001);
    if (creationChance > 0.05) creationChance = 0.05;


    if (Math.random() > creationChance) return;

    // 結成可能なNPCを抽出
    const qualifiedUnalignedNpcs = npcs.filter(npc => {
        if (npc.partyId !== null) return false;

        const isSeat = npc.rep || npc.sen || false;
        const isPres = (typeof president !== 'undefined' && president) ? (president.id === npc.id) : false;

        // 【修正点】twopartyがtrueの場合、現職議員・大統領は絶対に新党を作れない（参加できない）
        if (typeof twoparty !== 'undefined' && twoparty) {
            if (isSeat || isPres) return false;
        }

        const xp = npc.xp || 0;
        // twoparty下ではisSeat/isPresが上のif文で弾かれるため、実質「xp >= 100の一般NPC」のみが通過します
        return isSeat || isPres || xp >= 100;
    });

    const groups = { right: [], left: [], center: [] };

    qualifiedUnalignedNpcs.forEach(npc => {
        let side = "center";
        if (npc.ideology && npc.ideology[1] > 65) side = "right";
        else if (npc.ideology && (npc.ideology[0] < 35 || npc.ideology[2] > 65)) side = "left";

        groups[side].push(npc);
    });

    const MIN_FOUNDERS = 3;
    const validSides = Object.keys(groups).filter(side => groups[side].length >= MIN_FOUNDERS);

    if (validSides.length === 0) return;

    const chosenSide = validSides[Math.floor(Math.random() * validSides.length)];
    const availableNpcs = groups[chosenSide];

    // まとめた共通関数を呼び出し！
    createInitialParty(chosenSide, availableNpcs);
}


function createInitialParty(chosenSide, availableNpcs) {
    // --- 1. ソート処理（現職 ➔ XP ➔ 所持金） ---
    availableNpcs.sort((a, b) => {
        const aSeat = a.rep || a.sen || false;
        const bSeat = b.rep || b.sen || false;
        if (aSeat !== bSeat) return (bSeat ? 1 : 0) - (aSeat ? 1 : 0);
        if ((a.xp || 0) !== (b.xp || 0)) return (b.xp || 0) - (a.xp || 0);
        return (b.money || 0) - (a.money || 0);
    });

    const leader = availableNpcs[0];

    // --- 🚨 条件チェック（現職・大統領以外で、XP100未満なら党首になれない） ---
    let isPres = (typeof president !== 'undefined' && president) ? (president.id === leader.id) : false;
    let isSeat = leader.rep || leader.sen || false;
    if (!isSeat && !isPres) return null;

    const isSyoha = (leader.xp || 0) < 100;

    const memberCount = Math.floor(Math.random() * 3) + 2; // 2〜4名
    const founders = availableNpcs.slice(0, Math.min(memberCount, availableNpcs.length));

    // --- 2. 党名＆政党IDの生成 ---
    const partyName = generateDynamicPartyName(chosenSide);
    const partyId = `party_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    founders.forEach(member => {
        member.partyId = partyId;
    });

    const randomColor = getRandomColorForParty(partyName);

    // --- 3. 👥 元の人間関係をベースに、リアルに絆を動かす ---
    for (let i = 0; i < founders.length; i++) {
        for (let j = i + 1; j < founders.length; j++) {
            const id1 = founders[i].id;
            const id2 = founders[j].id;
            const currentScore = getRelation(id1, id2);
            let bonusAmount = 0;

            if (currentScore >= 0) {
                bonusAmount = 25;
            } else {
                bonusAmount = Math.abs(currentScore) * 0.5;
            }
            changeRelation(id1, id2, bonusAmount);
        }
    }

    // --- 4. 政治資本（XP）消費と新政党作成 ---
    leader.xp = Math.max(0, (leader.xp || 0) - 100);
    createNewParty(partyId, partyName, leader, randomColor, founders, isSyoha);

    // ==========================================
    // 📱 iPhone風通知トレイ ＆ 詳細モーダル連動
    // ==========================================

    let sideBadge = "⚖️ 中道主義";
    let sideColor = "#4a5568";
    let trayIcon = "💬";

    if (chosenSide === "right") {
        sideBadge = "🦅 右派・愛国";
        sideColor = "#9b2c2c";
        trayIcon = "🚨";
    } else if (chosenSide === "left") {
        sideBadge = "🚩 左派・革新";
        sideColor = "#2b6cb0";
        trayIcon = "📢";
    }

    let membersListHTML = "";
    founders.forEach(m => {
        const isLeader = m.id === leader.id;
        const seatBadge = (m.rep || m.sen) ? `<span style="background:#e53e3e; color:#fff; font-size:10px; padding:1px 4px; border-radius:3px; margin-left:4px;">現職</span>` : '';
        const xpText = `<span style="color:#cbd5e0; font-size:11px;">(XP: ${m.xp || 0})</span>`;

        membersListHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#1a202c; padding:8px 12px; border-radius:6px; margin-bottom:6px; border:1px solid #4a5568;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <img src="${m.icon || 'https://via.placeholder.com/32'}" width="32px" height="32px" style="border-radius:50%; border:1px solid #718096; background:#2d3748;">
                    <div>
                        <span style="font-weight:bold; font-size:13px; color:#fff;">
                            ${isLeader ? '👑 [党首] ' : '👤 '} ${m.name} ${seatBadge} ${xpText}
                        </span>
                        <div style="font-size:11px; color:#a0aec0;">📍 ${m.pref || ''} ${m.city || ''}</div>
                    </div>
                </div>
                <div style="font-size:12px; color:#ecc94b; font-weight:bold;">
                    ${Math.floor(m.money || 0).toLocaleString()}円
                </div>
            </div>
        `;
    });

    const modalTitleText = `🏛️ 新党結成`;
    const modalBodyHTML = `
        <div style="background:${sideColor}; padding:12px; border-radius:8px; margin-bottom:12px; text-align:center; box-shadow:inset 0 1px 0 rgba(255,255,255,0.2);">
            <span style="font-size:11px; font-weight:bold; background:rgba(0,0,0,0.4); padding:2px 6px; border-radius:4px; color:#fff;">${sideBadge}</span>
            <h3 style="font-size:20px; font-weight:bold; margin:6px 0 0 0; color:#fff; letter-spacing:1px;">
                「${partyName}」
            </h3>
        </div>
        
        <p style="font-size:13px; line-height:1.5; margin-bottom:12px;">
            ${leader.name}らが中心となり、
            新党「${partyName}」の立ち上げを正式発表しました！
        </p>

        <span style="color:#63b3ed; display:block; font-weight:bold; margin-bottom:6px; font-size:13px;">👥 発起人メンバー (${founders.length}名)</span>
        <div style="max-height:180px; overflow-y:auto; padding-right:2px;">
            ${membersListHTML}
        </div>
    `;

    pushNotificationTray(
        `${partyName}結成！`,
        `${leader.name}らが新党を設立。タップして確認`,
        {
            title: modalTitleText,
            body: modalBodyHTML,
            buttons: [
                {
                    text: "OK",
                    className: "scout-btn"
                }
            ]
        },
        false
    );

    return partyId;
}

function createNewParty(partyId, partyName, leaderNpc, color, syoha2 = false) {
    // 1. 党首になるNPCの所属を、無所属から新しい政党IDに書き換える！
    leaderNpc.partyId = partyId;

    // 2. 新しい政党インスタンスを作って、政党データベースに登録
    let newParty = new Party(
        partyId,
        partyName,
        leaderNpc.id,
        color,
        leaderNpc.ideology[0] || 50, // econ
        leaderNpc.ideology[1] || 50, // nation
        leaderNpc.ideology[2] || 50  // diplo
    );

    // 🌟【追加】党首選の予定年を計算して政党データに埋め込む（例: 3年後）
    const currentYear = gameDate.getFullYear();
    const nextLeadershipElectionYear = currentYear + 4; // 3年ごとに党首選を行う場合

    newParty.nextElectionYear = nextLeadershipElectionYear; // 次回党首選の年
    newParty.termLength = 4; // 任期（年）

    parties[partyId] = newParty;

    parties[partyId].syoha = syoha2;

    // 3. 結成履歴の記録（addhis関数がある場合）
    if (typeof addhis === "function") {
        addhis(leaderNpc, `新党「${partyName}」を結成し、初代党首に就任。`);
    }

    // 4. 所属が変わったので、無所属リストと平均思想を最新状態に更新する
    CheckIndependent();

    console.log(`✅ 新党【${partyName}】が結成されました！ 党首: ${leaderNpc.name}（次回党首選: ${nextLeadershipElectionYear}年）`);
}
// 思想に合わせてランダムな名前を組み立てる関数
function generateDynamicPartyName(side) {
    const list = partyNameComponents[side];

    // 安全対策：データがない場合は即座に返す
    if (!list) return "無所属";

    let p, c, s;
    let attempts = 0;
    const maxAttempts = 100; // 無限ループを防ぐ安全弁

    while (attempts < maxAttempts) {
        attempts++;

        // 1. ランダムにパーツを抽選
        // ★【追加】50%の確率で接頭語(prefix)を「なし(空文字)」にする
        if (Math.random() < 0.5) {
            p = "";
        } else {
            p = list.prefixes[Math.floor(Math.random() * list.prefixes.length)];
        }

        c = list.cores[Math.floor(Math.random() * list.cores.length)];
        s = commonSuffixes[Math.floor(Math.random() * commonSuffixes.length)];

        // 2. 被りチェック（3つの単語を合体させて、文字の重複を調べる）
        const combined = p + c + s;
        const uniqueChars = new Set(combined);

        // 合計文字数と、重複を除いた文字数が一致 =「文字の被りが一切ない」
        if (combined.length === uniqueChars.size) {
            return combined; // 即採用！
        }

        // かぶったら自動で次のループ（即やり直し）
    }

    // 万が一、100回やっても被りしかなかった場合のフォールバック（強制結合）
    return `${p}${c}${s}`;
}

// （おまけ）思想に応じたなんとなくのイメージカラーを返す
function getRandomColorForParty(partyIdOrName) {
    // 文字列から固定のハッシュ値を計算
    let hash = 0;
    const str = String(partyIdOrName);
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    // 0〜359の範囲の色相（Hue）に変換
    const h = Math.abs(hash) % 360;

    // 視認性の良い鮮やかな色を返す
    return `hsl(${h}, 70%, 50%)`;
}

function getPartyColor(id) {
    return parties[id]?.color || "#333";
}

function getPartyName(id) {
    return parties[id]?.name || "無所属";
}


// 政党を作る時のクラス、または関数
class Party {
    constructor(id, name, leaderId, color, econ, nation, diplo) {
        this.id = id;             // 党のID（'party_01' とか）
        this.name = name;         // ランダム生成された党名
        this.leaderId = leaderId; // 党首のNPC ID
        this.members = [leaderId];// 所属NPCのIDリスト（最初は党首のみ）
        this.color = color;       // グラフやマップで使うイメージカラー
        this.ideology = [
            econ, nation, diplo
        ]
    }
}

function CheckIndependent() {
    // 1. 無所属のメンバーリストを一旦完全にリセットする（重複・消え残り防止）
    parties.independents.members = [];

    // イデオロギーの平均を出すための集計用変数
    let totalEcon = 0;
    let totalNation = 0;
    let totalDiplo = 0;
    let independentCount = 0;

    // 2. 全NPCをチェックして、今も無所属の子だけをあぶり出す
    npcs.forEach(npc => {
        if (npc.partyId === null) {
            // 無所属リストに追加
            parties.independents.members.push(npc.id);

            // 思想を足し合わせる（あとで平均を出すため）
            totalEcon += npc.ideology[0];
            totalNation += npc.ideology[1];
            totalDiplo += npc.ideology[2];
            independentCount++;
        }
    });

    // 3. 無所属全体の平均思想を計算して更新（メンバーが1人以上いる場合）
    if (independentCount > 0) {
        parties.independents.ideology = [
            Math.round(totalEcon / independentCount),
            Math.round(totalNation / independentCount),
            Math.round(totalDiplo / independentCount)
        ];
    } else {
        // 万が一、全員どかの政党に入って無所属が0人になった場合
        parties.independents.ideology = [50, 50, 50];
    }

}

function dailyNpcUpdate() {

    // 💡 共通の高速参照用Mapを最初に1回だけ作成（全体の検索速度が100倍になる）
    const npcMap = new Map();
    if (typeof player !== "undefined" && player && player.id) {
        npcMap.set(player.id, player);
    }
    for (let i = 0; i < npcs.length; i++) {
        if (npcs[i] && npcs[i].id) {
            npcMap.set(npcs[i].id, npcs[i]);
        }
    }

    // --- 1. 思想の変動（たまに大激変する） ---
    npcs.forEach(cand => {
        // 現職議員（rep/sen）は基本思想が固まっているので、変動確率を1%に下げる
        const isIncumbent = cand.rep || cand.sen;
        const changeChance = isIncumbent ? 0.01 : 0.015; // 現職は1%、新人等は5%

        if (Math.random() > changeChance) return;

        let changeRange = 1; // 通常は微変動（±1）

        // 大激変の確率を 0.5% に下げ、変動幅も ±8 程度に抑える
        if (Math.random() < 0.005) {
            changeRange = 8; // 大激変（±15は党破壊ビームすぎるので±8に緩和）
        }

        cand.oldIdeology = Array.isArray(cand.ideology) ? [...cand.ideology] : [50, 50, 50];

        // 各軸の更新（安全策として数値チェックを追加）
        cand.ideology[0] = Math.max(1, Math.min(100, (cand.ideology[0] ?? 50) + getRandomRange(-changeRange, changeRange)));
        cand.ideology[1] = Math.max(1, Math.min(100, (cand.ideology[1] ?? 50) + getRandomRange(-changeRange, changeRange)));
        cand.ideology[2] = Math.max(1, Math.min(100, (cand.ideology[2] ?? 50) + getRandomRange(-changeRange, changeRange)));
    });

    // --- 1.5 クーデターの発生チェック ---
    if (Math.random() < 0.05 && typeof parties === "object" && parties !== null) {
        const coupCandidatePartyIds = Object.keys(parties).filter(id => id !== "null" && id !== "undefined" && parties[id].name !== "無所属");

        if (coupCandidatePartyIds.length > 0) {
            const randomPartyId = coupCandidatePartyIds[Math.floor(Math.random() * coupCandidatePartyIds.length)];
            const targetParty = parties[randomPartyId];

            // Mapから一瞬で党首を取得
            const currentLeader = targetParty ? npcMap.get(targetParty.leaderId) : null;

            if (targetParty && currentLeader) {
                // 党員を高速抽出
                const partyMembers = npcs.filter(n => n.partyId === randomPartyId && n.isAlive !== false);
                if (typeof player !== "undefined" && player.partyId === randomPartyId) {
                    partyMembers.push(player);
                }

                if (partyMembers.length >= 10) {
                    // 不満分子の抽出（Map参照で高速化）
                    const potentialPlotters = partyMembers.filter(member => {
                        if (member.id === currentLeader.id) return false;
                        if (typeof player !== 'undefined' && member.id === player.id) return false;

                        const relWithLeader = typeof getRelation === "function" ? getRelation(member, currentLeader) : (member.relations?.[currentLeader.id] || 50);
                        return relWithLeader < 45;
                    });

                    if (potentialPlotters.length > 0) {
                        // 💡 ソートの重さを防ぐため、スコアをあらかじめ計算（前処理）
                        const plottersWithScore = potentialPlotters.map(member => {
                            const rel = typeof getRelation === "function" ? getRelation(member, currentLeader) : (member.relations?.[currentLeader.id] || 50);
                            const xp = member.xp || 0;
                            const rand = Math.floor(Math.random() * 40);
                            const score = (50 - rel) + (xp * 0.5) + rand;
                            return { member, score };
                        });

                        // スコア順に並び替え
                        plottersWithScore.sort((a, b) => b.score - a.score);

                        const chosenPlotter = plottersWithScore[0].member;
                        if (typeof launchPartyCoup === "function") {
                            launchPartyCoup(randomPartyId, chosenPlotter);
                        }
                    }
                }
            }
        }
    }
    // ==========================================
    // 【事前準備：高速化の肝】
    // 1回のフルスキャンで、政党ごとの所属メンバー、および無所属メンバーのリストを完全に分類する
    // ==========================================
    const partyMembersMap = new Map(); // 各政党の所属NPCリスト
    const unaffiliated = [];           // 無所属のNPCリスト

    for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        if (!npc) continue;

        // 生存かつNPCであるかをチェック（入党チェック用の条件もここで一括回収）
        if (npc.isNPC && npc.isAlive !== false) {
            const pId = String(npc.partyId);

            if (!npc.partyId || pId === "null" || pId === "undefined" || pId === "無所属") {
                unaffiliated.push(npc);
            } else {
                if (!partyMembersMap.has(pId)) {
                    partyMembersMap.set(pId, []);
                }
                partyMembersMap.get(pId).push(npc);
            }
        }
    }

    // 有効な政党リストをループ外で1回だけ作成
    const validParties = Object.values(parties).filter(p => p && p.id !== "無所属" && p.id !== "independents");


    // --- 2. 同じ政党内の人間関係の変動（超・軽量化版） ---
    // 💡 配列のfilterを完全排除！MapからO(1)で直接メンバーを取り出す
    partyMembersMap.forEach((members, partyId) => {
        if (members.length < 2) return;

        // メンバー数に応じて数ペアだけ人間関係を動かす
        const sampleCount = Math.min(5, members.length);
        for (let k = 0; k < sampleCount; k++) {
            const idxA = Math.floor(Math.random() * members.length);
            let idxB = Math.floor(Math.random() * members.length);
            if (idxA === idxB) continue;

            const fuyahoChange = (Math.random() < 0.10) ? getRandomRange(-5, -1) : getRandomRange(1, 3);
            changeRelation(members[idxA].id, members[idxB].id, fuyahoChange);
        }
    });


    // --- 3. 脱退・除名チェック ---
    // 💡 全体ループではなく、すでに政党に所属しているメンバーだけを対象にループするため無駄がゼロ
    partyMembersMap.forEach((members) => {
        for (let i = 0; i < members.length; i++) {
            const cand = members[i];

            // 議員なら低確率でしか脱退しないガード
            if (Math.random() > 0.05 && (cand.rep || cand.sen)) continue;

            const party = parties[cand.partyId];
            if (!party) continue;

            // Mapから一瞬で党首を取得
            const leader = npcMap.get(party.leaderId);
            if (!leader || cand.id === leader.id) continue;

            // 思想の一致度計算
            const diff = Math.abs(cand.ideology[0] - leader.ideology[0]) +
                Math.abs(cand.ideology[1] - leader.ideology[1]) +
                Math.abs(cand.ideology[2] - leader.ideology[2]);
            const matchPercent = Math.max(0, Math.floor(100 - (diff / 3)));

            const relationWithLeader = getRelation(cand.id, leader.id);

            if ((matchPercent < 45 || relationWithLeader < -40) && Math.random() < 0.05) {
                if (relationWithLeader < -40) {
                    if (Math.random() < 0.5) {
                        console.log(`🚶 自主脱退: 【${cand.name}】は党首との不仲により、[${party.name}] を飛び出しました。`);
                        addhis(cand, `${leader.name}との対立により、${party.name}を離党。`);
                    } else {
                        console.log(`⚡ 除名処分: 【${cand.name}】は党首の逆鱗に触れ、[${party.name}] から除名されました！`);
                        addhis(cand, `${leader.name}によって${party.name}から除名。`);
                    }
                } else {
                    console.log(`❌ 離党: 【${cand.name}】は党首との思想のズレ（一致度:${matchPercent}%）に耐えかねず、[${party.name}] を離党しました。`);
                    addhis(cand, `${party.name}を离党。`);
                }
                changeRelation(cand.id, leader.id, -20);
                cand.partyId = null;
            }
        }
    });


    // 最初は通常通り10%の確率でイベントを発生させる（負荷軽減のため）
    if (Math.random() <= 0.10 && validParties.length && unaffiliated.length) {
        // 事前に作っておいた「無所属配列」からランダムに1人ピックアップ（filterがないので一瞬！）
        const cand = unaffiliated[Math.floor(Math.random() * unaffiliated.length)];

        // independentsを除外したリストからランダムに政党を選ぶ
        const party = validParties[Math.floor(Math.random() * validParties.length)];

        // 【追加】選んだ政党が諸派（party.syoha）の場合、さらに確率を落とす（例: 20%しか通過させない＝実質2%に）
        if (party.syoha && Math.random() > 0.20) {
            return; // 諸派なら80%の確率でここで弾く
        }

        const leader = party.leaderId ? npcMap.get(party.leaderId) : null;

        // 1. 思想適合度（党の思想 vs NPCの思想）
        const cIde = cand.ideology;
        const pIde = Array.isArray(party.ideology) ? party.ideology : (leader?.ideology || [50, 50, 50]);
        const diff = Math.abs(cIde[0] - pIde[0]) + Math.abs(cIde[1] - pIde[1]) + Math.abs(cIde[2] - pIde[2]);
        const matchPercent = Math.max(0, 100 - Math.floor(diff / 3));

        // 2. XP（プライド・地位）に応じた「必要適合度」の設定
        const candXp = cand.xp || 0;
        let requiredMatch = 50;
        if (candXp > 300) requiredMatch = 80;
        else if (candXp > 100) requiredMatch = 65;

        // 3. 与党/最大野党ボーナス
        if (party.isRuling || party.isMainOpposition) {
            requiredMatch -= 15;
        }

        // 4. 入党判定
        const relation = leader ? getRelation(cand.id, leader.id) : 0;

        if (matchPercent >= requiredMatch && relation >= -10) {
            if (cand.isIntentDeclared === true) return;
            cand.partyId = party.id;
            addhis(cand, `${party.name}に入党。`);
            console.log(`🤝 [活性化入党]: 【${cand.name}(XP:${candXp})】が [${party.name}] に入党（一致度:${matchPercent}% / 必要:${requiredMatch}%）`);

            if (leader) changeRelation(cand.id, leader.id, 10);
        }
    }



    // =================================================================
    // 📉 【乱立阻止・一斉チェック版】政党の自然解散（党員減少による破綻）
    // =================================================================
    Object.keys(parties).forEach(checkPartyId => {
        if (checkPartyId === "null" || checkPartyId === "undefined") return;

        const targetParty = parties[checkPartyId];
        if (!targetParty || targetParty.name === "無所属") return;

        const memberCount = npcs.filter(n => n.partyId === checkPartyId && n.isAlive !== false).length
            + (typeof player !== "undefined" && player.partyId === checkPartyId ? 1 : 0);

        if (memberCount <= 2 && !targetParty.syoha) {
            const isPlayerParty = (typeof player !== "undefined" && player.partyId === checkPartyId);
            const partleader = npcMap.get(targetParty.leaderId)?.name || "代表";

            if (isPlayerParty) {
                if (typeof pushNotificationTray === "function") {
                    pushNotificationTray(
                        `${targetParty.name}は解散した。`,
                        `${targetParty.name}は解散した。`,
                        {
                            title: `${targetParty.name}の終わり`,
                            body: `本日、${partleader}代表は記者会見を開き、党員不足のため党を解散すると宣言した。`,
                            buttons: [{ text: "OK", className: "scout-btn" }]
                        },
                        true
                    );
                } else {
                    alert(`🚨 【${targetParty.name}】は党員減少により解散しました！`);
                }
                player.partyId = null;
            } else {
                const partleader = npcMap.get(targetParty.leaderId)?.name || "代表";

                console.log(`🪦 [政党解散]: 【${targetParty.name}】は党員が ${memberCount} 人に減少したため、自然消滅しました。`);
                pushNotificationTray(
                    `${targetParty.name}は解散した。`,
                    `${targetParty.name}は解散した。`,
                    {
                        title: `${targetParty.name}の終わり`,
                        body: `本日、${partleader}代表は記者会見を開き、党員不足のため党を解散すると宣言した。`,
                        buttons: [{ text: "OK", className: "scout-btn" }]
                    },
                    false
                );
            }

            // 元党員の所属クリア
            npcs.forEach(n => {
                if (n.partyId === checkPartyId) {
                    n.partyId = null;
                    addhis(n, `${targetParty.name}が解散したため、無所属となる。`);
                }
            });
            if (typeof player !== "undefined" && player.partyId === checkPartyId) {
                player.partyId = null;
            }
            disparties.push(checkPartyId);
            delete parties[checkPartyId];
        }
    });


    // --- 5. 名簿と平均思想を最新状態に上書き更新 ---
    if (typeof CheckIndependent === "function") {
        CheckIndependent();
    }
}

let disparties = [];

// ⚡ 党内造反劇（加藤の乱スタイル）を実行・処理するコア関数
function launchPartyCoup(targetPartyId, plotterNpc) {
    const targetParty = parties[targetPartyId];
    if (!targetParty) return;

    const currentLeader = [player, ...npcs].find(n => n.id === targetParty.leaderId);
    if (!currentLeader) return;

    // 1. その政党に所属しているアクティブな議員（プレイヤー含む）を抽出
    const partyMembers = [player, ...npcs].filter(n => n.partyId === targetPartyId && n.isAlive !== false);

    // 🚨 条件チェック：最低10人以上
    if (partyMembers.length < 10) {
        return false;
    }

    // 2. 多数派工作（非主流派への根回し）
    const coPlotters = [];
    partyMembers.forEach(member => {
        if (member.id === plotterNpc.id || member.id === currentLeader.id) return;

        const relationWithPlotter = typeof getRelation === "function" ? getRelation(member, plotterNpc) : (member.relations?.[plotterNpc.id] || 50);
        const relationWithLeader = typeof getRelation === "function" ? getRelation(member, currentLeader) : (member.relations?.[currentLeader.id] || 50);

        // 協力条件：主流派への不満が溜まっている議員
        if (relationWithPlotter >= 50 && relationWithLeader < 40) {
            coPlotters.push(member);
        }
    });

    const totalRebelsCount = coPlotters.length + 1;

    // 🚨 条件：造反に同意した議員が最低10人集まらなければ、切り崩されて不発に終わる
    if (totalRebelsCount < 10) {
        return false;
    }

    // 3. 採決・成否判定（過半数の支持、または切り崩し工作の成否確率）
    const halfMembers = Math.ceil(partyMembers.length * 0.5);
    const winProbability = totalRebelsCount >= halfMembers ? 1.0 : (totalRebelsCount / partyMembers.length) * 0.7;
    const isSuccess = Math.random() < winProbability;

    // 4. 【政変の結果】
    if (isSuccess) {
        // 👑 クーデター成功：臨時両院議員総会での代表交代
        targetParty.leaderId = plotterNpc.id;
        currentLeader.partyId = null; // 前代表は無念の離党（非主流派へ失脚）

        addhis(currentLeader, `【失脚】非主流派の造反による不信任を受け、${targetParty.name}代表を辞任、離党へ。`);
        addhis(plotterNpc, `党内政変を主導。現体制の不信任を取り付け、${targetParty.name}の新しい党首に就任！`);

        coPlotters.forEach(ally => {
            if (!ally.relations) ally.relations = {};
            ally.relations[plotterNpc.id] = 100; // 連帯感MAXの「盟友」へ
            addhis(ally, `党内政変に賛同。新体制となった${plotterNpc.name}執行部の中枢へ就任。`);
        });

        // 📢 政界ニュースの配信
        if (typeof pushNotificationTray === "function") {
            pushNotificationTray(
                `⚡【政変】${targetParty.name}で代表交代劇！`,
                `⚡【政変】${targetParty.name}で代表交代劇！`,
                {
                    title: `🏛️ 反主流派による造反劇が結実`,
                    body: `本日、${targetParty.name}内で大規模な政変が発生。${plotterNpc.name}氏率いる造反組 ${totalRebelsCount} 名が現体制への不信任を突き付け、${currentLeader.name}代表は電撃辞任を表明。${plotterNpc.name}氏が新代表に選出されました。`,
                    buttons: [{ text: "政治ニュースを確認", className: "scout-btn" }]
                },
                false
            );
        } else {
            alert(`🏛️ 【政界速報】${targetParty.name}の代表 ${currentLeader.name} 氏が、党内造反により失脚！新代表に ${plotterNpc.name} 氏が就任しました！`);
        }
    } else {
        // 🚨 クーデター失敗：加藤の乱のように切り崩され、不信任は否決
        addhis(plotterNpc, `${targetParty.name}内での代表解任工作（造反）を企てるも、主流派の切り崩しに遭い失敗。`);
        if (!currentLeader.relations) currentLeader.relations = {};
        currentLeader.relations[plotterNpc.id] = -100; // 確執が決定的に

        const traitors = [plotterNpc, ...coPlotters];
        traitors.forEach(traitor => {
            traitor.partyId = null; // 党内規律違反による「除名処分」
            if (!traitor.relations) traitor.relations = {};
            traitor.relations[currentLeader.id] = -100;
            addhis(traitor, `党首解任の不信任工作が失敗。規律違反として${targetParty.name}から【除名処分】を受ける。`);
        });

        // 📢 ニュース通知
        if (typeof pushNotificationTray === "function") {
            pushNotificationTray(
                `🚨【造反失敗】${targetParty.name}の造反劇は沈静化`,
                `🚨【造反失敗】${targetParty.name}の造反劇は沈静化`,
                {
                    title: `⚔️ 執行部による切り崩し工作`,
                    body: `本日、${targetParty.name}内で ${plotterNpc.name} 氏らが企てた不信任工作は、執行部の猛烈な切り崩しにより瓦解。本会議での造反は否決され、関与した ${traitors.length} 名の議員は党規委員会により【永久除名処分】となりました。`,
                    buttons: [{ text: "OK", className: "close-btn" }]
                },
                false
            );
        } else {
            alert(`🚨 【政界ニュース】${targetParty.name}内での造反劇は、主流派に抑え込まれ失敗。現代表 ${currentLeader.name} 氏により、反乱議員 ${traitors.length} 名が全員除名されました！`);
        }
    }

    if (typeof updateStatusUI === "function") updateStatusUI();
    return true;
}



function tryJoinParty(character, partyId, isSilent = false) {
    const party = parties[partyId];
    if (!party) return false;

    // 現在その政党に所属しているメンバーたち
    const members = npcs.filter(npc => npc.partyId === partyId);

    // もしプレイヤーもすでにその党にいるなら、計算に含めるために追加
    if (typeof player !== "undefined" && player.partyId === partyId && !members.some(m => m.id === player.id)) {
        members.push(player);
    }

    // --- 🧠 思想平均の計算（共通ロジック） ---
    let avgEcon = 0, avgNation = 0, avgForeign = 0;
    if (members.length > 0) {
        avgEcon = Math.floor(members.reduce((sum, m) => sum + m.ideology[0], 0) / members.length);
        avgNation = Math.floor(members.reduce((sum, m) => sum + m.ideology[1], 0) / members.length);
        avgForeign = Math.floor(members.reduce((sum, m) => sum + m.ideology[2], 0) / members.length);
    } else {
        // メンバーが誰もいない（万が一のフォールバック）は党首の思想を基準にする
        const leader = npcs.find(m => m.id === party.leaderId) || party.leader;
        if (leader) {
            [avgEcon, avgNation, avgForeign] = leader.ideology;
        }
    }

    const diff = Math.abs(character.ideology[0] - avgEcon) +
        Math.abs(character.ideology[1] - avgNation) +
        Math.abs(character.ideology[2] - avgForeign);

    // 画面の表示と同じ計算式で「一致度（%）」を出す（0〜100）
    const matchPercent = Math.max(0, Math.floor(100 - (diff / 3)));

    // 🌟【ここがポイント！】党首との友好度を引っ張ってくる
    // （プレイヤーが申請する場合は、相手の党首との友好度を見る）
    const leaderId = party.leaderId;
    const relationScore = getRelation(character.id, leaderId);

    // 🎲 【新しい審査ロジック】
    // 「思想の一致度」に「友好度の半分」をボーナスとして足して、合計が50を超えていれば合格！
    // 例：思想一致度が40%しかなくても、党首との友好度が+30あれば、40 + 15 = 55 で合格できる！
    const totalPassScore = matchPercent + (relationScore * 0.5);

    if (totalPassScore < 50) {
        if (!isSilent) {
            alert(`❌ 入党拒否！\n【${party.name}】\n(思想が合わないか、党首との関係が冷え切っています)`);
        }
        return false; // 審査落ち
    }

    // --- 🤝 審査合格！以前の党の脱退と、新しい党への加入処理 ---
    // 以前所属していた党の members 配列から自分を消去
    if (character.partyId && parties[character.partyId]) {
        parties[character.partyId].members = parties[character.partyId].members.filter(id => id !== character.id);
    }

    // 新しい所属を書き換え
    character.partyId = partyId;

    // 政党側の配列に自分のIDを追記（重複ガード付き）
    if (!party.members.includes(character.id)) {
        party.members.push(character.id);
    }

    if (!isSilent) {
        alert(`🎉 入党許可！\n【${party.name}】`);
    }
    CheckIndependent();
    return true; // 加入成功
}

function showPartyDetailModal(partyId) {
    const party = parties[partyId];
    if (!party) return;

    const members = [player, ...npcs].filter(m => m.partyId === partyId);
    const leader = members.find(m => m.id === party.leaderId) || party.leader || { name: "不詳" };

    // 思想平均の再計算
    let avgEcon = 0, avgNation = 0, avgForeign = 0;
    if (members.length > 0) {
        avgEcon = Math.floor(members.reduce((sum, m) => sum + m.ideology[0], 0) / members.length);
        avgNation = Math.floor(members.reduce((sum, m) => sum + m.ideology[1], 0) / members.length);
        avgForeign = Math.floor(members.reduce((sum, m) => sum + m.ideology[2], 0) / members.length);
    }

    // 👥 所属議員を箇条書きで綺麗に展開（何人増えてもスクロール枠に閉じ込める）
    let memberListHTML = `
        <div style="background: #1a202c; padding: 8px; border-radius: 4px; margin-top: 10px;">
            <strong style="color: #ecc94b; font-size: 13px;">👥 所属議員一覧 (${members.length}名):</strong>
            <div style="max-height: 120px; overflow-y: auto; margin-top: 6px; padding-right: 5px;">
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #ffffff; line-height: 1.5;">
    `;

    members.forEach(m => {
        const isLeader = (m.id === party.leaderId);
        memberListHTML += `
            <li style="margin-bottom: 2px;">
                ${isLeader ? '👑 <span style="color:#ecc94b; font-weight:bold;">[党首] </span>' : '👤 '} ${m.name} 
                <span style="font-size:11px; color:#a0aec0;">(拠点: ${m.city} / 資金: ${Math.floor(m.money).toLocaleString()}円)</span>
            </li>
        `;
    });
    memberListHTML += `</ul></div></div>`;
    let ide = [
        avgEcon,
        avgNation,
        avgForeign
    ]
    let ideomna = getIdeologyName(ide)
    // 詳細モーダルのレイアウト
    const detailHTML = `
        <div style="border-left: 6px solid ${party.color || '#4a5568'}; padding-left: 10px; margin-bottom: 12px;">
            <div style="font-size: 20px; font-weight: bold; color: #ffae00;">🏛️ ${party.name}</div>
        </div>

        <div style="font-size: 14px; color: #ff9900; line-height: 1.6;">
            <div>👑 <strong>現党首:</strong> ${leader.name}</div>
            
            <div style="margin-top: 8px; background: #2d3748; padding: 8px; border-radius: 4px;">
                <span style="color: #63b3ed; display: block; font-weight: bold; margin-bottom: 4px;">📊 党の平均政治思想</span>
                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                    <span style="color: #fc8181;">経済統制: ${avgEcon}</span>
                    <span style="color: #63b3ed;">国家主義: ${avgNation}</span>
                    <span style="color: #ecc94b;">国際協調: ${avgForeign}</span>
                </div>
                                <h2 style="color: #fff">${ideomna}</h2>

            </div>

            ${memberListHTML}
        </div>
    `;

    // 操作用の下部ボタンを用意
    const buttons = [];

    // もしプレイヤーがすでにこの政党に入っている場合はボタンを「所属中」にするか非表示にする
    const isAlreadyMember = (typeof player !== "undefined" && player.partyId === partyId);

    if (isAlreadyMember) {
        // 🌟【修正】所属中なら「離党する」ボタンを表示！
        buttons.push({
            text: "⚠️ この政党を離党する",
            className: "delete-btn", // 赤または危険系ボタンのクラス（なければ close-btn 等）
            keepOpen: true,
            callback: () => {
                const targetParty = typeof parties !== 'undefined' ? parties[partyId] : null;
                const partyName = targetParty ? targetParty.name : "現在の政党";

                if (confirm(`本当に${partyName}を離党しますか？\n（無所属になります）`)) {
                    // 離党処理
                    player.partyId = null;

                    // 履歴の記録関数がある場合
                    if (typeof addhis === "function") {
                        addhis(player, `${partyName}を離党。`);
                    }

                    alert(`${partyName}を離党しました。`);

                    // モーダルを閉じるか、政党一覧に戻る
                    closeModal();
                    if (typeof updateStatusUI === "function") updateStatusUI();
                }
            }
        });
    } else if (player.partyId !== null && player.partyId !== partyId) {
        buttons.push({
            text: "他の政党に所属しています",
            className: "close-btn", // グレーボタン
            keepOpen: true
        });
    }
    else {
        buttons.push({
            text: "✋ この政党に参加申請する！",
            className: "scout-btn", // 緑ボタン
            keepOpen: true,
            callback: () => {
                if (tryJoinParty(player, partyId, false)) {
                    closeModal();
                }
            }
        });
    }

    // 戻るボタン
    buttons.push({
        text: "↩️ 一覧に戻る",
        className: "close-btn",
        keepOpen: true,
        callback: () => {
            showPartyListModal();
        }
    });

    // モーダル表示を上書き
    showModal("政党詳細プロフィール", detailHTML, buttons);
}

function showCreatePlayerPartyModal() {
    // プレイヤーと同じ街にいるNPCを一覧にする（自分以外）
    const fellowNpcs = npcs.filter(npc => npc.city === player.city);

    if (fellowNpcs.length < 2) {
        showModal("新党結成", `<p style="color:#a0aec0; text-align:center; padding:20px;">${player.city}には他に参加者が足りないため、新党を結成できません（最低あと2人必要です）。</p>`, [
            { text: "閉じる", className: "close-btn" }
        ]);
        return;
    }
    // --- 🏛️ 入力フォームとNPC招待チェックリストのHTML作成 ---
    let html = `
        <div style="max-height: 400px; overflow-y: auto; padding-right: 5px; font-size: 14px; color: #e2e8f0; scrollbar-width: thin;">
            <!-- 党名入力と色選択 -->
            <div style="margin-bottom: 18px; display: flex; gap: 12px; align-items: flex-end;">
                <div style="flex: 1;">
                    <label style="display:block; margin-bottom:8px; font-weight:bold; color:#f6ad55; letter-spacing: 0.5px;">🏛️ 新政党の名前を入力:</label>
                    <input type="text" id="newPlayerPartyName" placeholder="政党名を入力" style="
                        width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #4a5568; 
                        background: #1a202c; color: #fff; font-size: 14px; box-sizing: border-box;
                        outline: none; transition: border-color 0.2s;" 
                        onfocus="this.style.borderColor='#63b3ed'" onblur="this.style.borderColor='#4a5568'">
                </div>
                <!-- 🎨 RGB色指定カラーピッカー -->
                <div style="width: 70px;">
                    <label style="display:block; margin-bottom:8px; font-weight:bold; color:#f6ad55; text-align: center; font-size: 12px;">🎨 党色:</label>
                    <input type="color" id="newPlayerPartyColor" value="#ffcc00" style="
                        width: 100%; height: 38px; padding: 0; border-radius: 6px; border: 1px solid #4a5568; 
                        background: none; cursor: pointer; box-sizing: border-box;
                    ">
                </div>
            </div>

            <div style="margin-bottom: 4px; font-weight: bold; color: #f6ad55; letter-spacing: 0.5px;">👥 初期発起人（メンバー）を招待（最低2人選択）:</div>
            <p style="font-size: 12px; color: #90cdf4; margin: 0 0 12px 0; opacity: 0.85;">※思想が近く、あなたとの関係が良いほど加入しやすくなります。</p>
            
            <!-- スクロール出禁対応の招待リスト -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
    `;


    fellowNpcs.forEach(npc => {
        const currentPartyText = (npc.partyId && parties[npc.partyId]) ? parties[npc.partyId].name : "無所属";
        const relationScore = getRelation(player.id, npc.id); // プレイヤーとの友好度

        // 思想の一致度を計算（0〜100、ズレが少ないほど100に近い）
        const diff = Math.abs(player.ideology[0] - npc.ideology[0]) +
            Math.abs(player.ideology[1] - npc.ideology[1]) +
            Math.abs(player.ideology[2] - npc.ideology[2]);
        const matchPercent = Math.max(0, Math.floor(100 - (diff / 3)));

        // 関係性による色の変化（より鮮やかでゲーム的なネオンカラーに微調整）
        let relColor = "#cbd5e0";
        if (relationScore > 20) relColor = "#48bb78"; // 鮮やかなグリーン
        else if (relationScore < -20) relColor = "#fc8181"; // 警告感のあるパステルレッド

        html += `
            <label style="
                display: flex; align-items: center; background: #2d3748; padding: 12px; 
                border-radius: 6px; cursor: pointer; transition: all 0.2s ease;
                border: 1px solid transparent;
            " onmouseover="this.style.background='#344154'; this.style.borderColor='#4a5568';" onmouseout="this.style.background='#2d3748'; this.style.borderColor='transparent';">
                <input type="checkbox" class="invite-npc-checkbox" value="${npc.id}" style="margin-right: 14px; transform: scale(1.25); cursor: pointer;">
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #fff; font-size: 14px;">${npc.name} <span style="font-size:11px; color:#a0aec0; font-weight:normal; margin-left: 4px;">[${currentPartyText}]</span></div>
                    <div style="display: flex; gap: 15px; font-size: 12px; margin-top: 5px; opacity: 0.9;">
                        <span>🤝 友好度: <span style="color:${relColor}; font-weight:bold;">${relationScore > 0 ? '+' : ''}${relationScore}</span></span>
                        <span style="color:#63b3ed; font-weight: 500;">📊 思想一致度: ${matchPercent}%</span>
                        <span style="color:#38b2ac;">💰 資金: ${Math.floor(npc.money / 10000)}万</span>
                    </div>
                </div>
            </label>
        `;
    });

    html += `</div></div>`;

    // --- モーダルの表示設定 ---
    showModal("新党結成", html, [
        {
            text: "🚀 結成を宣言する！",
            className: "scout-btn",
            keepOpen: true, // バリデーションがあるので閉じない
            callback: () => {
                executePlayerPartyCreation();
            }
        },
        { text: "キャンセル", className: "close-btn", keepOpen: false }
    ]);

}

function executePlayerPartyCreation() {
    const nameInput = document.getElementById("newPlayerPartyName");
    const partyName = nameInput ? nameInput.value.trim() : "";
    const playerPartyColor = document.getElementById("newPlayerPartyColor").value;

    // 1. 党名チェック
    if (!partyName) {
        alert("❌ 政党名を入力してください！");
        return;
    }

    // 2. 選択されたチェックボックスの取得
    const checkboxes = document.querySelectorAll(".invite-npc-checkbox:checked");
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);

    // 3. 人数チェック（プレイヤー＋初期メンバー2人 ＝ 最低3人）
    if (selectedIds.length < 2) {
        alert("❌ 新党結成には、あなた以外に最低2人の参加者を招待する必要があります！");
        return;
    }

    // 招待を承諾してくれたメンバーを格納する配列
    const acceptedFounders = [];
    const rejectedNames = [];

    // 4. NPC一人ひとりの「加入審査」ロジック（思想 ＆ 人間関係）
    selectedIds.forEach(id => {
        const npc = npcs.find(m => m.id === id);
        if (!npc) return;

        // 🧠 表示用と同じ計算式をここにも入れる！
        const diff = Math.abs(player.ideology[0] - npc.ideology[0]) +
            Math.abs(player.ideology[1] - npc.ideology[1]) +
            Math.abs(player.ideology[2] - npc.ideology[2]);
        const matchPercent = Math.max(0, Math.floor(100 - (diff / 3)));

        // 👥 人間関係（友好度）
        const relationScore = getRelation(player.id, npc.id);
        const relationBonus = relationScore * 0.5;

        // 🎲 【修正案】一致度をそのままベースの確率にする！
        // 例：一致度 60% で 友好度0 なら、そのまま成功率 60%
        let finalSuccessChance = matchPercent + relationBonus;

        // 他党に所属しているNPCなら、義理があるので一律成功率 -20%
        if (npc.partyId !== null) finalSuccessChance -= 20;

        // 確率の限界値を丸める
        finalSuccessChance = Math.max(1, Math.min(95, finalSuccessChance));

        // 運命のサイコロ
        if (Math.random() * 100 < finalSuccessChance) {
            acceptedFounders.push(npc);
        } else {
            rejectedNames.push(npc.name);
        }
    });


    // 5. 最終承諾人数のチェック（断られた結果、2人未満になったら結成失敗）
    if (acceptedFounders.length < 2) {
        alert(`❌ 旗揚げ失敗……！\n一部のメンバーに断られ、発起人が足りなくなりました。\n【加入拒否】: ${rejectedNames.join("、") || "なし"}\n思想を寄せるか、友好度を上げましょう。`);
        return;
    }

    // 6. 🎉 【新党結成の実行手続き】
    const partyId = `party_player_${Date.now()}`;

    // プレイヤー自身の所属変更
    player.partyId = partyId;

    // 承諾してくれたNPCの所属変更と、初期の絆（友好度を即+30）をセット
    acceptedFounders.forEach(member => {
        // 以前の党から離党
        if (member.partyId && parties[member.partyId]) {
            parties[member.partyId].members = parties[member.partyId].members.filter(id => id !== member.id);
        }
        member.partyId = partyId;

        // 結成メンバー同士の友好度をMapに保存
        changeRelation(player.id, member.id, 30);
    });

    // 政党データに全員のIDを登録（プレイヤーのID ＋ 承諾したNPCのID）
    const allMemberIds = [player.id, ...acceptedFounders.map(m => m.id)];

    // 既存の新党作成関数にデータを投げる
    // ※ プレイヤーオブジェクト自身をleaderとして渡します
    createNewParty(partyId, partyName, player, playerPartyColor);

    // 7. 結果報告
    let resultMsg = `🎉 新党${partyName}の旗揚げに成功しました！\n\n【初代党首】: ${player.name}\n【結成メンバー】: ${acceptedFounders.map(m => m.name).join("、")} 計${allMemberIds.length}名`;
    if (rejectedNames.length > 0) {
        resultMsg += `\n\n※以下の参加者からは加入を拒否されました: ${rejectedNames.join("、")}`;
    }

    alert(resultMsg);
    closeModal(); // モーダルを閉じる
    // 必要ならここに画面の再描画処理(render)を入れてください
}


function assignPartyToNpcs() {
    console.log("🔍 配分処理スタート時チェック:");
    console.log(" - npcs:", typeof npcs !== 'undefined' ? npcs : "未定義");
    console.log(" - dt.partiesData:", typeof dt !== 'undefined' ? dt.partiesData : "未定義");

    let rawPartiesData = (typeof dt !== 'undefined' && dt.parties) ? dt.parties : "[]";
    let parsedParties = [];

    try {
        parsedParties = typeof rawPartiesData === 'string' ? JSON.parse(rawPartiesData) : rawPartiesData;
    } catch (e) {
        console.error("政党データのパースに失敗:", e);
    }

    if (Array.isArray(parsedParties) && parsedParties.length > 0) {
        parsedParties.forEach(p => {
            let partyInstance;

            if (typeof Party !== 'undefined') {
                // ① 先にインスタンスを作成
                partyInstance = new Party(p.id, p.name, null, p.color, p.econ, p.nation, p.diplo, p.ratio);
            } else {
                partyInstance = { ...p };
            }

            // ② 生成したインスタンスに対してプロパティを設定！
            partyInstance.termLength = 4;
            partyInstance.nextElectionYear = gameDate.getFullYear() + partyInstance.termLength;

            // 💡 members が無ければ空配列で初期化しておく
            if (!Array.isArray(partyInstance.members)) {
                partyInstance.members = [];
            }

            // ③ グローバル/管理用オブジェクトに保存
            parties[p.id] = partyInstance;
        });
    }

    // npcs の配列化
    const npcList = (typeof npcs !== 'undefined' && npcs !== null)
        ? (Array.isArray(npcs) ? npcs : Object.values(npcs))
        : [];

    // チェック用ログ
    if (npcList.length === 0 || parsedParties.length === 0) {
        console.warn(`⚠️ データ未準備: npcList数=${npcList.length}, parsedParties数=${parsedParties.length}`);
        return false; // 処理失敗
    }

    const totalNpcs = npcList.length;
    const partyLimits = {};
    const partyAssignedCounts = {};

    parsedParties.forEach(p => {
        const ratio = Number(p.ratio) || 0;
        const calculatedQuota = Math.round(totalNpcs * (ratio / 100));
        const maxQuota = ratio > 0 ? Math.max(1, calculatedQuota) : 0;

        partyLimits[p.id] = maxQuota;
        partyAssignedCounts[p.id] = 0;
    });

    // 枠に空きがある政党オブジェクトの配列を返す
    function getAvailableParties() {
        return parsedParties.filter(p => partyAssignedCounts[p.id] < partyLimits[p.id]);
    }

    // 💡 思想の近さを計算して最もマッチする政党を選ぶ関数
    function findBestMatchingParty(npc, availableParties) {
        if (!availableParties || availableParties.length === 0) return null;

        let bestParty = null;
        let minDiff = Infinity;

        // 候補となる政党ごとの「思想の距離」をスコア化
        const partyScores = availableParties.map(p => {
            const diffEcon = Math.abs((npc.econ || 0) - (p.econ || 0));
            const diffNation = Math.abs((npc.nation || 0) - (p.nation || 0));
            const diffDiplo = Math.abs((npc.diplo || 0) - (p.diplo || 0));

            // 思想の乖離度（小さいほど近い）
            let ideologyDiff = (diffEcon + diffNation + diffDiplo) / 3;

            // 🎲 わずかなランダムノイズ（0〜5pt）を加えて、完全一極集中を防ぐ
            ideologyDiff += Math.random() * 5;

            return { party: p, diff: ideologyDiff };
        });

        // 最も思想の近い政党を抽出
        partyScores.sort((a, b) => a.diff - b.diff);
        return partyScores[0].party;
    }

    npcList.forEach(npc => npc.partyId = null);

    const npcsByLocation = {};
    npcList.forEach(npc => {
        const locKey = `${npc.pref || ''}_${npc.city || ''}`.replace(/^_|_$/, '') || "default";
        if (!npcsByLocation[locKey]) npcsByLocation[locKey] = [];
        npcsByLocation[locKey].push(npc);
    });

    // ステップ1: 自治体ごとに最低1人配置（その地域で最も適した思想のNPCを選ぶ）
    for (const locKey in npcsByLocation) {
        const locNpcs = npcsByLocation[locKey];
        const availableParties = getAvailableParties();

        if (availableParties.length > 0 && locNpcs.length > 0) {
            // 未所属のNPCからランダムに1人選ぶ
            const targetNpc = locNpcs[Math.floor(Math.random() * locNpcs.length)];
            const bestParty = findBestMatchingParty(targetNpc, availableParties);

            if (bestParty) {
                targetNpc.partyId = bestParty.id;
                partyAssignedCounts[bestParty.id]++;

                // 🔥 【追加】政党オブジェクトの members にも追加！
                if (parties[bestParty.id]) {
                    if (!parties[bestParty.id].members) parties[bestParty.id].members = [];
                    parties[bestParty.id].members.push(targetNpc.id); // IDを入れる場合
                }
            }
        }
    }

    // ステップ2: 残りの枠を思想の一致度順に分配
    const unassignedNpcs = npcList.filter(npc => npc.partyId === null);
    // 処理順が偏らないようにシャッフル
    unassignedNpcs.sort(() => Math.random() - 0.5);

    for (const npc of unassignedNpcs) {
        const availableParties = getAvailableParties();
        if (availableParties.length === 0) break;

        // 💡 思想が最も近い空き政党に配分！
        const bestParty = findBestMatchingParty(npc, availableParties);
        if (bestParty) {
            npc.partyId = bestParty.id;
            partyAssignedCounts[bestParty.id]++;

            // 🔥 【追加】政党オブジェクトの members にも追加！
            if (parties[bestParty.id]) {
                if (!parties[bestParty.id].members) parties[bestParty.id].members = [];
                parties[bestParty.id].members.push(npc.id); // IDを入れる場合
            }
        }
    }
    // =========================================================
    // 🗳️ ステップ3: 初回「疑似党代表選挙」で leaderId を選定！
    // =========================================================
    parsedParties.forEach(party => {
        // npcs / npcList の中から、この政党IDを持っているNPCのIDだけを拾い出す
        const assignedIds = npcList
            .filter(npc => npc && npc.partyId === party.id)
            .map(npc => npc.id)
            .filter(Boolean); // 🔥 ここで null/undefined を一括除去！

        // party オブジェクトと parties[party.id] の両方の members を更新
        party.members = assignedIds;
        if (typeof parties !== 'undefined' && parties[party.id]) {
            parties[party.id].members = assignedIds;
        }
    });

    parsedParties.forEach(party => {

        const partyMembers = npcList.filter(npc => npc.partyId === party.id);

        if (partyMembers.length > 0) {
            let bestLeader = null;
            let highestScore = -Infinity;

            partyMembers.forEach(member => {
                const xp = Number(member.xp) || 0;
                const money = Number(member.money) || 0;
                const termCount = Number(member.termCount) || 0;
                const age = Number(member.age) || 18;

                // ----------------------------------------------------
                // 📊 実績・重鎮重視の評価スコア
                // ----------------------------------------------------
                // ① 当選期数スコア（ベテラン爆増：1期ごとに500pt）
                const termScore = termCount * 500;

                // ② XPスコア（1000ptなどの高XPは桁違いに強くする：XP × 50）
                const xpScore = xp * 50;

                // ③ 年齢補正（ベテラン・重鎮層を優遇）
                let ageBonus = 0;
                if (age >= 50 && age <= 70) {
                    ageBonus = 150; // 重鎮世代
                } else if (age >= 40 && age < 50) {
                    ageBonus = 80;  // 中堅世代
                }

                // ④ 資金補正（微小）
                const moneyScore = money / 100000;

                // ⑤ 運要素（0〜30ptに抑えて、実績差を逆転させにくくする）
                const randomLuck = Math.random() * 30;

                // 合計スコア計算
                const leaderScore = termScore + xpScore + ageBonus + moneyScore + randomLuck;

                if (leaderScore > highestScore) {
                    highestScore = leaderScore;
                    bestLeader = member;
                }
            });

            if (bestLeader) {
                if (typeof parties !== 'undefined' && parties[party.id]) {
                    parties[party.id].leaderId = bestLeader.id;
                }
                party.leaderId = bestLeader.id;

                console.log(`👑 【${party.name}】代表選出: ${bestLeader.name || 'ID:' + bestLeader.id} (期数:${bestLeader.termCount || 0}期, XP:${bestLeader.xp || 0}, 年齢:${bestLeader.age}歳)`);
            }
        } else {
            console.warn(`⚠️ 【${party.name}】には党員が0人のため、代表を選出できませんでした。`);
        }
    });



    console.log("🏛️ 思想一致型 党籍配分完了結果 (総NPC数:", totalNpcs, "):", partyAssignedCounts);
    return true;
}

// 政界再編（大ニュース時のブロック通知対応版）
function mergeMinorParties(parties, kokujimae, npcs, largest_opposition, rulingparty) {

    // ─── 🚨 1. 政界再編イベントの発生チェック ───
    const mainOppositionId = String(largest_opposition || "").trim();
    const targetOppositionParty = parties[mainOppositionId];
    const oppositionYears = targetOppositionParty?.consecutiveYearsInOpposition || 0;
    if (targetOppositionParty?.mergedminiparty === true) return;
    const baseEventProbability = 0.05 + (oppositionYears * 0.02);

    if (Math.random() > baseEventProbability) {
        return [];
    }

    console.log(`🏛️ 政治の地殻変動！政界再編フェーズが始まります...（発生率: ${(baseEventProbability * 100).toFixed(1)}%）`);

    const disparties = [];
    const npcArray = Array.isArray(npcs) ? [...npcs] : (npcs instanceof Map ? Array.from(npcs.values()) : Object.values(npcs || {}));

    if (typeof player !== "undefined" && player) {
        if (!npcArray.some(n => n.id === player.id)) {
            npcArray.push(player);
        }
    }

    const mainRulingId = String(Array.isArray(rulingparty) ? rulingparty[0] : rulingparty || "").trim();
    const rulingPartyObj = parties[mainRulingId];

    // 思想差計算（配列 [経, 国, 外] 対応）
    const getIdeologyDiff = (actor, target) => {
        const getArray = (obj) => {
            const ideo = obj?.ideology;
            if (Array.isArray(ideo)) return [Number(ideo[0] ?? 50), Number(ideo[1] ?? 50), Number(ideo[2] ?? 50)];
            if (typeof ideo === "number") return [ideo, ideo, ideo];
            return [50, 50, 50];
        };
        const a = getArray(actor);
        const t = getArray(target);
        const total = Math.abs(a[0] - t[0]) + Math.abs(a[1] - t[1]) + Math.abs(a[2] - t[2]);
        return isNaN(total) ? 0 : total;
    };

    const getSideFromIdeology = (ideology) => {
        if (Array.isArray(ideology)) {
            const econ = Number(ideology[0] ?? 50);
            const auth = Number(ideology[1] ?? 50);
            if (econ > 60 || auth > 60) return "right";
            if (econ < 40 || auth < 40) return "left";
            return "center";
        }
        return "center";
    };

    // ─── 2. 小政党の抽出 ───
    const minorParties = [];
    for (const [partyId, party] of Object.entries(parties)) {
        const pIdStr = String(party.id || partyId).trim();
        if (pIdStr === "無所属" || pIdStr === "independents" || pIdStr === mainRulingId || pIdStr === mainOppositionId || party.isDisbanded) continue;
        minorParties.push(party);
    }

    if (minorParties.length === 0) return disparties;

    // ─── 3. 核心部（キー政党）の決定 ───
    let corePartyId = mainOppositionId;
    if (rulingPartyObj && targetOppositionParty) {
        if (getIdeologyDiff(targetOppositionParty, rulingPartyObj) < 20) {
            corePartyId = mainRulingId; // 思想が近ければ与党への大合流
        }
    }

    const coreParty = parties[corePartyId];
    if (!coreParty) return disparties;

    // ─── 4. 合流を希望/打診する小政党の事前判定 ───
    const candidateParties = [];
    minorParties.forEach(party => {
        const diff = getIdeologyDiff(party, coreParty);
        const mergeChance = Math.max(0.2, 0.85 - (diff * 0.003) + (oppositionYears * 0.05));
        if (Math.random() < mergeChance) {
            candidateParties.push(party);
        }
    });

    if (candidateParties.length === 0) return disparties;
    // ─── 5. プレイヤーの立ち位置チェック ───
    const isPlayerLeaderOfCore = (typeof player !== "undefined" && player && coreParty.leaderId === player.id);
    const playerMinorParty = (typeof player !== "undefined" && player)
        ? candidateParties.find(p => String(p.id) === String(player.partyId) && (p.leaderId === player.id || player.isLeader))
        : null;

    // ========================================================
    // 🛠️ 修正ポイント1: 思想チェックによるフィルタリングを「外側」で行う
    // ========================================================
    const DISTANCE_THRESHOLD = 50.0;

    const finalApprovedParties = candidateParties.filter(party => {
        // そもそも合流NG、またはクソ諸派（syoha）なら無条件で弾く
        if (party.dont_merge === true || party.syoha === true) return false;

        // 思想データのセーフティチェック（配列がない場合は弾く）
        if (!coreParty.ideology || !party.ideology) return false;

        // 3つのパラメーターの差の二乗和から、思想の「距離」を計算
        const diff0 = coreParty.ideology[0] - party.ideology[0];
        const diff1 = coreParty.ideology[1] - party.ideology[1];
        const diff2 = coreParty.ideology[2] - party.ideology[2];

        const distance = Math.sqrt(diff0 * diff0 + diff1 * diff1 + diff2 * diff2);

        if (distance <= DISTANCE_THRESHOLD) {
            console.log(`【承認】${party.name} (距離: ${distance.toFixed(1)}) は合流可能です。`);
            return true;
        } else {
            console.log(`【拒否】${party.name} (距離: ${distance.toFixed(1)}) は思想が遠すぎます。`);
            return false;
        }
    });


    // ========================================================
    // 🏛️ 実体として解党・合流処理を行う内部ヘルパー関数
    // ========================================================
    const executeMerger = (approvedPartiesList, customName = null) => {
        // 承認された政党がいなければ何もせず終了
        if (!approvedPartiesList || approvedPartiesList.length === 0) return;

        const joinedNames = approvedPartiesList.map(p => `<strong>${p.name}</strong>`).join("、");

        // ─── 各政党員の所属書き換え＆解党処理 ───
        approvedPartiesList.forEach(p => {
            npcArray.forEach(npc => {
                if (String(npc.partyId) === String(p.id)) {
                    npc.partyId = coreParty.id;
                    if (typeof addhis === "function") {
                        addhis(npc, `${p.name}が${coreParty.name}に合流したため、${coreParty.name}の党員となる。`);
                    }
                }
            });
            disparties.push(p.id);
            delete parties[p.id];
        });

        // ─── 🏷️ 新党名の決定ロジック ───
        const oldCoreName = coreParty.name;
        const side = getSideFromIdeology(coreParty.ideology);

        let newDynamicName = "";
        if (customName && customName.trim() !== "") {
            // ① プレイヤーが入力したカスタム党名
            newDynamicName = customName.trim();
        } else if (typeof generateDynamicPartyName === 'function') {
            // ② 自動生成関数がある場合
            newDynamicName = generateDynamicPartyName(side);
        } else {
            // ③ デフォルト生成
            newDynamicName = `${side === 'right' ? '立憲保守' : side === 'left' ? '社会民主' : '国民民主'}新党`;
        }

        const newColor = (typeof getRandomColorForParty === 'function')
            ? getRandomColorForParty(newDynamicName)
            : "#1e90ff";

        coreParty.name = newDynamicName;
        coreParty.color = newColor;
        coreParty.mergedminiparty = true;

        // 【号外通知】全プレイヤーへの共通モーダル表示
        pushNotificationTray(
            "🏛️【号外】政界再編・巨大新党が誕生！",
            "政界に地殻変動！合流・新党結成により勢力図が大幅に塗り替えられました。",
            {
                title: "📰 速報",
                body: `
                <div style="text-align: left; font-size: 14px; color: #141414;">
                    <div style="background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                        <h4 style="color: ${newColor}; margin: 0 0 6px 0; font-size: 16px;">🔥 新党『${coreParty.name}』結成！</h4>
                        <p style="font-size: 13px; margin: 0; line-height: 1.5;">
                            「${oldCoreName}」を中心に、${joinedNames} が合流しました。<br>
                        </p>
                    </div>
                    <p style="font-size: 12px; color: #d69e2e; margin-top: 10px;">
                        ※この再編により、次の選挙における各党の擁立数・勢力構図に甚大な影響が出ます。
                    </p>
                </div>
            `,
                buttons: [
                    {
                        text: "👍 新しい勢力図を確認して進む",
                        className: "bribe-btn",
                        keepOpen: false,
                        callback: () => { console.log("政界再編ニュースを確認しました。"); }
                    }
                ]
            },
            true
        );
    };

    // ─── 6. 分岐処理 ───

    // パターンA: プレイヤーが「合流元（核心政党）」の党首の場合
    if (isPlayerLeaderOfCore) {
        let checkboxesHTML = candidateParties.map(p => `
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 14px; cursor: pointer; color:#1a202c;">
                <input type="checkbox" class="merger-party-check" value="${p.id}" checked style="transform: scale(1.2);">
                <span><strong>${p.name}</strong>（所属議員: ${npcArray.filter(n => String(n.partyId) === String(p.id)).length}名）</span>
            </label>
        `).join("");

        pushNotificationTray(
            "🤝 【党首決断】政党合流の打診が届いています！",
            "野党再編に向け、以下の小政党から我が党への合流申請が届きました。受け入れる政党と新党名を選択してください。",
            {
                title: "📜 合流受入・新党名の決断",
                body: `
                    <div style="text-align: left; background: rgba(0,0,0,0.03); padding: 12px; border-radius: 8px;">
                        <!-- ✏️ 新党名入力フォーム -->
                        <div style="margin-bottom: 14px;">
                            <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px; color: #2d3748;">
                                ✏️ 結成する新党の名前（空欄の場合は「${coreParty.name}」を継続、または自動命名）：
                            </label>
                            <input type="text" id="custom-party-name-input" placeholder="${coreParty.name}" value="${coreParty.name}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                        </div>

                        <p style="font-size: 13px; font-weight: bold; margin-bottom: 10px; color: #2d3748;">受け入れる政党にチェックを入れてください：</p>
                        ${checkboxesHTML}
                    </div>
                `,
                buttons: [
                    {
                        text: "✅ 新党を結成・合流を許可する",
                        className: "bribe-btn",
                        keepOpen: false,
                        callback: () => {
                            const checkedInputs = document.querySelectorAll('.merger-party-check:checked');
                            const selectedIds = Array.from(checkedInputs).map(cb => cb.value);
                            const appparty = candidateParties.filter(p => selectedIds.includes(String(p.id)));

                            // ✏️ 入力された新党名を取得
                            const nameInput = document.getElementById('custom-party-name-input');
                            const inputPartyName = nameInput ? nameInput.value : null;

                            if (appparty.length > 0) {
                                executeMerger(appparty, inputPartyName);
                            } else {
                                pushNotificationTray("🚫 拒否", "すべての合流申請を拒否し、現状の党組織を維持しました。", { title: "🚫 拒否", body: "すべての合流申請を拒否し、現状の党組織を維持しました。", buttons: [{ text: "了解" }] });
                            }
                        }
                    },
                    {
                        text: "❌ すべて拒否する",
                        className: "danger-btn",
                        keepOpen: false,
                        callback: () => {
                            candidateParties.forEach(p => {
                                p.dont_merge = true;
                            });
                            pushNotificationTray("🚫 拒否", "すべての合流申請を拒否し、現状の党組織を維持しました。", { title: "🚫 拒否", body: "すべての合流申請を拒否し、現状の党組織を維持しました。", buttons: [{ text: "了解" }] });
                        }
                    }
                ]
            },
            true
        );

        // パターンB: プレイヤーが「合流対象の小政党」の党首の場合
    } else if (playerMinorParty) {
        // 他のNPC小政党は自動合流決定
        const otherApproved = candidateParties.filter(p => String(p.id) !== String(playerMinorParty.id));
        if (playerMinorParty.dont_merge === true) {
            executeMerger(otherApproved);
            return;
        }
        pushNotificationTray(
            "✉️ 【大再編】新党結成への合流招待",
            `「${coreParty.name}」を中心とする野党大合流の提案が届きました。あなたの党（${playerMinorParty.name}）も参加しますか？`,
            {
                title: "🏛️ 党首としての決断",
                body: `
                    <div style="text-align: left; font-size: 14px; color: #2d3748;">
                        <p><strong>${coreParty.name}</strong>はあなたの党（${playerMinorParty.name}）が合流することを提案しています。合流した場合、党名が一新され新党の一員となりますが、拒否して独自路線を歩むことも可能です。</p>
                    </div>
                `,
                buttons: [
                    {
                        text: "🤝 合流に参加する（新党を結成）",
                        className: "bribe-btn",
                        keepOpen: false,
                        callback: () => {
                            otherApproved.push(playerMinorParty);
                            executeMerger(otherApproved);
                        }
                    },
                    {
                        text: "🛑 拒否して独自路線を堅持する",
                        className: "danger-btn",
                        keepOpen: false,
                        callback: () => {
                            pushNotificationTray("独自路線", "合流を拒否し、党の独自路線を維持することを選択しました。", { title: "独自路線", body: "合流を拒否し、党の独自路線を維持することを選択しました。", buttons: [{ text: "了解" }] });
                            playerMinorParty.dont_merge = true;
                            if (otherApproved.length > 0) {
                                executeMerger(otherApproved);
                            }
                        }
                    }
                ]
            },
            true
        );

        // パターンC: プレイヤーが一般議員、または無関係な場合（全自動で進行）
    } else {
        executeMerger(candidateParties);
    }

    return disparties;
}


function updateOppositionYears(parties, largest_opposition) {
    for (const [partyId, party] of Object.entries(parties)) {
        if (partyId === String(largest_opposition)) {
            // 野党第一党ならカウンターを+1（なければ1で初期化）
            party.consecutiveYearsInOpposition = (party.consecutiveYearsInOpposition || 0) + 1;
        } else {
            // 与党やその他の政党は0にリセット
            party.consecutiveYearsInOpposition = 0;
        }
    }
}

// 党内の思想の歪みをチェックする関数
function checkPartyInternalConflict(party, partyNpcs) {
    if (partyNpcs.length < 2) return 0;

    let minEcon = Infinity, maxEcon = -Infinity;
    let minAuth = Infinity, maxAuth = -Infinity;

    partyNpcs.forEach(npc => {
        const ideo = Array.isArray(npc.ideology) ? npc.ideology : [50, 50, 50];
        const econ = Number(ideo[0] ?? 50);
        const auth = Number(ideo[1] ?? 50);

        if (econ < minEcon) minEcon = econ;
        if (econ > maxEcon) maxEcon = econ;
        if (auth < minAuth) minAuth = auth;
        if (auth > maxAuth) maxAuth = auth;
    });

    // 経済軸と国家/権威軸の最大ギャップ（離れ具合）を算出
    const maxGap = Math.max(maxEcon - minEcon, maxAuth - minAuth);
    return maxGap; // 差が 60 〜 70 を超えたら爆発危険域！
}
// 💡 第1引数を allNpcs に変更
function triggerPartySplit(allNpcs, parties, rulingPartyId, mainOppositionId) {
    const candidateParties = [];

    // 1. すべての政党の思想ギャップを事前に計算してリストアップする
    Object.values(parties).forEach(partyObj => {
        // 無所属や解散済みの党は除外
        const pId = String(partyObj.id || "").toLowerCase().trim();
        if (partyObj.isDisbanded || pId === "independents" || pId === "無所属" || pId === "ind" || pId === "null" || pId === "undefined") {
            return;
        }

        // 💡 修正：渡されてきた全NPCから、いまチェックしている党のNPCだけを抽出
        const npcsInParty = allNpcs.filter(npc => String(npc.partyId) === String(partyObj.id));

        // 2人未満なら対立が起きないのでスキップ
        if (npcsInParty.length < 2) return;

        const conflictGap = checkPartyInternalConflict(partyObj, npcsInParty);

        // 思想ギャップが65を超えていて、かつ実際に離党組（econ > 60）が2人以上出そうな党をストック
        if (conflictGap > 65) {
            const potentialRebels = npcsInParty.filter(npc => Number(npc.ideology?.[0] ?? 50) > 60);
            if (potentialRebels.length >= 2) {
                candidateParties.push({
                    party: partyObj,
                    partyNpcs: npcsInParty,
                    gap: conflictGap
                });
            }
        }
    });

    // 2. 危機に瀕している政党が1つ以上あれば、一番ドロドロな党を1つだけ選ぶ
    if (candidateParties.length > 0) {
        // ギャップが大きい順にソート
        candidateParties.sort((a, b) => b.gap - a.gap);

        // 配列の先頭（＝全宇宙で最も対立が激しい1つの政党）を抽出
        const worstPartyCase = candidateParties[0];

        console.log(`⚖️ 【政党分裂審査】最も対立の激しい政党を選出: ${worstPartyCase.party.name} (ギャップ値: ${worstPartyCase.gap})`);

        // 3. 確定したその1党「だけ」を、実際の実行関数（executePartySplit）へ渡す！
        executePartySplit(
            worstPartyCase.party,
            worstPartyCase.partyNpcs,
            parties,
            rulingPartyId,
            mainOppositionId
        );
    } else {
        console.log("⚖️ 【政党分裂審査】今期、限界突破（ギャップ65超）している政党はありませんでした。");
    }
}

function executePartySplit(party, partyNpcs, parties, rulingPartyId, mainOppositionId) {
    const getSideFromIdeology = (ideology) => {
        if (Array.isArray(ideology)) {
            const econ = Number(ideology[0] ?? 50);
            const auth = Number(ideology[1] ?? 50);
            if (econ > 60 || auth > 60) return "right";
            if (econ < 40 || auth < 40) return "left";
            return "center";
        }
        return "center";
    };
    const conflictGap = checkPartyInternalConflict(party, partyNpcs);
    // 思想ギャップが65を超えたら限界突破で空中分解！
    if (conflictGap > 65) {
        const rebels = [];   // 造反・離党組（右派系など）
        const loyalists = []; // 残留組（左派・中道系など）

        partyNpcs.forEach(npc => {
            const econ = Number(npc.ideology?.[0] ?? 50);
            if (econ > 60) {
                rebels.push(npc);
            } else {
                loyalists.push(npc);
            }
        });

        // 離党組がある程度の規模（2人以上）なら新党結成へ！
        if (rebels.length >= 2) {

            // 🎲 50%の確率で「完全崩壊パターン」か「一部集団離党パターン」かを仕分ける
            const isTotalCollapse = Math.random() < 0.50;

            // 共通で使う画面ロック判定
            const targetPartyId = String(party.id).trim();
            const isRuling = targetPartyId === String(rulingPartyId).trim();
            const isMainOpposition = targetPartyId === String(mainOppositionId).trim();
            const isPlayerInParty = typeof player !== "undefined" && String(player?.partyId).trim() === targetPartyId;
            const isMajorImpact = isRuling || isMainOpposition || isPlayerInParty;

            // =================================================================
            // 🔥 パターン【💥 1. 党本部完全崩壊・消滅ルート】（確率50%）
            // =================================================================
            if (isTotalCollapse) {
                const collapsedPartyName = party.name;
                // 元の党首のIDを取得（オブジェクト構造に合わせて party.leader?.id などに調整してください）
                const originalLeaderId = party.leaderId || party.leader?.id;

                // 💡 造反組（右派）の新党データ
                const rightPartyId = `party_collapse_r_${Date.now()}`;
                const rightSide = "right";
                const rightPartyName = generateDynamicPartyName(rightSide);
                const rightColor = getRandomColorForParty(rightPartyName);

                // 【修正】元の党首が造反組にいるなら優先、いなければXP順
                const isOriginalLeaderInRebels = rebels.some(npc => npc.id === originalLeaderId);
                const rightLeader = isOriginalLeaderInRebels
                    ? rebels.find(npc => npc.id === originalLeaderId)
                    : [...rebels].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))[0];

                if (rightLeader) {
                    if (rightLeader.id === originalLeaderId) {
                        addhis(rightLeader, `執行部との抗争の末、自ら率いる${collapsedPartyName}を解散。反主流派を率いて${rightPartyName}を結成し、引き続き代表に就任。`);
                    } else {
                        addhis(rightLeader, `執行部との抗争で${collapsedPartyName}が解散、反主流派と共に${rightPartyName}を結成。`);
                    }
                }

                // 💡 残留組（左派/中道）の新党データ
                const leftPartyId = `party_collapse_l_${Date.now() + 1}`;
                const originalSide = getSideFromIdeology(party.ideology);
                const leftSide = originalSide === "right" ? "center" : originalSide;
                const leftPartyName = generateDynamicPartyName(leftSide);
                const leftColor = party.color || "#4a5568";

                // 【修正】元の党首が残留組にいるなら優先、いなければXP順
                const isOriginalLeaderInLoyalists = loyalists.some(npc => npc.id === originalLeaderId);
                const leftLeader = isOriginalLeaderInLoyalists
                    ? loyalists.find(npc => npc.id === originalLeaderId)
                    : (loyalists.length > 0 ? [...loyalists].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))[0] : null);

                if (leftLeader) {
                    if (leftLeader.id === originalLeaderId) {
                        addhis(leftLeader, `${collapsedPartyName}の解散に伴い、主流派を率いて後継政党となる${leftPartyName}を結成。引き続き代表を務める。`);
                    } else {
                        addhis(leftLeader, `${collapsedPartyName}の解散に伴い、主流派と共に${leftPartyName}を結成。`);
                    }
                }

                // ⚡ 2つの新党をシステムに同時登録
                createNewParty(rightPartyId, rightPartyName, rightLeader, rightColor);
                if (loyalists.length >= 1 && leftLeader) {
                    createNewParty(leftPartyId, leftPartyName, leftLeader, leftColor);
                }

                // 所属NPCのIDをそれぞれ新党へ移籍
                rebels.forEach(npc => { npc.partyId = rightPartyId; });
                loyalists.forEach(npc => { npc.partyId = leftPartyId; });

                // ⚠️ プレイヤーがこの党に所属していた場合、自動的に左派/後継新党へ強制移籍
                if (isPlayerInParty) {
                    player.partyId = leftPartyId;
                }


                // 📉 元の党は完全に歴史から消滅し、議席もゼロへ
                party.seats = 0;
                if (typeof parties !== "undefined" && parties[targetPartyId]) {
                    // システム上の名簿から完全に削除（解党）
                    delete parties[targetPartyId];
                }

                const collapseBadge = isRuling
                    ? "🚨【!!政権崩壊・解党!!】"
                    : "🏛️【第1野党完全消滅】";

                pushNotificationTray(
                    `${collapseBadge} 内紛の末、『${collapsedPartyName}』本部が完全に大崩壊！`,
                    `対立の溝は埋まらず、党本部が空中分解。所属議員全員が離党し新党へ分裂しました。`,
                    {
                        title: "🚨 緊急政局特報・組織崩壊",
                        body: `
                        <div style="text-align: left; font-size: 14px; color: #fff; background: #2d3748; padding: 12px; border-radius: 8px; border: 2px solid #e53e3e;">
                            <p style="color: #f56565; font-weight: bold; margin-bottom: 8px; font-size: 15px;">
                                ☠️ 伝統ある大政党『${collapsedPartyName}』が本日付で完全消滅
                            </p>
                            <p style="font-size: 13px; line-height: 1.5; margin-bottom: 12px; color: #e2e8f0;">
                                内部抗争はピークに達し、本日ついに党本部は空中分解しました。<br>
                                執行部・反主流派が互いに罵り合う形で全党員が飛び出し、複数の新党へと完全に分裂しました。
                            </p>
                            <div style="background: rgba(0,0,0,0.4); padding: 10px; border-radius: 6px; font-size: 12px; line-height: 1.6; border-left: 4px solid #e53e3e; margin-bottom: 4px;">
                                <span style="color: #f56565;">❌ 旧・${collapsedPartyName}</span>: <b style="text-decoration: line-through;">解党 (0議席)</b><br>
                                <span style="color: ${rightColor};">🚀 新党『${rightPartyName}』(反主流派)</span>: <b>${rebels.length}</b> 人 (代表: ${rightLeader.name})<br>
                                <span style="color: ${leftColor};">🛡️ 新党『${leftPartyName}』(主流派)</span>: <b>${loyalists.length}</b> 人 (代表: ${leftLeader ? leftLeader.name : "不在"})
                            </div>
                            ${isPlayerInParty ? `<p style="font-size: 11px; color: #ecc94b; margin-top: 8px; font-weight: bold;">⚠️ あなたの所属組織が消滅したため、自動的に「${leftPartyName}」籍へ移籍されました。</p>` : ""}
                        </div>
                    `,
                        buttons: [
                            {
                                text: "💥 空前の政界大再編を見届ける",
                                className: "scout-btn",
                                keepOpen: false,
                                callback: () => { console.log("党本部の大崩壊ログを確認しました。"); }
                            }
                        ]
                    },
                    isMajorImpact
                );

                // =================================================================
                // 🤝 パターン【🔥 2. 一部派閥の集団離党ルート】（確率50%・既存ロジック）
                // =================================================================
            } else {
                const newPartyId = `party_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                const side = getSideFromIdeology(party.ideology);

                const newPartyName = generateDynamicPartyName(side);
                const newColor = getRandomColorForParty(newPartyName);

                const rebelLeader = [...rebels].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))[0];
                addhis(rebelLeader, `${newPartyName}を結成、${rebels.length}人と共に${party.name}から分裂。`)
                createNewParty(newPartyId, newPartyName, rebelLeader, newColor);

                rebels.forEach(npc => {
                    npc.partyId = newPartyId;
                });

                party.seats = Math.max(0, (party.seats || 0) - rebels.length);

                const badgeText = isRuling
                    ? "👑【政権与党分裂】"
                    : isMainOpposition
                        ? "⚔️【野党第一党崩壊】"
                        : isPlayerInParty
                            ? "⚠️【所属党の激震】"
                            : "💥【党内分裂】";

                pushNotificationTray(
                    `${badgeText} 『${party.name}』から集団離党が発生！`,
                    `政策の根幹を巡り路線対立が爆発。${rebelLeader.name}率いる派閥が脱党しました。`,
                    {
                        title: "🚨 政変・党内抗争特報",
                        body: `
                        <div style="text-align: left; font-size: 14px; color: #222222;">
                            <p style="color: #fc8181; font-weight: bold; margin-bottom: 8px;">
                                🔥 『${party.name}』から ${rebels.length} 名の党員が離党！
                            </p>
                            <p style="font-size: 13px; line-height: 1.5; margin-bottom: 10px;">
                                抑えきれない党内対立の末、派閥ごと集団脱党。<br>
                                党内大物の <strong>${rebelLeader.name}</strong>（影響力: ${rebelLeader.xp ?? 0}）を旗印に、新党<strong>『${newPartyName}』</strong>の結成を宣言しました！
                            </p>
                            <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; font-size: 12px; color: #f7f7f7; border-left: 3px solid ${newColor};">
                                📉 <strong>${party.name}</strong>（主流派）: <strong>${party.members.length}</strong> 議席<br>
                                🚀 <strong>${newPartyName}</strong>（反主流派）: <strong>${rebels.length}</strong> 議席
                            </div>
                        </div>
                    `,
                        buttons: [
                            {
                                text: "💥 政界動乱の行方を見極める",
                                className: "bribe-btn",
                                keepOpen: false,
                                callback: () => { console.log("党内分裂ログを確認しました。"); }
                            }
                        ]
                    },
                    isMajorImpact
                );
            }
        }
    }

}