import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/home.openapi.json";
import { tolerantSchemas } from "../api/tolerant";
import type { NewsEnvelope, ScheduleEnvelope } from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";

// The backend's generated OpenAPI is also the runtime shape contract. Response
// enums are loosened: a value added later shows as unknown instead of
// rejecting the whole response (#125).
const ajv = new Ajv2020({ strict: false, validateFormats: false });
ajv.addSchema({
  $id: "home",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
});
const schedule = lazyValidator(() => ajv.compile<ScheduleEnvelope>({
  $ref: "home#/components/schemas/ApiResponseHomeScheduleResponse",
}));
const news = lazyValidator(() => ajv.compile<NewsEnvelope>({
  $ref: "home#/components/schemas/ApiResponseHomeNewsResponse",
}));
const time = (value: string | null) => value === null || Number.isFinite(Date.parse(value));

export function isScheduleEnvelope(value: unknown): value is ScheduleEnvelope {
  if (!schedule(value) || value.code !== "HOME_SCHEDULE_SUCCESS") return false;
  const d = value.data;
  return (
    time(d.fetchedAt) &&
    [...d.adventureIslands, ...d.fieldBosses, ...d.chaosGates, ...d.others].every(
      (item) => time(item.nextAt) && item.startTimes.every(time),
    )
  );
}

export function isNewsEnvelope(value: unknown): value is NewsEnvelope {
  if (!news(value) || value.code !== "HOME_NEWS_SUCCESS") return false;
  return (
    value.data.notices.every((notice) => time(notice.publishedAt)) &&
    value.data.events.every((event) => time(event.startAt) && time(event.endAt))
  );
}
