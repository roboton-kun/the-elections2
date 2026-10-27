// 1. スキャンダルごとの重要度（ベースペナルティ）と、フェーズ別テキストの定義
const SCANDAL_DATABASE = {
    // 【無難かつ致命的】政府の不正契約・裏金疑惑
    GOVERNMENT_CORRUPTION: {
        name: "政府の腐敗疑惑",
        baseSeverity: 1.2, // ペナルティの倍率（重要度：高）
        phases: {
            1: `${president.name}大統領は`,
            2: "【隠蔽】大統領が捜査機関のトップを突然更迭。「トカゲの尻尾切り」と世論の猛反発を招く。",
            3: "【証拠】側近が「すべて大統領の指示だった」と検察に自白。決定的な内部音声がリークされる。",
            4: "【破滅】大統領本人の署名入り裏金帳簿が発見される。全土で辞任を求める大規模デモが発生。"
        }
    },
    // 【ややマイルド】経歴詐称・不適切な交際・身内びいき
    NEPOTISM_NEPOTISM: {
        name: "親族の要職登用・公私混同問題",
        baseSeverity: 0.8, // ペナルティの倍率（重要度：中）
        phases: {
            1: "【疑惑】大統領の実子が、何の経験もないまま国家の重要プロジェクトの最高顧問に就任。",
            2: "【隠蔽】批判的なメディアを大統領が「偽ニュース」と指弾し、記者会見から締め出す。",
            3: "【証拠】その親族が国家予算を個人的な豪華バカンスに流用していた公文書が流出。",
            4: "【破滅】議会で身内びいきを禁止する法律が可決。与党内からも「身勝手すぎる」と批判が集中。"
        }
    }
};

// 2. スキャンダルペナルティとテキストを動的に取得する関数
const getScandalStatus = (scandalKey, phase) => {
    const scandal = SCANDAL_DATABASE[scandalKey];

    // スキャンダルが指定されていない、またはフェーズが0（平時）ならペナルティなし
    if (!scandal || !phase || phase === 0) {
        return { penalty: 0, text: "政権の運営は概ね安定しています。" };
    }

    // 各フェーズの基礎マイナス値
    const basePoints = { 1: -5, 2: -12, 3: -22, 4: -35 };
    const currentBase = basePoints[phase] || 0;

    // 重要度（倍率）を掛け合わせて、最終的なペナルティptを算出
    const finalPenalty = Math.round(currentBase * scandal.baseSeverity);

    // フェーズに応じたテキストを取得
    const phaseText = scandal.phases[phase] || "事態は深刻化しています。";

    return {
        scandalName: scandal.name,
        penalty: finalPenalty, // これをそのまま大統領支持率関数の scandalPenalty に渡す！
        text: phaseText
    };
};
