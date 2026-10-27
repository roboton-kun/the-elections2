function openDietMemberSearchModal(initialTab = 'rep') {
    // 💡 参議院（sen）がまだ準備されていない場合のフォールバックデータ確保
    const repMembers = [player, ...npcs].filter(n => n.rep === true);
    const senMembers = (typeof npcs !== 'undefined') ? [player, ...npcs].filter(n => n.sen === true) : [];

    // モーダルの全体HTML構築
    const modalHTML = `
    <!-- 🗂️ 衆議院 / 参議院 切り替えタブ -->
    <div style="display: flex; gap: 8px; margin-bottom: 12px; border-bottom: 2px solid #4a5568; padding-bottom: 8px;">
        <button id="tab-rep-btn" onclick="switchDietTab('rep')" style="
            flex: 1; padding: 8px; font-weight: bold; font-size: 13px; border: none; border-radius: 6px; cursor: pointer; transition: 0.2s;
            ${initialTab === 'rep' ? 'background: #3182ce; color: #fff;' : 'background: #2d3748; color: #a0aec0;'}
        ">
            🏛️ 下院議員 (${repMembers.length}名)
        </button>
        ${senate_enable ? `
        <button id="tab-sen-btn" onclick="switchDietTab('sen')" style="
            flex: 1; padding: 8px; font-weight: bold; font-size: 13px; border: none; border-radius: 6px; cursor: pointer; transition: 0.2s;
            ${initialTab === 'sen' ? 'background: #3182ce; color: #fff;' : 'background: #2d3748; color: #a0aec0;'}
        ">
            🏛️ 上院議員 (${senMembers.length}名)
        </button>` : ""}
    </div>

    <!-- グラフを表示させたい場所に設置 -->
    <div id="diet-chart-container"></div>



    <!-- 🔍 検索 ＆ 絞り込みフィルターバー -->
<div style="display: flex; gap: 8px; margin-bottom: 12px;">
    <input type="text" id="dietSearchInput" oninput="filterDietMembers()" placeholder="議員名・選挙区・政党名で検索..." style="
        flex: 2; padding: 8px 12px; background: #1a202c; border: 1px solid #4a5568; border-radius: 6px; color: #fff; font-size: 12px;
    " />
    <select id="dietPartyFilter" onchange="filterDietMembers()" style="
        flex: 1; padding: 8px; background: #1a202c; border: 1px solid #4a5568; border-radius: 6px; color: #fff; font-size: 12px;
    ">
        <option value="ALL">全政党</option>
        ${(() => {
            // 1. 現職議員（衆議院 rep または 参議院 sen が true）の所属する partyId をすべて集める
            const activePartyIds = new Set();

            // repMembers（衆議院）と senMembers（参議院）の両方から集める場合
            if (typeof repMembers !== 'undefined') {
                repMembers.forEach(m => { if (m.partyId) activePartyIds.add(String(m.partyId).trim().toLowerCase()); });
            }
            if (typeof senMembers !== 'undefined') {
                senMembers.forEach(m => { if (m.partyId) activePartyIds.add(String(m.partyId).trim().toLowerCase()); });
            }

            // 2. 全政党リストから、現職がいる政党だけに絞り込んでoptionを生成
            const partyList = Array.isArray(parties) ? parties : Object.values(parties || {});

            return partyList
                .filter(p => p && p.id && activePartyIds.has(String(p.id).trim().toLowerCase()))
                .map(p => `<option value="${p.id}">${p.name}</option>`)
                .join('');
        })()}
    </select>
</div>


    <!-- 📜 議員リスト表示エリア -->
    <div id="dietMemberList" style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
        <!-- Javascriptでここにカードが動的挿入される -->
    </div>

    `;

    // モーダル表示（既存の showModal を利用）
    showModal("🏛️ 国会議員データベース", modalHTML, [
        { text: "閉じる", className: "close-btn", keepOpen: false }
    ]);

    // 初期タブのデータ描画
    window.currentDietTab = initialTab;
    renderDietMemberList();
    document.getElementById('diet-chart-container').innerHTML = generateDietChartHtml(window.currentDietTab);
}

/**
 * 議席勢力図のHTML（SVGアーチと凡例）を動的に生成する関数
 * @param {string} currentTab - 現在アクティブなタブ ('rep' または 'sen')
 * @returns {string} 生成されたHTML文字列
 */
function generateDietChartHtml(currentTab) {
    const repMembers = [player, ...npcs].filter(n => n.rep === true);
    const senMembers = (typeof npcs !== 'undefined') ? [player, ...npcs].filter(n => n.sen === true) : [];

    // 選択されたタブに応じたメンバーデータを取得
    const activeMembers = currentTab === 'rep' ? repMembers : senMembers;
    const total = activeMembers.length || 1;

    // ① 各政党の議席数をカウント (IDの表記ブレ対策で小文字化)
    const counts = {};
    activeMembers.forEach(m => {
        if (!m.partyId) return;
        const cleanId = String(m.partyId).trim().toLowerCase();
        counts[cleanId] = (counts[cleanId] || 0) + 1;
    });

    // ② partiesを確実に配列化
    const partyList = Array.isArray(parties) ? parties : Object.values(parties || {});

    // 💡 与党・野党の判定用にIDリストをクリーンアップ
    const cleanRuling = (typeof rulingparty !== "undefined" && Array.isArray(rulingparty)) ? rulingparty.map(id => String(id).trim().toLowerCase()) : [];
    const cleanLargestOpp = (typeof largest_opoosition !== "undefined" && largest_opoosition) ? String(largest_opoosition).trim().toLowerCase() : null;
    const cleanOpp = (typeof opposition !== "undefined" && Array.isArray(opposition)) ? opposition.map(id => String(id).trim().toLowerCase()) : [];

    // ③ 与野党の政治的序列ルールでソート（共通の並び順）
    const sortedParties = [...partyList]
        .filter(p => p && p.id && (counts[String(p.id).trim().toLowerCase()] || 0) > 0)
        .sort((a, b) => {
            const idA = String(a.id).trim().toLowerCase();
            const idB = String(b.id).trim().toLowerCase();

            const getPriorityScore = (id) => {
                if (cleanRuling.includes(id)) return 1;       // 1. 与党
                if (id === cleanLargestOpp) return 2;         // 2. 野党第一党
                if (cleanOpp.includes(id)) return 3;          // 3. その他野党
                return 4;                                     // 4. 無所属・その他
            };

            const scoreA = getPriorityScore(idA);
            const scoreB = getPriorityScore(idB);

            if (scoreA !== scoreB) {
                return scoreA - scoreB;
            } else {
                return (counts[idB] || 0) - (counts[idA] || 0); // 議席数が多い順
            }
        });

    // ----------------------------------------------------
    // 📊 1. SVGアーチ（パス）の生成
    // ----------------------------------------------------
    const totalLength = 125.66; // 半円の外周
    let accumulatedLength = 0;
    let svgPathsHtml = '';

    sortedParties.forEach(p => {
        const cleanPartyId = String(p.id).trim().toLowerCase();
        const seats = counts[cleanPartyId] || 0;
        const partLength = (seats / total) * totalLength;

        let colorStr = p.color || '#718096';
        if (!colorStr.includes('rgb') && !colorStr.includes('#') && !colorStr.includes('hsl')) {
            colorStr = `rgb(${colorStr})`;
        }

        // 💡 左端から与党をスタートさせるための逆算補正（dashOffset）
        const dashOffset = totalLength - accumulatedLength - partLength;

        svgPathsHtml += `
            <path d="M 10 50 A 40 40 0 0 1 90 50" 
                  fill="none" 
                  stroke="${colorStr}" 
                  stroke-width="12" 
                  stroke-dasharray="${totalLength}"
                  style="stroke-dasharray: 0 ${dashOffset} ${partLength} ${totalLength}; transition: stroke-dasharray 0.3s;" />
        `;

        accumulatedLength += partLength;
    });

    // 議席データが空の場合のプレースホルダー
    if (sortedParties.length === 0) {
        svgPathsHtml = `<path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#4a5568" stroke-width="12" />`;
    }

    // ----------------------------------------------------
    // 🏷️ 2. 凡例ラベルの生成
    // ----------------------------------------------------
    const legendsHtml = sortedParties.map(p => {
        const cleanId = String(p.id).trim().toLowerCase();
        let colorStr = p.color || '#718096';
        if (!colorStr.includes('rgb') && !colorStr.includes('#') && !colorStr.includes('hsl')) {
            colorStr = `rgb(${colorStr})`;
        }

        return `
            <div style="display: flex; align-items: center; gap: 4px; background: #2d3748; padding: 2px 6px; border-radius: 4px; color: #fff;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${colorStr};"></span>
                <span>${p.name}: <strong>${counts[cleanId]}</strong></span>
            </div>
        `;
    }).join('');

    // ----------------------------------------------------
    // 🗳️ 3. 全体のコンポーネントHTMLを出力
    // ----------------------------------------------------
    return `
        <div style="background: #1a202c; border: 1px solid #4a5568; border-radius: 8px; padding: 12px; margin-bottom: 12px; text-align: center;">
            <div style="font-size: 11px; color: #a0aec0; font-weight: bold; margin-bottom: 8px; letter-spacing: 0.05em;">📊 議席勢力図 (SEATS DISTRIBUTION)</div>

            <div style="position: relative; width: 200px; height: 100px; margin: 0 auto 12px;">
                <svg viewBox="0 0 100 50" style="width: 100%; height: 100%; overflow: visible;">
                    ${svgPathsHtml}
                </svg>
                
                <!-- アーチ中央の総議席数数値 -->
                <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); font-size: 18px; font-weight: bold; color: #fff; line-height: 1;">
                    ${total}<span style="font-size: 10px; color: #a0aec0; margin-left: 2px;">議席</span>
                </div>
            </div>

            <!-- 🏷️ 各政党の動的凡例ラベルリスト -->
            <div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; font-size: 11px;">
                ${legendsHtml}
            </div>
        </div>
    `;
}


// 🔄 タブ切り替え処理
function switchDietTab(tabType) {
    window.currentDietTab = tabType;

    // タブのボタン見た目更新
    const repBtn = document.getElementById("tab-rep-btn");
    const senBtn = document.getElementById("tab-sen-btn");

    if (tabType === 'rep') {
        repBtn.style.background = "#3182ce"; repBtn.style.color = "#fff";
        senBtn.style.background = "#2d3748"; senBtn.style.color = "#a0aec0";
    } else {
        senBtn.style.background = "#3182ce"; senBtn.style.color = "#fff";
        repBtn.style.background = "#2d3748"; repBtn.style.color = "#a0aec0";
    }

    renderDietMemberList();
    document.getElementById('diet-chart-container').innerHTML = generateDietChartHtml(window.currentDietTab);
}

// 🎨 議員リストの描画＆フィルター処理
function renderDietMemberList() {
    const listContainer = document.getElementById("dietMemberList");
    if (!listContainer) return;

    const keyword = (document.getElementById("dietSearchInput")?.value || "").toLowerCase();
    const selectedParty = document.getElementById("dietPartyFilter")?.value || "ALL";

    // タブに応じたフラグ判定（'rep' なら n.rep === true、'sen' なら n.sen === true）
    const targetFlag = window.currentDietTab;

    // 該当する議員をフィルタリング
    const filteredMembers = [player, ...npcs].filter(n => {
        const isCurrentHouse = (targetFlag === 'rep') ? (n.rep === true) : (n.sen === true);
        if (!isCurrentHouse) return false;

        // 政党フィルター
        if (selectedParty !== "ALL" && n.partyId !== selectedParty) return false;

        // キーワード検索（名前、都道府県、政党名）
        const partyName = parties[n.partyId]?.name || "";
        const matchName = (n.name || "").toLowerCase().includes(keyword);
        const matchPref = (n.pref || n.districtPref || "").toLowerCase().includes(keyword);
        const matchParty = partyName.toLowerCase().includes(keyword);

        return matchName || matchPref || matchParty;
    });

    if (filteredMembers.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:30px; color:#a0aec0; font-size:12px;">
                該当する議員が見つかりませんでした。
            </div>`;
        return;
    }

    // 議員カード一覧の構築
    let cardsHTML = "";
    filteredMembers.forEach(n => {
        const party = parties[n.partyId] || { name: "無所属", color: "#a0aec0" };
        const icon = n.icon || "https://via.placeholder.com/48";
        let locationText = n.districtPref
            ? `${n.districtPref}第${n.districtNum || 1}区`
            : (`${n.pref}選出` || "比例代表");
        if (n.isPRWinner) {
            locationText = `${n.pref}（比例代表）`;
        }

        cardsHTML += `
        <div style="
            display: flex; align-items: center; justify-content: space-between;
            background: #1a202c; border: 1px solid #2d3748; border-left: 4px solid ${party.color};
            padding: 8px 12px; border-radius: 6px;
        ">
            <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${icon}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 1px solid #4a5568;" />
                <div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 13px; font-weight: bold; color: #fff;">${n.name}</span>
                        <span style="font-size: 10px; padding: 1px 6px; border-radius: 4px; background: ${party.color}22; color: ${party.color}; border: 1px solid ${party.color}66; font-weight: bold;">
                            ${party.name}
                        </span>
                    </div>
                    <div style="font-size: 11px; color: #a0aec0; margin-top: 2px;">
                        📍 ${locationText} ｜ ⚡ XP: ${n.xp || 0}
                    </div>
                </div>
            </div>
            
            <div style="text-align: right;">
                <button onclick="npccardview('${n.id}')" style="
                    background: #2d3748; color: #e2e8f0; border: 1px solid #4a5568;
                    padding: 4px 10px; font-size: 11px; border-radius: 4px; cursor: pointer;
                ">
                    詳細を見る
                </button>
            </div>
        </div>
        `;
    });

    listContainer.innerHTML = cardsHTML;
}

// ⌨️ 入力検知用のラップ関数
function filterDietMembers() {
    renderDietMemberList();
}