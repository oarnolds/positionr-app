import { ResultBanner } from "@/components/module-result/ResultBanner";
import { ChipList } from "@/components/module-result/ChipList";
import { FactGrid } from "@/components/module-result/FactGrid";
import { ServiceFocusCard } from "@/components/module-result/ServiceFocusCard";
import type { ICPOutput } from "@/modules/icp-analyse/schema";

export function ResultView({ data }: { data: ICPOutput }) {
  return (
    <div className="space-y-5">
      <ResultBanner
        bedrijfsnaam={data.bedrijfsnaam}
        product={data.product}
        samenvatting={data.banner.samenvatting}
        sectorPositie={data.banner.sectorPositie}
        scoreLabel="Website-rijkdom"
        score={data.banner.websiteAnalyseScore}
      />

      <FactGrid
        title="Firmografisch profiel"
        facts={[
          { label: "Sector", value: data.firmografisch.sector },
          { label: "Subsector", value: data.firmografisch.subsector },
          {
            label: "Bedrijfsgrootte",
            value: data.firmografisch.bedrijfsgrootte,
          },
          {
            label: "Contactpersoon",
            value: data.firmografisch.contactpersoon,
          },
          { label: "Beslisser", value: data.firmografisch.beslisser },
          {
            label: "Contractwaarde",
            value: data.firmografisch.contractwaarde,
          },
          { label: "Geografie", value: data.firmografisch.geografie },
        ]}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <ChipList title="Pijnpunten" items={data.pijnpunten} variant="warning" />
        <ChipList title="Triggers (kopen-events)" items={data.triggers} />
      </div>

      <ServiceFocusCard
        kernBelofte={data.dienstFocus.kernBelofte}
        prijsindicatie={data.dienstFocus.prijsindicatie}
        onderscheidend={data.dienstFocus.onderscheidend}
      />
    </div>
  );
}
