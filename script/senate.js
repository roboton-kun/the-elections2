// 💡 プレイヤーが今回の選挙に立候補しているかどうかを管理するフラグ
let isPlayerRunningInsenateElection = false;
let senate_rulingparty = [];
let senate_opposition = []
let senate_largest_opoosition = null;



function announceSenateElection(kaisen = "gusu") {
    if (!senate_enable) return;
    // 初期化
    isPlayerRunningInsenateElection = false;
    const currentCount = (typeof gameSessionElectionCount !== "undefined" && gameSessionElectionCount > 0)
        ? gameSessionElectionCount
        : (window.senateelectionhistory ? window.senateelectionhistory.length + 1 : 1);

    // 選挙特設モーダル（トレイをタップした時に開く中身）のHTML
    const announceHTML = `
        <div style="background:linear-gradient(135deg, #1a202c 0%, #2d3748 100%); padding:14px; border-radius:8px; border:2px solid #e53e3e; text-align:center; margin-bottom:12px;">
            <span style="font-size:11px; font-weight:bold; color:#f56565; letter-spacing:1px;">⚠️ NATIONAL EVENT</span>
            <h2 style="font-size:18px; font-weight:bold; margin:4px 0; color:#fff;">🏛️ 第${currentCount}回上院議員総選挙・公示</h2>
            <span style="font-size:11px; color:#a0aec0;">定数3 中選挙区制 / 4年の任期満了に伴う総選挙（対象グループ: ${kaisen}）</span>
        </div>
        <div style="background:#1a202c; padding:10px; border-radius:6px; border:1px solid #4a5568; margin-bottom:12px;">
            <span style="color:#63b3ed; display:block; font-weight:bold; font-size:13px; margin-bottom:4px;">📋 あなたの出馬ステータス</span>
            <p id="playerRunStatusText" style="font-size:12px; color:#e2e8f0; margin:0;">判定中...</p>
        </div>
    `;

    // 💡 プレイヤーの状態フラグを整理
    const isRep = !!player.rep; // 下院議員か
    const isSen = !!player.sen; // 上院議員か
    const isHikaisen = isSen && player.group !== kaisen; // 上院議員、かつ今回のグループではない（非改選）

    // ボタンの動的生成用配列
    let modalButtons = [];

    // 1. 【出馬すらできないケース】（下院議員、または上院の非改選グループ）
    if (isRep || isHikaisen) {
        pushNotificationTray(
            `上院総選挙の公示 🗳️`,
            "任期が満了しました！タップして選挙画面を開きます",
            {
                title: "🏛️ 選挙管理委員会",
                body: announceHTML,
                buttons: [
                    {
                        text: "🗳️ 投票開始（開票シミュレーション実行）",
                        className: "scout-btn",
                        keepOpen: true,
                        callback: () => {
                            triggerSenateElection(kaisen);
                        }
                    }
                ]
            },
            true
        );

        // トレイを投げた直後に、DOMが生成されるのを待ってテキストを上書き
        setTimeout(() => {
            const statusText = document.getElementById("playerRunStatusText");
            if (statusText) {
                if (isRep) {
                    statusText.innerHTML = `<strong>【立候補不可】</strong> あなたは <strong>下院議員</strong> です。上院選挙には出馬できません。`;
                } else {
                    statusText.innerHTML = `<strong>【非改選】</strong> あなたのグループ（${player.group}）は今回、<strong>非改選</strong> です。`;
                }
                statusText.style.color = "#ff0000";
            }
        }, 50);

        return; // 出馬できないのでここで終了
    }

    // 2. 【出馬が可能なケース】（未所属、または上院の当期限れ改選グループ）
    // 初期状態は未立候補
    isPlayerRunningInsenateElection = false;

    pushNotificationTray(
        `上院総選挙の公示 🗳️`,
        "任期が満了しました！タップして立候補手続き・選挙画面を開きます",
        {
            title: "🏛️ 選挙管理委員会",
            body: announceHTML,
            buttons: [
                {
                    text: `✋ ${player.pref}から立候補する`,
                    className: "bribe-btn",
                    keepOpen: true,
                    callback: () => {
                        isPlayerRunningInsenateElection = true;
                        const statusText = document.getElementById("playerRunStatusText");
                        if (statusText) {
                            statusText.innerHTML = `🟢 <strong>【立候補確定】</strong> あなたは <strong>${player.pref}</strong> 選挙区から出馬します！`;
                            statusText.style.color = "#48bb78";
                        }
                    }
                },
                {
                    text: "🤝 自分は出馬せず、裏方に回る",
                    className: "close-btn",
                    keepOpen: true,
                    callback: () => {
                        isPlayerRunningInsenateElection = false;
                        const statusText = document.getElementById("playerRunStatusText");
                        if (statusText) {
                            statusText.innerHTML = `⚪ <strong>【裏方に専念】</strong> あなたは今回出馬せず、党の議席拡大をバックアップします。`;
                            statusText.style.color = "#a0aec0";
                        }
                    }
                },
                {
                    text: "🗳️ 投票開始（開票シミュレーション実行）",
                    className: "scout-btn",
                    keepOpen: true,
                    callback: () => {
                        triggerSenateElection(kaisen);
                    }
                }
            ]
        },
        true
    );

    // テキストの初期表示をセット
    setTimeout(() => {
        const statusText = document.getElementById("playerRunStatusText");
        if (statusText) {
            statusText.innerHTML = `現在は【未立候補】です。裏方に徹するか、あなたの拠点（${player.pref}）から出馬するか選択してください。`;
            statusText.style.color = "#e2e8f0";
        }
    }, 50);
}


let senate = {};

function triggerSenateElection(target = "gusu") {
    const regionalCandidates = {};
    // 💡 1. 総合獲得議席オブジェクト（最初から非改選の議席をベースとして入れておく）
    const partySeatsWon = {};
    const getCleanPartyId = (pId) => {
        if (!pId || pId === "null" || pId === "independents" || pId === "undefined" || pId === "無所属連合") {
            return "無所属";
        }
        return pId;
    };
    // プレイヤーとNPC全員のリスト
    const allMembers = [player, ...npcs];

    // 💡 2. 【重要】選挙の計算を回す前に、非改選（今回は選挙がない安全なグループ）の議席数を予め政党ごとにカウントして仕込んでおく！
    allMembers.forEach(m => {
        // 上院現職であり、かつ今回の改選対象ではない（非改選）グループの人
        if (m.sen && m.group !== target) {
            const pId = getCleanPartyId(m.partyId);
            partySeatsWon[pId] = (partySeatsWon[pId] || 0) + 1;
        }
    });

    // --- 以下は告示前履歴（kokujimae）の保存処理 ---
    let kokujimae = {};
    if (typeof parties !== 'undefined') {
        Object.values(parties).forEach(party => {
            // 告示前時点の「その政党の全上院議員（改選・非改選すべて）」を抽出する場合
            const senMemberIds = allMembers
                .filter(m => m.sen && m.partyId === party.id)
                .map(m => m.id || "player");

            kokujimae[party.id] = {
                partyName: party.name || party.id,
                seats: senMemberIds.length,
                memberIds: senMemberIds
            };
        });
    }
    console.log("📊 告示前総勢力（非改選含む）:", kokujimae);
    senate_kokujimae = kokujimae;

    // 💡 3. 今回の選挙区に出馬する対象グループの現職フラグだけを折る（非改選は維持！）
    allMembers.forEach(m => {
        if (m.group === target) {
            m.sen = false;
        }
    });
    // 1. 💡 プレイヤーが出馬ボタンを明確に押した場合のみ、候補者リストに登録する！
    if (player && isPlayerRunningInsenateElection) {
        player.currentVotes = 0;
        player.partyId = player.partyId || null;

        const prefMap = SenateMap[player.pref];
        // 💡 NPC側と全く同じように、プレイヤーが所属する都市から「選挙区名」を取得する
        const distInfo = prefMap ? prefMap[player.city] : null;
        const districtId = distInfo ? distInfo.districtName : "選挙区";

        // 💡 1階層目（都道府県）の初期化
        if (!regionalCandidates[player.pref]) regionalCandidates[player.pref] = {};

        // 💡 2階層目（選挙区名）の初期化（配列がなければ作る）
        if (!regionalCandidates[player.pref][districtId]) {
            regionalCandidates[player.pref][districtId] = [];
        }

        // 💡 正しい選挙区の配列にプレイヤーをエントリー（push）する！
        regionalCandidates[player.pref][districtId].push(player);
    }


    // 2. 条件を満たしたNPCを確率で立候補者として追加
    const totalNpcs = npcs.length;
    for (let i = 0; i < totalNpcs; i++) {
        const cand = npcs[i];
        if (cand.sen && cand.group !== target) continue;
        if (president && president.id === cand.id) continue;
        if (vicepresident && vicepresident.id === cand.id) continue;
        if (cand.rep) continue;
        if (cand.age <= 30) continue;

        if (cand.money < 500000) continue;
        // 💡【修正】直球で null ではない、かつ undefined でもないことをチェック！
        if (presidentElect !== null && typeof presidentElect !== 'undefined') {
            if (cand.id === presidentElect.id) continue;
        }
        if (vicepresidentElect !== null && typeof vicepresidentElect !== 'undefined') {
            if (cand.id === vicepresidentElect.id) continue;
        }

        // 💡【修正1】上院オブジェクトから「選挙区名（districtName）」と「定数（seats）」を取得
        const prefMap = SenateMap[cand.pref];
        const distInfo = prefMap ? prefMap[cand.city] : null;

        // もしデータがなければ安全のためにデフォルト値を設定
        const districtId = distInfo ? distInfo.districtName : "全州選挙区";
        const maxSeats = distInfo ? distInfo.seats : 1; // その選挙区の定数（例: 4）

        // 💡 1. 候補者配列の初期化チェック（ districtId をキーにする）
        if (!regionalCandidates[cand.pref]) regionalCandidates[cand.pref] = {};
        if (!regionalCandidates[cand.pref][districtId]) regionalCandidates[cand.pref][districtId] = [];

        const currentCandidates = regionalCandidates[cand.pref][districtId];

        // 💡 主要政党（先頭2つの政党）のIDを取得
        const partyArray = Array.isArray(parties) ? parties : Object.values(parties || {});
        const majorPartyIds = [partyArray[0]?.id, partyArray[1]?.id].filter(Boolean);

        // 💡 2. 【上院向けに枠制限をリライト】
        if (cand.partyId && cand.partyId !== null) {
            // 💡【修正2】同じ政党からの重複出馬は「定数（maxSeats）」までOKにする！
            const samePartyCount = currentCandidates.filter(c => c.partyId === cand.partyId).length;
            if (samePartyCount >= maxSeats) continue;

            // 主要政党（0番目・1番目）以外の「諸派」判定
            const isMajorParty = majorPartyIds.includes(cand.partyId);

            if (!isMajorParty) {
                // 💡【修正3】諸派も定数に合わせて出馬枠を広げる（定数4なら最大2人まで、など）
                const minorPartyLimit = Math.max(1, Math.floor(maxSeats / 2));
                const minorPartyCount = currentCandidates.filter(c => c.partyId && !majorPartyIds.includes(c.partyId)).length;
                if (minorPartyCount >= minorPartyLimit) continue;
            }
        } else {
            // 💡【修正4】無所属も定数に合わせて出馬枠を変動させる（定数の数だけ無所属が出られる）
            const independentCount = currentCandidates.filter(c => !c.partyId).length;
            if (independentCount >= maxSeats) continue;
        }

        // 💡 3. 出馬確率の判定
        const isRepBonus = cand.rep ? 0.6 : 0;
        let finalProbability = 0.1 + (cand.xp / 100) + isRepBonus;

        // ─── 🚨 2大政党制モード時の立候補ブレーキ ───
        if (typeof twoparty !== "undefined" && twoparty) {
            const pId = cand.partyId;
            const isMajorParty = majorPartyIds.includes(pId);

            if (!pId || pId === null) {
                finalProbability *= 0.1;
            } else if (!isMajorParty) {
                finalProbability *= 0.05;
            }
        }

        if (Math.random() > finalProbability) continue;

        // 出馬確定後の処理
        cand.money -= 500000;
        cand.currentVotes = 0;
        cand.rep = false; // 出馬した時点で下院議員の資格をリセット（重複防止）

        currentCandidates.push(cand);
    }

    const countr22yKey = localStorage.getItem("poligame_data")
        ? JSON.parse(localStorage.getItem("poligame_data")).countrySelect || "jp"
        : "jp";

    // 2. 選択された国のデータを取得
    const selectedCountry = country[countr22yKey];

    // 全県の pop を全部足して、合計値を算出
    const totalPopSum = Object.values(selectedCountry.pref).reduce((sum, p) => sum + (p.pop || 1), 0);

    for (const pref in selectedCountry.pref) {
        const prefecture = selectedCountry.pref[pref];
        const adjustedPop = prefecture.pop || 1;

        // 💡 上院の総選挙区定数（例: TOTAL_SENATE_SEATS などを定義しておくか、固定値）
        const TOTAL_SENATE_SEATS = totalSenateSeats;

        // 人口比から、この州の「獲得議席数（定数）」を算出
        const maxSeats = Math.max(1, Math.round((adjustedPop / totalPopSum) * TOTAL_SENATE_SEATS));

        const prefMap = SenateMap[pref] || {};

        if (!regionalCandidates[pref]) {
            regionalCandidates[pref] = {};
        }

        // 💡【修正】街のデータから「上院の選挙区名」を取得する
        // 登録されている最初の街から代表的な選挙区名を作るか、見つからなければフォールバック
        const sampleCity = prefecture.cities && prefecture.cities[0] ? prefecture.cities[0] : "中心街";
        const distInfo = prefMap[sampleCity];
        const districtId = distInfo ? distInfo.districtName : `${pref}選挙区`;

        if (!regionalCandidates[pref][districtId]) {
            regionalCandidates[pref][districtId] = [];
        }

        // 💡【修正】最低でも「定数 + 2人」の立候補者が集まるまで刺客を補充する！
        // 定数4なら、最低6人が競い合う環境を作ります
        const minCandidateRequired = maxSeats + 2;

        while (regionalCandidates[pref][districtId].length < minCandidateRequired) {
            // その州の都市リストからランダム、または均等に選出
            const currentCandidatesCount = regionalCandidates[pref][districtId].length;
            let cityInThisDist = prefecture.cities && prefecture.cities.length > 0
                ? prefecture.cities[currentCandidatesCount % prefecture.cities.length]
                : `${pref}中央区`;

            const countryKey = localStorage.getItem("poligame_data")
                ? JSON.parse(localStorage.getItem("poligame_data")).countrySelect || "jp"
                : "jp";

            const secretNpcId = "npc_sen_" + Math.random().toString(36).substring(2, 11);
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
            const existingPartyIds = regionalCandidates[pref][districtId].map(c => c.partyId).filter(Boolean);

            if (parties) {
                const partyList = Array.isArray(parties) ? parties : Object.values(parties);

                // 各政党の擁立力を計算してフィルタリング
                const eligibleParties = partyList.filter(party => {
                    if (!party || !party.id || party.id === "無所属") return false;

                    // 💡【修正】上院では同じ党から複数出馬できるため、
                    // 「すでにその政党が定数（maxSeats）以上の候補者を立てている場合のみ」弾くように変更
                    const partySpawnedCount = regionalCandidates[pref][districtId].filter(c => c.partyId === party.id).length;
                    if (partySpawnedCount >= maxSeats) return false;

                    let fieldingRate = 0.20;

                    const isRuling = typeof rulingparty !== "undefined" && rulingparty.includes(party.id);
                    const isMainOpposition = typeof largest_opoosition !== "undefined" && String(largest_opoosition) === String(party.id);

                    if (isRuling) {
                        fieldingRate = 0.95; // 与党は定数分の複数擁立も積極的に行う
                    } else if (isMainOpposition) {
                        fieldingRate = 0.85;
                    } else if (party.seats && party.seats > 10) {
                        fieldingRate = 0.40;
                    }

                    return Math.random() < fieldingRate;
                });

                // 擁立可能な候補政党の中から、思想が最も近い政党を選ぶ
                if (eligibleParties.length > 0) {
                    let minDiff = Infinity;
                    eligibleParties.forEach(party => {
                        const pIde = Array.isArray(party.ideology) ? party.ideology : null
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
                sen: false, // 💡 上院フラグの初期値

                // 💡 上院専用（比例復活などの重複はないためfalse。純粋な選挙区選）
                isProportional: false
            };

            npcs.push(urgentNpcCandidate);
            regionalCandidates[pref][districtId].push(urgentNpcCandidate);

            console.log(`⚔️ 上院対立確保：[${pref} - ${districtId} (定数:${maxSeats})] に刺客 【${npcName}】 (${assignedPartyId || '無所属'}) を投入！`);

            // 💡【修正】下院の「比例単独枠」を生成するコードは上院には不要なため、美しくカットしました。
        }
    }
    // 3. Voterによる投票フェーズ
    const totalVoters = allVoters.length;
    const nationalNetApproval = (typeof presidentapproval !== "undefined" && presidentapproval?.national?.netApproval)
        ? presidentapproval.national.netApproval
        : 0;
    for (let v = 0; v < totalVoters; v++) {
        const voter = allVoters[v];
        const prefCandidates = regionalCandidates[voter.pref];
        if (!prefCandidates) continue;

        // 💡【修正1】キーは数値ではなく文字列（「〇〇州選挙区」など）なので map(Number) を廃止！
        const availableDistricts = Object.keys(prefCandidates);
        if (availableDistricts.length === 0) continue;

        // 💡【修正2】有権者の街（city）から上院用の正しい選挙区（districtName）を引き出す
        const prefMap = SenateMap[voter.pref];
        const distInfo = prefMap ? prefMap[voter.city] : null;
        let voterDist = distInfo ? distInfo.districtName : null;

        // もし何かしらの原因で取得できない場合のセーフティネット
        if (!voterDist || !prefCandidates[voterDist] || prefCandidates[voterDist].length === 0) {
            const validDistricts = availableDistricts.filter(d => prefCandidates[d] && prefCandidates[d].length > 0);
            if (validDistricts.length === 0) continue;
            voterDist = validDistricts[v % validDistricts.length];
        }

        const localCandidates = prefCandidates[voterDist];
        if (!localCandidates || localCandidates.length === 0) continue;

        const turnoutRate = voter.turnoutRate ?? 0.60;
        if (Math.random() > turnoutRate) continue;

        const isTwoPartyMode = typeof twoparty !== "undefined" && twoparty;
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

        // 3. 上位候補絞り込み (20%) — 各種バフ・ハンデ適用
        // 💡【上院向け調整】定数が複数あるため、上位「2候補」ではなく「定数＋1候補」程度に選択肢を広げて考えさせます
        else if (rand < 0.85) {
            const sortedLocal = [...candidatesPool].sort((a, b) => {
                const getCandidateScore = (c) => {
                    let baseScore = (c.power || 0) + (c.fame || 0) + ((c.xp || 0) * 10) || c.status || 10000;
                    const pId = getCleanPartyId(c.partyId);

                    if (pId === "independents") {
                        baseScore *= 0.5;
                    }

                    const isRuling = typeof rulingparty !== "undefined" && rulingparty.includes(pId);
                    const isOpposition = typeof largest_opoosition !== "undefined" && String(pId) === String(largest_opoosition);
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

            // 💡定数(seats)を取得、分からなければデフォルト3名
            const currentSeats = distInfo ? distInfo.seats : 3;
            // 定数より少し多めの選択肢から選ばせることで大選挙区のリアルさを演出
            const topPoolCount = currentSeats + 1;
            const topCandidates = sortedLocal.slice(0, topPoolCount);

            if (topCandidates.length > 0) {
                const voteResult = voter.thinkAndVote(topCandidates);
                if (voteResult && voteResult.candidateId) {
                    chosenCandidate = topCandidates.find(c => String(c.id) === String(voteResult.candidateId));
                }
                if (!chosenCandidate) {
                    chosenCandidate = topCandidates[Math.floor(Math.random() * topCandidates.length)];
                }
            }
        }

        // 4. ガチ信念層 & 実力派の救済 (15%)
        if (!chosenCandidate) {
            const acceptableCandidates = candidatesPool.filter(cand => {
                const pId = getCleanPartyId(cand.partyId);
                const isHeavyweight = (cand.xp || 0) >= 50 || (cand.fame || 0) >= 50000;
                const isRuling = typeof rulingparty !== "undefined" && rulingparty.includes(pId);
                const isOpposition = typeof largest_opoosition !== "undefined" && String(pId) === String(largest_opoosition);

                if (isTwoPartyMode) {
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
    // 4. 上院（選挙区）の開票・集計
    let totalSeatsCalculated = 0;

    // 集計前に議席オブジェクトを念のため初期化
    for (const key in partySeatsWon) delete partySeatsWon[key];

    // ※上院が純粋な選挙区選（大選挙区制）のみであれば比例集計（partyPRVotes）は不要ですが、
    // もし他で参照している場合のために変数だけ残しておきます。
    const partyPRVotes = {};

    for (const pref in regionalCandidates) {
        const districts = regionalCandidates[pref];

        for (const dist in districts) {
            const candidatesInDistrict = districts[dist];
            if (!candidatesInDistrict || candidatesInDistrict.length === 0) continue;

            // 💡 1. まず得票数が多い順にソート
            candidatesInDistrict.sort((a, b) => b.currentVotes - a.currentVotes);

            // 💡 2. その選挙区の「定数（seats）」を SenateMap から取得（安全のため無ければ1）
            // 💡 2. その選挙区の「定数（seats）」を SenateMap から取得
            const prefMap = SenateMap[pref];

            // 【改善】cityではなく、dist（選挙区キー）で直接引ける構造にするか、
            // もしくは現在のロジックのまま、ログを出して異常な定数（2や3など）を検知する
            const distInfo = prefMap ? prefMap[candidatesInDistrict[0].city] : null;
            let maxSeats = distInfo ? distInfo.seats : 1;

            // 🔍 デバッグ用ログ：各選挙区で想定外の定数が取れていないかチェック
            // （例: 本来1のはずの選挙区で2が取れていたら、ここが原因です）
            console.log(`【デバッグ】県: ${pref}, 選挙区: ${dist}, 候補者数: ${candidatesInDistrict.length}, 判定された定数: ${maxSeats}`);

            // 💡 3. 得票順ソートされた配列から「上位 maxSeats 人」を当選
            const winners = candidatesInDistrict.slice(0, maxSeats);

            const losers = candidatesInDistrict.slice(maxSeats);

            // 👑 【当選者たち（上位 maxSeats 人）】の処理
            winners.forEach((winner, index) => {
                winner.sen = true; // 💡【重要】下院（rep）ではなく上院（sen）フラグをON！
                winner.rep = false; // 念のため下院フラグは折る

                if (typeof winner.termCount === 'undefined') {
                    winner.termCount = 1;
                } else {
                    winner.termCount += 1;
                }
                winner.xp += 20;

                // 💡 履歴メッセージを上院向けに美しく修正（何位当選かも添える）
                addhis(winner, `${dist}から第${index + 1}位で${winner.termCount === 1 ? `初当選（上院選挙）` : `当選（${winner.termCount}期目・上院選挙）`}`);
                winner.money += 500000;
                winner.group = target;
                totalSeatsCalculated++;

                const pId = getCleanPartyId(winner.partyId);
                partySeatsWon[pId] = (partySeatsWon[pId] || 0) + 1;
            });

            // 💀 【落選者たち】の処理
            losers.forEach(loser => {
                loser.sen = false; // 💡 上院現職フラグを折る
                delete loser.group
                addhis(loser, `${dist}で落選（上院選挙）`);
                loser.xp += 5; // 落選ストレス/XP微増
            });

            // ★ 全国比例得票数（※もしシステム上必要な場合の集計用ロジック）
            candidatesInDistrict.forEach(cand => {
                const targetParty = getCleanPartyId(cand.partyId);
                partyPRVotes[targetParty] = (partyPRVotes[targetParty] || 0) + cand.currentVotes;
            });
        }
    }
    const totalDistrictSeats = totalSeatsCalculated;

    const totalPRSeats = globalPRBlocks.reduce((sum, block) => sum + (block.seats || 0), 0);

    // ==========================================
    // 🛡️ 【新規追加】政党ごとの非改選議席の事前集計
    // ==========================================
    const hikaisenSeatsMap = {};

    [player, ...npcs].forEach(m => {
        if (m.sen && m.group !== target) {
            const pId = getCleanPartyId(m.partyId);
            hikaisenSeatsMap[pId] = (hikaisenSeatsMap[pId] || 0) + 1;
        }
    });

    // 📊 コンソールへの詳細ログ出力（内訳が見えるように強化！）
    console.group("🏛️ 上院総選挙 最終確定リポート");
    console.log(`総議席数: ${totalDistrictSeats + totalPRSeats} (選挙区: ${totalDistrictSeats})`);

    console.table(
        Object.keys(partySeatsWon).map(pId => {
            const votes = partyPRVotes[pId] || 0;
            const total = partySeatsWon[pId] || 0;
            const hikaisen = hikaisenSeatsMap[pId] || 0;
            const won = Math.max(0, total - hikaisen); // 総議席 - 非改選 ＝ 今回獲得議席

            return {
                "政党名": pId,
                "総議席数 (現在)": total,
                " ↳ 内訳: 非改選": hikaisen,  // 🛡️ 貯金議席
                " ↳ 内訳: 今回獲得": won,       // 🗳️ 今回勝った議席
                "得票数": votes.toLocaleString() + "票"
            };
        }).sort((a, b) => b["総議席数 (現在)"] - a["総議席数 (現在)"])
    );

    // 獲得議席数順に政党IDをソート
    const sortedPartyIds = Object.keys(partySeatsWon).sort((a, b) => {
        return (partySeatsWon[b] || 0) - (partySeatsWon[a] || 0);
    });

    // 無所属（independents）を除外した政党リストを作成
    const isIndependent = (id) => id === "無所属" || id === "independents" || id === "ind";
    const nonIndependentParties = sortedPartyIds.filter(pId => !isIndependent(pId));

    // 1. 無所属以外の最多数を獲得した政党が「与党（第1党）」
    if (nonIndependentParties.length > 0) {
        const topParty = nonIndependentParties[0];
        senate_rulingparty = [topParty];
    }

    // 2. 2番目に議席が多い政党が「最大野党（第2党）」
    if (nonIndependentParties.length > 1) {
        senate_largest_opoosition = nonIndependentParties[1];
    }

    // 3. 与党以外のすべての政党 ＋ 無所属 は「野党」グループに入る
    senate_opposition = sortedPartyIds.filter(pId => !rulingparty.includes(pId));

    console.log("🏛️ 政権枠組み結果:", {
        senate_rulingparty,
        senate_largest_opoosition,
        senate_opposition
    });

    console.log("🗺️ ブロック別比例枠配分:");
    globalPRBlocks.forEach(b => console.log(` ・${b.name}: ${b.seats} 議席`));
    console.groupEnd();

    // 6. 結果確定＆表示
    window.senateelectionhistory = window.senateelectionhistory || [];
    console.log(kokujimae);

    // 💡 保存関数に「非改選マップ（hikaisenSeatsMap）」も一緒に投げる
    saveSenateElectionToHistory(
        partyPRVotes,
        partySeatsWon,
        totalDistrictSeats,
        totalPRSeats,
        { senate_rulingparty, senate_largest_opoosition, senate_opposition },
        hikaisenSeatsMap // 🌟 第6引数として追加！
    );

    // 💡 表示関数にも「非改選マップ（hikaisenSeatsMap）」を渡して、UI側で内訳を出せるようにする！
    displaySenateResult(
        regionalCandidates,
        partySeatsWon,
        totalDistrictSeats,
        totalPRSeats,
        partyPRVotes,
        hikaisenSeatsMap // 🌟 第6引数として追加！
    );

    processLeaderResignationCheck(kokujimae, partySeatsWon);
}

window.senateelectionhistory = [];
// ==========================================
// 📚 歴代選挙データの保存（議席増減＆政権枠組み付き）
// ==========================================
function saveSenateElectionToHistory(
    partyPRVotes,
    partySeatsWon,
    totalDistrictSeats,
    totalPRSeats,
    hikaisenSeatsMap = {}, // 🌟 第6引数として非改選マップを受け取るように追加！
    coalitionData = {}
) {
    const { rulingparty = [], largest_opoosition = null, opposition = [] } = coalitionData;

    const currentCount = (typeof gameSessionElectionCount !== "undefined" && gameSessionElectionCount > 0)
        ? gameSessionElectionCount
        : (window.senateelectionhistory ? window.senateelectionhistory.length + 1 : 1);

    window.senateelectionhistory = window.senateelectionhistory || [];

    const prevHistory = window.senateelectionhistory.find(h => h && h.count === currentCount - 1)
        || window.senateelectionhistory[window.senateelectionhistory.length - 1] || null;

    const partyResults = {};
    const grandTotalPRVotes = Object.values(partyPRVotes).reduce((a, b) => a + b, 0) || 1;

    Object.keys(partySeatsWon).forEach(pId => {
        const pName = parties[pId]?.name || (pId === "無所属" ? "無所属" : "既成政党");
        const pColor = parties[pId]?.color || "#718096";
        const votes = partyPRVotes[pId] || 0;

        const currentSeats = partySeatsWon[pId] || 0; // 💡 総議席数
        const hikaisenSeats = hikaisenSeatsMap[pId] || 0; // 💡 【追加】非改選議席
        const wonSeats = Math.max(0, currentSeats - hikaisenSeats); // 💡 【追加】今回獲得議席

        // 💡 議席増減（diff）の計算ロジック
        // 上院は「今回の総議席 - 直前の総議席」で全体の勢力増減を出すのが一般的です
        let diff = null;
        if (prevHistory && prevHistory.partyResults) {
            const prevSeats = prevHistory.partyResults[pId] ? prevHistory.partyResults[pId].totalSeats : 0;
            diff = currentSeats - prevSeats;
        }

        const leaderId = parties?.[pId]?.leaderId;
        const leader = leaderId ? [player, ...npcs].find(n => n.id === leaderId) : null;

        partyResults[pId] = {
            name: pName,
            leaderName: leader?.name || "（不在）",
            leaderid: leader?.id || "",
            leaderIcon: leader?.icon || "https://yt3.googleusercontent.com/jg2X302tJOu2adgLeJmku0q58NWK6uzjyds_5O8I3O8uLkA48Zjc0jpt5bHtckoOQhNJB9KQew=s900-c-k-c0x00ffffff-no-rj",
            color: pColor,
            totalSeats: currentSeats, // 総議席
            hikaisenSeats: hikaisenSeats, // 🌟【追加】非改選の貯金
            wonSeats: wonSeats,           // 🌟【追加】今回の選挙で勝ち取った議席
            diff: diff,
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

    const historyData = {
        count: currentCount,
        dateLabel: `第${currentCount}回${currentCountryData.name}上院議員選挙`,
        totalSeats: totalDistrictSeats + totalPRSeats,
        districtSeats: totalDistrictSeats,
        prSeats: totalPRSeats,
        rulingparty: rulingparty,
        largest_opoosition: largest_opoosition,
        opposition: opposition,
        partyResults: partyResults
    };

    const existingIndex = window.senateelectionhistory.findIndex(h => h.count === currentCount);
    if (existingIndex >= 0) {
        window.senateelectionhistory[existingIndex] = historyData;
    } else {
        window.senateelectionhistory.push(historyData);
    }

    console.log("📚 Wiki履歴を更新（非改選データ対応版）:", historyData);
}


// ==========================================
// 📖 Wiki風・歴代選挙データベース表示 Modal
// ==========================================
function openSenateWikiModal(targetCount = null) {
    if (!window.senateelectionhistory || window.senateelectionhistory.length === 0) {
        alert("まだ過去の選挙記録がありません！選挙が実行されると記録されます。");
        return;
    }

    // 不正データを除外
    const validHistory = window.senateelectionhistory.filter(h => h && h.count !== undefined && !isNaN(h.count));

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
        <button onclick="openSenateWikiModal(${h.count})" style="
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
        let seatsWonRow = "";    // 🗳️ 今回獲得議席
        let seatChangeRow = "";  // 📊 議席増減
        let seatsBeforeRow = ""; // ⏳ 選挙前総議席
        let totalSeatsRow = "";  // 🏛️ 【新規】改選後総議席（非改選＋今回）
        let prVoteRow = "";
        let voteShareRow = "";

        chunk.forEach(p => {
            const pColor = p.color || "#a0aec0";
            const leaderName = p.leaderName || "（不在）";
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

            // ⑤ 【修正】今回獲得議席 (総議席ではなく、今回勝った議席を入れる！)
            const won = p.wonSeats !== undefined ? p.wonSeats : p.totalSeats;
            seatsWonRow += `<td style="padding:5px 4px; text-align:center; font-weight:bold; font-size:14px; color:#000;">${won}</td>`;

            // ⑥ 議席増減（全体の勢力の増減）
            let diffStr = `<span style="color:#54595d;">-</span>`;
            if (p.diff > 0) {
                diffStr = `<span style="color:#008500; font-weight:bold;">▲</span> ${p.diff}`;
            } else if (p.diff < 0) {
                diffStr = `<span style="color:#d33; font-weight:bold;">▼</span> ${Math.abs(p.diff)}`;
            } else if (p.diff === 0) {
                diffStr = `<span style="color:#54595d;">-</span>`;
            }
            seatChangeRow += `<td style="padding:5px 4px; text-align:center;">${diffStr}</td>`;

            // ⑦ 選挙前議席（前回の保存データがあればそれ、なければ総議席とdiffから正確に逆算）
            const before = p.seatsBefore !== undefined ? p.seatsBefore : (p.totalSeats - (p.diff || 0));
            seatsBeforeRow += `<td style="padding:5px 4px; text-align:center; color:#202122;">${before}</td>`;

            // 🌟【新規追加】改選後の総議席（非改選の貯金も含めた、新しい国会の全議席）
            // Wikipediaの上院選ボックスでも一番下にこれが太字で入ります
            totalSeatsRow += `<td style="padding:5px 4px; text-align:center; font-weight:bold; color:#202122; background:#f8f9fa;">${p.totalSeats} <span style="font-size:10px; font-weight:normal; color:#72774d;">(${p.hikaisenSeats || 0})</span></td>`;

            // ⑧ 得票数
            const votesFormatted = p.prVotes ? Math.floor(p.prVotes).toLocaleString() : "0";
            prVoteRow += `<td style="padding:5px 4px; text-align:center; color:#202122; font-size:11px;">${votesFormatted}</td>`;

            // ⑨ 得票率
            const shareFormatted = p.voteShare !== undefined ? `${p.voteShare}%` : "-";
            voteShareRow += `<td style="padding:5px 4px; text-align:center; color:#54595d; font-size:11px;">${shareFormatted}</td>`;
        });

        // 💡 3つ未満の塊のときは空のセルで埋める処理（新設した totalSeatsRow も忘れず追加）
        if (colSpanCount < 3) {
            const emptyCount = 3 - colSpanCount;
            for (let i = 0; i < emptyCount; i++) {
                const emptyCell = `<td style="width: 33.3%;"></td>`;
                photoRow += emptyCell;
                colorBarRow += `<td></td>`;
                leaderRow += emptyCell;
                partyRow += `<td></td>`;
                seatsWonRow += emptyCell;
                seatChangeRow += emptyCell;
                seatsBeforeRow += emptyCell;
                totalSeatsRow += `<td></td>`; // 追加
                prVoteRow += emptyCell;
                voteShareRow += emptyCell;
            }
        }

        // 💡 2つ目以降の塊の前の区切り
        if (chunkIndex > 0) {
            infoboxContentHTML += `
            <tr>
                <td colspan="3" style="height: 15px; background: #FFFFFF; border-top: 2px solid #FFFFFF; border-bottom: 2px solid #a2a9b1;"></td>
            </tr>`;
        }

        // HTML文字列への流し込み（順番をWikipediaの標準的な美しさに再編成！）
        infoboxContentHTML += `
            <!-- 👤 顔写真行 -->
            <tr>${photoRow}</tr>
            <!-- 🟩 カラーバー -->
            <tr>${colorBarRow}</tr>
            <tr>${partyRow}</tr>

            <!-- 👤 党首名 -->
            <tr>${leaderRow}</tr>
            
            <!-- 📊 各種データ -->
            <tr><th colspan="3" style="background:#eaecf0; font-size:11px; padding:2px;">今回獲得議席</th></tr>
            <tr style="background: #fff;">${seatsWonRow}</tr>
            
            <tr><th colspan="3" style="background:#eaecf0; font-size:11px; padding:2px;">選挙前議席</th></tr>
            <tr style="background: #fff;">${seatsBeforeRow}</tr>

            <tr><th colspan="3" style="background:#eaecf0; font-size:11px; padding:2px;">議席増減</th></tr>
            <tr style="background: #fff;">${seatChangeRow}</tr>
            
            <tr><th colspan="3" style="background:#eaecf0; font-size:11px; padding:2px;">改選後総議席 (内:非改選)</th></tr>
            <tr style="background: #fff;">${totalSeatsRow}</tr>
            
            <tr><th colspan="3" style="background:#eaecf0; font-size:11px; padding:2px;">得票数</th></tr>
            <tr style="background: #fff;">${prVoteRow}</tr>
            
            <tr><th colspan="3" style="background:#eaecf0; font-size:11px; padding:2px;">得票率</th></tr>
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


function displaySenateResult(regionalCandidates, partySeatsWon, totalSeatsCalculated, totalPRSeats = 0, partyPRVotes = {}, hikaisenSeatsMap) {

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
                📍 選挙区
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
                🟩 ${prefName} 第${distNum}区（選挙区）
            </div>
            `;

            if (candidates.length === 0) {
                candidateRowsHTML += `<div style="color:#a0aec0; font-size:11px; text-align:center; padding:8px;">立候補者がいません</div>`;
                return;
            }

            candidates.forEach((cand, idx) => {
                const pColor = cand.partyId ? (parties[cand.partyId]?.color || "#4a5568") : "#718096";
                const pName = cand.partyId ? (parties[cand.partyId]?.name || "既成政党") : "無所属";

                // 💡 フラグを信頼して判定するパターン
                const isElected = cand.sen === true;
                let statusBadge = "";
                if (isElected) {
                    statusBadge = `<span style="background:#2f855a; color:#fff; font-size:10px; padding:2px 6px; border-radius:3px; font-weight:bold;">🟢 当選</span>`;
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

        // 💡 1. 総得票数の集計（%表示用）
        const grandTotalPRVotes = Object.values(partyPRVotes).reduce((a, b) => a + b, 0) || 1;

        // 💡 2. 【大修正】1位だけを数える古い2重ループは完全に削除（またはコメントアウト）！
        // すでにステップ4（開票）で複数当選を考慮した正しい議席が partySeatsWon に入っているので、それをそのままコピーするだけ！
        const localSeatsCount = {};
        allPartyIds.forEach(pId => {
            localSeatsCount[pId] = partySeatsWon[pId] || 0;
        });

        // 💡 3. 【修正】0.4倍する計算を廃止し、上院の総議席数をストレートに代入する
        // （※もし端数調整後のリアルな総議席数にしたい場合は、実際の当選者合計である `totalSeatsCalculated` を使ってもOKです）
        let numDistrictSeats = totalSenateSeats;


        // 💡 関数の定義元（一行目）の末尾に「hikaisenSeatsMap = {}」を必ず追加してください
        // function displaySenateResult(regionalCandidates, partySeatsWon, numDistrictSeats, numPRSeats, partyPRVotes, hikaisenSeatsMap = {}) {

        const partySummaryList = allPartyIds.map(pId => {
            const totalSeats = partySeatsWon[pId] || 0;

            // 🛡️ 引数で渡ってきたマップから、この政党の非改選議席数を引く（なければ0）
            const hikaisenSeats = hikaisenSeatsMap[pId] || 0;

            // 🗳️ 【引き算】総議席数から非改選を引いて、「今回獲得した議席」を割り出す
            const wonSeats = Math.max(0, totalSeats - hikaisenSeats);

            const votes = partyPRVotes[pId] || 0;
            const voteShare = (grandTotalPRVotes > 0) ? ((votes / grandTotalPRVotes) * 100).toFixed(1) : "0.0";

            return {
                id: pId,
                totalSeats: totalSeats,
                hikaisenSeats: hikaisenSeats, // 💡 リストにデータを追加
                wonSeats: wonSeats,           // 💡 リストにデータを追加
                votes: votes,
                voteShare: voteShare
            };
        }).sort((a, b) => b.totalSeats - a.totalSeats);

        const grandTotalSeatsCalculated = Number(numDistrictSeats);

        let rankingHTML = "";
        partySummaryList.forEach((res, index) => {
            let pName = "無所属";
            let pColor = "#718096";

            if (res.id !== "無所属") {
                pName = parties[res.id]?.name || "既成政党";
                pColor = parties[res.id]?.color || "#4a5568";
            }
            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "👤";

            // 🟢 【今回獲得】の数がプラスなら緑色のバッジ (+3) のように装飾する
            const wonBadge = res.wonSeats > 0
                ? `<span style="color:#48bb78; font-weight:bold;">(+${res.wonSeats})</span>`
                : `<span style="color:#718096;">(+0)</span>`;

            rankingHTML += `
        <div style="background:#1a202c; padding:10px 12px; border-radius:6px; margin-bottom:8px; border-left:5px solid ${pColor};">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-weight:bold; color:#fff; font-size:14px;">${medal} ${pName}</span>
                </div>
                <span style="font-size:16px; font-weight:bold; color:#ecc94b;">
                    ${res.totalSeats} <span style="font-size:11px; color:#a0aec0;">議席</span>
                </span>
            </div>
            
            <!-- 💡 比例代表の代わりに「非改選」と「今回獲得」の内訳を綺麗に横並び表示！ -->
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#a0aec0; background:#2d3748; padding:5px 8px; border-radius:4px;">
                <span>獲得議席: ${wonBadge}</span>
                <span>非改選議席: <b style="color:#fff;">${res.hikaisenSeats}</b></span>
                <span>得票数: <b style="color:#e2e8f0;">${Math.floor(res.votes).toLocaleString()}票 (${res.voteShare}%)</b></span>
            </div>
        </div>
        `;
        });


        const electionCountText = typeof gameSessionElectionCount !== "undefined" ? `第${gameSessionElectionCount}回` : "最新";

        const statsBodyHTML = `
        <div style="background:linear-gradient(135deg, #1a202c 0%, #2d3748 100%); padding:12px; border-radius:8px; border:2px solid #ecc94b; text-align:center; margin-bottom:12px;">
            <span style="font-size:10px; font-weight:bold; color:#ecc94b; letter-spacing:2px;">PARLIAMENTARY ELECTION FINAL RESULT</span>
            <h2 style="font-size:17px; font-weight:bold; margin:4px 0; color:#fff;">🏛️ ${electionCountText} 上院総選挙・最終議席確定</h2>
            <span style="font-size:11px; color:#a0aec0;">
                総議席数: <b>${grandTotalSeatsCalculated}</b> (選挙区:${numDistrictSeats})
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

