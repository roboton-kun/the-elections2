const npcRelations = new Map();

// 関係性を取得するヘルパー関数（A-B でも B-A でも同じ値を返す）
// 関係性を取得する（存在しないなら保存はせず、単に 0 を返す）
function getRelation(id1, id2) {
    const key = id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
    const value = npcRelations.get(key);
    return value !== undefined ? value : 0;
}

// 関係性を更新する（実際に変動があった時だけ Map に保存する）
function changeRelation(id1, id2, amount) {
    const key = id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
    const current = getRelation(id1, id2); // ここは単に数値が返ってくる
    const newValue = Math.max(-100, Math.min(100, current + amount));
    npcRelations.set(key, newValue);
}
