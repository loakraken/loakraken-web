// Local synthetic backend only. This process never accesses Lost Ark.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const failures = new Map();
const receiptCalls = new Map();

const read = (name) =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
  );
const counts = {};

// Synthetic accessory, bracelet and stone for the simulator screen (web #365
// follow-up): polish/bracelet lines with tooltip grades and stone engravings.
/** The spec-up sample's own gains, so "적용해 보기" shows the same number as its row. */
const specUpDelta = (change) =>
  change.kind === "GEM_LEVEL" && change.slot === 1
    ? { 9: 24, 10: 48.07 }[change.level] ?? null
    : change.kind === "EQUIPMENT_QUALITY" && change.index === 0 && change.quality === 100
      ? 90.33
      : null;

/** The synthetic glove: an armour quality change the backend scores as ±0. */
const armourQuality = (search, change) =>
  change.kind === "EQUIPMENT_QUALITY" && search.loadout.equipment[change.index]?.type === "장갑";

function withSimulatorGear(data) {
  const base = data.loadout.equipment.find((item) => item.detail);
  // Advanced refining on the armour piece (search advancedRefineLevel, backend #234).
  base.detail = { ...base.detail, advancedRefineLevel: 10 };
  // Matches the backend spec-up sample (#318): a weapon at quality 90 and a
  // second gem at level 8 in slot 1, so every sample candidate applies.
  const weapon = data.loadout.equipment.find((item) => item.type === "무기");
  if (weapon)
    weapon.detail = {
      ...base.detail,
      advancedRefineLevel: null,
      effects: [],
      stoneEngravings: [],
      polishEffects: [],
      braceletEffects: [],
      ...(weapon.detail ?? {}),
      refineLevel: 20,
      quality: 90,
    };
  const gems = data.loadout.gems?.items;
  if (gems?.length === 1) gems.push({ ...gems[0], slot: 1, level: 8, name: "테스트 보석 2" });
  const make = (type, name, detail) => ({
    ...base,
    type,
    name,
    detail: { ...base.detail, refineLevel: null, advancedRefineLevel: null, quality: null, effects: [], stoneEngravings: [], polishEffects: [], braceletEffects: [], ...detail },
  });
  data.loadout.equipment.push(
    make("목걸이", "테스트 목걸이", {
      quality: 90,
      polishEffects: [
        { name: "추가 피해", value: "+1.60%", grade: "MID" },
        { name: "적에게 주는 피해", value: "+0.55%", grade: "LOW" },
      ],
    }),
    make("팔찌", "테스트 팔찌", {
      braceletEffects: [
        { text: "특화 +100", grade: null },
        { text: "치명타 피해 +6.80%", grade: "MID" },
      ],
    }),
    // 방어구 품질은 생명 활성력만 올려 딜러 전투력이 그대로(계산 검증 10-12): ±0과 이유.
    make("장갑", "테스트 장갑", { refineLevel: 18, quality: 95 }),
    // 전율 armour: no advanced refining at all (backend refine model, PM-프론트 P1).
    make("상의", "+20 전율의 상의", { refineLevel: 20, quality: 95, advancedRefineLevel: 0 }),
    // 팔 보호구(backend #342): type "완갑", step = refineLevel, grade on the item.
    { ...make("완갑", "+13 전율 완갑", { refineLevel: 13 }), grade: "유물" },
    make("어빌리티 스톤", "테스트 스톤", {
      stoneEngravings: [
        { name: "원한", level: 1 },
        { name: "공격력 감소", level: 0 },
      ],
    }),
  );
  return data;
}
const marketRead = (name) =>
  JSON.parse(
    readFileSync(new URL(`./market-fixtures/${name}`, import.meta.url), "utf8"),
  );

// Synthetic market catalogue. Special ids exercise every non-priced status.
const catalogue = [
  { id: 101, name: "합성 재련 재료", grade: "희귀", bundleCount: 100, price: 12 },
  { id: 102, name: "합성 상급 재료", grade: "영웅", bundleCount: 10, price: 37.5 },
  { id: 103, name: "합성 파편 주머니", grade: "전설", bundleCount: 1, price: 520 },
  { id: 9001, name: "합성 페이지 이동 재료", grade: "희귀", bundleCount: 100, price: 10, status: "ITEM_NOT_IN_PAGE" },
  { id: 9002, name: "합성 거래 제한 재료", grade: "영웅", bundleCount: 1, price: 99, status: "TRADE_RESTRICTED_ITEM" },
  { id: 9003, name: "합성 가격 없음 재료", grade: "일반", bundleCount: 10, price: null, status: "PRICE_UNAVAILABLE" },
  { id: 9004, name: "합성 영골드 재료", grade: "일반", bundleCount: 10, price: 0, status: "ZERO_PRICE" },
];
const nowIso = () => new Date().toISOString();
const criteria = (url) => ({
  categoryCode: Number(url.searchParams.get("categoryCode")),
  characterClass: "",
  itemTier: null,
  itemGrade: "",
  itemName: url.searchParams.get("itemName") ?? "",
  pageNo: Number(url.searchParams.get("pageNo") ?? 1),
  sort: url.searchParams.get("sort") ?? "RECENT_PRICE",
  sortCondition: url.searchParams.get("sortCondition") ?? "ASC",
});
async function market(url, req, send) {
  const key = `market:${url.pathname}`;
  counts[key] = (counts[key] || 0) + 1;
  // Market board (B-5): synthetic, deterministic prices per item id.
  if (url.pathname === "/api/v1/markets/tabs")
    return send(marketRead("market-tabs.json"));
  const boardItems = (tab) => {
    const refining = [
      [6861012, "아비도스 융화 재료", "희귀", 1, 195],
      [6861013, "상급 아비도스 융화 재료", "영웅", 1, 256],
      [66102006, "운명의 파괴석", "희귀", 100, 171],
      [66102007, "운명의 파괴석 결정", "영웅", 100, 889],
      [66102106, "운명의 수호석", "희귀", 100, 31],
      [66102107, "운명의 수호석 결정", "영웅", 100, 191],
      [66110225, "운명의 돌파석", "영웅", 1, 6],
      [66110226, "위대한 운명의 돌파석", "전설", 1, 34],
      [66130141, "운명의 파편 주머니(소)", "희귀", 1, 79],
      [66130142, "운명의 파편 주머니(중)", "영웅", 1, 197],
      [66130143, "운명의 파편 주머니(대)", "전설", 1, 231],
    ];
    const list = tab === "REFINING" ? refining : Array.from({ length: tab === "ENGRAVING_BOOK" ? 23 : 13 }, (_, i) => [7000000 + i * 7 + tab.length, `합성 ${tab} 품목 ${i + 1}`, ["일반", "고급", "희귀", "영웅", "전설", "유물"][i % 6], i % 3 ? 1 : 10, 20 + ((i * 37) % 400)]);
    return list.map(([itemId, name, grade, bundleCount, base]) => {
      const wobble = ((itemId % 23) - 11) / 100;
      const yesterday = base * (1 - wobble / 2);
      const current = Math.round(base * 10) / 10;
      const days = Array.from({ length: 7 }, (_, d) => ({ date: new Date(Date.now() - (7 - d) * 86400000).toISOString().slice(0, 10), averagePrice: Math.round(base * (1 + Math.sin(itemId + d) * 0.05) * 10) / 10 }));
      return { itemId, name, icon: null, grade, bundleCount, tradeRemainCount: null, currentMinPrice: current, recentPrice: current, yesterdayAvgPrice: Math.round(yesterday * 10) / 10, changeDay: Math.round((current / yesterday - 1) * 1000) / 10, changeWeek: Math.round(wobble * 700) / 10, spark7: days, historyAvailable: true };
    });
  };
  if (url.pathname === "/api/v1/markets/board") {
    const tab = url.searchParams.get("tab");
    const tabs = marketRead("market-tabs.json").data.tabs;
    const def = tabs.find((t) => t.tab === tab);
    if (!def) return send({ code: "INVALID_REQUEST" }, 400);
    const sort = url.searchParams.get("sort") ?? "default";
    const page = Number(url.searchParams.get("page") ?? 1);
    let items = boardItems(tab);
    if (sort === "high") items.sort((a, b) => b.currentMinPrice - a.currentMinPrice);
    if (sort === "low") items.sort((a, b) => a.currentMinPrice - b.currentMinPrice);
    if (sort === "rise") items.sort((a, b) => b.changeDay - a.changeDay);
    if (sort === "fall") items.sort((a, b) => a.changeDay - b.changeDay);
    const tier = url.searchParams.get("tier") ? Number(url.searchParams.get("tier")) : def.defaultTier;
    return send({ code: "MARKET_BOARD_SUCCESS", message: "성공", data: { ruleVersion: "market-board-v1", changeBasis: "changeDay = 현재 최저가 ÷ 전일 평균가 − 1 (합성 목 데이터)", tab, tabLabel: def.label, tier, sort, page, pageSize: 10, observedAt: new Date(Date.now() - 60000).toISOString(), totalItems: items.length, scannedItems: items.length, complete: true, items: items.slice((page - 1) * 10, page * 10) } });
  }
  const historyMatch = /^\/api\/v1\/markets\/items\/(\d+)\/history$/.exec(url.pathname);
  if (historyMatch) {
    const itemId = Number(historyMatch[1]);
    if (itemId === 404) return send({ code: "MARKET_ITEM_NOT_FOUND" }, 404);
    const base = 50 + (itemId % 400);
    const days = Array.from({ length: 14 }, (_, d) => ({ date: new Date(Date.now() - d * 86400000).toISOString().slice(0, 10), averagePrice: Math.round(base * (1 + Math.sin(itemId / 7 + d / 2) * 0.08) * 10) / 10, tradeCount: Math.round(80000 + 60000 * Math.abs(Math.cos(itemId + d))), partial: d === 0 }));
    return send({ code: "MARKET_ITEM_HISTORY_SUCCESS", message: "성공", data: { itemId, observedAt: new Date(Date.now() - 120000).toISOString(), baseDate: days[0].date, variants: [{ name: "합성 품목", tradeRemainCount: null, bundleCount: 1, days, summary: { latestDate: days[1].date, latestAveragePrice: days[1].averagePrice, previousAveragePrice: days[2].averagePrice, dayChangeRate: 1.2, sevenDayDays: 7, sevenDayAveragePrice: base, sevenDayChangeRate: 0.4, sevenDayTradeCount: 700000 } }] } });
  }
  if (url.pathname === "/api/v1/markets/options")
    return send(marketRead("market-options.json"));
  if (url.pathname === "/api/v1/markets/items") {
    const name = url.searchParams.get("itemName") ?? "";
    if (name === "제한")
      return send({ code: "LOST_ARK_RATE_LIMITED", message: "private" }, 429, { "Retry-After": "3" });
    if (name === "오류") return send({ code: "LOST_ARK_API_ERROR", message: "private" }, 502);
    const items = catalogue
      .filter((item) => !name || item.name.includes(name) || name === "합성")
      .map((item) => ({
        id: item.id,
        name: item.name,
        grade: item.grade,
        icon: null,
        bundleCount: item.bundleCount,
        tradeRemainCount: item.status === "TRADE_RESTRICTED_ITEM" ? 0 : null,
        yDayAvgPrice: item.price,
        recentPrice: item.price,
        currentMinPrice: item.price,
      }));
    return send({
      code: "MARKET_SEARCH_SUCCESS",
      message: "성공",
      data: {
        source: "ACTIVE_LISTING",
        observedAt: nowIso(),
        windowFrom: null,
        windowTo: null,
        search: criteria(url),
        pageNo: 1,
        pageSize: 10,
        totalCount: items.length,
        items,
      },
    });
  }
  if (url.pathname === "/api/v1/markets/material-quotes" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    const observedAt = nowIso();
    const lines = request.items.map((input) => {
      const item = catalogue.find((entry) => entry.id === input.itemId);
      const missing = Math.max(0, input.requiredQuantity - input.ownedQuantity);
      const base = {
        itemId: input.itemId,
        requiredQuantity: input.requiredQuantity,
        ownedQuantity: input.ownedQuantity,
        missingQuantity: missing,
        search: { categoryCode: input.search.categoryCode, characterClass: "", itemTier: null, itemGrade: "", itemName: input.search.itemName, pageNo: input.search.pageNo, sort: "RECENT_PRICE", sortCondition: "ASC" },
      };
      if (missing === 0)
        return { ...base, status: "COVERED_BY_INVENTORY", observedAt: null, itemName: null, bundleCount: null, pricePerBundle: null, purchase: { bundleQuantity: 0, purchaseQuantity: 0, surplusQuantity: 0, costGold: 0 } };
      if (!item || item.status === "ITEM_NOT_IN_PAGE")
        return { ...base, status: "ITEM_NOT_IN_PAGE", observedAt, itemName: null, bundleCount: null, pricePerBundle: null, purchase: null };
      if (item.status)
        return { ...base, status: item.status, observedAt, itemName: item.name, bundleCount: item.bundleCount, pricePerBundle: item.price, purchase: null };
      const bundles = Math.ceil(missing / item.bundleCount);
      return { ...base, status: "PRICED", observedAt, itemName: item.name, bundleCount: item.bundleCount, pricePerBundle: item.price, purchase: { bundleQuantity: bundles, purchaseQuantity: bundles * item.bundleCount, surplusQuantity: bundles * item.bundleCount - missing, costGold: Math.round(bundles * item.price * 100) / 100 } };
    });
    const known = lines.reduce((sum, line) => sum + (line.purchase?.costGold ?? 0), 0);
    const complete = lines.every((line) => line.purchase !== null);
    return send({
      code: "MATERIAL_QUOTE_SUCCESS",
      message: "성공",
      data: { ruleVersion: "material-purchase-v1", priceBasis: request.priceBasis, source: "ACTIVE_LISTING", calculatedAt: nowIso(), complete, knownCostGold: known, totalCostGold: complete ? known : null, items: lines },
    });
  }
  if (url.pathname === "/api/v1/markets/material-prices" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    // Synthetic unit prices (not market data). 용암의 숨결 has no price for
    // the selected basis and books are bound, to exercise both statuses.
    const table = {
      "운명의 수호석": [100, 30],
      "운명의 파괴석": [100, 80],
      "운명의 돌파석": [1, 3],
      "아비도스 융화 재료": [1, 190],
      "빙하의 숨결": [1, 430],
      // 더보기 손익(은총의 파편 = 지평의 재련 재료 상자 구성 ÷ 60)용 결정 재료.
      "운명의 파괴석 결정": [100, 900],
      "운명의 수호석 결정": [100, 190],
      "위대한 운명의 돌파석": [1, 33],
      // 고통의 가시 최소 보장 가치(재료 상자 쪽 결과 중 하나).
      "운명의 파편 주머니(대)": [1, 232],
    };
    const observedAt = nowIso();
    const items = [...new Set(request.names.map((n) => n.trim()))].map((name) => {
      const empty = { name, unitPriceGold: null, sourceItemName: null, bundleCount: null, bundlePrice: null, contentsPerItem: null, observedAt };
      if (name === "운명의 파편")
        return { ...empty, status: "PRICED", unitPriceGold: 0.077333, sourceItemName: "운명의 파편 주머니(대)", bundleCount: 1, bundlePrice: 232, contentsPerItem: 3000 };
      if (name === "용암의 숨결") return { ...empty, status: "PRICE_UNAVAILABLE", sourceItemName: name, bundleCount: 1 };
      const row = table[name];
      if (!row) return { ...empty, status: "NOT_FOUND" };
      const [bundleCount, bundlePrice] = row;
      return { ...empty, status: "PRICED", unitPriceGold: Math.round((bundlePrice / bundleCount) * 1e6) / 1e6, sourceItemName: name, bundleCount, bundlePrice };
    });
    return send({ code: "MATERIAL_PRICE_SUCCESS", message: "성공", data: { priceBasis: request.priceBasis, items } });
  }
  return send({}, 404);
}
// Synthetic refining plan with the backend's response shape. Rates and costs
// are invented round numbers, not game data.
function refiningPlan(request) {
  const weapon = request.equipmentType === "WEAPON";
  const round = (v) => Math.round(v * 100) / 100;
  const stages = [];
  for (let target = request.fromStage + 1; target <= request.toStage; target++) {
    const rate = Math.max(300, 1500 - (target - 11) * 80) * (request.useBreath ? 1.5 : 1) * (request.useBook && target <= 20 ? 1.3 : 1);
    const maxAttempts = Math.ceil(21500 / rate) + 1;
    const expectedAttempts = round(maxAttempts * 0.42);
    const per = [
      [weapon ? "운명의 파괴석" : "운명의 수호석", weapon ? 1000 + target * 30 : 1500 + target * 40],
      ["운명의 돌파석", 20 + target],
      ["아비도스 융화 재료", 12 + target],
      ["운명의 파편", 6000 + target * 200],
      ...(request.useBreath ? [[weapon ? "용암의 숨결" : "빙하의 숨결", 20]] : []),
      ...(request.useBook && target <= 20 ? [[(weapon ? "야금술 : 업화 " : "재봉술 : 업화 ") + (target <= 14 ? "[11-14]" : target <= 18 ? "[15-18]" : "[19-20]"), 1]] : []),
    ];
    const gold = (weapon ? 2400 : 1800) + target * 60;
    const goldPer = request.growthSupport && request.grade === "UPHWA" && target <= 18 ? gold * 0.8 : gold;
    stages.push({
      targetStage: target,
      firstAttemptSuccessRateBp: Math.round(rate),
      expectedAttempts,
      medianAttempts: Math.round(maxAttempts * 0.36),
      p90Attempts: Math.round(maxAttempts * 0.88),
      maxAttempts,
      expectedMaterials: per.map(([name, n]) => ({ name, amount: round(n * expectedAttempts) })),
      worstCaseMaterials: per.map(([name, n]) => ({ name, amount: n * maxAttempts })),
      expectedGold: round(goldPer * expectedAttempts),
      worstCaseGold: Math.round(goldPer * maxAttempts),
    });
  }
  const sum = (key) => {
    const totals = new Map();
    for (const stage of stages) for (const item of stage[key]) totals.set(item.name, round((totals.get(item.name) ?? 0) + item.amount));
    return [...totals].map(([name, amount]) => ({ name, amount }));
  };
  return {
    code: "REFINING_PLAN_SUCCESS",
    message: "성공",
    data: {
      ruleVersion: "t4-refining-v1",
      source: { name: "합성 목 데이터", commit: "mock", license: "테스트 전용", crossCheckedWith: "없음", verifiedOn: "2026-10-05" },
      grade: request.grade, equipmentType: request.equipmentType, fromStage: request.fromStage, toStage: request.toStage,
      useBreath: !!request.useBreath, useBook: !!request.useBook, growthSupport: !!request.growthSupport,
      stages,
      expectedMaterials: sum("expectedMaterials"),
      worstCaseMaterials: sum("worstCaseMaterials"),
      expectedGold: round(stages.reduce((a, st) => a + st.expectedGold, 0)),
      worstCaseGold: stages.reduce((a, st) => a + st.worstCaseGold, 0),
      assumptions: ["합성 목 데이터: 실제 확률·비용이 아니에요.", "실링과 상급 재련은 포함하지 않아요."],
    },
  };
}
const port = Number(process.env.MOCK_PORT || 4180);
createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  // MOCK_MARKET_DELAY_MS: a slow market backend (server prefetch times out, QA #180).
  if (url.pathname.startsWith("/api/v1/markets") && process.env.MOCK_MARKET_DELAY_MS)
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.MOCK_MARKET_DELAY_MS)));
  const send = (body, status = 200, headers = {}) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/__counts") return send(counts);
  // Planned failures (QA, PM-프론트 #236 follow-up): the next N backend requests
  // to a path answer with an error, whether the web server (prefetch) or the
  // browser (through the proxy) makes them. Arm:
  //   POST /__fail {"path": "/api/v1/characters/popular", "status": 502, "times": 2}
  // ("code" optional, Retry-After 30 on 429). DELETE /__fail clears them.
  if (url.pathname === "/__fail") {
    if (req.method === "DELETE") {
      failures.clear();
      return send({ ok: true });
    }
    if (req.method !== "POST") return send({ code: "INVALID_REQUEST", message: "POST or DELETE" }, 405);
    let body = "";
    for await (const chunk of req) body += chunk;
    // A bad plan answers 400; it never takes the mock (and every e2e run) down.
    let plan;
    try {
      plan = JSON.parse(body || "{}");
    } catch {
      return send({ code: "INVALID_REQUEST", message: "JSON body" }, 400);
    }
    if (typeof plan.path !== "string" || !plan.path.startsWith("/"))
      return send({ code: "INVALID_REQUEST", message: "path required" }, 400);
    failures.set(plan.path, { status: Number(plan.status) || 502, times: Number(plan.times) || 1, code: plan.code });
    return send({ ok: true, armed: Object.fromEntries(failures) });
  }
  const planned = failures.get(url.pathname);
  if (planned && planned.times > 0) {
    planned.times -= 1;
    if (planned.times === 0) failures.delete(url.pathname);
    const code = planned.code ?? (planned.status === 429 ? "LOST_ARK_RATE_LIMITED" : planned.status === 503 ? "CHARACTER_CACHE_UNAVAILABLE" : "LOST_ARK_API_ERROR");
    return send({ code, message: "planned failure" }, planned.status, planned.status === 429 ? { "Retry-After": "30" } : {});
  }
  // T4 악세 경매 검색기 (N13, backend #431). Synthetic listings (not game data):
  // page 1 of a main-stat range search is partial (complete false, nextPage 2),
  // one listing is bid-only (buyPrice null), one cannot be traded again; minQuality
  // 99 answers 503 MARKET_SEARCH_BUSY with Retry-After.
  if (url.pathname === "/api/v1/markets/auctions/accessories/search" && req.method === "POST") {
    counts.accessorySearch = (counts.accessorySearch || 0) + 1;
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    if (request.minQuality === 99) {
      return send({ code: "MARKET_SEARCH_BUSY", message: "검색이 몰리고 있습니다.", data: null }, 503, { "Retry-After": "30" });
    }
    const page = request.page ?? 1;
    const ranged = request.mainStatRangeMinPct != null;
    const polishLine = (name, option, shortName, value, level) => ({ name, option, shortName, value, percentage: true, level });
    const listing = (i, extra = {}) => ({
      name: `테스트 장신구 ${page}-${i}`,
      grade: "고대",
      quality: 90 - i,
      polish: [
        polishLine("적에게 주는 피해 증가", "ENEMY_DAMAGE", "적주피", 2.0, "HIGH"),
        polishLine("추가 피해", "ADDITIONAL_DAMAGE", "추피", 1.6, "MID"),
        { name: "최대 생명력", option: null, shortName: null, value: 3250, percentage: false, level: null },
      ],
      polishStage: 3,
      enlightenment: 13,
      mainStat: 17000 - i * 100,
      mainStatRangePct: 68.5 - i,
      tradeAllowCount: 2,
      buyPrice: 1_200_000 + page * 100_000 + i * 50_000,
      bidStartPrice: 900_000,
      endDate: "2026-10-14T12:00:00Z",
      ...extra,
    });
    const items = [
      listing(1),
      listing(2, { buyPrice: null }),
      listing(3, { tradeAllowCount: 0 }),
    ];
    return send({
      code: "AUCTION_SEARCH_SUCCESS",
      message: "장신구 경매 검색에 성공했습니다.",
      data: {
        ruleVersion: "accessory-search-v1",
        totalCount: 245,
        page,
        observedAt: "2026-10-12T03:00:00Z",
        cached: false,
        complete: !ranged || page > 1,
        scannedPages: ranged ? 3 : 1,
        nextPage: ranged && page === 1 ? 4 : null,
        items,
      },
    });
  }
  if (url.pathname.startsWith("/api/v1/markets/"))
    return market(url, req, send);
  if (url.pathname === "/api/v1/refining/plans" && req.method === "POST") {
    counts.refining = (counts.refining || 0) + 1;
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    if (request.fromStage === 24 && request.toStage === 25 && request.currentFailedAttempts === 10)
      return send({ code: "INVALID_REQUEST" }, 400);
    return send(refiningPlan(request));
  }
  // Combat-power simulator (backend #240). Stage A answers UNSUPPORTED for every
  // item like the real contract; "전투력계산" gets synthetic OK numbers (not game
  // formulas) so the computed path can be seen, "갱신됨" a 409.
  // Targets read the way backend #240 names them (CombatPowerSimulationService.describe).
  const powerTarget = (data, change) => {
    const { loadout } = data;
    const item = loadout.equipment[change.index];
    switch (change.kind) {
      case "GEM_LEVEL_ALL": return ["보석 전체", null];
      case "GEM_LEVEL": {
        const gem = loadout.gems.items.find((g) => g.slot === change.slot);
        // A character without that gem (e.g. "상세" on the spec-up goal path) still answers.
        if (!gem) return [`보석 ${change.slot}번`, null];
        return [`보석 ${gem.slot}번(${gem.name})`, String(gem.level)];
      }
      case "EQUIPMENT_REFINE": return [item?.name ?? "장비", item?.detail ? String(item.detail.refineLevel) : null];
      case "EQUIPMENT_QUALITY": return [item?.name ?? "장비", item?.detail ? String(item.detail.quality) : null];
      case "EQUIPMENT_ADVANCED_REFINE": return [item?.name ?? "장비", item?.detail ? String(item.detail.advancedRefineLevel ?? "") : null];
      case "POLISH": {
        const line = item.detail.polishEffects[change.line];
        return [`${item.name} 연마 ${change.line + 1}`, `${line.name} ${line.value}`];
      }
      case "BRACELET_EFFECT": {
        const bracelet = loadout.equipment.find((e) => e.type === "팔찌");
        return [`팔찌 효과 ${change.line + 1}`, bracelet.detail.braceletEffects[change.line].text];
      }
      case "ENGRAVING_LEVEL": {
        const e = loadout.engravings.arkPassiveEffects.find((x) => x.name === change.name);
        return [e.name, String(e.level)];
      }
      case "STONE_ENGRAVING": {
        const s = loadout.equipment.flatMap((e) => e.detail?.stoneEngravings ?? []).find((x) => x.name === change.name);
        return [`스톤 ${s.name}`, String(s.level)];
      }
      case "ARK_PASSIVE_POINT": {
        const p = loadout.arkPassive.points.find((x) => x.name === change.tree);
        return [`아크 패시브 ${p.name}`, String(p.value)];
      }
      case "ARK_GRID_CORE": {
        const s = loadout.arkGrid.slots.find((x) => x.index === change.slotIndex);
        return [s.name, `${s.grade} ${s.point}P`];
      }
      case "ARM_GUARD": {
        const g = loadout.equipment.find((x) => x.type === "완갑");
        return [g?.name ?? "팔 보호구", g ? `+${g.detail.refineLevel} ${g.grade}` : null];
      }
      default: return [change.kind, null];
    }
  };
  const powerTo = (change) =>
    change.kind === "POLISH" ? `${change.option} ${change.grade}`
    : change.kind === "BRACELET_EFFECT" ? `${change.name} ${change.grade}`
    : change.kind === "ARK_GRID_CORE" ? `${change.grade} ${change.point}P`
    : change.kind === "ARM_GUARD" ? `+${change.level} ${change.grade}`
    : String(change.level ?? change.refine ?? change.quality ?? change.points ?? "");
  const powerRead = (name) =>
    JSON.parse(readFileSync(new URL(`./combat-power-fixtures/${name}`, import.meta.url), "utf8"));
  // 스펙업 가이드(백엔드 #318 표본). '스펙업꺼짐'은 SPEC_UP_DISABLED, '스펙업시세'는
  // 비용 PENDING, 캐시에 없는 이름은 CHARACTER_NOT_CACHED.
  if (url.pathname === "/api/v1/characters/spec-up") {
    const specUp = (name) =>
      JSON.parse(readFileSync(new URL(`./spec-up-fixtures/${name}`, import.meta.url), "utf8"));
    const who = url.searchParams.get("characterName");
    if (who === "스펙업꺼짐") return send(specUp("character-spec-up-disabled.json"), 404);
    if (who === "미존재") return send(specUp("character-spec-up-not-cached.json"), 404);
    const envelope = specUp(who === "스펙업시세" ? "character-spec-up-pending.json" : "character-spec-up.json");
    envelope.data.characterName = who;
    // The same combat power the mock simulator starts from (the backend's
    // spec-up and simulator read one character), so the L31 goal path adds up.
    envelope.data.combatPower = read("character-full-data.json").combatPower;
    // The sample's gem is the mock simulator character's slot-1 gem (level 8).
    for (const c of envelope.data.candidates)
      if (c.change?.kind === "GEM_LEVEL") c.change.slot = 1;
    if (url.searchParams.get("sort") === "DELTA") {
      envelope.data.sort = "DELTA";
      const ok = envelope.data.candidates.filter((c) => c.status === "OK");
      ok.sort((a, b) => b.deltaCombatPower - a.deltaCombatPower);
      envelope.data.candidates = [...ok, ...envelope.data.candidates.filter((c) => c.status !== "OK")];
    }
    return send(envelope);
  }
  if (url.pathname === "/api/v1/characters/combat-power/options")
    return send(powerRead("combat-power-options.json"));
  if (url.pathname === "/api/v1/characters/combat-power/simulate" && req.method === "POST") {
    counts.combatPower = (counts.combatPower || 0) + 1;
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    if (request.characterName === "갱신됨") return send({ code: "CHANGE_TARGET_NOT_FOUND" }, 409);
    const envelope = powerRead("character-combat-power-simulate.json");
    const d = envelope.data;
    const search = read("character-full-data.json");
    const computed = request.characterName === "전투력계산";
    // 서포터(backend #332): every change comes back unsupported with the role reason.
    const supporter = request.characterName === "상세서포터";
    if (computed) withSimulatorGear(search);
    const r2 = (v) => Math.round(v * 100) / 100;
    d.characterName = request.characterName;
    d.fetchedAt = search.fetchedAt;
    d.before = search.combatPower;
    d.contributions = request.changes.map((change, i) => ({
      kind: change.kind,
      target: powerTarget(search, change)[0],
      from: powerTarget(search, change)[1],
      to: powerTo(change),
      delta: computed ? (armourQuality(search, change) ? 0 : (specUpDelta(change) ?? r2(10 + i))) : null,
      status: computed ? "OK" : "UNSUPPORTED",
      basis: supporter
        ? "서포터 전투력 계산식은 아직 적용하지 않았습니다."
        : computed
          ? armourQuality(search, change)
            ? "방어구 품질은 체력에만 붙어 전투력이 바뀌지 않습니다."
            : "합성 값(목 서버)"
          : d.contributions[0].basis,
      reasonCode: supporter ? "SUPPORTER_MODEL_PENDING" : computed ? null : "MODEL_UNCONFIRMED",
    }));
    const delta = computed ? r2(d.contributions.reduce((sum, item) => sum + item.delta, 0)) : 0;
    d.after = d.before == null ? null : r2(d.before + delta);
    d.delta = d.before == null ? null : delta;
    d.deltaPercent = d.before ? Math.round((delta / d.before) * 100_000) / 1000 : null;
    d.unsupportedCount = computed ? 0 : d.contributions.length;
    d.partial = !computed && d.contributions.length > 0;
    return send(envelope);
  }
  if (url.pathname === "/api/v1/characters/crit-speed" && req.method === "POST") {
    counts.critSpeed = (counts.critSpeed || 0) + 1;
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    if (request.characterName === "미존재") return send({ code: "CHARACTER_NOT_FOUND" }, 404);
    // Synthetic numbers that move with the assumptions; not game formulas.
    const base = JSON.parse(readFileSync(new URL("./crit-speed-fixtures/crit-speed.json", import.meta.url), "utf8"));
    const a = request.assumptions ?? {};
    const d = base.data;
    const r2 = (v) => Math.round(v * 100) / 100;
    d.characterName = request.characterName;
    d.fetchedAt = new Date(Date.now() - 120_000).toISOString();
    const assumed = (a.backAttack ? 10 : 0) + (a.critSynergyCount ?? 0) * 10 + (a.supportCritRate ?? 0) + (a.tripodCritRate ?? 0) + (a.extraCritRate ?? 0) + (a.critPet ? 5.72 : 0);
    d.crit.assumedRate = r2(assumed);
    d.crit.totalRate = r2(d.crit.observedRate + assumed);
    d.crit.effectiveRate = Math.min(100, d.crit.totalRate);
    d.crit.bluntThorn.effectiveCritRate = Math.min(80, d.crit.totalRate);
    d.crit.bluntThorn.evolutionDamage = r2(Math.min(75, 15 + Math.max(0, d.crit.totalRate - 80) * 1.5));
    for (const t of d.crit.targets) {
      t.reached = d.crit.totalRate >= t.targetRate;
      t.requiredAdditionalCritStat = t.reached ? 0 : Math.ceil((t.targetRate - d.crit.totalRate) / 0.03578);
      t.requiredCritStat = d.crit.critStat + t.requiredAdditionalCritStat;
    }
    for (const [axis, key] of [["attack", "extraAttackSpeed"], ["move", "extraMoveSpeed"]]) {
      const x = d.speed[axis];
      x.assumed = a[key] ?? 0;
      x.total = r2(x.observed + x.assumed);
      x.effective = Math.min(d.speed.cap, x.total);
    }
    d.speed.supersonic.evolutionDamage = r2(Math.min(24, d.speed.attack.effective * 0.2));
    d.sources = d.sources.filter((src) => src.kind === "OBSERVED");
    const add = (axis, name, value, text) => value && d.sources.push({ kind: "ASSUMED", category: "ASSUMPTION", axis, name, value, text });
    add("CRIT", "백어택", a.backAttack ? 10 : 0, "백어택 적중 가정");
    add("CRIT", "치명타 시너지", (a.critSynergyCount ?? 0) * 10, `시너지 ${a.critSynergyCount}개`);
    add("CRIT", "서포터 버프", a.supportCritRate ?? 0, "서포터 치명타 적중률 버프");
    add("CRIT", "트라이포드", a.tripodCritRate ?? 0, "사용 스킬 트라이포드");
    add("CRIT", "기타", a.extraCritRate ?? 0, "아크 그리드 코어 등");
    add("ATTACK_SPEED", "공격 속도 가정", a.extraAttackSpeed ?? 0, "직업 각인·트라이포드·버프 합");
    add("MOVE_SPEED", "이동 속도 가정", a.extraMoveSpeed ?? 0, "직업 각인·트라이포드·버프 합");
    return send(base);
  }
  if (url.pathname === "/api/v1/characters/siblings") {
    const who = url.searchParams.get("characterName");
    if (who === "원정대오류") return send({ code: "LOST_ARK_API_ERROR" }, 502);
    const now = Date.now();
    const base = JSON.parse(readFileSync(new URL("./siblings-fixtures/character-siblings.json", import.meta.url), "utf8"));
    base.data.characterName = who;
    base.data.siblings = [
      { characterName: who, serverName: "아만", className: "블래스터", characterLevel: 70, itemLevel: 1780.83 },
      { characterName: "합성원정대", serverName: "아만", className: "바드", characterLevel: 70, itemLevel: 1720 },
      { characterName: "합성부캐", serverName: "루페온", className: "버서커", characterLevel: 60, itemLevel: 1640 },
    ];
    base.data.fetchedAt = new Date(now - 60_000).toISOString();
    base.data.refreshAvailableAt = new Date(now + 240_000).toISOString();
    return send(base);
  }
  if (url.pathname === "/api/v1/characters/history") {
    const who = url.searchParams.get("characterName");
    if (who === "기록끔") return send({ code: "CHARACTER_HISTORY_DISABLED" }, 503);
    const day = 86_400_000;
    const start = Date.now() - 40 * day;
    const values = who === "기록없음" ? [] : [[1740, 2600, 350], [1750, 2780, 352], [1765, 2950, 358], [1780.83, 3180.29, 364]];
    const points = values.map(([itemLevel, combatPower, expeditionLevel], i) => ({
      observedAt: new Date(start + i * 12 * day).toISOString(),
      lastConfirmedAt: new Date(start + i * 12 * day + (i === values.length - 1 ? 4 * day : day)).toISOString(),
      className: "블래스터", characterLevel: 70, itemLevel, combatPower, expeditionLevel,
    }));
    return send({ code: "CHARACTER_HISTORY_SUCCESS", message: "성공", data: { characterName: who, serverName: url.searchParams.get("serverName"), points } });
  }
  // Name autocomplete (backend #372): names starting with q, item level order, max 8.
  if (url.pathname === "/api/v1/characters/suggest") {
    const q = (url.searchParams.get("q") ?? "").trim();
    const known = [
      { characterName: "상세", serverName: "아만", className: "블래스터", itemLevel: 1780.83, characterImage: null },
      { characterName: "상세서포터", serverName: "루페온", className: "바드", itemLevel: 1712.5, characterImage: null },
      { characterName: "상수", serverName: "카단", className: "버서커", itemLevel: 1690, characterImage: null },
    ];
    const items = q.length < 1 ? [] : known.filter((c) => c.characterName.startsWith(q)).slice(0, 8);
    return send({ code: "CHARACTER_SUGGEST_SUCCESS", message: "ok", data: { items } });
  }
  if (url.pathname === "/api/v1/characters/popular") {
    // Backend F-10 sample; 7d shows the collecting state.
    const body = JSON.parse(readFileSync(new URL("./popular-fixtures/characters-popular.json", import.meta.url), "utf8"));
    const period = url.searchParams.get("period") || "24h";
    body.data.period = period;
    body.data.aggregatedAt = new Date().toISOString();
    if (period === "7d") Object.assign(body.data, { sampleStatus: "COLLECTING", items: [] });
    return send(body);
  }
  if (url.pathname === "/api/v1/characters/card-collection") {
    // Backend F-6 samples; card art swapped for official legend card icons.
    const who = url.searchParams.get("characterName");
    const kind = who === "기록없음" ? "empty" : who === "상세서포터" ? "supporter" : "dealer";
    const body = JSON.parse(readFileSync(new URL(`./card-fixtures/card-collection-${kind}.json`, import.meta.url), "utf8"));
    body.data.characterName = who;
    body.data.cards.forEach((card, i) => {
      card.icon = `https://cdn-lostark.game.onstove.com/efui_iconatlas/card_legend/card_legend_0${i % 3}_${i % 8}.png`;
    });
    return send(body);
  }
  if (url.pathname === "/api/v1/home/schedule") {
    // Week Wednesday → Tuesday around the requested KST date, times today+.
    const kst = (t) => new Date(t + 9 * 3_600_000).toISOString().slice(0, 10);
    const date = url.searchParams.get("date") || kst(Date.now());
    const base = Date.parse(`${date}T00:00:00+09:00`);
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
    const from = kst(base - ((wd + 4) % 7) * 86_400_000);
    const to = kst(Date.parse(`${from}T00:00:00+09:00`) + 6 * 86_400_000);
    const at = (h, m = 0) => new Date(base + (h * 60 + m) * 60_000).toISOString().replace(".000Z", "+00:00");
    const times = (...hours) => hours.map((h) => at(h));
    // Real calendar minutes (backend 2026-10-09): chaos gates at :50, others mixed.
    const timesAt = (minute, ...hours) => hours.map((h) => at(h, minute));
    const next = (list) => list.find((t) => Date.parse(t) > Date.now()) ?? (list.length ? new Date(Date.parse(list[0]) + 86_400_000).toISOString().replace(".000Z", "+00:00") : null);
    const cdn = "https://cdn-lostark.game.onstove.com/efui_iconatlas";
    // Rewards (backend #118): ItemLevel groups in official order; timed = tied to that day's rounds.
    const rw = (name, grade, timed = false) => ({ name, icon: null, grade, timed });
    const timed = (name, icon, minItemLevel, list, rewardGroups = []) => ({ name, icon, minItemLevel, startTimes: list, rewardGroups, nextAt: next(list) });
    const island = (...first) => [{ minItemLevel: null, rewards: [...first, rw("실링", "일반"), rw("섬의 마음", "전설"), rw("모험의 서 페이지", "영웅"), rw("대양의 주화 상자", "희귀")] }];
    const islandTimes = times(9, 11, 13, 19, 21, 23);
    const day = Number(date.slice(8, 10));
    const goldToday = day % 3 === 0;
    const days = Array.from({ length: 7 }, (_, i) => kst(Date.parse(`${from}T00:00:00+09:00`) + i * 86_400_000));
    return send({
      code: "HOME_SCHEDULE_SUCCESS",
      message: "성공",
      data: {
        ruleVersion: "home-schedule-v1", date, timezone: "Asia/Seoul", fetchedAt: new Date().toISOString(), coveredFrom: from, coveredTo: to,
        adventureIslands: [
          { ...timed("메데이아", `${cdn}/island_icon/island_icon_147.png`, 250, islandTimes, island(goldToday ? rw("골드", "일반", true) : rw("전설 ~ 고급 카드 팩 III", "전설", true))), rewardKinds: goldToday ? ["GOLD"] : ["CARD_PACK"] },
          { ...timed("라일라이 아일랜드", `${cdn}/island_icon/island_icon_43.png`, 635, islandTimes, island(rw("해적 주화", "일반", true))), rewardKinds: ["PIRATE_COIN"] },
          { ...timed("볼라르 섬", `${cdn}/island_icon/island_icon_53.png`, 1100, islandTimes), rewardKinds: ["SILLING"] },
        ],
        fieldBosses: day % 2 ? [timed("세베크 아툰", null, 1460, times(11, 13, 15, 17, 19, 21, 23), [{ minItemLevel: null, rewards: [rw("영웅 카드 팩", "영웅"), rw("실링", "일반")] }])] : [],
        chaosGates: day % 2 ? [] : [timed("일렁이는 악마군단", null, 1580, timesAt(50, 10, 12, 14, 16, 18, 20, 22, 23), [
          { minItemLevel: 1580, rewards: [rw("운명의 파편 주머니(소)", "희귀"), rw("1레벨 겁화의 보석", "고급"), rw("카드 경험치 카드", "일반")] },
          { minItemLevel: 1640, rewards: [rw("운명의 파편 주머니(중)", "영웅"), rw("2레벨 겁화의 보석", "희귀"), rw("카드 경험치 카드", "일반")] },
          { minItemLevel: 1680, rewards: [rw("운명의 파편 주머니(대)", "전설"), rw("3레벨 겁화의 보석", "희귀"), rw("카드 경험치 카드", "일반")] },
        ])],
        others: [
          { category: "항해", ...timed("항해 협동 : 베른", null, 1, timesAt(30, 20, 22)) },
          { category: "로웬", ...timed("늑대들의 축제", null, 1, timesAt(20, 21)) },
        ],
        goldIslandDays: days.filter((d) => Number(d.slice(8, 10)) % 3 === 0).map((d) => ({ date: d, islands: ["메데이아"] })),
        weekly: days.map((d) => ({ date: d, islands: [{ name: "메데이아", rewardKinds: Number(d.slice(8, 10)) % 3 === 0 ? ["GOLD"] : ["CARD_PACK"] }] })),
      },
    });
  }
  if (url.pathname === "/api/v1/home/news") {
    const kstDay = (offset) => {
      const t = Date.now() + offset * 86_400_000;
      return new Date(t + 9 * 3_600_000).toISOString().slice(0, 10);
    };
    const iso = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString();
    const [m, d] = kstDay(0).slice(5).split("-").map(Number);
    return send({
      code: "HOME_NEWS_SUCCESS",
      message: "성공",
      data: {
        fetchedAt: new Date().toISOString(),
        notices: [
          { title: `${m}월 ${d}일 임시 점검 안내`, category: "MAINTENANCE", publishedAt: iso(-0.1), url: "https://lostark.game.onstove.com/News/Notice/Views/1", maintenanceDate: kstDay(0), maintenanceDateText: `${m}월 ${d}일` },
          { title: "클라이언트 패치 안내", category: "NOTICE", publishedAt: iso(-0.4), url: "https://lostark.game.onstove.com/News/Notice/Views/2", maintenanceDate: null, maintenanceDateText: null },
          { title: "업데이트 내역 안내", category: "NOTICE", publishedAt: iso(-1), url: "https://lostark.game.onstove.com/News/Notice/Views/3", maintenanceDate: null, maintenanceDateText: null },
          { title: "알려진 이슈를 안내해 드립니다.", category: "NOTICE", publishedAt: iso(-1.2), url: null, maintenanceDate: null, maintenanceDateText: null },
          { title: "신규 패키지 판매 안내", category: "SHOP", publishedAt: iso(-2), url: null, maintenanceDate: null, maintenanceDateText: null },
        ],
        events: [
          { title: "핫타임 이벤트", thumbnail: null, startAt: iso(-5), endAt: iso(2), rewardAt: null, url: null },
          { title: "황금 반월떡 찾기", thumbnail: null, startAt: iso(-15), endAt: iso(13), rewardAt: iso(20), url: null },
          { title: "PC방 PARTY TIME", thumbnail: null, startAt: iso(-36), endAt: iso(34), rewardAt: null, url: null },
        ],
      },
    });
  }
  // Patch history (backend #126, patch-notice-v1): 45 stored notices, newest
  // first, filtered by category and paged like the backend.
  if (url.pathname === "/api/v1/home/patch-notes") {
    const kinds = ["UPDATE", "BALANCE", "CLIENT_PATCH", "MAINTENANCE_COMPLETE"];
    const titles = { UPDATE: "업데이트 내역 안내", BALANCE: "밸런스 패치 안내", CLIENT_PATCH: "클라이언트 패치 안내", MAINTENANCE_COMPLETE: "로스트아크 정기 점검 완료 안내" };
    const category = url.searchParams.get("category");
    const page = Number(url.searchParams.get("page") ?? 1);
    const size = Number(url.searchParams.get("size") ?? 20);
    if (category && !kinds.includes(category)) return send({ code: "INVALID_REQUEST", message: "invalid" }, 400);
    if (!(page >= 1 && page <= 100 && size >= 1 && size <= 50)) return send({ code: "INVALID_REQUEST", message: "invalid" }, 400);
    const all = Array.from({ length: 45 }, (_, i) => {
      const kind = kinds[i % 4];
      const at = new Date(Date.now() - (i * 2 + 0.3) * 86_400_000);
      const [, mm, dd] = new Date(at.getTime() + 9 * 3_600_000).toISOString().slice(0, 10).split("-").map(Number);
      return { noticeId: 13600 - i, title: `${mm}월 ${dd}일 ${titles[kind]}`, category: kind, publishedAt: at.toISOString(), url: `https://lostark.game.onstove.com/News/Notice/Views/${13600 - i}` };
    }).filter((item) => !category || item.category === category);
    return send({
      code: "HOME_PATCH_NOTES_SUCCESS",
      message: "성공",
      data: {
        ruleVersion: "patch-notice-v1",
        category,
        page,
        size,
        total: all.length,
        oldestPublishedAt: all.at(-1)?.publishedAt ?? null,
        firstObservedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        sourceFetchedAt: new Date().toISOString(),
        items: all.slice((page - 1) * size, page * size),
      },
    });
  }
  // Ranking (F-7, backend #100/#112). 조건밖 → not included, 집계중 → class
  // scope still collecting, 미관측 and 비공개 (the processing-stop list, backend
  // #366) → the same 404, otherwise ranked.
  // Collectible standing and ownership (backend #304/#306): a ranked roster
  // for 상세, the no-rank reasons for 미관측·제외, and per-item shares.
  if (url.pathname === "/api/v1/rankings/collectibles/standing" || url.pathname === "/api/v1/collectibles/ownership") {
    const meta = (population, sampleStatus = "READY") => ({
      population,
      conditions: { server: null, role: null, className: null, activeDays: 30, itemLevelMin: 1640, itemLevelMax: null, combatPowerMin: null, combatPowerMax: null, representativeOnly: false },
      aggregatedAt: "2026-10-11T07:00:00Z",
      snapshot: "latest",
      ruleVersion: "stats-v1",
      minSample: 30,
      sampleStatus,
      coverage: { observedCharacters: population * 4, knownCharacters: population * 5, discoveredAccounts: population },
      populationUnit: "ROSTER",
    });
    if (url.pathname.endsWith("/standing")) {
      const who = url.searchParams.get("characterName") ?? "";
      const reason = who === "미관측" ? "NOT_OBSERVED" : who === "제외" ? "EXCLUDED" : null;
      return send({
        code: "COLLECTIBLE_STANDING_SUCCESS",
        message: "ok",
        data: {
          meta: meta(667840),
          unit: "ROSTER",
          characterName: who,
          serverName: "루페온",
          rank: reason ? null : 213572,
          total: 667840,
          topPercent: reason ? null : 31.98,
          progressPercent: reason ? null : 63.92,
          point: reason ? null : 1210,
          maxPoint: reason ? null : 1893,
          reason,
        },
      });
    }
    const type = url.searchParams.get("type");
    // Same names as the 상세 mock items ("{type} {n}"), shares spread out.
    const items = Array.from({ length: 12 }, (_, i) => {
      const share = Math.round((95 - ((i * 37) % 90)) * 10) / 10;
      const rosters = Math.round(667840 * share / 100);
      return { type, name: `${type} ${i + 1}`, sortOrder: i, maxPoint: 1, ownedRosters: rosters, completedRosters: rosters, ownedPercent: share, completedPercent: share };
    });
    return send({ code: "COLLECTIBLE_OWNERSHIP_SUCCESS", message: "ok", data: { meta: meta(667840), type, items } });
  }
  if (url.pathname === "/api/v1/characters/rank") {
    const who = url.searchParams.get("characterName") ?? "";
    if (who === "미관측" || who === "비공개") return send({ code: "STATS_CHARACTER_NOT_OBSERVED", message: "private" }, 404);
    const excluded = who === "조건밖";
    const entry = (metric, scope, scopeValue, rank, total, sampleStatus = "READY") => {
      const top = sampleStatus === "READY" ? Math.round((rank / total) * 10000) / 100 : null;
      const tier = top == null ? null : top <= 1 ? "TOP1" : top <= 5 ? "TOP5" : top <= 10 ? "TOP10" : top <= 25 ? "TOP25" : top <= 50 ? "TOP50" : "REST";
      return { metric, scope, scopeValue, rank, total, topPercent: top, tier, sampleStatus };
    };
    const collecting = who === "집계중" ? "COLLECTING" : "READY";
    const entries = excluded ? [] : [
      entry("COMBAT_POWER", "ALL", null, 4120, 18231),
      entry("COMBAT_POWER", "SERVER", "아만", 211, 2311),
      entry("COMBAT_POWER", "CLASS", "블래스터", 37, collecting === "READY" ? 612 : 21, collecting),
      entry("COMBAT_POWER", "SERVER_CLASS", "아만/블래스터", 9, collecting === "READY" ? 88 : 21, collecting),
      entry("ITEM_LEVEL", "ALL", null, 90, 18231),
      entry("ITEM_LEVEL", "SERVER", "아만", 140, 2311),
      entry("ITEM_LEVEL", "CLASS", "블래스터", 22, collecting === "READY" ? 612 : 21, collecting),
      entry("ITEM_LEVEL", "SERVER_CLASS", "아만/블래스터", 6, collecting === "READY" ? 88 : 21, collecting),
    ];
    return send({
      code: "CHARACTER_RANK_SUCCESS",
      message: "성공",
      data: {
        characterName: who, serverName: "아만", className: "블래스터", position: "DEALER", itemLevel: 1780.83, combatPower: 3180.29,
        refreshedAt: new Date(Date.now() - 3_600_000).toISOString(),
        rankVisibility: "VISIBLE", included: !excluded,
        conditions: { server: null, role: null, className: null, activeDays: 30, itemLevelMin: 1640, itemLevelMax: null, combatPowerMin: null, combatPowerMax: null, representativeOnly: false },
        aggregatedAt: new Date(Date.now() - 600_000).toISOString(), ruleVersion: "stats-v1", minSample: 30, entries,
      },
    });
  }
  // Roster receipt (backend #174/#208/#211): the backend sample; 영수증꺼짐 → route
  // absent (receipt off), 영수증한도 → 429. The first request leaves two
  // characters pending; asking again fills them. assumeBook=true swaps the
  // first assumption and lowers the equipment cost.
  if (url.pathname === "/api/v1/characters/receipt") {
    const who = url.searchParams.get("characterName") ?? "";
    if (who === "영수증꺼짐") return send({ code: "NOT_FOUND", message: "not found" }, 404);
    if (who === "영수증한도")
      return send({ code: "CLIENT_RATE_LIMITED", message: "rate limited" }, 429, { "Retry-After": "30" });
    const body = JSON.parse(readFileSync(new URL("./receipt-fixtures/character-receipt.json", import.meta.url), "utf8"));
    const data = body.data;
    data.characterName = who;
    data.computedAt = new Date().toISOString();
    receiptCalls.set(who, (receiptCalls.get(who) ?? 0) + 1);
    if (receiptCalls.get(who) > 1) {
      for (const c of data.equipment.characters) if (c.status === "PENDING") Object.assign(c, { status: "READY", gold: 2887361 });
      data.coverage = { ...data.coverage, ready: data.coverage.rosterCharacters, pending: 0, nextAvailableAt: null };
    } else data.coverage.nextAvailableAt = new Date(Date.now() + 20_000).toISOString();
    if (url.searchParams.get("assumeBook") === "true") {
      data.assumptions[0] = "책(재봉술·야금술) 효과가 항상 적용된다고 가정합니다(확률 미공개).";
      data.equipment.gold = Math.round(data.equipment.gold * 0.8);
      data.total.gold = data.equipment.gold + data.gems.gold;
    }
    return send(body);
  }
  // Roster titles (backend #123): first-seen order; 칭호없음 → none recorded yet.
  if (url.pathname === "/api/v1/characters/titles") {
    const who = url.searchParams.get("characterName") ?? "";
    const at = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
    const titles = who === "칭호없음" ? [] : [
      ["빛을 꺼트리는 자", 41, 2, "상세"],
      ["카멘을 쓰러뜨린 자", 33, 1, "상세부캐"],
      ["에키드나를 쓰러뜨린 자", 33, 6, "상세"],
      ["별을 제패한 자", 12, 3, "상세"],
      ["하늘을 가른 자", 5, 0, "상세부캐"],
    ].map(([title, first, last, by], i) => ({
      title, firstObservedAt: at(first), lastObservedAt: at(last), observedOrder: i + 1, recordedBy: by, source: "OBSERVED",
      // KST date of firstObservedAt (backend #176).
      firstObservedDate: new Date(Date.parse(at(first)) + 9 * 3_600_000).toISOString().slice(0, 10),
    }));
    return send({
      code: "CHARACTER_TITLES_SUCCESS",
      message: "성공",
      data: { characterName: who, serverName: "아만", rosterCharacters: 6, observedCharacters: titles.length ? 2 : 0, ruleVersion: "title-record-v1", titles },
    });
  }
  // Ranking list (backend #100): 1,234 synthetic characters; 직업=환수사 → none.
  if (url.pathname === "/api/v1/rankings") {
    const q = url.searchParams;
    const metric = q.get("metric") || "COMBAT_POWER";
    const page = Number(q.get("page") || 1);
    const size = Number(q.get("size") || 50);
    const population = q.get("className") === "환수사" ? 0 : q.get("server") ? 312 : 1234;
    const servers = ["루페온", "실리안", "아만", "아브렐슈드", "카단", "카마인", "카제로스", "니나브"];
    const classes = ["바드", "블래스터", "소울이터", "홀리나이트", "슬레이어", "기상술사", "도화가", "버서커"];
    const rows = [];
    for (let rank = (page - 1) * size + 1; rank <= Math.min(population, page * size); rank++) {
      const top = Math.round((rank / population) * 10000) / 100;
      const tier = top <= 1 ? "TOP1" : top <= 5 ? "TOP5" : top <= 10 ? "TOP10" : top <= 25 ? "TOP25" : top <= 50 ? "TOP50" : "REST";
      const cls = q.get("className") || classes[rank % classes.length];
      rows.push({
        rank, characterName: `랭커${rank}`, serverName: q.get("server") || servers[rank % servers.length], className: cls,
        position: cls === "바드" || cls === "홀리나이트" || cls === "도화가" ? "SUPPORT" : "DEALER",
        itemLevel: Math.round((1790 - rank * 0.05) * 100) / 100, combatPower: Math.round((4800 - rank * 1.3) * 100) / 100,
        topPercent: top, tier,
      });
    }
    return send({
      code: "RANKING_SUCCESS",
      message: "성공",
      data: {
        meta: {
          population, conditions: { server: q.get("server"), role: q.get("role"), className: q.get("className"), activeDays: Number(q.get("activeDays") || 30), itemLevelMin: Number(q.get("itemLevelMin") || 1640), itemLevelMax: null, combatPowerMin: null, combatPowerMax: null, representativeOnly: false },
          aggregatedAt: new Date(Date.now() - 600_000).toISOString(), snapshot: "latest", ruleVersion: "stats-v1", minSample: 30,
          sampleStatus: population >= 30 ? "READY" : "COLLECTING", coverage: { observedCharacters: population, knownCharacters: population * 3, discoveredAccounts: 100 },
        },
        metric, page, size, rows,
      },
    });
  }
  // Statistics (B-3, backend #100): synthetic but shaped like the real thing.
  // server=니나브 → small sample (COLLECTING everywhere).
  if (url.pathname.startsWith("/api/v1/stats/")) {
    const q = url.searchParams;
    const small = q.get("server") === "니나브";
    const scale = small ? 0.001 : q.get("activeDays") === "7" ? 0.4 : q.get("activeDays") === "90" ? 1.6 : 1;
    const minLevel = Number(q.get("itemLevelMin") || 1640);
    const conditions = {
      server: q.get("server"), role: q.get("role"), className: null, activeDays: Number(q.get("activeDays") || 30),
      itemLevelMin: minLevel, itemLevelMax: q.get("itemLevelMax") ? Number(q.get("itemLevelMax")) : null,
      combatPowerMin: null, combatPowerMax: null, representativeOnly: q.get("representativeOnly") === "true",
    };
    const classes = [
      ["바드", 9120, 0.82], ["홀리나이트", 6210, 0.74], ["도화가", 5880, 0.79], ["발키리", 4120, 0.68],
      ["블래스터", 6120, 0], ["소울이터", 5410, 0], ["버서커", 5230, 0], ["슬레이어", 4980, 0], ["기상술사", 4710, 0],
      ["스카우터", 4400, 0], ["아르카나", 4210, 0], ["데빌헌터", 3990, 0], ["리퍼", 3870, 0], ["창술사", 3720, 0],
      ["워로드", 3610, 0], ["인파이터", 3400, 0], ["건슬링어", 3310, 0], ["디스트로이어", 3010, 0], ["소서리스", 2950, 0],
      ["배틀마스터", 2890, 0], ["서머너", 2610, 0], ["블레이드", 2480, 0], ["데모닉", 2360, 0], ["호크아이", 2210, 0],
      ["스트라이커", 2080, 0], ["브레이커", 1720, 0], ["환수사", 25, 0],
    ].map(([className, n, sup], i) => {
      const count = Math.max(small ? 3 : 25, Math.round(n * scale));
      const ready = count >= 30;
      const base = 3000 + (i % 7) * 40 - (sup ? 300 : 0);
      return {
        className, count, share: 0, dealers: Math.round(count * (1 - sup)), supports: Math.round(count * sup), unknownRole: 0,
        supportShare: sup ? Math.round(sup * 10000) / 100 : null,
        itemLevelMean: ready ? Math.round((1712 + (i % 5) * 3.1) * 100) / 100 : null,
        gemMeanLevel: ready ? Math.round((8.2 + (i % 4) * 0.2) * 10) / 10 : null,
        combatPower: ready ? { p10: base - 520, p25: base - 260, p50: base, p75: base + 280, p90: base + 610 } : null,
        sampleStatus: ready ? "READY" : "COLLECTING",
      };
    });
    const population = classes.reduce((a, c) => a + c.count, 0);
    for (const c of classes) c.share = Math.round((c.count / population) * 10000) / 100;
    const meta = {
      population, conditions, aggregatedAt: new Date(Date.now() - 600_000).toISOString(), snapshot: "latest", ruleVersion: "stats-v1",
      minSample: 30, sampleStatus: population >= 30 ? "READY" : "COLLECTING",
      coverage: { observedCharacters: population + 120, knownCharacters: population + 4000, discoveredAccounts: Math.round(population / 4) },
    };
    const view = url.pathname.slice("/api/v1/stats/".length);
    const ok = (code, data) => send({ code, message: "성공", data: { meta, ...data } });
    if (view === "summary") {
      const supports = classes.reduce((a, c) => a + c.supports, 0);
      const dealers = population - supports;
      return ok("STATS_SUMMARY_SUCCESS", {
        itemLevelMean: small ? 1688.4 : 1714.52, itemLevelMedian: small ? 1684.5 : 1712.5, combatPowerMedian: small ? 2610 : 3058, combatPowerP90: small ? 2990 : 3712,
        dealers, supports, unknownRole: 0, supportShare: Math.round((supports / Math.max(1, dealers + supports)) * 10000) / 100,
        gemMeanLevel: small ? 7.6 : 8.4, gemSample: Math.round(population * 0.93),
      });
    }
    if (view === "classes") return ok("STATS_CLASSES_SUCCESS", { rows: classes });
    if (view === "servers") {
      const names = ["루페온", "실리안", "아만", "아브렐슈드", "카단", "카마인", "카제로스", "니나브"];
      const weights = [0.24, 0.12, 0.14, 0.11, 0.1, 0.1, 0.13, 0.06];
      return ok("STATS_SERVERS_SUCCESS", {
        rows: names.map((serverName, i) => {
          // 니나브 stays under the sample floor so the "표본 부족" state shows.
          const count = serverName === "니나브" ? 24 : Math.round(population * weights[i]);
          return { serverName, count, share: weights[i] * 100, itemLevelMedian: 1709 + i * 1.5, combatPowerMedian: 3010 + i * 12, knownCharacters: count * 3, rosters: Math.round(count / 5), sampleStatus: count >= 30 ? "READY" : "COLLECTING" };
        }),
      });
    }
    if (view === "distribution") {
      const metric = q.get("metric");
      if (metric !== "ITEM_LEVEL" && metric !== "COMBAT_POWER") return send({ code: "INVALID_REQUEST", message: "x" }, 400);
      const width = Number(q.get("width") || (metric === "ITEM_LEVEL" ? 10 : 100));
      const [lo, hi, mid, sd] = metric === "ITEM_LEVEL" ? [minLevel, 1780, 1712, 25] : [2000, 4600, 3060, 420];
      const bins = [];
      for (let from = Math.floor(lo / width) * width; from < hi; from += width) {
        const x = from + width / 2;
        bins.push({ from, to: from + width, count: Math.round(population * (width / (sd * 2.5066)) * Math.exp(-((x - mid) ** 2) / (2 * sd * sd))) });
      }
      const total = bins.reduce((a, b) => a + b.count, 0);
      let percentileOf = null;
      if (q.get("percentileOf")) {
        const value = Number(q.get("percentileOf"));
        const above = bins.filter((b) => b.from >= value).reduce((a, b) => a + b.count, 0);
        const rank = Math.max(1, above);
        const top = Math.round((rank / total) * 10000) / 100;
        const tier = top <= 1 ? "TOP1" : top <= 5 ? "TOP5" : top <= 10 ? "TOP10" : top <= 25 ? "TOP25" : top <= 50 ? "TOP50" : "REST";
        percentileOf = { value, rank, total, topPercent: top, tier };
      }
      return ok("STATS_DISTRIBUTION_SUCCESS", { metric, width, bins: bins.filter((b) => b.count > 0), percentileOf });
    }
    return send({ code: "INVALID_REQUEST", message: "x" }, 400);
  }
  // Card record refill (backend #138): POST, ~2 s; 쿨다운 → 429 cooldown.
  if (url.pathname === "/api/v1/characters/card-collection/refresh" && req.method === "POST") {
    const who = url.searchParams.get("characterName") ?? "";
    if (who === "쿨다운")
      return send({ code: "CARD_COLLECTION_REFRESH_COOLDOWN", message: "private" }, 429, { "Retry-After": "420" });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return send({
      code: "CHARACTER_CARD_COLLECTION_REFRESH_SUCCESS",
      message: "성공",
      data: { rosterCharacters: 14, refreshed: 11, skipped: 1, failed: 1, remaining: 1, nextAvailableAt: new Date(Date.now() + 600_000).toISOString() },
    });
  }
  if (url.pathname === "/api/v1/characters/views") {
    const who = url.searchParams.get("characterName");
    if (who === "기록끔") return send({ code: "CHARACTER_VIEWS_DISABLED" }, 503);
    const length = Number(url.searchParams.get("days") || 112);
    const today = new Date(Date.now() + 9 * 3_600_000);
    const days = Array.from({ length }, (_, i) => {
      const date = new Date(today.getTime() - (length - 1 - i) * 86_400_000).toISOString().slice(0, 10);
      // Deterministic, weekly-ish pattern with quiet stretches.
      const count = i % 9 === 0 ? 0 : ((i * 37) % 11) * (i > length - 30 ? 2 : 1) % 9;
      return { date, count };
    });
    const rangeTotal = days.reduce((sum, d) => sum + d.count, 0);
    return send({
      code: "CHARACTER_VIEWS_SUCCESS",
      message: "성공",
      data: { characterName: who, timezone: "Asia/Seoul", from: days[0].date, to: days.at(-1).date, days, rangeTotal, total: rangeTotal + 184 },
    });
  }
  // Remaining official tooltip lines (backend #227), keyed to the search
  // response's equipment order. "툴팁캐시없음" has no cache (404).
  // Official armory page details (backend draft 19:58): on for 상세 (the
  // mock skills' tripods with levels and a skill code), off (200, all null)
  // for everyone else, as the backend answers with its flag off.
  if (url.pathname === "/api/v1/characters/armory-page") {
    const who = url.searchParams.get("characterName") ?? "";
    if (who === "툴팁캐시없음") return send({ code: "CHARACTER_NOT_CACHED", message: "no cache" }, 404);
    const on = who === "상세";
    return send({
      code: "CHARACTER_ARMORY_PAGE_SUCCESS",
      message: "성공",
      data: on
        ? {
            characterName: who,
            enabled: true,
            source: "공식 전투정보실 페이지",
            fetchedAt: "2026-10-11T10:00:00Z",
            skills: [
              { name: "합성 포격", tripods: [{ tier: 0, slot: 1, name: "기동 포격", level: 5 }, { tier: 1, slot: 2, name: "연발 포격", level: 4 }, { tier: 2, slot: 1, name: "화약 추가", level: 1 }] },
              { name: "합성 화염", tripods: [{ tier: 0, slot: 2, name: "장전", level: 5 }] },
            ],
            skillCode: "MOCK-SKILL-CODE-1234",
            lifeSkills: [{ name: "채집", level: 70, grade: null }],
          }
        : { characterName: who, enabled: false, source: null, fetchedAt: null, skills: null, skillCode: null, lifeSkills: null },
    });
  }
  // Roster ranking (backend #298): three rosters, the last one short of six
  // characters (usedCharacters 4 of 4), values by basis and aggregate.
  if (url.pathname === "/api/v1/rankings/rosters") {
    const basis = url.searchParams.get("basis") ?? "ITEM_LEVEL";
    const aggregate = url.searchParams.get("aggregate") ?? "TOP6_AVG";
    const base = basis === "COMBAT_POWER" ? 3200 : 1720;
    const rosters = [
      ["합성원정대", "루페온", "바드", 8, 0],
      ["상세", "루페온", "블래스터", 7, -40],
      ["작은원정대", "아만", "블레이드", 4, -90],
    ];
    const rows = rosters.map(([name, server, cls, count, delta], i) => {
      const members = Array.from({ length: count }, (_, k) => ({
        characterName: k === 0 ? name : `${name}${k + 1}`,
        className: k === 0 ? cls : "버서커",
        value: Math.round((base + delta - k * 12) * 100) / 100,
      }));
      const used = aggregate === "ALL_AVG" ? count : Math.min(6, count);
      const top = members.slice(0, used).map((m) => m.value);
      const sum = top.reduce((a, b) => a + b, 0);
      return {
        rank: i + 1,
        serverName: server,
        characterName: name,
        className: cls,
        itemLevel: 1720 + delta,
        combatPower: 3200 + delta,
        characterCount: count,
        usedCharacters: used,
        value: Math.round((aggregate === "TOP6_SUM" ? sum : sum / used) * 100) / 100,
        composition: members.slice(0, used),
      };
    });
    return send({
      code: "ROSTER_RANKING_SUCCESS",
      message: "ok",
      data: {
        meta: {
          population: 1240,
          conditions: { server: url.searchParams.get("server"), role: null, className: null, activeDays: 30, itemLevelMin: 1640, itemLevelMax: null, combatPowerMin: null, combatPowerMax: null, representativeOnly: false },
          aggregatedAt: "2026-10-11T07:00:00Z",
          snapshot: "latest",
          ruleVersion: "stats-v1",
          minSample: 30,
          sampleStatus: "READY",
          coverage: { observedCharacters: 6200, knownCharacters: 7400, discoveredAccounts: 1240 },
          populationUnit: "ROSTER",
        },
        basis,
        aggregate,
        page: 1,
        size: 50,
        excludedRosters: 2,
        rows,
      },
    });
  }
  // Collectible ranking (backend #295/#304, K33): three rosters; unit=CHARACTER
  // lists each 상세 roster character with the roster value.
  if (url.pathname === "/api/v1/rankings/collectibles") {
    const unit = url.searchParams.get("unit") ?? "ROSTER";
    const kinds = (done) => [
      { type: "모코코 씨앗", point: done ? 1569 : 1402, maxPoint: 1569 },
      { type: "섬의 마음", point: done ? 100 : 87, maxPoint: 100 },
      { type: "거인의 심장", point: 15, maxPoint: 15 },
    ];
    const roster = (rank, characterName, serverName, className, itemLevel, characterCount, done) => {
      const types = kinds(done);
      const point = types.reduce((a, t) => a + t.point, 0);
      const maxPoint = types.reduce((a, t) => a + t.maxPoint, 0);
      return { rank, serverName, characterName, className, itemLevel, characterCount, progressPercent: Math.round((point / maxPoint) * 10000) / 100, point, maxPoint, observedAt: "2026-10-11T07:00:00Z", types };
    };
    const rosters = [roster(1, "합성원정대", "루페온", "바드", 1740, 8, true), roster(2, "상세", "아만", "블래스터", 1780.83, 7, false), roster(3, "작은원정대", "아만", "블레이드", 1690, 4, false)];
    const rows = unit === "CHARACTER" ? [rosters[1], { ...rosters[1], characterName: "상세서포터", className: "바드", itemLevel: 1712.5 }] : rosters;
    return send({
      code: "COLLECTIBLE_RANKING_SUCCESS",
      message: "ok",
      data: {
        meta: {
          population: unit === "CHARACTER" ? 4210 : 1240,
          conditions: { server: url.searchParams.get("server"), role: null, className: null, activeDays: Number(url.searchParams.get("activeDays") ?? 30), itemLevelMin: 1640, itemLevelMax: null, combatPowerMin: null, combatPowerMax: null, representativeOnly: false },
          aggregatedAt: "2026-10-11T07:00:00Z",
          snapshot: "latest",
          ruleVersion: "stats-v1",
          minSample: 30,
          sampleStatus: "READY",
          coverage: { observedCharacters: 6200, knownCharacters: 7400, discoveredAccounts: 1240 },
          populationUnit: unit,
        },
        unit,
        page: 1,
        size: 50,
        rows,
      },
    });
  }
  if (url.pathname === "/api/v1/characters/item-tooltips") {
    const who = url.searchParams.get("characterName") ?? "";
    if (who === "툴팁캐시없음") return send({ code: "CHARACTER_NOT_CACHED", message: "no cache" }, 404);
    const equipment = read("character-full-data.json").loadout.equipment.map((item, index) => ({
      index,
      type: item.type,
      extraLines: ["분해불가", "[제작] 대도시", "내구도 61 / 66"],
    }));
    return send({
      code: "CHARACTER_ITEM_TOOLTIPS_SUCCESS",
      message: "성공",
      data: { characterName: who, hidden: false, fetchedAt: new Date().toISOString(), equipment, gems: [], cards: [], skills: [] },
    });
  }
  if (url.pathname !== "/api/v1/characters/search") return send({}, 404);
  const name = url.searchParams.get("characterName");
  counts[name] = (counts[name] || 0) + 1;
  const errors = {
    미존재: [404, "CHARACTER_NOT_FOUND"],
    제한: [429, "LOST_ARK_RATE_LIMITED"],
    과다: [429, "CLIENT_RATE_LIMITED"],
    오류: [502, "LOST_ARK_API_ERROR"],
    설정: [503, "LOST_ARK_NOT_CONFIGURED"],
    시간초과: [504, "LOST_ARK_API_TIMEOUT"],
  };
  const error =
    name === "갱신실패" && counts[name] > 1
      ? [502, "LOST_ARK_API_ERROR"]
      : errors[name];
  if (error)
    return send(
      { code: error[1], message: "private upstream detail" },
      error[0],
      error[0] === 429 ? { "Retry-After": name === "과다" ? "30" : "2" } : {},
    );
  if (name === "잘못된응답") return send({ data: "wrong" });
  if (name === "로딩")
    await new Promise((resolve) => setTimeout(resolve, 1500));
  let envelope = {
    code: "CHARACTER_SEARCH_SUCCESS",
    message: "성공",
    data: read("character-full-data.json"),
  };
  if (name === "부분") envelope = read("character-partial.json");
  if (name === "빈목록") envelope = read("observation-gems-items-empty.json");
  if (name === "미제공") envelope = read("observation-gems-items-null.json");
  envelope.data.characterName = name;
  // Multi-search (web #611): 비교1…비교6 differ in level, power, class and
  // gear so the comparison has a best value and a sort to show.
  const compare = /^비교([1-6])$/.exec(name);
  if (compare) {
    const n = Number(compare[1]);
    const d = envelope.data;
    d.itemLevel = 1680 + n * 12.5;
    d.combatPower = n === 4 ? null : 2000 + n * 350.25;
    d.className = ["바드", "블래스터", "버서커", "소서리스", "도화가", "슬레이어"][n - 1];
    d.analysis.position = n === 1 || n === 5 ? "SUPPORT" : "DEALER";
    d.analysis.equipment.minRefineLevel = 17 + n;
    d.analysis.equipment.maxRefineLevel = 19 + n;
    d.analysis.equipment.averageQuality = 70 + n * 4.5;
    d.analysis.gems.averageLevel = 6 + n * 0.5;
    d.analysis.gems.count = 11;
    d.loadout.engravings.arkPassiveEffects = ["원한", "아드레날린", "예리한 둔기", "돌격대장", "질량 증가"]
      .slice(0, 3 + (n % 3))
      .map((engraving, i) => ({ name: engraving, grade: "유물", level: (n + i) % 5, abilityStoneLevel: null, description: null }));
    d.loadout.arkPassive.points = [
      { name: "진화", value: 100 + n * 4, description: null },
      { name: "깨달음", value: 80 + n * 4, description: null },
      { name: "도약", value: 50 + n * 4, description: null },
    ];
  }
  if (name === "전투력계산") withSimulatorGear(envelope.data);
  if (name === "마크업") {
    // Synthetic copy of the official Tooltip markup shape seen in live responses.
    const { engravings, arkPassive } = envelope.data.loadout;
    engravings.arkPassiveEffects[0].description =
      "피해량이 <FONT COLOR='#99ff99'>27.00%</FONT> 증가하지만, 받는 피해가 <FONT COLOR='#ff9999'>20.00%</FONT> 증가한다.";
    arkPassive.effects[0].description =
      "<FONT color='#83E9FF'>깨달음</FONT> 1티어 <FONT color='#83E9FF'>합성 패시브 Lv.1</FONT><BR>둘째 줄";
    envelope.data.stats = [
      { type: "치명", value: "646" },
      { type: "최대 생명력", value: "377857" },
    ];
  }
  if (name === "이미지" || name === "이미지실패") {
    // Generic official icon-atlas assets (not character data). The portrait is
    // per character, so it is only used when supplied locally via MOCK_PORTRAIT_URL.
    const cdn = "https://cdn-lostark.game.onstove.com/efui_iconatlas";
    const broken = name === "이미지실패";
    const icon = (path) => (broken ? `${cdn}/missing/${path}` : `${cdn}/${path}`);
    const { loadout } = envelope.data;
    envelope.data.imageUrl = broken
      ? "https://cdn-lostark.game.onstove.com/armory/missing.jpg"
      : (process.env.MOCK_PORTRAIT_URL ?? null);
    loadout.equipment = [
      ["무기", "+25 합성 무기", "gbs_item/gbs_item_01_175.png", "고대"],
      ["투구", "+20 합성 투구", "gbs_item/gbs_item_01_169.png", "고대"],
      ["어빌리티 스톤", "합성 어빌리티 스톤", null, "유물"],
    ].map(([type, itemName, path, grade]) => ({
      type,
      name: itemName,
      icon: path ? icon(path) : null,
      grade,
      detail: null,
    }));
    loadout.cards.items = [
      ["합성 카드 하나", "card_legend/card_legend_00_4.png", 5],
      ["합성 카드 둘", "card_legend/card_legend_02_0.png", 3],
      ["합성 카드 셋", null, null],
    ].map(([cardName, path, awake], slot) => ({
      slot,
      name: cardName,
      icon: path ? icon(path) : null,
      awakeCount: awake,
      awakeTotal: 5,
      grade: "전설",
    }));
    loadout.arkGrid.slots[0].icon = icon("use/use_13_96.png");
    loadout.arkGrid.slots[0].gems = [
      { index: 0, icon: icon("use/use_13_202.png"), active: true, grade: "전설" },
      { index: 1, icon: icon("use/use_13_202.png"), active: false, grade: "영웅" },
    ];
    loadout.arkPassive.effects[0].icon = icon("ark_passive_bs/ark_passive_bs_1.png");
  }
  if (name === "재련") {
    // Refining-page mock: T4 업화/전율 parts plus one unreadable non-T4 part.
    const parts = [
      ["무기", "+21 운명의 전율 합성검", 21],
      ["투구", "+19 운명의 업화 모자", 19],
      ["상의", "+19 운명의 업화 상의", 19],
      ["하의", "+18 운명의 업화 하의", 18],
      ["장갑", "+20 운명의 전율 장갑", 20],
      ["어깨", "+15 고대 합성 견갑", 15],
    ];
    envelope.data.itemLevel = 1738.33;
    envelope.data.loadout.equipment = parts.map(([type, itemName, refineLevel]) => ({
      type, name: itemName, icon: null, grade: "고대",
      detail: { parserVersion: "equipment-tooltip-v3", refineLevel, quality: 90, itemLevel: 1640 + refineLevel * 5, tier: 4, arkPassivePoint: null, effects: [], stoneEngravings: [], polishEffects: [], braceletEffects: [] },
    }));
  }
  if (name === "상세" || name === "상세서포터") {
    // Detail-page mock: a locally supplied character file (never committed) or
    // the synthetic fixture, enriched with synthetic Tooltip detail and skills.
    if (process.env.MOCK_CHARACTER_FILE)
      envelope.data = JSON.parse(
        readFileSync(process.env.MOCK_CHARACTER_FILE, "utf8"),
      ).envelope.data;
    const d = envelope.data;
    // An older local file may predate newer contract fields; fill them from the fixture.
    const fixture = read("character-full-data.json");
    const fill = (target, source) => {
      for (const [key, value] of Object.entries(source))
        if (!(key in target)) target[key] = value;
        else if (value && typeof value === "object" && !Array.isArray(value) && target[key] && typeof target[key] === "object" && !Array.isArray(target[key]))
          fill(target[key], value);
    };
    fill(d, fixture);
    d.characterName = name;
    const now = Date.now();
    d.fetchedAt = new Date(now - 90_000).toISOString();
    d.refreshAvailableAt = new Date(now + 210_000).toISOString();
    if (process.env.MOCK_PORTRAIT_URL) d.imageUrl = process.env.MOCK_PORTRAIT_URL;
    const polish = [
      [["적주피", "+2.00%", "HIGH"], ["추피", "+1.60%", "MID"], ["생회", "+50", "HIGH"]],
      [["공", "+1.55%", "HIGH"], ["무공", "+0.80%", "LOW"], ["상태이상", "+0.20%", "LOW"]],
    ];
    let acc = 0;
    for (const item of d.loadout.equipment) {
      const refine = /^\+(\d+)/.exec(item.name ?? "")?.[1];
      const isAcc = ["목걸이", "귀걸이", "반지"].includes(item.type);
      item.detail = {
        parserVersion: "equipment-tooltip-v3",
        refineLevel: refine ? Number(refine) : null,
        quality: isAcc ? [86, 91, 82, 81, 75][acc] ?? 70 : item.type === "팔찌" ? null : 100,
        itemLevel: refine ? 1755 + Number(refine) : null,
        tier: 4,
        arkPassivePoint: null,
        effects: [],
        stoneEngravings:
          item.type === "어빌리티 스톤"
            ? [{ name: "원한", level: 4 }, { name: "아드레날린", level: 1 }, { name: "공격속도 감소", level: 0 }]
            : [],
        polishEffects: isAcc
          ? polish[acc++ % 2].map(([n, value, grade]) => ({ name: n, value, grade }))
          : [],
        braceletEffects:
          item.type === "팔찌"
            ? [
                { text: "특화 +111", grade: null },
                { text: "치명타 피해 +2.5%", grade: "MID" },
                { text: "공격력 +1.7%\n무기 공격력 +1.4%", grade: "LOW" },
              ]
            : [],
      };
    }
    // Synthetic gems: four damage, seven cooldown (names follow the game's pattern).
    const gemIcon = (n) => `https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_9_${n}.png`;
    d.loadout.gems = {
      items: [
        ...[6, 6, 6, 6].map((level, i) => ({ slot: i, name: `${level}레벨 겁화의 보석`, icon: gemIcon(55), level, grade: "전설" })),
        ...[6, 6, 6, 6, 6, 6, 6].map((level, i) => ({ slot: 4 + i, name: `${level}레벨 작열의 보석`, icon: gemIcon(65), level, grade: "전설" })),
      ],
      effects: { description: "<FONT COLOR='#FFD200'>기본 공격력</FONT> +4.95%", skills: [] },
    };
    d.coverage.gems = { state: "PROVIDED", collections: { items: "PROVIDED" } };
    d.analysis.gems = { count: 11, unknownLevelCount: 0, minLevel: 6, maxLevel: 6, averageLevel: 6, levelDistribution: [{ level: 6, count: 11 }], damageEffectCount: 4, cooldownEffectCount: 7, unknownEffectCount: 0 };
    // Synthetic 내실·아바타 data (names and counts are invented).
    const kinds = [
      ["합성 심장", 15, 15],
      ["합성 섬의 마음", 69, 104],
      ["합성 씨앗", 976, 1480],
      ["합성 미술품", 57, 60],
      ["합성 항해물", 41, 50],
      ["합성 잎", 37, 120],
    ];
    d.collectibles = kinds.map(([type, point, maxPoint], k) => ({
      type,
      icon: null,
      point,
      maxPoint,
      items: Array.from({ length: Math.min(12, maxPoint) }, (_, i) => ({
        name: `${type} ${i + 1}`,
        point: k === 2 ? (i % 3 === 0 ? 40 : 51) : i < Math.round((point / maxPoint) * 12) ? 1 : 0,
        maxPoint: k === 2 ? 51 : 1,
      })),
    }));
    d.tendencies = [["지성", 590], ["담력", 593], ["매력", 478], ["친절", 508]].map(([type, point]) => ({ type, point, maxPoint: 1000 }));
    d.decorations = { symbol: null, emblems: [] };
    d.townName = "합성 영지";
    d.townLevel = 70;
    d.honorPoint = 183;
    d.guildMemberGrade = "길드장";
    d.avatars = [
      ["무기 아바타", "합성 무기 아바타", "전설", false, ["민첩 +2.00%"]],
      ["무기 덧입기 아바타", "합성 무기 덧입기", "영웅", true, []],
      ["상의 아바타", "합성 상의 (패스)", "전설", false, ["민첩 +2.00%"]],
      ["상의 덧입기 아바타", "합성 상의 덧입기", "영웅", true, []],
      ["하의 아바타", "합성 하의 (패스)", "전설", false, ["민첩 +2.00%"]],
      ["머리 아바타", "합성 머리", "전설", false, ["민첩 +1.00%"]],
      ["얼굴1 아바타", "합성 얼굴1", "영웅", false, []],
      ["이동 효과", "합성 이동 효과", "영웅", false, []],
    ].map(([type, name, grade, isInner, effects]) => ({ type, name, icon: null, grade, isSet: false, isInner, effects }));
    d.coverage.avatars = "PROVIDED";
    d.coverage.collectibles = "PROVIDED";
    for (const stat of d.stats) if (!stat.tooltip?.length) stat.tooltip = [`${stat.type} 효과가 적용됩니다. (합성 문구)`];
    d.skillPoints = { used: 480, total: 480 };
    const skill = (skillName, lvl, extra = {}) => ({
      name: skillName, icon: null, level: lvl, type: "일반", partBreakLevel: null, counter: false,
      tripods: [], rune: null, gemEffects: [], ...extra,
    });
    d.loadout.skills = [
      skill("합성 포격", 14, { tripods: [{ tier: 0, slot: 1, name: "기동 포격", icon: null }, { tier: 1, slot: 2, name: "연발 포격", icon: null }, { tier: 2, slot: 1, name: "화약 추가", icon: null }], rune: { name: "풍요", icon: null, grade: "전설" }, gemEffects: [{ text: "합성 포격 피해 28.00% 증가", kind: "DAMAGE" }], cooldown: { cooldownSec: 18, gemCooldownReductionPct: 0, cooldownWithGemsSec: 18, basis: "공식 재사용 대기시간과 장착 보석의 재사용 대기시간 감소만 반영했습니다." } }),
      skill("합성 화염", 14, { partBreakLevel: 1, tripods: [{ tier: 0, slot: 2, name: "장전", icon: null }], rune: { name: "풍요", icon: null, grade: "전설" } }),
      skill("합성 중력", 10, { counter: true, rune: { name: "속행", icon: null, grade: "영웅" }, gemEffects: [{ text: "합성 중력 재사용 대기시간 20.00% 감소", kind: "COOLDOWN" }], cooldown: { cooldownSec: 24, gemCooldownReductionPct: 20, cooldownWithGemsSec: 19.2, basis: "공식 재사용 대기시간과 장착 보석의 재사용 대기시간 감소만 반영했습니다." } }),
      skill("기본 스킬", 1, { partBreakLevel: 1, counter: true }),
    ];
    d.coverage.skills = "PROVIDED";
    d.analysis.position = name === "상세서포터" ? "SUPPORT" : "DEALER";
    d.analysis.positionEvidence = name === "상세서포터" ? "절실한 구원" : d.className;
    d.analysis.positionRuleVersion = "position-v1";
    // Ark grid detail (F-4): six cores with options, gems and willpower.
    const icon = (path) => `https://cdn-lostark.game.onstove.com/efui_iconatlas/${path}`;
    const cores = [
      ["질서", "해", "살상연희", "use/use_13_96.png", 18, 4],
      ["질서", "달", "쌍검난무", "use/use_13_97.png", 17, 3],
      ["질서", "별", "쾌도난마", "use/use_13_98.png", 18, 4],
      ["혼돈", "해", "현란한 공격", "use/use_13_99.png", 17, 3],
      ["혼돈", "달", "불타는 일격", "use/use_13_100.png", 17, 3],
      ["혼돈", "별", "공격", "use/use_13_101.png", 17, 3],
    ];
    const thresholds = [10, 14, 17, 18, 19, 20];
    d.loadout.arkGrid = {
      willpower: { used: 91, supply: 92 },
      effects: [
        ["공격력", 28, 1.02], ["아군 피해 강화", 25, 1.31], ["추가 피해", 51, 4.12],
        ["낙인력", 32, 5.33], ["보스 피해", 4, 0.33],
      ].map(([effectName, level, percent]) => ({ name: effectName, level, value: `${effectName} +${percent}%`, percent })),
      slots: cores.map(([kind, body, coreName, path, point, active], index) => ({
        index, icon: icon(path), name: `${kind}의 ${body} 코어 : ${coreName}`, point, grade: "유물",
        coreType: `${kind} - ${body}`, supplyWillpower: 15 + (index % 2), usedWillpower: 15,
        options: thresholds.map((threshold, i) => ({ threshold, text: `${coreName} ${threshold}P 효과 — 피해 ${(i + 1) * 1.5}% 증가`, active: i < active })),
        activeOptionCount: active, optionCount: thresholds.length,
        conditions: index < 3 ? ["질서 포인트 합 10 이상"] : [],
        gems: [0, 1, 2, 3].map((g) => ({
          index: g, icon: icon(kind === "질서" ? "use/use_13_202.png" : "use/use_13_205.png"), active: g < 3, grade: g === 0 ? "고대" : "유물",
          name: `${kind}의 젬 : ${["안정", "견고", "불변", "침식"][g]}`, gemType: kind, gemPoint: 5 - (g % 2), corePoint: 5 - (g % 2),
          requiredWillpower: 4 + (g % 2), baseWillpower: 8, willpowerEfficiency: 4,
          options: [{ name: "공격력", level: 3 + g, effect: `공격력 +0.0${3 + g}%`, percent: (3 + g) / 100 }, { name: "보스 피해", level: 2, effect: "보스 피해 +0.08%", percent: 0.08 }],
        })),
      })),
    };
    const stone = d.loadout.equipment.find((item) => item.type === "어빌리티 스톤");
    if (stone?.detail) stone.detail.effects = [...stone.detail.effects, { title: "무작위 각인 효과", lines: ["[레벨 보너스] 기본 공격력 +1.50%"] }];
    d.analysis.arkGrid = { coreCount: 6, activeGemCount: 18, inactiveGemCount: 6, unknownGemCount: 0, orderPoints: 53, chaosPoints: 51 };
    // A bracelet to carry the efficiency (the fixture has weapon and helmet only).
    if (!d.loadout.equipment.some((item) => item.type === "팔찌"))
      d.loadout.equipment.push({
        type: "팔찌", name: "찬란한 구원자의 팔찌", icon: null, grade: "고대",
        detail: {
          parserVersion: "equipment-tooltip-v5", refineLevel: null, quality: null, itemLevel: null, tier: 4, arkPassivePoint: null,
          effects: [], stoneEngravings: [], polishEffects: [],
          braceletEffects: [
            { text: "치명타 피해 +8.40%", grade: "HIGH" },
            { text: "공격 및 이동 속도 +4%", grade: "MID" },
          ],
          titleLine: null, tradeLines: [], refineExp: null, advancedRefineLevel: 0,
        },
      });
    // Bracelet efficiency (backend #350): the reference sample for 상세, the
    // support reason for 상세서포터.
    d.braceletEfficiency = name === "상세서포터"
      ? { percent: null, status: "UNSUPPORTED", reasonCode: "SUPPORT_POSITION", reason: "서포터는 전투력이 딜러와 다르게 계산돼 팔찌 효율을 매기지 않아요.", lines: [], ruleVersion: "combat-power-v3" }
      : {
          percent: 14.42, status: "OK", reasonCode: null, reason: "팔찌를 뺀 전투력과 비교했어요.", ruleVersion: "combat-power-v3",
          lines: [
            { text: "치명타 피해 +8.40%", percent: 4.12, status: "OK", reasonCode: null, reason: null },
            { text: "공격 및 이동 속도 +4%", percent: null, status: "UNSUPPORTED", reasonCode: "SPEED", reason: "속도는 전투력에 들어가지 않아요." },
            { text: "팔찌 도약 +18", percent: 2.05, status: "OK", reasonCode: null, reason: null },
          ],
        };
    if (name === "상세서포터") {
      d.className = "바드";
      d.loadout.arkPassive.effects = [
        { name: "깨달음", description: "<FONT color='#83E9FF'>깨달음</FONT> 1티어 <FONT color='#83E9FF'>완벽한 화음 Lv.3</FONT>", icon: null },
        { name: "깨달음", description: "<FONT color='#83E9FF'>깨달음</FONT> 2티어 <FONT color='#83E9FF'>절실한 구원 Lv.3</FONT>", icon: null },
      ];
    }
  }
  // Backend #54: includeSiblings=false searches do not embed siblings.
  if (url.searchParams.get("includeSiblings") === "false" && envelope.data) {
    envelope.data.siblings = null;
    envelope.data.coverage.siblings = null;
  }
  if (name === "문자열")
    envelope.data.guildName = '<img src=x onerror="window.injected=true">';
  send(envelope);
}).listen(port, "127.0.0.1", () =>
  console.log(`Synthetic backend: http://127.0.0.1:${port}`),
);
