// 🗳️ 統一地方選挙（一括処理のイメージ）
const localElectionResults = {
    // 1. 県知事選（県全体で1枠・大選挙区/単記移譲等）
    governor: runGovernorElection(prefName),

    // 2. 県議選（県内の各市・区ごとに定数あり）
    prefecturalAssembly: runPrefAssemblyElection(prefName),

    // 3. 市長選（有権者の居住地 `voter.city` の首長を選ぶ）
    mayor: runMayorElection(voterCity),

    // 4. 市議選（有権者の居住地 `voter.city` の市議を選ぶ・中選挙区）
    cityCouncil: runCityCouncilElection(voterCity)
};

// 🗳️ 統一地方選挙（一括処理メインロジック）
// ====================================================
// 汎用・万能選挙エンジン（これ1つで全選挙を回す！）
// ====================================================
function runElection(config) {
    const { title, seats = 1, candidates, voters = [], votingMethod = "SIMULATED" } = config;

    // 票数をリセット
    candidates.forEach(c => c.currentVotes = 0);

    if (votingMethod === "VOTER_THINK" && voters.length > 0) {
        // --- 1. Voterの詳細思考ロジックで投票 ---
        voters.forEach(voter => {
            if (Math.random() > (voter.turnoutRate ?? 0.60)) return; // 棄権

            const voteResult = voter.thinkAndVote(candidates);
            let chosen = candidates.find(c => String(c.id) === String(voteResult?.candidateId));

            // 選べなかった場合のフォールバック
            if (!chosen) {
                chosen = candidates[Math.floor(Math.random() * candidates.length)];
            }

            const weight = (voter.votePower && voter.votePower > 0) ? voter.votePower : 1000;
            chosen.currentVotes += weight;
        });
    } else {
        // --- 2. 超軽量・ダミー乱数計算（モブ大量生成用） ---
        candidates.forEach(c => {
            const baseVotes = Math.floor(Math.random() * 10000) + 100;
            // 与党・最大野党なら爆増、それ以外なら撃沈する！
            c.currentVotes = Math.floor(baseVotes * (c.advantage || 1.0));
        });
    }

    // 集計とソート
    candidates.sort((a, b) => b.currentVotes - a.currentVotes);
    console.log(
        {
            title: title,
            winners: candidates.slice(0, seats),
            allCandidates: candidates
        }
    )
    return {
        title: title,
        winners: candidates.slice(0, seats),
        allCandidates: candidates
    };
}

function runUnifiedLocalElection(prefName, countryData) {
    const prefInfo = countryData.pref[prefName];
    const cities = prefInfo.cities || ["中心街"];

    const cityCouncilResults = {};
    const cityCouncilWinners = {};
    const prefAssemblyResults = {};
    const prefAssemblyWinners = [];
    const mayorResults = {};
    cities.forEach(cityName => {
        // 市議選実行
        const councilCandidates = generateMobCandidates(14, `${prefName}_${cityName}_council`, countryData);
        const councilElection = runElection({
            title: `${cityName}議会議員選挙`,
            seats: 30,
            candidates: councilCandidates,
            votingMethod: "SIMULATED"
        });
        cityCouncilResults[cityName] = councilElection;
        cityCouncilWinners[cityName] = councilElection.winners[0]; // トップ当選者

        // 県議選実行
        const prefAssemCandidates = generateMobCandidates(6, `${prefName}_${cityName}_pref`, countryData);
        const prefAssemElection = runElection({
            title: `${prefName}議会議員選挙（${cityName}選挙区）`,
            seats: 3,
            candidates: prefAssemCandidates,
            votingMethod: "SIMULATED"
        });
        prefAssemblyResults[cityName] = prefAssemElection;
        prefAssemblyWinners.push(...prefAssemElection.winners);
    });

    // ----------------------------------------------------
    // 3. 市長選（Voter本格思考）
    // ----------------------------------------------------
    cities.forEach(cityName => {
        const mayorCandidates = [];

        // 成り上がり候補のピックアップ
        if (cityCouncilWinners[cityName] && Math.random() < 0.7) {
            mayorCandidates.push({ ...cityCouncilWinners[cityName], isPromoted: true });
        }
        const localPrefMember = prefAssemblyWinners.find(w => w.city === cityName);
        if (localPrefMember && Math.random() < 0.4) {
            mayorCandidates.push({ ...localPrefMember, isPromoted: true });
        }

        // 🌟 目標候補者数を 2〜5 人の範囲でランダムに決定
        const targetCount = Math.floor(Math.random() * 4) + 2; // 2, 3, 4, 5 のいずれか

        // 足りない分をモブ候補で補填 (スプレッド構文 ... で配列を展開して追加!)
        if (mayorCandidates.length < targetCount) {
            const needed = targetCount - mayorCandidates.length;
            const mobs = generateMobCandidates(needed, `mayor_${cityName}`, countryData);
            mayorCandidates.push(...mobs); // ⭕️ 配列ではなく個別のオブジェクトとして平坦にpush
        }

        // 市のVoterを集めて共通エンジンで開票！
        const cityVoters = allVoters.filter(v => v.pref === prefName && v.city === cityName);

        mayorResults[cityName] = runElection({
            title: `${cityName}長選挙`,
            seats: 1,
            candidates: mayorCandidates,
            voters: cityVoters,
            votingMethod: "VOTER_THINK"
        });
    });

    // ----------------------------------------------------
    // 4. 県知事選（全県Voter本格思考 or 簡易）
    // ----------------------------------------------------
    const governorCandidates = [];
    const randomCity = getRandomElement(cities);
    if (mayorResults[randomCity] && mayorResults[randomCity].winners[0]) {
        governorCandidates.push({ ...mayorResults[randomCity].winners[0], isPromoted: true });
    }

    // 🌟 知事選も目標候補者数を 2〜5 人の範囲でランダム設定
    const targetGovCount = Math.floor(Math.random() * 4) + 2; // 2〜5人

    if (governorCandidates.length < targetGovCount) {
        const needed = targetGovCount - governorCandidates.length;
        const mobs = generateMobCandidates(needed, `gov_${prefName}`, countryData);
        governorCandidates.push(...mobs); // ⭕️ governorCandidates に正しい変数名でpush!
    }

    let govtype = prefName.includes("市") ? "長" : "知事";
    const prefVoters = allVoters.filter(v => v.pref === prefName);
    const governorResult = runElection({
        title: `${prefName}${govtype}選挙`,
        seats: 1,
        candidates: governorCandidates,
        voters: prefVoters,
        votingMethod: "VOTER_THINK"
    });
    // ----------------------------------------------------
    // リターン
    // ----------------------------------------------------
    return {
        prefecture: prefName,
        governor: governorResult,
        mayors: mayorResults,
        cityCouncils: cityCouncilResults,
        prefAssembly: prefAssemblyResults
    };
}
// ====================================================
// 1. 3軸思想から政党を決定する処理（与党・最大野党優遇）
// ====================================================
function determineParty(candidateIdeology, allParties) {
    // allParties は [{ id: "P1", ideology: [50, 50, 50] }, ...] のような配列を想定
    let bestParty = null;
    let minDistance = Infinity;
    allParties = Array.isArray(allParties)
        ? allParties
        : (allParties ? Object.values(allParties) : []);

    allParties.forEach(party => {
        // 3軸の距離（差の絶対値の合計）を計算
        let dist =
            Math.abs(candidateIdeology.axis1 - party.ideology.axis1) +
            Math.abs(candidateIdeology.axis2 - party.ideology.axis2) +
            Math.abs(candidateIdeology.axis3 - party.ideology.axis3);

        const partyIdStr = String(party.id);

        // 与党・最大野党補正：思想距離を人工的に縮めて引き寄せる（超所属しやすくする）
        if (rulingparty.map(String).includes(partyIdStr)) {
            dist *= 0.3; // 与党は距離70%カット（吸い寄せ）
        } else if (partyIdStr === String(largest_opoosition)) {
            dist *= 0.4; // 最大野党は距離60%カット（吸い寄せ）
        } else if (opposition.map(String).includes(partyIdStr)) {
            dist *= 1.5; // その他の野党はちょっと選ばれにくい
        } else {
            dist *= 2.0; // 無所属・弱小は選ばれにくい
        }

        if (dist < minDistance) {
            minDistance = dist;
            bestParty = party;
        }
    });

    return bestParty ? bestParty.id : null;
}

// ====================================================
// 2. モブ候補者の生成関数（これでエラー解決！）
// ====================================================
function generateMobCandidates(count, prefix, countryData) {
    const candidates = [];

    // 全政党リストを取得（データ構造に合わせて調整してね）
    const allParties = parties || [];
    const countryKey = localStorage.getItem("poligame_data")
        ? JSON.parse(localStorage.getItem("poligame_data")).countrySelect || "jp"
        : "jp";

    const currentCountryData = country[countryKey];

    for (let i = 0; i < count; i++) {
        // --- 思想（3軸：0〜100）の設定 ---
        const ideology = [
            axis1 = Math.floor(Math.random() * 101), // 例：経済
            axis2 = Math.floor(Math.random() * 101), // 例：外交
            axis3 = Math.floor(Math.random() * 101)  // 例：社会
        ];

        // 思想に基づき所属政党を決定（与党・最大野党優先）
        const assignedPartyId = determineParty(ideology, allParties);

        // --- 選挙時の基礎得票バフ（優遇・不遇） ---
        let electionAdvantage = 1.0;
        const partyStr = String(assignedPartyId);

        if (rulingparty.map(String).includes(partyStr)) {
            // 与党：特大優遇 (1.8〜2.5倍)
            electionAdvantage = 1.8 + Math.random() * 0.7;
        } else if (partyStr === String(largest_opoosition)) {
            // 最大野党：大優遇 (1.4〜1.9倍)
            electionAdvantage = 1.4 + Math.random() * 0.5;
        } else {
            // それ以外（その他野党・無所属・弱小）：ゴミレベルの不遇 (0.1〜0.4倍)
            electionAdvantage = 0.1 + Math.random() * 0.3;
        }
        const randomFirst = getRandomElement(currentCountryData.firstnames);
        const randomLast = getRandomElement(currentCountryData.lastnames);
        let npcName = `${randomFirst} ${randomLast}`;
        // 候補者オブジェクトの作成
        candidates.push({
            id: generateSecretId(),
            name: npcName,
            partyId: assignedPartyId,
            ideology: ideology,
            advantage: electionAdvantage, // 得票計算時に掛ける倍率
            currentVotes: 0
        });
    }

    return candidates;
}
// ====================================================
// 統一地方選モーダルの表示処理（全国一括版）
// ====================================================
function showUnifiedLocalElectionModal(countryData) {
    if (!countryData || !countryData.pref) {
        console.error("countryData または pref データが存在しません。");
        return;
    }

    const prefNames = Object.keys(countryData.pref);

    // 1. 全都道府県の地方選を一括実行！
    // (runUnifiedLocalElection が単一都道府県向けの場合はループ処理)
    const allPrefResults = {};
    prefNames.forEach(prefName => {
        allPrefResults[prefName] = runUnifiedLocalElection(prefName, countryData);
    });

    // 2. モーダル内部のHTML構築
    let html = `
    <div style="background-color: #ffffff; color: #333333; padding: 15px; border-radius: 8px; font-family: sans-serif; max-height: 70vh; overflow-y: auto;">
        <h2 style="margin-top: 0; color: #1a2a3a; border-bottom: 2px solid #333; padding-bottom: 8px;">
            🏛️ 統一地方選挙 開票結果速報
        </h2>
        <p style="color: #666; font-size: 0.9em; margin-bottom: 15px;">
            対象都道府県: ${prefNames.length} 地域
        </p>
    `;

    // 都道府県ごとにセクションを生成（アコーディオン形式）
    prefNames.forEach((prefName, pIdx) => {
        const electionData = allPrefResults[prefName];
        if (!electionData) return;

        // 都道府県ごとの枠組み（最初の1つ目だけ自動で開く 'open' 設定）
        html += `
        <details ${pIdx === 0 ? 'open' : ''} style="background: #f8f9fa; border: 2px solid #2b5c8f; border-radius: 6px; padding: 10px; margin-bottom: 15px;">
            <summary style="font-weight: bold; font-size: 1.2em; cursor: pointer; color: #2b5c8f; padding: 4px 0;">
                🗾 ${prefName} 地方選挙結果
            </summary>

            <!-- ■ 知事選 / 首長選結果 -->
            <div style="background: #ffffff; border-left: 5px solid #2b5c8f; padding: 10px; margin: 10px 0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h4 style="margin: 0 0 8px 0; color: #2b5c8f;">👑 ${prefName}${prefName.includes("市") ? "長" : "知事"}選挙</h4>
                <table style="width: 100%; border-collapse: collapse; background: #ffffff; font-size: 0.95em;">
                    <thead>
                        <tr style="background: #e9ecef; border-bottom: 2px solid #dee2e6; text-align: left;">
                            <th style="padding: 6px;">当落</th>
                            <th style="padding: 6px;">候補者名</th>
                            <th style="padding: 6px;">所属政党</th>
                            <th style="padding: 6px; text-align: right;">得票数</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // 知事選候補者のテーブル生成
        if (electionData.governor && electionData.governor.allCandidates) {
            electionData.governor.allCandidates.forEach((c, idx) => {
                const isWinner = idx === 0;
                const partyName = (typeof parties !== "undefined" && parties[c.partyId]?.name) ? parties[c.partyId].name : "無所属";
                html += `
                    <tr style="border-bottom: 1px solid #eee; ${isWinner ? 'background-color: #e8f4f8; font-weight: bold;' : ''}">
                        <td style="padding: 6px;">${isWinner ? '<span style="color: #d9534f; font-weight: bold;">【当選】</span>' : '落選'}</td>
                        <td style="padding: 6px;">${c.name || "不明候補"} ${c.isPromoted ? '<small style="color: #666;">(元首長/議員)</small>' : ''}</td>
                        <td style="padding: 6px;">${partyName}</td>
                        <td style="padding: 6px; text-align: right;">${(c.currentVotes || 0).toLocaleString()} 票</td>
                    </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>

            <!-- ■ 市区町村ごとの結果 -->
            <h4 style="color: #1a2a3a; margin: 15px 0 8px 0;">🏙️ 各市区町村の選挙結果</h4>
        `;

        if (electionData.mayors) {
            Object.keys(electionData.mayors).forEach(cityName => {
                const mayorResult = electionData.mayors[cityName];
                const councilResult = electionData.cityCouncils ? electionData.cityCouncils[cityName] : null;

                // 定数が undefined になるのを防ぐ安全取得（fallback: 30名）
                const seatsCount = councilResult?.seats ?? councilResult?.allCandidates?.length ?? 30;

                html += `
                <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                    <strong style="font-size: 1.05em; color: #1a2a3a;">📍 ${cityName}</strong>
                    
                    <!-- 市長選 -->
                    <div style="margin-top: 8px;">
                        <strong style="color: #2b5c8f; font-size: 0.9em;">👔 市長選挙</strong>
                        <ul style="margin: 4px 0 8px 15px; padding: 0; font-size: 0.9em;">
                `;

                if (mayorResult && mayorResult.allCandidates) {
                    mayorResult.allCandidates.forEach((c, idx) => {
                        const isWinner = idx === 0;
                        const partyName = (typeof parties !== "undefined" && parties[c.partyId]?.name) ? parties[c.partyId].name : "無所属";
                        html += `
                            <li style="${isWinner ? 'font-weight: bold; color: #d9534f;' : 'color: #555;'}">
                                ${isWinner ? '【当選】' : '落選'} ${c.name} (${partyName}) - ${(c.currentVotes || 0).toLocaleString()}票
                            </li>
                        `;
                    });
                }

                // トップ当選者の安全取得
                const topWinner = councilResult?.winners?.[0];
                const topWinnerParty = (topWinner && typeof parties !== "undefined" && parties[topWinner.partyId]?.name)
                    ? parties[topWinner.partyId].name
                    : "無所属";

                html += `
                        </ul>
                    </div>

                    <!-- 市議選 -->
                    <div style="margin-top: 6px; font-size: 0.9em; background: #fdfdfd; padding: 6px; border-radius: 4px; border: 1px dashed #ccc;">
                        <strong style="color: #2b5c8f;">🏛️ 市議会議員選挙 (定数 ${seatsCount}名)</strong>
                        <div style="color: #444; margin-top: 2px;">
                            トップ当選: <strong>${topWinner?.name || "データなし"}</strong> (${topWinnerParty}) - ${(topWinner?.currentVotes || 0).toLocaleString()}票
                        </div>
                    </div>
                </div>
                `;
            });
        }

        html += `</details>`;
    });

    html += `</div>`; // 全体ラップ終了

    // 3. showModal() でモーダル表示
    showModal(`🏛️ 全国統一地方選挙 結果発表`, html, [
        {
            text: "⬅️ 一覧に戻る",
            className: "close-btn",
            keepOpen: true,
            callback: () => {
                if (typeof showPrefectureBlockMenu === "function") {
                    showPrefectureBlockMenu();
                }
            }
        },
        {
            text: "🗳️ 新しい議会を開会（確定）",
            className: "scout-btn",
            keepOpen: false,
            callback: () => {
                console.log("⚡ 全国の地方選挙データ閲覧が完了し、ターンが進行します。");
                if (typeof activeBlockTurnNotificationCount !== "undefined") {
                    activeBlockTurnNotificationCount = 0;
                }
            }
        }
    ]);
}