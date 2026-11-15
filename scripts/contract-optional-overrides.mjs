// Response fields the backend document marks required but the web keeps optional.
//
// Why: a new response field stays optional in the web until both deploy orders
// are safe — the web may ship before the api that sends the field, and the api
// may roll back to a build without it. A plain re-sync copies the backend's
// `required` list and would silently make these fields required again, so the
// sync scripts drop exactly these names from `required`.
//
// Keyed by contract name (contracts/<name>.openapi.json), then schema. The sync
// fails when an entry no longer matches: the schema is not in that contract,
// the property is gone, or the backend no longer requires it. Remove an entry
// once the web may require the field (the api has shipped it and no rollback
// target lacks it).
export const OPTIONAL_OVERRIDES = {
  "accessory-search": {
    AccessorySearchItemResponse: ["baseEffects", "icon"],
  },
  "auction-gems": {
    AuctionGemCellResponse: ["stale"],
  },
  character: {
    KrakenScoreTierResponse: ["remainingRounded"],
  },
  "class-builds": {
    ClassBuildsResponse: ["details"],
  },
  "collectible-ranking": {
    CollectibleRankingRowResponse: ["imageUrl"],
  },
  "guild-detail": {
    GuildDetailSummary: ["combatPowerAvgTop", "combatPowerTopCount", "combatPowerTopItemLevelMin", "combatPowerTotal"],
  },
  history: {
    CharacterHistoryResponse: ["titles"],
  },
  home: {
    HomeScheduleResponse: ["weekKinds"],
    HomeIslandResponse: ["location"],
    HomeTimedResponse: ["location"],
    HomeOtherResponse: ["location"],
  },
  market: {
    MaterialQuoteLineResponse: ["tradeRemainCount"],
    MaterialPriceItemResponse: ["unavailableReason"],
  },
  rankings: {
    StatsRankingResponse: ["classEngraving", "classEngravingUnknown"],
    StatsRankedCharacterResponse: ["imageUrl"],
    StatsEfficiencyRankedCharacterResponse: ["imageUrl"],
  },
  receipt: {
    ReceiptTotalResponse: ["nonGold", "status"],
    ReceiptCharacterResponse: ["complete", "observedAt"],
    ReceiptCoverageResponse: ["unavailable"],
  },
  refining: {
    RefiningPlanResponse: ["failedAttemptsFrom"],
    StageResponse: ["startFailedAttempts"],
  },
  "roster-ranking": {
    RosterRankingRowResponse: ["imageUrl"],
  },
  "spec-up": {
    SpecUpResponse: ["cooldownGemsIncluded", "krakenRuleVersion", "krakenScore", "krakenSortUnavailableReason"],
    CandidateResponse: ["baseAttackPctFrom", "baseAttackPctTo", "deltaKrakenScore", "emptySlot", "gemType", "krakenScorePer100kGold"],
    ChangeResponse: ["grade"],
    CostResponse: ["priceObservedAt", "stale"],
    SpecUpGoalStepResponse: ["changes", "extraCost"],
    SpecUpMarketResponse: ["sellFeeGold"],
  },
  stats: {
    StatsMetaResponse: ["populationUnit"],
    StatsClassesResponse: ["composition"],
    StatsServerRowResponse: ["combatPower", "dealers", "itemLevelMean", "supports", "unknownRole"],
    StatsDistributionResponse: ["topPercentCutoffs"],
  },
  "title-equip": {
    EquippedTitleResponse: ["newRosters30d", "observedCharacters", "observedPercent", "observedRosters", "sampleReady"],
  },
};

// Returns a copy of `schemas` with the overrides for contract `name` applied.
// Throws when an override no longer matches the backend document.
/**
 * @param {string} name
 * @param {Record<string, any>} schemas
 * @param {Record<string, Record<string, string[]>>} [overrides]
 */
export function applyOptionalOverrides(name, schemas, overrides = OPTIONAL_OVERRIDES) {
  const out = { ...schemas };
  for (const [schema, props] of Object.entries(overrides[name] ?? {})) {
    const definition = out[schema];
    if (!definition)
      throw new Error(`Optional override ${name}.${schema}: schema is not in this contract`);
    for (const prop of props) {
      if (!definition.properties?.[prop])
        throw new Error(`Optional override ${name}.${schema}.${prop}: property is gone`);
      if (!definition.required?.includes(prop))
        throw new Error(
          `Optional override ${name}.${schema}.${prop}: the backend no longer requires it — remove the entry`,
        );
    }
    // Keep key order so a re-sync of unchanged schemas is byte-identical.
    const required = definition.required.filter((prop) => !props.includes(prop));
    out[schema] = Object.fromEntries(
      Object.entries(definition).flatMap(([key, value]) =>
        key !== "required" ? [[key, value]] : required.length ? [[key, required]] : [],
      ),
    );
  }
  return out;
}
