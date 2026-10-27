function getIdeologyName(statusArray) {
    // 配列から順番に数字を取り出す（中身がなければ50にする）
    const econ = statusArray[0] !== undefined ? statusArray[0] : 50;
    const nation = statusArray[1] !== undefined ? statusArray[1] : 50;
    const diplomacy = statusArray[2] !== undefined ? statusArray[2] : 50;

    let ideologyName = "中道主義";


    // 1. 国家の統制・自由が極端な場合の判定（縦軸の過激派）
    if (nation > 85) {
        // 国家の権力が最強で、さらに自国第一なら
        if (diplomacy > 80) return "ファシズム";
        return "権威主義";
    }
    if (nation < 15) {
        return "アナーキズム";
    }

    // 2. 経済が極端な場合の判定（横軸の過激派）
    if (econ < 25) {
        return "共産主義";
    }
    if (econ > 85 && nation < 40) {
        return "自由主義";
    }

    // 3. 穏健な組み合わせの判定
    // 経済は左（福祉）だけど、国家は自由（民主）
    if (econ < 45 && nation < 50) {
        return "社会民主主義";
    }
    // 国家は秩序（伝統）で、外交も自国第一
    if (nation > 60 && diplomacy > 60) {
        return "保守主義";
    }
    // 伝統や君主の秩序を重んじる（外交がそこまで過激じゃない保守）
    if (nation > 65 && diplomacy <= 60) {
        return "君主主義";
    }

    if (nation > 60 && econ > 55) return "社会保守主義";

    if (nation < 20 && econ > 50) return "進歩主義";

    if (econ > 80 && nation < 20) return "無政府資本主義";

    if (econ < 40 && diplomacy > 70) return "環境主義";

    if (nation > 70 && diplomacy > 75) return "神権主義";

    if (econ < 45 && nation > 45 && nation < 55) return "ポピュリズム";

    // 4. 中央付近
    if (econ === 50 && nation === 50 && diplomacy === 50) {
        return "中道主義";
    }

    return ideologyName; // 判定した名前を外に返す！
}