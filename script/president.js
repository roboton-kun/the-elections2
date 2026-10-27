let president = null;
let vicepresident = null;
window.vicepresidentElect = null;
function getIdeologyCategory(npc) {
    if (!npc || !npc.ideology) return "neutral";
    const [left1, right, left2] = npc.ideology;

    if (right > 80) return "farRight";  // 極右
    if (right > 65) return "right";     // 右派
    if (left1 < 20 || left2 > 80) return "farLeft"; // 極左
    if (left1 < 35 || left2 > 65) return "left";    // 左派
    return "neutral"; // 中道・第3勢力
}

/**
 * 📊 特設ボタンのカウントダウン表示を最新の状態に更新する関数
 * (毎ターンの turnmove() の最後などで呼び出してください)
 */
function updateElectionStatusText() {
    const textEl = document.getElementById("election-status-text");
    if (!textEl) return;

    // イベントマネージャーから残り日数を取得
    const primaryDays = gameEventManager.getDaysLeft("primary_election", gameDate);
    const generalDays = gameEventManager.getDaysLeft("presidential_election", gameDate);

    // 💡 現在のゲームモードや残り日数に応じて、表示するテキストを賢く出し分ける
    if (window.mode === "pr") {
        textEl.innerHTML = `🗳️ <span style="color: #ffc107;">【予備選挙期間中】</span> 本選（大統領選）まで あと <span style="font-size: 16px; color: #00eafe;">${generalDays}</span> 日 ［クリックで歴史書を展開］`;
    } else if (primaryDays > 0) {
        textEl.innerHTML = `⚔️ 次回党内予備選まで あと <span style="font-size: 16px; color: #00eafe;">${primaryDays}</span> 日 ／ 本選まで あと ${generalDays} 日 ［詳細を表示］`;
    } else if (generalDays > 0) {
        textEl.innerHTML = `👑 決戦・大統領選挙本選まで あと <span style="font-size: 16px; color: #ff4757;">${generalDays}</span> 日 ［支持率・過去ログを確認］`;
    } else {
        textEl.innerHTML = `⚙️ 選挙日程が未組閣、または開票中... ［アーカイブを閲覧］`;
    }
}

/**
 * ❌ 選挙状況特設ボタンを画面から安全に削除する関数
 */
function removeElectionStatusButton() {
    const statusBar = document.getElementById("election-status-bar");
    if (statusBar) {
        statusBar.remove();
    }
    // 空けたBodyの余白も元に戻す
    document.body.style.paddingBottom = "0px";
    console.log("🗑️ 選挙状況バーを撤去しました。");
}


/**
 * 🗳️ 画面最下部に「選挙状況特設ボタン（情報バー）」を設置する関数
 */
function createElectionStatusButton() {
    // 💡 すでに存在している場合は重複して作らないようにガード
    if (document.getElementById("election-status-bar")) return;

    // 1. バーのコンテナ（外枠）を作成
    const statusBar = document.createElement("div");
    statusBar.id = "election-status-bar";

    // 🎨 ウィキペディア風・政治ゲームになじむスタイリッシュな固定デザイン
    Object.assign(statusBar.style, {
        position: "fixed",
        bottom: "0",
        left: "0",
        width: "100%",
        backgroundColor: "#202122",
        color: "#ffffff",
        textAlign: "center",
        padding: "10px 0",
        fontFamily: "sans-serif",
        fontSize: "14px",
        fontWeight: "bold",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.3)",
        zIndex: "9999",
        cursor: "pointer",
        transition: "background-color 0.2s"
    });

    // マウスを乗せたときにほんのり明るくする演出
    statusBar.onmouseover = () => { statusBar.style.backgroundColor = "#2f3133"; };
    statusBar.onmouseout = () => { statusBar.style.backgroundColor = "#202122"; };

    // 2. クリックしたら、アインシュタインが直した「歴代大統領Wikipedia画面」を開く仕様にする！
    statusBar.onclick = () => {
        openelectionstatus();
    };

    // 3. 中身のテキストエリアを作成
    const textSpan = document.createElement("span");
    textSpan.id = "election-status-text";
    textSpan.innerText = "⏳ 選挙カレンダーを読み込み中...";
    statusBar.appendChild(textSpan);

    // 4. 実際の画面（Body）の最下部に追加
    document.body.appendChild(statusBar);

    // 💡 下にバーが固定されるので、ゲーム本編の画面が隠れないようにBodyの下に余白を空ける
    document.body.style.paddingBottom = "45px";

    // 設置完了したら、即座に最新の日数を計算して表示
    updateElectionStatusText();
}

function onIndependentCandidacyClick() {
    // プレイヤーのフラグを立てる
    player.isOfficialNominee = true;
    player.isIntentDeclared = true;
    player.endorsedByParties = [];
    player.isPresidentialCandidate = true;
    addhis(player, `大統領選挙へ無所属として立候補を表明。`)
    console.log("無所属で大統領選に立候補しました！");

    // 必要であれば、ここでモーダルを閉じたりUIを更新する関数も呼ぶとバッチリ！
    closeModal();
    openelectionstatus();
}

function withdrawplayer() {
    delete player.isOfficialNominee;
    delete player.isIntentDeclared;
    delete player.endorsedByParties;
    delete player.isPresidentialCandidate;
    addhis(player, "大統領選挙からの撤退を表明。");

    // 必要であれば、ここでモーダルを閉じたりUIを更新する関数も呼ぶとバッチリ！
    closeModal();
    openelectionstatus();
}

function openelectionstatus() {
    // 1. 全NPCを一発逆引きできるMapを作成（アインシュタインの必勝パターン）
    const npcMap = new Map();
    const totalNpcs = Array.isArray(npcs) ? npcs.length : 0;
    for (let i = 0; i < totalNpcs; i++) {
        const n = npcs[i];
        if (n && n.id) npcMap.set(n.id, n);
    }
    // プレイヤーもMapに混ぜておく
    if (player && player.id) npcMap.set(player.id, player);

    // 2. プレイヤーと全NPCのリスト（ループ用）
    const allCandidates = player ? [player, ...npcs] : [...npcs];

    // 3. 【グループ化】政党ごと、および無所属の出馬状況を格納するオブジェクト
    const partyGroups = {};
    const independentCandidates = [];

    // 💡 事前に全政党の枠を空配列で初期化しておく
    if (typeof parties !== 'undefined') {
        Object.values(parties).forEach(p => {
            if (p.id === "independents") return;
            partyGroups[p.id] = {
                name: p.name,
                color: p.color || "#54595d",
                nominee: null,       // 公認候補（1名想定）
                declared: [],        // 出馬表明中の党員たち
                withdraw: []
            };
        });
    }

    // 4. 全員をフラグに基づいて仕分けするループ
    allCandidates.forEach(n => {
        if (!n) return;

        // 出馬表明（isIntentDeclared）または大統領候補（isPresidentialCandidate）の人のみ抽出
        if (n.isIntentDeclared || n.isPresidentialCandidate || n.isOfficialNominee || n.iswithdrawn) {

            if (n.partyId && partyGroups[n.partyId]) {
                // 政党に所属している場合
                if (n.isOfficialNominee) {
                    partyGroups[n.partyId].nominee = n; // 公認候補
                    partyGroups[n.partyId].declared.push(n);
                } else if (n.isIntentDeclared) {
                    partyGroups[n.partyId].declared.push(n); // 出馬表明中
                } else if (n.iswithdrawn) {
                    partyGroups[n.partyId].withdraw.push(n); // 出馬表明中
                }

                if (n.isOfficialVPNominee) {
                    partyGroups[n.partyId].vicenominee = n; // 公認候補
                }
            } else {
                // 無所属（partyId が空、または存在しない政党）の場合
                independentCandidates.push(n);

            }
        }
    });

    let modalBody = "";

    if (player.isIntentDeclared) {
        modalBody += `
    <button class="scout-btn" onclick="withdrawplayer()">選挙戦から撤退する。</button>
    `;

    }

    if (!player.isIntentDeclared) {
        if (player.partyId === null) {
            modalBody += `
    <button class="scout-btn" onclick="onIndependentCandidacyClick()">無所属として大統領選挙に立候補</button>
    `;

        }
    }


    // 5. 🏛️ モーダルに流し込むWikipedia風の美しいHTMLの組み立て
    modalBody += `
        <div style="max-height: 400px; overflow-y: auto; font-family: sans-serif; font-size: 13px; text-align: left; color: #000; background: #fff; padding: 5px;">
            <p style="font-size: 12px; color: #54595d; margin-bottom: 15px; border-bottom: 1px solid #a2a9b1; padding-bottom: 5px;">
                各政党の公認・出馬表明状況、および有力な無所属候補の一覧です。
            </p>
    `;

    // ─── 【セクション1：政党公認・表明者一覧】 ───
    modalBody += `<h4 style="font-size: 15px; border-bottom: 1px solid #a2a9b1; margin-top: 10px; padding-bottom: 3px;">🏛️ 各党の公認・表明スタンス</h4>`;

    Object.values(partyGroups).forEach(group => {
        modalBody += `
            <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #a2a9b1; border-radius: 3px; background: #f8f9fa;">
                <div style="font-weight: bold; font-size: 14px; border-left: 4px solid ${group.color}; padding-left: 6px; margin-bottom: 8px;">
                    ${group.name}
                </div>
        `;

        // 👑 公認候補の表示
        if (group.nominee) {
            const p = group.nominee;
            const isP = p.id === (player ? player.id : null);
            modalBody += `
                <div style="background: #eef9ff; border: 1px solid #bce1f5; padding: 6px; border-radius: 2px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                    <span style="background: #007bff; color: #fff; font-size: 10px; padding: 1px 4px; border-radius: 2px; font-weight: bold;">👑 党公認候補</span>
                    <strong style="color: #0645ad;">${p.name}</strong> ${isP ? '<span style="color:#d9534f; font-weight:bold;">(あなた)</span>' : ''}</div>
            `;
        } else {
            modalBody += `<div style="color: #72777d; font-size: 11px; margin-bottom: 6px;">⚠️ 現在、公式な党公認候補は決定していません。</div>`;
        }

        if (group.vicenominee) {
            const p = group.vicenominee;
            const isP = p.id === (player ? player.id : null);
            modalBody += `
                            <div style="background: #eef9ff; border: 1px solid #bce1f5; padding: 6px; border-radius: 2px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                    <span style="background: #007bff; color: #fff; font-size: 10px; padding: 1px 4px; border-radius: 2px; font-weight: bold;">👑 党公認副候補</span>
                    <strong style="color: #0645ad;">${p.name}</strong> ${isP ? '<span style="color:#d9534f; font-weight:bold;">(あなた)</span>' : ''}
                </div>
            `;
        } else {
            modalBody += `<div style="color: #72777d; font-size: 11px; margin-bottom: 6px;">⚠️ 現在、公式な党公認副候補は決定していません。</div>`;
        }

        // 🔥 出馬表明中の党員
        if (group.declared.length > 0) {
            modalBody += `<div style="font-size: 11px; font-weight: bold; color: #54595d; margin-top: 5px;">✋ 予備選挙の候補:</div>
    <ul style="margin: 3px 0 0 15px; padding: 0; color: #202122;">`;

            group.declared.forEach(p => {
                if (p.iswithdrawn) return;
                const isP = p.id === (player ? player.id : null);
                modalBody += `<li><strong>${p.name}</strong> ${isP ? '<span style="color:#d9534f; font-weight:bold;">(あなた)</span>' : ''}</li>`;
            });

            modalBody += `</ul>`;
        }

        // 🔥 撤退を表明した候補
        if (group.withdraw.length > 0) {
            modalBody += `<details style="margin-top: 5px;">
        <summary style="font-size: 11px; font-weight: bold; color: #54595d; cursor: pointer;">✋ 撤退を表明した候補:</summary>
        <ul style="margin: 3px 0 0 15px; padding: 0; color: #202122;">`;

            // 💡 修正：group.declared ではなく group.withdraw をループする
            group.withdraw.forEach(p => {
                // 必要に応じて条件を変更してください（撤退リストなら p.iswithdrawn のチェックは不要な場合が多いです）
                if (!p.iswithdrawn) return;

                const isP = p.id === (player ? player.id : null);
                modalBody += `<li><strong>${p.name}</strong> ${isP ? '<span style="color:#d9534f; font-weight:bold;">(あなた)</span>' : ''}</li>`;
            });

            modalBody += `</ul>
    </details></div>`;
        } else {
            modalBody += `</div>`
        }

    });

    // ─── 【セクション2：無所属出馬表明者】 ───
    modalBody += `<h4 style="font-size: 15px; border-bottom: 1px solid #a2a9b1; margin-top: 15px; padding-bottom: 3px;">🦅 その他</h4>`;

    if (independentCandidates.length === 0) {
        modalBody += `<p style="color: #54595d; font-style: italic; padding-left: 5px;">現在、出馬表明している無所属候補はいません。</p>`;
    } else {
        modalBody += `<table style="width: 100%; border-collapse: collapse; margin-top: 5px; background: #fff; border: 1px solid #a2a9b1;">`;
        independentCandidates.forEach(n => {
            const isP = n.id === (player ? player.id : null);
            // 他党からの推薦（endorsedByParties）があればテキスト化
            const endorsements = (Array.isArray(n.endorsedByParties) && n.endorsedByParties.length > 0)
                ? `<br><span style="font-size:11px; color:#28a745;">🤝 推薦: ${n.endorsedByParties.join(", ")}</span>`
                : '';

            modalBody += `
                <tr style="border-bottom: 1px solid #a2a9b1;">
                    <td style="padding: 6px; font-weight: bold; color: #0645ad; width: 60%;">
                        ${n.name} ${isP ? '<span style="color:#d9534f; font-weight:bold;">(あなた)</span>' : ''} ${endorsements}${n.iswithdrawn ? `<br />(撤退)` : ""}
                    </td>
                    <td style="padding: 6px; text-align: right; color: #54595d; font-size: 11px;">
                        ${getPartyName(n.partyId)}
                    </td>
                </tr>
            `;
        });
        modalBody += `</table>`;
    }

    modalBody += `</div>`; // スクロールコンテナの閉じタグ

    // 6. 構築したHTMLをモーダルに流し込んで表示！
    showModal("📢 選挙戦・最新状況",
        modalBody,
        [{ text: "閉じる", value: "ok", className: "scout-btn" }]);
}

async function getcandidate(count = 1) {
    console.log(`📢 大統領選・候補者調整フェーズ [第 ${count} / 10 回]`);

    const liveNpcs = npcs.filter(n => n.isNPC && n.isAlive !== false);
    const playerPartyId = (typeof player !== 'undefined' && player) ? player.partyId : null;

    const slotLimits = {
        farLeft: 1, left: 2, neutral: 2, right: 2, farRight: 1
    };

    // 1. 現在アクティブな無所属の立候補者数をカウント
    const slotCounts = { farLeft: 0, left: 0, neutral: 0, right: 0, farRight: 0 };
    liveNpcs.forEach(cand => {
        if (cand.isPresidentialCandidate && (!cand.partyId || cand.partyId === "independents")) {
            const category = getIdeologyCategory(cand);
            slotCounts[category]++;
        }
    });

    liveNpcs.forEach(cand => {
        if (cand.isPresidentialCandidate && (!cand.partyId || cand.partyId === "independents")) {

            const xp = cand.xp || 0;

            // 💡 撤退基準値（ハードル）が回数ごとに上がっていく
            // 1回目なら「XP 13未満」、10回目なら「XP 40未満」が足切り危険域
            const lowXpThreshold = 10 + (count * 3);

            // 💡 撤退確率：序盤（1〜3回）は不祥事や見通しの甘さによる事故撤退（15%）
            // 中盤〜終盤（4回目以降）は資金枯渇と支持率低迷によるガチ撤退（40%）
            const declineProbability = count < 4 ? 0.15 : 0.40;

            if (xp < lowXpThreshold && Math.random() < declineProbability) {

                addhis(cand, "大統領選挙からの撤退を表明。");

                cand.isOfficialNominee = false;
                cand.isIntentDeclared = false;
                cand.iswithdrawn = true; // 💡 再出馬防止のフラグ
                cand.isPresidentialCandidate = false;

                const category = getIdeologyCategory(cand);
                slotCounts[category] = Math.max(0, slotCounts[category] - 1);
            }
        }
    });

    // ====================================================
    // ① 自由出馬ロジック（全期間で発生、ただし後半ほど激ムズに）
    // ====================================================
    liveNpcs.forEach(cand => {
        if (cand.age <= 35) return;
        if (cand.isPresidentialCandidate) return; // すでに出馬中ならスキップ
        if (cand.iswithdrawn) return;             // 過去に撤退した人は再出馬不可

        // 無所属の判定
        if (!cand.partyId || !cand.partyId.trim() || cand.partyId === "independents" || cand.partyId === null) {

            // 💡 補正：1回目の出馬率をあえて抑え（0.5倍）、2〜4回目（中盤前）をピークにする
            // 7回目以降（終盤）は電撃出馬の超低確率（泡沫候補の特攻）に。
            let periodModifier = 1.0;
            if (count === 1) periodModifier = 0.5;
            else if (count >= 5 && count <= 7) periodModifier = 0.3;
            else if (count >= 8) periodModifier = 0.05; // 終盤の電撃出馬は超レア

            const baseProbability = (cand.xp || 0) >= 30 ? 0.60 : 0.20;
            const passProbability = baseProbability * periodModifier;

            if (Math.random() < passProbability) {
                const category = getIdeologyCategory(cand);

                // スロットに空きがあれば滑り込み立候補！
                if (slotCounts[category] < slotLimits[category]) {

                    addhis(cand, "大統領選挙へ無所属として立候補を表明。");

                    cand.isOfficialNominee = true;
                    cand.isIntentDeclared = true;
                    cand.endorsedByParties = [];
                    cand.isPresidentialCandidate = true;

                    slotCounts[category]++;
                }
            }
        }
    });

    // 各政党（Party）の統計データ作成（既存ロジック）
    const parties = [...new Set(liveNpcs.map(n => n.partyId).filter(Boolean))];
    const partyStats = {};
    parties.forEach(pId => {
        const members = liveNpcs.filter(n => n.partyId === pId);
        const seatCount = members.filter(n => n.rep || n.sen).length;
        const leader = members.find(n => n.isLeader) || members.sort((a, b) => (b.xp || 0) - (a.xp || 0))[0];

        partyStats[pId] = {
            members: members,
            seatCount: seatCount,
            totalMembers: members.length,
            leader: leader
        };
    });

    for (const partyId of parties) {
        if (partyId === "independents") continue;
        const partyMembers = partyStats[partyId].members;
        if (!partyMembers.length) continue;

        const incumbentCount = partyStats[partyId].seatCount;
        const totalPartyMembers = partyStats[partyId].totalMembers;
        const partyLeader = partyStats[partyId].leader;
        const isPlayerParty = (partyId === playerPartyId);
        const dominantPartyId = Object.keys(partyStats).sort((a, b) => partyStats[b].seatCount - partyStats[a].seatCount)[0];
        const dominantLeader = partyStats[dominantPartyId]?.leader;

        // ==========================================
        // 🌟 1. 議員数 & 思想一致度による 擁立 vs 推薦(見送り) 判定
        // ==========================================
        if (!isPlayerParty && partyId !== dominantPartyId) {
            const getIdeologyDistance = (npcA, npcB) => {
                if (!npcA || !npcB) return 999;
                const diffEcon = Math.abs((npcA.econ || 0) - (npcB.econ || 0));
                const diffDiplo = Math.abs((npcA.diplo || 0) - (npcB.diplo || 0));
                const diffNation = Math.abs((npcA.nation || 0) - (npcB.nation || 0));
                return diffEcon + diffDiplo + diffNation;
            };
            const distanceToDominant = getIdeologyDistance(partyLeader, dominantLeader);
            const isCloseIdeology = distanceToDominant < 30;

            let nominationChance = 0.20;
            if (incumbentCount >= 5) nominationChance = 1.00;
            else if (incumbentCount >= 1) nominationChance = 0.70;
            else if (totalPartyMembers >= 5) nominationChance = 0.50;

            if (isCloseIdeology && incumbentCount < 3) {
                nominationChance -= 0.50;
            }

            if (Math.random() > Math.max(0.05, nominationChance)) {
                continue;
            }
        }

        // ==========================================
        // 🌟 2. 予備選（2〜4名に絞って出馬）
        // ==========================================
        const dynamicMaxCandidates = Math.floor(Math.random() * 9) + 2;

        const sortedMembers = [...partyMembers].sort((a, b) => {
            const aIsPres = (typeof president !== 'undefined' && president && president.id === a.id) ? 2 : 0;
            const bIsPres = (typeof president !== 'undefined' && president && president.id === b.id) ? 2 : 0;
            const aIncumbent = aIsPres || ((a.rep || a.sen) ? 1 : 0);
            const bIncumbent = bIsPres || ((b.rep || b.sen) ? 1 : 0);

            if (aIncumbent !== bIncumbent) return bIncumbent - aIncumbent;
            return (b.xp || 0) - (a.xp || 0);
        });

        // 🌟 過去の大統領のカムバック制限
        const currentTerm = (typeof pastPresidents !== 'undefined' && pastPresidents) ? pastPresidents.length : 0;
        const eligibleMembers = sortedMembers.filter(member => {
            const isCurrentPresident = (typeof president !== 'undefined' && president && president.id === member.id);
            if (isCurrentPresident) return true;

            if (typeof pastPresidents !== 'undefined' && pastPresidents) {
                const pastRecord = pastPresidents.filter(p => p.id === member.id);
                if (pastRecord.length > 0) {
                    const lastTermServed = Math.max(...pastRecord.map(p => p.term || 0));
                    if (lastTermServed < currentTerm - 1) {
                        return false;
                    }
                }
            }
            return true;
        });

        const partyCandidates = [];
        const skippedMemberIds = new Set();
        const candidateEvaluations = [];

        // 💡 74歳以下の元気な現職大統領がこの党内にいるかチェック
        const isPresLoopingInParty = eligibleMembers.some(m => {
            const isPres = typeof president !== 'undefined' && president && president.id === m.id;
            const presAge = Number(m.age) || 45;
            return isPres && presAge < 75;
        });

        for (const member of eligibleMembers) {
            const isCurrentPresident = (typeof president !== 'undefined' && president && president.id === member.id);
            const age = Number(member.age) || 45;
            const xp = Number(member.xp) || 0;

            // 🛑 【絶対ストッパー】憲法・年齢制限（35歳以下は即脱落、高齢すぎると辞退）
            let declineChance = 0.20;
            declineChance = age >= 80 ? 0.75 : (age >= 75 ? 0.55 : (age >= 70 ? 0.10 : 0.03));
            if (age <= 35) declineChance = 1.0;
            else if (isCurrentPresident) {
                declineChance += Math.max(0, (Number(member.nominee) || 0) - 2) * 0.45;
                declineChance = Math.min(1.0, declineChance);
            }

            // 本人の辞退判定
            if (Math.random() < declineChance) {
                continue; // 枠に関係なく、自分の意志で出馬しない
            }

            // 📊 【実力・野心スコアの計算】（ごみNPCを弾くための品定め）
            let entryScore = 15; // ベースの野心

            if (member.rep) entryScore += 25;       // 下院議員バフ
            if (member.sen) entryScore += 40;       // 上院議員バフ（より強力）
            if (isCurrentPresident) entryScore += 200; // 現職大統領は超強力
            entryScore += Math.floor(xp / 10);      // XP（経験値）が高ければ高いほど有利


            // スコアとメンバー情報をセットで記録
            candidateEvaluations.push({
                member: member,
                score: entryScore
            });
        }

        // 🔥 スコアが高い順（大物順）にソートする
        candidateEvaluations.sort((a, b) => b.score - a.score);

        // 👑 上位から順番に「確定枠」に入れていき、溢れた人を「撤退」にする
        candidateEvaluations.forEach((item, index) => {
            const member = item.member;
            if (president.vp === member.id) {
                const relation = getRelation(president.id, member.id);
                if (relation >= 60) return;
            }

            if (partyCandidates.length < dynamicMaxCandidates) {
                // 枠内：出馬確定！
                // 🛡️ 修正ポイント：すでに立候補を表明していない場合のみ、ログを追加してフラグを立てる
                if (!member.isIntentDeclared) {
                    member.isIntentDeclared = true;
                    // もし撤退フラグが残っていたらここで綺麗にリセット
                    member.iswithdrawn = false;

                    addhis(member, `${getPartyName(partyId)}大統領予備選挙への立候補を表明。`);
                }

                // 配列への追加は毎回確実に行う（重複を防ぐため、すでに入っていないかチェックするとなお安全です）
                if (!partyCandidates.includes(member)) {
                    partyCandidates.push(member);
                }

            } else if (count !== 1) {
                // 枠外：実力不足、または大物乱立による「枠溢れ撤退」

                // 🛡️ 修正ポイント：まだ「撤退フラグ（iswithdrawn）」が立っていない場合のみ処理する
                if (!member.iswithdrawn && (member.isIntentDeclared || item.score > 50)) {
                    if (typeof addhis === 'function') {
                        addhis(member, `${getPartyName(partyId)}大統領予備選挙から撤退を表明。`);
                    }
                    member.iswithdrawn = true; // ✋ ここで初めて綺麗に「撤退」が機能する！
                }

                // 出馬フラグは常に安全のために折っておく
                member.isIntentDeclared = false;
            }
        });


        // 🌟 最終安全処理（念のため確定枠に入れなかった人のフラグを完全に掃除）
        for (const m of eligibleMembers) {
            if (!partyCandidates.includes(m)) {
                m.isIntentDeclared = false;
            }
        }

        if (!partyCandidates.length) continue;
    }


}

async function processPrimary() {
    // 投票シミュレーター（思想一致度＋人間関係＋現職・実力＋勢い）
    const simulatePartyVote = (cands, members) => {
        const votes = Object.fromEntries(cands.map(c => [c.id, 0]));

        // 候補者の中で「最高XP」と「最低XP」を特定
        let highestXpCand = cands[0];
        let lowestXpCand = cands[0];
        cands.forEach(c => {
            if ((c.xp || 0) > (highestXpCand?.xp || 0)) highestXpCand = c;
            if ((c.xp || 0) < (lowestXpCand?.xp || 0)) lowestXpCand = c;
        });

        members.forEach(voter => {
            let best = null;
            let max = -Infinity;

            // 15%の確率で「反エリート・ポピュリスト（逆張りマン）」化
            const isPopulist = Math.random() < 0.15;
            cands.forEach(c => {
                const age = c.age || 50; // 年齢未設定なら50歳扱い
                // 1. XPの影響度（対数で緩やかに制限）
                const xpScore = Math.sqrt(c.xp || 0) * 2;

                // 2. 思想の一致度（最大30pt）
                const diffEcon = Math.abs((voter.econ || 0) - (c.econ || 0));
                const diffDiplo = Math.abs((voter.diplo || 0) - (c.diplo || 0));
                const diffNation = Math.abs((voter.nation || 0) - (c.nation || 0));
                const ideologyDiff = (diffEcon + diffDiplo + diffNation) / 3;
                const ideologyScore = Math.max(0, 30 - ideologyDiff * 0.5);

                // 3. 人間関係・好感度（最大25pt）
                const relVal = (voter.relations && voter.relations[c.id]) ? voter.relations[c.id] : 0;
                const relationScore = relVal * 0.25;
                // ----------------------------------------------------
                // 🌟 4. 現職大統領 / 元大統領 / 現職議員の地位バフ（リアル調整版）
                // ----------------------------------------------------
                let statusScore = 0;

                const isCurrentPres = (typeof president !== 'undefined' && president && president.id === c.id);
                const isFormerPres = !isCurrentPres && (typeof pastPresidents !== 'undefined' && pastPresidents && pastPresidents.some(p => p.id === c.id));

                if (isCurrentPres) {
                    // 💡 現職大統領：固定値を 80 -> 25 に大幅ダウン。
                    // 代わりに、大統領の「支持率（approval）」や「実力（power）」を乗せることで、
                    // 無能な現職なら引きずり下ろされ、名君なら盤石になるリアリズムを導入！
                    const currentApproval = Number(c.approval ?? 50); // 支持率（なければ50%想定）

                    // 支持率が高ければ最大+25pt、最悪なら0pt（固定25と合わせて計25〜50ptの変動制へ）
                    const approvalBonus = (currentApproval / 100) * 25;

                    statusScore = 25 + approvalBonus;

                    // 🔍 デバッグ用（必要に応じて残してください）
                    // console.log(`🏛️ 現職大統領 ${c.name} の地位バフ: ${statusScore.toFixed(1)}pt (支持率: ${currentApproval}%)`);

                } else if (isFormerPres) {
                    // 💡 元大統領：35 -> 15 に調整。過去の人なので、現職議員と同等かやや上の貫禄。
                    statusScore = 15;
                } else if (c.rep || c.sen) {
                    // 💡 現職議員：15 -> 6 に調整。
                    // 組織票や現職の強みとしては 6pt 程度（思想の良さで簡単に新人へ逆転を許すライン）が適正です。
                    statusScore = 6;
                }

                // 💡 【隠し味】もし候補者が有権者（voter）からめちゃくちゃ嫌われていたら（好感度マイナス）、地位バフを半減させる
                if (relVal < -40) {
                    statusScore = statusScore * 0.5;
                }

                // ----------------------------------------------------
                // 👴👵 5. 年齢バフ・デバフ（老害 vs 若手刷新）
                // ----------------------------------------------------
                let ageScore = 0;
                if (age < 45) {
                    // 若手・中堅手前：刷新感・エネルギー補正 (+5pt)
                    ageScore = 5;
                } else if (age <= 65) {
                    // 黄金期：円熟味・安定感 (+8pt)
                    ageScore = 8;
                } else if (age <= 75) {
                    // 高齢期：やや老化懸念 (-5pt)
                    ageScore = -5;
                } else {
                    // 76歳以上の超高齢：老害・健康不安・世論の嫌気デバフ
                    // 80歳で-20pt、85歳で-30pt と急激にペナルティが激しくなる
                    ageScore = -15 - (age - 75) * 2.0;
                }


                // 5. 選挙の「勢い・風」（ランダム要素：0〜35pt）
                const momentumScore = Math.random() * 35;

                // 総合スコア算出
                let score = xpScore + ideologyScore + relationScore + statusScore + ageScore + momentumScore;

                if (c.nominee > 2) {
                    // 3回目: 10 * 1 = -10pt
                    // 4回目: 15 * 2 = -30pt
                    // 5回目: 20 * 3 = -60pt （地位バフや運をすべて破壊してほぼ引退に追い込むレベル）
                    const excess = c.nominee - 2;
                    score -= (5 + excess * 5) * excess;
                }

                if (isPopulist) {
                    if (c.id === highestXpCand?.id) score -= 40;
                    if (c.id === lowestXpCand?.id) score += 30;
                    if (age >= 75) score -= 30;
                    score += Math.random() * 20;
                }

                // 自分自身には絶対投票する
                if (voter.id === c.id) score += 999;

                if (score > max) {
                    max = score;
                    best = c;
                }
            });
            if (best) votes[best.id]++;
        });
        return votes;
    };
    const liveNpcs = npcs.filter(cand => cand.isNPC && cand.isAlive !== false);

    const parties = [...new Set(liveNpcs.map(n => n.partyId).filter(Boolean))];
    const partyStats = {};
    parties.forEach(pId => {
        const members = liveNpcs.filter(n => n.partyId === pId);
        const seatCount = members.filter(n => n.rep || n.sen).length;
        // 党首（leader）を取得（いなければ最高XPの人）
        const leader = members.find(n => n.isLeader) || members.sort((a, b) => (b.xp || 0) - (a.xp || 0))[0];

        partyStats[pId] = {
            members: members,
            seatCount: seatCount,
            totalMembers: members.length,
            leader: leader
        };
    });

    // 一番議員数が多い「最大政党（与党枠）」を特定
    const dominantPartyId = Object.keys(partyStats).sort((a, b) => partyStats[b].seatCount - partyStats[a].seatCount)[0];

    const playerPartyId = (typeof player !== 'undefined' && player) ? player.partyId : null;

    // --- ここから各政党の処理 ---
    for (const partyId of parties) {
        const pname = typeof getPartyName === 'function' ? getPartyName(partyId) : partyId;

        if (partyId === "independents") continue;
        const partyMembers = partyStats[partyId].members;
        if (!partyMembers.length) continue;
        let firstRoundVotes = {}, winner = null;
        const partyCandidates = liveNpcs.filter(n =>
            n.partyId === partyId &&
            n.isIntentDeclared === true && // 出馬表明している
            n.iswithdrawn !== true        // 撤退していない
        );

        // --- 🗳️ 第1回投票 ---
        if (partyId === playerPartyId) {
            firstRoundVotes = await new Promise(resolve => {
                window.handlePrimaryVote = (id) => {
                    if (typeof closeModal === 'function') closeModal();
                    delete window.handlePrimaryVote;
                    const aiVotes = simulatePartyVote(partyCandidates, partyMembers);
                    const voteId = id !== 'random' && aiVotes[id] !== undefined ? id : partyCandidates[Math.floor(Math.random() * partyCandidates.length)].id;
                    aiVotes[voteId]++;
                    resolve(aiVotes);
                };

                let bodyHtml = `<p style="font-size:14px;color:#bbb;margin-bottom:15px;text-align:center;">我が党<b>【${pname}】</b>の公認予備選（1次）です。</p><div style="display:flex;flex-direction:column;gap:12px;margin-bottom:15px;">`;
                partyCandidates.forEach(c => {
                    bodyHtml += `<div style="background:#25252e;border:1px solid #3f3f4e;border-radius:6px;padding:12px;display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;gap:12px;"><img width=30 height=30 src="${c.icon || 'assets/images/default-avatar.png'}"><div><strong style="color:#fff;">${c.name}</strong><div style="font-size:12px;color:#a0aec0;margin-top:3px;">政治力(XP): ${c.xp || 0}</div></div></div><button onclick="window.handlePrimaryVote('${c.id}')" style="background:#1e88e5;color:#fff;border:none;border-radius:4px;padding:8px 16px;cursor:pointer;">投票</button></div>`;
                });
                pushNotificationTray(`${pname}・予備選挙`, `党員投票を行います`, { title: `🗳️ ${pname} 予備選（1次）`, body: bodyHtml + `</div>`, buttons: [] }, true);
            });
        } else {
            firstRoundVotes = simulatePartyVote(partyCandidates, partyMembers);
        }

        // --- 📊 結果発表 & 決選投票 ---
        const totalVotes = Object.values(firstRoundVotes).reduce((a, b) => a + b, 0);
        const sorted = Object.keys(firstRoundVotes)
            .map(id => ({
                id,
                votes: firstRoundVotes[id],
                cand: partyCandidates.find(c => c.id === id)
            }))
            .sort((a, b) => b.votes - a.votes);
        const top1 = sorted[0];


        // 1次票リストのHTMLを生成
        const firstRoundVotesHtml = sorted.map(s => {
            const pct = ((s.votes / totalVotes) * 100).toFixed(1);
            return `<div style="display:flex;justify-content:space-between;color:#000;margin-bottom:6px;"><span>${s.cand ? s.cand.name : '不明'}</span><span><b>${s.votes}票</b> (${pct}%)</span></div>`;
        }).join('');

        if (!window.primaryElectionArchive) {
            window.primaryElectionArchive = {};
        }
        window.primaryElectionArchive[partyId] = {
            partyName: pname,
            totalVotesFirstRound: totalVotes,
            firstRound: sorted.map(s => ({ id: s.id, name: s.cand ? s.cand.name : '不明', votes: s.votes })),
            hasRunoff: false, // デフォルトは決選投票なし
            runoff: null      // 決選投票データ用
        };

        sorted.forEach((item, index) => {
            const cand = item.cand;
            if (!cand) return;

            const rank = index + 1; // 1位, 2位, 3位...
            const pct = totalVotes > 0 ? ((item.votes / totalVotes) * 100).toFixed(1) : "0.0";
            const isRunoffOccurred = item.votes < totalVotes / 2;

            // 1位かつ過半数獲って勝利した場合
            if (rank === 1 && item.votes > totalVotes / 2) {
                addhis(cand, `${pname}大統領予備選挙で第1位（${item.votes}票 / ${pct}%）を獲得し、1回目投票で勝利。`);
            }
            // 1位だけど過半数未達（決選投票へ進む場合）
            else if (rank === 1) {
                addhis(cand, `${pname}大統領予備選挙の1回目投票で首位（${item.votes}票 / ${pct}%）を獲得。決選投票に進出。`);
            }
            else if (rank === 2) {
                if (isRunoffOccurred) {
                    // 1位が過半数に届かなかったので、2位も決選投票へ
                    addhis(cand, `${pname}大統領予備選挙の1回目投票で第2位（${item.votes}票 / ${pct}%）につけ、決選投票に進出。`);
                } else {
                    // 1位が過半数を獲得して即決したため、2位はここで敗退
                    addhis(cand, `${pname}大統領予備選挙の1回目投票で第2位（${item.votes}票 / ${pct}%）に終わる。`);
                }
            }

            // 3位以下（惜敗・惨敗）
            else {
                if (Number(pct) < 10.0) {
                    addhis(cand, `${pname}大統領予備選挙でわずか ${item.votes}票（${pct}%）に留まり、惨敗。`);
                } else {
                    addhis(cand, `${pname}大統領予備選挙の1回目投票で第${rank}位（${item.votes}票 / ${pct}%）に終わり落選。`);
                }
            }
        });

        if (top1 && top1.votes > totalVotes / 2) {
            winner = top1.cand;
            if (partyId === playerPartyId) {
                const bestVP = npcs.find(cand =>
                    winner.vpcand === cand.id
                );

                console.log(bestVP);

                // 🌟【修正】bestVP が存在する場合のみ name を取得し、なければ "(不在)" にする安全なフォールバック
                const vpName = bestVP?.name || "(不在)";

                // 修正点：1次選考で決着した際、全員の票数を表示
                const modalBody = `<b>${winner.name}</b> が過半数を獲得し公認決定！<br>副大統領候補には<b>${vpName}</b>が指名されました！<br /><hr style="border:0;border-top:1px solid #3f3f4e;margin:12px 0;"><div style="text-align:left;">${firstRoundVotesHtml}</div>`;

                await showModal("📢 予備選結果", modalBody, [{ text: "本戦へ進む", value: "ok", className: "scout-btn" }]);
            }

        } else {
            // 上位2名による最終決戦
            const runoffs = sorted.slice(0, 2).map(r => r.cand).filter(Boolean);
            if (runoffs.length === 2) {

                let rv = {};
                window.primaryElectionArchive[partyId].hasRunoff = true;

                if (partyId === playerPartyId) {
                    // 修正点：Promiseの戻り値を勝者と決選投票データ（rv）のオブジェクトに変更
                    const runoffResult = await new Promise(resolve => {
                        window.handleRunoffVote = (id) => {
                            if (typeof closeModal === 'function') closeModal();
                            delete window.handleRunoffVote;
                            const simRv = simulatePartyVote(runoffs, partyMembers);
                            if (simRv[id] !== undefined) simRv[id]++;

                            const winCand = simRv[runoffs[0].id] >= simRv[runoffs[1].id] ? runoffs[0] : runoffs[1];
                            resolve({ winner: winCand, votes: simRv });
                        };

                        let bodyHtml = `<p style="font-size:14px;color:#ffca28;margin-bottom:15px;text-align:center;font-weight:bold;">⚠️ 過半数未達のため決選投票を行います！</p><div style="display:flex;flex-direction:column;gap:12px;margin-bottom:15px;">`;
                        runoffs.forEach(c => {
                            bodyHtml += `<div style="background:#2b2b36;border:2px solid #1e88e5;border-radius:6px;padding:12px;display:flex;justify-content:space-between;align-items:center;"><div style="flex-line:1;display:flex;align-items:center;gap:12px;"><img width=30 height=30 src="${c.icon || 'assets/images/default-avatar.png'}"><div><strong style="color:#fff;">${c.name}</strong><div style="font-size:12px;color:#a0aec0;margin-top:3px;">1次票: ${firstRoundVotes[c.id] || 0}票</div></div></div><button onclick="window.handleRunoffVote('${c.id}')" style="background:#e53935;color:#fff;border:none;border-radius:4px;padding:8px 16px;font-weight:bold;cursor:pointer;">決選投票</button></div>`;
                        });
                        pushNotificationTray(`🔥 【決選投票】${pname}`, `最終決戦です`, { title: `⚡ ${pname} 最終決選`, body: bodyHtml + `</div>`, buttons: [] }, true);
                    });

                    winner = runoffResult.winner;
                    rv = runoffResult.votes;

                    // 修正点：決選投票の得票数を集計して表示
                    const rTotal = Object.values(rv).reduce((a, b) => a + b, 0);
                    const runoffVotesHtml = runoffs.map(c => {
                        const v = rv[c.id] || 0;
                        const pct = rTotal > 0 ? ((v / rTotal) * 100).toFixed(1) : "0.0";
                        return `<div style="display:flex;justify-content:space-between;color:#000;margin-bottom:6px;"><span>${c.name}</span><span><b>${v}票</b> (${pct}%)</span></div>`;
                    }).join('');

                    const modalBody = `激戦を制し、公式公認候補は <b>${winner.name}</b> に決定！<br><hr style="border:0;border-top:1px solid #3f3f4e;margin:12px 0;"><div style="text-align:left;"><small style="color:#aaa;">【決選投票結果】</small>${runoffVotesHtml}<br><small style="color:#aaa;">【参考：1次票結果】</small>${firstRoundVotesHtml}</div>`;

                    await showModal("📢 決選投票結果", modalBody, [{ text: "本戦へ進む", value: "ok", className: "scout-btn" }]);

                } else {
                    // CPU党の決選投票処理
                    rv = simulatePartyVote(runoffs, partyMembers);
                    winner = rv[runoffs[0].id] >= rv[runoffs[1].id] ? runoffs[0] : runoffs[1];
                }
                const rTotal = Object.values(rv).reduce((a, b) => a + b, 0);
                window.primaryElectionArchive[partyId].runoff = runoffs.map(c => ({
                    id: c.id,
                    name: c.name,
                    votes: rv[c.id] || 0,
                    pct: rTotal > 0 ? (((rv[c.id] || 0) / rTotal) * 100).toFixed(1) : "0.0"
                }));
                // 🌟 決選投票の結果を履歴（addhis）へ記録！
                const loser = runoffs.find(c => c.id !== winner.id);

                const winVotes = rv[winner.id] || 0;
                const winPct = rTotal > 0 ? ((winVotes / rTotal) * 100).toFixed(1) : "0.0";

                const isComeback = (sorted[0].cand && sorted[0].cand.id === winner.id) === false; // 1次2位からの逆転劇か？

                // 勝者の履歴
                if (isComeback) {
                    addhis(winner, `${pname}大統領予備選挙の決選投票で勝利（${winVotes}票 / ${winPct}%）党の指名を獲得。`);
                } else {
                    addhis(winner, `${pname}大統領予備選挙の決選投票で勝利（${winVotes}票 / ${winPct}%）党の指名を獲得。`);
                }

                // 敗者の履歴
                if (loser) {
                    const loseVotes = rv[loser.id] || 0;
                    const losePct = rTotal > 0 ? ((loseVotes / rTotal) * 100).toFixed(1) : "0.0";
                    addhis(loser, `${pname}大統領予備選挙の決選投票で惜敗（${loseVotes}票 / ${losePct}%）。`);
                }

            } else {
                winner = top1 ? top1.cand : null;
            }
        }
        // 👑 最終公認処理
        if (winner) {
            window.primaryElectionArchive[partyId].winnerId = winner.id;
            window.primaryElectionArchive[partyId].winnerName = winner.name;
            Object.assign(winner, {
                isOfficialNominee: true,
                isIntentDeclared: true,
                endorsedByParties: [partyId],
                isPresidentialCandidate: true
            });
            winner.xp += 50; // 勝利バフ
            if (!winner.nominee) {
                winner.nominee = 0;
            }
            winner.nominee += 1;

            // 🌟 最終指名獲得の栄誉ログを追加
            addhis(winner, `${pname}大統領候補として正式指名を獲得。`);
            if (vicepresident_mode) {
                // ====================================================
                // 🥈 副大統領候補（Vice President Candidate）の選出ロジック
                // ====================================================
                // ※候補者全員のリストが `allCandidates` などの配列で存在している前提です
                let bestVP = null;
                let maxVPScore = -Infinity;

                const relation2 = getRelation(winner.id, vicepresident.id);
                if (winner.partyId === vicepresident.partyId && winner.vp === vicepresident.id && relation2 >= 50) {
                    bestVP = vicepresident;
                } else {
                    // 1. 条件に合う候補者をフィルタリング
                    const vpPool = npcs.filter(cand => {
                        // 🛡️ 型のブレを安全にするため String() で統一して比較
                        const isSameParty = String(cand.partyId).trim() === String(partyId).trim();

                        // 🛡️ 自分自身は除外
                        const isNotWinner = cand.id !== winner.id;

                        // 🛡️ フラグが true、1、または文字列の "true" や "1" であるかを確認
                        const isPolitician = cand.rep === true || cand.rep == 1 || cand.rep === "true" ||
                            cand.sen === true || cand.sen == 1 || cand.sen === "true";

                        return isSameParty && isNotWinner && isPolitician;
                    });

                    // 🐛 原因を特定するためのデバッグ用ログ（必要に応じて仕込んでください）
                    console.log(`[VP選定ログ] 全NPC数: ${npcs.length}, フィルタ通過数: ${vpPool.length}`);

                    if (vpPool.length === 0) {
                        console.warn("条件に合う議員がいないため、同政党の一般NPCから副大統領を選出します。");
                        const fallbackPool = npcs.filter(cand =>
                            String(cand.partyId).trim() === String(partyId).trim() && cand.id !== winner.id
                        );
                        // fallbackPool を使って再処理、またはそのまま代入
                        vpPool.push(...fallbackPool);
                    }

                    vpPool.forEach(cand => {
                        let score = 0;

                        // ① 人間関係（getRelation）スコアの加算
                        // ※getRelation(winner) が数値を返す、または getRelation(cand, winner) などの仕様に合わせてください
                        const relation = typeof cand.getRelation === 'function' ? cand.getRelation(winner) : Number(cand.relationWithWinner || 0);
                        score += relation * 1.5; // 関係性の重要度を1.5倍に重み付け

                        // ② 思想の一致度（ideologyの近さ）スコアの加算 (最大 +30pt 〜 0pt)
                        if (Array.isArray(cand.ideology) && Array.isArray(winner.ideology)) {
                            let totalDiff = 0;
                            const dimensions = Math.min(cand.ideology.length, winner.ideology.length);
                            for (let i = 0; i < dimensions; i++) {
                                totalDiff += Math.abs(Number(cand.ideology[i] || 0) - Number(winner.ideology[i] || 0));
                            }
                            const avgDiff = dimensions > 0 ? totalDiff / dimensions : 0;
                            // 距離が近い（差が0）ほど高いスコアになるように計算
                            score += (30 - (avgDiff * 0.6));
                        }

                        // ③ 基礎実力（XP）も少し加味（お飾り副大統領にならないように）
                        score += Math.sqrt(Number(cand.xp || 0));

                        // 最高得点の候補をキープ
                        if (score > maxVPScore) {
                            maxVPScore = score;
                            bestVP = cand;
                        }
                    });
                }

                if (!bestVP) {
                    console.warn("条件に合う議員がいないため、同政党の一般NPCから副大統領を選出します。");
                    const fallbackPool = npcs.filter(cand =>
                        String(cand.partyId).trim() === String(partyId).trim() && cand.id !== winner.id
                    );
                    // fallbackPool を使って再処理、またはそのまま代入
                    vpPool.push(...fallbackPool);

                    bestVP = vpPool[0];
                }

                // 2. 副大統領候補の決定と公認処理
                if (bestVP) {
                    window.primaryElectionArchive[partyId].vicePresidentId = bestVP.id;
                    window.primaryElectionArchive[partyId].vicePresidentName = bestVP.name;
                    winner.vpcand = bestVP.id;

                    Object.assign(bestVP, {
                        isOfficialVPNominee: true,       // 副大統領公認フラグ
                        runningMateOf: winner.id         // 誰のランニングメイトかを記録
                    });

                    bestVP.xp += 20; // 副大統領候補に選ばれたことによる知名度・経験バフ

                    // 🌟 副大統領候補の栄誉ログを追加
                    addhis(bestVP, `${winner.name}大統領候補の副大統領候補に指名される。`);
                    addhis(winner, `副大統領候補に${bestVP.name}を指名。`);
                }
                // ====================================================
            }
        }
    }
}
/**
 * 予備選の2名からXPベースの確率で勝者を選ぶヘルパー関数
 */
function selectPrimaryWinnerByXp(candidates) {
    const xpA = Math.max(1, candidates[0].xp || 0);
    const xpB = Math.max(1, candidates[1].xp || 0);
    const totalXp = xpA + xpB;

    // XPが高い方が当選確率が上がるダイスロール
    return (Math.random() * totalXp < xpA) ? candidates[0] : candidates[1];
}

/**
 * プレイヤーに推薦する候補者を選ばせるUIを表示する
 * @param {Array} actualFinalCandidates - 出馬が確定している全候補者のリスト
 * @returns {Promise<string|null>} 選択された候補者のID、または誰も推薦しない場合はnull
 */
async function showPlayerEndorsementUI(actualFinalCandidates) {
    return new Promise((resolve) => {
        const modal = document.getElementById('endorsement-modal');
        const container = document.getElementById('candidate-list-container');
        const noEndorseBtn = document.getElementById('btn-no-endorsement');

        // コンテナを初期化
        container.innerHTML = '';

        // モーダルを表示
        modal.style.display = 'flex';

        // 候補者一人ひとりの選択用カードを生成
        actualFinalCandidates.forEach(cand => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: #333;
                border: 1px solid #555;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 10px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;

            // ホバー効果
            card.onmouseenter = () => { card.style.background = '#444'; card.style.borderColor = '#ffca28'; };
            card.onmouseleave = () => { card.style.background = '#333'; card.style.borderColor = '#555'; };

            // カードの内側（候補者情報）
            const partyName = cand.partyId ? getPartyName(cand.partyId) : ``
            // 資産がマイナス（借金）なら赤字にする演出
            const moneyText = cand.money < 0
                ? `<span style="color: #ff8a80;">借金:${cand.money.toLocaleString()}円</span>`
                : `資産:${cand.money.toLocaleString()}円`;

            card.innerHTML = `
                <div>
                    <strong style="font-size: 16px; color: #fff;">${cand.name}</strong> 
                    <span style="font-size: 12px; color: #aaa; margin-left: 5px;">${partyName}</span>
                    <div style="font-size: 12px; color: #bbb; margin-top: 4px;">
                        政治力(XP): ${cand.xp || 0} | ${moneyText}
                    </div>
                </div>
                <div style="font-size: 12px; background: #ffca28; color: #000; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                    推薦する
                </div>
            `;

            // クリックした時の処理
            card.onclick = () => {
                modal.style.display = 'none'; // モーダルを閉じる
                resolve(cand.id);             // 選んだ候補者のIDを返してPromiseを解決！
            };

            container.appendChild(card);
        });

        // 「誰も推薦しない」ボタンが押された時の処理
        noEndorseBtn.onclick = () => {
            modal.style.display = 'none'; // モーダルを閉じる
            resolve(null);                // nullを返してPromiseを解決！
        };
    });
}

// ⚔️ 【もし一騎打ちになったら？】を有権者（allVoters）と各種バフでリアル計算する関数
function simulateHeadToHead(cand1, cand2) {
    if (!cand1 || !cand2) return { ratio1: 50, ratio2: 50, votes1: 0, votes2: 0 };

    // 候補者ごとの総合威力スコア（バフ計算）を算出するヘルパー
    const getCandidateBuffedScore = (c) => {
        let score = c.forecastScore || c.xp || c.power || 1000;
        const pId = typeof getCleanPartyId === "function" ? getCleanPartyId(c.partyId) : c.partyId;

        // 👑 1. 現職大統領 / 過去大統領バフ
        const isPastPres = typeof pastpresident !== 'undefined' &&
            pastpresident.some(p => p.id === c.id || p.name?.includes(c.name));
        const isCurrentPres = isPastPres && pastpresident[pastpresident.length - 1]?.id === c.id;

        if (isCurrentPres) score *= 2.0;       // 現職は圧倒的強い
        else if (isPastPres) score *= 1.5;     // 元大統領も強力

        // 🏛️ 2. 2大政党（与党・最大野党）バフ
        const isRuling = typeof rulingparty !== "undefined" && rulingparty.includes(pId);
        const isOpposition = typeof largest_opoosition !== "undefined" && String(pId) === String(largest_opoosition);
        if (isRuling || isOpposition) {
            score *= 1.4;
        }

        // 👔 3. 党代表バフ
        if (c.isPartyLeader) score *= 1.3;

        return score;
    };

    const score1 = getCandidateBuffedScore(cand1);
    const score2 = getCandidateBuffedScore(cand2);

    let votes1 = 0;
    let votes2 = 0;

    // ─── 🗳️ Voter（有権者配列）が存在する場合は、全有権者で一斉投票 ───
    if (typeof allVoters !== "undefined" && Array.isArray(allVoters) && allVoters.length > 0) {
        const totalVoters = allVoters.length;

        for (let v = 0; v < totalVoters; v++) {
            const voter = allVoters[v];

            // 棄権チェック（投票率）
            const turnoutRate = voter.turnoutRate ?? 0.60;
            if (Math.random() > turnoutRate) continue;

            let votedFor = null;

            // 1. voter.thinkAndVote メソッドが定義されている場合
            if (typeof voter.thinkAndVote === "function") {
                const result = voter.thinkAndVote([cand1, cand2]);
                if (result && result.candidateId) {
                    votedFor = String(result.candidateId) === String(cand1.id) ? 1 : 2;
                }
            }

            // 2. thinkAndVoteで決まらなかった、または未定義の場合は思想近傍＋バフ評価
            if (!votedFor) {
                const voterIdeo = voter.ideology ?? voter.eco ?? 50;
                const c1Ideo = cand1.ideology ?? cand1.eco ?? 50;
                const c2Ideo = cand2.ideology ?? cand2.eco ?? 50;

                const diff1 = Math.abs(voterIdeo - c1Ideo);
                const diff2 = Math.abs(voterIdeo - c2Ideo);

                // 思想の近さ + バフ後スコアの対比で評価値を算出
                const appeal1 = (score1 / 100) - (diff1 * 1.5);
                const appeal2 = (score2 / 100) - (diff2 * 1.5);

                votedFor = appeal1 >= appeal2 ? 1 : 2;
            }

            // 票数の加算（votePowerを考慮）
            const votesToAdd = (voter.votePower && voter.votePower > 0) ? voter.votePower : 1;
            if (votedFor === 1) votes1 += votesToAdd;
            else if (votedFor === 2) votes2 += votesToAdd;
        }
    } else {
        // ─── ⚡ Voterデータが無い場合のフォールバック計算 ───
        votes1 = Math.round(score1);
        votes2 = Math.round(score2);
    }

    // パーセンテージ（比率）の計算
    const totalVotes = votes1 + votes2;
    if (totalVotes === 0) return { ratio1: 50, ratio2: 50, votes1: 0, votes2: 0 };

    const ratio1 = Math.round((votes1 / totalVotes) * 100);
    const ratio2 = 100 - ratio1;

    return { ratio1, ratio2, votes1, votes2 };
}

async function generateMediaPredictions(customVsLeftId = null, customVsRightId = null) {
    // 1. 生存中の全政治家を抽出
    const liveCands = [player, ...npcs].filter(cand => cand.isAlive !== false);

    // 2. 候補者ごとの「世論スコア（メディア注目度）」を計算
    const scoredCandidates = liveCands.map(cand => {
        let score = cand.xp || 0;

        // 🏆 過去大統領（pastpresident）補正
        const isPastPres = typeof pastpresident !== 'undefined' &&
            pastpresident.some(p => p.id === cand.id || p.name?.includes(cand.name));
        if (isPastPres) score += 5000;

        // 🏛️ 党代表補正
        if (cand.isPartyLeader) score += 1500;

        // 🎂 年齢補正
        const age = cand.age || 50;
        if (age >= 75) score *= 0.8;
        else if (age < 40) score *= 0.85;
        else if (age >= 50 && age <= 68) score *= 1.2;

        return { ...cand, forecastScore: Math.max(10, Math.floor(score)) };
    });

    // 上位5人をピックアップ
    const predictedCandidates = scoredCandidates
        .sort((a, b) => b.forecastScore - a.forecastScore)
        .slice(0, 5);

    // 3. 支持率（%）の滑らかな計算（極端な100% vs 0%の防止）
    // スコアの総和に対する割合ベースで基礎支持率を算出しつつ、有権者嗜好をマイルドに反映
    const top5TotalScore = predictedCandidates.reduce((acc, c) => acc + c.forecastScore, 1);

    predictedCandidates.forEach(cand => {
        // 各自のスコア比率をベースに、偏りすぎないパーセンテージを計算
        const baseRatio = (cand.forecastScore / top5TotalScore) * 100;
        cand.pollSupport = baseRatio.toFixed(1);
    });

    // グローバルに保存
    window.mediaPredictions = predictedCandidates;

    // --- 🎭 ニュース画面のビルド ---
    let htmlContent = `
        <p style="font-size: 13px; color: #bbb; margin-bottom: 12px; line-height: 1.4;">
            📺 <b>世論調査速報：</b>主要メディアと有権者パネルによる最新の次期大統領選・出馬期待度調査結果です。
        </p>
        
        <div style="background: #111; padding: 10px; border-radius: 6px; border: 1px solid #444; margin-bottom: 15px;">
    `;

    predictedCandidates.forEach((cand, index) => {
        const rankColor = index === 0 ? '#ffd700' : (index === 1 ? '#c0c0c0' : (index === 2 ? '#cd7f32' : '#fff'));
        const partyName = cand.partyId ? getPartyName(cand.partyId) : '無所属';
        const iconSrc = cand.icon || 'https://via.placeholder.com/40/333333/ffffff?text=？';

        const isPastPres = typeof pastpresident !== 'undefined' &&
            pastpresident.some(p => p.id === cand.id || p.name?.includes(cand.name));

        let titleBadge = '';
        if (isPastPres) {
            titleBadge = `<span style="background:#b71c1c; color:#fff; font-size:10px; padding:1px 4px; border-radius:3px; margin-left:4px;">元大統領</span>`;
        } else if (cand.isPartyLeader) {
            titleBadge = `<span style="background:#1565c0; color:#fff; font-size:10px; padding:1px 4px; border-radius:3px; margin-left:4px;">党代表</span>`;
        }

        let note = '';
        if (cand.age >= 75) note = `<span style="color:#ef5350; font-size:10px;">(健康不安説)</span>`;
        else if (cand.age < 40) note = `<span style="color:#4fc3f7; font-size:10px;">(期待の若手)</span>`;

        htmlContent += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #222;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: ${rankColor}; width: 20px; text-align: center;">${index + 1}</span>
                    <img src="${iconSrc}" style="width: 38px; height: 38px; border-radius: 50%; border: 1px solid #555; object-fit: cover;">
                    <div>
                        <div style="display:flex; align-items:center;">
                            <strong style="color: #fff; font-size: 14px;">${cand.name}</strong>
                            ${titleBadge}
                        </div>
                        <div style="font-size: 11px; color: #aaa; margin-top:2px;">
                            [${partyName}] ${cand.age ? cand.age + '歳' : ''} ${note}
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 15px; color: #ffca28; font-weight: bold;">
                        ${cand.pollSupport}%
                    </div>
                    <div style="font-size: 10px; color: #777;">期待度スコア: ${cand.forecastScore}</div>
                </div>
            </div>
        `;
    });

    htmlContent += `</div>`;
    // --- ⚔️ 【もし一騎打ちになったら？】（Voter全動員シミュレーション版） ---
    let cand1 = customVsLeftId ? liveCands.find(c => c.id === customVsLeftId || c.name === customVsLeftId) : predictedCandidates[0];
    let cand2 = customVsRightId ? liveCands.find(c => c.id === customVsRightId || c.name === customVsRightId) : predictedCandidates[1];

    if (!cand1) cand1 = predictedCandidates[0];
    if (!cand2) cand2 = predictedCandidates[1];

    // 🗳️ 有権者とバフによる一騎打ちシミュレーション実行
    const { ratio1, ratio2, votes1, votes2 } = simulateHeadToHead(cand1, cand2);

    htmlContent += `
        <div style="background: #1a1a24; border: 1px dashed #5c6bc0; padding: 12px; border-radius: 6px; text-align: center;">
            <div style="font-size: 12px; color: #9fa8da; font-weight: bold; margin-bottom: 4px;">
                🔥 注目対決「もし今、一騎打ちになったら？」
            </div>
            <div style="font-size: 10px; color: #777; margin-bottom: 8px;">
                (全有権者パネルによる世論調査シミュレーション)
            </div>
            
            <!-- 対戦カード表示 -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 13px; font-weight: bold; color: #fff;">
                <span style="color:#64b5f6;">${cand1.name} (${ratio1}%)</span>
                <span style="font-size:11px; color:#888;">VS</span>
                <span style="color:#e57373;">${cand2.name} (${ratio2}%)</span>
            </div>
            
            <!-- ゲージバー -->
            <div style="display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: #333; margin-bottom: 6px;">
                <div style="width: ${ratio1}%; background: #1e88e5; transition: width 0.5s;"></div>
                <div style="width: ${ratio2}%; background: #e53935; transition: width 0.5s;"></div>
            </div>

            <div style="font-size: 10px; color: #aaa; text-align: right; margin-bottom: 10px;">
                推定得票: ${votes1.toLocaleString()}票 vs ${votes2.toLocaleString()}票
            </div>

            <!-- 🔍 カスタム対戦フォーム -->
            <div style="background: #111; padding: 8px; border-radius: 4px; font-size: 11px; color: #aaa; text-align: left;">
                <div style="margin-bottom: 4px; font-weight: bold; color: #ddd;">⚙️ 仮想対決をシミュレート（プレイヤー名やNPC名）:</div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <input type="text" id="vs-cand1-input" placeholder="候補者1" value="${cand1.name}" style="width: 45%; background: #222; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 3px; font-size: 11px;">
                    <span style="color: #777;">vs</span>
                    <input type="text" id="vs-cand2-input" placeholder="候補者2" value="${cand2.name}" style="width: 45%; background: #222; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 3px; font-size: 11px;">
                </div>
                <button onclick="runCustomVsSimulation()" style="margin-top: 6px; width: 100%; background: #3949ab; color: #fff; border: none; padding: 5px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold;">
                    🔄 世論調査を全有権者で再計算
                </button>
            </div>
        </div>
    `;
    // モーダル表示
    await showModal(
        "📺 特番：世論調査と次期大統領選の展望",
        htmlContent,
        [{ text: "番組を閉じる", class: "scout-button", color: "#1e88e5" }],
        "https://images.unsplash.com/photo-1541872703-74c5e44368f9?q=80&w=400&auto=format&fit=crop"
    );
}

// 🔄 プレイヤーが入力した名前で一騎打ちを再実行する関数
function runCustomVsSimulation() {
    const name1 = document.getElementById('vs-cand1-input')?.value?.trim();
    const name2 = document.getElementById('vs-cand2-input')?.value?.trim();

    if (name1 && name2) {
        generateMediaPredictions(name1, name2);
    }
}

async function processPartyEndorsements() {
    // 出馬表明しているリスト
    const activeIntents = npcs.filter(c => c.isIntentDeclared);

    // プレイヤーが党首の政党がある前提（playerParty とします）
    if (playerParty && playerParty.leaderId === player.id) {
        // 自党の候補者がいない場合のみ相乗り
        const hasOwnCandidate = activeIntents.some(c => c.partyId === playerParty.id);

        if (!hasOwnCandidate && activeIntents.length > 0) {
            // buttons配列を動的に生成
            const buttons = activeIntents.map(cand => ({
                label: `${cand.name}を推薦`,
                value: cand.id,
                color: "#43a047"
            }));
            // 自主投票ボタン
            buttons.push({ label: "自主投票（推薦しない）", value: null, color: "#757575" });

            const chosenId = await showModal(
                "🤝 他党への推薦・相乗り",
                `我が党から出馬する候補がいません。<br>他陣営に相乗りして恩を売りますか？`,
                buttons
            );

            if (chosenId) {
                const target = activeIntents.find(c => c.id === chosenId);
                target.endorsedByParties.push(playerParty.id);
                console.log(`${target.name} を推薦しました！`);
            }
        }
    }
}

async function announcecandidate() {
    let finalAnnounced = [];
    let dropouts = [];

    // メディア予測されていた本命たち
    const predictions = window.mediaPredictions || [];

    // 🥷 奇襲（サプライズ立候補）：予測されていなかったXP中堅層からランダムに湧く
    const surpriseCandidates = npcs.filter(n => n.isNPC && n.isAlive !== false && !predictions.includes(n) && Math.random() < 0.05);

    const allChallengers = [...predictions, ...surpriseCandidates];

    // 全チャレンジャーの中で「一番XPが高い絶対王者」を探す
    const topDog = [...allChallengers].sort((a, b) => (b.xp || 0) - (a.xp || 0))[0];

    allChallengers.forEach(cand => {
        // 相手が強すぎる場合の「撤回」判定
        if (cand !== topDog && topDog.xp > (cand.xp || 0) * 2) {
            // 王者のXPが自分の2倍以上あると、ビビって撤回する確率が高い
            if (Math.random() * 100 < 60) {
                dropouts.push(cand.name);
                return; // ここで脱落
            }
        }

        // 撤回しなかった奴は正式表明
        cand.isIntentDeclared = true;
        finalAnnounced.push(cand);
    });

    // ニュース発表
    let newsText = `ついに立候補の表明が始まりました！<br><br>`;
    if (surpriseCandidates.length > 0) {
        newsText += `🔥 <b>奇襲出馬！</b> メディアの予測を裏切り、${surpriseCandidates.map(c => c.name).join(', ')} が電撃出馬！<br><br>`;
    }
    if (dropouts.length > 0) {
        newsText += `🏳️ <b>出馬見送り</b> ${dropouts.join(', ')} は勝ち目がないと悟り、出馬を見送りました。<br><br>`;
    }

    await showModal(
        "📺 立候補表明ラッシュ！",
        newsText,
        [{ label: "確認", value: "ok", color: "#e53935" }]
    );
}


async function runAndDisplayPresidentialElection() {
    // 無所属プレイヤーの立候補確認モーダル

    npcs.forEach(cand => {
        if (cand.isOfficialNominee && cand.isAlive !== false) {
            cand.isPresidentialCandidate = true;
        } else {
            cand.isPresidentialCandidate = false; // 予備選敗退者は本戦に出られない
        }
    });

    // 1. 出馬選考を実行
    const liveNpcs = npcs.filter(cand => cand.isNPC && cand.isAlive !== false);
    let finalCandidates = [player, ...liveNpcs].filter(cand => cand.isPresidentialCandidate === true);

    // 🚨【緊急安全対策】もし予備選を通過した候補者が誰もいなかった場合、クラッシュを防ぐために全生存NPCから上位2人を緊急出馬させる
    if (finalCandidates.length === 0) {
        console.warn("⚠️ 予備選通過者が0人のため、生存NPCから緊急で候補者を選出します。");
        const backupCandidates = [...liveNpcs].sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 2);
        backupCandidates.forEach(cand => {
            cand.isPresidentialCandidate = true;
        });
        finalCandidates = backupCandidates;
    }

    // 🚨【超緊急対策】それでも誰もいない（生存NPCが0）なら処理を中断する
    if (finalCandidates.length === 0) {
        console.error("❌ 生きているNPCが一人もいないため、選挙を実行できません。");
        return;
    }

    // 初期化
    finalCandidates.forEach(cand => { cand.currentVotes = 0; cand.isElected = false; });
    const candidateMap = {};
    finalCandidates.forEach(c => { candidateMap[c.id] = c; });

    // 2. 開票ハブデータの初期化
    const electionResult = { national: {}, pref: {}, city: {} };

    // 全候補者の基本ポテンシャルが高いトップ2の「政党」を2大政党とする
    const sortedByPower = [...finalCandidates].sort((a, b) => (b.power || 0) - (a.power || 0));

    // 1. 主要候補2人のIDを取得（事前計算）
    const electionTop2Ids = [...finalCandidates]
        .sort((a, b) => ((b.xp || 0) + (b.money || 0)) - ((a.xp || 0) + (a.money || 0)))
        .slice(0, 2)
        .map(c => c.id);

    const isPresidentRunning = president ? finalCandidates.some(c => c.id === president.id) : false;
    // 🗳️ 全候補者の初期化ループ（投票が始まる前に1回だけ実行する前提）
    finalCandidates.forEach(cand => {
        cand.isElected = false;

        // 💡 1票ではなく、ランダムで 1〜100票 の「初期の身内票・熱狂的支持」を確定させる
        const initialVotes = Math.floor(Math.random() * 1000) + 1;
        cand.currentVotes = initialVotes; // 0ではなく初期票を設定

        // 地域・全国の集計キーを作成
        const candPref = cand.pref || "カリフォルニア州";
        const candCity = cand.city || "サンノゼ";
        const cityKey = `${candPref}_${candCity}`;

        // 🏙️ 市区町村（City）の初期集計に反映
        if (!electionResult.city[cityKey]) electionResult.city[cityKey] = {};
        electionResult.city[cityKey][cand.id] = (electionResult.city[cityKey][cand.id] || 0) + initialVotes;

        // 🗺️ 都道府県/州（Pref）の初期集計に反映
        if (!electionResult.pref[candPref]) electionResult.pref[candPref] = {};
        electionResult.pref[candPref][cand.id] = (electionResult.pref[candPref][cand.id] || 0) + initialVotes;

        // 🌍 全国（National）の初期集計に反映（★ここがバラバラだったのを全て initialVotes に統一！）
        electionResult.national[cand.id] = (electionResult.national[cand.id] || 0) + initialVotes;
    });

    // =========================================================
    // 👑 【全有権者ループの完全に外側】で、今回の選挙の主役2人を1回だけ決める！
    // =========================================================
    let mainTop1Id = null;
    let mainTop2Id = null;

    if (typeof twoparty !== "undefined" && twoparty === true) {
        // 基礎実力（xpやpower）が最も高い上位2名を全国の主役として固定
        const globalRank = [...finalCandidates].sort((a, b) => {
            const powerA = a.xp || a.power || a.approval || a.level || 0;
            const powerB = b.xp || b.power || b.approval || b.level || 0;
            return powerB - powerA;
        });
        mainTop1Id = globalRank[0]?.id;
        mainTop2Id = globalRank[1]?.id;
    }

    // ── 💡 ここから有権者のループ ──
    for (let v = 0; v < allVoters.length; v++) {
        const voter = allVoters[v];

        const nationalNetApproval = (typeof presidentapproval !== "undefined" && presidentapproval?.national?.netApproval)
            ? presidentapproval.national.netApproval
            : 0;

        // ── 💡 修正点1: 各候補者の最終スコアを格納する配列 ──
        const candidateScores = [];

        finalCandidates.forEach(c => {
            const rawPower = c.xp || c.power || c.approval || c.level || 0;

            // 1. 基礎実力（大物と新人の差: 最大+15点程度）
            const candidateBase = 30 + (rawPower > 0 ? Math.log2(rawPower) * 1.5 : 0);

            // 2. 政党立ち位置判定
            const candidatePartyId = String(c.partyId || "").trim();
            const rulingStr = String(rulingparty || "").trim();
            const oppositionStr = String(largest_opoosition || "").trim();
            const presPartyStr = president ? String(president.partyId || "").trim() : "";

            const isRuling = (candidatePartyId !== "" && candidatePartyId !== "null") &&
                (candidatePartyId === rulingStr || candidatePartyId === presPartyStr || candidatePartyId === "party_01");

            const isOpposition = (candidatePartyId !== "" && candidatePartyId !== "null" && candidatePartyId !== "Independents") &&
                (candidatePartyId === oppositionStr || candidatePartyId === "party_02");

            const isMajor = isRuling || isOpposition;

            // 3. 政党ボーナス設定
            let partyStatusBonus = 0;
            if (isMajor) {
                partyStatusBonus = 4; // 二大政党の看板バフ
            } else if (rawPower >= 500) {
                partyStatusBonus = 1;
            } else {
                partyStatusBonus = -2;
            }

            // 4. 思想ボーナス（最大+10点）
            let ideologyBonus = 0;
            if (voter.ideology && c.ideology && Array.isArray(voter.ideology) && Array.isArray(c.ideology)) {
                let totalDiff = 0;
                const dimensions = Math.min(voter.ideology.length, c.ideology.length);
                for (let i = 0; i < dimensions; i++) {
                    totalDiff += Math.abs(voter.ideology[i] - c.ideology[i]);
                }
                const avgDiff = totalDiff / dimensions;
                ideologyBonus = 10 - (avgDiff * 0.2);
            }

            // 現職大統領バフ
            let incumbencyBonus = 0;
            const isPresident = president && (c.id === president.id || c.name === president.name);
            if (isPresident) {
                incumbencyBonus += 3;
            }

            // 📈 5. 世論調査の連動バフ
            let pollWindBonus = 0;
            if (isPresident || isRuling) {
                pollWindBonus = nationalNetApproval * 0.06;
            } else if (isOpposition) {
                pollWindBonus = -nationalNetApproval * 0.05;
            }

            // 5. 地元・支持政党バフ
            let localAndPartyBuff = 0;
            if (c.pref && voter.pref && c.pref === voter.pref) {
                localAndPartyBuff += 1.5;
                if (c.city && voter.city && c.city === voter.city) localAndPartyBuff += 2.5;
            }

            // 支持政党の一致
            const allSupportingParties = [c.partyId, ...(c.endorsedByParties || [])].filter(Boolean);
            if (allSupportingParties.includes(voter.favPartyId)) {
                localAndPartyBuff += 6;
            }

            // 🚫 多選ペナルティ
            let termLimitsPenalty = 0;
            const nomineeCount = Number(c.nominee) || 0;
            if (nomineeCount >= 2) {
                if (nomineeCount === 2) termLimitsPenalty = 15;
                else if (nomineeCount === 3) termLimitsPenalty = 40;
                else termLimitsPenalty = 80;
            }

            // 6. 有権者個人のブレ（ノイズ）
            const individualNoise = (Math.random() + Math.random() + Math.random() - 1.5) * 10;

            // 💡 スコア合算
            let score = candidateBase
                + partyStatusBonus
                + incumbencyBonus
                + pollWindBonus
                + ideologyBonus
                + localAndPartyBuff
                + individualNoise
                - termLimitsPenalty;

            // 候補者と算出したスコアを記録
            candidateScores.push({ candidate: c, score: score });
        });

        // ── 💡 修正点2: 二大政党（接戦）を生み出す確率抽選ロジック ──
        let totalWeight = 0;
        const candidatesWithWeights = candidateScores.map(cs => {
            const c = cs.candidate;
            let finalScore = cs.score;
            let forceMinWeight = null;

            // 👑 【現職補正】もし候補者が現職ならスコアに補正（アドバンテージ）を与える
            // （※現職フラグのプロパティ名が c.isIncumbent や c.isPresident 等の場合は適宜変更してください）
            if (c.isIncumbent || c.isPresident) {
                finalScore += 0.3; // 現職に底上げバフ（経済悪化時などのペナルティがあっても耐えられるように）
            }

            if (typeof twoparty !== "undefined" && twoparty === true) {

                if (c.id === mainTop1Id) {
                    finalScore = cs.score;
                    // 💡 1位が現職なら、さらに少し接戦にしつつも安定感を持たせる
                }
                else if (c.id === mainTop2Id) {
                    const top1Score = candidateScores.find(x => x.candidate.id === mainTop1Id)?.score || 0;

                    // 🌟 2位を引き上げるが、1位（現職など）を追い抜きにくく調整
                    // (-0.1 ではなく -0.3〜-0.5 くらい開けると「接戦だけど1位が勝つ確率が高い」状態を作れます)
                    finalScore = Math.max(cs.score, top1Score - 0.4);
                }
                else {
                    // =========================================================
                    // 💤 3位以下の「リアル格付け」処理
                    // =========================================================
                    const rawPower = c.xp || c.power || c.approval || c.level || 0;

                    if (rawPower >= 550) {
                        // 👑 【ロス・ペロー級】歴史を揺るがす超大物サードパーティ
                        // トップ2の1/5〜1/10程度のウェイトを確保し、得票率 5%〜15% 程度を狙う
                        forceMinWeight = 0.5;
                    } else if (rawPower >= 400) {
                        // 🌟 【ラルフ・ネーダー級】政権を脅かす有力なサードパーティ
                        // 得票率 1%〜4% 程度を獲得し、絶妙なキャスティングボートを握る
                        forceMinWeight = 0.1;
                    } else if (rawPower >= 150) {
                        // 🔍 【主要なリバタリアン党級】
                        // 得票率 0.5%〜1% 未満の、ちょっと名前が知られた候補
                        forceMinWeight = 0.02;
                    } else {
                        // 🧹 【完全なる有象無象（ゴミ）】
                        // 先ほどと同じ、得票率 0.1% 以下の泡沫たち
                        forceMinWeight = 0.003;
                    }
                }

            }

            // 💡 最終的なウェイト計算
            let weight = 0;
            if (forceMinWeight !== null) {
                weight = forceMinWeight; // 3位以下は超極小値で固定
            } else {
                weight = Math.max(0.1, Math.exp((finalScore - 40) / 30)); // トップ2は通常のガチ計算
            }

            totalWeight += weight;
            return { candidate: c, score: finalScore, weight: weight };
        });


        // 確率ベースで投票先を決定（以下、元のロジック通り...）
        let chosenCandidate = null;
        let maxScoreForAbstain = -Infinity;

        let roll = Math.random() * totalWeight;
        for (let i = 0; i < candidatesWithWeights.length; i++) {
            const cw = candidatesWithWeights[i];
            if (cw.score > maxScoreForAbstain) maxScoreForAbstain = cw.score;

            roll -= cw.weight;
            if (roll <= 0) {
                chosenCandidate = cw.candidate;
                break;
            }
        }

        // 棄権判定
        let abstainChance = 0.25;
        if (maxScoreForAbstain < 40) abstainChance += 0.35;
        if (isPresidentRunning && Math.random() < 0.15) abstainChance += 0.15;

        if (Math.random() < abstainChance || !chosenCandidate) {
            electionResult.abstain = (electionResult.abstain || 0) + 1;
            continue;
        }

        // 💡 投票先への票の加算処理
        const targetCandidate = chosenCandidate;
        const targetId = targetCandidate.id;
        const votesEarned = voter.votePower || 1;

        if (candidateMap[targetId]) {
            candidateMap[targetId].currentVotes += votesEarned;

            const cityKey = `${voter.pref}_${voter.city || "未所属"}`;
            if (!electionResult.city[cityKey]) electionResult.city[cityKey] = {};
            if (!electionResult.city[cityKey][targetId]) electionResult.city[cityKey][targetId] = 0;
            electionResult.city[cityKey][targetId] += votesEarned;

            if (!electionResult.pref[voter.pref]) electionResult.pref[voter.pref] = {};
            if (!electionResult.pref[voter.pref][targetId]) electionResult.pref[voter.pref][targetId] = 0;
            electionResult.pref[voter.pref][targetId] += votesEarned;

            electionResult.national[targetId] = (electionResult.national[targetId] || 0) + votesEarned;
        }
    }

    // 勝者判定
    // 💡 グローバルまたは状態管理オブジェクトに履歴保存用配列を用意しておく
    window.electionHistory = window.electionHistory || [];
    window.pastPresidents = window.pastPresidents || []; // 歴代大統領リスト
    let winner = null;
    const totalNationalVotes = Object.values(electionResult.national || {}).reduce((sum, v) => sum + v, 0);
    // ==========================================
    // 🗳️ 【選挙人制度 (senkyonin === true)】の処理
    // ==========================================
    const electoralVotes = {};
    let totalElectoralVotes = 0;

    // 🚨 【重要修正】勝者判定に使う変数を、ここで「必ず」ローカルで完全初期化する！
    let maxElectoral = -1;


    if (typeof senkyonin !== 'undefined' && senkyonin === true) {

        // 🔥 今回の立候補者全員の選挙人票を「確実に 0」で完全初期化
        Object.keys(candidateMap).forEach(id => {
            electoralVotes[String(id)] = 0;
        });

        // 🌟【最優先】まず最初にLocalStorageとcountryオブジェクトから地域マップを作る（順番を上に移動）
        const rawData = localStorage.getItem("poligame_data");
        const parsedData = rawData ? JSON.parse(rawData) : {};
        const countryKey = parsedData.countrySelect || "us";

        // グローバル変数の country が存在するか安全弁を入れて定義
        const globalCountry = (typeof country !== 'undefined') ? country : {};
        const currentCountryData = globalCountry[countryKey] || globalCountry["us"] || globalCountry["jp"];

        // 🚨 これを確実にループより前に定義する！
        const countryPrefMap = currentCountryData ? (currentCountryData.pref || {}) : {};

        // 💡 2. 各州/都道府県の集計（ここで上の countryPrefMap を安全に参照できるようになります）
        if (electionResult.pref) {
            Object.keys(electionResult.pref).forEach(prefName => {
                const prefVotes = electionResult.pref[prefName];
                let prefWinnerId = null;
                let maxPrefVotes = -1;

                Object.keys(prefVotes).forEach(candId => {
                    const votes = prefVotes[candId] || 0;
                    if (votes > maxPrefVotes && votes > 0) {
                        maxPrefVotes = votes;
                        prefWinnerId = String(candId);
                    }
                });
                if (prefWinnerId) {
                    const cleanKey = prefName.trim();
                    const prefData = countryPrefMap[prefName] || countryPrefMap[cleanKey];

                    if (prefData) {
                        let assignedVotes = 1;
                        if (prefData.electoralVotes) {
                            assignedVotes = prefData.electoralVotes;
                        } else if (prefData.pop) {
                            assignedVotes = Math.round(prefData.pop / 100) || 1;
                        }
                        electoralVotes[prefWinnerId] = (electoralVotes[prefWinnerId] || 0) + assignedVotes;
                        totalElectoralVotes += (assignedVotes + (assignedVotes < prefData.electoralVotes ? 1 : 0));
                    } else {
                        console.warn(`[選挙集計警告] 設定データに存在しない地域名をスキップしました: "${prefName}"`);
                    }
                }

            });
        }

        // 💡 4. 勝者判定
        Object.keys(electoralVotes).forEach(id => {
            const votes = electoralVotes[id] || 0;
            if (votes > maxElectoral && votes > 0) {
                maxElectoral = votes;
                winner = candidateMap[id] || candidateMap[Number(id)];
            }
        });

    } else {
        // ==========================================
        // 🗳️ 【通常の総得票数制度】
        // ==========================================
        let maxVotes = -1; // 🚨 ローカル変数として初期化
        if (electionResult.national) {
            Object.keys(electionResult.national).forEach(id => {
                const votes = electionResult.national[id] || 0;
                if (votes > maxVotes && votes > 0) {
                    maxVotes = votes;
                    winner = candidateMap[id] || candidateMap[Number(id)];
                }
            });
        }
    }

    // -------------------------------------------------------------
    // 各候補者の詳細データ作成（表示用）
    // -------------------------------------------------------------
    const voteDetails = [];
    // ─── 🛠️ 【完全対応】選挙人モードか一般票モードかを自動判定 ───
    // electoralVotes の中に1票でも入っている、かつ総選挙人票（totalElectoralVotes）が動いているかチェック
    const isElectoralMode = typeof totalElectoralVotes !== "undefined" && totalElectoralVotes > 0;

    let allCandidateIds;
    if (isElectoralMode) {
        // 🗳️ 大統領選（選挙人モード）：一般票と選挙人票のすべてのIDをガッチャンコする
        allCandidateIds = Array.from(new Set([
            ...Object.keys(electionResult.national || {}),
            ...Object.keys(electoralVotes || {})
        ]));
    } else {
        // 🏛️ 通常の総選挙（一般票モード）：立候補した候補者のIDだけでソリッドに回す
        allCandidateIds = Object.keys(electionResult.national || {});
    }

    // 💡 確定した安全なプールをベースに集計ループを回す
    allCandidateIds.forEach(id => {
        const cand = candidateMap[id];
        if (!cand) return;

        // 一般票
        const myVotes = electionResult.national[id] || 0;
        // 選挙人票（総選挙モードなら当然 0 になります）
        const myElectoral = isElectoralMode ? (electoralVotes[id] || 0) : 0;

        // 【安全弁】一般票も選挙人票も0票の候補者は完全に除外
        if (myVotes === 0 && myElectoral === 0) {
            return;
        }

        const votePercentage = totalNationalVotes > 0 ? (myVotes / totalNationalVotes) * 100 : 0;
        const candpartyname = getPartyName(cand.partyId)
        const ranking = Object.keys(electionResult.national)
            .sort((a, b) => electionResult.national[b] - electionResult.national[a]);
        const myRank = ranking.indexOf(cand.id) + 1;

        // 元の候補者オブジェクト（cand）にもデータを注入
        cand.electoralVotes = myElectoral;
        cand.votes = myVotes;
        cand.percentage = votePercentage;
        addhis(cand, `大統領選挙で${myVotes.toLocaleString()}票（${votePercentage.toFixed(2)}%）を獲得、${myRank}位。`);

        voteDetails.push({
            id: cand.id,
            name: cand.name,
            partyId: candpartyname,
            icon: cand.icon,
            votes: myVotes,
            percentage: votePercentage,
            electoralVotes: myElectoral,            // 総選挙モードなら綺麗に 0 になります
        });
        console.log(voteDetails);
        // 供託金・経験値処理
        if (votePercentage >= 10.0) {
            cand.money = (cand.money || 0) + 1000000;
            cand.depositReturned = true;
        } else {
            cand.depositReturned = false;
            if (cand.money < 0) cand.xp = Math.max(0, cand.xp - 20);
        }
    });

    if (winner.id !== president.id) {
        winner.termCount = 1;
    } else {
        winner.termCount += 1;
    }

    console.log(`👑 当選者: ${winner ? winner.name : 'なし'}`);

    // 💡 ソート順を選挙人制度かどうかで分岐
    const sortedCandidates = typeof senkyonin !== 'undefined' && senkyonin === true
        ? [...voteDetails].sort((a, b) => b.electoralVotes - a.electoralVotes)
        : [...voteDetails].sort((a, b) => b.votes - a.votes);

    // 💡 2. さらなる軽量化のため、もし前段で作った予備選のアーカイブ（グローバル）があればドッキングして、元の巨大なオブジェクト参照は完全消去
    let primaryData = null;
    if (window.primaryElectionArchive) {
        // 現在の予備選アーカイブを値としてディープコピーし、参照を破壊する
        primaryData = JSON.parse(JSON.stringify(window.primaryElectionArchive));
    }
    // 🗳️ 【新機能】今回の選挙データを履歴に記録
    const electionId = `ELEC-${Date.now()}`;
    window.electionHistory.push({
        id: electionId,
        year: gameDate.getFullYear(),
        totalVotes: totalNationalVotes,
        totalElectoralVotes: totalElectoralVotes, // 💡 総選挙人数も記録
        winner: winner ? { id: winner.id, name: winner.name, icon: winner.icon, partyId: winner.partyId } : null,
        candidates: sortedCandidates,
        primaries: primaryData
    });

    // ⏳ 【新機能】即時就任させず、「政権移行期間」フラグを立てる
    if (winner) {
        const nextPresident = npcs.find(n => winner.id === n.id);
        const bestVP = npcs.find(cand =>
            cand.partyId === nextPresident.partyId &&
            cand.runningMateOf === nextPresident.id
        );
        if (bestVP) {
            window.vicepresidentelect = bestVP;
            bestVP.xp += 25;
            if (vicepresidentelect.id !== vicepresident.id) {
                addhis(bestVP, `${nextPresident}が大統領選挙に勝利。次期副大統領（就任移行期間）となる。`);
            } else {
                addhis(bestVP, `${nextPresident}が大統領選挙に勝利。副大統領として再選される（${nextPresident.termCount}期目）。`);
            }
        }
        if (nextPresident) {
            // グローバルに次期大統領をキープ
            window.presidentElect = nextPresident;
            nextPresident.xp += 50

            window.daysUntilInauguration = 30;  // 就任式までの残り日数（カウントダウン用、-1は選挙期間外）
            if (nextPresident.id !== president.id) {
                addhis(nextPresident, `大統領選挙に勝利。次期大統領（就任移行期間）となる。`);
            } else {
                addhis(nextPresident, `大統領選挙に勝利。再選される（${nextPresident.termCount}期目）。`);
            }
        }
    }
    // 📺 選挙速報ボードを表示
    displayElectionUI(electionResult, finalCandidates, winner);

}

// 💡 移行期間が終了したタイミングで呼び出す関数
function completePresidentialTransition() {
    if (!presidentElect) return;

    // 1. 退任・再選の判定準備
    const oldPresident = (typeof president !== 'undefined' && president) ? president : null;
    const isReelected = (oldPresident && oldPresident.id === presidentElect.id);

    // 旧大統領との関係性変動（交代時のみ）
    if (oldPresident && !isReelected) {
        const pIdeology = (oldPresident.ideology && oldPresident.ideology[1]) ?? 50;
        const peIdeology = (presidentElect.ideology && presidentElect.ideology[1]) ?? 50;
        const ideologyDistance = Math.abs(pIdeology - peIdeology);

        let relationDelta = 0;
        if (ideologyDistance <= 20) {
            relationDelta = Math.round(30 - (ideologyDistance * 0.5));
        } else if (ideologyDistance >= 60) {
            relationDelta = Math.round(-((ideologyDistance - 60) * 0.75) - 5);
            if (relationDelta < -30) relationDelta = -30;
        } else {
            relationDelta = Math.round(5 - (ideologyDistance - 20) * 0.25);
        }

        changeRelation(oldPresident, presidentElect, relationDelta);

        const logType = relationDelta > 0 ? "🤝 接近" : relationDelta < 0 ? "⚡ 悪化" : "😐 維持";
        console.log(`[政権移行関係変動] ${oldPresident.name} ❌ ${presidentElect.name} (${logType}): 思想距離 ${ideologyDistance} / 関係変化量: ${relationDelta}`);
    }

    // =================================================================
    // 2. 旧大統領の退任履歴記録（交代時のみ）
    // =================================================================
    if (oldPresident && !isReelected) {
        addhis(oldPresident, `大統領を退任、${presidentElect.name}が新大統領へ就任。`);

        if (pastPresidents && pastPresidents.length > 0) {
            pastPresidents[pastPresidents.length - 1].endYear = gameDate.getFullYear();
        }
    }

    // =================================================================
    // 3. 新大統領のデータ確定 & 歴代リスト（pastPresidents）更新
    // =================================================================
    const nextLeader = presidentElect; // 次期大統領
    const outgoingLeader = isReelected ? null : oldPresident; // 退任大統領（再選ならnull）

    // 新大統領のステータス加算
    nextLeader.xp = (nextLeader.xp || 0) + 150;

    let currentTermNumber = 1;

    if (isReelected) {
        // 🌟再選時：新規pushせず、現在の代の情報を上書き更新する！
        currentTermNumber = pastPresidents.length;
        addhis(nextLeader, `就任式が開催、第${currentTermNumber}代大統領として続投。`);

        if (pastPresidents.length > 0) {
            const currentEntry = pastPresidents[pastPresidents.length - 1];

            // 1. 基本情報の更新（期数など）
            currentEntry.name = `${nextLeader.name}<br /><span style="font-size:11px; color:#718096; font-weight:normal;">(${nextLeader.termCount}期)</span>`;
            currentEntry.endYear = "現職";

            // 2. 【追加】政党が変わっていたら上書き
            const nextparty = getPartyName(nextLeader.partyId);
            if (currentEntry.partyId !== nextparty) {
                currentEntry.partyId = nextparty;
            }

            // 3. 【追加】副大統領が変わっていたら上書き＆履歴追加
            if (currentEntry.vicepresident !== vicepresidentelect.name) {
                addhis(nextLeader, `副大統領が${currentEntry.vicepresident}から${vicepresidentelect.name}に交代。`);
                currentEntry.vicepresident = vicepresidentelect.name;
            }
        }
    } else {
        // 🌟新任時：新しい代としてリストに追加する
        currentTermNumber = pastPresidents.length + 1;
        const nextparty = getPartyName(nextLeader.partyId);
        pastPresidents.push({
            term: currentTermNumber,
            id: nextLeader.id,
            name: nextLeader.name,
            icon: nextLeader.icon,
            partyId: nextparty,
            startYear: gameDate.getFullYear(),
            endYear: "現職",
            vicepresident: vicepresidentelect.name
        });
        addhis(nextLeader, `就任式が開催、第${currentTermNumber}代大統領に正式就任。`);
    }



    if (vicepresident.id !== vicepresidentelect.id && !isReelected) {
        // 1. 新しい大統領・副大統領のペアが誕生する場合
        nextLeader.vp = vicepresidentelect.id;
        vicepresidentelect.president = nextLeader.id;
        addhis(vicepresidentelect, `${nextLeader.name}の下、副大統領に就任。`);

        // 古い関係性の削除
        if (vicepresident) delete vicepresident.president;
        if (president) delete president.vp;

    } else if (isReelected && vicepresident.id !== vicepresidentelect.id) {
        // 2. 大統領は再選だが、副大統領だけが交代する場合
        nextLeader.vp = vicepresidentelect.id; // nextLeader（またはpresident）のvpを更新
        vicepresidentelect.president = nextLeader.id;
        addhis(vicepresidentelect, `${nextLeader.name}の下、副大統領に就任。`);

        // 古い副大統領の関係性を削除
        if (vicepresident) delete vicepresident.president;
    }

    // 正式にグローバル変数 president を更新！
    president = nextLeader;
    vicepresident = vicepresidentelect;
    changeRelation(vicepresident.id, president.id, 20);


    // =================================================================
    // 🏛️ 4. 議員（上院・下院）の出席・ボイコット判定 ＆ 関係性更新
    // =================================================================
    const attendingSenators = [];
    const attendingReps = [];
    const boycottingSenatorsCount = { count: 0 }; // 欠席数カウント用
    const boycottingRepsCount = { count: 0 };

    const leaderEco = (nextLeader.ideology && nextLeader.ideology[0]) ?? 50;
    const leaderGov = (nextLeader.ideology && nextLeader.ideology[1]) ?? 50;

    npcs.forEach(npc => {
        if (npc.id === nextLeader.id) return;

        if (npc.sen || npc.rep) {
            const npcEco = (npc.ideology && npc.ideology[0]) ?? 50;
            const npcGov = (npc.ideology && npc.ideology[1]) ?? 50;
            const avgDistance = (Math.abs(leaderEco - npcEco) + Math.abs(leaderGov - npcGov)) / 2;

            // 🔍 関係値の取得 (既存の getRelation 関数を使用)
            const currentRelation = typeof getRelation !== "undefined" ? getRelation(nextLeader, npc) : 0;

            // 🚨 【出席拒否判定】思想の乖離が凄まじい、または既存の関係が悪すぎる場合はボイコット！
            const isIdeologyEnemy = avgDistance >= 55;
            const isRelationHate = currentRelation <= -15;

            if (isIdeologyEnemy || isRelationHate) {
                // 欠席（ボイコット）処理。リストには入れずカウントだけ進める
                if (npc.sen) boycottingSenatorsCount.count++;
                if (npc.rep) boycottingRepsCount.count++;
                return;
            }

            // 出席確定
            if (npc.sen) attendingSenators.push(npc);
            if (npc.rep) attendingReps.push(npc);

            // 🤝 思想の近さに基づいた関係性アップデート（出席者のみ）
            let relationBonus = 0;
            if (avgDistance <= 15) {
                relationBonus = Math.round(35 - (avgDistance * 0.5));
            } else if (avgDistance >= 50) {
                relationBonus = Math.round(-((avgDistance - 50) * 0.5) - 5);
            } else {
                relationBonus = Math.round(10 - (avgDistance - 15) * 0.4);
            }

            if (npc.partyId === nextLeader.partyId) relationBonus += 5;

            changeRelation(nextLeader, npc, relationBonus);
        }
    });

    // =================================================================
    // 📜 5. 歴代大統領（pastPresidents）の出席・ボイコット判定
    // =================================================================
    // pastPresidents の各オブジェクトに、今回の出席ステータス（Attended / Boycotted）を動的に追加
    pastPresidents.forEach(p => {
        if (p.id === nextLeader.id || p.endYear === "現職") {
            p.statusText = `<span style="color: #48bb78; font-weight: bold;">主役</span>`;
            return;
        }

        // npcsリストから、過去の大統領の本人データを検索して思想や関係性をチェック
        const pNpc = npcs.find(n => n.id === p.id);
        if (pNpc) {
            const pEco = (pNpc.ideology && pNpc.ideology[0]) ?? 50;
            const pGov = (pNpc.ideology && pNpc.ideology[1]) ?? 50;
            const pDistance = (Math.abs(leaderEco - pEco) + Math.abs(leaderGov - pGov)) / 2;
            const pRelation = typeof getRelation !== "undefined" ? getRelation(nextLeader, pNpc) : 0;

            if (pDistance >= 55 || pRelation <= -15) {
                p.statusText = `<span style="color: #e53e3e; font-weight: bold;">❌ 不参加</span>`;
            } else {
                p.statusText = `<span style="color: #3182ce;">○ 出席</span>`;
            }
        } else {
            // NPCデータがロストしている場合はデフォルトで出席扱い
            p.statusText = `<span style="color: #718096;">○ 出席</span>`;
        }
    });

    // =================================================================
    // 4. 🎆 演出（エモい画面演出 & 複合パーティクル）
    // =================================================================
    // ① 画面が一瞬ふんわり暗転してから光るスポットライト効果
    const flash = document.createElement("div");
    flash.style.cssText = `
        position: fixed; inset: 0; pointer-events: none; z-index: 9998;
        background: radial-gradient(circle, rgba(236,201,75,0.2) 0%, rgba(10,10,25,0.8) 100%);
        opacity: 0; transition: opacity 0.8s ease-in-out;
    `;
    document.body.appendChild(flash);
    requestAnimationFrame(() => flash.style.opacity = "1");
    setTimeout(() => {
        flash.style.opacity = "0";
        setTimeout(() => flash.remove(), 1000);
    }, 1200);

    // ② 動的スタイル（ひらひら舞い落ちる＆上昇するアニメーション）を一度だけ注入
    if (!document.getElementById("emo-inauguration-style")) {
        const style = document.createElement("style");
        style.id = "emo-inauguration-style";
        style.innerHTML = `
            @keyframes fallAndSway {
                0% { transform: translateY(0) rotate(0deg) translateX(0); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 0.9; }
                100% { transform: translateY(105vh) rotate(720deg) translateX(50px); opacity: 0; }
            }
            @keyframes riseUp {
                0% { transform: translateY(0) scale(0.5); opacity: 0; }
                20% { opacity: 0.8; }
                80% { opacity: 0.6; }
                100% { transform: translateY(-80vh) scale(1.2); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // ③ 降ってくる紙吹雪 & 絵文字（70個に増量＋揺れ回転追加）
    const icons = ["✨", "🎉", "🎺", "🎶", "👑", "🌸", "⭐", "🕊️"];
    for (let i = 0; i < 70; i++) {
        setTimeout(() => {
            const p = document.createElement("div");
            const isEmoji = Math.random() > 0.3;
            p.innerText = isEmoji ? icons[Math.floor(Math.random() * icons.length)] : "✦";

            const duration = getRandomRange(3500, 6000) / 1000;
            const size = isEmoji ? getRandomRange(16, 28) : getRandomRange(8, 16);

            p.style.cssText = `
                position: fixed; top: -5vh; left: ${Math.random() * 100}vw;
                font-size: ${size}px; pointer-events: none; z-index: 9999;
                color: ${isEmoji ? '#fff' : '#ecc94b'};
                animation: fallAndSway ${duration}s ease-in-out forwards;
                filter: drop-shadow(0 0 6px rgba(236,201,75,0.6));
            `;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), duration * 1000);
        }, i * 50);
    }

    // ④ 下からふわっと昇る「新時代の光」（希望のスパークル 30個）
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const spark = document.createElement("div");
            const duration = getRandomRange(4000, 7000) / 1000;
            spark.style.cssText = `
                position: fixed; bottom: -2vh; left: ${Math.random() * 100}vw;
                width: ${getRandomRange(4, 8)}px; height: ${getRandomRange(4, 8)}px;
                background: #ecc94b; border-radius: 50%; pointer-events: none; z-index: 9999;
                box-shadow: 0 0 10px #ecc94b, 0 0 20px #fff;
                animation: riseUp ${duration}s ease-out forwards;
            `;
            document.body.appendChild(spark);
            setTimeout(() => spark.remove(), duration * 1000);
        }, i * 100);
    }
    // =================================================================
    // 5. 🏛️ 就任式モーダルHTMLの生成
    // =================================================================
    let inaugurationHTML = `
<div class="inauguration-card" style="padding: 20px; border-radius: 12px; border: 2px solid #000; box-shadow: 0 0 25px #000; color: #fff; background: #1a202c;">
    
    <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 12px; color: #a0aec0; letter-spacing: 2px; font-weight: bold;">NATIONAL INAUGURATION CEREMONY</div>
        <h2 style="margin: 5px 0 0 0; font-size: 22px; text-shadow: 0 0 10px rgba(255,255,255,0.2);">🏛️ 大統領就任式</h2>
    </div>
    
    <div style="display: flex; justify-content: space-around; align-items: center; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #4a5568;">
`;

    // 旧大統領（退任者）がいる場合のみ対峙表示
    if (outgoingLeader) {
        // 退任者の代数 ＝ 現在の代数 - 1
        const oldTermNumber = currentTermNumber - 1;
        inaugurationHTML += `
        <!-- 退任する旧大統領 -->
        <div style="text-align: center; opacity: 0.7;">
            <img src="${outgoingLeader.icon || ''}" width="65px" height="65px" style="border-radius: 50%; border: 2px solid #718096; filter: grayscale(50%); object-fit: cover;">
            <div style="font-size: 11px; color: #a0aec0; margin-top: 4px;">第${oldTermNumber}代大統領（退任）</div>
            <div style="font-size: 13px; font-weight: bold; color: #cbd5e0;">${outgoingLeader.name}</div>
        </div>

        <div style="font-size: 24px; color: #ecc94b; animation: voterBlink 1.5s infinite;">🤝</div>
    `;
    }

    // === 🏛️ 議会出席者（上院・下院）セクション ===
    let assemblyHtml = `
    <!-- 上院議員リスト -->
    <div style="margin-top: 10px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <strong style="color: #4a5568;">上院出席: ${attendingSenators.length}名</strong>
            ${boycottingSenatorsCount > 0 ? `<span style="color: #e53e3e; font-weight: bold; font-size: 11px;">⚠️ 対立ボイコット: \${boycottingSenatorsCount}名</span>` : ""}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; max-height: 80px; overflow-y: auto; padding: 4px;">
            ${attendingSenators.map(r => `<span style="font-size: 11px; background: #ebf8ff; color: #2b6cb0; padding: 2px 8px; border-radius: 12px; border: 1px solid #bee3f8;">${r.name}</span>`).join("") || '<span style="color:#a0aec0; font-size:11px;">出席者なし</span>'}
        </div>
    </div>

    <!-- 下院議員リスト -->
    <div style="margin-top: 10px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <strong style="color: #4a5568;">下院出席: ${attendingReps.length}名</strong>
            ${boycottingRepsCount > 0 ? `<span style="color: #e53e3e; font-weight: bold; font-size: 11px;">⚠️ 対立ボイコット: \${boycottingRepsCount}名</span>` : ""}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; max-height: 100px; overflow-y: auto; padding: 4px;">
            ${attendingReps.map(r => `<span style="font-size: 11px; background: #f7fafc; color: #4a5568; padding: 2px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">${r.name}</span>`).join("") || '<span style="color:#a0aec0; font-size:11px;">出席者なし</span>'}
        </div>
    </div>
    `;

    inaugurationHTML += `
        <!-- 新しく就任する（または続投する）大統領 -->
        <div style="text-align: center;">
            <img src="${nextLeader.icon || ''}" width="75px" height="75px" style="border-radius: 50%; border: 3px solid #ecc94b; box-shadow: 0 0 15px rgba(236, 201, 75, 0.5); object-fit: cover;">
            <div style="font-size: 11px; color: #ecc94b; margin-top: 4px; font-weight: bold;">第${currentTermNumber}代大統領 👑</div>
            <div style="font-size: 15px; font-weight: bold; color: #fff;">${nextLeader.name}</div>
        </div>
    </div>

    <div style="background: #1a202c; padding: 15px; border-radius: 6px; border-left: 4px solid #ecc94b; font-size: 13px; line-height: 1.7; margin-bottom: 10px;">
        <span style="color: #ecc94b; font-weight: bold; display: block; margin-bottom: 6px;">🎙️ ${isReelected ? '大統領・再選決意表明' : '新大統領・宣誓演説'} :</span>
        <p style="margin: 0; font-style: italic; color: #e2e8f0;">
            「私はここに、憲法を遵守し、国民の信託に応え、国家の繁栄と平和のために我が身を捧げることを厳粛に誓います。
            ${isReelected ? '再び国民の皆様から託された責任の重さを胸に、さらなる発展を目指して全力を尽くします！' : '激しい選挙戦は終わりました。これからは対立を乗り越え、ひとつの国家として共に未来へ歩みを進めましょう！'}」
        </p>
    </div>

    <div style="text-align: center; font-size: 12px; color: #48bb78; margin-top: 15px; background: rgba(72, 187, 120, 0.1); padding: 6px; border-radius: 4px;">
        🎶 音楽隊による国歌演奏が行われ、会場は拍手に包まれました。
    </div>
    ${assemblyHtml}
</div>
`;

    // 6. モーダル呼び出し & 後処理
    if (typeof showModal === "function") {
        showModal("✨ 新大統領就任式セレモニー ✨", inaugurationHTML, [
            {
                text: isReelected ? "続投へ 🏛️" : "新時代の幕開けへ 🏛️",
                className: "scout-btn",
                keepOpen: false
            }
        ]);
    } else {
        alert(`🏛️ 【大統領就任式】${nextLeader.name} が正式に大統領に就任しました！`);
    }

    // 次期大統領変数の初期化
    presidentElect = null;
    if (typeof updateStatusUI === "function") updateStatusUI();
}


window.showWikiArchiveUI = () => {

    // 全体をスクロール可能なコンテナで包む
    let html = `
        <div style = "max-height: 500px; overflow-y: auto; border: 1px solid #a2a9b1; border-radius: 2px; padding-right: 4px; box-sizing: border-box;" >
            <div style="background:#fff; color:#000; padding:15px; font-family:sans-serif; text-align:left;">
                <h2 style="border-bottom:1px solid #a2a9b1; font-family:'Georgia',serif; font-size:24px; padding-bottom:5px; margin-top:0;">歴代大統領</h2>
                <p style="font-size:12px; color:#54595d;">出典: 百科事典『ウィキペディア（Wikipedia）』</p>

                <!-- 📄 目次ナビ -->
                <div style="background:#f8f9fa; border:1px solid #a2a9b1; padding:10px; display:inline-block; margin-bottom:15px; font-size:13px;">
                    <b style="display:block; text-align:center; margin-bottom:5px;">目次</b>
                    <a href="#presidents" style="color:#0645ad; text-decoration:none; display:block;">1. 歴代大統領一覧</a>
                                        <a href="#presidents" style="color:#0645ad; text-decoration:none; display:block;">2. 存命中の元大統領一覧</a>
                    <a href="#elections" style="color:#0645ad; text-decoration:none; display:block; margin-top:3px;">3. 過去の選挙記録</a>
                </div>

                <!-- 🏛️ 1. 歴代大統領セクション -->
                <h3 id="presidents" style="border-bottom:1px solid #a2a9b1; font-size:18px; margin-top:20px;">1. 歴代大統領一覧</h3>
                <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px;">
                    <thead>
                        <tr style="background:#eaecf0; border:1px solid #a2a9b1;">
                            <th style="padding:6px; border:1px solid #a2a9b1; width:50px;">代</th>
                            <th style="padding:6px; border:1px solid #a2a9b1; width:60px;">肖像</th>
                            <th style="padding:6px; border:1px solid #a2a9b1;">氏名</th>
                            <th style="padding:6px; border:1px solid #a2a9b1;">所属政党</th>
                                        ${vicepresident_mode ? `<th style="padding:6px; border:1px solid #a2a9b1;">副大統領</th>` : ''}
                            <th style="padding:6px; border:1px solid #a2a9b1;">在任期間</th>
                        </tr>
                    </thead>
                    <tbody>
                        `;
    // 1. まず同じ代（term）ごとにデータをグループ化する
    const groupedPresidents = [];
    window.pastPresidents.forEach(p => {
        // すでに同じtermのグループがあればそこに追加、なければ新しく作る
        let group = groupedPresidents.find(g => g.term === p.term);
        if (!group) {
            group = {
                term: p.term,
                id: p.id,
                name: p.name,
                icon: p.icon,
                history: [] // 政党や副大統領の変化の歴史を入れる
            };
            groupedPresidents.push(group);
        }
        group.history.push({
            partyId: p.partyId,
            vicepresident: p.vicepresident,
            startYear: p.startYear,
            endYear: p.endYear
        });
    });

    // 3. データ行の生成
    if (groupedPresidents.length === 0) {
        const colspanCount = vicepresident_mode ? 6 : 5;
        html += `<tr><td colspan="${colspanCount}" style="padding:10px; text-align:center; color:#54595d;">記録された歴史はありません。</td></tr>`;
    } else {
        groupedPresidents.forEach(group => {
            const rowSpan = group.history.length; // 縦結合する数

            group.history.forEach((hist, index) => {
                const start = Number(hist.startYear) || 0;
                const currentYear = gameDate.getFullYear();
                const end = Number(hist.endYear) || currentYear;
                const during = end - start;
                const duringText = !isNaN(during) && during > 0 ? `${during}` : '不明';

                html += `<tr style="border:1px solid #a2a9b1;">`;

                // 最初の一行目だけ大統領の共通情報を結合（rowspan）して表示
                if (index === 0) {
                    html += `
                    <td rowspan="${rowSpan}" style="padding:6px; text-align:center; font-weight:bold; border:1px solid #a2a9b1; background-color:#fff;">${group.term}</td>
                    <td rowspan="${rowSpan}" style="padding:4px; text-align:center; border:1px solid #a2a9b1; background-color:#fff;"><img src="${group.icon || 'assets/images/default-avatar.png'}" style="width:35px; height:45px; object-fit:cover; border:1px solid #ccc;"></td>
                    <td rowspan="${rowSpan}" style="padding:6px; color:#0645ad; font-weight:bold; border:1px solid #a2a9b1; background-color:#fff;">${group.name}</td>
                `;
                }

                // 変化する情報（政党・副大統領・期間）は毎回出力
                html += `
                <td style="padding:6px; border:1px solid #a2a9b1;">${hist.partyId}</td>
            `;

                // 副大統領モードが有効なら副大統領列を出力
                if (vicepresident_mode) {
                    html += `
                    <td style="padding:6px; border:1px solid #a2a9b1;">${hist.vicepresident || 'なし'}</td>
                `;
                }

                // 期間の出力
                html += `
                <td style="padding:6px; border:1px solid #a2a9b1;">${hist.startYear}年 - ${hist.endYear}${hist.endYear === '現職' ? '' : '年'}<br />(${duringText}年)</td>
            </tr>`;
            });
        });
    }
    html += `
                        </tbody>
                </table>
        <h3 id="presidents" style="border-bottom:1px solid #a2a9b1; font-size:18px; margin-top:20px;">存命中の元大統領一覧</h3>
        <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px;">
            <thead>
                <tr style="background:#eaecf0; border:1px solid #a2a9b1;">
                    <th style="padding:6px; border:1px solid #a2a9b1; width:40px;">代</th>
                    <th style="padding:6px; border:1px solid #a2a9b1; width:60px;">肖像</th>
                    <th style="padding:6px; border:1px solid #a2a9b1;">氏名</th>
                    <th style="padding:6px; border:1px solid #a2a9b1;">現在の所属政党</th>
                    <th style="padding:6px; border:1px solid #a2a9b1;">大統領在任期間</th>
                </tr>
            </thead>
            <tbody>
                `;

    // 💡 存命中の元大統領（現職ではなく、かつ現在もNPCとして生きている人）をあらかじめ抽出
    const livingExPresidents = window.pastPresidents.filter(p => {
        // ① まず「現職」は除外する（元大統領じゃないので）
        if (p.endYear === "現職") return false;

        // ② 現在もnpcsの中に存在している（＝存命である）かをチェック
        const isAlive = npcs.some(npc => npc && npc.id === p.id);
        return isAlive;
    });

    // 歴代大統領の行を生成
    if (livingExPresidents.length === 0) {
        html += `<tr><td colspan="5" style="padding:10px; text-align:center; color:#54595d;">存命中の元大統領はいません。</td></tr>`;
    } else {
        livingExPresidents.forEach(p => {
            const start = Number(p.startYear) || 0;
            const end = Number(p.endYear) || gameDate.getFullYear();

            // 在任期間（年数）
            const during = end - start;
            const duringText = during > 0 ? `${during}` : '1年未満';

            // 💡 【安全設計】NPCのデータを取得（絶対クラッシュしないフォールバック付き）
            const people = npcs.find(npc => npc && p.id === npc.id);

            // もし政党が変わっていたら今の政党名を取得し、データが壊れていたら歴史データのpartyIdを使う
            let peoparty = "無所属";
            if (people && typeof getPartyName === 'function') {
                peoparty = getPartyName(people.partyId);
            } else if (p.partyId) {
                peoparty = p.partyId; // フォールバック
            }

            html += `
            <tr style="border:1px solid #a2a9b1; background: #fff;">
                <td style="padding:6px; text-align:center; font-weight:bold; border:1px solid #a2a9b1;">${p.term}</td>
                <td style="padding:4px; text-align:center; border:1px solid #a2a9b1;">
                    <img src="${p.icon || 'assets/images/default-avatar.png'}" style="width:35px; height:45px; object-fit:cover; border:1px solid #ccc; border-radius:2px;">
                </td>
                <td style="padding:6px; color:#0645ad; font-weight:bold; border:1px solid #a2a9b1;">${p.name}</td>
                <td style="padding:6px; border:1px solid #a2a9b1;"><span style="background: #f1f3f5; padding: 2px 6px; border-radius: 4px;">${peoparty}</span></td>
                <td style="padding:6px; border:1px solid #a2a9b1;">${p.startYear}年 - ${p.endYear}年<br /><span style="font-size:11px; color:#54595d;">(計 ${duringText} 年間)</span></td>
            </tr>`;
        });
    }


    html += `
                    </tbody>
                </table>

                <!-- 🗳️ 2. 過去の選挙記録セクション -->
                <h3 id="elections" style="border-bottom:1px solid #a2a9b1; font-size:18px; margin-top:20px;">3. 過去の選挙記録</h3>

                <div style="margin: 15px 0; padding: 10px; background: #f8f9fa; border: 1px solid #a2a9b1; border-radius: 2px; display: flex; gap: 10px; align-items: center;">
                    <label for="wiki-search" style="font-size: 13px; font-weight: bold;">🔍 アーカイブ検索:</label>
                    <input type="text" id="wiki-search" placeholder="年、候補者名、党派で検索..."
                        style="flex: 1; padding: 5px 8px; font-size: 13px; border: 1px solid #a2a9b1; border-radius: 2px;"
                        oninput="filterElectionHistory(this.value)">
                </div>

                <!-- 📦 履歴が流し込まれるコン政エリア -->
                <div id="election-history-list">
                    `;

    html += generateHistoryListHtml(window.electionHistory || []);

    html += `
                </div>
            </div>
    `;

    showModal(
        "歴代大統領",
        html,
        [{ text: "閉じる", className: "geo-box" }]
    );
};

function generateHistoryListHtml(historyArray) {
    if (historyArray.length === 0) {
        return `<p style="font-size:13px; color:#54595d; padding: 10px;">過去の選挙データはありません。</p>`;
    }

    let listHtml = "";

    const escapeHtml = (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    };

    historyArray.forEach(eh => {
        listHtml += `
        <details class="election-block" data-year="${eh.year}"
            style="border:1px solid #a2a9b1; background:#f8f9fa; margin-bottom:10px; border-radius:2px; padding: 4px;">
            <summary style="font-weight:bold; font-size:14px; color:#202122; padding:6px; cursor:pointer; user-select:none; display: flex; align-items: center; gap: 5px;">
                📊 ${eh.year}年大統領選挙（総投票数: ${eh.totalVotes.toLocaleString()}票）
                <span style="font-size: 11px; color:#72774d; font-weight: normal; margin-left: auto;">[クリックで展開]</span>
            </summary>
            
            <div style="background:#fff; padding:10px; border-top: 1px solid #a2a9b1; margin-top: 4px;">
                <!-- 📜 本選リザルト -->
                <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #202122;">🏁 大統領選・本選結果</h4>
                <table style="width:100%; border-collapse:collapse; font-size:12px; background:#fff; margin-bottom: 15px;">
                    <tr style="background:#eaecf0;">
                        <th style="padding:4px; border:1px solid #a2a9b1; text-align:left;">候補者</th>
                        <th style="padding:4px; border:1px solid #a2a9b1; text-align:left;">党派</th>
                        ${typeof senkyonin !== 'undefined' && senkyonin ? `<th style="padding:4px; border:1px solid #a2a9b1; text-align:left;">獲得<br />選挙人</th>` : ``}
                        <th style="padding:4px; border:1px solid #a2a9b1; text-align:right;">得票数</th>
                        <th style="padding:4px; border:1px solid #a2a9b1; text-align:right;">得票率</th>
                    </tr>
        `;

        const tableRowsHtml = eh.candidates
            .map(c => {
                const isWinner = eh.winner && eh.winner.id === c.id;
                const safeName = escapeHtml(c.name);
                const safeParty = escapeHtml(c.partyId);
                const electoralcount = c.electoralVotes ? escapeHtml(c.electoralVotes) : '0';

                // 現職判定（もしデータ軽量化時に c.isIncumbent などを持たせていれば反映可能）
                const ifincumbent = (typeof president !== 'undefined' && president && president.id === c.id) ? '<br />(現職)' : '';
                const rowStyle = isWinner ? 'background:#eaf2fa; font-weight:bold;' : '';
                const winnerMarker = isWinner ? '👑 ' : '';
                const formattedVotes = (c.votes || 0).toLocaleString();

                // percentage または pct どちらでも動くようにセーフティガード
                const rawPercent = c.percentage !== undefined ? c.percentage : (parseFloat(c.pct) || 0);
                const formattedPercent = rawPercent.toFixed(1);

                return `
                  <tr style="${rowStyle}" class="candidate-row" data-search="${safeName} ${safeParty}">
                    <td style="padding:4px; border:1px solid #a2a9b1;">${winnerMarker}${safeName}${ifincumbent}</td>
                    <td style="padding:4px; border:1px solid #a2a9b1; color:#54595d;">${safeParty}</td>
                    ${typeof senkyonin !== 'undefined' && senkyonin ? `<td style="padding:4px; border:1px solid #a2a9b1; color:#54595d;">${electoralcount}</td>` : ``}
                    <td style="padding:4px; border:1px solid #a2a9b1; text-align:right; font-family:monospace;">${formattedVotes}</td>
                    <td style="padding:4px; border:1px solid #a2a9b1; text-align:right; font-family:monospace;">${formattedPercent}%</td>
                  </tr>
                `;
            })
            .join('');

        listHtml += tableRowsHtml;
        listHtml += `</table>`;

        // ====================================================
        // 🌟 【新機能】各党の予備選（Primary）データを流し込む
        // ====================================================
        if (eh.primaries && Object.keys(eh.primaries).length > 0) {
            listHtml += `
                <details style="border: 1px dashed #a2a9b1; border-radius: 2px; padding: 4px; background: #fdfdfd;">
                    <summary style="font-size: 11px; color: #1e88e5; cursor: pointer; font-weight: bold; user-select: none; padding: 4px;">
                        🗳️ 同年の各党・党内予備選挙のリザルトを表示
                    </summary>
                    <div style="padding: 8px 4px 4px 4px; display: flex; flex-direction: column; gap: 10px;">
            `;

            // 各政党（保守党、労働党など）ごとの結果を展開
            Object.keys(eh.primaries).forEach(pId => {
                const pData = eh.primaries[pId];
                const safePartyName = escapeHtml(pData.partyName || pId);

                listHtml += `
                    <div style="border-left: 3px solid #72774d; padding-left: 8px; font-size: 11px;">
                        <strong style="color: #202122;">【${safePartyName}】公認指名争い</strong> 
                        <span style="color: #72774d;">(総投票数: ${(pData.totalVotesFirstRound || 0).toLocaleString()}票)</span>
                        
                        <!-- 1次投票結果 -->
                        <div style="margin-top: 4px; color: #54595d;">
                            <small style="font-weight: bold; color: #72774d;">[1次投票]</small>
                `;

                // 1次票の並び
                if (pData.firstRound && pData.firstRound.length > 0) {
                    pData.firstRound.forEach(cand => {
                        const isPrimaryWinner = pData.winnerId === cand.id;
                        const marker = isPrimaryWinner ? "👑 " : "";
                        const boldStyle = isPrimaryWinner ? "font-weight: bold; color: #000;" : "";
                        const pPct = pData.totalVotesFirstRound > 0 ? ((cand.votes / pData.totalVotesFirstRound) * 100).toFixed(1) : "0.0";

                        listHtml += `<div style="margin-left: 8px; ${boldStyle}">${marker}${escapeHtml(cand.name)}: <b>${cand.votes.toLocaleString()}票</b> (${pPct}%)</div>`;
                    });
                }

                // 決選投票データがあればさらにネストして表示
                if (pData.hasRunoff && pData.runoff && pData.runoff.length > 0) {
                    listHtml += `
                        <div style="margin-top: 4px; padding-left: 8px; border-left: 1px dashed #1e88e5; color: #54595d;">
                            <small style="font-weight: bold; color: #e53935;">[最終決決選投票]</small>
                    `;
                    pData.runoff.forEach(cand => {
                        const isPrimaryWinner = pData.winnerId === cand.id;
                        const marker = isPrimaryWinner ? "👑 " : "";
                        const boldStyle = isPrimaryWinner ? "font-weight: bold; color: #000;" : "";

                        listHtml += `<div style="margin-left: 8px; ${boldStyle}">${marker}${escapeHtml(cand.name)}: <b>${cand.votes.toLocaleString()}票</b> (${cand.pct}%)</div>`;
                    });
                    listHtml += `</div>`;
                }

                listHtml += `</div></div>`; // 党ごとの枠を閉じる
            });

            listHtml += `</div></details>`; // 予備選全体のトグルを閉じる
        }

        listHtml += `</div></details>`; // 選挙ブロック全体を閉じる
    });

    return listHtml;
}


// 🔍 【新設】文字が入力されるたびにリアルタイムで表示を絞り込む超軽量JavaScript
function filterElectionHistory(keyword) {
    const term = keyword.trim().toLowerCase();
    const blocks = document.querySelectorAll('.election-block');

    blocks.forEach(block => {
        const year = block.getAttribute('data-year') || '';
        const rows = block.querySelectorAll('.candidate-row');

        let matchFound = false;

        // 年数が一致するかチェック
        if (year.includes(term)) {
            matchFound = true;
        }

        // 各候補者名や政党名が一致するかチェック
        rows.forEach(row => {
            const searchData = row.getAttribute('data-search').toLowerCase();
            if (searchData.includes(term)) {
                matchFound = true;
            }
        });

        // 💡 検索にヒットした選挙ブロックだけを表示し、さらに自動でアコーディオンを展開（open）させる
        if (matchFound) {
            block.style.display = "block";
            if (term !== "") {
                block.setAttribute('open', 'true'); // 検索中は自動で中身を開く
            } else {
                block.removeAttribute('open'); // 検索が空なら閉じる
            }
        } else {
            block.style.display = "none";
        }
    });
}
// 📊 開票速報を通知トレーと一体化させる関数
function displayElectionUI(result, candidates, winner) {

    console.log(result);

    // 💡 状態管理用の変数をwindowオブジェクトに安全に退避
    window.electionState = {
        progress: 0,         // 現在の開票率 (0〜100%)
        speed: 1,            // 開票スピード倍率 (1x, 2x, 5x)
        intervalId: null,    // アニメーション用のタイマーID
        currentMode: 'national' // 現在表示中のタブ
    };

    // 全国の総得票数をあらかじめ計算（数値保証）
    const totalNationalFinalVotes = Object.values(result.national || {}).reduce((sum, v) => sum + Number(v), 0) || 1;

    // 💡 タブ切り替え ＆ 画面更新を司るメイン関数
    window.switchElectionView = (mode) => {
        if (mode) window.electionState.currentMode = mode;
        const currentMode = window.electionState.currentMode;
        const progress = window.electionState.progress;

        // 上部の「IN: XX%」などのヘッダー情報をリアルタイム更新
        const progressDisplay = document.getElementById("electionProgressText");
        const progressBar = document.getElementById("electionProgressBar");
        if (progressDisplay) progressDisplay.innerText = `開票率: ${progress}% `;
        if (progressBar) progressBar.style.width = `${progress}% `;

        const content = document.getElementById("electionContent");
        if (!content) return;

        // タブボタンのアクティブ色切り替え
        ['national', 'pref', 'city'].forEach(m => {
            const btn = document.getElementById(`tab-${m}`);
            if (btn) btn.style.background = (m === currentMode) ? "#3182ce" : "#4a5568";
        });

        // 💡 激戦感を演出するCSSアニメーションを動的に注入（初回のみ）
        if (!document.getElementById("election-animation-styles")) {
            const style = document.createElement("style");
            style.id = "election-animation-styles";
            style.innerHTML = `
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    @keyframes shake { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-1px, 1px); } 40% { transform: translate(1px, -1px); } 60% { transform: translate(-1px, -1px); } 80% { transform: translate(1px, 1px); } }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(229, 62, 62, 0); } 100% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); } }
    .voter-blink { animation: blink 0.8s infinite; }
    .voter-shake { animation: shake 0.15s infinite; }
    .voter-pulse { animation: pulse 1.5s infinite; }
    .candidate-row { transition: all 0.4s ease; }
            `;
            document.head.appendChild(style);
        }

        let html = "";
        const factor = progress / 100;
        if (currentMode === 'national') {
            const isSenkyonin = typeof senkyonin !== 'undefined' && senkyonin === true;

            const displayedVotes = {};
            const displayedElectoral = {};

            const remainingRatio = (100 - progress) / 100;
            const midGameDrama = Math.sin((progress / 100) * Math.PI);

            // 💡 1. 安全な全選挙人数の算出（デフォルト538）
            let totalElectoralVotes = 0;
            candidates.forEach(c => {
                const ev = Number(c.electoralVotes) || (typeof electoralVotes !== 'undefined' ? Number(electoralVotes[c.id]) : 0) || 0;
                totalElectoralVotes += ev;
            });
            if (totalElectoralVotes <= 0) totalElectoralVotes = 538;

            // 💡 2. 各候補者のリアルタイム数値計算
            // 💡 2. 各候補者のリアルタイム数値計算
            candidates.forEach(c => {
                const finalVotes = Number(result.national[c.id]) || 0;

                let finalElectoral = Number(c.electoralVotes) || 0;
                if (!finalElectoral && typeof electoralVotes !== 'undefined' && electoralVotes[c.id] !== undefined) {
                    finalElectoral = Number(electoralVotes[c.id]);
                }

                if (progress === 100) {
                    displayedVotes[c.id] = finalVotes;
                    displayedElectoral[c.id] = finalElectoral;
                } else {
                    const isFinalWinner = c.isElected || (winner && winner.id === c.id);
                    let dramaModifier = isFinalWinner ? (1 - (0.15 * midGameDrama)) : (1 + (0.15 * midGameDrama));

                    const seed = String(c.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    const microNoise = 1 + (Math.sin(progress + seed) * 0.02 * remainingRatio);

                    displayedVotes[c.id] = Math.floor(finalVotes * factor * dramaModifier * microNoise);

                    let calculatedElectoral = Math.round(finalElectoral * factor * dramaModifier);
                    displayedElectoral[c.id] = Math.min(finalElectoral, Math.max(0, calculatedElectoral));
                }
            });

            // 🌟 【ここを追加！】現在画面に表示されている有効得票数の合計を算出
            const currentTotalValidVotes = candidates.reduce((sum, c) => sum + (displayedVotes[c.id] || 0), 0);

            function getIdeologyColor(npc) {
                if (!npc || !npc.ideology) return "#a0aec0";
                if (npc.ideology[1] > 65) return "#de0100";
                else if (npc.ideology[0] < 35 || npc.ideology[2] > 65) return "#2b6cb0";
                return "#4a5568";
            }

            // 3. 投票数の集計
            const votedTotal = Object.values(displayedVotes).reduce((a, b) => a + Number(b), 0) || 0;

            // 🌟 1票あたりのスケール倍率を算出（有効票総数 ÷ 有意な有権者数など）
            // 例: 生の棄権数(425)に、有効票の拡大スケールを掛ける
            const rawAbstain = Number(result.abstain) || 0;

            // 1人あたりの平均票数スケール（例として算出、または設定値）
            const scale = allVoters.length > 0 ? (votedTotal / (allVoters.length - rawAbstain)) : 1;
            const abstainTotal = Math.round(rawAbstain * scale);

            const currentTotal = votedTotal + abstainTotal || 1;
            const turnoutRate = ((votedTotal / currentTotal) * 100).toFixed(1);


            // 4. ソート（選挙人制度なら獲得選挙人数、通常なら得票数順）
            const sorted = [...candidates].sort((a, b) => {
                if (isSenkyonin) {
                    // 選挙人票が同じなら一般票でソート
                    const elecfDiff = (displayedElectoral[b.id] || 0) - (displayedElectoral[a.id] || 0);
                    if (elecfDiff !== 0) return elecfDiff;
                }
                return (displayedVotes[b.id] || 0) - (displayedVotes[a.id] || 0);
            });

            const top1 = sorted[0];
            const top2 = sorted[1];

            // 5. 表示数値・割合の完全安全算出
            const v1 = isSenkyonin ? (displayedElectoral[top1?.id] || 0) : (displayedVotes[top1?.id] || 0);
            const v2 = isSenkyonin ? (displayedElectoral[top2?.id] || 0) : (displayedVotes[top2?.id] || 0);

            // 💡 有効得票数（全候補者の得票数の合計）を算出
            const validVotesTotal = sorted.reduce((sum, c) => sum + (displayedVotes[c.id] || 0), 0);

            // 💡 一般投票の場合は「全有権者/全投票数」ではなく「有効得票数の合計」を分母にする！
            const denominator1 = isSenkyonin ? totalElectoralVotes : (validVotesTotal || 1);

            const calcSafeRate = (val, den) => {
                if (!den || den <= 0) return "0.0";
                const r = (Number(val) / Number(den)) * 100;
                return (isNaN(r) || !isFinite(r)) ? "0.0" : r.toFixed(1);
            };

            const r1 = calcSafeRate(v1, denominator1);
            const r2 = calcSafeRate(v2, denominator1);

            const voteDiff = Math.abs(v1 - v2);
            const rateDiff = Math.abs(parseFloat(r1) - parseFloat(r2)).toFixed(1);

            const colorTop1 = getIdeologyColor(top1);
            const colorTop2 = getIdeologyColor(top2);

            const top1VP = npcs.find(cand =>
                cand.partyId === top1.partyId &&
                cand.runningMateOf === top1.id
            );

            const top2VP = npcs.find(cand =>
                cand.partyId === top2.partyId &&
                cand.runningMateOf === top2.id
            );

            const unitText = isSenkyonin ? "票 (選挙人)" : "票";

            // 6. UI演出
            const isDeadHeat = progress < 100 && parseFloat(rateDiff) <= 1.5;
            let statusColor = "#f6ad55";
            let statusBoxClass = "";
            let numberClass = "";
            let statusText = `🔥 主要候補の差：<span style="color: #f6ad55; font-size: 14px;">${voteDiff.toLocaleString()}${unitText}</span> （<span style="color: #f6ad55;">${rateDiff}%</span>）`;

            if (isDeadHeat) {
                statusColor = "#e53e3e";
                statusBoxClass = "voter-pulse";
                numberClass = "voter-shake";
                statusText = `⚡ <span class="voter-blink" style="color:${statusColor}; font-weight:900;">【超大接戦】</span> 差わずか <span style="color: ${statusColor}; font-size: 14px;" class="${numberClass}">${voteDiff.toLocaleString()}${unitText}</span>！`;
            } else if (progress === 100) {
                statusText = `📢 【当確】すべての開票が終了しました。`;
            }

            const containerBorderColor = isDeadHeat ? '#e53e3e' : colorTop1;
            const totalUnitLabel = isSenkyonin ? "票 (選挙人)" : "票";

            html += `
<div style="display: flex; justify-content: space-between; background: #1a202c; padding: 6px 12px; border-radius: 4px; margin-bottom: 6px; font-size: 11px; color: #a0aec0; border: 1px solid #4a5568;">
    <span>📊 投票率: <strong style="color: #4fd1c5; font-size: 13px;">${turnoutRate}%</strong></span>
    <span>💤 棄権・白票: <strong>${abstainTotal.toLocaleString()}人</strong></span>
</div>

<div class="${statusBoxClass}" style="background: #2d3748; color: #fff; text-align: center; padding: 8px; border-radius: 4px; margin-bottom: 12px; font-weight: bold; font-size: 12px; border-left: 4px solid ${statusColor};">
    ${statusText}
</div>

<div style="display: flex; gap: 8px; background: #1a202c; padding: 12px; border-radius: 6px; border: 2px solid ${containerBorderColor}; margin-bottom: 12px; box-shadow: 0 0 10px ${containerBorderColor}4d; transition: border-color 0.3s;">
    <!-- 1位候補 -->
    <div style="flex: 1; text-align: center; border-right: 1px solid #4a5568; padding-right: 4px;">
        <div style="font-size: 11px; color: ${colorTop1}; font-weight: bold;">1位 ${progress > 99 ? '👑 当選確定' : '🔥 暫定首位'}</div>
        <div style="font-size: 11px; text-align: center; margin: 8px 0;" id="top1icon">
            <img src="${top1?.icon}" style="width: 100px; height: 130px; object-fit: cover; border-radius: 4px; border: 1px solid #4a5568; vertical-align: middle;">
        </div>
        <div style="font-size: 16px; font-weight: 900; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${top1 ? top1.name : '---'}</div>
        <div style="font-size: 12px; font-weight: 900; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">副大統領候補:${top1VP ? top1VP.name : '---'}</div>
        <div style="font-size: 26px; font-weight: 900; color: ${colorTop1}; margin: 4px 0;" class="${numberClass}">${r1}%</div>
        <div style="font-size: 11px; color: #a0aec0;">${v1.toLocaleString()}${totalUnitLabel}</div>
        ${isSenkyonin ? `<div style="font-size: 10px; color: #718096; margin-top:2px;">(一般票: ${(displayedVotes[top1?.id] || 0).toLocaleString()}票)</div>` : ''}
    </div>
    <!-- 2位候補 -->
    <div style="flex: 1; text-align: center;">
        <div style="font-size: 11px; color: ${colorTop2}; font-weight: bold;">2位</div>
        <div style="font-size: 11px; text-align: center; margin: 8px 0;">
            <img src="${top2?.icon}" style="width: 100px; height: 130px; object-fit: cover; border-radius: 4px; border: 1px solid #4a5568; vertical-align: middle;">
        </div>
        <div style="font-size: 16px; font-weight: 900; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${top2 ? top2.name : '---'}</div>
        <div style="font-size: 12px; font-weight: 900; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">副大統領候補:${top2VP ? top2VP.name : '---'}</div>
        <div style="font-size: 26px; font-weight: 900; color: ${colorTop2}; margin: 4px 0;" class="${numberClass}">${r2}%</div>
        <div style="font-size: 11px; color: #a0aec0;">${v2.toLocaleString()}${totalUnitLabel}</div>
        ${isSenkyonin ? `<div style="font-size: 10px; color: #718096; margin-top:2px;">(一般票: ${(displayedVotes[top2?.id] || 0).toLocaleString()}票)</div>` : ''}
    </div>
</div>

<table style="width:100%; border-collapse:collapse;">
`;
            // 🌟 1. まず開票中の「有効票（全候補者の票数）の合計」を計算しておく
            const currentValidVotesTotal = sorted.reduce((sum, c) => sum + (displayedVotes[c.id] || 0), 0);

            // 7. 全候補者のスクロールリスト
            sorted.forEach(c => {
                // 💡 リアルタイム（開票中）の一般票と選挙人票を取得！
                const currentGenVotes = displayedVotes[c.id] || 0;
                const currentElectoral = displayedElectoral[c.id] || 0;

                // 💡 5%判定も有効票数ベースで正しく計算（序盤のエラー回避付き）
                const genVoteRate = currentValidVotesTotal > 0 ? (currentGenVotes / currentValidVotesTotal) * 100 : 0;

                // 🚨 5%未満の候補者は非表示にする（1位・2位は常に表示を保証）
                if (genVoteRate < 5 && c.id !== top1?.id && c.id !== top2?.id && currentElectoral === 0) return;

                // 選挙人制度時のパーセンテージ計算（一般投票は有効票合計で割る！）
                const primaryVal = isSenkyonin ? currentElectoral : currentGenVotes;

                // ⭕️ currentTotal ではなく currentValidVotesTotal に差し替え！
                const primaryTotal = isSenkyonin ? totalElectoralVotes : currentValidVotesTotal;
                const displayRate = primaryTotal > 0 ? ((primaryVal / primaryTotal) * 100).toFixed(1) : "0.0";

                const isWin = (progress === 100 && c.isElected) ? "👑 " : "";

                let part = "無所属";
                if (c.partyId) {
                    const ownPartyName = getPartyName(c.partyId);
                    const otherEndorsements = (c.endorsedByParties || []).filter(pId => pId !== c.partyId);
                    part = otherEndorsements.length > 0 ? `${ownPartyName}` : ownPartyName;
                }
                if (currentGenVotes.toLocaleString() === `0`) return;
                // 💡 テーブル行（一般票も一緒に表示）
                html += `
    <tr class="candidate-row" style="border-bottom:1px solid #4a5568; height: 42px;">
        <td style="padding:6px 4px; color:#fff; font-size:13px; font-weight:bold;">${isWin}${c.name}</td>
        <td style="color:#a0aec0; font-size:11px;">${part}</td>
        <td style="text-align:right; color:#fff; font-size:12px; font-family: monospace;">
        ${isSenkyonin ? `<span style="color:#4fd1c5; font-weight:bold;">${currentElectoral}票</span> <span style="font-size:10px; color:#a0aec0;">(${currentGenVotes.toLocaleString()}一般票)</span>` : `${currentGenVotes.toLocaleString()}票`}
        </td>
        <td style="text-align:right; color:#fff; font-size:13px; padding-right:4px; font-weight:bold; font-family: monospace;">${displayRate}%</td>
    </tr>`;

            });
            html += `</table>`;
        }
        // ---------------------------------------------------------
        // 🗺️ 【都道府県・市区町村モード】（共通統合 ＋ レコード抽出）
        // ---------------------------------------------------------
        else if (currentMode === 'pref' || currentMode === 'city') {
            const modeConfig = {
                pref: {
                    dataSource: result.pref,
                    icon: '📍',
                    borderColor: '#fc8181',
                    label: '都道府県',
                    getDisplayName: key => key
                },
                city: {
                    dataSource: result.city,
                    icon: '🏢',
                    borderColor: '#68d391',
                    label: '市区町村',
                    getDisplayName: key => key.replace("_", " ")
                }
            };

            const config = modeConfig[currentMode];
            if (config && config.dataSource) {
                // 📊 記録集計用変数
                const stats = [];

                // まずは全エリアの計算とデータ構造化
                Object.entries(config.dataSource).forEach(([key, regionData]) => {
                    const finalTotal = Object.values(regionData).reduce((sum, v) => sum + v, 0) || 1;
                    const currentTotal = Math.floor(finalTotal * factor) || 1;
                    const displayName = config.getDisplayName(key);

                    // 候補者ごとの得票計算＆ソート
                    const candidateVotes = candidates.map(c => {
                        const finalV = regionData[c.id] || 0;
                        const currentV = Math.floor(finalV * factor);
                        return { candidate: c, votes: currentV };
                    }).sort((a, b) => b.votes - a.votes);

                    const top1 = candidateVotes[0] || { votes: 0 };
                    const top2 = candidateVotes[1] || { votes: 0 };

                    // 1位と2位の差分（票数差と％pt差）
                    const voteDiff = top1.votes - top2.votes;
                    const rate1 = currentTotal > 0 ? (top1.votes / currentTotal) * 100 : 0;
                    const rate2 = currentTotal > 0 ? (top2.votes / currentTotal) * 100 : 0;
                    const rateDiff = Math.abs(rate1 - rate2);

                    stats.push({
                        key,
                        displayName,
                        currentTotal,
                        candidateVotes,
                        top1,
                        top2,
                        voteDiff,
                        rateDiff
                    });
                });
                // 🌟 【記録保持エリアの算出】（開票率0%超の時のみ有効）
                if (stats.length > 0 && factor > 0) {
                    // 1. 最も接戦（1位と2位の%差が最小）
                    const closest = [...stats].sort((a, b) => a.rateDiff - b.rateDiff)[0];
                    // 2. 最も大差（1位と2位の%差が最大）
                    const blowout = [...stats].sort((a, b) => b.rateDiff - a.rateDiff)[0];
                    // 3. 最多得票（総投票数が最大のエリア）
                    const highestTurnout = [...stats].sort((a, b) => b.currentTotal - a.currentTotal)[0];

                    // ─── 🆕 【追加】さらに熱くなる5つのハイライト ───

                    // 4. 最も無所属（サードパーティ）が健闘したエリア（無所属の得票率が最大）
                    // ※stats内の各エリアデータに、無所属候補の得票率や票数（例: c.independentsRate）が格納されている前提
                    const strongestIndie = [...stats]
                        .filter(a => typeof a.indieRate !== "undefined")
                        .sort((a, b) => b.indieRate - a.indieRate)[0];

                    // 5. 1位の得票率がエグすぎるエリア（実質的なワンマン・絶対王国の地盤）
                    const absoluteKingdom = [...stats]
                        .filter(a => a.winnerRate)
                        .sort((a, b) => b.winnerRate - a.winnerRate)[0];

                    // 6. 逆に最少得票エリア（超過疎区、または開票が始まったばかりの限界集落）
                    const lowestTurnout = [...stats].sort((a, b) => a.currentTotal - b.currentTotal)[0];

                    // 7. 与党（または最大政党）が最もボロ負けした、歴史的「逆風」エリア
                    const biggestUpset = [...stats]
                        .filter(a => typeof a.rulingRate !== "undefined")
                        .sort((a, b) => a.rulingRate - b.rulingRate)[0];


                    html += `
                    <!-- 🏆 RECORD HIGHLIGHTS PANEL -->
                    <div style="background: #111827; border: 1px solid #374151; border-radius: 6px; padding: 8px; margin-bottom: 10px; font-size: 11px;">
                        <div style="color: #f6ad55; font-weight: bold; margin-bottom: 6px; border-bottom: 1px dashed #374151; padding-bottom: 4px;">
                            🔥 ${config.label}ハイライト＆ハイ記録
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; justify-content: space-between; color: #fc8181;">
                                <span>⚡ 最激戦区: <strong>${closest.displayName}</strong></span>
                                <span>(差: <strong>${closest.rateDiff.toFixed(1)}%pt</strong> / ${closest.voteDiff.toLocaleString()}票)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: #63b3ed;">
                                <span>🏰 最も大差: <strong>${blowout.displayName}</strong></span>
                                <span>(差: <strong>${blowout.rateDiff.toFixed(1)}%pt</strong>)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: #4fd1c5;">
                                <span>🗳️ 最多投票エリア: <strong>${highestTurnout.displayName}</strong></span>
                                <span>(<strong>${highestTurnout.currentTotal.toLocaleString()}票</strong>)</span>
                            </div>
                            
                            <!-- 🆕 追加分のHTML表示エリア -->
                            ${strongestIndie && strongestIndie.indieRate > 0 ? `
                            <div style="display: flex; justify-content: space-between; color: #f6e05e;">
                                <span>🐺 無所属・諸派の健闘: <strong>${strongestIndie.displayName}</strong></span>
                                <span>(得票率: <strong>${strongestIndie.indieRate.toFixed(1)}%</strong>)</span>
                            </div>` : ''}

                            ${absoluteKingdom ? `
                            <div style="display: flex; justify-content: space-between; color: #b7791f;">
                                <span>👑 1位独走: <strong>${absoluteKingdom.displayName}</strong></span>
                                <span>(1位得票率: <strong>${absoluteKingdom.winnerRate.toFixed(1)}%</strong>)</span>
                            </div>` : ''}

                            ${biggestUpset ? `
                            <div style="display: flex; justify-content: space-between; color: #e53e3e;">
                                <span>🌊 最大の逆風区: <strong>${biggestUpset.displayName}</strong></span>
                                <span>(与党得票率: <strong>${biggestUpset.rulingRate.toFixed(1)}%</strong>)</span>
                            </div>` : ''}

                            <div style="display: flex; justify-content: space-between; color: #a0aec0;">
                                <span>🍃 最少投票エリア: <strong>${lowestTurnout.displayName}</strong></span>
                                <span>(<strong>${lowestTurnout.currentTotal.toLocaleString()}票</strong>)</span>
                            </div>
                        </div>
                    </div>`;
                }

                // 🗺️ 各エリアの通常リスト出力
                stats.forEach(item => {
                    // 接戦エリア（1.5%pt以内）には特別な強調ボーダーを付与！
                    const isUltraClose = factor > 0 && item.rateDiff <= 1.5;
                    const borderColor = isUltraClose ? '#e53e3e' : config.borderColor;
                    const badge = isUltraClose ? `<span class="voter-blink" style="background:#e53e3e; color:#fff; font-size:9px; padding:1px 4px; border-radius:3px; margin-left:6px;">激戦区</span>` : '';

                    html += `<div style="margin-top:8px; background:#1a202c; padding:8px; border-radius:6px; border-left:4px solid ${borderColor};">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <b style="color:${config.borderColor}; font-size:13px;">${config.icon} ${item.displayName}${badge}</b>
            <span style="font-size:10px; color:#718096;">総数: ${item.currentTotal.toLocaleString()}票</span>
        </div>
        <ul style="margin:4px 0 0 0; padding-left:14px; color:#e2e8f0; font-size:12px; list-style-type: square;">`;

                    // 💡 あらかじめ候補者を「得票数が多い順」に並び替えておくと一番上が勝者になります！
                    // （もしすでにソート済みの場合はそのままでOKですが、安全のためここでクローン＆ソートも可能です）
                    const sortedCandidates = [...item.candidateVotes].sort((a, b) => b.votes - a.votes);

                    sortedCandidates.forEach(({ candidate: c, votes }, index) => {
                        if (votes > 0) {
                            const rate = ((votes / item.currentTotal) * 100).toFixed(1);

                            // 👑 1位（先頭）の候補者に勝者バッジを付与！
                            // （同票の1位が複数いる場合の考慮が必要なら `index === 0` を調整してね）
                            const isWinner = index === 0;
                            const winnerBadge = isWinner ? `<span style="background:#d69e2e; color:#1a202c; font-size:9px; font-weight:bold; padding:1px 5px; border-radius:3px; margin-left:4px;">👑 当確 / 首位</span>` : '';

                            // 1位は文字の色を少し目立たせる（金色や白抜きなど）
                            const nameColor = isWinner ? '#f6e05e' : '#e2e8f0';

                            html += `<li style="margin-bottom:2px;">
                <span style="color:${nameColor};">${c.name}</span>: <b>${votes.toLocaleString()}票</b> <span style="color:#a0aec0;">(${rate}%)</span>${winnerBadge}
            </li>`;
                        }
                    });

                    html += `</ul></div>`;
                });
            }
        }
        content.innerHTML = html;
    };

    // 💡 リアルタイムの倍速コントロール用関数
    window.changeElectionSpeed = (倍率) => {
        window.electionState.speed = 倍率;
        ['1', '2', '5'].forEach(s => {
            const btn = document.getElementById(`speed - ${s} x`);
            if (btn) btn.style.borderColor = (s === 倍率.toString()) ? "#f6ad55" : "#4a5568";
        });
    };

    // 💡 一発スキップ関数
    window.skipElectionCounting = () => {
        if (window.electionState.progress > 99) return;
        if (window.electionState.intervalId) clearInterval(window.electionState.intervalId);
        window.electionState.progress = 100;
        window.switchElectionView();

        // 完了したらアラートやヘッダーを確定演出に変える
        const titleArea = document.getElementById("electionMainHeadline");
        if (titleArea && winner) titleArea.innerHTML = `<span style = "color:#f6ad55;" >👑 PROJECTION:</span > ${winner.name} ELECTED!`;


        // 🌟【ここを追加！】テキストだけを裏でスマートに上書きする！
        const tickerElement = document.getElementById("electionTicker");
        if (tickerElement) {
            let tickerText = `【開票速報】全国開票率 ${window.electionState.progress.toFixed(0)}% 突破！ `;

            tickerText += `${winner?.name || '候補者'} が当選確実`;

            // 🌟 流れる位置がピクッと戻らないように、文字が変わった瞬間だけ上書きするガード！
            if (tickerElement.textContent !== tickerText) {
                tickerElement.textContent = tickerText;
            }
        }
    };

    // 💡 アメリカン・ニューススタイルのベースHTMLレイアウト
    const reportHTML = `
    <div style = "font-family:'Impact', 'Arial Black', sans-serif; color:#fff; background:#0b132b; padding:12px; border-radius:8px; margin-top:8px; border:3px solid #1a237e; box-shadow: 0 4px 15px rgba(0,0,0,0.5);" >
            
            <!-- 🟥 🟦 FOX NEWS風 超弩級トップヘッダー-->
            <div style="background: linear-gradient(90deg, #de0100 0%, #1a237e 100%); padding:8px; text-align:center; border-radius:4px; font-weight:900; letter-spacing:1px; margin-bottom:10px; border-bottom: 3px solid #f6ad55;">
                <div id="electionMainHeadline" style="font-size:16px; color:#fff; text-shadow: 2px 2px #000;">🚨 NEWS: VOTES</div>
                
                <!-- リアルタイム・下部ティッカー風プログレスバー -->
                <div style="display:flex; align-items:center; justify-content:space-between; margin-top:6px; background:rgba(0,0,0,0.4); padding:3px 8px; border-radius:3px;">
                    <span id="electionProgressText" style="font-size:14px; color:#f6ad55; font-weight:bold;">IN: 0%</span>
                    <div style="flex:1; background:#4a5568; height:8px; border-radius:4px; margin:0 8px; overflow:hidden;">
                        <div id="electionProgressBar" style="background:#f6ad55; width:0%; height:100%; transition: width 0.1s linear;"></div>
                    </div>
                </div>
            </div>

            <!--コントロールパネル（速度変更・スキップ） -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:#1c2541; padding:6px; border-radius:4px; margin-bottom:10px; border:1px solid #3a506b;">
                <div style="display:flex; gap:4px; align-items:center;">
                    <span style="font-size:10px; color:#a0aec0; font-weight:bold; margin-right:4px;">SPEED:</span>
                    <button id="speed-1x" onclick="changeElectionSpeed(1)" style="background:#2d3748; color:white; border:2px solid #f6ad55; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px; font-weight:bold;">1x</button>
                    <button id="speed-2x" onclick="changeElectionSpeed(2)" style="background:#2d3748; color:white; border:2px solid #4a5568; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px; font-weight:bold;">2x</button>
                    <button id="speed-5x" onclick="changeElectionSpeed(5)" style="background:#2d3748; color:white; border:2px solid #4a5568; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px; font-weight:bold;">5x</button>
                </div>
                <button onclick="skipElectionCounting()" style="background:#de0100; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px; box-shadow:0 2px 4px rgba(0,0,0,0.3);">⏩ SKIP TO END</button>
            </div>

            <!--選択タブボタン一覧 -->
            <div style="display:flex; gap:4px; margin-bottom:10px;">
                <button id="tab-national" onclick="switchElectionView('national')" style="flex:1; background:#3182ce; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">🌍 NATIONWIDE</button>
                <button id="tab-pref" onclick="switchElectionView('pref')" style="flex:1; background:#4a5568; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">🗺️ STATE-BY-STATE</button>
                <button id="tab-city" onclick="switchElectionView('city')" style="flex:1; background:#4a5568; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">🏙️ LOCAL COUNTIES</button>
            </div>

            <!--開票データが動的に書き換わるメインエリア -->
            <div id="electionContent" style="max-height:320px; overflow-y:auto; padding-right:4px;"></div>

            <!-- 🌟【ここを追加！】FOX NEWS風 ニュースティッカー（外側に配置） -->
    <div style="width: 100%; overflow: hidden; background: #de0100; color: #fff; padding: 6px 0; font-weight: bold; font-size: 13px; border-radius: 4px; margin-top: 12px; box-shadow: inset 0 0 10px rgba(0,0,0,0.5); border: 1px solid #f6ad55;">
        <marquee id="electionTicker" scrollamount="6" style="display: block; white-space: nowrap;">
            【開票速報】まもなく各地の開票データが入ります...
        </marquee>
    </div>
        </div >
    `;

    // 本物の通知トレーに関数を流し込む
    pushNotificationTray(
        "👑 NEWS: LIVE REPORT",
        `開票速報：大統領選、各地から今まさにデータが到着しています。`,
        {
            title: "🗳️ 大統領選 リアルタイム開票特番",
            body: reportHTML,
            buttons: [
                {
                    text: "CLOSE TRAY",
                    className: "scout-btn",
                    callback: () => {
                        // トレーを閉じる時にタイマーを安全に消去
                        if (window.electionState.intervalId) clearInterval(window.electionState.intervalId);
                    }
                }
            ]
        },
        true // 閉じるまでターンブロック
    );

    // 最初に「全国」の枠組みをマウント
    setTimeout(() => {
        window.switchElectionView('national');
        window.electionState.intervalId = setInterval(() => {
            window.electionState.progress += window.electionState.speed;

            // （※ここで前回のソートや v1, v2, voteDiff などの計算を行っている前提だよ！）
            const progress = window.electionState.progress;

            if (progress >= 100) {
                window.electionState.progress = 100;
                clearInterval(window.electionState.intervalId);
                window.switchElectionView();

                const titleArea = document.getElementById("electionMainHeadline");
                if (titleArea && winner) titleArea.innerHTML = `<span style = "color:#f6ad55;" >👑 PROJECTION:</span > ${winner.name} ELECTED!`;
            } else {
                window.switchElectionView();
            }

            // 🌟【ここを追加！】テキストだけを裏でスマートに上書きする！
            const tickerElement = document.getElementById("electionTicker");
            if (tickerElement) {
                let tickerText = `【開票速報】全国開票率 ${progress.toFixed(0)}% 突破！ `;
                if (progress > 99) {
                    tickerText += `${winner?.name || '候補者'} が当選確実`;
                }

                // 🌟 流れる位置がピクッと戻らないように、文字が変わった瞬間だけ上書きするガード！
                if (tickerElement.textContent !== tickerText) {
                    tickerElement.textContent = tickerText;
                }
            }

        }, 600);
    }, 100);
}

/**
 * 大統領の全国/地域別支持率をシミュレーションする関数
 * @param {Object} pres - 現職大統領オブジェクト (candsと同等のプロパティ + approvalなど)
 * @param {Array} allVoters - 有権者配列
 * @param {Object} options - 各種政党情報や政策成果などのオプション
 */
const calculatePresidentApproval = (pres, allVoters, options = {}) => {
    if (!pres) return null;

    const {
        rulingparty = "",
        largest_opoosition = "",
        economicPerformance = 0, // 経済・政権の成果補正 (-20 〜 +20pt)
        scandalPenalty = 0       // 不祥事ペナルティ (0 〜 -30pt)
    } = options;

    let approveCount = 0;
    let disapproveCount = 0;
    let neutralCount = 0;

    // 地域別の集計用
    const regionalApproval = {};

    allVoters.forEach(voter => {
        // ----------------------------------------------------
        // 1. 大統領本人の基礎魅力・実力 (XP)
        // ----------------------------------------------------
        const xp = Number(pres.xp || pres.power || pres.approval || pres.level || 0);
        // 対数で成長を緩やかにしつつ、実力派（XP高）は信頼感アップ
        const xpScore = 10 + (xp > 0 ? Math.sqrt(xp) * 0.8 : 0);

        // ----------------------------------------------------
        // 👴 2. 年齢デバフ・バフ（老害 vs 脂の乗った盛期）
        // ----------------------------------------------------
        const age = Number(pres.age) || 50;
        let ageScore = 0;
        if (age < 45) {
            ageScore = 3;  // 若手：刷新感
        } else if (age <= 65) {
            ageScore = 6;  // 黄金期：円熟味・安心感
        } else if (age <= 75) {
            ageScore = -4; // やや老化懸念
        } else {
            // 76歳以上：急激に「健康不安・高齢問題」で支持率が削れる
            ageScore = -10 - (age - 75) * 1.8;
        }

        // ----------------------------------------------------
        // 📜 3. 指名回数（Nominee / 多選）ペナルティ
        // ----------------------------------------------------
        const nomineeCount = Number(pres.nominee) || 0;
        let nomineePenalty = 0;
        if (nomineeCount >= 3) {
            // 3回目以上指名されていると「そろそろ飽きた」「居座り」感が世論に出て批判票になる
            nomineePenalty = (nomineeCount - 2) * -8; // 3回目で-8pt、4回目で-16pt
        }

        // ----------------------------------------------------
        // 4. 思想の一致度 (最大 +30pt 〜 0pt)
        // ----------------------------------------------------
        let ideologyScore = 0;
        if (voter.ideology && pres.ideology && Array.isArray(voter.ideology) && Array.isArray(pres.ideology)) {
            let totalDiff = 0;
            const dimensions = Math.min(voter.ideology.length, pres.ideology.length);
            for (let i = 0; i < dimensions; i++) {
                totalDiff += Math.abs(voter.ideology[i] - pres.ideology[i]);
            }
            const avgDiff = totalDiff / dimensions;
            ideologyScore = 30 - (avgDiff * 0.6);
        }

        // ----------------------------------------------------
        // 5. 党派性（Partisanship）バフ / デバフ
        // ----------------------------------------------------
        let partyAffinity = 0;
        const presParty = String(pres.partyId || "").trim();
        const voterFavParty = String(voter.favPartyId || "").trim();

        if (voterFavParty && voterFavParty === presParty) {
            partyAffinity += 22; // 身内与党支持層
        } else if (voterFavParty === String(largest_opoosition).trim()) {
            partyAffinity -= 18; // 野党支持層
        }

        // ----------------------------------------------------
        // 6. 地元バフ
        // ----------------------------------------------------
        let localBuff = 0;
        if (pres.pref && voter.pref && pres.pref === voter.pref) {
            localBuff += 5;
        }

        // ----------------------------------------------------
        // 🎲 7. 世論調査の「気まぐれ・回答ノイズ」（電話応答時の気分や隠れ支持者）
        // ----------------------------------------------------
        // 調査の瞬間の有権者の機嫌・ニュースの印象ブレ（-15 〜 +15pt）
        const pollingMood = (Math.random() + Math.random() + Math.random() - 1.5) * 10;
        // 10%の確率で「世論調査を適当に答える / 逆張りで答える」天の邪鬼が発生
        const trollFactor = (Math.random() < 0.10) ? (Math.random() - 0.5) * 20 : 0;

        // 🌟 総合評価スコア
        const totalScore = xpScore
            + ageScore
            + nomineePenalty
            + ideologyScore
            + partyAffinity
            + localBuff
            + economicPerformance
            + scandalPenalty
            + pollingMood
            + trollFactor;

        // ----------------------------------------------------
        // 📊 判定閾値（無回答が爆増しないリアル調整版）
        // ----------------------------------------------------
        // スコア 38pt 以上なら「支持」、32pt 未満なら「不支持」、32〜37pt は「無回答・どっちでもない」
        let stance = "neutral";
        if (totalScore >= 38) {
            stance = "approve";
            approveCount++;
        } else if (totalScore < 32) {
            stance = "disapprove";
            disapproveCount++;
        } else {
            neutralCount++;
        }

        // 地域（州）別集計
        const voterPref = voter.pref || "全国";
        if (!regionalApproval[voterPref]) {
            regionalApproval[voterPref] = { approve: 0, disapprove: 0, neutral: 0, total: 0 };
        }
        regionalApproval[voterPref][stance]++;
        regionalApproval[voterPref].total++;
    });

    const totalVoters = allVoters.length;
    const approveRate = Number(((approveCount / totalVoters) * 100).toFixed(1));
    const disapproveRate = Number(((disapproveCount / totalVoters) * 100).toFixed(1));
    const neutralRate = Number(((neutralCount / totalVoters) * 100).toFixed(1));

    // 州別の支持率パーセンテージ計算
    const prefResults = {};
    Object.keys(regionalApproval).forEach(pref => {
        const data = regionalApproval[pref];
        prefResults[pref] = {
            approveRate: Number(((data.approve / data.total) * 100).toFixed(1)),
            disapproveRate: Number(((data.disapprove / data.total) * 100).toFixed(1)),
            neutralRate: Number(((data.neutral / data.total) * 100).toFixed(1)),
            sampleSize: data.total
        };
    });

    return {
        presidentName: pres.name,
        national: {
            approve: approveRate,       // 支持率 (%)
            disapprove: disapproveRate, // 不支持率 (%)
            neutral: neutralRate,       // どちらでもない/無回答 (%)
            netApproval: Number((approveRate - disapproveRate).toFixed(1)) // 差し引き支持率
        },
        byState: prefResults
    };
};

function doCalculateApproval() {
    presidentapproval = calculatePresidentApproval(president, allVoters, {
        rulingparty: rulingparty,
        largest_opoosition: largest_opoosition,
        economicPerformance: 0,
        scandalPenalty: 0
    });
}
async function showPresidentApprovalModal() {
    if (!presidentapproval) return;

    // 支持・不支持の判定に応じたアイコンや色付け
    const isPositive = presidentapproval.national.netApproval >= 0;
    const statusBadge = isPositive ? "🟢 政権安定" : "🔴 警戒水域";

    // ----------------------------------------------------
    // 🏛️ 州別データ（byState）のアコーディオンHTML作成
    // ----------------------------------------------------
    let stateRowsHtml = "";
    if (presidentapproval.byState && Object.keys(presidentapproval.byState).length > 0) {
        stateRowsHtml = Object.entries(presidentapproval.byState).map(([stateName, data]) => {
            const stateIsPositive = (data.approveRate - data.disapproveRate) >= 0;
            const diffText = (data.approveRate - data.disapproveRate).toFixed(1);

            return `
              <tr style="border-bottom: 1px solid #eee; font-size: 0.85rem;">
                <td style="padding: 6px 4px; text-align: left; font-weight: bold;">${stateName}</td>
                <td style="padding: 6px 4px; color: #2e7d32; font-weight: bold;">${data.approveRate}%</td>
                <td style="padding: 6px 4px; color: #c62828;">${data.disapproveRate}%</td>
                <td style="padding: 6px 4px; color: #757575;">${data.neutralRate}%</td>
                <td style="padding: 6px 4px; font-weight: bold; color: ${stateIsPositive ? '#2e7d32' : '#c62828'};">
                  ${diffText > 0 ? '+' : ''}${diffText}%
                </td>
              </tr>
            `;
        }).join("");
    }

    // 州別アコーディオンコンポーネント
    const stateDetailsHtml = stateRowsHtml ? `
      <details style="margin-top: 15px; background: #fafafa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px; text-align: left;">
        <summary style="font-weight: bold; cursor: pointer; font-size: 0.85rem; color: #444; outline: none; user-select: none;">
          🗺️ 州別（地域別）内訳を表示 (${Object.keys(presidentapproval.byState).length} 州)
        </summary>
        <div style="max-height: 200px; overflow-y: auto; margin-top: 8px; border-top: 1px solid #ddd; padding-top: 6px;">
          <table style="width: 100%; border-collapse: collapse; text-align: center;">
            <thead>
              <tr style="font-size: 0.75rem; color: #666; border-bottom: 2px solid #ccc; background: #f0f0f0;">
                <th style="padding: 4px; text-align: left;">州名</th>
                <th style="padding: 4px;">支持</th>
                <th style="padding: 4px;">不支持</th>
                <th style="padding: 4px;">無回答</th>
                <th style="padding: 4px;">差</th>
              </tr>
            </thead>
            <tbody>
              ${stateRowsHtml}
            </tbody>
          </table>
        </div>
      </details>
    ` : "";

    // ----------------------------------------------------
    // 🖼️ モーダル本体のHTML構成
    // ----------------------------------------------------
    const modalBody = `
      <div style="text-align: center; padding: 5px;">
        <div style="font-size: 0.85rem; color: #888; margin-bottom: 4px;">全国世論調査（リアルタイム集計）</div>
        <h2 style="margin: 0 0 10px 0; font-size: 1.25rem;">🏛️ ${presidentapproval.presidentName} 大統領 支持率</h2>
        
        <div style="display: flex; justify-content: space-around; background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
          <div>
            <div style="font-size: 0.75rem; color: #666;">👍 支持</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: #2e7d32;">${presidentapproval.national.approve}%</div>
          </div>
          <div style="border-left: 1px solid #ccc;"></div>
          <div>
            <div style="font-size: 0.75rem; color: #666;">👎 不支持</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: #c62828;">${presidentapproval.national.disapprove}%</div>
          </div>
          <div style="border-left: 1px solid #ccc;"></div>
          <div>
            <div style="font-size: 0.75rem; color: #666;">💤 無回答</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: #757575;">${presidentapproval.national.neutral}%</div>
          </div>
        </div>

        <div style="font-size: 0.95rem; font-weight: bold; margin-bottom: 6px;">
          Net Approval (差し引き): 
          <span style="color: ${isPositive ? '#2e7d32' : '#c62828'};">
            ${presidentapproval.national.netApproval > 0 ? '+' : ''}${presidentapproval.national.netApproval}%
          </span>
        </div>
        <div style="display: inline-block; padding: 2px 10px; border-radius: 12px; background: #eee; font-size: 0.8rem; font-weight: bold;">
          ${statusBadge}
        </div>

        <!-- 州別データの開閉アコーディオン -->
        ${stateDetailsHtml}
      </div>
    `;

    // モーダル表示
    await showModal("📊 支持率調査特番", modalBody, [{ text: "確認", value: "ok", className: "scout-btn" }]);
}