import { useMemo } from 'react';
import { getColorName } from '../utils/colors';
import {
  normalizeColor,
  normalizeColorForCompare,
  colorsAreSimilar,
  colorDistance,
  filamentTypesCompatible,
  formatSlotLabel,
  getGlobalTrayId,
} from '../utils/amsHelpers';
import type { PrinterStatus } from '../api/client';

/**
 * Build loaded filaments list from printer status (non-hook version).
 * Extracts filaments from all AMS units (regular and HT) and external spool.
 */
export function buildLoadedFilaments(printerStatus: PrinterStatus | undefined): LoadedFilament[] {
  const filaments: LoadedFilament[] = [];
  const amsExtruderMap = printerStatus?.ams_extruder_map;
  const hasDualNozzle = amsExtruderMap && Object.keys(amsExtruderMap).length > 0;

  // Add filaments from all AMS units (regular and HT)
  printerStatus?.ams?.forEach((amsUnit) => {
    const isHt = amsUnit.tray.length === 1; // AMS-HT has single tray
    amsUnit.tray.forEach((tray) => {
      if (tray.tray_type) {
        const color = normalizeColor(tray.tray_color);
        filaments.push({
          type: tray.tray_type,
          color,
          colorName: getColorName(color),
          amsId: amsUnit.id,
          trayId: tray.id,
          isHt,
          isExternal: false,
          label: formatSlotLabel(amsUnit.id, tray.id, isHt, false),
          globalTrayId: getGlobalTrayId(amsUnit.id, tray.id, false),
          trayInfoIdx: tray.tray_info_idx || '',
          traySubBrands: tray.tray_sub_brands || '',
          extruderId: amsExtruderMap?.[String(amsUnit.id)],
          remain: tray.remain ?? -1,
        });
      }
    });
  });

  // Add external spool(s) if loaded
  for (const extTray of printerStatus?.vt_tray ?? []) {
    if (extTray.tray_type) {
      const color = normalizeColor(extTray.tray_color);
      const trayId = extTray.id ?? 254;
      const hasDualExternal = (printerStatus?.vt_tray?.length ?? 0) > 1;
      filaments.push({
        type: extTray.tray_type,
        color,
        colorName: getColorName(color),
        amsId: -1,
        trayId: trayId - 254,
        isHt: false,
        isExternal: true,
        label: hasDualExternal ? (trayId === 254 ? 'Ext-L' : 'Ext-R') : 'External',
        globalTrayId: trayId,
        trayInfoIdx: extTray.tray_info_idx || '',
        traySubBrands: extTray.tray_sub_brands || '',
        extruderId: hasDualNozzle ? (255 - trayId) : undefined,
        remain: extTray.remain ?? -1,
      });
    }
  }

  return filaments;
}

/**
 * Candidate quality tiers for a (required filament, loaded tray) pair — lower is
 * stronger evidence. Primary sort key when resolving the slot<->tray assignment;
 * color distance breaks ties within a tier.
 *
 * There is deliberately no "same type, any color" tier. Assigning an arbitrary
 * same-type tray to a slot whose color is nowhere on the printer produced
 * silently wrong-colored prints — the slot is left unmapped instead.
 *
 * Keep in sync with the _TIER_* constants in backend/app/services/print_scheduler.py.
 */
const TIER_IDX_AND_EXACT = 0; // same sliced preset AND same color
const TIER_SOLE_IDX = 1; // the only tray carrying the sliced preset
const TIER_EXACT = 2; // same color
const TIER_IDX_AND_SIMILAR = 3; // same sliced preset, near-identical color
const TIER_SIMILAR = 4; // near-identical color

/**
 * Rank how strongly `tray` matches what `req` asks for, or null when the tray is
 * not an acceptable substitute at all.
 */
function candidateTier(
  req: FilamentRequirement,
  tray: LoadedFilament,
  soleIdx: Set<string>
): number | null {
  if (!filamentTypesCompatible(tray.type, req.type)) return null;

  const reqIdx = req.tray_info_idx || '';
  const sameIdx = reqIdx !== '' && tray.trayInfoIdx === reqIdx;
  const exact = normalizeColorForCompare(tray.color) === normalizeColorForCompare(req.color);

  if (sameIdx && exact) return TIER_IDX_AND_EXACT;
  // Only one loaded tray carries the preset this slot was sliced with, so the
  // preset identifies it even when the reported color drifts (RFID tray color
  // vs the slicer profile's color).
  if (sameIdx && soleIdx.has(reqIdx)) return TIER_SOLE_IDX;
  if (exact) return TIER_EXACT;
  if (colorsAreSimilar(tray.color, req.color)) {
    return sameIdx ? TIER_IDX_AND_SIMILAR : TIER_SIMILAR;
  }
  return null;
}

/**
 * Compute AMS mapping for a printer given filament requirements and printer status.
 * This is a non-hook version that can be called imperatively (e.g., in a loop for multiple printers).
 *
 * Every (slot, tray) pair is scored first, then the assignment is resolved
 * globally best-first: the strongest evidence claims its tray before any weaker
 * candidate gets a turn. Walking slots in order and letting each take its own
 * best remaining tray meant an approximate color match on an early slot could
 * consume the very tray a later slot matched exactly — on a printer loaded with
 * four spools of one preset that reliably produced wrong-colored multi-color prints.
 *
 * A slot with no acceptable tray stays at -1 rather than being handed an
 * arbitrary same-type spool, so the UI can show it as unmatched.
 *
 * The tray_info_idx is a filament preset identifier stored in the 3MF when the
 * user slices (e.g. "GFA00" for Bambu PLA Basic, "P4d64437" for a custom preset).
 * When exactly one loaded tray carries the sliced preset it identifies that tray
 * on its own, even if the reported color drifts.
 *
 * Mirrors _match_filaments_to_slots in backend/app/services/print_scheduler.py.
 *
 * @param filamentReqs - Required filaments from the 3MF file
 * @param printerStatus - Current printer status with AMS information
 * @param preferLowest - Prefer the lowest-remaining spool among equally good candidates
 * @returns AMS mapping array or undefined if no mapping needed
 */
export function computeAmsMapping(
  filamentReqs: { filaments: FilamentRequirement[] } | undefined,
  printerStatus: PrinterStatus | undefined,
  preferLowest?: boolean,
): number[] | undefined {
  if (!filamentReqs?.filaments || filamentReqs.filaments.length === 0) return undefined;

  const loadedFilaments = buildLoadedFilaments(printerStatus);
  if (loadedFilaments.length === 0) return undefined;

  // FTS routes any AMS slot to any extruder, so per-nozzle slot restriction
  // doesn't apply when it's installed (#1162).
  const ftsActive = printerStatus?.fila_switch?.installed === true;

  // Presets carried by exactly one loaded tray. Computed over all loaded trays
  // rather than the not-yet-used ones so the result doesn't depend on the order
  // slots happen to be resolved in.
  const idxCounts = new Map<string, number>();
  loadedFilaments.forEach((f) => {
    if (f.trayInfoIdx) idxCounts.set(f.trayInfoIdx, (idxCounts.get(f.trayInfoIdx) ?? 0) + 1);
  });
  const soleIdx = new Set(
    [...idxCounts.entries()].filter(([, count]) => count === 1).map(([idx]) => idx)
  );

  // Score every acceptable pairing, then sort so the best evidence wins.
  // Tie-break order after (tier, color distance): remaining filament when
  // preferLowest is on, then slot_id and tray id to keep the result
  // deterministic for identical input.
  interface Candidate {
    tier: number;
    distance: number;
    remain: number;
    slotId: number;
    trayId: number;
  }
  const candidates: Candidate[] = [];

  filamentReqs.filaments.forEach((req) => {
    const slotId = req.slot_id || 0;

    // Nozzle-aware filtering: restrict to trays on the correct nozzle. This is a
    // hard filter — cross-nozzle assignment causes print failures ("position of
    // left hotend is abnormal"), so we never fall back to wrong-nozzle trays.
    // Skip when an FTS is installed: it can route any slot to either extruder.
    const eligible =
      req.nozzle_id != null && !ftsActive
        ? loadedFilaments.filter((f) => f.extruderId === req.nozzle_id)
        : loadedFilaments;

    eligible.forEach((tray) => {
      const tier = candidateTier(req, tray, soleIdx);
      if (tier === null) return;
      const remain = tray.remain >= 0 ? tray.remain : 101;
      candidates.push({
        tier,
        distance: colorDistance(tray.color, req.color),
        remain: preferLowest ? remain : 0,
        slotId,
        trayId: tray.globalTrayId,
      });
    });
  });

  candidates.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.distance - b.distance ||
      a.remain - b.remain ||
      a.slotId - b.slotId ||
      a.trayId - b.trayId
  );

  const assigned = new Map<number, number>();
  const usedTrayIds = new Set<number>();
  candidates.forEach(({ slotId, trayId }) => {
    if (assigned.has(slotId) || usedTrayIds.has(trayId)) return;
    assigned.set(slotId, trayId);
    usedTrayIds.add(trayId);
  });

  // Find the max slot_id to determine array size
  const maxSlotId = Math.max(...filamentReqs.filaments.map((f) => f.slot_id || 0));
  if (maxSlotId <= 0) return undefined;

  // Create array with -1 for all positions, then fill in the resolved trays
  const mapping = new Array(maxSlotId).fill(-1);
  assigned.forEach((trayId, slotId) => {
    if (slotId > 0) mapping[slotId - 1] = trayId;
  });

  return mapping;
}

/**
 * Represents a loaded filament in the printer's AMS/HT/External spool holder.
 */
export interface LoadedFilament {
  type: string;
  color: string;
  colorName: string;
  amsId: number;
  trayId: number;
  isHt: boolean;
  isExternal: boolean;
  label: string;
  globalTrayId: number;
  /** Unique spool identifier (e.g., "GFA00", "P4d64437") */
  trayInfoIdx?: string;
  /** Filament subtype name (e.g., "PLA Basic", "PLA Matte", "PETG HF") */
  traySubBrands?: string;
  /** Extruder ID for dual-nozzle printers (0=right, 1=left) */
  extruderId?: number;
  /** Remaining filament percentage (0-100), -1 = unknown */
  remain: number;
}

/**
 * Represents a required filament from the 3MF file.
 */
export interface FilamentRequirement {
  slot_id: number;
  type: string;
  color: string;
  used_grams: number;
  /** Unique spool identifier from slicing (e.g., "GFA00", "P4d64437") */
  tray_info_idx?: string;
  /** Target nozzle for dual-nozzle printers (0=right, 1=left) */
  nozzle_id?: number;
}

/**
 * Status of filament comparison between required and loaded.
 */
export type FilamentStatus = 'match' | 'type_only' | 'mismatch' | 'empty';

/**
 * Result of comparing a required filament with loaded filaments.
 */
export interface FilamentComparison extends FilamentRequirement {
  loaded: LoadedFilament | undefined;
  hasFilament: boolean;
  typeMatch: boolean;
  colorMatch: boolean;
  status: FilamentStatus;
  isManual: boolean;
}

interface FilamentRequirementsResponse {
  filaments: FilamentRequirement[];
}

interface UseFilamentMappingResult {
  /** List of all filaments loaded in the printer */
  loadedFilaments: LoadedFilament[];
  /** Comparison results for each required filament */
  filamentComparison: FilamentComparison[];
  /** AMS mapping array for the print command */
  amsMapping: number[] | undefined;
  /** Whether any required filament type is not loaded */
  hasTypeMismatch: boolean;
  /** Whether any required filament has a color mismatch */
  hasColorMismatch: boolean;
}

/**
 * Hook to build loaded filaments list from printer status.
 * Extracts filaments from all AMS units (regular and HT) and external spool.
 */
export function useLoadedFilaments(
  printerStatus: PrinterStatus | undefined
): LoadedFilament[] {
  return useMemo(() => {
    return buildLoadedFilaments(printerStatus);
  }, [printerStatus]);
}

/**
 * Hook to compare required filaments with loaded filaments and build AMS mapping.
 * Handles both auto-matching and manual overrides.
 *
 * @param filamentReqs - Required filaments from the 3MF file
 * @param printerStatus - Current printer status with AMS information
 * @param manualMappings - Manual slot overrides (slot_id -> globalTrayId)
 */
export function useFilamentMapping(
  filamentReqs: FilamentRequirementsResponse | undefined,
  printerStatus: PrinterStatus | undefined,
  manualMappings: Record<number, number>,
  preferLowest?: boolean,
): UseFilamentMappingResult {
  const loadedFilaments = useLoadedFilaments(printerStatus);

  // FTS routes any AMS slot to any extruder, so per-nozzle slot restriction
  // doesn't apply when it's installed (#1162).
  const ftsActive = printerStatus?.fila_switch?.installed === true;

  const filamentComparison = useMemo(() => {
    if (!filamentReqs?.filaments || filamentReqs.filaments.length === 0) return [];

    const reqs = filamentReqs.filaments;

    // Manually assigned trays are off the table for auto-matching.
    const usedTrayIds = new Set<number>(Object.values(manualMappings));

    const isManual = (req: FilamentRequirement) => {
      const slotId = req.slot_id || 0;
      return (
        slotId > 0 &&
        manualMappings[slotId] !== undefined &&
        loadedFilaments.some((f) => f.globalTrayId === manualMappings[slotId])
      );
    };

    // Trays this slot is allowed to be routed to at all. Nozzle-aware filtering
    // is a hard filter — cross-nozzle assignment causes print failures. Skip it
    // when an FTS is installed: it can route any slot to either extruder.
    const nozzleEligibleFor = (req: FilamentRequirement) =>
      loadedFilaments.filter(
        (f) => req.nozzle_id == null || ftsActive || f.extruderId === req.nozzle_id
      );

    // Of those, the ones not already claimed. Reads `usedTrayIds` live, so call
    // it only while building candidates — afterwards the set covers every
    // assignment and the result no longer means "available to this slot".
    const availableFor = (req: FilamentRequirement) =>
      nozzleEligibleFor(req).filter((f) => !usedTrayIds.has(f.globalTrayId));

    // Presets carried by exactly one loaded tray — see computeAmsMapping.
    const idxCounts = new Map<string, number>();
    loadedFilaments.forEach((f) => {
      if (f.trayInfoIdx) idxCounts.set(f.trayInfoIdx, (idxCounts.get(f.trayInfoIdx) ?? 0) + 1);
    });
    const soleIdx = new Set(
      [...idxCounts.entries()].filter(([, count]) => count === 1).map(([idx]) => idx)
    );

    // Resolve the auto-matched slots globally best-first, same as computeAmsMapping:
    // score every acceptable (slot, tray) pairing, then let the strongest evidence
    // claim its tray before any weaker candidate gets a turn. Resolving slot by
    // slot let an approximate colour match on an early slot consume the tray a
    // later slot matched exactly.
    const candidates: {
      tier: number;
      distance: number;
      remain: number;
      slotId: number;
      trayId: number;
    }[] = [];

    reqs.forEach((req) => {
      if (isManual(req)) return;
      const slotId = req.slot_id || 0;
      availableFor(req).forEach((tray) => {
        const tier = candidateTier(req, tray, soleIdx);
        if (tier === null) return;
        const remain = tray.remain >= 0 ? tray.remain : 101;
        candidates.push({
          tier,
          distance: colorDistance(tray.color, req.color),
          remain: preferLowest ? remain : 0,
          slotId,
          trayId: tray.globalTrayId,
        });
      });
    });

    candidates.sort(
      (a, b) =>
        a.tier - b.tier ||
        a.distance - b.distance ||
        a.remain - b.remain ||
        a.slotId - b.slotId ||
        a.trayId - b.trayId
    );

    const autoAssigned = new Map<number, number>();
    candidates.forEach(({ slotId, trayId }) => {
      if (autoAssigned.has(slotId) || usedTrayIds.has(trayId)) return;
      autoAssigned.set(slotId, trayId);
      usedTrayIds.add(trayId);
    });

    return reqs.map((req) => {
      const slotId = req.slot_id || 0;

      // Check if there's a manual override for this slot
      if (slotId > 0 && manualMappings[slotId] !== undefined) {
        const manualTrayId = manualMappings[slotId];
        const manualLoaded = loadedFilaments.find((f) => f.globalTrayId === manualTrayId);

        if (manualLoaded) {
          const typeMatch = manualLoaded.type?.toUpperCase() === req.type?.toUpperCase();
          const colorMatch =
            normalizeColorForCompare(manualLoaded.color) === normalizeColorForCompare(req.color) ||
            colorsAreSimilar(manualLoaded.color, req.color);

          let status: FilamentStatus;
          if (typeMatch && colorMatch) {
            status = 'match';
          } else if (typeMatch) {
            status = 'type_only';
          } else {
            status = 'mismatch';
          }

          return {
            ...req,
            loaded: manualLoaded,
            hasFilament: true,
            typeMatch,
            colorMatch,
            status,
            isManual: true,
          };
        }
      }

      const autoTrayId = autoAssigned.get(slotId);
      const loaded =
        autoTrayId === undefined
          ? undefined
          : loadedFilaments.find((f) => f.globalTrayId === autoTrayId);

      // An unmatched slot is reported, never filled with an arbitrary same-type
      // spool — that silently printed the wrong colour. 'type_only' means "the
      // right material is loaded but nothing close enough in colour", which the
      // UI shows as an empty, highlighted dropdown for the user to resolve.
      let status: FilamentStatus;
      if (loaded) {
        status = 'match';
      } else if (nozzleEligibleFor(req).some((f) => filamentTypesCompatible(f.type, req.type))) {
        status = 'type_only';
      } else {
        status = 'mismatch';
      }

      return {
        ...req,
        loaded,
        hasFilament: !!loaded,
        typeMatch: !!loaded,
        colorMatch: !!loaded,
        status,
        isManual: false,
      };
    });
  }, [filamentReqs, loadedFilaments, manualMappings, preferLowest, ftsActive]);

  // Build AMS mapping from matched filaments
  // Format: array matching 3MF filament slot structure
  // Position = slot_id - 1 (0-indexed), value = global tray ID or -1 for unused
  const amsMapping = useMemo(() => {
    if (filamentComparison.length === 0) return undefined;

    // Find the max slot_id to determine array size
    const maxSlotId = Math.max(...filamentComparison.map((f) => f.slot_id || 0));
    if (maxSlotId <= 0) return undefined;

    // Create array with -1 for all positions
    const mapping = new Array(maxSlotId).fill(-1);

    // Fill in tray IDs at correct positions (slot_id - 1)
    filamentComparison.forEach((f) => {
      if (f.slot_id && f.slot_id > 0) {
        mapping[f.slot_id - 1] = f.loaded?.globalTrayId ?? -1;
      }
    });

    return mapping;
  }, [filamentComparison]);

  const hasTypeMismatch = filamentComparison.some((f) => f.status === 'mismatch');
  const hasColorMismatch = filamentComparison.some((f) => f.status === 'type_only');

  return {
    loadedFilaments,
    filamentComparison,
    amsMapping,
    hasTypeMismatch,
    hasColorMismatch,
  };
}
