import { contentKey } from "./content-key";
import type { CmsBlock } from "../../shared/page-layout";
// Frozen aliases retain published layout IDs from before explicit section identities.
// Never change an existing alias when rearranging source; add a new named section instead.
export const nativeLegacyKeys = {
  "Home.hero": ".0",
  "Home.quick-actions": ".1",
  "Home.address": ".2",
  "Home.notices": ".3",
  "Home.services": ".4",
  "Home.depo": ".5",
  "Home.help": ".6",
  "CategoryPage.page-intro": ".0",
  "CategoryPage.category-grid": ".1",
  "CategoryPage.water-emergency": ".2",
  "MyHome.page-intro": ".0",
  "MyHome.address-form": ".1",
  "MyHome.schedule": ".2",
  "MyHome.shortcuts": ".3",
  "Privacy.page-intro": ".0",
  "Privacy.policy": ".1",
  "NoticesPage.introduction": ".0",
  "NoticesPage.subscription-link": ".1",
  "NoticesPage.guidance": ".2",
  "NoticesPage.svc-filter-row": ".3",
  "NoticesPage.results": ".4",
  "NoticesPage.SubscriptionForm": ".5",
  "RoadsPage.introduction": ".0",
  "RoadsPage.subscription-link": ".1",
  "RoadsPage.guidance": ".2",
  "RoadsPage.svc-road-layout": ".3",
  "RoadsPage.section-heading": ".4",
  "RoadsPage.results": ".5",
  "RoadsPage.SubscriptionForm": ".6",
  "ReportPage.introduction": ".0",
  "ReportPage.guidance": ".1",
  "ReportPage.svc-report-steps": ".2",
  "ReportPage.report-form": ".3",
  "ServicesPage.introduction": ".0",
  "ServicesPage.svc-service-tools": ".1",
  "ServicesPage.svc-service-choice-heading": ".2",
  "ServicesPage.svc-service-grid": ".3",
  "ServicesPage.svc-service-guide": ".$bulky",
  "ServicesPage.svc-two-column": ".5",
  "MarketPage.introduction": ".0",
  "MarketPage.guidance": ".1",
  "MarketPage.svc-two-column": ".2",
  "DepoPage.introduction": ".0",
  "DepoPage.svc-depo-hero": ".1",
  "DepoPage.svc-depo-grid": ".2",
  "DepoPage.svc-small": ".3",
  "ContactPage.introduction": ".0",
  "ContactPage.svc-contact-quick-paths": ".1",
  "ContactPage.svc-contact-emergency-note": ".2",
  "ContactPage.svc-contact-layout": ".3",
  "ContactPage.ContactHours": ".4",
  "ContactPage.svc-contact-foot": ".5",
  "AboutPage.introduction": ".0",
  "AboutPage.svc-about-band": ".1",
  "AboutPage.svc-service-grid": ".2",
  "AboutPage.service-information": ".3",
  "WasteMapPage.introduction": ".0",
  "WasteMapPage.notice": ".1",
  "WasteMapPage.waste-map-toolbar": ".2",
  "WasteMapPage.waste-filters": ".3",
  "WasteMapPage.location-status": ".4",
  "WasteMapPage.waste-map-layout": ".5",
  "WasteMapPage.waste-bottom-help": ".6",
  "WasteWizardPage.introduction": ".0",
  "WasteWizardPage.waste-wizard-hero": ".1",
  "WasteWizardPage.waste-filters": ".2",
  "WasteWizardPage.section-heading": ".3",
  "WasteWizardPage.results": ".4",
  "WasteWizardPage.notice": ".5",
  "CollectionPage.introduction": ".0",
  "CollectionPage.notice": ".1",
  "CollectionPage.address-form": ".2",
  "CollectionPage.schedule": ".3",
  "CollectionPage.calendar-dialog": ".4",
  "CollectionPage.waste-bottom-help": ".5",
  "CemeteryPage.cemetery-intro": ".0",
  "CemeteryPage.cemetery-panel": ".1",
  "CemeteryPage.cemetery-workspace": ".2",
  "CemeteryPage.cemetery-help": ".3",
  "UtilityCalculator.page-intro": ".0",
  "UtilityCalculator.utility-workspace": ".1",
  "UtilityCalculator.sources": ".2"
} as const;

/** The name is permanent; its frozen alias preserves previously published layouts. */
export function nativeSection(name: keyof typeof nativeLegacyKeys) {
  return `native-${contentKey(nativeLegacyKeys[name]).slice(0, 16)}`;
}

export function canonicalNativeBlocks(pathname: string, blocks?: CmsBlock[]) {
  if (!blocks || pathname !== "/storitve") return blocks;
  const guide = nativeSection("ServicesPage.svc-service-guide");
  const aliases = new Set(["septic", "water", "other"].map(service => `native-${contentKey(`.$${service}`).slice(0, 16)}`));
  const seen = new Set<string>();
  return blocks.map(block => block.type === "native" && aliases.has(block.nativeId ?? "")
    ? { ...block, nativeId: guide } : block).filter(block => {
      if (block.type !== "native" || block.nativeId !== guide) return true;
      if (seen.has(guide)) return false;
      seen.add(guide);
      return true;
    });
}
