"use client";
import { useEffect, useState } from "react";
import type {
  EquipmentProfile,
  MuscleProfile,
} from "@/lib/training-prescription";
interface Settings {
  targetRirMin: number | null;
  targetRirMax: number | null;
  avoidFailure: boolean;
  isAnchor: boolean;
  instruction: string | null;
  supersetGroup: string | null;
  equipmentProfile: EquipmentProfile | null;
  muscleProfile: MuscleProfile | null;
}
export default function PrescriptionSettings({
  value,
  onSave,
}: {
  value: Settings;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [loads, setLoads] = useState(
    (value.equipmentProfile?.availableLoads ?? []).join("; "),
  );
  const [direct, setDirect] = useState(
    (value.muscleProfile?.direct ?? []).join(", "),
  );
  const [indirect, setIndirect] = useState(
    (value.muscleProfile?.indirect ?? []).join(", "),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setDraft(value);
    setLoads((value.equipmentProfile?.availableLoads ?? []).join("; "));
    setDirect((value.muscleProfile?.direct ?? []).join(", "));
    setIndirect((value.muscleProfile?.indirect ?? []).join(", "));
  }, [value]);
  const equipment = draft.equipmentProfile ?? {
    machine: "",
    setup: "",
    loading: "total" as const,
    availableLoads: [],
  };
  const update = (patch: Partial<Settings>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };
  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const ladder = loads.trim()
        ? loads
            .split(";")
            .map((v) => v.trim())
            .filter(Boolean)
            .map((v) => Number(v.replace(",", ".")))
        : [];
      if (ladder.some((v) => !Number.isFinite(v) || v < 0))
        throw new Error(
          "Separate available weights with semicolons, e.g. 5; 7,5; 10",
        );
      const names = (text: string) =>
        text
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      await onSave({
        targetRirMin: draft.targetRirMin,
        targetRirMax: draft.targetRirMax,
        avoidFailure: draft.avoidFailure,
        isAnchor: draft.isAnchor,
        instruction: draft.instruction,
        supersetGroup: draft.supersetGroup,
        equipmentProfile: draft.equipmentProfile
          ? { ...equipment, availableLoads: ladder }
          : null,
        muscleProfile:
          direct.trim() || indirect.trim()
            ? { direct: names(direct), indirect: names(indirect) }
            : null,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mt-4 border-t border-border pt-3">
      <summary className="cursor-pointer py-2 text-sm font-medium">
        Effort, machine & muscle settings
      </summary>
      <fieldset disabled={busy} className="mt-3 min-w-0 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["targetRirMin", "targetRirMax"] as const).map((key, i) => (
            <label key={key} className="text-xs text-muted">
              {i ? "Maximum RIR" : "Minimum RIR"}
              <input
                className="input mt-1"
                inputMode="numeric"
                value={draft[key] ?? ""}
                onChange={(e) =>
                  update({
                    [key]:
                      e.target.value === ""
                        ? null
                        : Number(e.target.value.replace(/[^\d]/g, "")),
                  })
                }
              />
            </label>
          ))}
        </div>
        {(
          [
            ["avoidFailure", "Avoid training to failure"],
            ["isAnchor", "Use as a performance anchor"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 text-sm">
            <input
              className="h-5 w-5"
              type="checkbox"
              checked={draft[key]}
              onChange={(e) => update({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <label className="block text-xs text-muted">
          Technique instructions
          <textarea
            className="input mt-1"
            value={draft.instruction ?? ""}
            onChange={(e) => update({ instruction: e.target.value || null })}
          />
        </label>
        <label className="block text-xs text-muted">
          Superset group (optional)
          <input
            className="input mt-1"
            value={draft.supersetGroup ?? ""}
            onChange={(e) => update({ supersetGroup: e.target.value || null })}
          />
        </label>
        <label className="block text-xs text-muted">
          Machine / equipment identity
          <input
            className="input mt-1"
            placeholder="Hammer Strength incline · David Gym"
            value={equipment.machine}
            onChange={(e) =>
              update({
                equipmentProfile: { ...equipment, machine: e.target.value },
              })
            }
          />
        </label>
        <label className="block text-xs text-muted">
          Seat, pads, grip and range of motion
          <input
            className="input mt-1"
            placeholder="Seat 3, neutral grip"
            value={equipment.setup}
            onChange={(e) =>
              update({
                equipmentProfile: { ...equipment, setup: e.target.value },
              })
            }
          />
        </label>
        <label className="block text-xs text-muted">
          Weight convention
          <select
            className="input mt-1"
            value={equipment.loading}
            onChange={(e) =>
              update({
                equipmentProfile: {
                  ...equipment,
                  loading: e.target.value as EquipmentProfile["loading"],
                },
              })
            }
          >
            {[
              ["total", "Total external weight"],
              ["per_side", "Weight per side"],
              ["per_hand", "Weight per hand"],
              ["assistance", "Assistance (less is harder)"],
              ["bodyweight", "Bodyweight only"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Available weights in kg (optional)
          <input
            className="input mt-1"
            placeholder="5; 7,5; 10; 12,5"
            value={loads}
            onChange={(e) => {
              setLoads(e.target.value);
              update({ equipmentProfile: equipment });
            }}
          />
          <span>
            Separate weights with semicolons. Empty uses the configured
            increment.
          </span>
        </label>
        <label className="block text-xs text-muted">
          Direct muscles
          <input
            className="input mt-1"
            placeholder="Chest"
            value={direct}
            onChange={(e) => {
              setDirect(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label className="block text-xs text-muted">
          Indirect muscles
          <input
            className="input mt-1"
            placeholder="Triceps, Front delts"
            value={indirect}
            onChange={(e) => {
              setIndirect(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <p className="text-xs text-muted">
          Separate muscles with commas. Indirect sets are shown separately, with
          an optional half-set estimate. Setup and effort changes establish a
          new progression baseline.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button type="button" onClick={save} className="btn-primary w-full">
          {busy ? "Saving…" : saved ? "Settings saved" : "Save settings"}
        </button>
      </fieldset>
    </details>
  );
}
