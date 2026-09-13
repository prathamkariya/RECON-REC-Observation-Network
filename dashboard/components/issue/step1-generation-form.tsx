"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  generationFormSchema,
  type GenerationFormInput,
  type GenerationFormValues,
} from "@/components/issue/schema";

export function Step1GenerationForm({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: Partial<GenerationFormInput>;
  onSubmit: (values: GenerationFormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GenerationFormInput, unknown, GenerationFormValues>({
    resolver: zodResolver(generationFormSchema),
    defaultValues: { source: "solar", ...defaultValues },
  });

  const source = watch("source");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass glass-medium space-y-5 rounded-2xl p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="plantId">Plant ID</Label>
          <Input id="plantId" placeholder="SUNFIELD-04" {...register("plantId")} />
          {errors.plantId && <p className="text-xs text-risk">{errors.plantId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="source">Source</Label>
          <Select value={source} onValueChange={(v) => setValue("source", v as GenerationFormValues["source"])}>
            <SelectTrigger id="source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solar">Solar</SelectItem>
              <SelectItem value="wind">Wind</SelectItem>
              <SelectItem value="hydro">Hydro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="capacityMw">Plant rated capacity (MW)</Label>
          <Input id="capacityMw" type="number" step="any" placeholder="50" {...register("capacityMw")} />
          {errors.capacityMw && <p className="text-xs text-risk">{errors.capacityMw.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="energyMwh">Energy generated (MWh)</Label>
          <Input id="energyMwh" type="number" step="any" placeholder="120" {...register("energyMwh")} />
          {errors.energyMwh && <p className="text-xs text-risk">{errors.energyMwh.message}</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="generationDateTime">Generation date &amp; time</Label>
          <Input id="generationDateTime" type="datetime-local" {...register("generationDateTime")} />
          {errors.generationDateTime && <p className="text-xs text-risk">{errors.generationDateTime.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lat">Latitude</Label>
          <Input id="lat" type="number" step="any" placeholder="23.03" {...register("lat")} />
          {errors.lat && <p className="text-xs text-risk">{errors.lat.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lon">Longitude</Label>
          <Input id="lon" type="number" step="any" placeholder="72.58" {...register("lon")} />
          {errors.lon && <p className="text-xs text-risk">{errors.lon.message}</p>}
        </div>
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        Continue to AI analysis
      </Button>
    </form>
  );
}
