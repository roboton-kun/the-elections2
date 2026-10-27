// 💡 プレイヤーが今回の選挙に立候補しているかどうかを管理するフラグ
let isPlayerRunningInElection = false;
let rulingparty = [];
let opposition = []
let largest_opoosition = null;

/**
 * ⏰ 毎日（毎ターン）の最後に呼び出すカウンター
 */
function checkElectionTimer() {
    gameDaysCount++;

    // 4年に一度、または任期満了の日に「選挙の公示（トレイ）」を発火
    if (gameDaysCount % ELECTION_TERM_DAYS === 0) {
        announceHouseOfRepresentativesElection(); // 📊 まずはトレイを飛ばす！
    }
}


function announceHouseOfRepresentativesElection() {

    // 初期化
    isPlayerRunningInElection = false;
    const currentCount = (typeof gameSessionElectionCount !== "undefined" && gameSessionElectionCount > 0)
        ? gameSessionElectionCount
        : (window.generalelectionhistory ? window.generalelectionhistory.length + 1 : 1);
    // 選挙特設モーダル（トレイをタップした時に開く中身）のHTML
    let announceHTML = `
        <div style="background:linear-gradient(135deg, #1a202c 0%, #2d3748 100%); padding:14px; border-radius:8px; border:2px solid #e53e3e; text-align:center; margin-bottom:12px;">
            <span style="font-size:11px; font-weight:bold; color:#f56565; letter-spacing:1px;">⚠️ NATIONAL EVENT</span>
            <h2 style="font-size:18px; font-weight:bold; margin:4px 0; color:#fff;">🏛️ 第${currentCount}回下院議員総選挙・公示</h2>
            <span style="font-size:11px; color:#a0aec0;">定数3 中選挙区制 / 4年の任期満了に伴う総選挙</span>
        </div>
        <div style="background:#1a202c; padding:10px; border-radius:6px; border:1px solid #4a5568; margin-bottom:12px;">
            <p id="playerRunStatusText" style="font-size:12px; color:#e2e8f0; margin:0;">現在は【未立候補】です。裏方に徹するか、あなたの拠点（${player.pref}）から出馬するか選択してください。</p>
        </div>
    `;
    if (player.sen) {
        const statusText = document.getElementById("playerRunStatusText");
        if (statusText) {
            statusText.innerHTML = `<strong>【立候補不可】</strong> あなたは <strong>上院議員</strong> です、下院選挙に出馬はできません。`;
            statusText.style.color = "#ff0000";
        }
        pushNotificationTray(
            "下院総選挙の公示 🗳️",
            "4年の任期が満了しました！タップして立候補手続き・選挙画面を開きます",
            {
                title: "🏛️ 選挙管理委員会",
                body: announceHTML,
                buttons: [
                    {
                        text: "🗳️ 投票開始（開票シミュレーション実行）",
                        className: "scout-btn", // ガチ選挙実行（グリーン）
                        keepOpen: true, // 投票が終わるのでモーダルを閉じる
                        callback: () => {
                            // ⚡ ここで初めてガチ選挙計算を回す！
                            triggerHouseOfRepresentativesElection();
                        }
                    }
                ]
            },
            true // 🌟 タップして選挙画面で「投票開始」を押すまで次の日に進ませない！
        );
        return;
    }
    if (player.rep) {
        isPlayerRunningInElection = true
        announceHTML += `<h1>あなたは現在、現職議員です。</h1>`
    }
    // 💡 トレイ（通知バナー）をピコン！と飛ばす。タップするまで進行は完全ブロック
    pushNotificationTray(
        "下院総選挙の公示 🗳️",
        "4年の任期が満了しました！タップして立候補手続き・選挙画面を開きます",
        {
            title: "🏛️ 選挙管理委員会",
            body: announceHTML,
            buttons: [
                {
                    text: `✋ ${player.pref}から立候補する`,
                    className: "bribe-btn", // 重厚なゴールド（出馬表明）
                    keepOpen: true, // 状態を上書きするので閉じない
                    callback: () => {
                        isPlayerRunningInElection = true;
                        const statusText = document.getElementById("playerRunStatusText");
                        if (statusText) {
                            statusText.innerHTML = `🟢 <strong>【立候補確定】</strong> あなたは <strong>${player.pref}</strong> 選挙区から出馬します！`;
                            statusText.style.color = "#48bb78";
                        }
                    }
                },
                {
                    text: "🤝 自分は出馬せず、お仲間の応援（裏方）に回る",
                    className: "close-btn", // ダークグレー
                    keepOpen: true,
                    callback: () => {
                        isPlayerRunningInElection = false;
                        const statusText = document.getElementById("playerRunStatusText");
                        if (statusText) {
                            statusText.innerHTML = `⚪ <strong>【裏方に専念】</strong> あなたは今回出馬せず、党の議席拡大をバックアップします。`;
                            statusText.style.color = "#a0aec0";
                        }
                    }
                },
                {
                    text: "🗳️ 投票開始（開票シミュレーション実行）",
                    className: "scout-btn", // ガチ選挙実行（グリーン）
                    keepOpen: true, // 投票が終わるのでモーダルを閉じる
                    callback: () => {
                        // ⚡ ここで初めてガチ選挙計算を回す！
                        triggerHouseOfRepresentativesElection();
                    }
                }
            ]
        },
        true // 🌟 タップして選挙画面で「投票開始」を押すまで次の日に進ませない！
    );
}

let house_kokujimae = {};

function triggerHouseOfRepresentativesElection() {
    const regionalCandidates = {};
    const partySeatsWon = {};

    let kokujimae = {};

    if (typeof parties !== 'undefined') {
        Object.values(parties).forEach(party => {
            // 下院議員（rep）かつ該当政党のNPC IDだけ抽出
            const repMemberIds = npcs
                .filter(npc => npc.rep && npc.partyId === party.id)
                .map(npc => npc.id);

            // 告示前の状態として保存
            kokujimae[party.id] = {
                partyName: party.name || party.id,
                seats: repMemberIds.length,
                memberIds: repMemberIds
            };
        });
    }

    console.log("📊 告示前勢力:", kokujimae);
    house_kokujimae = kokujimae;


    [player, ...npcs].forEach(m => {
        m.rep = false;
    });

    // 1. 💡 プレイヤーが出馬ボタンを明確に押した場合のみ、候補者リストに登録する！
    if (player && isPlayerRunningInElection) {
        player.currentVotes = 0;
        player.rep = false;
        player.partyId = player.partyId || null;

        const prefMap = cityToDistrictMap[player.pref];
        const playerDist = prefMap ? (prefMap[player.city] || 1) : 1;

        if (!regionalCandidates[player.pref]) regionalCandidates[player.pref] = {};
        if (!regionalCandidates[player.pref][playerDist]) regionalCandidates[player.pref][playerDist] = [];

        regionalCandidates[player.pref][playerDist].push(player);
    }

    // 2. 条件を満たしたNPCを確率で立候補者として追加
    const totalNpcs = npcs.length;

    for (let i = 0; i < totalNpcs; i++) {
        const cand = npcs[i];
        if (president && president.id === cand.id) continue;
        if (vicepresident && vicepresident.id === cand.id) continue;
        if (cand.sen) continue;
        if (cand.age <= 25) continue;

        if (cand.money < 500000) continue;
        // 💡【修正】直球で null ではない、かつ undefined でもないことをチェック！
        if (presidentElect !== null && typeof presidentElect !== 'undefined') {
            if (cand.id === presidentElect.id) continue;
        }
        if (vicepresidentElect !== null && typeof vicepresidentElect !== 'undefined') {
            if (cand.id === vicepresidentElect.id) continue;
        }
        if (cand.sen) continue;
        if (typeof pastPresidents !== 'undefined' && pastPresidents) {
            const isPastPresident = pastPresidents.some(p => p.id === cand.id);
            if (isPastPresident) continue;
        }

        const prefMap = cityToDistrictMap[cand.pref];
        const dist = prefMap ? (prefMap[cand.city] || 1) : 1;

        // 💡 1. 候補者配列の初期化チェック
        if (!regionalCandidates[cand.pref]) regionalCandidates[cand.pref] = {};
        if (!regionalCandidates[cand.pref][dist]) regionalCandidates[cand.pref][dist] = [];

        const currentCandidates = regionalCandidates[cand.pref][dist];

        // 💡 主要政党（先頭2つの政党）のIDを取得
        const partyArray = Array.isArray(parties) ? parties : Object.values(parties || {});
        const majorPartyIds = [partyArray[0]?.id, partyArray[1]?.id].filter(Boolean);

        // 💡 2. 【被り防止＆枠制限】
        if (cand.partyId && cand.partyId !== null) {
            // 同一政党からの重複出馬を防止
            const hasSameParty = currentCandidates.some(c => c.partyId === cand.partyId);
            if (hasSameParty) continue;

            // 主要政党（0番目・1番目）以外の「諸派」判定
            const isMajorParty = majorPartyIds.includes(cand.partyId);

            if (!isMajorParty) {
                // 1区あたり諸派は最大1人まで！
                const minorPartyCount = currentCandidates.filter(c => c.partyId && !majorPartyIds.includes(c.partyId)).length;
                if (minorPartyCount >= 1) continue;
            }
        } else {
            // 💡 無所属（partyId が null/空）は1区あたり最大2人まで！
            const independentCount = currentCandidates.filter(c => !c.partyId).length;
            if (independentCount >= 2) continue;
        }

        // 💡 3. 出馬確率の判定（現職 bonus や XP 判定）
        // 💡 3. 出馬確率の判定（現職 bonus や XP 判定）
        const isRepBonus = cand.rep ? 0.6 : 0;
        let finalProbability = 0.1 + (cand.xp / 100) + isRepBonus;

        // ─── 🚨【追加】2大政党制モード時の立候補ブレーキ ───
        if (typeof twoparty !== "undefined" && twoparty) {
            const pId = cand.partyId;
            const isMajorParty = majorPartyIds.includes(pId);

            if (!pId || pId === null) {
                // 無所属：出馬率を極限まで下げる（例: 9割引、または一律1%など）
                finalProbability *= 0.1;
            } else if (!isMajorParty) {
                // サードパーティ（第3党以下）：当選可能性がゼロに近いので出馬率を激減させる
                finalProbability *= 0.05; // 95%カット（現職持ちでもほぼ出馬を諦めるレベル）
            }
        }

        if (Math.random() > finalProbability) continue;

        // 出馬確定後の処理
        cand.money -= 500000;
        cand.currentVotes = 0;
        cand.rep = false;

        currentCandidates.push(cand);
    }

    const countr22yKey = localStorage.getItem("poligame_data")
        ? JSON.parse(localStorage.getItem("poligame_data")).countrySelect || "jp"
        : "jp";

    // 2. 選択された国のデータを取得
    const selectedCountry = country[countr22yKey];
    for (const pref in selectedCountry.pref) {
        // 💡 有権者側と同じ計算式で、その州に存在する「正しく計算された総区数」を取得！
        const prefecture = selectedCountry.pref[pref];
        const adjustedPop = prefecture.pop || 1;
        let TOTAL_SINGLE_SEATS = Math.round(totalHouseSeats * 0.62); // 465なら289
        if (!hirei_house) {
            TOTAL_SINGLE_SEATS = totalHouseSeats;

        }
        // 💡【追加】全県の pop を全部足して、本当の合計値を出す（100とは限らないため）
        const totalPopSum = Object.values(selectedCountry.pref).reduce((sum, p) => sum + (p.pop || 1), 0);

        const districtCount = Math.max(1, Math.round((adjustedPop / totalPopSum) * TOTAL_SINGLE_SEATS));
        const prefMap = cityToDistrictMap[pref] || {};

        if (!regionalCandidates[pref]) {
            regionalCandidates[pref] = {};
        }

        // 💡 definedDists を cityToDistrictMap から取るのではなく、
        // 確実に 1区 〜 districtCount区 (13区) までループを回す！
        for (let distNum = 1; distNum <= districtCount; distNum++) {
            if (!regionalCandidates[pref][distNum]) {
                regionalCandidates[pref][distNum] = [];
            }

            // 刺客NPCの補充（各区に最低2人の候補者を確保）
            while (regionalCandidates[pref][distNum].length < 2) {
                // その区に対応する街があれば取得、無ければランダムまたは「中心街」
                let cityInThisDist = Object.keys(prefMap).find(c => prefMap[c] === distNum);

                if (!cityInThisDist && prefecture.cities && prefecture.cities.length > 0) {
                    // 区番号などを元に、その州の都市リストから均等に選出
                    cityInThisDist = prefecture.cities[(distNum - 1) % prefecture.cities.length];
                }

                // 万が一都市リスト自体が無い場合のみフォールバック
                if (!cityInThisDist) {
                    cityInThisDist = `${pref}中央区`; // 「中心街」より選挙っぽい名称に！
                }

                const countryKey = localStorage.getItem("poligame_data")
                    ? JSON.parse(localStorage.getItem("poligame_data")).countrySelect || "jp"
                    : "jp";

                const secretNpcId = "npc_" + Math.random().toString(36).substring(2, 11);
                const kettei_ic = ["adventurer", "avataaars", "bottts", "lorelei"][Math.floor(Math.random() * 4)];
                const currentCountryData = country[countryKey];

                const randomFirst = getRandomElement(currentCountryData.firstnames);
                const randomLast = getRandomElement(currentCountryData.lastnames);
                let npcName = `${randomFirst} ${randomLast}`;

                const baseEcon = Math.floor(Math.random() * 101);
                const baseNation = Math.floor(Math.random() * 101);
                const baseDiplomacy = Math.floor(Math.random() * 101);
                const npcIdeology = [baseEcon, baseNation, baseDiplomacy];

                // 🧠 思想が最も近い政党を割り当てる
                let assignedPartyId = null;
                const existingPartyIds = regionalCandidates[pref][distNum].map(c => c.partyId).filter(Boolean);

                if (parties) {
                    const partyList = Array.isArray(parties) ? parties : Object.values(parties);

                    // 1. 各政党に「小選挙区への擁立力（プライオリティ）」を計算してフィルタリング
                    const eligibleParties = partyList.filter(party => {
                        if (!party || !party.id || party.id === "無所属") return false;
                        if (existingPartyIds.includes(party.id)) return false; // 同一区の被り防止

                        // 💡 政党の規模や立場によって擁立確率（fieldingRate）を変える
                        let fieldingRate = 0.20; // 基本の小政党擁立率は20%程度

                        const isRuling = typeof rulingparty !== "undefined" && rulingparty.includes(party.id);
                        const isMainOpposition = typeof largest_opoosition !== "undefined" && String(largest_opoosition) === String(party.id);

                        if (isRuling) {
                            fieldingRate = 0.95; // 与党はほぼ全区に立てる
                        } else if (isMainOpposition) {
                            fieldingRate = 0.85; // 最大野党も大半の区に立てる
                        } else if (party.seats && party.seats > 10) {
                            fieldingRate = 0.40; // そこそこの中堅政党
                        }

                        // 確率判定で擁立を断念するか決める
                        return Math.random() < fieldingRate;
                    });

                    // 2. 擁立可能な候補政党の中から、思想が最も近い政党を選ぶ
                    if (eligibleParties.length > 0) {
                        let minDiff = Infinity;
                        eligibleParties.forEach(party => {
                            const pIde = Array.isArray(party.ideology) ? party.ideology : [50, 50, 50];
                            const diff = Math.abs(npcIdeology[0] - (pIde[0] || 0)) +
                                Math.abs(npcIdeology[1] - (pIde[1] || 0)) +
                                Math.abs(npcIdeology[2] - (pIde[2] || 0));

                            if (diff < minDiff) {
                                minDiff = diff;
                                assignedPartyId = party.id;
                            }
                        });
                    }
                }

                const urgentNpcCandidate = {
                    icon: `https://api.dicebear.com/10.x/${kettei_ic}/svg?seed=${secretNpcId}`,
                    id: secretNpcId,
                    name: npcName,
                    history: [],
                    partyId: assignedPartyId,
                    pref: pref,
                    city: cityInThisDist,
                    money: 1000000,
                    xp: 0,
                    ideology: npcIdeology,
                    isNPC: true,
                    currentVotes: 0,
                    rep: false,

                    // 💡 小選挙区候補も比例重複として登録しておく（落選時の比例復活枠にする）
                    isProportional: assignedPartyId !== null
                };
                npcs.push(urgentNpcCandidate);
                regionalCandidates[pref][distNum].push(urgentNpcCandidate);

                // 💡 【追加】もし政党に所属しているなら、比例名簿リスト（allCandidates等）にも登録する
                if (assignedPartyId && typeof allCandidates !== "undefined") {
                    allCandidates.push(urgentNpcCandidate);
                }

                console.log(`⚔️ 対立確保：[${pref} 第${distNum}区] に刺客 【${npcName}】 (${assignedPartyId || '無所属'}) を投入！`);

                // 💡 【追加】ついでにその政党の「純粋な比例単独枠」も数合わせで1名生成してしまう！
                if (assignedPartyId && typeof allCandidates !== "undefined") {
                    const propOnlyId = "npc_prop_" + Math.random().toString(36).substring(2, 11);
                    const propRandomFirst = getRandomElement(currentCountryData.firstnames);
                    const propRandomLast = getRandomElement(currentCountryData.lastnames);

                    const propOnlyCandidate = {
                        icon: `https://api.dicebear.com/10.x/${kettei_ic}/svg?seed=${propOnlyId}`,
                        id: propOnlyId,
                        name: `${propRandomFirst} ${propRandomLast}`,
                        partyId: assignedPartyId,
                        pref: pref,
                        isNPC: true,
                        isProportional: true,
                        isProportionalOnly: true, // 💡 小選挙区には絶対に出ない
                        district: null,
                        ideology: npcIdeology,
                        currentVotes: 0,
                        rep: false
                    };

                    npcs.push(propOnlyCandidate);
                    allCandidates.push(propOnlyCandidate);
                }
            }
        }
    }

    const getCleanPartyId = (pId) => {
        if (!pId || pId === "null" || pId === "independents" || pId === "undefined" || pId === "無所属連合") {
            return "無所属";
        }
        return pId;
    };

    // 3. Voterによる投票フェーズ
    const totalVoters = allVoters.length;
    const nationalNetApproval = (typeof presidentapproval !== "undefined" && presidentapproval?.national?.netApproval)
        ? presidentapproval.national.netApproval
        : 0;
    for (let v = 0; v < totalVoters; v++) {
        const voter = allVoters[v];
        const prefCandidates = regionalCandidates[voter.pref];
        if (!prefCandidates) continue;

        const availableDistricts = Object.keys(prefCandidates).map(Number);
        if (availableDistricts.length === 0) continue;

        let voterDist = voter.district;
        if (!voterDist || !prefCandidates[voterDist] || prefCandidates[voterDist].length === 0) {
            const validDistricts = availableDistricts.filter(d => prefCandidates[d] && prefCandidates[d].length > 0);
            if (validDistricts.length === 0) continue;
            voterDist = validDistricts[v % validDistricts.length];
        }

        const localCandidates = prefCandidates[voterDist];
        if (!localCandidates || localCandidates.length === 0) continue;

        const turnoutRate = voter.turnoutRate ?? 0.60;
        if (Math.random() > turnoutRate) continue;
        // ─── 🚨【改修】2大政党制モードの処理 ───
        // 候補者を完全排除（filter）せず、全員をPoolに残したまま「得票やすさ」で差をつける！
        const isTwoPartyMode = typeof twoparty !== "undefined" && twoparty;

        // ❌ filterでの完全排除はやめる（カリスマ無所属・サードパーティにも下剋上のチャンスを残す）
        const candidatesPool = localCandidates;

        let chosenCandidate = null;
        const rand = Math.random();

        // 1. 与党志向 (35%)
        if (rand < 0.35 && typeof rulingparty !== "undefined" && rulingparty.length > 0) {
            chosenCandidate = candidatesPool.find(c => rulingparty.includes(c.partyId) && getCleanPartyId(c.partyId) !== "independents");
        }
        // 2. 野党第一党志向 (30%)
        else if (rand < 0.65 && typeof largest_opoosition !== "undefined" && largest_opoosition) {
            chosenCandidate = candidatesPool.find(c => String(c.partyId) === String(largest_opoosition) && getCleanPartyId(c.partyId) !== "independents");
        }

        // 3. 上位2候補絞り込み (20%) — 各種バフ・ハンデ適用
        else if (rand < 0.85) {
            const sortedLocal = [...candidatesPool].sort((a, b) => {
                const getCandidateScore = (c) => {
                    // 💡 【超重要】パワー・知名度・xp（経験値）をしっかり基本スコアに反映させる！
                    let baseScore = (c.power || 0) + (c.fame || 0) + ((c.xp || 0) * 10) || c.status || 10000;
                    const pId = getCleanPartyId(c.partyId);

                    if (pId === "independents") {
                        // 無所属ハンデ（ただし高xpならカバー可能）
                        baseScore *= 0.5;
                    }

                    const isRuling = typeof rulingparty !== "undefined" && rulingparty.includes(pId);
                    const isOpposition = typeof largest_opoosition !== "undefined" && String(pId) === String(largest_opoosition);
                    // ─── 2大政党制時の「組織票バフ」───
                    if (isTwoPartyMode) {
                        if (isRuling) {
                            // 📈 与党：大統領支持率が良い（プラス）なら最大3.8倍、悪いなら1.2倍まで変動
                            const rulingTrend = 2.5 + (nationalNetApproval * 0.015);
                            const finalRulingBuff = Math.max(1.2, Math.min(3.8, rulingTrend));
                            baseScore *= finalRulingBuff;
                        }
                        else if (isOpposition) {
                            // 📉 野党：大統領支持率が悪い（マイナス）ほど「政権批判の受け皿」として最大3.8倍まで上昇！
                            const oppositionTrend = 2.5 - (nationalNetApproval * 0.015);
                            const finalOppositionBuff = Math.max(1.2, Math.min(3.8, oppositionTrend));
                            baseScore *= finalOppositionBuff;
                        }
                        else {
                            // サードパーティ（無所属や第3極など）には「死票を恐れる心理」のハンデ
                            baseScore *= 0.3;
                        }
                    }
                    const partyPreData = kokujimae[pId];
                    if (partyPreData && partyPreData.memberIds && partyPreData.memberIds.includes(c.id)) {
                        baseScore *= 1.3;
                    }

                    const partyObj = (typeof parties !== "undefined") ? parties[pId] : null;
                    if (partyObj && partyObj.leaderId === c.id) {
                        baseScore *= 1.8;
                    }

                    return baseScore;
                };

                const scoreA = getCandidateScore(a);
                const scoreB = getCandidateScore(b);
                const diff = scoreB - scoreA;
                return diff !== 0 ? diff : (Math.random() - 0.5);
            });

            const top2 = sortedLocal.slice(0, 2);

            if (top2.length > 0) {
                const voteResult = voter.thinkAndVote(top2);
                if (voteResult && voteResult.candidateId) {
                    chosenCandidate = top2.find(c => String(c.id) === String(voteResult.candidateId));
                }
                if (!chosenCandidate) {
                    chosenCandidate = top2[Math.floor(Math.random() * top2.length)];
                }
            }
        }

        // 4. ガチ信念層 & 実力派の救済 (15%)
        if (!chosenCandidate) {
            const acceptableCandidates = candidatesPool.filter(cand => {
                const pId = getCleanPartyId(cand.partyId);

                // 💡 高xp（経験値50以上）の重鎮なら、無所属・サードパーティでも有権者が「この人なら！」と投票する
                const isHeavyweight = (cand.xp || 0) >= 50 || (cand.fame || 0) >= 50000;

                const isRuling = typeof rulingparty !== "undefined" && rulingparty.includes(pId);
                const isOpposition = typeof largest_opoosition !== "undefined" && String(pId) === String(largest_opoosition);

                if (isTwoPartyMode) {
                    // 2大政党の候補、または「地元で圧倒的実績を持つ重鎮」なら選択肢に残す！
                    return isRuling || isOpposition || isHeavyweight;
                }

                if (isRuling || isOpposition || isHeavyweight) return true;

                let beforeSeats = 0;
                if (typeof kokujimae !== "undefined" && kokujimae[pId]) {
                    beforeSeats = kokujimae[pId].seats || 0;
                } else {
                    const partyObj = (typeof parties !== "undefined") ? (parties[pId] || {}) : {};
                    beforeSeats = partyObj.seats || 0;
                }

                const diff = Math.abs((voter.ideology ?? 50) - (cand.ideology ?? 50));
                return beforeSeats > 0 ? diff <= 35 : diff <= 20;
            });

            const finalPool = acceptableCandidates.length > 0 ? acceptableCandidates : candidatesPool;
            const voteResult = voter.thinkAndVote(finalPool);

            if (voteResult && voteResult.candidateId) {
                chosenCandidate = finalPool.find(c => String(c.id) === String(voteResult.candidateId));
            }
        }

        // 5. 最終セーフティネット（政党所属者を優先）
        if (!chosenCandidate) {
            const partyCandidates = candidatesPool.filter(c => getCleanPartyId(c.partyId) !== "independents");

            // 🚨【修正】2大政党の候補を最優先で探す構造に強化
            chosenCandidate = candidatesPool.find(c => typeof rulingparty !== "undefined" && rulingparty.includes(c.partyId))
                || candidatesPool.find(c => typeof largest_opoosition !== "undefined" && String(c.partyId) === String(largest_opoosition))
                || (partyCandidates.length > 0 ? partyCandidates[v % partyCandidates.length] : candidatesPool[v % candidatesPool.length]);
        }

        // 🗳️ 票数加算
        if (chosenCandidate) {
            const votesToAdd = (voter.votePower && voter.votePower > 0) ? voter.votePower : 1000;
            if (typeof chosenCandidate.currentVotes !== "number" || isNaN(chosenCandidate.currentVotes)) {
                chosenCandidate.currentVotes = 0;
            }
            chosenCandidate.currentVotes += votesToAdd;
            voter.lastVotedFor = chosenCandidate.id;
        }
    }


    // 4. 小選挙区の開票・集計
    let totalSeatsCalculated = 0;

    // 集計前に議席オブジェクトを念のため初期化
    for (const key in partySeatsWon) delete partySeatsWon[key];

    // 全国比例得票数オブジェクト
    const partyPRVotes = {};

    for (const pref in regionalCandidates) {
        const districts = regionalCandidates[pref];

        for (const dist in districts) {
            const candidatesInDistrict = districts[dist];
            if (!candidatesInDistrict || candidatesInDistrict.length === 0) continue;

            candidatesInDistrict.sort((a, b) => b.currentVotes - a.currentVotes);

            // 👑 【1位：当選者】
            const winner = candidatesInDistrict[0];
            winner.rep = true; // 現職フラグ ON
            if (typeof winner.termCount === 'undefined') {
                winner.termCount = 1;
            } else {
                winner.termCount += 1;
            }
            winner.xp += 15;
            addhis(winner, `${pref}第${dist}区から${winner.termCount === 1 ? `初当選（下院選挙）` : `当選（${winner.termCount}期目・下院選挙）`}`);
            winner.money += 500000;

            totalSeatsCalculated++;

            const pId = getCleanPartyId(winner.partyId);
            partySeatsWon[pId] = (partySeatsWon[pId] || 0) + 1;

            // 💀 【2位以下：落選者】の処理！
            const losers = candidatesInDistrict.slice(1);
            losers.forEach(loser => {
                // 1. 現職フラグを折る（元職・新人へ）
                loser.rep = false;

                // 2. 履歴に記録（惜敗率や票数を添えても面白いよ！）
                addhis(loser, `${pref}第${dist}区で落選`);

                // 3. 落選ストレス/XP補正（少しだけXPが入るなど）
                loser.xp += 2;
            });

            // ★ 全国比例得票数は全員分を正しく集計
            candidatesInDistrict.forEach(cand => {
                const targetParty = getCleanPartyId(cand.partyId);
                partyPRVotes[targetParty] = (partyPRVotes[targetParty] || 0) + cand.currentVotes;
            });
        }
    }
    const totalDistrictSeats = totalSeatsCalculated;


    if (hirei_house) {
        // 5. 比例代表（ブロック別ドント式＆比例復活・単独候補計算）処理
        const countryKey = localStorage.getItem("poligame_data")
            ? JSON.parse(localStorage.getItem("poligame_data")).countrySelect || "jp"
            : "jp";


        // もし globalPRBlocks が空なら自動生成
        if (!globalPRBlocks || globalPRBlocks.length === 0) {
            if (typeof initPRBlocks === "function") initPRBlocks(countryKey);
        }

        // ブロックごとの比例議席数を確定
        calculatePRBlockSeats(countryKey, totalDistrictSeats, totalHouseSeats);
        // ★ ブロックごとのドント式配分＆当選者決定処理
        globalPRBlocks.forEach(block => {
            const blockPRSeats = block.seats || 0;
            if (blockPRSeats <= 0) return;

            // ① ブロック内の政党別得票数と、各小選挙区の落選者（比例復活候補）を集計
            const blockPartyVotes = {};
            const partyRunnersUp = {}; // 政党ごとの比例復活候補リスト { partyId: [ { cand, sekihaiRate } ] }

            block.prefs.forEach(pref => {
                if (!regionalCandidates[pref]) return;
                for (const dist in regionalCandidates[pref]) {
                    const candidates = regionalCandidates[pref][dist];
                    if (!candidates || candidates.length === 0) continue;

                    // 小選挙区の当選者（1位）の得票数
                    const winnerVotes = candidates[0].currentVotes || 1;

                    candidates.forEach((cand, index) => {
                        const targetParty = getCleanPartyId(cand.partyId);

                        // 得票数の加算
                        blockPartyVotes[targetParty] = (blockPartyVotes[targetParty] || 0) + cand.currentVotes;

                        // 落選者（2位以下）かつ政党所属者を「比例復活候補」としてエントリー
                        if (index > 0 && targetParty !== "無所属") {
                            if (!partyRunnersUp[targetParty]) partyRunnersUp[targetParty] = [];

                            // 惜敗率 = (自分の得票数 / 1位の得票数) * 100
                            const sekihaiRate = (cand.currentVotes / winnerVotes) * 100;

                            partyRunnersUp[targetParty].push({
                                cand: cand,
                                sekihaiRate: sekihaiRate,
                                type: "復活"
                            });
                        }
                    });
                }
            });

            const blockTotalVotes = Object.values(blockPartyVotes).reduce((sum, v) => sum + v, 0);
            const PR_THRESHOLD = 0.1; // 10% 足切り線

            // ② ドント式スコア算出
            const dHondtScores = [];
            for (const pId in blockPartyVotes) {
                if (pId === "無所属" || blockPartyVotes[pId] <= 0) continue;

                // 🧠 比例配分対象チェック
                const partyShare = blockTotalVotes > 0 ? (blockPartyVotes[pId] / blockTotalVotes) : 0;

                // 無所属以外の政党を得票数順（または全体の議席順）に並べたTop2を判定
                // ※ blockPartyVotes の中で得票が多い上位2政党（無所属除く）を取得
                const validParties = Object.keys(blockPartyVotes)
                    .filter(id => id !== "independents" && blockPartyVotes[id] > 0)
                    .sort((a, b) => blockPartyVotes[b] - blockPartyVotes[a]);

                const top1Party = validParties[0];
                const top2Party = validParties[1];

                // 第1党・第2党（無所属除く）なら無条件で通過！
                const isTop2Party = (pId === top1Party || pId === top2Party);

                if (!isTop2Party && partyShare < PR_THRESHOLD) {
                    console.log(`🚫 比例足切り: [${block.name || 'ブロック'}] 政党[${pId}] は得票率 ${(partyShare * 100).toFixed(1)}% のため議席配分対象外`);
                    continue; // 第3党以下で足切りにかかった政党のみ除外！
                }
                for (let i = 1; i <= blockPRSeats; i++) {
                    dHondtScores.push({
                        partyId: pId,
                        score: blockPartyVotes[pId] / i
                    });
                }
            }

            dHondtScores.sort((a, b) => b.score - a.score);
            // ③ 各政党の獲得比例議席数をカウント
            const partyPRSeatsWon = {};
            for (let i = 0; i < Math.min(blockPRSeats, dHondtScores.length); i++) {
                const pId = dHondtScores[i].partyId;

                // 💡【修正】もし外側の変数「partySeatsWon」を正しく更新したいなら、
                // 事前にこの関数の外か上で「let partySeatsWon = {};」などが定義されているか確認してね！
                // 定義されていればそのままでOKだけど、定義されていない場合はこれがエラーの原因になります。
                if (typeof partySeatsWon !== "undefined") {
                    partySeatsWon[pId] = (partySeatsWon[pId] || 0) + 1;
                }

                // こちらは確実にこの関数内で作られているので安心！
                partyPRSeatsWon[pId] = (partyPRSeatsWon[pId] || 0) + 1;
            }


            // 🌟 ④ 実際に比例区で誰が当選したか（人間）を決める処理！
            // 比例議席を獲得したすべての政党（partyPRSeatsWon）を走査
            for (const pId in partyPRSeatsWon) {
                let seatsToAssign = partyPRSeatsWon[pId] || 0;
                if (seatsToAssign <= 0) continue;

                // 惜敗率順（高い順）にソート
                const candidatesList = partyRunnersUp[pId] || [];
                candidatesList.sort((a, b) => b.sekihaiRate - a.sekihaiRate);

                // A. まず小選挙区の落選者から「比例復活」させる
                for (let i = 0; i < candidatesList.length; i++) {
                    const runnerUp = candidatesList[i];
                    const cand = runnerUp.cand;

                    if (seatsToAssign > 0) {
                        // 👑 【比例復活当選！】
                        cand.rep = true;
                        cand.isPRWinner = true; // 比例当選フラグ
                        cand.block = block.name; // ブロック名を付与！
                        cand.termCount = (cand.termCount || 0) + 1;
                        cand.money = (cand.money || 0) + 300000;
                        cand.xp = (cand.xp || 0) + 10;

                        const historyMsg = `下院総選挙で比例復活当選（${block.name}・惜敗率 ${runnerUp.sekihaiRate.toFixed(1)}%）`;
                        addhis(cand, historyMsg);

                        console.log(`🧟 比例復活！ [${pId}] ${cand.name} (${block.name} / 惜敗率: ${runnerUp.sekihaiRate.toFixed(1)}%)`);

                        seatsToAssign--;
                    } else {
                        // 💀 【小選挙区も比例もダメだった完全落選者】
                        cand.rep = false;
                        cand.isPRWinner = false;
                        addhis(cand, `下院総選挙で落選（惜敗率 ${runnerUp.sekihaiRate.toFixed(1)}%・比例復活ならず）`);
                    }
                }

                // B. 小選挙区落選者だけでは枠が余った場合（比例単独候補の新規生成）
                while (seatsToAssign > 0) {
                    const secretNpcId = "pr_npc_" + Math.random().toString(36).substring(2, 11);
                    const currentCountryData = (typeof country !== "undefined" && country[countryKey]) ? country[countryKey] : { firstnames: ["John"], lastnames: ["Doe"] };

                    const randomFirst = getRandomElement(currentCountryData.firstnames || ["John"]);
                    const randomLast = getRandomElement(currentCountryData.lastnames || ["Doe"]);
                    const kettei_ic = ["adventurer", "avataaars", "bottts", "lorelei"][Math.floor(Math.random() * 4)];
                    const parka = (typeof parties !== "undefined" && parties[pId]) ? parties[pId] : { ideology: [50, 50, 50] };

                    const blockPrefTarget = block.prefs ? block.prefs[0] : "首都";
                    const prefStr = (typeof blockPrefTarget === 'string') ? blockPrefTarget : (blockPrefTarget?.name || "首都");

                    // 🏙️ blockPrefTarget の cities 配列からランダムに選出！
                    let cityName = "";
                    if (typeof blockPrefTarget === 'object' && Array.isArray(blockPrefTarget.cities) && blockPrefTarget.cities.length > 0) {
                        const randomIndex = Math.floor(Math.random() * blockPrefTarget.cities.length);
                        const selectedCity = blockPrefTarget.cities[randomIndex];
                        // cityがオブジェクトなら .name、文字列ならそのまま使う
                        cityName = (typeof selectedCity === 'string') ? selectedCity : (selectedCity?.name || prefStr);
                    } else {
                        cityName = prefStr; // citiesが無い場合の安全なフォールバック
                    }

                    const prOnlyNpc = {
                        icon: `https://api.dicebear.com/10.x/${kettei_ic}/svg?seed=${secretNpcId}`,
                        id: secretNpcId,
                        name: `${randomFirst} ${randomLast}`,
                        history: [],
                        partyId: pId,
                        pref: prefStr,
                        block: block.name, // 🌟 表示用にブロック名をセット！
                        city: cityName, // 👈 「中心街」を撃滅して、実際の都市名を取得！
                        money: 800000,
                        xp: 10,
                        ideology: parka.ideology || [50, 50, 50],
                        isNPC: true,
                        currentVotes: 0,
                        rep: true,
                        isPRWinner: true, // 🌟 比例当選フラグ
                        termCount: 1
                    };
                    npcs.push(prOnlyNpc);
                    addhis(prOnlyNpc, `下院総選挙にて政党比例名簿（${block.name}単独）から初当選`);

                    console.log(`📜 比例単独当選！ [${pId}] ${prOnlyNpc.name} (${block.name})`);

                    seatsToAssign--;
                }
            }
        });
        // 各ブロックの比例議席（83議席など）の合計
    }
    const totalPRSeats = globalPRBlocks.reduce((sum, block) => sum + (block.seats || 0), 0);

    // ==========================================
    // 📊 コンソールへの詳細ログ出力
    // ==========================================
    console.group("🏛️ 下院総選挙 最終確定リポート");
    console.log(`総議席数: ${totalDistrictSeats + totalPRSeats} (小選挙区: ${totalDistrictSeats} / 比例: ${totalPRSeats})`);

    console.table(
        Object.keys(partySeatsWon).map(pId => {
            const votes = partyPRVotes[pId] || 0;
            return {
                "政党名": pId,
                "獲得議席": partySeatsWon[pId],
                "得票数": votes.toLocaleString() + "票"
            };
        }).sort((a, b) => b["獲得議席"] - a["獲得議席"])
    );

    // 獲得議席数順に政党IDをソート
    const sortedPartyIds = Object.keys(partySeatsWon).sort((a, b) => {
        return (partySeatsWon[b] || 0) - (partySeatsWon[a] || 0);
    });

    // 無所属（independents）を除外した政党リストを作成
    // ※ 無所属の判定IDは "無所属" や "independents" など環境に合わせて調整
    const isIndependent = (id) => id === "無所属" || id === "independents" || id === "ind";
    const nonIndependentParties = sortedPartyIds.filter(pId => !isIndependent(pId));

    // 1. 無所属以外の最多数を獲得した政党が「与党（第1党）」
    if (nonIndependentParties.length > 0) {
        const topParty = nonIndependentParties[0];
        rulingparty = [topParty]; // 与党配列に追加
    }

    // 2. 2番目に議席が多い政党が「最大野党（第2党）」
    if (nonIndependentParties.length > 1) {
        largest_opoosition = nonIndependentParties[1];
    }

    // 3. 与党以外のすべての政党 ＋ 無所属 は「野党」グループに入る
    opposition = sortedPartyIds.filter(pId => !rulingparty.includes(pId));

    console.log("🏛️ 政権枠組み結果:", {
        rulingparty,           // 例: ["LDP"]
        largest_opoosition,    // 例: "CDP"
        opposition             // 例: ["CDP", "JCP", "無所属", ...]
    });

    console.log("🗺️ ブロック別比例枠配分:");
    globalPRBlocks.forEach(b => console.log(` ・${b.name}: ${b.seats} 議席`));
    console.groupEnd();

    // 6. 結果確定＆表示
    window.generalelectionhistory = window.generalelectionhistory || [];

    console.log(kokujimae);

    saveElectionToHistory(
        partyPRVotes,
        partySeatsWon,
        totalDistrictSeats,
        totalPRSeats,
        { rulingparty, largest_opoosition, opposition } // 💡 追加
    );
    displayElectionResultMultiTray(
        regionalCandidates,   // 1. 各地の候補者データ
        partySeatsWon,        // 2. 確定した各党の「合計議席数」
        totalDistrictSeats,   // 3. 小選挙区の総議席数 (数値: 117など)
        totalPRSeats,         // 4. 比例代表の総議席数 (数値: 83など) ★ここが数値！
        partyPRVotes          // 5. 全国得票数オブジェクト
    );
    processLeaderResignationCheck(kokujimae, partySeatsWon);
}

window.generalelectionhistory = [];
// ==========================================
// 📚 歴代選挙データの保存（議席増減＆政権枠組み付き）
// ==========================================
function saveElectionToHistory(
    partyPRVotes,
    partySeatsWon,
    totalDistrictSeats,
    totalPRSeats,
    coalitionData = {} // 💡 与野党データをオブジェクトで受け取る（互換性のための初期値 {}）
) {
    const { rulingparty = [], largest_opoosition = null, opposition = [] } = coalitionData;

    const currentCount = (typeof gameSessionElectionCount !== "undefined" && gameSessionElectionCount > 0)
        ? gameSessionElectionCount
        : (window.generalelectionhistory ? window.generalelectionhistory.length + 1 : 1);

    window.generalelectionhistory = window.generalelectionhistory || [];

    // 💡 1つ前の選挙データ（直前回）を取得して比較対象にする
    const prevHistory = window.generalelectionhistory.find(h => h && h.count === currentCount - 1)
        || window.generalelectionhistory[window.generalelectionhistory.length - 1] || null;

    // 各党の集計データを作成
    const partyResults = {};
    const grandTotalPRVotes = Object.values(partyPRVotes).reduce((a, b) => a + b, 0) || 1;

    Object.keys(partySeatsWon).forEach(pId => {
        const pName = parties[pId]?.name || (pId === "無所属" ? "無所属" : "既成政党");
        const pColor = parties[pId]?.color || "#718096";
        const votes = partyPRVotes[pId] || 0;
        const currentSeats = partySeatsWon[pId] || 0;

        // 💡 前回の議席数と比較して増減（diff）を計算
        let diff = null; // 初回や新党は null
        if (prevHistory && prevHistory.partyResults) {
            const prevSeats = prevHistory.partyResults[pId] ? prevHistory.partyResults[pId].totalSeats : 0;
            diff = currentSeats - prevSeats;
        }
        const leaderId = parties?.[pId]?.leaderId;
        const leader = leaderId ? [player, ...npcs].find(n => n.id === leaderId) : null;

        partyResults[pId] = {
            name: pName,
            // 🌟 leader?.name のように ?. をつけることで null でも落ちなくなります！
            leaderName: leader?.name || "（不在）",
            leaderid: leader?.id || "",
            leaderIcon: leader?.icon || "https://yt3.googleusercontent.com/jg2X302tJOu2adgLeJmku0q58NWK6uzjyds_5O8I3O8uLkA48Zjc0jpt5bHtckoOQhNJB9KQew=s900-c-k-c0x00ffffff-no-rj",
            color: pColor,
            totalSeats: currentSeats,
            diff: diff, // 増減数 (+2, -1, 0 など)
            prVotes: votes,
            voteShare: (grandTotalPRVotes > 0) ? ((votes / grandTotalPRVotes) * 100).toFixed(1) : "0.0"
        };
    });

    const rawData = localStorage.getItem("poligame_data");
    const parsedData = rawData ? JSON.parse(rawData) : {};
    const countryKey = parsedData.countrySelect || "us";
    const currentCountryData = (typeof country !== "undefined" && country[countryKey])
        ? country[countryKey]
        : { name: "日本" };

    // 履歴オブジェクト
    const historyData = {
        count: currentCount,
        dateLabel: `第${currentCount}回${currentCountryData.name}下院総選挙`,
        totalSeats: totalDistrictSeats + totalPRSeats,
        districtSeats: totalDistrictSeats,
        prSeats: totalPRSeats,
        rulingparty: rulingparty,                // 💡 保存
        largest_opoosition: largest_opoosition,  // 💡 保存
        opposition: opposition,                  // 💡 保存
        partyResults: partyResults
    };

    // 履歴に追加（重複防止チェック付き）
    const existingIndex = window.generalelectionhistory.findIndex(h => h.count === currentCount);
    if (existingIndex >= 0) {
        window.generalelectionhistory[existingIndex] = historyData;
    } else {
        window.generalelectionhistory.push(historyData);
    }

    console.log("📚 Wiki履歴を更新（与野党枠組み付き）:", historyData);
}

// ==========================================
// 📖 Wiki風・歴代選挙データベース表示 Modal
// ==========================================
function openElectionWikiModal(targetCount = null) {
    if (!window.generalelectionhistory || window.generalelectionhistory.length === 0) {
        alert("まだ過去の選挙記録がありません！選挙が実行されると記録されます。");
        return;
    }

    // 不正データを除外
    const validHistory = window.generalelectionhistory.filter(h => h && h.count !== undefined && !isNaN(h.count));

    if (validHistory.length === 0) {
        alert("有効な過去の選挙データが見つかりませんでした。");
        return;
    }

    // 表示対象の選挙（指定がなければ最新）
    const targetHistory = targetCount
        ? validHistory.find(h => h.count === targetCount)
        : validHistory[validHistory.length - 1];

    if (!targetHistory) return;

    // 政党を獲得議席順にソート
    const sortedParties = Object.values(targetHistory.partyResults)
        .sort((a, b) => b.totalSeats - a.totalSeats);

    // ① 選挙選択タブ（第1回、第2回...）
    let historyTabsHTML = `<div style="display:flex; gap:4px; margin-bottom:12px; overflow-x:auto; padding-bottom:4px;">`;
    validHistory.forEach(h => {
        const activeStyle = h.count === targetHistory.count
            ? "background:#3182ce; color:#fff; font-weight:bold;"
            : "background:#2d3748; color:#a0aec0;";
        historyTabsHTML += `
        <button onclick="openElectionWikiModal(${h.count})" style="
            padding:4px 10px; font-size:11px; border:none; border-radius:4px; cursor:pointer; white-space:nowrap; ${activeStyle}
        ">第${h.count}回</button>`;
    });
    historyTabsHTML += `</div>`;

    // ② Wikipedia風 Infobox の構築
    // 上位3党（または存在する全党）を比較対象として抽出
    const chunkArray = (array, chunkSize) => {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    };

    // 全政党を3つずつの塊に分ける（例: 7政党なら 3, 3, 1 の塊になる）
    const partyChunks = chunkArray(sortedParties, 3);

    // HTMLの各パーツを格納するバッファ
    let infoboxContentHTML = "";

    // 💡 3つずつの塊（行）ごとにループを回してテーブルを組み立てる
    partyChunks.forEach((chunk, chunkIndex) => {
        // この行における列数（最大3）
        const colSpanCount = chunk.length;

        // 各データ行の初期化
        let colorBarRow = "";
        let photoRow = "";
        let leaderRow = "";
        let partyRow = "";
        let seatsWonRow = "";
        let seatChangeRow = "";
        let seatsBeforeRow = "";
        let prVoteRow = "";
        let voteShareRow = "";

        chunk.forEach(p => {
            const pColor = p.color || "#a0aec0";
            const leaderName = p.leaderName || "（不在）";
            const leaderid = p.leaderid || "";
            const leaderIcon = p.leaderIcon || "https://googleusercontent.com";

            // ① 顔写真
            photoRow += `
            <td style="text-align: center; padding: 6px 2px 2px 2px; vertical-align: bottom; width: 33.3%;">
                <img src="${leaderIcon}" style="width: 85px; height: 110px; object-fit: cover; border: 1px solid #a2a9b1;" />
            </td>`;

            // ② カラーバー
            colorBarRow += `<td style="padding:0; height:6px; background:${pColor}; border-bottom:1px solid #a2a9b1;"></td>`;

            // ③ 党首名
            leaderRow += `
            <td style="text-align: center; padding: 4px; font-size: 12px; vertical-align: top;">
                <a style="color: #0645ad; text-decoration: none; font-weight: bold;">${leaderName}</a>
            </td>`;

            // ④ 政党名
            partyRow += `
            <td style="color: #0645ad; padding:6px 4px; text-align:center; font-weight:bold; font-size:12px;">
                ${p.name}
            </td>`;

            // ⑤ 獲得議席
            seatsWonRow += `<td style="padding:5px 4px; text-align:center; font-weight:bold; font-size:13px;">${p.totalSeats}</td>`;

            // ⑥ 議席増減
            let diffStr = `<span style="color:#54595d;">-</span>`;
            if (p.diff > 0) {
                diffStr = `<span style="color:#008500; font-weight:bold;">▲</span> ${p.diff}`;
            } else if (p.diff < 0) {
                diffStr = `<span style="color:#d33; font-weight:bold;">▼</span> ${Math.abs(p.diff)}`;
            } else if (p.diff === 0) {
                diffStr = `<span style="color:#54595d;">-</span>`;
            }
            seatChangeRow += `<td style="padding:5px 4px; text-align:center;">${diffStr}</td>`;

            // ⑦ 解散前議席
            const prevSeats = p.seatsBefore !== undefined ? p.seatsBefore : (p.totalSeats - (p.diff || 0));
            seatsBeforeRow += `<td style="padding:5px 4px; text-align:center; color:#202122;">${prevSeats}</td>`;

            // ⑧ 得票数
            const votesFormatted = p.prVotes ? Math.floor(p.prVotes).toLocaleString() : "0";
            prVoteRow += `<td style="padding:5px 4px; text-align:center; color:#202122; font-size:11px;">${votesFormatted}</td>`;

            // ⑨ 得票率
            const shareFormatted = p.voteShare !== undefined ? `${p.voteShare}%` : "-";
            voteShareRow += `<td style="padding:5px 4px; text-align:center; color:#54595d; font-size:11px;">${shareFormatted}</td>`;
        });

        // 💡 3つ未満の塊のときは、横幅が崩れないように空のセルで埋める処理
        if (colSpanCount < 3) {
            const emptyCount = 3 - colSpanCount;
            for (let i = 0; i < emptyCount; i++) {
                const emptyCell = `<td style="width: 33.3%;"></td>`;
                photoRow += emptyCell;
                colorBarRow += `<td></td>`;
                leaderRow += emptyCell;
                partyRow += `<td ></td>`;
                seatsWonRow += emptyCell;
                seatChangeRow += emptyCell;
                seatsBeforeRow += emptyCell;
                prVoteRow += emptyCell;
                voteShareRow += emptyCell;
            }
        }

        // 💡 2つ目以降の塊（4〜6位、7〜9位など）の前に、区切りのヘッダーや空白行を入れる
        if (chunkIndex > 0) {
            infoboxContentHTML += `
            <tr>
                <td colspan="3" style="height: 15px; background: #FFFFFF; border-top: 2px solid #FFFFFF; border-bottom: 2px solid #a2a9b1;"></td>
            </tr>`;
        }

        // HTML文字列にこの塊のデータをガッチャンコする
        infoboxContentHTML += `
            <!-- 👤 顔写真行 -->
            <tr>${photoRow}</tr>
            <!-- 🟩 カラーバー -->
            <tr>${colorBarRow}</tr>
            <tr>${partyRow}</tr>

            <!-- 👤 党首名 -->
            <tr>${leaderRow}</tr>
            
            <!-- 📊 各種データ（styleなどの余計な装飾を排除） -->
            <tr><th colspan="3">獲得議席</th></tr>
            <tr style="background: #fff;">${seatsWonRow}</tr>
            
            <tr><th colspan="3">議席増減</th></tr>
            <tr style="background: #fff;">${seatChangeRow}</tr>
            
            <tr><th colspan="3">選挙前議席</th></tr>
            <tr style="background: #fff;">${seatsBeforeRow}</tr>
            
            <tr><th colspan="3">得票数</th></tr>
            <tr style="background: #fff;">${prVoteRow}</tr>
            
            <tr><th colspan="3">得票率</th></tr>
            <tr style="background: #fff;">${voteShareRow}</tr>

        `;
    });


    // 🏛️ Wikipedia完全再現 Infobox 全体レイアウト（colspanは常に3で固定）
    const infoboxHTML = `
    <table class="infobox vevent" style="width: 300px; border: 1px solid #a2a9b1; border-spacing: 3px; background: #f8f9fa; color: #202122; font-family: sans-serif; font-size: 12px; line-height: 1.5em; float: right; margin: 0 0 1em 1em; padding: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <tbody>
            <!-- 選挙タイトル -->
            <tr>
                <th colspan="3" style="text-align: center; font-size: 14px; font-weight: bold; background: #eaecf0; padding: 6px; border: 1px solid #a2a9b1; color: #000;">
                    📖 ${targetHistory?.dateLabel || '下院議員総選挙結果'}
                </th>
            </tr>

            <!-- 🗳️ 総議席アーチグラフィック行 -->
            <tr style="background: #ffffff; border-bottom: 1px solid #a2a9b1;">
                <td colspan="3" style="padding: 16px 0 12px; text-align: center; vertical-align: middle;">
                    <div style="position: relative; width: 260px; height: 130px; margin: 0 auto;">
                        <svg viewBox="0 0 100 50" style="width: 100%; height: 100%; overflow: visible;">
                            ${(() => {
            const totalSeatsInElection = sortedParties.reduce((sum, p) => sum + (p.totalSeats || 0), 0) || 1;
            const totalLength = 125.66;
            let accumulatedLength = 0;
            const svgPaths = [];

            sortedParties.forEach(p => {
                const seats = p.totalSeats || 0;
                if (seats === 0) return;

                const partLength = (seats / totalSeatsInElection) * totalLength;
                let colorStr = p.color || '#718096';
                if (!colorStr.includes('rgb') && !colorStr.includes('#') && !colorStr.includes('hsl')) {
                    colorStr = `rgb(${colorStr})`;
                }

                svgPaths.push(`
                                        <path d="M 10 50 A 40 40 0 0 1 90 50" 
                                              fill="none" 
                                              stroke="${colorStr}" 
                                              stroke-width="30" 
                                              stroke-dasharray="${totalLength}"
                                              style="stroke-dasharray: 0 ${accumulatedLength} ${partLength} ${totalLength};" />
                                    `);
                accumulatedLength += partLength;
            });

            if (svgPaths.length === 0) {
                return `<path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#eaecf0" stroke-width="30" />`;
            }
            return svgPaths.join('');
        })()}
                        </svg>
                        
                        <div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); font-size: 13px; font-weight: bold; color: #202122; background: #eaecf0; padding: 2px 10px; border-radius: 12px; border: 1px solid #a2a9b1; white-space: nowrap; line-height: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${sortedParties.reduce((sum, p) => sum + (p.totalSeats || 0), 0)}議席
                        ${infoboxContentHTML}`;

    const wikiBodyHTML = `
    ${historyTabsHTML}
    ${infoboxHTML}
    `;

    showModal("📖 歴代総選挙データベース (Wiki)", wikiBodyHTML, [
        {
            text: "閉じる",
            className: "close-btn",
            keepOpen: false
        }
    ]);
}


/**
 * 📊 【大改造】選挙結果を地域ブロックごとに閲覧し、最終的に全国統計を見せるマルチトレイシステム
 * @param {object} regionalCandidates - 開票・ソートが終わった都道府県ごとの候補者データ
 * @param {object} partySeatsWon - 各政党の獲得議席数
 * @param {number} totalSeatsCalculated - 総議席数
 */
// 💡 引数に partyPRVotes（各政党の比例得票数）と totalPRSeats（比例の総議席数: デフォルト100など）を追加


function displayElectionResultMultiTray(regionalCandidates, partySeatsWon, totalSeatsCalculated, totalPRSeats = 0, partyPRVotes = {}) {

    // 💡 現在選択中のタブ状態（"district" or "pr"）
    let currentTrayTab = "district";

    showPrefectureBlockMenu();

    // ==========================================
    // 🔍 画面1：【小選挙区 / 比例ブロック 選択タブメニュー】
    // ==========================================
    function showPrefectureBlockMenu() {
        let contentHTML = "";

        if (currentTrayTab === "district") {
            // --- A. 小選挙区（都道府県リスト） ---
            let prefButtonsHTML = "";
            const activePrefs = Object.keys(regionalCandidates);

            activePrefs.forEach(pref => {
                const districts = regionalCandidates[pref];
                const activeDists = Object.keys(districts);
                if (activeDists.length === 0) return;

                const firstDistNum = activeDists[0];
                const topCand = districts[firstDistNum][0];
                if (!topCand) return;

                const topPartyName = topCand.partyId ? (parties[topCand.partyId]?.name || "既成政党") : "無所属";

                prefButtonsHTML += `
                <button onclick="window.showPrefDetails('${pref}')" style="
                    width: 100%; text-align: left; background: #2d3748; color: #fff; border: 1px solid #4a5568; 
                    padding: 10px 14px; border-radius: 6px; margin-bottom: 6px; cursor: pointer; transition: all 0.2s;
                " onmouseover="this.style.background='#3a4454'" onmouseout="this.style.background='#2d3748'">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; font-size:13px;">📍 ${pref} 選挙区 (${activeDists.length}区)</span>
                        <span style="font-size:11px; color:#a0aec0;">${firstDistNum}区1位: ${topCand.name} (${topPartyName})</span>
                    </div>
                </button>
                `;
            });
            contentHTML = `<div style="max-height: 220px; overflow-y: auto; padding-right: 4px;">${prefButtonsHTML}</div>`;

        } else {
            // --- B. 比例代表（ブロックリスト） ---
            let prBlockButtonsHTML = "";
            if (typeof globalPRBlocks !== "undefined" && globalPRBlocks.length > 0) {
                globalPRBlocks.forEach((block, idx) => {
                    prBlockButtonsHTML += `
                    <button onclick="window.showPRBlockDetails(${idx})" style="
                        width: 100%; text-align: left; background: #2b6cb0; color: #fff; border: 1px solid #4299e1; 
                        padding: 10px 14px; border-radius: 6px; margin-bottom: 6px; cursor: pointer; transition: all 0.2s;
                    " onmouseover="this.style.background='#3182ce'" onmouseout="this.style.background='#2b6cb0'">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:bold; font-size:13px;">🟦 比例${block.name}</span>
                            <span style="font-size:11px; color:#e2e8f0; background:#1a365d; padding:2px 6px; border-radius:3px;">定数 ${block.seats || 0} 議席</span>
                        </div>
                    </button>
                    `;
                });
            } else {
                prBlockButtonsHTML = `<div style="color:#a0aec0; text-align:center; padding:12px;">比例ブロックデータがありません</div>`;
            }
            contentHTML = `<div style="max-height: 220px; overflow-y: auto; padding-right: 4px;">${prBlockButtonsHTML}</div>`;
        }

        // タブ切替スタイル
        const distTabStyle = currentTrayTab === "district"
            ? "background:#4a5568; color:#fff; font-weight:bold; border-bottom:2px solid #63b3ed;"
            : "background:#1a202c; color:#a0aec0;";
        const prTabStyle = currentTrayTab === "pr"
            ? "background:#2b6cb0; color:#fff; font-weight:bold; border-bottom:2px solid #63b3ed;"
            : "background:#1a202c; color:#a0aec0;";

        const menuBodyHTML = `
        <div style="background:linear-gradient(135deg, #2d3748 0%, #1a202c 100%); padding:12px; border-radius:8px; border:1px solid #4a5568; text-align:center; margin-bottom:10px;">
            <span style="font-size:11px; font-weight:bold; color:#63b3ed; letter-spacing:1px;">ELECTION TRAY REPORT</span>
            <h3 style="font-size:16px; font-weight:bold; margin:4px 0; color:#fff;">🗺️ 開票速報・カテゴリー選択</h3>
        </div>

        <!-- 💡 タブ切替ヘッダー -->
        <div style="display:flex; margin-bottom:10px; border-radius:6px; overflow:hidden; border:1px solid #4a5568;">
            <button onclick="window.switchTrayTab('district')" style="flex:1; padding:8px; border:none; cursor:pointer; font-size:12px; ${distTabStyle}">
                📍 小選挙区
            </button>
            <button onclick="window.switchTrayTab('pr')" style="flex:1; padding:8px; border:none; cursor:pointer; font-size:12px; ${prTabStyle}">
                🟦 比例代表
            </button>
        </div>

        ${contentHTML}
        `;

        showModal("🏛️ 総選挙・選挙区＆比例選択 (1/3)", menuBodyHTML, [
            {
                text: "📊 次へ：全国・政党比例＆統計結果を見る ➡️",
                className: "scout-btn",
                keepOpen: true,
                callback: () => {
                    showNationalStatsSummary();
                }
            }
        ]);
    }

    // タブ切り替え関数
    window.switchTrayTab = function (tabName) {
        currentTrayTab = tabName;
        showPrefectureBlockMenu();
    };

    // ==========================================
    // 🔍 画面2-A：【特定小選挙区（都道府県）の詳細画面】
    // ==========================================
    window.showPrefDetails = function (prefName) {
        const districts = regionalCandidates[prefName] || {};
        let candidateRowsHTML = "";

        const activeDists = Object.keys(districts).sort((a, b) => Number(a) - Number(b));

        activeDists.forEach(distNum => {
            const candidates = districts[distNum] || [];

            candidateRowsHTML += `
            <div style="background:#4a5568; color:#fff; font-size:11px; font-weight:bold; padding:4px 8px; border-radius:4px; margin:12px 0 6px 0; text-align:left;">
                🟩 ${prefName} 第${distNum}区（小選挙区・定数1）
            </div>
            `;

            if (candidates.length === 0) {
                candidateRowsHTML += `<div style="color:#a0aec0; font-size:11px; text-align:center; padding:8px;">立候補者がいません</div>`;
                return;
            }

            candidates.forEach((cand, idx) => {
                const pColor = cand.partyId ? (parties[cand.partyId]?.color || "#4a5568") : "#718096";
                const pName = cand.partyId ? (parties[cand.partyId]?.name || "既成政党") : "無所属";

                const isElected = idx === 0;
                let statusBadge = "";
                if (isElected) {
                    statusBadge = `<span style="background:#2f855a; color:#fff; font-size:10px; padding:2px 6px; border-radius:3px; font-weight:bold;">🟢 当選</span>`;
                } else if (cand.rep) {
                    statusBadge = `<span style="background:#805ad5; color:#fff; font-size:10px; padding:2px 6px; border-radius:3px; font-weight:bold;">🧟 比例復活</span>`;
                } else {
                    statusBadge = `<span style="background:#9b2c2c; color:#fff; font-size:10px; padding:2px 6px; border-radius:3px; font-weight:bold;">❌ 落選</span>`;
                }

                const isUser = player && cand.id === player.id;
                const displayName = isUser ? `<span style="color:#ecc94b; font-weight:bold;">${cand.name} (あなた)</span>` : cand.name;

                candidateRowsHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#1a202c; padding:8px 12px; border-radius:6px; margin-bottom:6px; border-left:4px solid ${pColor};">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:12px; font-weight:bold; color:#a0aec0; min-width:18px;">${idx + 1}位</span>
                        <div>
                            <div style="font-size:13px; color:#fff; font-weight:bold;">${displayName}</div>
                            <div style="font-size:10px; color:#edf2f7; background:${pColor}; display:inline-block; padding:1px 4px; border-radius:2px; margin-top:2px;">${pName}</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:13px; font-weight:bold; color:#fff;">${Math.floor(cand.currentVotes).toLocaleString()} <span style="font-size:10px; font-weight:normal; color:#a0aec0;">票</span></div>
                        <div style="margin-top:2px;">${statusBadge}</div>
                    </div>
                </div>
                `;
            });
        });

        const detailBodyHTML = `
        <div style="background:#2d3748; padding:10px; border-radius:6px; margin-bottom:12px; border:1px solid #4a5568;">
            <span style="color:#63b3ed; font-weight:bold; font-size:14px;">📍 ${prefName} 選挙区・小選挙区結果</span>
        </div>

        <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
            ${candidateRowsHTML}
        </div>
        `;

        showModal(`🏛️ 総選挙・${prefName}結果 (2/3)`, detailBodyHTML, [
            {
                text: "⬅️ 一覧に戻る",
                className: "close-btn",
                keepOpen: true,
                callback: () => {
                    showPrefectureBlockMenu();
                }
            }
        ]);
    };

    // ==========================================
    // 🔍 画面2-B：【比例ブロック（東京など）の詳細画面】
    // ==========================================
    window.showPRBlockDetails = function (blockIndex) {
        if (!globalPRBlocks || !globalPRBlocks[blockIndex]) return;
        const block = globalPRBlocks[blockIndex];

        // 該当ブロック内の比例当選者を全リストアップ
        const prElectedList = [];

        // 1. 小選挙区からの比例復活者
        block.prefs.forEach(p => {
            if (!regionalCandidates[p]) return;
            for (const d in regionalCandidates[p]) {
                const cands = regionalCandidates[p][d];
                if (!cands || cands.length === 0) continue;
                const winnerVotes = cands[0].currentVotes || 1;

                cands.forEach((c, idx) => {
                    if (idx > 0 && c.rep) { // 2位以下＆repフラグオン＝比例復活
                        const sekihai = ((c.currentVotes / winnerVotes) * 100).toFixed(1);
                        prElectedList.push({
                            name: c.name,
                            partyId: c.partyId,
                            type: "比例復活",
                            sekihai: sekihai,
                            origin: `${p}第${d}区`,
                            isUser: player && c.id === player.id
                        });
                    }
                });
            }
        });

        // 2. 比例単独当選者（NPC）
        if (typeof npcs !== "undefined") {
            npcs.forEach(npc => {
                if (npc.rep && block.prefs.includes(npc.pref) && (npc.city === "中心街" || npc.city === "比例単独")) {
                    prElectedList.push({
                        name: npc.name,
                        partyId: npc.partyId,
                        type: "比例単独",
                        sekihai: null,
                        origin: `${npc.pref}`,
                        isUser: false
                    });
                }
            });
        }

        let prRowsHTML = "";
        if (prElectedList.length === 0) {
            prRowsHTML = `<div style="color:#a0aec0; text-align:center; padding:12px;">このブロックの比例当選者データはありません</div>`;
        } else {
            prElectedList.forEach((item, idx) => {
                const pColor = item.partyId ? (parties[item.partyId]?.color || "#4a5568") : "#718096";
                const pName = item.partyId ? (parties[item.partyId]?.name || "既成政党") : "無所属";

                const isZombie = item.type === "比例復活";
                const badgeBg = isZombie ? "#805ad5" : "#3182ce";
                const sekihaiText = isZombie ? `<span style="font-size:10px; color:#d6bcfa; margin-left:4px;">(惜敗率 ${item.sekihai}%)</span>` : "";

                const displayName = item.isUser ? `<span style="color:#ecc94b; font-weight:bold;">${item.name} (あなた)</span>` : item.name;

                prRowsHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#1a202c; padding:8px 12px; border-radius:6px; margin-bottom:6px; border-left:4px solid ${pColor};">
                    <div>
                        <div style="font-size:13px; color:#fff; font-weight:bold;">
                            ${idx + 1}. ${displayName} ${sekihaiText}
                        </div>
                        <div style="font-size:10px; color:#a0aec0; margin-top:2px;">
                            <span style="background:${pColor}; color:#fff; padding:1px 4px; border-radius:2px; margin-right:4px;">${pName}</span>
                            出身: ${item.origin}
                        </div>
                    </div>
                    <div>
                        <span style="background:${badgeBg}; color:#fff; font-size:10px; padding:3px 6px; border-radius:3px; font-weight:bold;">
                            ${item.type}
                        </span>
                    </div>
                </div>
                `;
            });
        }

        const prDetailBodyHTML = `
        <div style="background:#2b6cb0; padding:10px; border-radius:6px; margin-bottom:12px; color:#fff;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; font-size:14px;">🟦 比例${block.name}</span>
                <span style="font-size:11px; background:#1a365d; padding:2px 6px; border-radius:3px;">定数: ${block.seats || 0} 議席</span>
            </div>
            <span style="font-size:10px; opacity:0.9; display:block; margin-top:4px;">構成: ${block.prefs ? block.prefs.join("・") : ""}</span>
        </div>

        <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
            ${prRowsHTML}
        </div>
        `;

        showModal(`🏛️ 比例${block.name}・当選結果 (2/3)`, prDetailBodyHTML, [
            {
                text: "⬅️ 一覧に戻る",
                className: "close-btn",
                keepOpen: true,
                callback: () => {
                    showPrefectureBlockMenu();
                }
            }
        ]);
    };

    // ==========================================
    // 📊 画面3：【全国・統計＆最終議席確定】
    // ==========================================
    function showNationalStatsSummary() {
        const allPartyIds = Array.from(new Set([
            ...Object.keys(partySeatsWon),
            ...Object.keys(partyPRVotes)
        ]));

        const grandTotalPRVotes = Object.values(partyPRVotes).reduce((a, b) => a + b, 0) || 1;

        const localSeatsCount = {};
        for (const pref in regionalCandidates) {
            for (const dist in regionalCandidates[pref]) {
                const cands = regionalCandidates[pref][dist];
                if (cands && cands.length > 0) {
                    const winnerParty = cands[0].partyId || "無所属";
                    const cleanPId = (!winnerParty || winnerParty === "null" || winnerParty === "independents" || winnerParty === "undefined") ? "無所属" : winnerParty;
                    localSeatsCount[cleanPId] = (localSeatsCount[cleanPId] || 0) + 1;
                }
            }
        }

        let numDistrictSeats = Math.round(totalHouseSeats * 0.62) || 0;
        if (!hirei_house) {
            numDistrictSeats = totalHouseSeats;

        }

        const numPRSeats = prseats || 0;

        const partySummaryList = allPartyIds.map(pId => {
            const totalSeats = partySeatsWon[pId] || 0;
            const localSeats = localSeatsCount[pId] || 0;
            const prSeats = Math.max(0, totalSeats - localSeats);
            const votes = partyPRVotes[pId] || 0;
            const voteShare = ((votes / grandTotalPRVotes) * 100).toFixed(1);

            return {
                id: pId,
                localSeats: localSeats,
                prSeats: prSeats,
                totalSeats: totalSeats,
                votes: votes,
                voteShare: voteShare
            };
        }).sort((a, b) => b.totalSeats - a.totalSeats);

        const grandTotalSeatsCalculated = Number(numDistrictSeats) + Number(numPRSeats);

        let rankingHTML = "";
        partySummaryList.forEach((res, index) => {
            let pName = "無所属";
            let pColor = "#718096";

            if (res.id !== "無所属") {
                pName = parties[res.id]?.name || "既成政党";
                pColor = parties[res.id]?.color || "#4a5568";
            }
            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "👤";

            rankingHTML += `
            <div style="background:#1a202c; padding:10px 12px; border-radius:6px; margin-bottom:8px; border-left:5px solid ${pColor};">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-weight:bold; color:#fff; font-size:14px;">${medal} ${pName}</span>
                    <span style="font-size:16px; font-weight:bold; color:#ecc94b;">
                        ${res.totalSeats} <span style="font-size:11px; color:#a0aec0;">議席</span>
                    </span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#a0aec0; background:#2d3748; padding:4px 8px; border-radius:4px;">
                    <span>小選挙区: <b style="color:#fff;">${res.localSeats}</b></span>
                    <span>比例代表: <b style="color:#63b3ed;">${res.prSeats}</b></span>
                    <span>得票数: <b style="color:#e2e8f0;">${Math.floor(res.votes).toLocaleString()}票 (${res.voteShare}%)</b></span>
                </div>
            </div>
            `;
        });

        const electionCountText = typeof gameSessionElectionCount !== "undefined" ? `第${gameSessionElectionCount}回` : "最新";

        const statsBodyHTML = `
        <div style="background:linear-gradient(135deg, #1a202c 0%, #2d3748 100%); padding:12px; border-radius:8px; border:2px solid #ecc94b; text-align:center; margin-bottom:12px;">
            <span style="font-size:10px; font-weight:bold; color:#ecc94b; letter-spacing:2px;">PARLIAMENTARY ELECTION FINAL RESULT</span>
            <h2 style="font-size:17px; font-weight:bold; margin:4px 0; color:#fff;">🏛️ ${electionCountText} 下院総選挙・最終議席確定</h2>
            <span style="font-size:11px; color:#a0aec0;">
                総議席数: <b>${grandTotalSeatsCalculated}</b> (小選挙区:${numDistrictSeats} / 比例:${numPRSeats})
            </span>
        </div>

        <span style="color:#63b3ed; display:block; font-weight:bold; margin-bottom:6px; font-size:13px;">📊 総合獲得議席＆得票率</span>
        <div style="max-height:210px; overflow-y:auto; padding-right:2px;">
            ${rankingHTML}
        </div>
        `;

        showModal("🏛️ 総選挙・全国統計 (3/3)", statsBodyHTML, [
            {
                text: "⬅️ 一覧に戻る",
                className: "close-btn",
                keepOpen: true,
                callback: () => {
                    showPrefectureBlockMenu();
                }
            },
            {
                text: "🗳️ 新しい議会を開会（確定）",
                className: "scout-btn",
                keepOpen: false,
                callback: () => {
                    console.log("⚡ 全選挙データの閲覧が完了し、進行ロックが解除されました。");
                    if (typeof activeBlockTurnNotificationCount !== "undefined") {
                        activeBlockTurnNotificationCount = 0;
                    }
                }
            }
        ]);
    }
}

