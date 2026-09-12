import { z } from "zod";
import type { CertificateIssueRequest } from "@/lib/types";

export const generationFormSchema = z.object({
  plantId: z.string().min(2, "Enter a plant ID"),
  source: z.enum(["solar", "wind", "hydro"]),
  capacityMw: z.coerce.number().positive("Enter the plant's rated capacity"),
  energyMwh: z.coerce.number().positive("Enter the energy generated"),
  generationDateTime: z.string().min(1, "Enter the generation date and time"),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

/** Raw field values before Zod's coercion (what RHF's inputs actually hold). */
export type GenerationFormInput = z.input<typeof generationFormSchema>;
/** Coerced values after validation (what onSubmit actually receives). */
export type GenerationFormValues = z.output<typeof generationFormSchema>;

/** A one-hour reporting window starting at the reported generation time —
 * the backend's fraud pipeline needs a start/end window, the form only
 * asks for a single moment. */
export function toIssueRequest(values: GenerationFormValues, issuerId: string): CertificateIssueRequest {
  const start = new Date(values.generationDateTime);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    plant: {
      id: values.plantId,
      type: values.source,
      capacity_mw: values.capacityMw,
      lat: values.lat,
      lon: values.lon,
    },
    generation: {
      mwh_claimed: values.energyMwh,
      start: start.toISOString(),
      end: end.toISOString(),
    },
    issuer_id: issuerId,
  };
}
