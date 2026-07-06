import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Layers, Printer as PrinterIcon } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Printer, PrinterStatus } from '../../api/client';
import { api } from '../../api/client';
import { useFilamentMapping } from '../../hooks/useFilamentMapping';
import {
  useMultiPrinterFilamentMapping,
  type PerPrinterConfig,
} from '../../hooks/useMultiPrinterFilamentMapping';
import { getColorName } from '../../utils/colors';
import { FilamentMapping } from './FilamentMapping';
import { FilamentOverride } from './FilamentOverride';
import { PrinterSelector } from './PrinterSelector';
import type { AssignmentMode, FilamentReqsData, PlateInfo } from './types';

export interface PlateConfigurationState {
  selectedPrinters: number[];
  quantity: number;
  manualMappings: Record<number, number>;
  perPrinterConfigs: Record<number, PerPrinterConfig>;
  assignmentMode: AssignmentMode;
  targetModel: string | null;
  targetLocation: string | null;
  filamentOverrides: Record<number, { type: string; color: string }>;
  forceColorMatch: Record<number, boolean>;
}

export interface PlateConfigurationSnapshot {
  selectedPrinters: number[];
  quantity: number;
  assignmentMode: AssignmentMode;
  targetModel: string | null;
  targetLocation: string | null;
  filamentReqs: FilamentReqsData | undefined;
  filamentOverrides: Array<{
    slot_id: number;
    type: string;
    color: string;
    color_name: string;
    force_color_match: boolean;
  }> | undefined;
  getMappingForPrinter: (printerId: number) => number[] | undefined;
  getPrinterStatus: (printerId: number) => PrinterStatus | undefined;
}

export interface PlateConfigurationHandle {
  getSnapshot: () => PlateConfigurationSnapshot;
}

interface PlateConfigurationProps {
  plate: PlateInfo;
  config: PlateConfigurationState;
  onChange: (updates: Partial<PlateConfigurationState>) => void;
  archiveId?: number;
  libraryFileId?: number;
  isLibraryFile: boolean;
  printers: Printer[];
  isLoadingPrinters: boolean;
  slicedForModel: string | null;
  preferLowestFilament?: boolean;
  defaultExpanded?: boolean;
  mappingDefaultExpanded?: boolean;
  currencySymbol: string;
  defaultCostPerKg: number;
}

/**
 * One independently configurable plate in a multi-plate queue operation.
 *
 * Print options and scheduling intentionally live in the parent modal so they
 * remain shared by every selected plate.
 */
export const PlateConfiguration = forwardRef<PlateConfigurationHandle, PlateConfigurationProps>(
  function PlateConfiguration(
    {
      plate,
      config,
      onChange,
      archiveId,
      libraryFileId,
      isLibraryFile,
      printers,
      isLoadingPrinters,
      slicedForModel,
      preferLowestFilament,
      defaultExpanded = false,
      mappingDefaultExpanded = false,
      currencySymbol,
      defaultCostPerKg,
    },
    ref,
  ) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const { data: filamentReqs, isError: filamentReqsError } = useQuery<FilamentReqsData>({
      queryKey: isLibraryFile
        ? ['library-file-filaments', libraryFileId, plate.index]
        : ['archive-filaments', archiveId, plate.index],
      queryFn: async () => {
        const response = isLibraryFile
          ? await api.getLibraryFileFilamentRequirements(libraryFileId!, plate.index)
          : await api.getArchiveFilamentRequirements(archiveId!, plate.index);
        return { filaments: response.filaments };
      },
      enabled: isLibraryFile ? !!libraryFileId : !!archiveId,
      retry: false,
    });

    const { data: availableFilaments } = useQuery({
      queryKey: ['available-filaments', config.targetModel, config.targetLocation],
      queryFn: () => api.getAvailableFilaments(config.targetModel!, config.targetLocation ?? undefined),
      enabled: config.assignmentMode === 'model' && !!config.targetModel,
    });

    const effectivePrinterId = config.selectedPrinters[0] ?? null;
    const { data: printerStatus } = useQuery({
      queryKey: ['printer-status', effectivePrinterId],
      queryFn: () => api.getPrinterStatus(effectivePrinterId!),
      enabled: !!effectivePrinterId,
    });

    const { amsMapping } = useFilamentMapping(
      filamentReqs,
      printerStatus,
      config.manualMappings,
      preferLowestFilament,
    );

    const setPerPrinterConfigs: Dispatch<SetStateAction<Record<number, PerPrinterConfig>>> = (update) => {
      const nextConfigs = typeof update === 'function'
        ? update(config.perPrinterConfigs)
        : update;
      onChange({ perPrinterConfigs: nextConfigs });
    };

    const multiPrinterMapping = useMultiPrinterFilamentMapping(
      config.selectedPrinters,
      printers,
      filamentReqs,
      config.manualMappings,
      config.perPrinterConfigs,
      setPerPrinterConfigs,
      preferLowestFilament,
    );

    const getMappingForPrinter = (printerId: number) =>
      multiPrinterMapping.getFinalMapping(printerId)
      ?? (printerId === effectivePrinterId ? amsMapping : undefined);

    const getPrinterStatus = (printerId: number) =>
      multiPrinterMapping.printerResults.find((result) => result.printerId === printerId)?.status
      ?? (printerId === effectivePrinterId ? printerStatus : undefined);

    const buildFilamentOverrides = () => {
      const entries: NonNullable<PlateConfigurationSnapshot['filamentOverrides']> = [];
      for (const requirement of filamentReqs?.filaments ?? []) {
        const override = config.filamentOverrides[requirement.slot_id];
        const forceColor = config.forceColorMatch[requirement.slot_id] ?? false;
        if (!override && !forceColor) continue;

        const type = override?.type ?? requirement.type;
        const color = override?.color ?? requirement.color;
        entries.push({
          slot_id: requirement.slot_id,
          type,
          color,
          color_name: getColorName(color),
          force_color_match: forceColor,
        });
      }
      return entries.length > 0 ? entries : undefined;
    };

    useImperativeHandle(ref, () => ({
      getSnapshot: () => ({
        selectedPrinters: config.selectedPrinters,
        quantity: config.quantity,
        assignmentMode: config.assignmentMode,
        targetModel: config.targetModel,
        targetLocation: config.targetLocation,
        filamentReqs,
        filamentOverrides: buildFilamentOverrides(),
        getMappingForPrinter,
        getPrinterStatus,
      }),
    }));

    // Match the modal's existing convenience behavior when only one printer is active.
    useEffect(() => {
      const activePrinters = printers.filter((printer) => printer.is_active);
      if (
        config.assignmentMode === 'printer'
        && activePrinters.length === 1
        && config.selectedPrinters.length === 0
      ) {
        onChange({ selectedPrinters: [activePrinters[0].id] });
      }
    }, [config, onChange, printers]);

    const selectedPrinterNames = config.selectedPrinters
      .map((printerId) => printers.find((printer) => printer.id === printerId)?.name)
      .filter((name): name is string => Boolean(name));
    const plateLabel = plate.name || `Plate ${plate.index}`;
    const assignmentSummary = config.assignmentMode === 'model'
      ? `Any ${config.targetModel || 'model'} printer`
      : selectedPrinterNames.length > 0
        ? selectedPrinterNames.join(', ')
        : 'Select printer(s)';
    const assignmentBadge = config.assignmentMode === 'model'
      ? `Any ${config.targetModel || 'model'}`
      : `${config.selectedPrinters.length} printer${config.selectedPrinters.length === 1 ? '' : 's'}`;

    return (
      <div className="overflow-hidden border rounded-lg border-bambu-dark-tertiary bg-bambu-dark/40">
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          aria-expanded={isExpanded}
          aria-controls={`plate-configuration-${plate.index}`}
          className="flex items-center w-full gap-3 p-3 text-left transition-colors hover:bg-bambu-dark-tertiary/50"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-bambu-green/10">
            <Layers className="w-4 h-4 text-bambu-green" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{plateLabel}</p>
            <p className="text-xs truncate text-bambu-gray">
              {assignmentSummary}
              {' • '}
              Quantity {config.quantity}
            </p>
          </div>
          <span className="px-2 py-0.5 text-xs rounded-full bg-bambu-dark-tertiary text-bambu-gray">
            {assignmentBadge}
          </span>
          {isExpanded
            ? <ChevronUp className="w-4 h-4 text-bambu-gray" />
            : <ChevronDown className="w-4 h-4 text-bambu-gray" />}
        </button>

        {isExpanded && (
          <div
            id={`plate-configuration-${plate.index}`}
            className="p-3 space-y-4 border-t border-bambu-dark-tertiary"
          >
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm text-bambu-gray">
                <PrinterIcon className="w-4 h-4" />
                <span>Printers</span>
              </div>
              <PrinterSelector
                printers={printers}
                selectedPrinterIds={config.selectedPrinters}
                onMultiSelect={(selectedPrinters) =>
                  onChange({ selectedPrinters, manualMappings: {}, perPrinterConfigs: {} })}
                isLoading={isLoadingPrinters}
                allowMultiple
                printerMappingResults={multiPrinterMapping.printerResults}
                filamentReqs={filamentReqs}
                onAutoConfigurePrinter={multiPrinterMapping.autoConfigurePrinter}
                onUpdatePrinterConfig={multiPrinterMapping.updatePrinterConfig}
                assignmentMode={config.assignmentMode}
                onAssignmentModeChange={(assignmentMode) =>
                  onChange({ assignmentMode, manualMappings: {}, perPrinterConfigs: {} })}
                targetModel={config.targetModel}
                onTargetModelChange={(targetModel) =>
                  onChange({
                    targetModel,
                    targetLocation: null,
                    filamentOverrides: {},
                    forceColorMatch: {},
                  })}
                targetLocation={config.targetLocation}
                onTargetLocationChange={(targetLocation) =>
                  onChange({ targetLocation, filamentOverrides: {}, forceColorMatch: {} })}
                slicedForModel={slicedForModel}
              />
            </div>

            {slicedForModel && config.assignmentMode === 'printer' && config.selectedPrinters.length === 1 && (() => {
              const selectedPrinter = printers.find((printer) => printer.id === config.selectedPrinters[0]);
              if (!selectedPrinter?.model || selectedPrinter.model === slicedForModel) return null;
              return (
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-yellow-500/10 border-yellow-500/30">
                  <AlertTriangle className="flex-shrink-0 w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-yellow-400">
                    File was sliced for {slicedForModel}, but printing on {selectedPrinter.model}
                  </span>
                </div>
              );
            })()}

            {filamentReqsError ? (
              <div className="flex items-start gap-2 p-3 text-sm border rounded-lg bg-orange-500/10 border-orange-500/30">
                <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                <p className="text-orange-400">Filament data for this plate is unavailable.</p>
              </div>
            ) : config.assignmentMode === 'model'
              && config.targetModel
              && availableFilaments
              && availableFilaments.length > 0 ? (
              <FilamentOverride
                filamentReqs={filamentReqs}
                availableFilaments={availableFilaments}
                overrides={config.filamentOverrides}
                onChange={(filamentOverrides) => onChange({ filamentOverrides })}
                forceColorMatch={config.forceColorMatch}
                onForceColorMatchChange={(slotId, value) =>
                  onChange({
                    forceColorMatch: { ...config.forceColorMatch, [slotId]: value },
                  })}
              />
            ) : config.assignmentMode === 'printer' && config.selectedPrinters.length === 1 ? (
              <FilamentMapping
                printerId={effectivePrinterId!}
                filamentReqs={filamentReqs}
                manualMappings={config.manualMappings}
                onManualMappingChange={(manualMappings) =>
                  onChange({ manualMappings })}
                defaultExpanded={mappingDefaultExpanded}
                currencySymbol={currencySymbol}
                defaultCostPerKg={defaultCostPerKg}
              />
            ) : null}

            <div className="flex items-center gap-3">
              <label
                htmlFor={`plate-${plate.index}-quantity`}
                className="text-sm text-bambu-gray whitespace-nowrap"
              >
                Quantity
              </label>
              <input
                id={`plate-${plate.index}-quantity`}
                aria-label={`Quantity for ${plateLabel}`}
                type="number"
                min={1}
                max={999}
                value={config.quantity}
                onChange={(event) =>
                  onChange({
                    quantity: Math.max(1, Math.min(999, parseInt(event.target.value, 10) || 1)),
                  })}
                className="w-20 px-2 py-1 text-sm text-white border rounded bg-bambu-dark border-bambu-dark-tertiary focus:outline-none focus:ring-1 focus:ring-bambu-green"
              />
              {config.quantity > 1 && (
                <span className="text-xs text-bambu-gray">
                  Creates {config.quantity} queue items per printer
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);
