import type { components } from "../api/schema";
import { rateLimitCopy, secondsUntil } from "../api/rate-limit";
import { labelOf } from "../api/tolerant";

type GeneratedCharacter = components["schemas"]["CharacterResponse"];
type GeneratedAnalysis = GeneratedCharacter["analysis"];
type GeneratedDiagnostics = GeneratedAnalysis["diagnostics"];
type Finding = Omit<GeneratedDiagnostics["findings"][number], "code"> & {
  code: string;
};
// Rule codes can grow independently; unknown codes still have displayable evidence.
export type Character = Omit<GeneratedCharacter, "analysis"> & {
  analysis: Omit<GeneratedAnalysis, "diagnostics"> & {
    diagnostics: Omit<GeneratedDiagnostics, "findings"> & {
      findings: Finding[];
    };
  };
};
export type CharacterEnvelope = Omit<
  components["schemas"]["ApiResponseCharacterResponse"],
  "data"
> & { data: Character };
export type CoverageState = Character["coverage"]["equipment"];
export type CoverageSection = Character["coverage"]["gems"];
export type QueryFailure = { code: string; status: number; retryAt?: number };
export type CharacterResult =
  | { ok: true; envelope: CharacterEnvelope }
  | { ok: false; error: QueryFailure };

export function normalizeCharacterName(input: string) {
  return input.trim().normalize("NFC");
}

export function characterNameError(input: string) {
  const name = normalizeCharacterName(input);
  if (!name) return "캐릭터 이름을 입력해 주세요.";
  if (name.length > 64) return "캐릭터 이름은 64자 이내로 입력해 주세요.";
  if (!/^[\p{L}\p{N}]+$/u.test(name))
    return "캐릭터 이름에는 문자와 숫자만 사용할 수 있어요.";
  return "";
}

export const coverageLabels: Record<CoverageState, string> = {
  PROVIDED: "데이터 제공",
  PROVIDED_EMPTY: "빈 목록 제공",
  NOT_PROVIDED: "데이터 미제공",
};

/** Coverage label; a state this build does not know yet reads "알 수 없음". */
export const coverageLabel = (state: string) => labelOf(coverageLabels, state);

export function emptyObservation(state: CoverageState) {
  if (state === "NOT_PROVIDED")
    return "전투정보실에서 제공하지 않는 정보라 확인할 수 없어요.";
  if (state === "PROVIDED_EMPTY")
    return "전투정보실 목록이 비어 있어요. 착용하지 않았다는 뜻은 아니에요.";
  return "표시할 항목이 없어요. 착용하지 않았다는 뜻은 아니에요.";
}

export function evidenceAt(
  envelope: unknown,
  pointer: string,
): { found: boolean; value?: unknown } {
  if (!pointer.startsWith("/") || /~(?![01])/u.test(pointer))
    return { found: false };
  let value: unknown = envelope;
  for (const key of pointer
    .slice(1)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key))
      return { found: false };
    value = (value as Record<string, unknown>)[key];
  }
  return { found: true, value };
}

export function failureCopy(error: QueryFailure, now = Date.now()) {
  switch (error.code) {
    case "INVALID_REQUEST":
      return {
        title: "캐릭터 이름을 확인해 주세요",
        text: "문자와 숫자로 된 1~64자의 이름을 입력해 주세요.",
      };
    case "CHARACTER_NOT_FOUND":
      return {
        title: "캐릭터를 찾지 못했어요",
        text: "이름이 정확한지 확인한 뒤 다시 검색해 주세요.",
      };
    case "LOST_ARK_RATE_LIMITED":
      return rateLimitCopy(secondsUntil(error.retryAt, now));
    case "LOST_ARK_API_TIMEOUT":
      return {
        title: "응답이 늦어지고 있어요",
        text: "조회 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.",
      };
    case "FRONTEND_API_NOT_CONFIGURED":
    case "LOST_ARK_NOT_CONFIGURED":
      return {
        title: "조회 서비스 연결을 준비하고 있어요",
        text: "서비스 연결 설정이 완료되면 캐릭터를 조회할 수 있습니다.",
      };
    case "CHARACTER_CACHE_UNAVAILABLE":
    case "CHARACTER_STORAGE_UNAVAILABLE":
      return {
        title: "조회 서비스를 잠시 사용할 수 없어요",
        text: "데이터 처리에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      };
    case "INVALID_API_RESPONSE":
      return {
        title: "조회 결과를 확인할 수 없어요",
        text: "응답 형식이 예상과 달라 정보를 표시하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      };
    default:
      return {
        title: "캐릭터 정보를 불러오지 못했어요",
        text: "조회 서비스에 연결할 수 없습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
      };
  }
}

// Official armory portraits and icon atlases only; never proxy or render arbitrary hosts.
export function safeGameImage(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "lostark.game.onstove.com" ||
        url.hostname === "cdn-lostark.game.onstove.com")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export const safePortrait = safeGameImage;

const gradeKeys: Record<string, string> = {
  일반: "normal",
  고급: "uncommon",
  희귀: "rare",
  영웅: "epic",
  전설: "legendary",
  유물: "relic",
  고대: "ancient",
  에스더: "esther",
};

export function gradeKey(grade: string | null | undefined) {
  return (grade && gradeKeys[grade.trim()]) || "unknown";
}
