/**
 * AMS (Automatic Material System) helper utilities for Bambu Lab printers.
 * These functions handle color normalization, slot labeling, and tray ID calculations
 * for AMS, AMS-HT, and external spool configurations.
 */
import { parseUTCDate } from './date';

/**
 * Normalize color format from various sources.
 * API returns "RRGGBBAA" (8-char), 3MF uses "#RRGGBB" (7-char with hash).
 * This normalizes to "#RRGGBB" format.
 */
export function normalizeColor(color: string | null | undefined): string {
  if (!color) return '#808080';
  // Remove alpha channel if present (8-char hex to 6-char)
  const hex = color.replace('#', '').substring(0, 6);
  return `#${hex}`;
}

/**
 * Normalize color for comparison (case-insensitive, strip hash and alpha).
 */
export function normalizeColorForCompare(color: string | undefined): string {
  if (!color) return '';
  return color.replace('#', '').toLowerCase().substring(0, 6);
}

/**
 * Filament type equivalence groups.
 * Types within the same group are interchangeable on the printer side
 * (e.g., Bambu Lab firmware treats PA-CF and PA12-CF as compatible).
 */
const FILAMENT_TYPE_GROUPS: string[][] = [
  ['PA-CF', 'PA12-CF', 'PAHT-CF'],
];

const _equivalenceMap: Record<string, string> = {};
for (const group of FILAMENT_TYPE_GROUPS) {
  const canonical = group[0];
  for (const t of group) {
    _equivalenceMap[t.toUpperCase()] = canonical.toUpperCase();
  }
}

/**
 * Get the canonical filament type for equivalence matching.
 * Types in the same group (e.g., PA-CF / PA12-CF / PAHT-CF) return the same canonical type.
 */
export function canonicalFilamentType(type: string | undefined): string {
  if (!type) return '';
  const upper = type.toUpperCase();
  return _equivalenceMap[upper] ?? upper;
}

/**
 * Check if two filament types are compatible (same type or same equivalence group).
 */
export function filamentTypesCompatible(a: string | undefined, b: string | undefined): boolean {
  return canonicalFilamentType(a) === canonicalFilamentType(b);
}

/**
 * Per-channel RGB tolerance for treating two colors as the same filament.
 * Tightened from 40: at 40 a typical library's greys chain together
 * (#545454<->#757575 = 33, #757575<->#808080 = 11, #000000<->#161616 = 22), so
 * "close enough" matches were consuming trays that a later slot matched exactly.
 * Raise this if RFID-reported tray colors drift far enough from the slicer's
 * profile color that legitimate slots start coming back unmapped.
 *
 * Keep in sync with SIMILAR_COLOR_THRESHOLD in backend/app/services/print_scheduler.py.
 */
export const SIMILAR_COLOR_THRESHOLD = 20;

/**
 * Parse a hex color into RGB components, or null when it isn't parseable.
 */
export function parseRgb(color: string | undefined): [number, number, number] | null {
  const hex = normalizeColorForCompare(color);
  if (hex.length < 6) return null;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

/**
 * Check if two colors are visually similar within a threshold.
 * Uses RGB component comparison with configurable tolerance.
 * @param color1 - First hex color
 * @param color2 - Second hex color
 * @param threshold - Maximum difference per RGB component
 */
export function colorsAreSimilar(
  color1: string | undefined,
  color2: string | undefined,
  threshold = SIMILAR_COLOR_THRESHOLD
): boolean {
  const rgb1 = parseRgb(color1);
  const rgb2 = parseRgb(color2);
  if (!rgb1 || !rgb2) return false;

  return rgb1.every((c, i) => Math.abs(c - rgb2[i]) <= threshold);
}

/**
 * Euclidean RGB distance, or Infinity when either color is unparseable.
 * Only used to break ties between candidates of equal quality, so an
 * unparseable color sorts last rather than being rejected outright.
 */
export function colorDistance(
  color1: string | undefined,
  color2: string | undefined
): number {
  const rgb1 = parseRgb(color1);
  const rgb2 = parseRgb(color2);
  if (!rgb1 || !rgb2) return Infinity;
  return Math.sqrt(rgb1.reduce((sum, c, i) => sum + (c - rgb2[i]) ** 2, 0));
}

/**
 * Format slot label for display in the UI.
 * @param amsId - AMS unit ID (0-3 for regular AMS, 128+ for AMS-HT)
 * @param trayId - Tray/slot ID within the AMS unit (0-3)
 * @param isHt - Whether this is an AMS-HT unit (single tray)
 * @param isExternal - Whether this is the external spool holder
 */
export function formatSlotLabel(
  amsId: number,
  trayId: number,
  isHt: boolean,
  isExternal: boolean
): string {
  if (isExternal) return 'Ext';
  // Convert AMS ID to letter (A, B, C, D)
  // AMS-HT uses IDs starting at 128
  const letter = String.fromCharCode(65 + (amsId >= 128 ? amsId - 128 : amsId));
  if (isHt) return `HT-${letter}`;
  return `${letter}${trayId + 1}`;
}

/**
 * Calculate global tray ID for MQTT command.
 * Used in the ams_mapping array sent to the printer.
 * @param amsId - AMS unit ID (0-3 for regular AMS, 128+ for AMS-HT)
 * @param trayId - Tray/slot ID within the AMS unit
 * @param isExternal - Whether this is the external spool holder
 * @returns Global tray ID (0-15 for AMS, 128+ for AMS-HT, 254 for external)
 */
export function getGlobalTrayId(
  amsId: number,
  trayId: number,
  isExternal: boolean
): number {
  if (isExternal) return 254 + trayId;
  // AMS-HT units have IDs starting at 128 with a single tray — use ID directly
  if (amsId >= 128) return amsId;
  return amsId * 4 + trayId;
}

/**
 * Get fill bar color based on spool fill level.
 * Matches PrintersPage thresholds and Bambu Lab brand green.
 */
export function getFillBarColor(fillLevel: number): string {
  if (fillLevel > 50) return '#00ae42'; // Green - good
  if (fillLevel >= 15) return '#f59e0b'; // Amber - warning (<= 50%)
  return '#ef4444'; // Red - critical (< 15%)
}

/**
 * Calculate fill level from Spoolman weight data.
 * Used as the first source in the Spoolman → Inventory → AMS fill chain.
 */
export function getSpoolmanFillLevel(
  linkedSpool: { remaining_weight: number | null; filament_weight: number | null } | undefined
): number | null {
  if (!linkedSpool?.remaining_weight || !linkedSpool?.filament_weight
      || linkedSpool.filament_weight <= 0) return null;
  return Math.min(100, Math.round(
    (linkedSpool.remaining_weight / linkedSpool.filament_weight) * 100
  ));
}

function toFixedHex(value: number, width: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  return safe.toString(16).toUpperCase().padStart(width, '0').slice(-width);
}

// 32-bit FNV-1a hash -> 8-char hex (stable for alphanumeric serials)
function hashSerialToHex32(serial: string): string {
  const input = (serial || '').trim().toUpperCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Generate a stable fallback spool tag for slots without RFID identifiers.
 * Returns a 16-char hex string derived from the printer serial + slot position.
 */
export function getFallbackSpoolTag(printerSerial: string, amsId: number, trayId: number): string {
  return `${hashSerialToHex32(printerSerial)}${toFixedHex(amsId, 4)}${toFixedHex(trayId, 4)}`;
}

/**
 * Get minimum datetime for scheduling (now + 1 minute).
 * Returns ISO string format for datetime-local input.
 */
export function getMinDateTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  return now.toISOString().slice(0, 16);
}

/**
 * Check if a scheduled time is a placeholder far-future date.
 * Placeholder dates (more than 6 months out) are treated as ASAP.
 */
export function isPlaceholderDate(scheduledTime: string | null | undefined): boolean {
  if (!scheduledTime) return false;
  const sixMonthsFromNow = Date.now() + 180 * 24 * 60 * 60 * 1000;
  return (parseUTCDate(scheduledTime)?.getTime() ?? 0) > sixMonthsFromNow;
}

/**
 * Auto-match a filament requirement to a loaded filament, respecting nozzle constraints.
 * Used by both single-printer (FilamentMapping) and multi-printer (InlineMappingEditor) paths.
 */
export function autoMatchFilament(
  req: { type?: string; color?: string; nozzle_id?: number | null },
  loadedFilaments: { globalTrayId: number; type?: string; color?: string; extruderId?: number; remain?: number }[],
  usedTrayIds: Set<number>,
  preferLowest?: boolean,
): typeof loadedFilaments[number] | undefined {
  let nozzleFilaments = filterFilamentsByNozzle(loadedFilaments, req.nozzle_id);

  if (preferLowest) {
    nozzleFilaments = [...nozzleFilaments].sort((a, b) => {
      const ra = (a.remain ?? -1) >= 0 ? (a.remain ?? -1) : 101;
      const rb = (b.remain ?? -1) >= 0 ? (b.remain ?? -1) : 101;
      return ra - rb;
    });
  }

  const exactMatch = nozzleFilaments.find(
    (f) =>
      !usedTrayIds.has(f.globalTrayId) &&
      filamentTypesCompatible(f.type, req.type) &&
      normalizeColorForCompare(f.color) === normalizeColorForCompare(req.color)
  );
  const similarMatch = exactMatch
    ? undefined
    : nozzleFilaments.find(
        (f) =>
          !usedTrayIds.has(f.globalTrayId) &&
          filamentTypesCompatible(f.type, req.type) &&
          colorsAreSimilar(f.color, req.color)
      );
  // No "same type, any color" fallback: handing a slot an arbitrary same-type
  // spool made printers look capable of a job they'd print in the wrong color.
  // An unmatched slot is reported as unmatched instead.
  return exactMatch ?? similarMatch;
}

/**
 * Filter loaded filaments to those valid for a given nozzle requirement.
 * For single-nozzle printers (nozzle_id is null/undefined), returns all filaments.
 */
export function filterFilamentsByNozzle<T extends { extruderId?: number }>(
  loadedFilaments: T[],
  nozzleId: number | undefined | null,
): T[] {
  return loadedFilaments.filter(
    (f) => nozzleId == null || f.extruderId === nozzleId
  );
}

/**
 * Detect Bambu Lab RFID-tagged spool by tray_uuid (32 hex) or tag_uid (16 hex).
 *
 * Permissive zero-string check: any non-zero non-empty value returns true. The
 * function exists to suppress assign/unassign actions on RFID-managed slots
 * whose state is owned by the printer firmware — manual changes there would be
 * overwritten on the next RFID re-read (eye → pen icon in BambuStudio).
 */
export function isBambuLabSpool(tray: {
  tray_uuid?: string | null;
  tag_uid?: string | null;
} | null | undefined): boolean {
  if (!tray) return false;
  if (tray.tray_uuid && tray.tray_uuid !== '00000000000000000000000000000000') return true;
  if (tray.tag_uid && tray.tag_uid !== '0000000000000000') return true;
  return false;
}
