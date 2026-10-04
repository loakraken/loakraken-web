// Local synthetic backend only. This process never accesses Lost Ark.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const read = (name) =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
  );
const counts = {};
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
  if (name === "문자열")
    envelope.data.guildName = '<img src=x onerror="window.injected=true">';
  send(envelope);
}).listen(port, "127.0.0.1", () =>
  console.log(`Synthetic backend: http://127.0.0.1:${port}`),
);
