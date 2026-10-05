// Local synthetic backend only. This process never accesses Lost Ark.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const read = (name) =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
  );
const counts = {};
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
  return send({}, 404);
}
const port = Number(process.env.MOCK_PORT || 4180);
createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const send = (body, status = 200, headers = {}) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/__counts") return send(counts);
  if (url.pathname.startsWith("/api/v1/markets/"))
    return market(url, req, send);
  if (url.pathname !== "/api/v1/characters/search") return send({}, 404);
  const name = url.searchParams.get("characterName");
  counts[name] = (counts[name] || 0) + 1;
  const errors = {
    미존재: [404, "CHARACTER_NOT_FOUND"],
    제한: [429, "LOST_ARK_RATE_LIMITED"],
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
      error[0] === 429 ? { "Retry-After": "2" } : {},
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
    d.skillPoints = { used: 480, total: 480 };
    const skill = (skillName, lvl, extra = {}) => ({
      name: skillName, icon: null, level: lvl, type: "일반", partBreakLevel: null, counter: false,
      tripods: [], rune: null, gemEffects: [], ...extra,
    });
    d.loadout.skills = [
      skill("합성 포격", 14, { tripods: [{ tier: 0, slot: 1, name: "기동 포격", icon: null }, { tier: 1, slot: 2, name: "연발 포격", icon: null }, { tier: 2, slot: 1, name: "화약 추가", icon: null }], rune: { name: "풍요", icon: null, grade: "전설" }, gemEffects: [{ text: "합성 포격 피해 28.00% 증가", kind: "DAMAGE" }] }),
      skill("합성 화염", 14, { partBreakLevel: 1, tripods: [{ tier: 0, slot: 2, name: "장전", icon: null }], rune: { name: "풍요", icon: null, grade: "전설" } }),
      skill("합성 중력", 10, { counter: true, rune: { name: "속행", icon: null, grade: "영웅" }, gemEffects: [{ text: "합성 중력 재사용 대기시간 20.00% 감소", kind: "COOLDOWN" }] }),
      skill("기본 스킬", 1, { partBreakLevel: 1, counter: true }),
    ];
    d.coverage.skills = "PROVIDED";
    if (name === "상세서포터") {
      d.className = "바드";
      d.loadout.arkPassive.effects = [
        { name: "깨달음", description: "<FONT color='#83E9FF'>깨달음</FONT> 1티어 <FONT color='#83E9FF'>완벽한 화음 Lv.3</FONT>", icon: null },
        { name: "깨달음", description: "<FONT color='#83E9FF'>깨달음</FONT> 2티어 <FONT color='#83E9FF'>절실한 구원 Lv.3</FONT>", icon: null },
      ];
    }
  }
  if (name === "문자열")
    envelope.data.guildName = '<img src=x onerror="window.injected=true">';
  send(envelope);
}).listen(port, "127.0.0.1", () =>
  console.log(`Synthetic backend: http://127.0.0.1:${port}`),
);
