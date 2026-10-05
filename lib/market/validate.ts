import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/market.openapi.json";
import type {
  ItemsEnvelope,
  OptionsEnvelope,
  PricesEnvelope,
  QuoteEnvelope,
} from "./model";

// The backend's generated OpenAPI is also the runtime shape contract.
const ajv = new Ajv2020({ strict: false, validateFormats: false });
ajv.addSchema({ $id: "market", components: contract.components });
const compile = <T>(schema: string) =>
  ajv.compile<T>({ $ref: `market#/components/schemas/${schema}` });
const options = compile<OptionsEnvelope>("ApiResponseMarketOptionsResponse");
const items = compile<ItemsEnvelope>("ApiResponseMarketPriceResponse");
const quote = compile<QuoteEnvelope>("ApiResponseMaterialQuoteResponse");
const prices = compile<PricesEnvelope>("ApiResponseMaterialPriceResponse");

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
