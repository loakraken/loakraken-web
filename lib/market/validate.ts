import Ajv2020 from "ajv/dist/2020";
import type {
  BoardEnvelope,
  ItemHistoryEnvelope,
  TabsEnvelope,
} from "./board";
import contract from "../../contracts/market.openapi.json";
import { tolerantSchemas } from "../api/tolerant";
import type {
  ItemsEnvelope,
  OptionsEnvelope,
  PricesEnvelope,
  QuoteEnvelope,
} from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";

// The backend's generated OpenAPI is also the runtime shape contract. Response
// enums are loosened: a value added later shows as unknown instead of
// rejecting the whole response (#125).
const ajv = new Ajv2020({ strict: false, validateFormats: false });
ajv.addSchema({
  $id: "market",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
});
const compile = <T>(schema: string) =>
  lazyValidator(() => ajv.compile<T>({ $ref: `market#/components/schemas/${schema}` }));
const options = compile<OptionsEnvelope>("ApiResponseMarketOptionsResponse");
const items = compile<ItemsEnvelope>("ApiResponseMarketPriceResponse");
const quote = compile<QuoteEnvelope>("ApiResponseMaterialQuoteResponse");
const prices = compile<PricesEnvelope>("ApiResponseMaterialPriceResponse");
const tabs = compile<TabsEnvelope>("ApiResponseMarketTabsResponse");
const board = compile<BoardEnvelope>("ApiResponseMarketBoardResponse");
const itemHistory = compile<ItemHistoryEnvelope>(
  "ApiResponseMarketItemHistoryResponse",
);

const time = (value: string) => Number.isFinite(Date.parse(value));

export function isOptionsEnvelope(value: unknown): value is OptionsEnvelope {
  return (
    options(value) &&
    value.code === "MARKET_OPTIONS_SUCCESS" &&
    time(value.data.observedAt)
  );
}

export function isItemsEnvelope(value: unknown): value is ItemsEnvelope {
  return (
    items(value) &&
    value.code === "MARKET_SEARCH_SUCCESS" &&
    time(value.data.observedAt)
  );
}

export function isQuoteEnvelope(value: unknown): value is QuoteEnvelope {
  return (
    quote(value) &&
    value.code === "MATERIAL_QUOTE_SUCCESS" &&
    time(value.data.calculatedAt)
  );
}

export function isPricesEnvelope(value: unknown): value is PricesEnvelope {
  return (
    prices(value) &&
    value.code === "MATERIAL_PRICE_SUCCESS" &&
    value.data.items.every((item) => time(item.observedAt))
  );
}

export function isTabsEnvelope(value: unknown): value is TabsEnvelope {
  return tabs(value) && value.code === "MARKET_TABS_SUCCESS";
}

export function isBoardEnvelope(value: unknown): value is BoardEnvelope {
  return (
    board(value) &&
    value.code === "MARKET_BOARD_SUCCESS" &&
    time(value.data.observedAt)
  );
}

export function isItemHistoryEnvelope(
  value: unknown,
): value is ItemHistoryEnvelope {
  return (
    itemHistory(value) &&
    value.code === "MARKET_ITEM_HISTORY_SUCCESS" &&
    time(value.data.observedAt)
  );
}
