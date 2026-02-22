import {
  parseExtraction,
  parseListing,
  parsePricing,
  parseProduct,
} from "@/lib/researchSchemas";
import type { Doc } from "../../../convex/_generated/dataModel";

type ResearchJob = Doc<"productResearch">;

interface ResearchDetailProps {
  research: ResearchJob;
}

export function ResearchDetail({ research }: ResearchDetailProps) {
  const product = parseProduct(research.product);
  const pricing = parsePricing(research.pricing);
  const listing = parseListing(research.listing);
  const extraction = parseExtraction(research.extraction);
  const currency = pricing.currency ?? "USD";

  return (
    <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
      <h3 className="text-lg font-semibold text-[var(--color-text)]">
        {listing.title ?? product.name ?? "Research Detail"}
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoTile label="Brand" value={product.brand} />
        <InfoTile label="Model" value={product.model} />
        <InfoTile label="Category" value={product.category} />
        <InfoTile
          label="Recommended Price"
          value={formatCurrency(pricing.recommended.price, currency)}
        />
      </div>

      <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-subtle)]">Title</p>
        <p className="text-sm text-[var(--color-text)]">{listing.title ?? "N/A"}</p>
      </div>
      <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-subtle)]">
          Description
        </p>
        <p className="whitespace-pre-line text-sm text-[var(--color-text)]">
          {listing.description ?? "N/A"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoTile label="Condition (seller)" value={research.condition} />
        <InfoTile label="Condition (AI)" value={extraction.condition} />
        <InfoTile label="Highlights" value={formatList(listing.highlights)} />
        <InfoTile label="Visible Wear" value={formatList(extraction.visible_wear)} />
      </div>
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-subtle)]">{label}</p>
      <p className="text-sm text-[var(--color-text)]">{value ?? "N/A"}</p>
    </div>
  );
}

function formatCurrency(value: number | null, currency: string) {
  if (value === null) return "N/A";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatList(values?: string[] | null) {
  if (!values || values.length === 0) return "N/A";
  return values.join(", ");
}
