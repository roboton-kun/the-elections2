const POLITICAL_ACTIONS = {
    bribe: {
        text: "💰 資金援助",
        cost: 100000,
        execute: (actor, target) => {
            if (actor.money < 999999) {
                return;
            }
            actor.money -= 100000;
            target.money += 100000;
            // 賄賂なので友好度が大きくアップ
            changeRelation(actor.id, target.id, 25);
            return `💸 ${actor.name}は${target.name}に10万円の資金を提供しました！`;
        }
    },
    meeting: {
        text: "🤝 会談",
        cost: 0,
        execute: (actor, target) => {
            // 思想が近いほど成功しやすい
            const diff = Math.abs(actor.ideology[0] - target.ideology[0]) +
                Math.abs(actor.ideology[1] - target.ideology[1]) +
                Math.abs(actor.ideology[2] - target.ideology[2]);

            if (diff < 60 || Math.random() < 0.3) {
                changeRelation(actor.id, target.id, 10);
                return `🤝 会談成功:${actor.name}と${target.name}は会談した。`;
            } else {
                changeRelation(actor.id, target.id, -15);
                return `❌ 会談決裂:${actor.name}は会談を申し込んだが、${target.name}に「話が合わない」と一蹴された。`;
            }
        }
    },
    funding: {
        text: "🤝 共に資金集めをする",
        cost: 0,
        execute: (actor, target) => {
            // 思想が近いほど成功しやすい（3つのパラメータの差の合計）
            const diff = Math.abs(actor.ideology[0] - target.ideology[0]) +
                Math.abs(actor.ideology[1] - target.ideology[1]) +
                Math.abs(actor.ideology[2] - target.ideology[2]);

            // 🤝 同じ政党に所属しているかどうかの判定（かつ、お互い無所属（null）ではないこと）
            const isSameParty = (actor.partyId === target.partyId) && actor.partyId !== null;

            // 🎲 成功条件の判定（党によってハードルを大きく変える）
            let isSuccess = false;

            if (isSameParty) {
                // 【同じ党の場合】ハードルは低い（思想差60未満、または30%の確率でラッキー成功）
                if (diff < 60 || Math.random() < 0.3) {
                    isSuccess = true;
                }
            } else {
                // 【他党・無所属の場合】超シビア！思想がガッツリ一致（差が30未満）かつ、ラッキー成功も10%に低下
                if (diff < 30 || Math.random() < 0.1) {
                    isSuccess = true;
                }
            }

            // 💰 成功時の処理
            if (isSuccess) {
                // 協力してそれぞれ5万〜15万円をゲット
                const earnedMoney = Math.floor(Math.random() * 100000) + 50000;
                actor.money += earnedMoney;
                target.money += earnedMoney;

                // 人間関係アップ
                changeRelation(actor.id, target.id, 10);

                // 同じ党か他党かで、ちょっとだけテキストのニュアンスを変える
                const contextText = isSameParty ? "党の結束を固めつつ" : "党派を超えて手を取り合い";
                return `🤝 資金集め成功: ${actor.name}と${target.name}は${contextText}共同で政治資金パーティーを開き、それぞれ ${earnedMoney.toLocaleString()}円 の寄付を集めた！`;
            } else {
                // ❌ 失敗時の処理（関係悪化）
                changeRelation(actor.id, target.id, -15);

                const rejectReason = isSameParty
                    ? `「党内で忙しい」`
                    : `「${actor.name}とは無理だ」`;

                return `❌ 資金集め失敗: ${actor.name}は共同での資金集めを持ちかけたが、${target.name}に${rejectReason}と断られた。`;
            }
        }
    },

    dinner: {
        text: "🍺 高級料亭で会食",
        cost: 30000,
        execute: (actor, target) => {
            actor.money -= 30000;
            // お酒の席なのでランダムに大きく関係が動く
            const amount = Math.random() < 0.8 ? 15 : -10; // 2割の確率で失言して大揉め
            changeRelation(actor.id, target.id, amount);

            if (amount > 0) {
                return `🍶 会食大成功: ${actor.name} と ${target.name} は赤料亭で語り合い、大親友になった！`;
            } else {
                return `🚨 会食大失敗: ${actor.name} が失言！ ${target.name} の逆鱗に触れてしまった……。`;
            }
        }
    },
    askpresident_run: {
        text: "🤝 大統領選挙への出馬を頼む",
        cost: 0,
        mode: "pr",
        execute: (actor, target) => {
            // 年齢・憲法制限チェック（35歳以下は出馬不可能）
            const age = Number(target.age) || 45;
            if (age <= 35) {
                return `❌ 説得失敗: ${target.name}は「まだ35歳以下なので大統領の被選挙権がない」と断った。`;
            }

            // 💡 党内に強力な現職大統領(74歳以下)が君臨しているかチェック
            // ※ eligibleMembers がスコープ外の場合は、partyMembers等から同様に算出してください
            const isPresLoopingInParty = typeof partyMembers !== 'undefined' && partyMembers.some(m => {
                const isPres = typeof president !== 'undefined' && president && president.id === m.id;
                const presAge = Number(m.age) || 45;
                return isPres && presAge < 75 && m.partyId === target.partyId;
            });

            // 強力な現職がいる場合、一般党員は絶対に首を縦に振らない（現職無風化）
            const isTargetPresident = (typeof president !== 'undefined' && president && president.id === target.id);
            if (isPresLoopingInParty && !isTargetPresident) {
                return `❌ 説得失敗: ${target.name}は「我が党には現職の${president.name}大統領がいる。今逆らうのは政治的自殺だ」と怯えて断った。`;
            }

            // 思想の近さ（3つのパラメータの差の合計）
            const diff = Math.abs(actor.ideology[0] - target.ideology[0]) +
                Math.abs(actor.ideology[1] - target.ideology[1]) +
                Math.abs(actor.ideology[2] - target.ideology[2]);

            // 🤝 同じ政党に所属しているか（かつ無所属ではない）
            const isSameParty = (actor.partyId === target.partyId) && actor.partyId !== null;

            // 🎲 成功条件の判定
            let isSuccess = false;
            // 元コードの同期/非同期の揺れを考慮し、await もしくは通常の呼び出しに対応
            const relData = typeof getRelation === 'function' ? getRelation(actor.id, target.id) : 0;
            const andrelation = typeof relData === 'object' && relData !== null ? (relData.value || 0) : (relData || 0);

            // 関係性が良いほど、思想差(diff)を縮める
            const effectiveDiff = Math.max(0, diff - andrelation);

            if (isSameParty) {
                // 同じ党なら、実質思想差が100未満、または30%の確率で成功
                if (effectiveDiff < 100 || Math.random() < 0.3) {
                    isSuccess = true;
                }
            } else {
                // 他党（引き抜き・鞍替え打診など）はハードル高め
                if (effectiveDiff < 50 || Math.random() < 0.1) {
                    isSuccess = true;
                }
            }

            // ⚡️ 成功時の処理（出馬を決意させる）
            if (isSuccess) {
                // ターゲットの出馬ステータスを更新（前哨戦の候補者リストに乗る状態にする）
                target.isIntentDeclared = true;

                // 説得の報酬としてお互いの関係性を大きくアップ
                if (typeof changeRelation === 'function') {
                    changeRelation(actor.id, target.id, 30);
                }

                return `🤝 説得成功: ${actor.name}の説得により、${target.name}は選挙への出馬を決意した！`;
            } else if (target.iswithdrawn === true) {
                return `❌ 失敗: ${target.name}は選挙から撤退済み。`;

            }
            else {
                // ❌ 失敗時の処理（関係悪化）
                if (typeof changeRelation === 'function') {
                    changeRelation(actor.id, target.id, -10);
                }

                const rejectReason = isSameParty
                    ? `「今はまだその時ではない」`
                    : `「リスクが高すぎる」`;

                return `❌ 説得失敗: ${actor.name}は${target.name}に出馬を促したが、${rejectReason}と拒否された。`;
            }
        }
    }


};

// 霊園データ（graveObject）を受け取って悲観的かつ感動的なモーダルを表示する関数
function showGraveModal(grave) {
    const title = `🪦 ${grave.name}の墓`;

    // 📜 過去の来歴（history）をリスト化
    const sortedHistory = grave.history && grave.history.length > 0
        ? [...grave.history].sort((a, b) => {
            // 文字列の先頭から「数字（西暦）」を抜き出す
            const yearA = parseInt(a.match(/^\d+/)) || 0;
            const yearB = parseInt(b.match(/^\d+/)) || 0;
            return yearA - yearB; // 若い順（昇順）に並び替え
        })
        : [];

    // ── 📄 HTMLの組み立て ──
    const historyHtml = sortedHistory.length > 0
        ? sortedHistory.map(h => `<li style="margin-bottom: 4px; color: #0f0f0f;">${h}</li>`).join('')
        : '<li style="color: #0e0d0d;">特筆すべき来歴なし</li>';
    // 💡 画像表示用のHTMLを生成（画像があれば <img>、無ければ 👤）
    const avatarHtml = grave.avatar
        ? `<img src="${grave.avatar}" alt="${grave.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #ccc; margin-bottom: 8px;">`
        : `<div style="font-size: 48px; margin-bottom: 8px;">👤</div>`;
    const birthYear = grave.deathYear - grave.finalAge;
    const ideo = getIdeologyName(grave.ideology);
    // 💡 モーダルの中身（HTML）
    const bodyContent = `
        <div style="text-align: center; padding: 10px; font-family: sans-serif;">
        ${avatarHtml}
        <h2 style="margin: 5px 0; font-size: 1.4rem;">${grave.name}</h2>
            <p style="color: #666; font-size: 0.9rem; margin-bottom: 15px;">
                <strong>${birthYear}</strong>年生まれ。<br />
                享年 <strong>${grave.finalAge}</strong> 歳 （${grave.deathYear}年 逝去）
            </p>

            <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; text-align: left; font-size: 0.85rem; margin-bottom: 15px;">
                <p style="margin: 4px 0;">🏛️ <strong>所属政党:</strong> ${grave.lastPartyName}</p>
                <p style="margin: 4px 0;">☠️ <strong>死因:</strong> <strong>${grave.causeOfDeath || "老衰"}</strong></p>
                <p style="margin: 4px 0;">📍 <strong>埋葬地:</strong> ${grave.gravesite}</p>
                <p style="margin: 4px 0;">📊 <strong>政治思想:</strong> ${ideo}</p>
                
            </div>

            <div style="text-align: left; max-height: 150px; overflow-y: auto; background: #fff; border: 1px solid #eee; padding: 10px; border-radius: 6px;">
                <strong style="font-size: 0.85rem; color: #333; display: block; margin-bottom: 6px;">📜 生涯:</strong>
                <ul style="padding-left: 18px; margin: 0; font-size: 0.8rem;">
                    ${historyHtml}
                </ul>
            </div>
        </div>
    `;

    // 🔘 ボタン（安らかに眠れ / 閉じる）
    const buttons = [
        {
            text: "閉じる",
            onClick: () => {
                closeModal();
            }
        }
    ];

    // ヘッダー画像（もし霊園や重厚な画像URLがあれば設定、なければnull）
    const headerImgUrl = "https://thumbs.dreamstime.com/b/sad-woman-cemetery-holding-bouquet-roses-her-hand-sad-woman-cemetery-101036056.jpg";

    // ご提示いただいた showModal 関数を呼び出し！
    showModal(title, bodyContent, buttons, headerImgUrl);
}

// 🪦 霊園（墓地）一覧・検索モーダルを表示する関数
function showGraveyardViewer() {
    if (typeof graveyard === 'undefined' || graveyard.length === 0) {
        showModal("🪦 墓地", "<p style='text-align:center; padding:20px; color:#666;'>まだこの霊園に眠っている人物はいません。</p>", [{ text: "閉じる", class: "btn-secondary" }]);
        return;
    }

    // ① エリア（州・地域）のリストを抽出
    const states = ["すべて", ...new Set(graveyard.map(g => {
        // gravesiteから「州名（最初のスペースまたは『・』まで）」を抽出
        const match = g.gravesite ? g.gravesite.match(/^([^・\s]+)/) : null;
        return match ? match[1] : "その他";
    }))];

    // ② モーダルの内部HTML（検索バー + エリアタブ + リスト表示域）
    const bodyContent = `
        <div style="font-family: sans-serif; padding: 5px;">
            <!-- 🔍 リアルタイム検索バー -->
            <div style="margin-bottom: 12px;">
                <input type="text" id="graveSearchInput" placeholder="名前、政党、埋葬地で検索..." 
                       style="width: 100%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box;"
                       oninput="filterGraveyard()">
            </div>

            <!-- 📍 エリア切り替えタブ -->
            <div id="graveAreaTabs" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 1px solid #eee;">
                ${states.map((st, i) => `
                    <button class="grave-tab-btn ${i === 0 ? 'active' : ''}" 
                            data-state="${st}"
                            onclick="switchGraveArea('${st}', this)"
                            style="padding: 4px 10px; font-size: 0.8rem; border: 1px solid #ccc; background: ${i === 0 ? '#333' : '#fff'}; color: ${i === 0 ? '#fff' : '#333'}; border-radius: 12px; white-space: nowrap; cursor: pointer;">
                        ${st}
                    </button>
                `).join('')}
            </div>

            <!-- 📜 墓地・政治家リスト表示エリア -->
            <div id="graveyardList" style="max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
                <!-- JavaScriptで動的描画 -->
            </div>
        </div>
    `;

    // モーダルを表示
    showModal("🪦 墓地", bodyContent, [{ text: "閉じる", class: "btn-secondary" }]);

    // 初期化：グローバルイベント設定＆初回描画
    window.currentGraveStateFilter = "すべて";
    renderGraveyardList();
}

// 🔄 リストの描画処理
function renderGraveyardList() {
    const listContainer = document.getElementById("graveyardList");
    const keyword = (document.getElementById("graveSearchInput")?.value || "").toLowerCase();
    const stateFilter = window.currentGraveStateFilter || "すべて";

    if (!listContainer) return;

    // フィルタリング処理
    const filtered = graveyard.filter(g => {
        // エリア一致判定
        const matchesArea = stateFilter === "すべて" || (g.gravesite && g.gravesite.startsWith(stateFilter));

        // 検索キーワード一致判定（名前、最終所属党、埋葬地）
        const matchesKey = !keyword ||
            (g.name && g.name.toLowerCase().includes(keyword)) ||
            (g.lastPartyName && g.lastPartyName.toLowerCase().includes(keyword)) ||
            (g.gravesite && g.gravesite.toLowerCase().includes(keyword));

        return matchesArea && matchesKey;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `<p style="text-align:center; color:#888; padding:20px; font-size:0.85rem;">該当する故人は見つかりませんでした。</p>`;
        return;
    }

    // 💡 mapの内部処理として組み込んで展開！
    listContainer.innerHTML = filtered.map(g => {
        // 1人ごとにアバターHTMLを生成する
        const avatarHtml = g.avatar
            ? `<img src="${g.avatar}" alt="${g.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`
            : `<span style="font-size: 1.8rem;">👤</span>`;

        return `
            <div style="background: #fdfdfd; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: background 0.2s;"
                 onclick="showGraveModalById('${g.id}')"
                 onmouseover="this.style.background='#f1f5f9'" 
                 onmouseout="this.style.background='#fdfdfd'">
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${avatarHtml}
                    <div>
                        <div style="font-weight: bold; font-size: 0.95rem; color: #1e293b;">
                            ${g.name} <span style="font-size: 0.75rem; color: #64748b; font-weight: normal;">(享年${g.finalAge}歳)</span>
                        </div>
                        <div style="font-size: 0.78rem; color: #475569; margin-top: 2px;">
                            🏛️ ${g.lastPartyName || '無所属'} ｜ 📍 ${g.gravesite}
                        </div>
                    </div>
                </div>
                <div style="font-size: 0.75rem; color: #94a3b8; text-align: right;">
                    詳細 ➔
                </div>
            </div>
        `;
    }).join('');
}

// 📍 エリアタブ切り替え関数
function switchGraveArea(state, btn) {
    window.currentGraveStateFilter = state;

    // タブのスタイル更新
    document.querySelectorAll('.grave-tab-btn').forEach(b => {
        b.style.background = '#fff';
        b.style.color = '#333';
    });
    btn.style.background = '#333';
    btn.style.color = '#fff';

    renderGraveyardList();
}

// 🔍 検索入力用
function filterGraveyard() {
    renderGraveyardList();
}

// 💡 リスト内のカードクリックで個別の訃報/詳細モーダルを開く補助関数
function showGraveModalById(id) {
    const grave = graveyard.find(g => g.id === id);
    if (grave && typeof showGraveModal === 'function') {
        showGraveModal(grave);
    }
}

// 🌟 4つ目の引数として headerImgUrl を受け取れるように拡張！
function showModal(title, bodyContent, buttons = [], headerImgUrl = null) {
    const modal = document.getElementById("genericModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalBody = document.getElementById("modalBody");
    const modalActions = document.getElementById("modalActions");

    // 🌟 【新規】画像を表示するためのコンテナを探す（なければ作る）
    let modalHeaderImg = document.getElementById("modalHeaderImg");
    if (!modalHeaderImg) {
        modalHeaderImg = document.createElement("div");
        modalHeaderImg.id = "modalHeaderImg";
        // タイトルの手前に画像を差し込む
        modalTitle.parentNode.insertBefore(modalHeaderImg, modalTitle);
    }

    // 🌟 画像URLが指定されている場合は、横長のおしゃれなバナーを表示
    if (headerImgUrl) {
        modalHeaderImg.innerHTML = `
            <img src="${headerImgUrl}" style="
                width: 100%;
                max-height: 140px;
                object-fit: cover;
                border-radius: 5px 5px 0 0;
                margin-bottom: 12px;
                box-shadow: inset 0 -10px 20px rgba(0,0,0,0.5); /* 上品な影 */
            " onerror="this.style.display='none';"> <!-- 万が一URLが壊れてたら自動で非表示 -->
        `;
        modalHeaderImg.style.display = "block";
    } else {
        // 画像がない場合は完全に非表示（既存のレイアウトを崩さない）
        modalHeaderImg.innerHTML = "";
        modalHeaderImg.style.display = "none";
    }

    modalTitle.textContent = title;

    if (typeof bodyContent === "string") {
        modalBody.innerHTML = bodyContent;
    } else {
        modalBody.innerHTML = "";
        modalBody.appendChild(bodyContent);
    }

    modalActions.innerHTML = "";
    buttons.forEach(btnConfig => {
        const btn = document.createElement("button");
        btn.textContent = btnConfig.text;
        btn.className = btnConfig.className || "";

        // --- 🎨 【全面リニューアル】ゲームUI風のボタン美化スタイル ---
        btn.style.margin = "6px";
        btn.style.padding = "10px 18px";
        btn.style.fontSize = "13px";
        btn.style.fontWeight = "bold";
        btn.style.border = "none";
        btn.style.borderRadius = "5px";
        btn.style.cursor = "pointer";
        btn.style.transition = "all 0.2s ease";
        btn.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.3)";
        btn.style.letterSpacing = "0.5px";

        // クラス名に応じたカラーテーマの割り当て
        if (btnConfig.className === "scout-btn") {
            btn.style.backgroundColor = "#2f855a";
            btn.style.color = "#fff";
            btn.onmouseover = () => { btn.style.backgroundColor = "#276749"; btn.style.transform = "translateY(-1px)"; };
            btn.onmouseout = () => { btn.style.backgroundColor = "#2f855a"; btn.style.transform = "none"; };
        } else if (btnConfig.className === "bribe-btn") {
            btn.style.backgroundColor = "#b7791f";
            btn.style.color = "#ffffff";
            btn.onmouseover = () => { btn.style.backgroundColor = "#975a16"; btn.style.transform = "translateY(-1px)"; };
            btn.onmouseout = () => { btn.style.backgroundColor = "#b7791f"; btn.style.transform = "none"; };
        } else if (btnConfig.className === "close-btn") {
            btn.style.backgroundColor = "#4a5568";
            btn.style.color = "#edf2f7";
            btn.onmouseover = () => { btn.style.backgroundColor = "#2d3748"; btn.style.transform = "translateY(-1px)"; };
            btn.onmouseout = () => { btn.style.backgroundColor = "#4a5568"; btn.style.transform = "none"; };
        } else {
            btn.style.backgroundColor = "#cbd5e0";
            btn.style.color = "#2d3748";
        }

        btn.addEventListener("click", () => {
            if (btnConfig.callback) btnConfig.callback();
            if (!btnConfig.keepOpen) {
                closeModal();
            }
        });
        modalActions.appendChild(btn);
    });

    modal.style.display = "flex";
}


function closeModal() {
    document.getElementById("genericModal").style.display = "none";
}

function getRandomElement(array) {
    if (!array || array.length === 0) return "不明";
    return array[Math.floor(Math.random() * array.length)];
}

function addhis(npc, text, customyear = gameDate.getFullYear()) {
    let year = customyear
    // 🌟「月」や「ターン数」も入れると、いつ起きたかハッキリする！
    let month = gameDate.getMonth() + 1; // JSの月は0始まりなので+1
    let day = gameDate.getDate();

    // 例：「2026年7月18日: 新党大地に入党」
    npc.history.push(`${year}年${month}月${day}日: ${text}`);
}
function generateSecretId() {
    // 現在のミリ秒単位の時間（例: 1719873600123）
    const timestamp = Date.now().toString(36);

    // ブラウザのガチ暗号機能（高精度ランダム）を使って、ランダムな英数字の塊を作る
    // crypto.randomUUID() は 128ビットの超強力なランダム文字列を返します
    const secureRandom = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    // タイムスタンプと暗号ランダムを合体（例: "lx2z8abc-a1b2c3d4e5f6g7h8"）
    return `${timestamp}-${secureRandom}`;
}
/**
 * 地域のpop（人口比率）をベースに、1県あたり10〜100人のNPCを大量生成する
 */function generateNPCCandidates() {
    // 1. ループ外で1回だけlocalStorageをパース（高速化）
    let countryKey = "jp";
    try {
        const rawData = localStorage.getItem("poligame_data");
        if (rawData) {
            countryKey = JSON.parse(rawData).countrySelect || "jp";
        }
    } catch (e) {
        console.error(e);
    }

    const currentCountryData = country[countryKey];
    if (!currentCountryData || !currentCountryData.pref) {
        console.error("❌ 国家データまたは都道府県データが見つかりません。");
        return;
    }

    const prefNames = Object.keys(currentCountryData.pref);
    console.log("🔥 全国の選挙区からライバル候補者が大量出馬中...");

    // ─── カスタムNPCを全国へ均等に分散させるための前処理 ───
    if (!window.customNpcPool) {
        window.customNpcPool = (dt && dt.npcs) ? [...dt.npcs] : [];
    }

    const totalCustomNpcs = window.customNpcPool.length;
    const customNpcsPerPref = totalCustomNpcs > 0 ? Math.ceil(totalCustomNpcs / prefNames.length) : 0;

    // ─── 【高速化】全有権者を [都道府県・市区町村] で一発逆引きできるマップを作成 ───
    const votersMap = new Map();
    if (Array.isArray(allVoters)) {
        for (let i = 0; i < allVoters.length; i++) {
            const voter = allVoters[i];
            // 💡 文字列結合のオーバーヘッドを減らすためテンプレートリテラルを使用
            const key = `${voter.pref}_${voter.city}`;
            if (!votersMap.has(key)) {
                votersMap.set(key, []);
            }
            votersMap.get(key).push(voter);
        }
    }

    const iconList = [
        "big-ears", "big-ears-neutral", "big-smile", "bottts", "bottts-neutral", "croodles",
        "croodles-neutral", "dylan", "fun-emoji", "lorelei", "lorelei-neutral", "micah", "miniavs",
        "notionists", "notionists-neutral", "open-peeps", "personas", "pixel-art", "pixel-art-neutral", "toon-head"
    ];

    // ⚠️ npcs はオブジェクトではなく配列（Array）であることを前提とします
    if (!Array.isArray(npcs)) {
        npcs = [];
    }

    prefNames.forEach((prefName) => {
        const prefecture = currentCountryData.pref[prefName];
        const pop = prefecture.pop;

        // 人口に応じたNPC数の計算
        const minNpc = Math.max(2, Math.floor(pop * 0.7));
        const maxNpc = Math.max(100, Math.floor(pop * 1.2));
        const npcCountInPref = getRandomRange(minNpc, maxNpc);

        console.log(`🗺️ 【${prefName}】(人口比率: ${pop}%) -> ${npcCountInPref}人のライバルが立候補！`);

        let customAssignedCount = 0;

        // 🌟 ライバル生成ループ
        for (let i = 0; i < npcCountInPref; i++) {
            const secretNpcId = generateSecretId();

            // 活動拠点の都市をランダム決定
            const randomCityIndex = getRandomRange(0, prefecture.cities.length - 1);
            const npcHomeCity = prefecture.cities[randomCityIndex];

            // 資金とボーナスの格差ロジック
            let initialFunds = 0;
            let localAffinityBonus = 0;
            if (pop >= 5) {
                initialFunds = getRandomRange(3000000, 5000000);
                localAffinityBonus = 20;
            } else if (pop >= 3) {
                initialFunds = getRandomRange(1500000, 3000000);
                localAffinityBonus = 40;
            } else {
                initialFunds = getRandomRange(500000, 1500000);
                localAffinityBonus = 70;
            }

            let npcName = "";
            let baseEcon = 50;
            let baseNation = 50;
            let baseDiplomacy = 50;
            let finalIcon = "";
            let finalPartyId = null;

            // プールからカスタムNPCを割り振る判定
            if (window.customNpcPool && window.customNpcPool.length > 0 && customAssignedCount < customNpcsPerPref) {
                const cData = window.customNpcPool.shift();
                customAssignedCount++;

                npcName = cData.name || "不明な政治家";
                baseEcon = parseInt(cData.econ ?? 50);
                baseNation = parseInt(cData.nation ?? 50);
                baseDiplomacy = parseInt(cData.diplo ?? 50);
                finalIcon = cData.avatar || "";
                finalPartyId = (cData.partyId && cData.partyId !== "none") ? cData.partyId : null;

                if (cData.funds && !isNaN(Number(cData.funds))) {
                    initialFunds = Number(cData.funds);
                } else if (cData.money && !isNaN(Number(cData.money))) {
                    initialFunds = Number(cData.money);
                }
            } else {
                // 完全モブ生成
                const randomFirst = getRandomElement(currentCountryData.firstnames);
                const randomLast = getRandomElement(currentCountryData.lastnames);
                npcName = `${randomFirst} ${randomLast}`;

                baseEcon = pop > 60 ? getRandomRange(50, 90) : getRandomRange(10, 50);
                baseNation = pop > 60 ? getRandomRange(10, 50) : getRandomRange(50, 90);
                baseDiplomacy = pop > 60 ? getRandomRange(10, 50) : getRandomRange(50, 90);

                const kettei_ic = getRandomElement(iconList);
                finalIcon = `https://api.dicebear.com/10.x/${kettei_ic}/svg?seed=${secretNpcId}`; //
            }

            // オブジェクト組み立て
            const npcCandidate = {
                // 💡 タイポ（\$の抜け、文字列閉じ忘れ）を修正
                icon: finalIcon || `https://dicebear.com{secretNpcId}`, //
                id: secretNpcId,
                name: npcName,
                history: [],
                partyId: finalPartyId,
                pref: prefName,
                city: npcHomeCity,
                money: initialFunds,
                xp: 0,
                ideology: [baseEcon, baseNation, baseDiplomacy],
                isNPC: true
            };

            // 配列へ格納（一貫性を持たせるためpushに統一）
            npcs.push(npcCandidate);

            // Mapから該当する地域の有権者だけを一瞬でピンポイント取得（爆速）
            const targetVoters = votersMap.get(`${prefName}_${npcHomeCity}`);
            if (targetVoters) {
                const tvLen = targetVoters.length;
                for (let v = 0; v < tvLen; v++) {
                    targetVoters[v].bonusScore[secretNpcId] = localAffinityBonus;
                }
            }
        }
    });

    if (typeof zenjitutan === 'function') zenjitutan();
}


function zenjitutan() {
    assignMissingNpcAges(npcs);
    assignPartyToNpcs();

    // ==========================================
    // 📜 【前日譚】初期議員 ＆ 大統領の自動選出
    // ==========================================
    // ==========================================
    // 1. 先に「現職大統領」を全NPCから選出！
    // ==========================================
    const activeParties = (typeof parties !== 'undefined')
        ? Object.values(parties).filter(p => p.id !== "unaffiliated")
        : [];

    if (activeParties.length > 0) {
        activeParties.sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));
        const rulingParty = activeParties[0];

        if (rulingParty.leaderId) {
            const leaderNpc = npcs.find(n => n.id === rulingParty.leaderId);
            if (leaderNpc) president = leaderNpc;
        }
    }

    // 党首がいない場合は、全NPCの中で最もXPが高い「重鎮/有名人」から選出
    if (!president) {
        const topNpcs = [...npcs].sort((a, b) => (b.xp || 0) - (a.xp || 0));
        if (topNpcs.length > 0) {
            president = topNpcs[0];
        }
    }

    // 歴代大統領ログの初期化
    window.pastPresidents = [];

    if (president) {
        president.isPresident = true; // 大統領フラグ ON（これで議員選考から除外）
        president.rep = false;
        president.sen = false;
        president.xp = (president.xp || 0) + 1000;
        president.money = (president.money || 0) + 20000000;

        const choices = [4, 8];
        const actualTermsChoices = [1, 2];
        const randomIndex = Math.floor(Math.random() * choices.length);

        const servedYears = choices[randomIndex];       // 4年 または 8年
        const actualTerms = actualTermsChoices[randomIndex]; // 1期 または 2期

        president.termCount = actualTerms;
        const currentYear = gameDate ? gameDate.getFullYear() : 2016;
        const presidentialStartYear = currentYear + 1 - servedYears; // 大統領就任年

        // 🏛️ キャリアパターンの決定（確率の割り当て）
        // 例: 下院出身 40%, 上院出身 40%, 政治未経験 20%
        const careerRoll = Math.random();

        let repTerms = 0;
        let repYears = 0;
        let senTerms = 0;
        let senYears = 0;
        let isPoliticalNovice = false;

        if (careerRoll < 0.40) {
            // 【パターンA】下院議員（Representative）出身 (40%)
            repTerms = Math.floor(Math.random() * 4) + 2; // 2〜5期
            repYears = repTerms * 2; // 🇺🇸 アメリカ下院は「1期 = 2年」のため修正（※4年の設定のままでもOKです）
        } else if (careerRoll < 0.80) {
            // 【パターンB】上院議員（Senator）出身 (40%)
            senTerms = Math.floor(Math.random() * 2) + 1; // 1〜2期
            senYears = senTerms * 6; // 🇺🇸 アメリカ上院は「1期 = 6年」
        } else {
            // 【パターンC】政治未経験（タレント・実業家・軍人など） (20%)
            isPoliticalNovice = true;
        }

        const totalLegislativeYears = repYears + senYears;

        // 出身地（県/州）と適当な小選挙区を割り当て
        const presPref = president.pref || Object.keys(cityToDistrictMap)[0] || "首都圏";
        const presDistrict = Math.floor(Math.random() * 3) + 1; // 1〜3区あたり

        // 🇺🇸 補正1: 大統領の被選挙権チェック 
        // 下院初当選・政治活動の開始時の最低年齢を考慮（下院:25歳、上院:30歳、未経験:35歳）
        let minStartAge = 25;
        if (senTerms > 0) minStartAge = 30;
        if (isPoliticalNovice) minStartAge = 35; // アメリカ大統領の最低年齢

        const totalCareerYears = totalLegislativeYears + servedYears;
        const minPresidentAge = minStartAge + totalCareerYears;

        if (!president.age || president.age < minPresidentAge) {
            // 開始時の年齢が少し高めになるようランダム補正
            const firstElectionAge = Math.floor(Math.random() * 8) + minStartAge;
            president.age = firstElectionAge + totalCareerYears;
        }

        // 📜 当選・経歴履歴をログに追加（古い順）
        const careerStartYear = presidentialStartYear - totalLegislativeYears;

        if (repTerms > 0) {
            // 下院の履歴生成
            for (let t = 1; t <= repTerms; t++) {
                const electionYear = careerStartYear + ((t - 1) * 2);
                if (t === 1) {
                    addhis(president, `${presPref}第${presDistrict}区から初当選（下院議員選挙）`, electionYear);
                } else {
                    addhis(president, `${presPref}第${presDistrict}区から再選（${t}期目・下院議員選挙）`, electionYear);
                }
            }
        } else if (senTerms > 0) {
            // 上院の履歴生成
            for (let t = 1; t <= senTerms; t++) {
                const electionYear = careerStartYear + ((t - 1) * 6);
                if (t === 1) {
                    addhis(president, `${presPref}選出の上院議員として初当選`, electionYear);
                } else {
                    addhis(president, `${presPref}選出の上院議員として再選（${t}期目）`, electionYear);
                }
            }
        }


        // 📜 2. 大統領就任ログを追加！
        addhis(president, `第1代大統領に就任`, presidentialStartYear);
        const pNNAME = getPartyName(president.partyId);
        window.pastPresidents.push({
            term: 1,
            id: president.id,
            name: `${president.name}<br /><span style="font-size:11px; color:#718096; font-weight:normal;">(${president.termCount}期目)</span>`,
            icon: president.icon || 'https://via.placeholder.com/32',
            partyId: pNNAME || "無所属",
            startYear: presidentialStartYear,
            endYear: "現職"
        });

        console.log(`👑 【前日譚】第1代大統領に ${president.name} (${president.age}歳) が就任！（下院議員${repTerms}期を経て ${presidentialStartYear}年に就任）`);
    }

    // ==========================================
    // 2. 同じ政党から「副大統領」を自動選出！
    // ==========================================
    if (president) {
        // 大統領と同じ政党に所属し、かつ大統領本人ではないNPCをフィルタリング
        // ※大統領が無所属(未定義やunaffiliated)の場合は、無所属のNPCから探します
        const vpCandidates = npcs.filter(n => n.id !== president.id && n.partyId === president.partyId);

        if (vpCandidates.length > 0) {
            // 候補者の中で最もXPが高い「重鎮」を副大統領に選出
            vpCandidates.sort((a, b) => (b.xp || 0) - (a.xp || 0));
            vicepresident = vpCandidates[0];
        } else {
            // 同一政党に候補者が1人もいない場合のセーフティ：全NPC(大統領除く)からXP順で選出
            const fallbackCandidates = npcs.filter(n => n.id !== president.id);
            fallbackCandidates.sort((a, b) => (b.xp || 0) - (a.xp || 0));
            if (fallbackCandidates.length > 0) {
                vicepresident = fallbackCandidates[0];
                // 必要に応じて、ここで大統領と同じpartyIdを強制付与しても良いです
                vicepresident.partyId = president.partyId;
            }
        }

        // 副大統領が決定した場合のステータス・経歴処理
        if (vicepresident) {
            vicepresident.isVicePresident = true; // 副大統領フラグ ON（議員選考から除外用）
            vicepresident.rep = false;
            vicepresident.sen = false;
            vicepresident.xp = (vicepresident.xp || 0) + 500;       // 大統領より控えめなボーナス
            vicepresident.money = (vicepresident.money || 0) + 10000000;

            // 大統領と同じ就任年・任期情報を同期
            vicepresident.termCount = president.termCount;
            const currentYear = gameDate ? gameDate.getFullYear() : 2016;
            const presidentialStartYear = currentYear + 1 - (president.termCount === 2 ? 8 : 4);

            // 🏛️ 副大統領のキャリアパターンの決定
            const vpCareerRoll = Math.random();
            let vpRepTerms = 0;
            let vpRepYears = 0;
            let vpSenTerms = 0;
            let vpSenYears = 0;
            let isVpPoliticalNovice = false;

            if (vpCareerRoll < 0.40) {
                vpRepTerms = Math.floor(Math.random() * 4) + 2; // 2〜5期
                vpRepYears = vpRepTerms * 2;
            } else if (vpCareerRoll < 0.80) {
                vpSenTerms = Math.floor(Math.random() * 2) + 1; // 1〜2期
                vpSenYears = vpSenTerms * 6;
            } else {
                isVpPoliticalNovice = true;
            }

            const totalVpLegislativeYears = vpRepYears + vpSenYears;

            // 年齢チェックとランダム補正（アメリカ副大統領の最低年齢は35歳）
            let minVpStartAge = 25;
            if (vpSenTerms > 0) minVpStartAge = 30;
            if (isVpPoliticalNovice) minVpStartAge = 35;

            const servedYears = president.termCount === 2 ? 8 : 4;
            const totalVpCareerYears = totalVpLegislativeYears + servedYears;
            const minVicePresidentAge = minVpStartAge + totalVpCareerYears;

            if (!vicepresident.age || vicepresident.age < minVicePresidentAge) {
                const firstElectionAge = Math.floor(Math.random() * 8) + minVpStartAge;
                vicepresident.age = firstElectionAge + totalVpCareerYears;
            }

            // 📜 過去の議員履歴をログに追加
            const vpCareerStartYear = presidentialStartYear - totalVpLegislativeYears;
            const vpPref = vicepresident.pref || Object.keys(cityToDistrictMap)[0] || "首都圏";
            const vpDistrict = Math.floor(Math.random() * 3) + 1;

            if (vpRepTerms > 0) {
                for (let t = 1; t <= vpRepTerms; t++) {
                    const electionYear = vpCareerStartYear + ((t - 1) * 2);
                    if (t === 1) {
                        addhis(vicepresident, `${vpPref}第${vpDistrict}区から初当選（下院議員選挙）`, electionYear);
                    } else {
                        addhis(vicepresident, `${vpPref}第${vpDistrict}区から再選（${t}期目・下院議員選挙）`, electionYear);
                    }
                }
            } else if (vpSenTerms > 0) {
                for (let t = 1; t <= vpSenTerms; t++) {
                    const electionYear = vpCareerStartYear + ((t - 1) * 6);
                    if (t === 1) {
                        addhis(vicepresident, `${vpPref}選出の上院議員として初当選`, electionYear);
                    } else {
                        addhis(vicepresident, `${vpPref}選出の上院議員として再選（${t}期目）`, electionYear);
                    }
                }
            }

            // 📜 副大統領就任ログを追加
            addhis(vicepresident, `第1代副大統領に就任`, presidentialStartYear);
            changeRelation(vicepresident.id, president.id, 100);
            president.vp = vicepresident.id;
            vicepresident.president = president.id;
            const ka = pastPresidents[pastPresidents.length - 1];
            ka.vicepresident = vicepresident.name;

            console.log(`🥈 【前日譚】第1代副大統領に ${vicepresident.name} (${vicepresident.age}歳) が就任！（政党ID: ${vicepresident.partyId}）`);
        }
    }


    // ==========================================
    // 2. 残りの未選出NPC（!n.rep && !n.isPresident）から下院議員を選出！
    // ==========================================
    for (const prefName in cityToDistrictMap) {
        const districtSet = new Set(Object.values(cityToDistrictMap[prefName]));

        districtSet.forEach(districtNum => {
            // 🔥 まだ議員でも大統領でもない同県のNPCを検索！
            let localCandidates = npcs.filter(n => n.pref === prefName && !n.rep && !n.isPresident);

            // 万が一その県の候補が尽きたら、全候補から選出
            if (localCandidates.length === 0) {
                localCandidates = npcs.filter(n => !n.rep && !n.isPresident);
            }

            if (localCandidates.length > 0) {
                const eligibleCandidates = localCandidates.filter(c => {
                    // 最低でも30歳以上、かつそのNPCの現在の年齢（c.age）が上院議員として矛盾しない年齢であること
                    return c.age && c.age >= 25;
                });
                if (eligibleCandidates.length === 0) return;

                eligibleCandidates.sort((a, b) => ((b.xp || 0) + Math.random() * 60) - ((a.xp || 0) + Math.random() * 60));
                const winner = eligibleCandidates[0];

                winner.rep = true;
                winner.isSeat = true;
                winner.districtPref = prefName;
                winner.districtNum = districtNum;

                // 💡【根本修正】NPCの「現在の年齢」から、最大で何期当選できるかを計算する！
                // 例: 30歳なら (30 - 25) / 4 = 最大1期。 60歳なら (60 - 25) / 4 = 最大8期。
                const npcAge = winner.age || 25; // 年齢がなければ30歳と仮定
                const maxPossibleTerms = Math.max(1, Math.floor((npcAge - 25) / 4) + 1);

                // 政治家ランク（ベテラン度）の抽選
                const rand = Math.random();
                let terms = 1;
                let xpBonus = 100;
                let moneyBonus = 5000000;

                if (rand < 0.10) {
                    // 重鎮（最大期数、または8〜12期の低い方）
                    terms = Math.min(maxPossibleTerms, Math.floor(Math.random() * 5) + 8);
                    xpBonus = Math.floor(Math.random() * 300) + 500;
                    moneyBonus = Math.floor(Math.random() * 30000000) + 20000000;
                } else if (rand < 0.35) {
                    // 中堅（最大期数、または3〜6期の低い方）
                    terms = Math.min(maxPossibleTerms, Math.floor(Math.random() * 4) + 3);
                    xpBonus = Math.floor(Math.random() * 200) + 250;
                    moneyBonus = Math.floor(Math.random() * 10000000) + 10000000;
                } else {
                    // 新人（1〜2期）
                    terms = Math.min(maxPossibleTerms, Math.floor(Math.random() * 2) + 1);
                    xpBonus = Math.floor(Math.random() * 100) + 100;
                    moneyBonus = 5000000;
                }

                winner.termCount = terms;
                winner.xp = (winner.xp || 0) + xpBonus;
                winner.money = (winner.money || 0) + moneyBonus;

                // 📜 過去の当選履歴ログ（2016年スタート前提）
                const currentYear = gameDate ? gameDate.getFullYear() : 2016;


                // 初当選の年を逆算（2016 - 議員歴）
                const firstElectionYear = currentYear - (terms * 4);

                for (let t = 1; t <= terms; t++) {
                    const electionYear = firstElectionYear + ((t - 1) * 4);
                    if (t === 1) {
                        addhis(winner, `${prefName}第${districtNum}区から初当選（下院選挙）`, electionYear);
                    } else {
                        addhis(winner, `${prefName}第${districtNum}区から当選（${t}期目・下院選挙）`, electionYear);
                    }
                }
            }
        });
    }
    // ==========================================
    // 3. 上院議員（Senate）の選出＆来歴生成！
    // ==========================================
    // 州ごとに定義された定数（seats）に基づいて、まだ選出されていないNPCから選出
    for (const prefName in SenateMap) {
        // 各州の都市リストの最初の要素などから、州全体の定数（seats）を取得
        const sampleCity = Object.keys(SenateMap[prefName])[0];
        if (!sampleCity) {
            console.log("戻りました（上院）")
            continue;
        };
        const totalSeatsInPref = SenateMap[prefName][sampleCity].seats || 1;

        // 州の定数分の議席を1つずつ埋めていく
        for (let seatIndex = 0; seatIndex < totalSeatsInPref; seatIndex++) {

            // 🔥 まだ下院議員（rep）でも上院議員（senator）でも大統領でもない同県のNPCを検索！
            let localCandidates = npcs.filter(n => n.pref === prefName && !n.rep && !n.sen && n.id !== president.id);

            // 万が一その県の候補が尽きたら、全候補から選出
            if (localCandidates.length === 0) {
                localCandidates = npcs.filter(n => !n.rep && !n.sen && n.id !== president.id);
            }

            if (localCandidates.length > 0) {
                // XPにランダムな揺らぎを持たせてソート
                const eligibleCandidates = localCandidates.filter(c => {
                    // 最低でも30歳以上、かつそのNPCの現在の年齢（c.age）が上院議員として矛盾しない年齢であること
                    return c.age && c.age >= 30;
                });
                if (eligibleCandidates.length === 0) return;

                eligibleCandidates.sort((a, b) => ((b.xp || 0) + Math.random() * 60) - ((a.xp || 0) + Math.random() * 60));
                const winner = eligibleCandidates[0];

                // 上院議員フラグと選挙区情報を付与
                winner.sen = true; // 上院議員フラグ
                winner.districtPref = prefName;
                winner.districtName = `${prefName}選挙区`;

                // 🗳️ 改選グループの設定 (npcsに予め割り振られている group="gusu" / "kisu" を活用)
                // もし設定されていなければ、ここで自動的に半々に割り振る
                if (!winner.group) {
                    winner.group = (seatIndex % 2 === 0) ? "gusu" : "kisu";
                }

                // ---（政治家ランクの抽選・XP/資金ボーナス）---
                // 上院は下院より任期が長く（1期6年）、重鎮が多いためボーナスを高めに設定
                const rand = Math.random();
                let terms = 1;
                let xpBonus = 150;
                let moneyBonus = 8000000;

                // 【修正】当選期数（terms）も、そのジジイの「現在の年齢（winner.age）」を超えない範囲に制限する！
                // 例：32歳の人がいきおいで「8期（48年在職）」に当選したら、初当選がマイナス16歳になってバグるため
                let maxPossibleTerms = Math.floor((winner.age - 30) / 6) + 1;
                if (maxPossibleTerms < 1) maxPossibleTerms = 1;

                if (rand < 0.15 && maxPossibleTerms >= 5) {
                    // 条件（年齢）を満たしていれば超重鎮化
                    terms = Math.floor(Math.random() * Math.min(4, maxPossibleTerms - 4)) + 5;
                    xpBonus = Math.floor(Math.random() * 400) + 700;
                    moneyBonus = Math.floor(Math.random() * 40000000) + 30000000;
                } else if ((rand < 0.45 || rand < 0.15) && maxPossibleTerms >= 2) {
                    // 中堅
                    terms = Math.floor(Math.random() * Math.min(3, maxPossibleTerms - 1)) + 2;
                    xpBonus = Math.floor(Math.random() * 300) + 350;
                    moneyBonus = Math.floor(Math.random() * 20000000) + 15000000;
                } else {
                    terms = 1; // 新人
                    xpBonus = Math.floor(Math.random() * 150) + 150;
                    moneyBonus = 8000000;
                }

                winner.termCount = terms;
                winner.xp = (winner.xp || 0) + xpBonus;
                winner.money = (winner.money || 0) + moneyBonus;


                // 🏛️ 上院の被選挙権（30歳）と「初当選時の年齢」の矛盾を完全回避！
                // 上院の任期は「1期 = 6年」なので、(期数 - 1) * 6年分 さかのぼる
                const yearsInSenate = (terms - 1) * 6;

                // 📜 過去の当選履歴ログ（2016年スタート前提）
                const currentYear = gameDate ? gameDate.getFullYear() : 2016;

                // 改選グループに応じて、直近の当選年を調整（上院は6年に1回選挙）
                // 2016年時点で「直近でいつ選挙があったか」をグループごとにずらす処理
                let baseOffset = 0;
                if (winner.group === "gusu") {
                    baseOffset = 0; // 例: 2016年が直近の改選年
                } else {
                    baseOffset = 2; // 例: 2014年が直近の改選年（2年ずらす）
                }

                // 初当選の年を逆算
                const lastElectionYear = currentYear - baseOffset;
                const firstElectionYear = lastElectionYear - yearsInSenate;

                for (let t = 1; t <= terms; t++) {
                    const electionYear = firstElectionYear + ((t - 1) * 6);
                    if (t === 1) {
                        addhis(winner, `${prefName}選挙区から第${seatIndex + 1}位で初当選（上院選挙）`, electionYear);
                    } else {
                        addhis(winner, `${prefName}選挙区から当選（${t}期目・上院選挙）`, electionYear);
                    }
                }
            }
        }
    }
}
const gameEventManager = {
    events: [],

    /**
     * 汎用イベント（タイマー）を追加する関数
     */
    addEvent(id, targetDate, callback) {
        this.events = this.events.filter(e => e.id !== id);
        this.events.push({ id, targetDate: new Date(targetDate), callback });
    },

    removeEvent(id) {
        this.events = this.events.filter(e => e.id !== id);
    },

    /**
     * 毎ターン呼び出して、期日が来たイベントを実行する
     */
    checkAndTrigger(currentDate) {
        const now = new Date(currentDate);

        // 期日が来たイベントを抽出
        const executableEvents = this.events.filter(e => now >= e.targetDate);
        // 残るイベント（未来のイベント）だけをフィルターして残す
        this.events = this.events.filter(e => now < e.targetDate);

        executableEvents.forEach(event => {
            try {
                // 💡 【バグ修正】ハードコーディングをやめ、登録された callback を正しく実行する！
                if (typeof event.callback === 'function') {
                    event.callback();
                } else {
                    // フォールバック（過去の互換性用）
                    if (event.id === "presidential_election") {
                        runAndDisplayPresidentialElection();
                        this.scheduleNextPresidentialElection(now); // 次の4年後へ
                    } else if (event.id === "parl_election") {
                        announceHouseOfRepresentativesElection();
                    } else if (event.id === "senate_election") {
                        announceSenateElection(typeof nextGroup !== 'undefined' ? nextGroup : null);
                    }
                }
            } catch (error) {
                console.error(`❌ イベント [${event.id}] 実行エラー:`, error);
            }
        });
    },

    /**
     * 👑 【新設】大統領選を「次のオリンピックイヤー（4年ごと）の11月3日」に予約する関数
     */
    scheduleNextPresidentialElection(currentDate) {
        const year = currentDate.getFullYear();
        let nextElectionYear = year;

        if (this.events.some(e => e.id === "presidential_election") || currentDate.getMonth() >= 10) {
            nextElectionYear = year + 4;
        }
        const electionyear = new Date(nextElectionYear, 0, 1);

        const targetDate = new Date(nextElectionYear, 10, 3);

        const primaryDate = new Date(targetDate.getTime());
        const candidateBaseDate = new Date(nextElectionYear, 0, 2); // 💡 初回の候補者選定日

        primaryDate.setDate(1);
        primaryDate.setMonth(primaryDate.getMonth() - 4);
        primaryDate.setDate(3);

        this.addEvent("election_year", electionyear, () => {
            createElectionStatusButton();
            Object.values([player, ...npcs]).forEach(n => {
                delete n.isOfficialNominee;
                delete n.isOfficialVPNominee;
                delete n.runningMateOf;
                delete n.isIntentDeclared;
                delete n.endorsedByParties;
                delete n.isPresidentialCandidate;
                delete n.iswithdrawn;
            });
        });

        this.addEvent("primary_election", primaryDate, () => {
            processPrimary();
            doCalculateApproval();
        });

        // ----------------------------------------------------
        // 💡 修正ポイント：再帰的に20日後を予約していく内部関数
        // ----------------------------------------------------
        const scheduleCandidateLoop = (executionDate, count) => {
            this.addEvent(`candidate_round_${count}`, executionDate, () => {
                // 撤退処理などを含むメインの処理を実行。引数に何回目の実行かを渡す
                getcandidate(count);

                // 💡 20日後の日付を計算
                const nextCandidateDate = new Date(executionDate.getTime());
                nextCandidateDate.setDate(nextCandidateDate.getDate() + 20);

                // 予備選挙（primaryDate）の「前」である場合のみ、次の20日後を予約する
                // ※これを入れないと無限に20日後をループ予約してしまうためストッパーが必要です
                if (nextCandidateDate < primaryDate) {
                    scheduleCandidateLoop(nextCandidateDate, count + 1);
                }
            });
        };

        // 初回（1回目、カウントは1からスタート）を予約
        scheduleCandidateLoop(candidateBaseDate, 1);
        // ----------------------------------------------------

        this.addEvent("presidential_election", targetDate, () => {
            runAndDisplayPresidentialElection();
            doCalculateApproval();
            removeElectionStatusButton();

            this.scheduleNextPresidentialElection(targetDate);
        });

        console.log(`📅 次の大統領選本選を予約しました: ${targetDate.toLocaleDateString()}`);
    },


    /**
     * 汎用：あと何日あるかを取得する（UI表示用）
     */
    getDaysLeft(id, currentDate) {
        const event = this.events.find(e => e.id === id);
        if (!event) return 0;

        const diffTime = new Date(event.targetDate) - new Date(currentDate);
        return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }
};


function scheduleNextParlElection(lastElectionDate = null) {
    // 💡 もし前回の選挙日が渡されていればそれを基準に。なければ今のgameDateを使う
    const baseDate = lastElectionDate ? new Date(lastElectionDate) : new Date(gameDate);
    const nextElectionDate = new Date(baseDate);

    if (mode === "pr") {
        nextElectionDate.setFullYear(nextElectionDate.getFullYear() + 2);
    } else {
        nextElectionDate.setFullYear(nextElectionDate.getFullYear() + 4);
    }

    // 💡 日付が中途半端にズレないよう、1月1日の午前0時0分にカチッと固定する！
    nextElectionDate.setMonth(0);
    nextElectionDate.setDate(1);
    nextElectionDate.setHours(0, 0, 0, 0);

    gameEventManager.addEvent("parl_election", nextElectionDate, () => {
        announceHouseOfRepresentativesElection();

        // 💡 終わったら「今回の選挙予定日」を次の関数に引き継いで自動予約！
        scheduleNextParlElection(nextElectionDate);
    });
}


let nextGroup = "gusu";

function scheduleNextSenateElection(lastElectionDate = null, currentGroup = "gusu") {
    console.log("【スケジュール実行中】 今回セットするグループ: " + currentGroup);

    // 1. 基準日の計算（3年後の1月1日固定）
    const baseDate = lastElectionDate ? new Date(lastElectionDate) : new Date(gameDate);
    const nextElectionDate = new Date(baseDate);
    nextElectionDate.setFullYear(nextElectionDate.getFullYear() + 3);
    nextElectionDate.setMonth(0);
    nextElectionDate.setDate(1);
    nextElectionDate.setHours(0, 0, 0, 0);

    // 2. 引数で受け取った「今回のターゲット（例: gusu）」を安全に定数にロックする
    const targetGroupForThisTime = currentGroup;

    // 3. 外部確認用のグローバル変数には、あらかじめ「次のグループ」を見せておく
    nextGroup = targetGroupForThisTime === "gusu" ? "kisu" : "gusu";

    // 4. 3年後のイベントを登録
    gameEventManager.addEvent("senate_election", nextElectionDate, () => {

        // ⚡ 3年後：保存しておいたグループ（例: gusu）の選挙を正しく公示！
        announceSenateElection(targetGroupForThisTime);

        // 💡 3年後：今回の gusu が終わったので、次は反転させた「kisu」を計算してバトンを渡す！
        const followingGroup = targetGroupForThisTime === "gusu" ? "kisu" : "gusu";

        // 🔄 3年後：計算した「次のグループ」を引数に指定して、さらに3年後を自動予約！
        scheduleNextSenateElection(nextElectionDate, followingGroup);
    });
}


let presidentapproval = null;

function turnmove() {
    // 🚨 画面上に「ブロック対象の通知」がまだ残っているか直接DOMでチェック！
    // querySelectorAllより、要素の有無だけならquerySelectorの方が高速
    const hasBlockingNotice = document.querySelector(".block-notice") !== null;
    const previousYear = gameDate.getFullYear();
    if (hasBlockingNotice) {
        alert("⚠️ 未処理の重要なイベントがあります。通知をタップして対応してください！");
        return;
    }

    // 📅 日付を3日進める
    gameDate.setDate(gameDate.getDate() + 3);
    currentTurn++; // ターン加算を先に持ってくると計算がスマートになります

    const currentYear = gameDate.getFullYear();
    if (currentYear > previousYear) {
        assignMissingNpcAges(npcs, { debugLog: true });

        processNpcAging();
        detoxNpcPopulation();
        processYearlyPartyElections(currentYear); // 党首選チェックの実行
        updateOppositionYears(parties, largest_opoosition);
        if (player) player.chair_falling = false;

        // npcsオブジェクトの中身（各NPC）を取り出してループ処理する
        if (npcs && typeof npcs === 'object') {
            Object.values(npcs).forEach(n => {
                if (n) n.chair_falling = false;
            });
        }

        Object.values(parties).forEach(p => {
            p.mergedminiparty = false;
            p.dont_merge = false;
        });
    }

    // 初回ターンのみのその他アナウンス（これは最初のターンだけでOK）
    if (currentTurn === 2) {
        doCalculateApproval();
        announceHouseOfRepresentativesElection();
        announceSenateElection();
    }


    // 大統領就任カウントダウン
    if (typeof window.daysUntilInauguration !== 'undefined' && window.daysUntilInauguration > 0) {
        window.daysUntilInauguration -= 1;
        if (window.daysUntilInauguration === 0) {
            completePresidentialTransition();
            window.daysUntilInauguration = -1;
        }
    }

    // 💡【大幅軽量化】毎ターン全NPCをループしてフラグを書き換えるのを廃止！
    // 各NPCの行動チェック側で `if (npc.lastActedTurn === currentTurn)` と判定させてください。
    // npc.hasActedToday = false; の代わりに、行動した時に `npc.lastActedTurn = currentTurn;` と記録する。

    // 通知DOMの削除も高速化（要素がある時だけ回す）
    const normalNotices = document.querySelectorAll(".normal-notice");
    if (normalNotices.length > 0) {
        normalNotices.forEach(el => el.remove());
    }

    // 🔔 すべての汎用タイマー・イベントの期日チェック
    gameEventManager.checkAndTrigger(gameDate);

    // 🤖 NPCのデータ更新など
    updatestockmarket();
    // 💡【スパイク対策】10ターンに1回の激重処理を、ターンごとに分散して「カクつき」を防止！
    const turnMod = currentTurn % 10;
    if (mode === "pr") {
        updateElectionStatusText();

    };
    if (turnMod === 0) {
        processDividends();
        rare_death();
    }
    else if (turnMod === 2) {
        // 結婚処理を2の付くターンに分散
        processMarriageTurn(npcs, gameDate.getFullYear());
    }
    else if (turnMod === 5) {
        // 年齢補正を5の付くターンに分散
    }
    else if (turnMod === 8) {
        // 政党分裂チェックを8の付くターンに分散
        if (Math.random() < 0.01) {
            const npcArray = Array.isArray(npcs)
                ? [...npcs]
                : (npcs instanceof Map ? Array.from(npcs.values()) : Object.values(npcs || {}));

            if (typeof player !== "undefined" && player && !npcArray.some(n => n.id === player.id)) {
                npcArray.push(player);
            }
            triggerPartySplit(npcArray, parties, rulingparty, largest_opoosition);
        }
    }

    // 7ターンに1回の処理
    if (currentTurn % 7 === 0) {
        checkVacantPartyLeaders();
        mergeMinorParties(parties, house_kokujimae, npcs, largest_opoosition, rulingparty);
    }

    // 毎ターンのシミュレーション群
    dailyNpcPoliticalAims();
    dailyNpcUpdate();
    simulateNpcDailyLife();
    updateStatusUI();
    CheckIndependent();
    dailyPartyCreationCheck();

    todayaction = [];
}


if (typeof graveyard === 'undefined') {
    window.graveyard = [];
}
if (typeof presidentElect === 'undefined' || presidentElect === null) {
    window.presidentElect = president;
}
let removedCount = 0;

function processNpcAging() {
    if (typeof npcs === 'undefined' || !Array.isArray(npcs)) return;

    const isPartiesDefined = typeof parties !== 'undefined';
    const currentYear = typeof gameDate !== 'undefined' ? gameDate.getFullYear() : 'XXXX年';

    // 1. 生存NPCと死亡NPCを1回のループで振り分ける（spliceを排除）
    const survivingNpcs = [];
    const deadNpcIds = new Set();
    // 政党ごとに「このターンに死亡したメンバーのID」をまとめて管理
    const deadMembersByParty = {};

    const graveTypes = ["立墓地", "立霊園", "立名誉墓地", "内の墓地", "内の寺院墓地", "内の教会", "内の寺院", "内の大聖堂", "内の病院", "内の遺体安置所"];

    for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];

        // ① 加齢処理
        if (typeof npc.age === 'number' && !isNaN(npc.age)) {
            npc.age += 1;
        } else {
            npc.age = 18;
        }

        // ② 寿命チェック
        const maxAge = npc.maxAge || 80;

        if (npc.age > maxAge) {
            // 死亡処理
            deadNpcIds.add(npc.id);
            removedCount++;

            let lastPartyName = "無所属";
            if (npc.partyId && isPartiesDefined && parties[npc.partyId]) {
                const targetParty = parties[npc.partyId];
                lastPartyName = targetParty.name || "無所属";

                // 政党からの削除用に記録
                if (!deadMembersByParty[npc.partyId]) {
                    deadMembersByParty[npc.partyId] = new Set();
                }
                deadMembersByParty[npc.partyId].add(npc.id);

                // 党首不在チェック
                if (targetParty.leaderId === npc.id) {
                    targetParty.leaderId = null;
                }
            }

            // 埋葬地の生成
            const state = npc.pref || "首都";
            const city = npc.city || "中央";
            const randomGrave = graveTypes[Math.floor(Math.random() * graveTypes.length)];
            const hasCity = city && Math.random() < 0.5;
            const gravesite = hasCity ? `${state}・${city}${randomGrave}` : `${state}${randomGrave}`;

            // 🪦 墓オブジェクトの作成
            const graveObject = {
                id: npc.id || `grave_${Date.now()}_${i}`,
                name: npc.name || '政治家',
                avatar: npc.icon || "",
                finalAge: npc.age,
                deathYear: currentYear,
                lastPartyName: lastPartyName,
                ideology: npc.ideology || '不明',
                totalVotesEarned: npc.totalVotesEarned || 0,
                gravesite: gravesite,
                history: Array.isArray(npc.history) ? [...npc.history] : [],
                finalStats: {
                    xp: npc.xp || 0,
                    economy: npc.ideology ? (npc.ideology[0] || 0) : 0,
                    national: npc.ideology ? (npc.ideology[1] || 0) : 0,
                    foreign: npc.ideology ? (npc.ideology[2] || 0) : 0
                }
            };

            graveyard.push(graveObject);
            console.log(`🪦 [死去] ${npc.name || 'ID:' + npc.id}（${npc.age}歳 / 寿命:${maxAge}歳）が天寿を全うしました。`);
        } else {
            // 生存
            survivingNpcs.push(npc);
        }
    }

    // 元の配列の中身を高速に入れ替え
    npcs.length = 0;
    npcs.push(...survivingNpcs);

    // ③ 政党の members 配列から死亡者をまとめて一括削除（O(N)に最適化）
    if (isPartiesDefined) {
        for (const partyId in deadMembersByParty) {
            const targetParty = parties[partyId];
            if (targetParty && Array.isArray(targetParty.members)) {
                const deadIds = deadMembersByParty[partyId];
                // filter の中で O(1) で判定
                targetParty.members = targetParty.members.filter(m => m && !deadIds.has(m.id));
            }
        }
    }

    // ④ 死別チェック（生存NPCのみを対象に1回ループ）
    for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        if (!npc.spouse) continue;

        // 配偶者のIDが死亡Setに含まれているか確認
        if (deadNpcIds.has(npc.spouse.id)) {
            console.log(`💔 [死別] ${npc.name || npc.id} が配偶者を失いました。`);
            if (typeof addhis === 'function') {
                addhis(npc, `配偶者である${npc.spouse.name}と死別。`);
            }
            npc.spouse = null;
        }
    }

    if (removedCount > 0) {
        console.log(`🎍 年越し加齢処理: 寿命を迎えた ${removedCount} 名のNPCを配列から消去しました。`);
    }
}


const DEATH_TYPES = [
    {
        type: "assassination",
        cause: "暗殺",
        isNews: true, // ニュース速報を出すか
        // 発生条件・確率の判定関数
        check: (npc, isLeader, isPresident) => {
            let baseRate = 0.0001
            if (isLeader) {
                baseRate = 0.0005
            } else if (isPresident) {
                baseRate = 0.00035
            }
            return Math.random() < baseRate;
        }
    },
    {
        type: "accident",
        cause: "交通事故",
        isNews: true,
        check: (npc, isLeader) => {
            return Math.random() < 0.0002; // 0.2%
        }
    },
    {
        type: "sudden_illness",
        cause: "心臓発作",
        isNews: true,
        check: (npc, isLeader) => {
            return npc.age >= 50 && Math.random() < 0.0008;
        }
    },
    {
        type: "suiside",
        cause: "自殺",
        isNews: true,
        check: (npc, isLeader) => {
            return Math.random() < 0.00005;
        }
    },
    {
        type: "missing",
        cause: "行方不明",
        isNews: true,
        check: (npc, isLeader) => {
            return Math.random() < 0.0001;
        }
    },
    {
        type: "byouki",
        cause: "病死",
        isNews: true,
        check: (npc, isLeader) => {
            return Math.random() < 0.0002;
        }
    },
    {
        type: "cancer",
        cause: "癌",
        isNews: true,
        check: (npc, isLeader) => {
            return Math.random() < 0.0001;
        }
    },
    {
        type: "sisatu",
        cause: "刺殺",
        isNews: true,
        check: (npc, isLeader, isPresident) => {
            let baseRate = 0.0001
            if (isLeader) {
                baseRate = 0.0005
            } else if (isPresident) {
                baseRate = 0.00035
            }
            return Math.random() < baseRate;
        }
    },

];

// 🪦 2. 死亡判定メイン関数
function rare_death() {
    if (typeof npcs === 'undefined' || !Array.isArray(npcs)) return 0;


    for (let i = npcs.length - 1; i >= 0; i--) {
        const npc = npcs[i];

        let causeOfDeath = "";
        let isDead = false;
        let isNewsEvent = false;

        // ② ハプニング死の判定（設定テーブルをループ）

        const isLeader = typeof parties !== 'undefined' && parties[npc.partyId]?.leaderId === npc.id;
        const isPresident = typeof president !== 'undefined' && president && president.id === npc.id;

        for (const deathType of DEATH_TYPES) {
            // 💡 第3引数に isPresident を追加！
            if (deathType.check(npc, isLeader, isPresident)) {
                isDead = true;
                causeOfDeath = deathType.cause;
                if (isLeader || isPresident) {
                    isNewsEvent = deathType.isNews;
                }
                break; // 1つ合致したらループ抜け
            }
        }


        // 💀 死亡確定時の処理
        if (isDead) {
            let lastPartyName = "無所属";
            if (npc.partyId && typeof parties !== 'undefined' && parties[npc.partyId]) {
                lastPartyName = parties[npc.partyId].name || "無所属";
            }

            // 📍 埋葬地の生成
            const state = npc.pref || "首都";
            const city = npc.city || "中央";
            const graveTypes = ["立墓地", "立霊園", "立名誉墓地", "内の墓地", "内の寺院墓地", "内の大聖堂"];
            const randomGrave = graveTypes[Math.floor(Math.random() * graveTypes.length)];
            const hasCity = city && Math.random() < 0.5;
            const locationText = hasCity ? `${state}・${city}` : state;
            const gravesite = `${locationText}${randomGrave}`;
            const currentYear = (typeof gameDate !== 'undefined' && gameDate.getFullYear) ? gameDate.getFullYear() : 'XXXX';
            addhis(npc, `${causeOfDeath}により死亡。`);
            // 🪦 オブジェクト生成
            const graveObject = {
                id: npc.id || `grave_${Date.now()}_${i}`,
                name: npc.name || '政治家',
                avatar: npc.icon || "",
                finalAge: npc.age,
                deathYear: currentYear,
                causeOfDeath: causeOfDeath, // 💡 設定した死因がそのまま入る！

                lastPartyName: lastPartyName,
                ideology: npc.ideology || '不明',
                totalVotesEarned: npc.totalVotesEarned || 0,
                gravesite: gravesite,
                history: Array.isArray(npc.history) ? [...npc.history] : [],

                finalStats: {
                    xp: npc.xp || 0,
                    economy: Array.isArray(npc.ideology) ? npc.ideology[0] : 0,
                    national: Array.isArray(npc.ideology) ? npc.ideology[1] : 0,
                    foreign: Array.isArray(npc.ideology) ? npc.ideology[2] : 0
                }
            };

            if (typeof graveyard !== 'undefined') {
                graveyard.push(graveObject);
            }

            // 📰 ニュースログ・アラート
            if (isNewsEvent) {
                pushNotificationTray(
                    `${npc.name}が${causeOfDeath}によって死亡`,
                    `${npc.name}は${causeOfDeath}によって死亡した。`,
                    {
                        title: `${npc.name}が${causeOfDeath}によって死亡`,
                        body: `本日、${npc.name}は${causeOfDeath}によって死亡したと判明した。`,
                        buttons: [{ text: "OK", className: "scout-btn" }]
                    },
                    true
                );
            } else {
                console.log(`🪦 [死去] ${npc.name}（享年${npc.age}歳）が${causeOfDeath}により死去しました。`);
            }

            // 🏛️ 所属政党のクリーンアップ処理
            if (npc.partyId && typeof parties !== 'undefined' && parties[npc.partyId]) {
                const targetParty = parties[npc.partyId];
                if (Array.isArray(targetParty.members)) {
                    targetParty.members = targetParty.members.filter(m => m && m.id !== npc.id);
                }
                if (targetParty.leaderId === npc.id) {
                    targetParty.leaderId = null;
                    console.log(`⚠️ ${targetParty.name} の党首が不在になりました。`);
                }
            }

            // 配列から削除
            npcs.splice(i, 1);
            removedCount++;
            return;
        }
    }

    return removedCount;
}

// 毎年の年越し処理の中に記述するイメージ
function processYearlyPartyElections(currentYear) {

    // 全政党の党首選チェック
    Object.values(parties).forEach(party => {
        if (party.id === 'independents') return;
        console.log(`政党名: ${party.name}, 次の選挙年: ${party.nextElectionYear}`);

        if (party.nextElectionYear && party.nextElectionYear <= currentYear) {

            // 🌟 汎用代表選挙関数を実行！
            holdPartyLeadershipElection(party);

            // 次回の党首選年を更新（例: さらに3年〜4年後）
            party.nextElectionYear = currentYear + (party.termLength || 3);
        }
    });
}


function showPartyListModal() {
    const partyKeys = Object.keys(parties).filter(key => key !== "null" && key !== "undefined");

    if (partyKeys.length === 0) {
        showModal("政党一覧", `<p style="color:#a0aec0; text-align:center; padding:20px; font-style:italic;">現在、結成されている政党はありません。</p>`, [
            { text: "閉じる", className: "close-btn", keepOpen: false }
        ]);
        return;
    }


    let html = `
    <button style="width:100%; padding:10px;                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
" onclick="showCreatePlayerPartyModal();">政党作成</button>`

    html += `
    <hr />
        <div style="max-height: 400px; overflow-y: auto; padding-right: 5px; display: flex; flex-direction: column; gap: 12px;">
    `;

    partyKeys.forEach(partyId => {
        const party = parties[partyId];
        if (party.name === "無所属") return;

        const members = [player, ...npcs].filter(m => m.partyId === partyId);
        const leader = members.find(m => m.id === party.leaderId) || party.leader || { name: "不詳" };

        let avgEcon = 0, avgNation = 0, avgForeign = 0;
        if (members.length > 0) {
            avgEcon = Math.floor(members.reduce((sum, m) => sum + m.ideology[0], 0) / members.length);
            avgNation = Math.floor(members.reduce((sum, m) => sum + m.ideology[1], 0) / members.length);
            avgForeign = Math.floor(members.reduce((sum, m) => sum + m.ideology[2], 0) / members.length);
        }
        let ide = [
            avgEcon,
            avgNation,
            avgForeign
        ]
        let ideomna = getIdeologyName(ide)




        // 各政党の簡易カード（クリックで詳細へ）
        html += `
            <div class="party-list-card" data-party-id="${partyId}" style="
                background: #2d3748; 
                border-left: 6px solid ${party.color || '#4a5568'}; 
                padding: 12px; 
                border-radius: 4px; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                cursor: pointer;
                transition: transform 0.1s ease, background 0.2s ease;
            " onmouseover="this.style.background='#344154'" onmouseout="this.style.background='#2d3748'">
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 16px; font-weight: bold; color: #fff;">🏛️ ${party.name}</span>
                    <span style="background: #1a202c; color: #ecc94b; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                        構成員: ${members.length}人
                    </span>
                </div>
                
                <div style="font-size: 13px; color: #cbd5e0; margin-bottom: 6px;">
                    <div>👑 <strong>党首:</strong> ${leader.name}</div>
                </div>
                
                <div style="text-align: right; font-size: 11px; color: #a0aec0; margin-top: 6px; font-style: italic;">
                    クリックして所属議員や詳細を確認 🔍
                </div>
            </div>
        `;
    });

    html += `</div>`;

    showModal("政党一覧", html, [
        { text: "閉じる", className: "close-btn", keepOpen: false }
    ]);

    // カードクリックで「詳細画面」を開くイベントを仕込む
    setTimeout(() => {
        const modal = document.getElementById("genericModal");
        const cards = modal.querySelectorAll(".party-list-card");
        cards.forEach(card => {
            card.addEventListener("click", (e) => {
                const targetPartyId = e.currentTarget.getAttribute("data-party-id");
                // 👇 下で作る詳細モーダル関数を呼び出す
                showPartyDetailModal(targetPartyId);
            });
        });
    }, 50);
}

function showNpcSearchModal() {
    // モーダルのコンテンツHTML（検索窓 + リスト表示エリア）
    const searchHTML = `
        <div style="font-size: 14px; color: #e2e8f0; display: flex; flex-direction: column; gap: 10px;">
            
            <!-- 🔍 検索入力エリア -->
            <div style="display: flex; gap: 8px;">
                <input type="text" id="npcSearchInput" placeholder="名前・拠点・所属政党のどれかを入力..." style="
                    flex: 1; padding: 10px; border-radius: 4px; border: 1px solid #4a5568; 
                    background: #1a202c; color: #fff; font-size: 14px; box-sizing: border-box;
                ">
                <button id="npcSearchClearBtn" style="
                    background: #4a5568; color: #fff; border: none; border-radius: 4px; 
                    padding: 0 14px; font-size: 13px; font-weight: bold; cursor: pointer;
                " onmouseover="this.style.background='#2d3748'" onmouseout="this.style.background='#4a5568'">
                    クリア
                </button>
            </div>
            
            <!-- 📊 カウント表示 -->
            <div id="npcSearchCount" style="font-size: 12px; color: #ecc94b; font-weight: bold;">
                該当者: 計${npcs.length}名 / 総人口${npcs.length}名
            </div>

            <!-- 📜 【スクロール出禁対応】NPC名簿リストエリア -->
            <div id="npcSearchListContainer" style="
                max-height: 320px; overflow-y: auto; padding-right: 5px; 
                display: flex; flex-direction: column; gap: 8px;
            ">
                <!-- ここに動的に検索結果がブチ込まれます -->
            </div>
        </div>
    `;

    // 閉じるボタンだけを配置してモーダルを開く
    showModal("国民検索", searchHTML, [
        { text: "閉じる", className: "close-btn", keepOpen: false }
    ]);

    // モーダルがDOMに描画された直後に、リアルタイム検索のイベントをバインド
    setTimeout(() => {
        const searchInput = document.getElementById("npcSearchInput");
        const clearBtn = document.getElementById("npcSearchClearBtn");

        // 最初は全NPCをそのまま表示

        // 文字が入力されるたびにリアルタイムでリストを絞り込む
        searchInput.addEventListener("input", (e) => {
            renderFilteredNpcs(e.target.value.trim());
        });

        // クリアボタンを押したときの処理
        clearBtn.addEventListener("click", () => {
            searchInput.value = "";
            searchInput.focus();
        });
    }, 50);
}

function renderFilteredNpcs(keyword) {
    const listContainer = document.getElementById("npcSearchListContainer");
    const countDisplay = document.getElementById("npcSearchCount");
    if (!listContainer || !countDisplay) return;

    // キーワード（大文字小文字を区別しない）でフィルタリング
    const lowKeyword = keyword.toLowerCase();
    const filtered = npcs.filter(npc => {
        let ideoType = getIdeologyName(npc.ideology) || "中道";
        const isUnaligned = (npc.partyId === null);

        const partyName = (!isUnaligned && parties[npc.partyId]) ? parties[npc.partyId].name : "無所属";

        if (!lowKeyword) return false; // 空白なら全員合格
        return npc.name.toLowerCase().includes(lowKeyword) ||
            npc.city.toLowerCase().includes(lowKeyword) ||
            ideoType.toLowerCase().includes(lowKeyword) ||
            partyName.toLowerCase().includes(lowKeyword)

    });

    // カウント表示の更新
    countDisplay.textContent = `該当者: 計${filtered.length}名 / 総人口${npcs.length}名`;

    // リストが空っぽの場合の案内
    if (filtered.length === 0) {
        listContainer.innerHTML = `<p style="color:#a0aec0; text-align:center; padding:20px; font-style:italic; font-size:13px;">見つかりませんでした</p>`;
        return;
    }

    // ヒットしたNPCの簡易行（リスト）を生成
    let listHTML = "";
    filtered.forEach(npc => {
        // 所属政党バッジのテキスト
        const isUnaligned = (npc.partyId === null);
        const partyName = (!isUnaligned && parties[npc.partyId]) ? parties[npc.partyId].name : "無所属";
        const partyColor = (!isUnaligned && parties[npc.partyId]) ? parties[npc.partyId].color : "#718096";

        // 右派・左派などを見分けるため、総合の思想名があれば出す（ここではnpc.ideologyの数値から計算する例にしています）
        let ideoType = getIdeologyName(npc.ideology) || "中道";

        listHTML += `
            <div class="npc-search-row" data-npc-id="${npc.id}" style="
                background: #2d3748; padding: 10px; border-radius: 4px; 
                display: flex; justify-content: space-between; align-items: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.15); cursor: pointer;
                transition: background 0.15s ease, transform 0.1s ease;
            " onmouseover="this.style.background='#344154'; this.style.transform='translateX(2px)'" onmouseout="this.style.background='#2d3748'; this.style.transform='none'">
                
                <!-- 左側：名前、活動拠点、所属、思想の傾向 -->
                <div>
                    <div style="font-weight: bold; color: #fff; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        <span>👤 ${npc.name}</span>
                        <span style="font-size: 11px; background: ${partyColor}; color: #fff; padding: 1px 6px; border-radius: 3px;">
                            ${partyName}
                        </span>
                    </div>
                    <div style="font-size: 12px; color: #cbd5e0; margin-top: 4px; display: flex; gap: 12px;">
                        <span>📍 拠点: <strong>${npc.city}</strong></span>
                        <span>年齢: <strong>${npc.age || "不明"}歳</strong></span>
                        <span style="color: #ecc94b;">💰 資金: ${Math.floor(npc.money / 10000).toLocaleString()}万</span>
                        <span style="color: #cbd5e0;">⚖️ 思想: ${ideoType}</span>
                    </div>
                </div>

                <!-- 右側：プロフィール詳細を呼び出す案内 -->
                <div style="font-size: 12px; color: #63b3ed; font-weight: bold; padding-right: 5px;">
                    詳細を見る 🔍
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = listHTML;

    // 生成された各「行」をクリックしたときに、以前作成したNPC個別プロフィールモーダルを上書きで開くイベントを仕込む
    const rows = listContainer.querySelectorAll(".npc-search-row");
    rows.forEach(row => {
        row.addEventListener("click", (e) => {
            const npcId = e.currentTarget.getAttribute("data-npc-id");
            const targetNpc = npcs.find(n => n.id === npcId);

            if (targetNpc) {
                // 💡 カードを直接クリックした時と「全く同じクリックイベント」を強制発火させて、詳細プロフィール画面へ飛ばす
                // 戻るボタンが欲しい場合は名簿に再ジャンプするボタンをプロフィールのボタン配列に追加すると便利です
                openNpcDetailFromSearch(targetNpc);
            }
        });
    });
}

// 検索画面からスムーズにプロフィールにジャンプするためのヘルパー
function openNpcDetailFromSearch(npc) {
    // 💡 以前作った card.addEventListener("click", ...) 内の「modalBodyHTML」と「actionButtons」のロジックをここに呼び出すか、
    // 既存のカードオブジェクトのクリックイベントをシミュレートすると、綺麗に詳細画面が開きます！
    // 閉じたら自動的に検索窓に戻れるように「↩️ 検索に戻る」を配置するのがお勧めです。
    npccardview(npc);
}

function npccardview(npcOrId) {
    const npc = typeof npcOrId === 'string' ? [player, ...npcs].find(n => n.id === npcOrId) : npcOrId;

    // ガード処理: もし見つからなかったり undefined だったら処理を中断
    if (!npc) {
        console.error("NPCが見つかりませんでした:", npcOrId);
        return;
    }
    const ideo = getIdeologyName(npc.ideology);

    const isUnaligned = (npc.partyId === null);
    const partyNameText = (!isUnaligned && parties[npc.partyId]) ? `🏛️ ${parties[npc.partyId].name}` : "👤 無所属";

    // --- 👥 【改善】関係が0以外のNPCだけを抽出＆スクロール枠を設置 ---
    let relationsHTML = "";

    // 友好度が 0 ではない（ドラマのある）関係だけをフィルタリング

    // --- 👥 【完全修正】同じ街のNPC ＋ プレイヤーをまとめて関係者候補にする ---
    // 1. まず同じ街の他のNPCを抽出
    const fellowCandidates = npcs.filter(other => other.id !== npc.id);

    // 2. もしプレイヤーがこのNPCと同じ街にいるなら、プレイヤーもリストの先頭に追加する！
    if (typeof player !== "undefined" && player.city === npc.city) {
        // すでに配列にプレイヤーが入っていないかチェック（重複ガード）
        if (!fellowCandidates.some(c => c.id === player.id)) {
            fellowCandidates.unshift(player); // 配列の最初（特等席）にプレイヤーをブチ込む
        }
    }

    // 3. 友好度が 0 ではない（ドラマのある）関係だけをフィルタリング（ここは共通！）
    const activeRelations = fellowCandidates.filter(other => getRelation(npc.id, other.id) !== 0);
    const myRelations = [];

    // 現在開いているNPCのIDを文字列にしておく
    const myIdStr = String(npc.id);

    // グローバルな npcRelations（Map）を全走査
    npcRelations.forEach((score, key) => {
        // 💡【ここを大修正】単にsplit("-")するとUUIDのハイフンで千切れるため、
        // プレイヤーの生成ルール（id1 < id2 の文字列結合など）から、綺麗に2つのIDへ復元します。

        // keyに自分のIDが含まれているか、まず文字列の部分一致で超高速チェック
        if (key.includes(myIdStr)) {
            // 自分のIDの長さを利用して、相手のIDの始まり/終わりの位置を特定して綺麗に抜き出す
            let partnerId = "";

            if (key.startsWith(myIdStr + "-")) {
                // パターンA: [自分のID]-[相手のID] の場合、自分のID＋ハイフン以降をすべて相手のIDとする
                partnerId = key.substring(myIdStr.length + 1);
            } else if (key.endsWith("-" + myIdStr)) {
                // パターンB: [相手のID]-[自分のID] の場合、後ろのハイフン＋自分のIDより前をすべて相手のIDとする
                partnerId = key.substring(0, key.length - (myIdStr.length + 1));
            }

            // 💡 相手のIDが無事に特定でき、かつ因縁（スコアが0以外）がある場合のみストック
            if (partnerId && score !== 0) {
                myRelations.push({ partnerId: partnerId, score: score });
            }
        }
    });

    // 関係性データが存在する場合、カードを組み立てる
    if (myRelations.length > 0) {
        relationsHTML = `
            <div style="margin-top:16px;">
                <span style="color:#63b3ed; display:block; font-weight:bold; margin-bottom:8px; font-size:13px;">👥 人間関係（ネットワーク）</span>
                <div style="display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; padding-right: 4px;">
        `;

        myRelations.forEach(rel => {
            const relId = String(rel.partnerId);
            const score = rel.score;

            let displayName = "政治家";
            let displayParty = "無所属";
            let displayPartyColor = "#718096";
            let displayCity = "都市";
            let displaypref = "地域";
            let agea = "不明";
            let displayIcon = "https://upload.wikimedia.org/wikipedia/commons/4/48/No_image_%28male%29.svg"

            // 相手がプレイヤーかNPCかを判定
            if (player && relId === String(player.id)) {
                displayName = player.name + " (あなた)";
                displayIcon = player.icon;
                displayParty = player.partyId ? getPartyName(player.partyId) : "無所属";
                displayPartyColor = player.partyId ? getPartyColor(player.partyId) : "#718096";
                displayCity = player.city || "都市";
                agea = player.age || "不明";
            } else {
                // npcs配列から、相手のNPCデータをIDで確実に探す
                const foundNpc = npcs.find(n => String(n.id) === relId);
                if (foundNpc) {
                    displayIcon = foundNpc.icon;
                    displayName = foundNpc.name;
                    displayParty = foundNpc.partyId ? getPartyName(foundNpc.partyId) : "無所属";
                    displayPartyColor = foundNpc.partyId ? getPartyColor(foundNpc.partyId) : "#718096";
                    displayCity = foundNpc.city || foundNpc.cityCity || "不明"; // 念のため別プロパティもケア
                    displaypref = foundNpc.pref || foundNpc.preference || "不明"; // 🔥 ここが原因だった可能性大
                    agea = foundNpc.age || "不明";


                }
            }

            // 関係スコアの数値による色と背景の決定
            let badgeBg = "#4a5568";
            let rowBg = "#2d3748";

            if (score > 0) {
                badgeBg = "#2f855a";
                rowBg = "linear-gradient(90deg, #1c4532 0%, #2d3748 40%)";
            } else if (score < 0) {
                badgeBg = "#9b2c2c";
                rowBg = "linear-gradient(90deg, #651a1a 0%, #2d3748 40%)";
            }

            // 🤝 【進化したミニカードHTML】
            // プレイヤーの場合はクリック不可にするため、data-npc-id を付与しない
            const isPlayer = player && relId === String(player.id);
            const dataAttribute = isPlayer ? '' : `data-npc-id="${relId}"`;
            const cursorStyle = isPlayer ? 'default' : 'pointer';

            relationsHTML += `
        <div ${dataAttribute} 
            class="relation-row"
            style="
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                background: ${rowBg}; 
                padding: 8px 10px; 
                border-radius: 6px; 
                border: 1px solid #4a5568; 
                cursor: ${cursorStyle}; 
                transition: background 0.15s ease;
                /* 👇 スマホでタップした時のダサい青・白のピカッ（雷）を絶対に消す魔法のコード */
                -webkit-tap-highlight-color: transparent;
            " 
            /* PC用のホバー */
            ${isPlayer ? '' : `onmouseover="this.style.background='#3a4454'" onmouseout="this.style.background='${rowBg}'"`}
            /* スマホ用のタップ時エフェクト（指が触れたら少し明るく、離したら戻す） */
            ${isPlayer ? '' : `ontouchstart="this.style.background='#3a4454'" ontouchend="this.style.background='${rowBg}'" ontouchcancel="this.style.background='${rowBg}'"`}
        >
            <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${displayIcon}" width="40px" height="40px" style="border-radius: 50%; border: 2px solid #4a5568; object-fit: cover; flex-shrink: 0;">
                <div>
                    <div style="font-weight: bold; color: #fff; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                        <span>${displayName}</span>
                        <span style="font-size: 10px; background: ${displayPartyColor}; color: #fff; padding: 1px 4px; border-radius: 3px;">
                            ${displayParty}
                        </span>
                    </div>
                    <div style="font-size: 11px; color: #a0aec0; margin-top: 2px;">
                        📍 拠点: ${displaypref}・${displayCity}
                        年齢: ${agea || "不明"}歳

                    </div>

                </div>
            </div>
            <div style="font-size: 13px; font-weight: bold; background: ${badgeBg}; color: #fff; padding: 4px 10px; border-radius: 4px; min-width: 45px; text-align: center;">
                ${score > 0 ? '+' : ''}${score}
            </div>
        </div>
    `;
        });

        relationsHTML += `</div></div>`;
    } else {
        relationsHTML = `
            <div style="margin-top:16px;">
                <span style="color:#63b3ed; display:block; font-weight:bold; margin-bottom:4px; font-size:13px;">👥 人間関係</span>
                <p style="font-size:12px; font-style:italic; color:#a0aec0; background: #2d3748; padding: 10px; border-radius: 6px; text-align: center; margin: 0;">関係者はまだいません</p>
            </div>
        `;
    }
    displayParty = npc.partyId ? getPartyName(npc.partyId) : "無所属";
    displayPartyColor = npc.partyId ? getPartyColor(npc.partyId) : "#718096";
    let historyListHTML = "";

    if (npc.history && npc.history.length > 0) {
        // 1. 🔥 表示する直前に西暦順（古い順）にソートして時系列を正す
        const sortedHistory = [...npc.history].sort((a, b) => {
            const yearA = parseInt(a.match(/^\d+/), 10) || 0;
            const yearB = parseInt(b.match(/^\d+/), 10) || 0;
            return yearA - yearB;
        });

        // 2. スタイリングしながらHTMLを生成
        historyListHTML = sortedHistory.map(item => {
            // 💡 最初の「:」または「: 」で確実に分割する正規表現
            const match = item.match(/^([^:]+):\s*(.*)\$/);

            let date = "";
            let content = item; // 分割できなかった場合のフォールバック

            if (match) {
                date = match[1].trim();   // 「1996年1月1日」や「1958年」
                content = match[2].trim(); // イベントの内容
            } else {
                // もし「:」が含まれていないデータだった場合、先頭の数字（年）だけ無理やり抜く
                const yearMatch = item.match(/^(\d+年(\d+月\d+日)?)/);
                if (yearMatch) {
                    date = yearMatch[1];
                    content = item.replace(date, "").replace(/^[\s:：]+/, "");
                }
            }

            return `
            <div style="margin-bottom: 10px; font-size: 13px; border-left: 2px solid #4a5568; padding-left: 8px;">
                <span style="color: #a0aec0; font-size: 11px; display: block; font-family: monospace; font-weight: bold; margin-bottom: 2px;">${date}</span>
                <span style="color: #e2e8f0; line-height: 1.4;">${content}</span>
            </div>
        `;
        }).join("");
    } else {
        historyListHTML = `<div style="color: #718096; font-size: 13px; font-style: italic; padding: 4px 0;">経歴データなし</div>`;
    }


    // --- モーダルのコンテンツHTML ---
    const modalBodyHTML = `
                <div style="display:flex; align-items:center; margin-bottom:12px; background:#2d3748; padding:10px; border-radius:6px;">
                    <img src="${npc.icon}" width="60px" height="60px" style="border-radius:50%; margin-right:12px; border:2px solid #4a5568;">
                    <div>
                        <div style="font-size:18px; font-weight:bold; color:#fff;">${npc.name}</div>
                        <div style="font-size:13px; margin-top:2px; color:#fff;">所属: ${partyNameText}</div>
                    </div>
                </div>
                <div style="font-size:14px; line-height:1.6;">
                    <div>📍 <strong>活動拠点:</strong>${npc.pref}・${npc.city}</div>
                    <div><strong>年齢: </strong>${npc.age || "不明"}歳</div>
                    ${npc.spouse ? `<div><strong>配偶者: </strong>${npc.spouse.name || "不明"}</div>` : ""}

                    <div>💰 <strong>現在の資金:</strong> ${Math.floor(npc.money).toLocaleString()}円</div>
                    <div><strong>所属政党:</strong><span style="font-size: 15px; background: ${displayPartyColor}; color: #fff; padding: 1px 4px; border-radius: 3px;">
                            ${displayParty}
                        </span>
                    <div style="margin-top:8px; background:#1a202c; padding:8px; border-radius:4px;">
                        <span style="color:#fc8181; display:block; font-weight:bold; margin-bottom:4px;">📊 政治思想（総合: ${ideo}）</span>
                        <div style="display:flex; justify-content:space-between; font-size:13px;">
                            <span style="color:#fc8181;">経:${npc.ideology[0]}</span>
                            <span style="color:#63b3ed;">国:${npc.ideology[1]}</span>
                            <span style="color:#ecc94b;">外:${npc.ideology[2]}</span>
                        </div>
                    </div>

                    <!-- 📜 【新設】Wikipedia風 来歴・動向タイムライン -->
                    <div style="margin-top:12px; background:#1a202c; padding:10px; border-radius:4px; border: 1px solid #2d3748;">
                        <span style="color:#63b3ed; display:block; font-weight:bold; margin-bottom:6px; font-size:13px; border-bottom: 1px solid #2d3748; padding-bottom: 2px;">
                            📜 来歴
                        </span>
                        <!-- 💡 履歴が増えてもモーダルを突き破らないよう、MAX高さを設定してスクロール可能に -->
                        <div style="max-height: 120px; overflow-y: auto; padding-right: 4px;">
                            ${historyListHTML}
                        </div>
                    </div>
                    ${relationsHTML}
                </div>
            `;


    // モーダル全体のコンテナ要素を取得（実際の環境に合わせてクラス名やIDを変更してください）
    // ここではモーダルの外枠を仮に `document` 全体、または特定のモーダル要素にしています
    const modalContainer = document.body; // もしモーダル専用のコンテナ（例: id="npcModal"）があればそこを指定するとより良いです

    // すでに設定されている古いイベントをクリアするため、一度削除して再登録するか、
    // 以下のように親要素で一括してキャッチ（イベント委譲）します
    if (!modalContainer.dataset.hasRelationClickEvent) {
        modalContainer.addEventListener("click", (e) => {
            // クリックされた要素、またはその親要素から data-npc-id を持っているものを探す
            const clickedRow = e.target.closest("[data-npc-id]");

            if (clickedRow) {
                const npcId = clickedRow.getAttribute("data-npc-id");

                // 全体の npcs 配列から対象のNPCを検索
                const targetNpc = npcs.find(n => String(n.id) === npcId);
                if (targetNpc) {
                    // 💡 最初のステップで実装した詳細画面を開く関数を呼び出す
                    openNpcDetailFromSearch(targetNpc);
                }
            }
        });
        // 二重にイベントが登録されるのを防ぐフラグ
        modalContainer.dataset.hasRelationClickEvent = "true";
    }

    // --- 🛠️ プレイヤーが操作するインタラクションボタンの設定 ---
    const actionButtons = [];

    if (npc.id !== player.id) {
        actionButtons.push({
            text: "⚡行動",
            className: "scout-btn", // 目立つ緑（または金）ボタン
            keepOpen: true, // 次のモーダルを開くので閉じない
            callback: () => {
                // プロフィールを閉じずに、上書きで「行動選択モーダル」を呼び出す
                openActionSelectModal(npc);
            }
        });
    }


    // 3. 通常の閉じるボタン
    actionButtons.push({
        text: "閉じる",
        className: "close-btn",
        keepOpen: false
    });

    // モーダルを表示
    showModal("プロフィール", modalBodyHTML, actionButtons);
}
function detoxNpcPopulation() {
    // 💡 npcs が配列であることを前提に、要素数を正確にチェック
    if (!Array.isArray(npcs) || npcs.length <= 15000) return;

    console.log(`🚨 人口爆発！ (${npcs.length}人)。既存の配列構造を維持したまま1万人までデトックスします...`);

    // ─── 1. 絶対に消してはいけない重要キャラの隔離処理 ───
    const leaderIds = new Set();
    if (typeof parties !== 'undefined' && parties) {
        Object.values(parties).forEach(party => {
            if (party && party.leaderId) leaderIds.add(String(party.leaderId));
        });
    }

    const presId = (typeof president !== 'undefined' && president) ? String(president.id) : null;

    const protectedNpcs = []; // 残す重要NPC・現役エリート
    const deletableNpcs = []; // 排除する高齢・無能モブ

    // 💡 配列として安全にループを回す
    npcs.forEach(npc => {
        if (!npc) return;
        const npcIdStr = String(npc.id);

        // 👑 特権階級の保護チェック（無条件生存）
        const isSeat = npc.rep || npc.sen || false; // 現職議員
        const isLeader = leaderIds.has(npcIdStr);   // 党首
        const isPres = (presId === npcIdStr);       // 大統領
        const isPlayer = (typeof player !== 'undefined' && player && player.id === npc.id); // プレイヤー自身

        // 👶 生殖・生産性ラインのチェック
        // 「35歳未満（または65歳未満）」かつ「政治資本（XP）が100以上」の有能な野郎どもだけを生き残らせる
        const isProductiveAge = npc.age !== undefined && npc.age < 30;
        const isEliteMob = npc.xp !== undefined && npc.xp >= 100;

        // 特権階級か、未来への投資価値がある現役エリートなら生存！
        if (isSeat || isLeader || isPres || isPlayer || isEliteMob || isProductiveAge) {
            protectedNpcs.push(npc);
        } else {
            // 高齢モブ、および若くてもXP100未満の無能モブは容赦なく廃棄候補へ
            deletableNpcs.push(npc);
        }
    });

    // ─── 2. 目標の「1万人」になるようにモブをランダムに選別 ───
    const targetTotal = 5000;
    const allowedMobCount = Math.max(0, targetTotal - protectedNpcs.length);

    console.log(`📊 [人口内訳] 生存確定: ${protectedNpcs.length}人 | 廃棄候補: ${deletableNpcs.length}人`);

    // 廃棄候補をランダムシャッフル
    deletableNpcs.sort(() => Math.random() - 0.5);

    // 1万人までの残り枠に入る分だけ救済
    const survivorsMobs = deletableNpcs.slice(0, allowedMobCount);
    const deletedCount = deletableNpcs.length - survivorsMobs.length;

    // ─── 3. 💥 配列（npcs）の安全な中身総入れ替え ───
    // 💡 既存の配列の「参照」を絶対に壊さないため、length = 0 で中身だけをクリアする
    // これにより、他ファイルが [player, ...npcs] と展開しても絶対にエラーになりません！
    npcs.length = 0;

    // 生き残った精鋭たちだけを配列に再追加
    npcs.push(...protectedNpcs, ...survivorsMobs);

    // ─── 4. 後処理とメモリ強制クリーンアップ ───
    if (typeof CheckIndependent === "function") {
        CheckIndependent();
    }

    // NW.js（nw.exe）設定で有効化したガベージコレクションを発動！
    if (typeof global !== 'undefined' && global.gc) {
        global.gc();
    }

    console.log(`✨ デトックス完了！ ${deletedCount}人のゴミモブを配列から完全消去しました。現在のクリーンなNPC総数: ${npcs.length}人`);
}



/**
 * 年齢・寿命が未設定の全NPCに数値を割り当てる関数（超高速・フリーズ防止版）
 * 重い前日譚生成をミリ秒単位で分割実行し、ユーザーのブラウザを固めません。
 * 
 * @param {Array} npcList - 全NPCの配列
 * @param {Object} options - 設定オプション
 * @returns {Promise<number>} 更新されたNPC数を返すPromise
 */
function assignMissingNpcAges(npcList, options = {}) {
    const {
        defaultMinMaxAge = 70,
        defaultMaxMaxAge = 120,
        isAdultAtStart = true,
        minAdultAge = 18,
        debugLog = false
    } = options;

    // 配列が空なら即終了
    if (!Array.isArray(npcList) || npcList.length === 0) {
        if (debugLog) console.warn("assignMissingNpcAges: 有効なNPC配列が渡されていません。");
        return 0;
    }

    const currentYear = typeof gameDate !== 'undefined' ? gameDate.getFullYear() : new Date().getFullYear();
    let updatedCount = 0;
    const total = npcList.length;

    // 🚀 ややこしい分割処理はやめて、その場で一気に全員分を確定させる！
    for (let i = 0; i < total; i++) {
        const npc = npcList[i];
        if (!npc) continue;

        // 1. 年齢と寿命を一瞬で確定
        if (typeof npc.age === 'undefined' || npc.age === null) {
            if (!npc.maxAge) {
                const minAge = npc.minMaxAge || defaultMinMaxAge;
                const maxAge = npc.maxMaxAge || defaultMaxMaxAge;
                npc.maxAge = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
            }

            const minStartAge = isAdultAtStart ? Math.min(minAdultAge, npc.maxAge - 5) : 0;
            const maxStartAge = Math.floor(npc.maxAge * 0.75);

            npc.age = (maxStartAge >= minStartAge)
                ? Math.floor(Math.random() * (maxStartAge - minStartAge + 1)) + minStartAge
                : minStartAge;

            updatedCount++;
        }

        // 2. 年齢確定後、そのまま人生（前日譚）を生成
        //if (!npc.background_history && typeof generatePrestory === 'function') {
        //    generatePrestory(npc, currentYear);
        //}

        // 3. 毎年のイベント処理
        //if (typeof processYearlyEvent === 'function') {
        //    processYearlyEvent(npc, currentYear);
        //}
    }

    if (debugLog) console.log(`🎉 全NPC ${total} 名の年齢確定＆前日譚の生成が一瞬で完了しました！（新規確定: ${updatedCount}名）`);
    return updatedCount;
}


function tryMarriageSystem(npc, allNPCs, currentYear) {
    const myAgeAtThatTime = npc.age;

    // 20歳未満は結婚しない
    if (myAgeAtThatTime < 20) return;

    // ── 1. 自分が「現在」独身かどうかの判定 ──
    // 過去に結婚していても、一番直近の婚姻が離婚(isMarried === false)なら独身とみなす
    const isMyselfSingleAtThatTime = !npc.isMarried || npc.spouse === null;
    if (!isMyselfSingleAtThatTime) return;

    // 毎年50%の確率で結婚活動をおこなう
    if (Math.random() > 0.50) return;

    // マッチング候補リスト
    const highRelationNPCs = []; // 仲が良い候補 (好感度40以上)
    const ageAppropriateNPCs = []; // 年齢が近い候補 (前後5歳差)
    const singleNPCs = []; // すべての独身候補

    // ゲーム終了時点の西暦
    const endYear = gameDate.getFullYear();

    for (let i = 0; i < allNPCs.length; i++) {
        const other = allNPCs[i];

        if (other.id === npc.id) continue;

        // 相手の生年と、その年時点の年齢を逆算
        const otherBirthYear = endYear - other.age;
        const calculatedOtherAge = currentYear - otherBirthYear;

        // まだ生まれていない、または20歳未満、または死亡済みなら除外
        if (otherBirthYear > currentYear) continue;
        if (calculatedOtherAge < 20) continue;
        const otherMaxAge = other.maxAge ?? other.maxage ?? 80;
        if (calculatedOtherAge > otherMaxAge) continue;

        // ── 相手が「現在」独身かどうかの判定 ──
        const isOtherSingleAtThatTime = !other.isMarried || other.spouse === null;
        if (!isOtherSingleAtThatTime) continue;

        // ── 2. 地域（pref / city）の一致チェック ──
        // NPCにprefやcityが設定されている場合、同じ地域に住んでいる相手のみ候補とする
        if (npc.pref && other.pref && npc.pref !== other.pref) continue;
        if (npc.city && other.city && npc.city !== other.city) continue;

        // ── 3. 好感度（仲の良さ）の取得 ──
        const currentRelation = getRelation(npc.id, other.id);

        // 基本の独身候補リストへ追加
        singleNPCs.push({ npc: other, score: currentRelation });

        // 年齢差5歳以内
        if (Math.abs(myAgeAtThatTime - calculatedOtherAge) <= 5) {
            ageAppropriateNPCs.push({ npc: other, score: currentRelation });
        }

        // 💡 好感度が一定以上（例: 40以上）なら「仲が良い候補」へ
        if (currentRelation >= 40) {
            highRelationNPCs.push({ npc: other, score: currentRelation });
        }
    }

    if (singleNPCs.length === 0) return;

    // ── 💡 仲の良さを最優先する結婚AIロジック ──
    let chosenData = null;

    if (highRelationNPCs.length > 0) {
        // 1. 最優先：お互いに仲が良い人がいれば、その中からランダム（または一番好感度が高い人）
        // ここではゲーム的なランダム性を残しつつ、仲良しリストから抽選
        chosenData = highRelationNPCs[Math.floor(Math.random() * highRelationNPCs.length)];
    } else if (Math.random() < 0.70 && ageAppropriateNPCs.length > 0) {
        // 2. 次点：特に仲良しがいない場合、70%の確率で年齢が近い人から抽選
        chosenData = ageAppropriateNPCs[Math.floor(Math.random() * ageAppropriateNPCs.length)];
    } else {
        // 3. 最終候補：すべての独身から完全ランダム
        chosenData = singleNPCs[Math.floor(Math.random() * singleNPCs.length)];
    }

    const chosenSpouse = chosenData.npc;

    // 名前データの安全な抽出
    const nameA = `${npc.firstname || ''} ${npc.lastname || ''}`.trim() || npc.name || "名無し";
    const nameB = `${chosenSpouse.firstname || ''} ${chosenSpouse.lastname || ''}`.trim() || chosenSpouse.name || "名無し";

    // ── 🔄 婚姻データの更新（過去の離婚履歴を壊さない） ──
    // 離婚・再婚履歴を追えるよう、過去の結婚データを履歴に残したい場合は
    // npc.pastMarriages = npc.pastMarriages || []; に退避させる設計も可能ですが、
    // 現在の婚姻状態はフラグ（isMarried）と最新オブジェクトで綺麗に管理します。

    npc.isMarried = true;
    npc.spouse = {
        id: chosenSpouse.id,
        name: nameB,
        marriedYear: currentYear,
        divorcedYear: null
    };

    chosenSpouse.isMarried = true;
    chosenSpouse.spouse = {
        id: npc.id,
        name: nameA,
        marriedYear: currentYear,
        divorcedYear: null
    };

    // 好感度によるテキスト分岐（仲が良いほど恋愛結婚になりやすい）
    let marriageDetails = [
        "{target}と結婚。"
    ];

    if (chosenData.score >= 50) {
        marriageDetails.push("幼馴染の{target}と結婚。");
    } else {
        marriageDetails.push("{target}と結婚。");
    }

    const textTemplate = marriageDetails[Math.floor(Math.random() * marriageDetails.length)];

    if (!npc.history) npc.history = [];
    if (!chosenSpouse.history) chosenSpouse.history = [];

    // 結婚したら初期値としてさらに関係性を+50する（上限100）
    changeRelation(npc.id, chosenSpouse.id, 60);

    npc.history.push(`${currentYear}年: ${textTemplate.replace("{target}", nameB)}`);
    chosenSpouse.history.push(`${currentYear}年: ${textTemplate.replace("{target}", nameA)}`);
}

/**
 * 💡 毎ターンの結婚維持・離婚・出産システム（超現実・爆速版）
 */
function processMarriageTurn(npcs, simulateYear) {
    const totalNpcs = npcs.length;
    if (totalNpcs === 0) return;

    // ── 【高速化①】IDからNPCオブジェクトをO(1)で即引きできるマップを作成 ──
    const npcMap = new Map();
    for (let i = 0; i < totalNpcs; i++) {
        const n = npcs[i];
        if (n && n.id) npcMap.set(n.id, n);
    }

    // ── 【高速化②】重いlocalStorageのパースをループ外に追い出す ──
    let countryKey = "jp";
    try {
        const rawData = localStorage.getItem("poligame_data");
        if (rawData) {
            countryKey = JSON.parse(rawData).countrySelect || "jp";
        }
    } catch (e) {
        console.error("localStorageの読み込みに失敗しました:", e);
    }
    const currentCountryData = typeof country !== 'undefined' ? country[countryKey] : null;

    // 思想の距離（絶対値の合計）を計算するヘルパー関数
    const getArray = (obj) => {
        const ideo = obj?.ideology;
        if (Array.isArray(ideo)) return [Number(ideo[0] ?? 50), Number(ideo[1] ?? 50), Number(ideo[2] ?? 50)];
        if (typeof ideo === "number") return [ideo, ideo, ideo];
        return; // フォールバックを統一
    };

    // 生まれた赤ちゃんを一時的に格納する配列（無限ループ防止）
    const bornBabies = [];
    const iconStyles = ["adventurer", "avataaars", "bottts", "lorelei"];

    for (let i = 0; i < totalNpcs; i++) {
        const npc = npcs[i];

        // 18歳未満、または年齢不明は即スキップ
        if (!npc.age || npc.age < 18) continue;

        // ==========================================
        // 1. 【既婚者の処理】
        // ==========================================
        if (npc.spouse && npc.spouse !== null) {
            // 【劇的改善】find() を廃止し、MapからO(1)で配偶者を一瞬で取得！
            const spouse = npcMap.get(npc.spouse.id);

            if (!spouse) {
                npc.spouse = null;
                continue;
            }

            // ID文字列の比較で2重処理を防止（ここは既存の良いロジックを継承）
            if (npc.id > spouse.id) continue;

            // ── 思想の不一致度を計算 ──
            const a = getArray(npc);
            const t = getArray(spouse);

            // 3つの要素それぞれの差分を合計
            const ideoDistance = Math.abs(a[0] - t[0]) +
                Math.abs(a[1] - t[1]) +
                Math.abs(a[2] - t[2]);

            let relationChange = 0;
            if (ideoDistance < 60) {
                relationChange = Math.floor(Math.random() * 3) + 1; // +1〜+3
            } else {
                relationChange = -(Math.floor(Math.random() * 3) + 1); // -1〜-3
            }

            changeRelation(npc.id, spouse.id, relationChange);
            const currentRelation = getRelation(npc.id, spouse.id);

            // ── 💔 離婚判定 ──
            if (currentRelation < 40) {
                if (!Array.isArray(npc.history)) npc.history = [];
                if (!Array.isArray(spouse.history)) spouse.history = [];

                npc.history.push(`${simulateYear}年: 配偶者の${spouse.name}と離婚。`);
                spouse.history.push(`${simulateYear}年: 配偶者の${npc.name}と離婚。`);

                npc.spouse = null;
                spouse.spouse = null;
                continue;
            }

            // ── 👶 子どもの誕生判定 ──
            if (npc.age <= 65 && spouse.age <= 65) {
                if (currentRelation >= 70 && Math.random() < 0.05) {

                    const babyIdeology = a.map((val, index) => {
                        const parentAverage = (val + t[index]) / 2;
                        const mutation = Math.floor(Math.random() * 21) - 10;
                        return Math.max(0, Math.min(100, Math.round(parentAverage + mutation)));
                    });

                    // 1. 親の名前から「苗字（Lastname）」を安全に取得
                    let parentLastName = "";
                    if (npc.lastname) {
                        parentLastName = npc.lastname;
                    } else {
                        const npcNameParts = npc.name.split(/[\s　・]+/);
                        parentLastName = (countryKey === "jp")
                            ? (npcNameParts[0] || "名無し")
                            : (npcNameParts[npcNameParts.length - 1] || "Name");
                    }

                    // 2. 子供の「ファーストネーム（名）」を完全ランダムに抽選
                    let babyFirstName = "Baby";
                    if (currentCountryData && Array.isArray(currentCountryData.firstnames)) {
                        babyFirstName = getRandomElement(currentCountryData.firstnames) || "Baby";
                    }

                    // 3. 文化圏に合わせてフルネームを安全に合成
                    const babyFullName = (countryKey === "jp")
                        ? `${parentLastName} ${babyFirstName}`
                        : `${babyFirstName} ${parentLastName}`;

                    const secretNpcId = "npc_" + Math.random().toString(36).substring(2, 11);
                    const kettei_ic = iconStyles[Math.floor(Math.random() * 4)];
                    const minAge = 70;
                    const maxAge = 120;
                    const maxAge2 = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;

                    const baby = {
                        id: secretNpcId,
                        name: babyFullName,
                        icon: `https://api.dicebear.com/10.x/${kettei_ic}/svg?seed=npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        age: 0,
                        money: 0,
                        maxage: maxAge2,
                        city: npc.city,
                        pref: npc.pref,
                        background_history: true,
                        spouse: null,
                        ideology: babyIdeology,
                        history: [
                            `${simulateYear}年: ${npc.name}と${spouse.name}の間に子どもとして生まれる。`,
                            `${simulateYear}年: ${npc.pref}${npc.city}にて生まれる。`
                        ]
                    };

                    bornBabies.push(baby);
                    changeRelation(npc.id, baby.id, 100);
                    changeRelation(spouse.id, baby.id, 100);

                    if (!Array.isArray(npc.history)) npc.history = [];
                    if (!Array.isArray(spouse.history)) spouse.history = [];
                    npc.history.push(`${simulateYear}年: 子どもである${baby.name}が誕生。`);
                    spouse.history.push(`${simulateYear}年: 子どもである${baby.name}が誕生。`);
                }
            }
            continue;
        }

        // ==========================================
        // 2. 【独身者の処理】
        // ==========================================
        if (npc.spouse) continue;
        if (Math.random() < 0.50) continue;

        tryMarriageSystem(npc, npcs, simulateYear);
    }

    // ループ終了後に赤ちゃんを一括追加
    if (bornBabies.length > 0) {
        npcs.push(...bornBabies);
    }
}





/**
 * 💡 1. まっさらなNPCに「年齢に見合った過去の歴史」をでっち上げる関数
 */function generatePrestory(npc, currentYear) {
    return;
    const randomarea = () => {
        const countryKey = localStorage.getItem("poligame_data")
            ? JSON.parse(localStorage.getItem("poligame_data")).countrySelect || "jp"
            : "jp";
        const currentCountryData = country[countryKey];

        let selectedPref = "首都圏";
        let selectedCity = "";

        if (currentCountryData && currentCountryData.pref) {
            const prefKeys = Object.keys(currentCountryData.pref);

            if (prefKeys.length > 0) {
                // 重み（人口）付きで州/県を選出
                let totalPop = 0;
                prefKeys.forEach(k => totalPop += currentCountryData.pref[k].pop || 1);

                let roll = Math.floor(Math.random() * totalPop);
                for (let k of prefKeys) {
                    roll -= (currentCountryData.pref[k].pop || 1);
                    if (roll < 0) {
                        selectedPref = k;
                        break;
                    }
                }

                // 選ばれた州/県の中からさらに都市（city）をランダム選出
                const prefData = currentCountryData.pref[selectedPref];
                if (prefData && Array.isArray(prefData.cities) && prefData.cities.length > 0) {
                    selectedCity = prefData.cities[Math.floor(Math.random() * prefData.cities.length)];
                }
            }
        }
        // 都市名があれば「〇〇州の〇〇」、なければ「〇〇州」だけを返す
        return selectedCity ? `${selectedPref}の${selectedCity}` : selectedPref;
    };

    const birthYear = currentYear - npc.age;
    const birthland = randomarea();
    // ① 誕生の記録
    npc.history.push(`${birthYear}年: ${birthland}にて生まれる。`);

    // ② 子供時代（6歳〜15歳）の履歴（現在6歳以上のNPCのみ）
    if (npc.age >= 7) {
        const schoolland = randomarea();
        const schoolRoll = Math.random();
        if (schoolRoll < 0.6) {
            npc.history.push(`${birthYear + 6}年: ${schoolland}の公立小学校に入学。`);
        } else if (schoolRoll < 0.9) {
            npc.history.push(`${birthYear + 6}年: ${schoolland}の私立小学校に入学。`);
        }
    }

    // ③ 小学校の卒業と「中学校への進学」ルート（現在12歳以上）
    let attendedJuniorHigh = false; // 中学校に進学したかどうかの判定フラグ
    const schoolland = randomarea();

    if (npc.age >= 13) {
        const lastEvent = npc.history[npc.history.length - 1] || "";

        if (lastEvent.includes("小学校に入学")) {
            // 🏫 ちゃんと小学校に通っていたエリート・一般ルート
            const typeStr = lastEvent.includes("公立") ? "公立" : "私立";
            npc.history.push(`${birthYear + 12}年: ${typeStr}小学校を卒業。`);

            // そのまま中学校へ進学（8割はストレート進学、2割は家庭の事情で闇ルートへ）
            if (Math.random() < 0.85) {
                const jhsRoll = Math.random();
                const jhsType = jhsRoll < 0.7 ? "公立中学校" : "私立中学校"; // 世界観に合わせたカッコいい学校名もOK！
                npc.history.push(`${birthYear + 12}年: ${schoolland}の${jhsType}に入学。`);
                attendedJuniorHigh = true;
            }
        }

        // 🖤 小学校に行っていない、または中学校に進学できなかった場合の「不遇の12歳イベント」
        if (!attendedJuniorHigh) {
            const darkChildEvents = [
                { text: "孤児院に引き取られる。" },
                { text: "少年院に引き取られる。" },
                { text: "家族との喧嘩で家出する。" },
                { text: `${schoolland}に送られ、過酷な労働に耐える日々が始まる。` },
                { text: `${schoolland}で農業の手伝いを本格化させる。` },
                { text: "家族が警察に逮捕され、天涯孤独の身となり家出する。" },
                { text: `${schoolland}へ一人で引っ越す。` },
                { text: "家族が借金を抱えて夜逃げし、都会の片隅に隠れ住む。" }
            ];

            const selected = darkChildEvents[Math.floor(Math.random() * darkChildEvents.length)];
            const fluctuation = Math.floor(Math.random() * 4) - 1; // -1, 0, 1, 2 の揺らぎ
            const finalOffset = 12 + fluctuation;

            npc.history.push(`${birthYear + finalOffset}年: ${selected.text}`);
        }
    }

    // 🎓 ④ 【新設】中学校の卒業イベント（現在15歳以上、中学校に行った人限定！）
    if (npc.age >= 16 && attendedJuniorHigh) {
        const lastJhsEvent = npc.history[npc.history.length - 1] || "";

        if (lastJhsEvent.includes("公立中学校")) {
            npc.history.push(`${birthYear + 15}年: 公立中学校を卒業。`);
        } else if (lastJhsEvent.includes("私立中学校") || lastJhsEvent.includes("私立")) {
            npc.history.push(`${birthYear + 15}年: 私立中学校を卒業。`);
        }

        let attendedHighSchool = false;

        // 🏫 中学を出たら、9割は高校に進学する
        if (Math.random() < 0.90) {
            const hsRoll = Math.random();
            const hsType = hsRoll < 0.7 ? "公立高校" : "私立高校";
            npc.history.push(`${birthYear + 15}年: ${schoolland}の${hsType}に入学。`);
            attendedHighSchool = true;
        } else {
            const darkChildEvents = [
                { text: "家庭が貧乏で高校には進学しない。" },
                { text: "働くために高校には進学しない。" },
                { text: "高校には進学しない。" },
                { text: `親の事情で高校には進学しない。` }
            ];

            const selected = darkChildEvents[Math.floor(Math.random() * darkChildEvents.length)];

            npc.history.push(`${birthYear + 15}年: ${selected.text}`);
        }


        // 🏛️ ⑤ 【新設】高校卒業と「運命の大学受験（浪人あり）」ルート（現在22歳以上）
        if (npc.age >= 23 && attendedHighSchool) {
            const daigakuland = randomarea();
            npc.history.push(`${birthYear + 18}年: 3年間の高校生活を終え、高校を卒業。`);

            const univRoll = Math.random();

            if (univRoll < 0.40) {
                // 📝 パターン1：現役合格エリート（40%）
                const rankRoll = Math.random();
                const univName = rankRoll < 0.3 ? "国立大学" : "私立大学";
                npc.history.push(`${birthYear + 18}年: ${daigakuland}の${univName}に合格。`);
                npc.history.push(`${birthYear + 22}年: ${univName}を卒業。`);
            }
        }
    }    // NPCの「本来の最終年齢」を、ループの上限用に変数に避難させておく
    const finalAge = npc.age;
    const birthYear2 = currentYear - finalAge;

    for (let age = 20; age <= finalAge; age++) {
        if (npc.spouse) break;

        const simulateYear = birthYear2 + age;

        npc.age = age;

        tryMarriageSystem(npc, npcs, simulateYear);
    }

    npc.age = finalAge;

    // 全てのシミュレーションが終わったら、最後に本来の最終年齢（31歳など）に戻してあげる



    // ⑥ 【一般NPCのみ】中年〜それ以降（30歳以上、10年おきにランダムで何かが起きる）
    if (npc.age >= 25) {
        if (npc.rep || npc.sen) return;
        for (let ageAnchor = 25; ageAnchor <= npc.age - 5; ageAnchor += 10) {
            const theland = randomarea();

            const midEvents = [
                "中小企業に入社。",
                `${theland}に派遣される。`,
                `軍隊に入隊。`,
                `${npc.pref}にてビジネスを始める。`,
                `${theland}刑務所に投獄される。`,
                "大企業に入社。",
                "地元の大企業に入社。",
                `${theland}のバス運転手として働く。`,
                `${theland}のタクシー運転手として働く。`,
                `${theland}の車掌として働く。`,
                `${theland}の酒場にて働く。`,
                `${theland}の農場にて働く。`,
                `${theland}の工場にて働く。`,
                `${theland}の事務所にて働く。`,
                `${theland}の公務員として働く。`,
                `${theland}の警察官として働く。`,
                `${theland}の官僚として働く。`,
                `${theland}の科学者として働く。`,
                `${theland}の研究者として働く。`,
                `${theland}の宗教家として働く。`,
                `${theland}の秘書として働く。`,

            ];

            const text = midEvents[Math.floor(Math.random() * midEvents.length)];

            npc.history.push(`${birthYear + ageAnchor}年: ${text}`);
        }
    }

    npc.background_history = true;
}

/**
 * 💡 改修版：フラグ不要！何度起きても現実的な汎用イベント関数
 */
function processYearlyEvent(npc, currentYear) {
    const randomarea = () => {
        const countryKey = localStorage.getItem("poligame_data")
            ? JSON.parse(localStorage.getItem("poligame_data")).countrySelect || "jp"
            : "jp";
        const currentCountryData = country[countryKey];

        let selectedPref = "首都圏";
        let selectedCity = "";

        if (currentCountryData && currentCountryData.pref) {
            const prefKeys = Object.keys(currentCountryData.pref);

            if (prefKeys.length > 0) {
                let totalPop = 0;
                prefKeys.forEach(k => totalPop += currentCountryData.pref[k].pop || 1);

                let roll = Math.floor(Math.random() * totalPop);
                for (let k of prefKeys) {
                    roll -= (currentCountryData.pref[k].pop || 1);
                    if (roll < 0) {
                        selectedPref = k;
                        break;
                    }
                }

                const prefData = currentCountryData.pref[selectedPref];
                if (prefData && Array.isArray(prefData.cities) && prefData.cities.length > 0) {
                    selectedCity = prefData.cities[Math.floor(Math.random() * prefData.cities.length)];
                }
            }
        }
        return selectedCity ? `${selectedPref}の${selectedCity}` : selectedPref;
    };

    // ========================================================
    // ⚡ 修正ポイント1: 確率を大人の事情で「5%」にガッツリ下げる
    // ========================================================
    // Math.random() < 0.05 にすることで、20年に1回レベルの「本当にたまにある日常」にします。
    if (Math.random() >= 0.05) return;

    const theland = randomarea();
    let eventPool = [];

    // 【子供（0〜14歳）のイベント】
    if (npc.age <= 5) {
        eventPool = [
            "新しい言葉を学んだ。",
            "雨にさらされ、高熱を出す。",
            "風邪の悪化で入院する。",
            "新しい知識を学んだ。",
            `ベビーカーに乗って${theland}へ旅行した。`,
            `${theland}の旅行中に迷子になる。`,
            `重度の高熱を出し入院する。`,
            "高い場所からの落下で入院する。",
        ];
    } else if (npc.age <= 12) {
        eventPool = [
            `近所の子供と遊んだ。`,
            `地元のイベントに参加した。`,
            `学校の宿題を忘れて先生に怒られた。`,
            `学校で居眠りをして怒られた。`,
            `学校で新しい友達ができた。`,
            `学校のテストで100点を取った。`,
            `学校のテストでまあまあな点を取った。`,
            `学校のテストで0点を取った。`
        ];
    }
    // ========================================================
    // ⚡ 修正ポイント2: 連続被り防止セーフティ
    // ========================================================
    // 直前の歴史（historyの最後の要素）を取得し、同じイベント内容ならスキップしてログを汚さない
    let selectedText = eventPool[Math.floor(Math.random() * eventPool.length)];

    if (npc.history && npc.history.length > 0) {
        const lastLog = npc.history[npc.history.length - 1];
        // ログテキストだけを比較するため、何回か抽選し直すか、被ったら今年はイベントなしにする
        if (lastLog.includes(selectedText)) {
            return; // 2年連続でギックリ腰になったりテスト0点になったりするのを防ぐ
        }
    }

    // 履歴配列がない場合のセーフティ
    if (!npc.history) npc.history = [];
    if (selectedText) npc.history.push(`${currentYear}年: ${selectedText}`);
}



async function openActionSelectModal(targetNpc) {
    let html = `
        <div style="font-size: 14px; color: #e2e8f0;">
            <p style="margin-bottom: 12px; color: #cbd5e0;">
                👤対象: <strong>${targetNpc.name}</strong> （拠点: ${targetNpc.city}）
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px;" id="actionButtonListContainer">
    `;

    // 登録されている定義からボタンを自動ループ生成（これがやりたかった！）
    Object.keys(POLITICAL_ACTIONS).forEach(key => {
        const act = POLITICAL_ACTIONS[key];
        if (typeof act.mode !== 'undefined' && act.mode !== mode) return;
        const costText = act.cost > 0 ? ` (経費:${act.cost.toLocaleString()}円)` : " (経費:0円)";

        html += `
            <button class="pol-action-trigger-btn" data-action-key="${key}" style="
                background: #2d3748; color: #fff; border: 1px solid #4a5568; border-radius: 5px;
                padding: 12px; font-weight: bold; font-size: 13px; text-align: left; cursor: pointer;
                transition: all 0.2s ease; display: flex; justify-content: space-between;
            " onmouseover="this.style.background='#344154'; this.style.transform='translateX(3px)'" onmouseout="this.style.background='#2d3748'; this.style.transform='none'">
                <span>${act.text}</span>
                <span style="color: #48bb78; font-size: 12px;">${costText}</span>
            </button>
        `;
    });

    html += `</div></div>`;

    // モーダルを展開
    showModal(`行動`, html, [
        {
            text: "↩️ プロフィールに戻る",
            className: "close-btn",
            keepOpen: true,
            callback: () => {
                npccardview(targetNpc); // プロフィールを再描画して戻る
            }
        }
    ]);

    // 生成されたボタンに一括で共通イベントをバインド
    setTimeout(() => {
        const container = document.getElementById("actionButtonListContainer");
        const actionBtns = container.querySelectorAll(".pol-action-trigger-btn");

        actionBtns.forEach(btn => {
            // 💡 コールバック関数の前に async を付与
            btn.addEventListener("click", async (e) => {
                const actionKey = e.currentTarget.getAttribute("data-action-key");

                // 👥 プレイヤー(player)がターゲット(targetNpc)に対して行動を実行！
                // 💡 dispatchPoliticalAction 自体が非同期(async)関数であるか、
                // または内部の execute を await している必要があるため、ここでも await を付与します
                const result = await dispatchPoliticalAction(actionKey, player, targetNpc, false);

                if (result) {
                    // 行動が完了したら、関係性の変化を反映したプロフィール画面に自動で戻る
                    npccardview(targetNpc);
                }
            });
        });
    }, 50);

}



// 【共通実行関数】1日1回の行動制限を追加！
async function dispatchPoliticalAction(actionKey, actor, target, isSilent = false) {
    const action = POLITICAL_ACTIONS[actionKey];
    if (!action) return false;

    // 🚨 【追加】1日1回制限のチェック（今日すでに行動しているか？）
    // ※ 日付管理システム（例: currentDay）があればそれと比較、なければ簡易フラグ
    if (target.hasActedToday === currentTurn) {
        if (!isSilent && actor.id === player.id) {
            alert("❌ 本日、この人とは会話しました\n（次の日に進めてください）");
        }
        return false;
    }

    // 資金チェック
    if (actor.money < action.cost) {
        if (!isSilent && actor.id === player.id) alert("❌ 資金が足りません！");
        return false;
    }

    // 行動の実行とログの取得
    const logMessage = action.execute(actor, target);

    // 🚨 【追加】行動した本人に行動済みフラグを立てる
    if (!isSilent) {
        target.hasActedToday = currentTurn;
    }

    if (!isSilent) {
        alert(logMessage);
    }
    return true;
}
// 💡 【使い回し用バッファ】関数の外で1回だけ配列を作っておく（メモリ確保をゼロに）
const __AFFORDABLE_KEYS_BUFFER = new Array(10);

function dailyNpcPoliticalAims() {
    const totalNpcs = npcs.length;
    if (!totalNpcs) return;

    // 1. アクションのキーを事前に取得
    const ACTION_KEYS = Object.keys(POLITICAL_ACTIONS).filter(
        key => key !== "askpresident_run"
    );
    const ACTION_COUNT = ACTION_KEYS.length;
    const dinnerCost = POLITICAL_ACTIONS["dinner"]?.cost ?? Infinity;
    const meetingCost = POLITICAL_ACTIONS["meeting"]?.cost ?? Infinity;

    // 2. 街ごとにNPCをグループ化（配列の生成を最小限に）
    const cityGroups = {};
    const pId = player ? player.id : null;

    for (let i = 0; i < totalNpcs; i++) {
        const npc = npcs[i];
        if (!npc || npc.age <= 18 || !npc.isNPC || npc.id === pId) continue;

        // 💡 街の配列がなければ作成
        if (!cityGroups[npc.city]) {
            cityGroups[npc.city] = [];
        }
        cityGroups[npc.city].push(npc);
    }

    // 3. 街ごとにループ処理（Object.keysを使わず for...in で高速化）
    for (const city in cityGroups) {
        const localNpcs = cityGroups[city];
        const localLen = localNpcs.length;
        if (localLen < 2) continue; // 自分以外にNPCがいない街はスキップ

        for (let i = 0; i < localLen; i++) {
            const actor = localNpcs[i];

            // ⚡ 【確率判定】ここで約80%のNPCの処理を瞬時にスキップ
            if (Math.random() > 0.20) continue;

            const actorMoney = actor.money;

            // ⚡ 実行可能なアクションをバッファに詰める
            let affordableCount = 0;
            for (let a = 0; a < ACTION_COUNT; a++) {
                const key = ACTION_KEYS[a];
                if (actorMoney >= POLITICAL_ACTIONS[key].cost) {
                    __AFFORDABLE_KEYS_BUFFER[affordableCount++] = key;
                }
            }
            if (affordableCount === 0) continue;

            // ⚡ 対象（ターゲット）をランダムに決定（ビット演算で高速化）
            let targetIdx = (Math.random() * localLen) | 0;
            if (localNpcs[targetIdx].id === actor.id) {
                targetIdx = (targetIdx + 1) % localLen;
            }
            const target = localNpcs[targetIdx];

            // デフォルトのアクションを決定
            let chosenActionKey = __AFFORDABLE_KEYS_BUFFER[(Math.random() * affordableCount) | 0];

            // 同じ政党だった場合の特別処理
            if (actor.partyId !== null && actor.partyId === target.partyId) {
                if (actorMoney >= dinnerCost && Math.random() < 0.6) {
                    chosenActionKey = "dinner";
                } else if (actorMoney >= meetingCost) {
                    chosenActionKey = "meeting";
                }
            }

            // アクションを実行
            dispatchPoliticalAction(chosenActionKey, actor, target, true);
        }
    }
}


// 💡 ゲーム進行（Turn）を完全にブロックする通知の数をカウントするグローバルフラグ
let activeBlockTurnNotificationCount = 0;

/**
 * 📱 iPhone風の通知トレイ（バナー）を右上に飛ばす
 * @param {string} title - 通知のヘッダータイトル（例: "🏛️ 全国改革党"）
 * @param {string} message - 通知の本文（例: "静岡派閥が拡大しました。タップして詳細を確認"）
 * @param {object} modalConfig - タップした時に showModal に渡すデータ
 * @param {boolean} blockTurn - trueにすると、この通知を処理（タップ）するまで次のターンに進めなくなります
 */

async function pushNotificationTray(title, message, modalConfig = { title: "", body: "", buttons: [] }, blockTurn = false) {
    const container = document.getElementById("notificationTrayContainer");
    if (!container) return;

    // 2. 通知バナーのDOM要素を作成
    const banner = document.createElement("div");

    // 💡 識別用クラスを明確に付与！
    if (blockTurn) {
        banner.className = "block-notice"; // 🚨 進行ブロック用クラス
    } else {
        banner.className = "normal-notice"; // 💬 通常通知用クラス
    }

    // 🎨 iPhone風の高級感あるダーク硝子・デザインスタイル
    banner.style.width = "100%";
    banner.style.padding = "12px 14px";
    banner.style.background = blockTurn ? "rgba(229, 62, 62, 0.95)" : "rgba(45, 55, 72, 0.95)";
    banner.style.color = "#fff";
    banner.style.borderRadius = "12px";
    banner.style.boxShadow = "0 10px 25px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)";
    banner.style.backdropFilter = "blur(8px)";
    banner.style.cursor = "pointer";
    banner.style.pointerEvents = "auto";
    banner.style.transform = "translateX(400px)";
    banner.style.opacity = "0";
    banner.style.transition = "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    banner.style.border = blockTurn ? "1px solid #feb2b2" : "1px solid #4a5568";

    // 3. 中身のHTML
    banner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: bold; font-size: 13px; color: ${blockTurn ? '#fff' : '#63b3ed'}; display: flex; align-items: center; gap: 6px;">
                ${blockTurn ? '🚨' : '💬'} ${title}
            </span>
            <span style="font-size: 10px; color: rgba(255,255,255,0.6);">今</span>
        </div>
        <div style="font-size: 12px; line-height: 1.4; color: #edf2f7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${message}
        </div>
        ${blockTurn ? '<div style="font-size: 9px; color: #feb2b2; margin-top: 4px; font-weight: bold; text-align: right;">⚠️ タップして処理するまで進行不可</div>' : ''}
    `;

    // 消去用のアニメーション関数
    const removeBanner = () => {
        banner.style.transform = "translateX(400px)";
        banner.style.opacity = "0";
        setTimeout(() => {
            banner.remove();
        }, 300);
    };

    // 4. タップ（クリック）した時のイベント
    banner.addEventListener("click", () => {
        showModal(modalConfig.title, modalConfig.body, modalConfig.buttons);
        removeBanner(); // 自分だけを消去
    });

    // 5. コンテナに追加して登場
    container.appendChild(banner);
    setTimeout(() => {
        banner.style.transform = "translateX(0)";
        banner.style.opacity = "1";
    }, 20);

    // 通常通知は5秒後に自動消去
    if (!blockTurn) {
        setTimeout(() => {
            if (banner.parentNode) {
                removeBanner();
            }
        }, 5000);
    }
}