// 🗳️ 汎用・代表選挙（エントリー & 告示処理）
function holdPartyLeadershipElection(party) {
    const pname = party.name;

    // 政党の所属NPC・プレイヤーを取得
    const members = npcs.filter(npc => npc.partyId === party.id);
    if (members.length === 0) return;

    // プレイヤーがこの政党の党員かどうか判定
    const isPlayerInParty = (typeof player !== "undefined" && player && player.partyId === party.id);

    // -------------------------------------------------------------
    // パターンA：プレイヤーが所属していない政党（即時立候補選定＆開票）
    // -------------------------------------------------------------
    if (!isPlayerInParty) {
        startLeadershipElectionProcess(party, members, false);
    }
    // -------------------------------------------------------------
    // パターンB：プレイヤーが所属している政党（出馬確認通知）
    // -------------------------------------------------------------
    else {
        const bodyHtml = `
            <div style="font-size:14px; line-height:1.5;">
                <p>あなたが所属する <b>${pname}</b> で代表選挙が告示されました。</p>
                <p>あなたもこの代表選に立候補して、党首の座を狙うことができます！</p>
                <p><b>立候補しますか？</b></p>
            </div>
        `;

        pushNotificationTray(
            `🗳️ ${pname} 代表選挙・出馬届出`,
            `${pname}にて代表選挙が行われます。出馬しますか？`,
            {
                title: `🗳️ ${pname} 代表選挙・出馬届出`,
                body: bodyHtml,
                buttons: [
                    {
                        text: "🔥 代表選に立候補する！",
                        callback: function (e) {
                            console.log(`🔥 プレイヤーが 【${pname}】 代表選への出馬を表明しました！`);
                            // 🚨 重要：古い通知（自分自身）を画面から削除！

                            // 10ms遅延させてDOMの更新を確実にしてから投票へ
                            setTimeout(() => {
                                startLeadershipElectionProcess(party, members, true);
                            }, 10);
                        }
                    },
                    {
                        text: "☕ 今回は出馬を見送る（一般党員として投票）",
                        callback: function (e) {
                            // 🚨 重要：古い通知（自分自身）を画面から削除！

                            setTimeout(() => {
                                startLeadershipElectionProcess(party, members, false);
                            }, 10);
                        }
                    }
                ]
            },
            true
        );
    }
}

// -------------------------------------------------------------
// 💡 コア関数：立候補者の確定・NPC投票・画面生成
// -------------------------------------------------------------
function startLeadershipElectionProcess(party, members, playerIsCandidate) {
    const pname = party.name;

    // 1. 候補者（出馬メンバー）の選定
    let candidates = selectElectionCandidates(members, party);

    // プレイヤーが出馬する場合、候補者リストに自分を確実にねじ込む！
    if (playerIsCandidate && typeof player !== "undefined" && player) {
        const alreadyIn = candidates.some(c => c.id === player.id);
        if (!alreadyIn) {
            candidates.unshift(player); // 先頭に追加
        }
    }

    // 候補者が2人未満の場合の無投票再選処理
    if (candidates.length < 2) {
        console.log(`🏛️ 【${pname}】対立候補が現れず、現党首がそのまま無投票再選しました。`);
        return;
    }

    // 2. NPCたちの投票先計算（思想の一致度で算出）
    const voteCounts = {};
    candidates.forEach(c => voteCounts[c.id] = 0);

    members.forEach(member => {
        // プレイヤー自身の自動投票はスキップ（後で手動選択）
        if (typeof player !== "undefined" && player && member.id === player.id) return;

        const chosenCandidate = getBestCandidateForMember(member, candidates);
        if (chosenCandidate) {
            voteCounts[chosenCandidate.id]++;
        }
    });

    const isPlayerInParty = (typeof player !== "undefined" && player && player.partyId === party.id);

    // -------------------------------------------------------------
    // 【非党員】自動開票 ＆ false通知
    // -------------------------------------------------------------
    if (!isPlayerInParty) {
        // 総投票数を計算
        const totalVotes = Object.values(voteCounts).reduce((sum, v) => sum + (v || 0), 0);
        const majorityThreshold = totalVotes / 2; // 過半数のライン

        // 1stラウンドの得票順にソート
        const sortedCands = [...candidates].sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0));

        let winner = sortedCands[0];
        let isRunoff = false;
        let runoffVoteCounts = {};

        // 💡 過半数を獲った候補がいない場合 ＝ 決選投票（上位2名）へ！
        if ((voteCounts[winner.id] || 0) <= majorityThreshold && sortedCands.length >= 2) {
            isRunoff = true;
            const top2 = [sortedCands[0], sortedCands[1]];

            // 上位2名で再投票シミュレーション（simulatePartyVote または独自ループ）
            if (typeof simulatePartyVote === 'function' && party.members) {
                runoffVoteCounts = simulatePartyVote(top2, party.members);
            } else {
                // フォールバック簡易決選投票（他候補の票を半分ずつ分配＋ランダム）
                runoffVoteCounts[top2[0].id] = voteCounts[top2[0].id] + Math.floor(totalVotes * 0.25);
                runoffVoteCounts[top2[1].id] = voteCounts[top2[1].id] + Math.floor(totalVotes * 0.25);
            }

            // 決選投票の勝者を決定
            winner = (runoffVoteCounts[top2[0].id] >= runoffVoteCounts[top2[1].id]) ? top2[0] : top2[1];
        }

        // -------------------------------------------------------------
        // 📝 1. 勝者の addhis（詳細な履歴）を追加
        // -------------------------------------------------------------
        if (typeof addhis === 'function') {
            const firstRoundVotes = voteCounts[winner.id] || 0;
            let historyText = "";

            if (isRunoff) {
                const runoffVotes = runoffVoteCounts[winner.id] || 0;
                // 🚨 途切れの原因となる「:」や「→」を排除し、安全な日本語に置き換え
                historyText = `${pname}代表選挙で勝利（1次投票で${firstRoundVotes}票、決選投票で${runoffVotes}票を獲得し新代表就任）`;
            } else {
                // 🚨 「/」を排除して「～票、総数～票」という表記に変更
                historyText = `${pname}代表選挙で勝利（1次投票で${firstRoundVotes}票を獲得、総数${totalVotes}票の過半数に到達）`;
            }

            // 安全なテキストを関数に渡す
            addhis(winner, historyText);
        }


        // 👑 党首データ更新
        party.leaderId = winner.id;
        party.nextElectionYear = gameDate.getFullYear();
        party.nextElectionYear += party.termLength;
        console.log(party.name + `の代表選挙を${party.nextElectionYear}年に設定しました（任期：${party.termLength}年）`)
        winner.partyId = party.id;

        // -------------------------------------------------------------
        // 📊 2. 通知用 HTML の生成
        // -------------------------------------------------------------
        let resultListHtml = sortedCands.map(c =>
            `<li>${c.id === winner.id ? "👑 " : ""}${c.name}: <b>${voteCounts[c.id] || 0}票</b></li>`
        ).join("");

        let runoffHtml = "";
        if (isRunoff) {
            const top2 = [sortedCands[0], sortedCands[1]];
            const r1 = runoffVoteCounts[top2[0].id] || 0;
            const r2 = runoffVoteCounts[top2[1].id] || 0;
            runoffHtml = `
            <hr>
            <p><b>🔥 決選投票結果（過半数未達のため上位2名で実施）:</b></p>
            <ul>
                <li>${top2[0].id === winner.id ? "👑 " : ""}${top2[0].name}: <b>${r1}票</b></li>
                <li>${top2[1].id === winner.id ? "👑 " : ""}${top2[1].name}: <b>${r2}票</b></li>
            </ul>
        `;
        }

        const bodyHtml = `
        <div style="font-size: 14px;">
            <p><b>【${pname}】</b>の代表選挙が実施され、<b>${winner.name}</b> 氏が新党首に選出されました！</p>
            <hr>
            <p><b>📊 1次投票結果 (総数: ${totalVotes}票):</b></p>
            <ul>${resultListHtml}</ul>
            ${runoffHtml}
        </div>
    `;

        pushNotificationTray(
            `${pname}・代表選決着`,
            `${winner.name} 氏が新党首に就任${isRunoff ? '（決選投票）' : ''}`,
            {
                title: `🗳️ ${pname} 代表選挙結果`, body: bodyHtml, buttons: [{
                    text: "了解",
                    callback: function (e) {
                        closeModal();
                    }
                },]
            },
            false
        );
    }
    // -------------------------------------------------------------
    // 【党員】投票通知を表示
    // -------------------------------------------------------------
    else {
        window.activeElectionData = {
            party: party,
            candidates: candidates,
            voteCounts: voteCounts
        };

        // 候補者一覧カードの生成
        let candidateCardsHtml = candidates.map(c => {
            const isMe = (typeof player !== "undefined" && player && c.id === player.id);
            const tag = isMe ? "⭐＜あなた（出馬中）＞" : `(XP:${c.xp || 0} / 資産:${(c.money || 0).toLocaleString()}円)`;

            return `
                <div style="border:1px solid #ccc; padding:8px; margin-bottom:8px; border-radius:5px; background:${isMe ? 'rgba(46, 204, 113, 0.1)' : 'rgba(0,0,0,0.03)'};">
                    <strong>${c.name}</strong> <small style="color:#666;">${tag}</small><br>
                    <button class="vote-btn" onclick="castPlayerVote('${c.id}')" style="margin-top:5px; padding:6px 14px; cursor:pointer; background:#2980b9; color:#fff; border:none; border-radius:4px;">
                        🗳️ ${isMe ? "自分（自分自身）に投票" : `${c.name}へ投票`}
                    </button>
                </div>
            `;
        }).join("");

        const bodyHtml = `
            <div style="font-size:14px; max-height:400px; overflow-y:auto;">
                <p>あなたが所属する <b>${pname}</b> の代表選挙（党首選）の投票です。</p>
                ${playerIsCandidate ? "<p style='color:#27ae60; font-weight:bold;'>🔥 あなたも候補者として出馬しています！</p>" : ""}
                <p>党の未来を決める1票を投じる候補者を選択してください。</p>
                <hr>
                ${candidateCardsHtml}
            </div>
        `;

        pushNotificationTray(
            `${pname}代表選挙`,
            `${pname}の代表を決める選挙が党本部にて開催されます！`,
            {
                title: `🗳️ ${pname} 代表選挙・投票`,
                body: bodyHtml,
                buttons: []
            },
            true
        );
    }
}

// -------------------------------------------------------------
// 💡 サポート関数1: 出馬候補者の選出ロジック
// -------------------------------------------------------------
function selectElectionCandidates(members, party) {
    if (!members) return [];

    // members が配列でもオブジェクトでも安全に配列化
    const memberList = Array.isArray(members) ? members : Object.values(members);
    const scoredMembers = [];

    for (let i = 0; i < memberList.length; i++) {
        const npc = memberList[i];
        if (!npc) continue;

        // 🛑 条件1: 現職大統領 / 元大統領は出馬しない
        const isCurrentPres = (typeof president !== 'undefined' && president && president.id === npc.id);
        const isFormerPres = (typeof pastPresidents !== 'undefined' && pastPresidents && pastPresidents.some(p => p && p.id === npc.id));
        if (isCurrentPres || isFormerPres) {
            continue; // 候補から除外
        }

        if (npc.chair_falling === true) continue;

        const xp = npc.xp || 0;
        const money = npc.money || 0;
        const age = npc.age || 18;
        const isRepOrSen = npc.rep || npc.sen; // 現職下院/上院議員フラグ

        // 📊 ベーススコア（XPが出馬の最重要軸 + 資金）
        let score = xp * 5 + (money / 100000);

        // 🌟 条件2: 現職議員（rep / sen）は出馬しやすい！
        if (isRepOrSen) {
            score += 150;
        }

        // 👑 条件3: 現職党首なら強力な継続意欲補正
        if (party && party.leaderId === npc.id) {
            score += 300;
        }

        // 👴 条件4: 高齢者判定（70歳以上は出馬しにくいが、高XPなら例外）
        if (age >= 70) {
            if (xp < 50) {
                // XPが低い高齢者は出馬意欲がほぼゼロに
                score -= 400;
            } else {
                // 高XP（実績豊富）な重鎮なら高齢でも出馬維持
                score += 50;
            }
        }

        // 🌱 条件5: 若手判定（35歳未満は立候補しにくい）
        if (age < 35) {
            score -= 100; // 基本的には立候補をためらう
        }

        // 🔥 条件6: 奇跡の出馬（無一文・若手・低XPでも巨大な野心補正でワンチャン出馬！）
        // ※強さ（スコアの計算）には影響せず、「出馬ラインに飛び込むかどうかの補正」として機能
        const isPennilessOrYouth = (money < 100000 && xp < 20) || age < 35;
        if (isPennilessOrYouth && Math.random() < 0.12) {
            score += Math.random() * 500 + 300; // 一気に上位候補へ躍進
            console.log(`🔥 奇跡の立候補！若手/無一文のダークホース【${npc.name || 'ID:' + npc.id}】（${age}歳）が代表選に出馬表明！`);
        }

        // スコアがマイナスに突っ込んだやつは切り捨てる
        if (score > 0) {
            scoredMembers.push({ npc: npc, score: score });
        }
    }

    // スコアが高い順にソートして、上位2〜4人を候補者として抜粋
    scoredMembers.sort((a, b) => b.score - a.score);
    const candidateCount = Math.min(scoredMembers.length, Math.floor(Math.random() * 3) + 2); // 2〜4人

    const finalCandidates = [];
    for (let i = 0; i < candidateCount; i++) {
        const selectedNpc = scoredMembers[i].npc;

        // 📝 実際に立候補が決まった上位NPCだけに履歴（addhis）を追加！
        if (selectedNpc && typeof addhis === 'function') {
            const partyName = party ? party.name : '政党';
            addhis(selectedNpc, `${partyName}代表選挙へ出馬`);
        }

        finalCandidates.push(selectedNpc);
    }

    return finalCandidates;
}
// -------------------------------------------------------------
// 💡 サポート関数2: NPC党員の投票先決定（性格・世代交代志向・現党首/プレイヤー補正を加味）
// -------------------------------------------------------------
function getBestCandidateForMember(member, candidates) {
    if (!member || !candidates || candidates.length === 0) return null;

    let bestCandidate = candidates[0];
    let bestMatchScore = -Infinity;

    // 候補者の中で「最高XP」と「最低XP」を特定（ポピュリスト補正用）
    let highestXpCand = candidates[0];
    let lowestXpCand = candidates[0];
    for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (c) {
            if ((c.xp || 0) > (highestXpCand?.xp || 0)) highestXpCand = c;
            if ((c.xp || 0) < (lowestXpCand?.xp || 0)) lowestXpCand = c;
        }
    }

    // 15%の確率でポピュリスト（本命叩き・逆張り傾向）化
    const isPopulist = Math.random() < 0.15;

    // candidates 配列を通常の for ループで安全にループ
    for (let i = 0; i < candidates.length; i++) {
        const cand = candidates[i];
        if (!cand) continue;

        // 自分自身が候補者の場合は絶対に自分を選ぶ！
        if (member.id === cand.id) {
            return cand;
        }

        // ----------------------------------------------------
        // 📊 各要素の評価計算
        // ----------------------------------------------------

        // 1. 思想の一致度
        let ideologyScore = 0;
        if (member.ideology && cand.ideology) {
            const diff0 = Math.abs(member.ideology[0] - cand.ideology[0]);
            const diff1 = Math.abs(member.ideology[1] - cand.ideology[1]);
            const diff2 = Math.abs(member.ideology[2] - cand.ideology[2]);
            ideologyScore = 300 - (diff0 + diff1 + diff2);
        } else {
            const diffEcon = Math.abs((member.econ || 0) - (cand.econ || 0));
            const diffDiplo = Math.abs((member.diplo || 0) - (cand.diplo || 0));
            const diffNation = Math.abs((member.nation || 0) - (cand.nation || 0));
            const ideologyDiff = (diffEcon + diffDiplo + diffNation) / 3;
            ideologyScore = Math.max(0, 300 - ideologyDiff * 5);
        }

        // 2. XP（キャリア・実績）の評価
        const xpScore = Math.sqrt(cand.xp || 0) * 5;

        // 3. 年齢評価（重鎮・ベテラン層の威厳）
        const age = cand.age || 18;
        let ageScore = 0;
        if (age >= 50 && age <= 70) ageScore = 30;
        else if (age >= 40 && age < 50) ageScore = 15;

        // 4. 人間関係・好感度
        const relVal = (member.relations && member.relations[cand.id]) ? member.relations[cand.id] : 0;
        const relationScore = relVal * 0.5;

        // ----------------------------------------------------
        // 👑 5. 現職・党首・プレイヤーの地位バフ（調整強化！）
        // ----------------------------------------------------
        let statusScore = 0;

        // 該当する党を取得（党IDや党名で参照）
        const partyKey = member.partyId || member.party;
        const partyObj = (typeof parties !== 'undefined' && parties[partyKey]) ? parties[partyKey] : null;

        // 現党首かどうかを判別
        const isCurrentPartyLeader = (partyObj && partyObj.leaderId === cand.id) || cand.isLeader || cand.isPartyLeader;

        // 大統領・元大統領の判別
        const isCurrentPres = (typeof president !== 'undefined' && president && president.id === cand.id);
        const isFormerPres = !isCurrentPres && (typeof pastPresidents !== 'undefined' && pastPresidents && pastPresidents.some(p => p && p.id === cand.id));

        // 🌟 役職バフの加算（累積または最大値で付与）
        if (isCurrentPartyLeader) {
            statusScore += 180; // 🔥 現党首バフ（組織票・現職プレミアム）
        }

        if (isCurrentPres) {
            statusScore += 150;
        } else if (isFormerPres) {
            statusScore += 50;  // 元大統領のバフを少し落ち着かせて党首が負けないように調整
        } else if (cand.rep || cand.sen) {
            statusScore += 30;
        }

        // 🎮 プレイヤー判別とバフ／補正
        const isPlayerCand = cand.isPlayer || cand.id === "player" || cand.id === player?.id;
        if (isPlayerCand) {
            // プレイヤーの知名度やカリスマ値があれば加算、なければ基本バフ+40
            const playerCharisma = cand.xp || 0;
            statusScore += playerCharisma;
        }

        // 6. 選挙の「勢い・風」（ランダム要素）
        const momentumScore = Math.random() * 50;

        // 総合スコア算出
        let totalScore = ideologyScore + xpScore + ageScore + relationScore + statusScore + momentumScore;

        // 💣 ポピュリスト（逆張り）補正
        if (isPopulist) {
            if (cand.id === highestXpCand?.id) totalScore -= 80;
            if (cand.id === lowestXpCand?.id) totalScore += 60;
            totalScore += Math.random() * 40;
        }

        if (totalScore > bestMatchScore) {
            bestMatchScore = totalScore;
            bestCandidate = cand;
        }
    }

    return bestCandidate;
}
// -------------------------------------------------------------
// 🗳️ プレイヤーが画面上のボタンを押して投票した時の処理
// -------------------------------------------------------------
function castPlayerVote(candidateId) {
    if (!window.activeElectionData) return;

    const { party, candidates, voteCounts, isRunoff } = window.activeElectionData;

    // 1. プレイヤーの1票を加算！
    if (voteCounts[candidateId] !== undefined) {
        voteCounts[candidateId] += 1;
    }

    // 総投票数の計算
    const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

    // 得票順にソート
    const sortedCandidates = [...candidates].sort((a, b) => voteCounts[b.id] - voteCounts[a.id]);

    const topCandidate = sortedCandidates[0];
    const runnerUp = sortedCandidates[1];

    // 過半数の閾値（50%を超える票数）
    const majorityThreshold = Math.floor(totalVotes / 2) + 1;

    // -------------------------------------------------------------
    // 🔥 決選投票の発生判定！
    // 候補者が3人以上 ＆ 1位が過半数を獲れていない ＆ まだ決選投票前の場合
    // -------------------------------------------------------------
    if (!isRunoff && candidates.length >= 3 && voteCounts[topCandidate.id] < majorityThreshold) {
        console.log(`🔥 【${party.name}】1次投票で過半数を得た候補がおらず、決選投票へ突入！`);

        // 決選投票用のデータを再セット（上位2名のみに絞り込み）
        const runoffCandidates = [topCandidate, runnerUp];

        for (let i = 0; i < runoffCandidates.length; i++) {
            const npc = runoffCandidates[i];
            if (npc && typeof addhis === 'function') {
                addhis(npc, "決選投票へ進出。");
            }
        }
        const runoffVoteCounts = {};
        runoffCandidates.forEach(c => runoffVoteCounts[c.id] = 0);

        // NPCたちが上位2名に対して再投票（思想が近い方へ）
        const partyMembers = npcs.filter(npc => npc.partyId === party.id);
        partyMembers.forEach(member => {
            if (typeof player !== "undefined" && player && member.id === player.id) return;

            const chosen = getBestCandidateForMember(member, runoffCandidates);
            if (chosen) {
                runoffVoteCounts[chosen.id]++;
            }
        });

        window.activeElectionData = {
            party: party,
            candidates: runoffCandidates,
            voteCounts: runoffVoteCounts,
            isRunoff: true,
            // 🌟 1次投票の結果を保存しておく！
            firstRoundData: {
                firstCandidates: candidates,
                firstVoteCounts: voteCounts,
                firstTotalVotes: totalVotes
            }
        };
        // 古い画面の掃除
        closeModal();

        // 決選投票の案内 ＆ 投票モーダルの呼び出し
        setTimeout(() => {
            showRunoffVoteModal(party, runoffCandidates, topCandidate, runnerUp, voteCounts);
        }, 100);

        return; // ここで1回処理を抜ける！
    }
    // -------------------------------------------------------------
    // 👑 勝者決定＆結果表示（過半数達成 または 決選投票終了時）
    // -------------------------------------------------------------
    const maxVotes = Math.max(...Object.values(voteCounts));
    const winner = sortedCandidates[0];

    // 党首データを更新
    party.leaderId = winner.id;
    party.nextElectionYear = gameDate.getFullYear();
    party.nextElectionYear += party.termLength;
    console.log(party.name + `の代表選挙を${party.nextElectionYear}年に設定しました（任期：${party.termLength}年）`)
    winner.partyId = party.id;
    if (winner) {
        addhis(winner, `${sortedCandidates[1]}との戦いを制し${party.name}代表選挙に勝利、当選`)
    }

    // 開票一覧（今回の投票結果）の生成
    let resultRowsHtml = sortedCandidates.map(c => {
        const votes = voteCounts[c.id];
        const pct = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : "0.0";
        const isWinner = (c.id === winner.id);
        const isMaxVote = (votes === maxVotes);
        const isPlayerChoice = (c.id === candidateId);

        let badges = "";
        if (isWinner) badges += " 👑<span style='color:#e67e22; font-weight:bold;'>【当選】</span>";
        else if (isMaxVote) badges += " 🔥<span style='color:#e74c3c;'>【最多得票】</span>";

        if (isPlayerChoice) badges += " <small style='color:#2980b9;'>(あなたの1票)</small>";

        return `
            <div style="border-bottom: 1px solid #eee; padding: 8px 4px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${c.name}</strong> ${badges}
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 1.1em; font-weight: bold;">${votes.toLocaleString()}票</span>
                    <small style="color: #666; font-size: 0.85em;">(${pct}%)</small>
                </div>
            </div>
        `;
    }).join("");

    // 🌟【新機能】決選投票の場合は「1次（初回）投票の結果一覧」も作成！
    let firstRoundHtml = "";
    if (isRunoff && window.activeElectionData.firstRoundData) {
        const { firstCandidates, firstVoteCounts, firstTotalVotes } = window.activeElectionData.firstRoundData;

        const sortedFirst = [...firstCandidates].sort((a, b) => firstVoteCounts[b.id] - firstVoteCounts[a.id]);

        let firstRows = sortedFirst.map(c => {
            const votes = firstVoteCounts[c.id];
            const pct = firstTotalVotes > 0 ? ((votes / firstTotalVotes) * 100).toFixed(1) : "0.0";
            const isQualified = (c.id === sortedCandidates[0].id || c.id === sortedCandidates[1].id);

            return `
                <div style="border-bottom: 1px solid #eee; padding: 4px 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.9em; color: #555;">
                    <div>
                        ${c.name} ${isQualified ? " <span style='color:#e74c3c; font-size:0.85em;'>[決選進出]</span>" : " <span style='color:#7f8c8d; font-size:0.85em;'>[落選]</span>"}
                    </div>
                    <div>
                        <b>${votes}票</b> (${pct}%)
                    </div>
                </div>
            `;
        }).join("");

        firstRoundHtml = `
            <div style="background: rgba(0,0,0,0.02); border: 1px dashed #bbb; border-radius: 6px; padding: 8px 10px; margin-bottom: 12px;">
                <div style="font-weight: bold; margin-bottom: 4px; color: #555; font-size: 0.9em;">
                    📋 1次投票結果 (総数: ${firstTotalVotes}票)
                </div>
                ${firstRows}
            </div>
        `;
    }

    const titlePrefix = isRunoff ? "【決選投票】" : "";
    const bodyContent = `
        <div style="font-size: 14px; line-height: 1.5;">
            <p style="margin-bottom: 10px;">
                <b>【${party.name}】</b> ${titlePrefix}代表選挙の全開票が終了しました。<br>
                激闘の結果、<b>${winner.name}</b> 氏が新党首に選出されました！
            </p>
            
            ${firstRoundHtml} <!-- 💡 決選投票時のみ1次投票結果を表示 -->

            <div style="background: rgba(0,0,0,0.03); border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 2px solid #ccc; padding-bottom: 4px;">
                    📊 ${titlePrefix}最終開票結果一覧 (総投票数: ${totalVotes}票)
                </div>
                ${resultRowsHtml}
            </div>
        </div>
    `;


    showModal(
        `🗳️ ${party.name} 代表選挙・最終開票結果`,
        bodyContent,
        [
            {
                text: "確認して閉じる",
                callback: function () {
                    closeModal();
                    window.activeElectionData = null;
                    if (typeof updateStatusUI === "function") updateStatusUI();
                }
            }
        ]
    );
}

// -------------------------------------------------------------
// 💡 決選投票用の案内＆投票モーダル表示関数
// -------------------------------------------------------------
function showRunoffVoteModal(party, runoffCandidates, top1, top2, firstVoteCounts) {
    let candidateCardsHtml = runoffCandidates.map(c => {
        const isMe = (typeof player !== "undefined" && player && c.id === player.id);
        const tag = isMe ? "⭐＜あなた（決選進出）＞" : `(1次得票: ${firstVoteCounts[c.id]}票)`;

        return `
            <div style="border:1px solid #e74c3c; padding:10px; margin-bottom:8px; border-radius:5px; background:${isMe ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.05)'};">
                <strong>${c.name}</strong> <small style="color:#666;">${tag}</small><br>
                <button class="vote-btn" onclick="castPlayerVote('${c.id}')" style="margin-top:6px; padding:6px 14px; cursor:pointer; background:#e74c3c; color:#fff; border:none; border-radius:4px; font-weight:bold;">
                    🗳️ 決選投票: ${isMe ? "自分に投じる" : `${c.name} 氏に投じる`}
                </button>
            </div>
        `;
    }).join("");

    const bodyHtml = `
        <div style="font-size:14px; line-height:1.5;">
            <p style="color:#e74c3c; font-weight:bold; font-size:1.05em;">
                ⚠️ 1次投票で過半数（50%超）を獲得した候補がいなかったため、上位2名による【決選投票】を行います！
            </p>
            <p>1位: <b>${top1.name}</b>（${firstVoteCounts[top1.id]}票） / 2位: <b>${top2.name}</b>（${firstVoteCounts[top2.id]}票）</p>
            <hr>
            <p>党の最終決定となる1票を投じてください！</p>
            ${candidateCardsHtml}
        </div>
    `;

    showModal(
        `🔥 決選投票！ 【${party.name}】 代表選挙`,
        bodyHtml,
        []
    );
}
// 党首が不在（死亡・引退・他党へ移籍・null）になっている党を探して代表選を開く関数
function checkVacantPartyLeaders() {
    if (typeof parties === 'undefined') return;

    Object.keys(parties).forEach(partyKey => {
        if (partyKey === 'independents') return; // 無所属はスキップ

        const partyObj = parties[partyKey];
        if (!partyObj) return;

        const leaderId = partyObj.leaderId;
        const leaderNpc = leaderId && typeof npcs !== 'undefined'
            ? [player, ...npcs].find(n => n.id === leaderId)
            : null;

        // ----------------------------------------------------
        // 🔥 【追加】週次ランダム辞任・引き降ろしシミュレーション
        // ----------------------------------------------------
        if (leaderNpc) {
            if (leaderNpc.id === player.id) return;
            // 1. 各種パラメーターの取得（未定義対策付き）
            const age = leaderNpc.age || 50;
            const xp = leaderNpc.xp || 0;
            const personality = leaderNpc.personality || "normal"; // 性格フラグ（例: "stubborn" = 頑固）

            // 2. 基本辞任確率（週次 0.5% : 健康問題や一身上の都合など）
            let resignationChance = 0.005;

            // 3. 【年齢要素】高齢リスク（70歳を超えると徐々に、80歳超えで一気に確率アップ）
            if (age >= 80) {
                resignationChance += 0.05; // 80歳以上は毎週+5%リスク
            } else if (age >= 70) {
                resignationChance += 0.02; // 70歳以上は毎週+2%リスク
            }

            // 4. 【XP要素】政治資本・求心力の低下（XPが200未満で叩かれ始め、100未満で針の mushろ）
            if (xp < 100) {
                resignationChance += 0.08; // 求心力ゼロ。党内抗争・引き降ろしリスク激増 (+8%)
            } else if (xp < 200) {
                resignationChance += 0.03; // 支持率低迷。党内不満 (+3%)
            }

            // 5. 【頑固さ要素】性格による抵抗（頑固な奴はプレッシャーを半減させる）
            // ※ 性格プロパティがない場合でも、特定のフラグや確率で「頑固者」として判定させてもOKです
            const isStubborn = personality === "stubborn" || (leaderNpc.isGanko === true) || false;
            if (isStubborn) {
                // 頑固者はどれだけ叩かれても辞任確率が「半分」になる（老害・居座りムードの再現）
                resignationChance = resignationChance * 0.5;
            }

            // 6. 最終ダイスロール（確率判定）
            if (Math.random() < resignationChance) {
                let resignReason = "一身上の都合";
                if (xp < 200 && age >= 70) {
                    resignReason = `高齢（${age}歳）および党内求心力低下（XP: ${xp}）による引責辞任`;
                } else if (xp < 200) {
                    resignReason = `党内支持率の低迷・求心力低下（XP: ${xp}）による引責辞任`;
                } else if (age >= 70) {
                    resignReason = `高齢（${age}歳）による健康上の理由での勇退`;
                }

                if (isStubborn) {
                    resignReason = `【政界激震】頑固として拒否し続けたものの、ついに党内造反により引き降ろされました (${resignReason})`;
                }

                leaderNpc.chair_falling = true

                console.log(`🚨 【党首辞任】${partyObj.partyName || partyKey} の党首 ${leaderNpc.name} 氏が辞任を発表しました。（理由: ${resignReason}）`);

                // 党首IDを消去して、下の「党首不在チェック」へそのまま流す
                partyObj.leaderId = null;
            }
        }

        // ----------------------------------------------------
        // 🚨 以下は元の判定ロジック（そのまま機能します）
        // ----------------------------------------------------
        // ※辞任した場合はここで leaderId が null になっているため、確実に緊急代表選が動きます
        const updatedLeaderId = partyObj.leaderId;
        const isBelongingToThisParty = leaderNpc && (
            leaderNpc.party === partyKey ||
            leaderNpc.party === partyObj.partyName ||
            leaderNpc.partyName === partyObj.partyName
        );

        if (!updatedLeaderId || !leaderNpc || !isBelongingToThisParty) {
            let reason = "死亡・引退等";
            // 上の処理で自発的に辞任していた場合は、理由を上書き
            if (!updatedLeaderId && leaderNpc) {
                reason = "自発的な辞任または党内抗争による失脚";
            } else if (leaderNpc && !isBelongingToThisParty) {
                reason = `他党（${leaderNpc.partyName || leaderNpc.party || '別組織'}）へ移籍済み`;
            }

            console.log(`⚠️ 【党首不在】${partyObj.partyName || partyKey} の党首が不在（理由: ${reason}）のため、緊急代表選を開催します。`);

            partyObj.leaderId = null;

            if (typeof holdPartyLeadershipElection === 'function') {
                holdPartyLeadershipElection(partyObj);
            } else {
                console.log(`💡 holdPartyLeadershipElection 関数が見つからないため、自動選出などの代替処理を行ってください。`);
            }
        }
    });
}

// 👑 選挙結果に伴う党首進退（辞任）判定ロジック（党首落選は即アウト版）
function processLeaderResignationCheck(kokujimae, partySeatsWon) {
    console.log("kokujimae:", kokujimae);
    console.log("partySeatsWon:", partySeatsWon);

    if (!kokujimae || !partySeatsWon) {
        console.log("データがないため処理を中断します");
        return;
    }

    Object.keys(kokujimae).forEach(partyKey => {
        if (partyKey === 'independents') return;

        const beforeData = kokujimae[partyKey];
        if (!beforeData) return;

        const partyObj = (typeof parties !== 'undefined' && parties[partyKey]) ? parties[partyKey] : beforeData;
        const partyName = partyObj.partyName || beforeData.partyName;

        // 党首IDの取得
        const leaderId = partyObj.leaderId || beforeData.leaderId;
        if (!leaderId) {
            console.log(`【${partyName}】 党首IDが見つかりません`);
            return;
        }

        // ---------------------------------------------------------
        // 🔍 npcs 配列から党首を探すロジック
        // ---------------------------------------------------------
        let leader = null;

        if (leaderId === "player") {
            leader = typeof player !== 'undefined' ? player : null;
        } else if (typeof npcs !== 'undefined' && Array.isArray(npcs)) {
            leader = npcs.find(n => n.id === leaderId);
        } else if (typeof allNpcs !== 'undefined' && Array.isArray(allNpcs)) {
            leader = allNpcs.find(n => n.id === leaderId);
        } else if (window.npcs && Array.isArray(window.npcs)) {
            leader = window.npcs.find(n => n.id === leaderId);
        }

        if (!leader && partyObj.members && Array.isArray(partyObj.members)) {
            leader = partyObj.members.find(m => m.id === leaderId);
        }

        if (!leader) {
            console.log(`【${partyName}】 党首（ID: ${leaderId}）のNPCデータを見つけられませんでした`);
            return;
        }

        // ---------------------------------------------------------
        // 🚨 【最優先・追加】党首本人の「落選チェック（即アウト判定）」
        // 🚨 条件: 告示前に議員（repかsenがtrue）であり、今回落選して両方falseになった場合
        // ---------------------------------------------------------
        // ※ 告示前の議員ステータスを leader.wasSeat や beforeData から追えない場合を考慮し、
        // 現職議員だったNPCが総選挙の結果、議席（rep, sen）を両方失ったかを判定します
        const isCurrentlySeat = leader.rep || leader.sen || false;

        // 💡 プレイヤーの落選即アウト処理
        if (leaderId === "player" && !isCurrentlySeat) {
            console.log(`🚨 【プレイヤー落選】${partyName}代表の${leader.name}氏は、自身の議席を失ったため強制解任となります。`);
            addhis(leader, `${partyName}代表（総選挙で自身が落選したため引責辞任）`);
            partyObj.leaderId = null;

            pushNotificationTray(
                `${partyName}・代表失職`,
                `${player.name}代表、小選挙区・比例ともに落選。党規約に基づき代表を自動失職しました。`,
                {
                    title: `💥 ${partyName} 代表失職（落選）`,
                    body: `<div style="font-size: 14px;"><p><b>【${partyName}】</b>の <b>${player.name}</b> 代表は、今回の総選挙で自身の議席を失う<b>まさかの落選</b>を喫したため、党規約により代表の座を自動失職（強制解任）となりました。</p></div>`,
                    buttons: []
                },
                true
            );
            if (typeof holdPartyLeadershipElection === 'function') {
                holdPartyLeadershipElection(partyObj);
            }
            return;
        }

        // 💡 NPC党首の落選即アウト処理
        if (leaderId !== "player" && !isCurrentlySeat) {
            console.log(`🚨 【党首落選による即アウト】${partyName}の党首 ${leader.name} 氏が落選したため、党の状況に関係なく強制解任です。`);

            addhis(leader, `自身が落選したため、${partyName}代表を辞任`);
            partyObj.leaderId = null; // 即時解任

            const bodyHtml = `
                <div style="font-size: 14px;">
                    <p><b>【${partyName}】</b>の <b>${leader.name}</b> 代表は、今回の総選挙で<b>自身が落選</b>したため、辞任を表明した。</p>
                </div>
            `;

            if (typeof holdPartyLeadershipElection === 'function') {
                holdPartyLeadershipElection(partyObj);
            }

            if (typeof pushNotificationTray === 'function') {
                pushNotificationTray(
                    `${partyName} 代表が落選`,
                    `${leader.name}氏が自身の落選により辞任`,
                    {
                        title: `☠️ ${partyName} 代表の辞任`, body: bodyHtml, buttons: [
                            {
                                text: "了解"
                            }
                        ]
                    },
                    false
                );
            }
            leader.chair_falling = true;
            return; // 💡 落選で処理が完了したため、以降の議席減少チェックはスキップ
        }

        // ---------------------------------------------------------
        // 📊 以下は生存（当選）した場合の、通常の「議席減少」による辞任チェック
        // ---------------------------------------------------------
        const beforeSeats = beforeData.seats || 0;
        const currentSeats = partySeatsWon[partyKey] !== undefined
            ? partySeatsWon[partyKey]
            : (partySeatsWon[partyName] !== undefined ? partySeatsWon[partyName] : 0);

        const seatLoss = beforeSeats - currentSeats;

        // 🟢 議席維持、または増加なら辞任チェックを行わない
        if (seatLoss <= 0) {
            console.log(`【${partyName}】 告示前:${beforeSeats} ➔ 獲得:${currentSeats} (増加/維持のためスキップ)`);
            return;
        }

        console.log(`【${partyName}】 告示前:${beforeSeats} ➔ 獲得:${currentSeats} (${seatLoss}議席減少)`);

        // プレイヤーが議席は死守したものの、党の議席を減らした場合の要請
        if (leaderId === "player") {
            pushNotificationTray(
                `${partyName}党員からの要請`,
                `${partyName}のある党員は、「${player.name}代表は議席を大きく減らした、党の未来のためにも辞任してほしい」と要請された、どうする？`,
                {
                    title: `${partyName}党員からの要請`,
                    body: `${partyName}のある党員は、「${player.name}代表は議席を大きく減らした、党の未来のためにも辞任してほしい」と要請された、どうする？`,
                    buttons: [
                        {
                            text: "辞任する",
                            className: "scout-btn",
                            callback: () => {
                                addhis(leader, `${partyName}代表（総選挙で${seatLoss}議席減の責任をとり辞任）`);
                                partyObj.leaderId = null;
                                holdPartyLeadershipElection(partyObj);
                            }
                        },
                        {
                            text: "要請を拒否し、代表の座に留まる",
                            className: "scout-btn",
                            callback: () => {
                                addhis(leader, `${partyName}総選挙で${seatLoss}議席減るも党首続投を表明`);
                            }
                        }
                    ]
                },
                true
            );
            return;
        }

        // NPC党首の議席減少による辞任確率計算
        let resignationChance = seatLoss * 1.5;
        if (seatLoss >= 100) resignationChance += 80;

        const xp = leader.xp || 0;
        const age = leader.age || 40;

        if (xp >= 80) resignationChance += 25;
        else resignationChance -= 20;

        if (age >= 70) resignationChance -= 35;

        resignationChance = Math.max(5, Math.min(98, resignationChance));

        // 🎲 判定実行
        const isResigning = (Math.random() * 100) < resignationChance;

        if (isResigning) {
            console.log(`🚨 【辞任決定】${leader.name} 氏（辞任確率: ${resignationChance.toFixed(1)}%）`);
            addhis(leader, `自身が落選したため、${partyName}代表を辞任`);

            if (xp >= 80) {
                leader.xp = (leader.xp || 0) + 10;
                console.log(`✨ 【高評価】${leader.name} 氏は潔く辞任したことで政治的評価が高まりました。`);
            }

            partyObj.leaderId = null;

            const bodyHtml = `
                <div style="font-size: 14px;">
                    <p><b>【${partyName}】</b>の <b>${leader.name}</b> 代表は、今回の総選挙で<b>${seatLoss}議席を失う大敗</b>を喫した責任を取り、党首を辞任することを表明しました。</p>
                    <hr>
                    <p>📊 議席変化: ${beforeSeats} 議席 ➔ <b>${currentSeats} 議席</b></p>
                </div>
            `;

            if (typeof holdPartyLeadershipElection === 'function') {
                holdPartyLeadershipElection(partyObj);
            }

            if (typeof pushNotificationTray === 'function') {
                pushNotificationTray(
                    `${partyName}・党首辞任`,
                    `${leader.name} 氏が敗戦の責任をとり辞任`,
                    { title: `💥 ${partyName} 代表辞任のお知らせ`, body: bodyHtml, buttons: [] },
                    false
                );
            }
        } else {
            console.log(`😈 【続投】${leader.name} 氏は ${seatLoss} 議席減るも残留（辞任確率: ${resignationChance.toFixed(1)}%）`);
            addhis(leader, `${partyName}総選挙で${seatLoss}議席減るも代表続投を表明`);
        }
    });
}
