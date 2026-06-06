import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { Archive } from '../../api/client';
import type { ArchivePlatesResponse, LibraryFilePlatesResponse } from '../../types/plates';
import type { AssignmentMode, PrintOptions, ScheduleOptions } from '../PrintModal/types';
import { Button } from '../Button';
import { Card, CardContent } from '../Card';
import { PlateSelector } from '../PrintModal/PlateSelector';
import { PrintOptionsPanel } from '../PrintModal/PrintOptions';
import { PrinterSelector } from '../PrintModal/PrinterSelector';
import { ScheduleOptionsPanel } from '../PrintModal/ScheduleOptions';

interface FormItem {
  label: string;
  archive_id: string;
  library_file_id: string;
  plate_id: string;
  printer_id: string;
  target_model: string;
  target_location: string;
  ams_mapping: string;
  scheduled_time: string;
  manual_start: boolean;
  require_previous_success: boolean;
  auto_off_after: boolean;
  bed_levelling: boolean;
  flow_cali: boolean;
  vibration_cali: boolean;
  layer_inspect: boolean;
  timelapse: boolean;
  use_ams: boolean;
  gcode_injection: boolean;
}

interface ItemModalProps {
  isOpen: boolean;
  isEditing: boolean;
  itemDraft: FormItem | null;
  onItemDraftChange: (draft: FormItem | null) => void;
  itemSourceType: 'archive' | 'library';
  onSourceTypeChange: (type: 'archive' | 'library') => void;
  onBrowseClick: (sourceType: 'archive' | 'library') => void;
  fileWithPlates: ArchivePlatesResponse | LibraryFilePlatesResponse | null;
  selectedPlates: Set<number>;
  onPlateToggle: (plateIndex: number) => void;
  archiveDetails: Archive | undefined;
  libraryFileDetails: any;
  itemSelectedPrinters: number[];
  onSelectedPrintersChange: (printerIds: number[]) => void;
  itemAssignmentMode: AssignmentMode;
  onAssignmentModeChange: (mode: AssignmentMode) => void;
  itemTargetModel: string | null;
  onTargetModelChange: (model: string | null) => void;
  itemTargetLocation: string | null;
  onTargetLocationChange: (location: string | null) => void;
  printerStatusName: string | undefined;
  itemCreateMultiple: boolean;
  onCreateMultipleChange: (value: boolean) => void;
  itemScheduleOptions: ScheduleOptions;
  onScheduleOptionsChange: (options: ScheduleOptions) => void;
  itemPrintOptions: PrintOptions;
  onPrintOptionsChange: (options: PrintOptions) => void;
  printers: any[];
  isLoadingPrinters: boolean;
  settings: any;
  canControlPrinter: boolean;
  formErrors: string[];
  onClose: () => void;
  onSave: () => void;
}

export function ItemModal({
  isOpen,
  isEditing,
  itemDraft,
  onItemDraftChange,
  itemSourceType,
  onSourceTypeChange,
  onBrowseClick,
  fileWithPlates,
  selectedPlates,
  onPlateToggle,
  archiveDetails,
  libraryFileDetails,
  itemSelectedPrinters,
  onSelectedPrintersChange,
  itemAssignmentMode,
  onAssignmentModeChange,
  itemTargetModel,
  onTargetModelChange,
  itemTargetLocation,
  onTargetLocationChange,
  printerStatusName,
  itemCreateMultiple,
  onCreateMultipleChange,
  itemScheduleOptions,
  onScheduleOptionsChange,
  itemPrintOptions,
  onPrintOptionsChange,
  printers,
  isLoadingPrinters,
  settings,
  canControlPrinter,
  formErrors,
  onClose,
  onSave,
}: ItemModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !itemDraft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b border-bambu-dark-tertiary">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {isEditing
                  ? t('multiPrintTemplates.editItem')
                  : t('multiPrintTemplates.addItem')}
              </h3>
              <p className="text-xs text-bambu-gray">
                {t('multiPrintTemplates.itemModalSubtitle')}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block mb-1 text-xs text-bambu-gray">{t('multiPrintTemplates.fieldLabel')}</label>
              <input
                placeholder={t('multiPrintTemplates.fieldLabelPlaceholder')}
                className="w-full px-3 py-2 text-white border rounded-md border-bambu-border bg-bambu-dark"
                value={itemDraft.label}
                onChange={(e: { target: { value: any } }) => onItemDraftChange({ ...itemDraft, label: e.target.value })}
              />
            </div>

            <div>
              <div>
                <label className="block mb-1 text-xs text-bambu-gray">Source type</label>
                <div className="flex items-start justify-between gap-4">
                  <select
                    className="w-full px-3 py-2 text-white border rounded-md border-bambu-border bg-bambu-dark"
                    value={itemSourceType}
                    onChange={(e) => {
                      const sourceType = e.target.value as 'archive' | 'library';
                      onSourceTypeChange(sourceType);
                      onItemDraftChange({
                        ...itemDraft,
                        plate_id: '',
                        ...(sourceType === 'archive'
                          ? { library_file_id: '' }
                          : { archive_id: '' }),
                      });
                    }}
                  >
                    <option value="library">File Manager</option>
                    <option value="archive">Archives</option>
                  </select>
                  <Button variant="secondary" onClick={() => onBrowseClick(itemSourceType)} className="h-9.5 min-w-50">
                    Browse {itemSourceType === 'archive' ? 'archives' : 'library files'}
                  </Button>
                </div>
              </div>
            </div>

            {itemSourceType === 'archive' ? (
              <div className="p-3 border rounded-lg border-bambu-border bg-bambu-card">
                <div className="mb-1 text-xs text-bambu-gray">Selected archive</div>
                <div className="text-sm text-white">
                  {itemDraft.archive_id
                    ? `Archive #${itemDraft.archive_id}`
                    : 'No archive selected'}
                </div>
                {archiveDetails?.file_path && (
                  <div className="mt-1 text-xs text-bambu-gray">{archiveDetails.file_path}</div>
                )}
                {itemDraft.archive_id && itemDraft.plate_id && (
                  <div className="mt-2 text-xs text-bambu-green">
                    ✓ Plate selected: #{itemDraft.plate_id}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 border rounded-lg border-bambu-border bg-bambu-card">
                <div className="mb-1 text-xs text-bambu-gray">Selected file-manager item</div>
                <div className="text-sm text-white">
                  {itemDraft.library_file_id
                    ? `Library file #${itemDraft.library_file_id}`
                    : 'No library file selected'}
                </div>
                {libraryFileDetails?.file_path && (
                  <div className="mt-1 text-xs text-bambu-gray">{libraryFileDetails.file_path.replace('/external/prints/', '')}</div>
                )}
                {itemDraft.library_file_id && itemDraft.plate_id && (
                  <div className="mt-2 text-xs text-bambu-green">
                    ✓ Plate selected: #{itemDraft.plate_id}
                  </div>
                )}
              </div>
            )}

            <div className="p-3 border rounded-lg border-bambu-border bg-bambu-card">
              <div className="mb-1 text-xs text-bambu-gray">Plates</div>
              {fileWithPlates ? (
                <>
                  <PlateSelector
                    plates={fileWithPlates.plates}
                    isMultiPlate={fileWithPlates.is_multi_plate}
                    selectedPlates={selectedPlates}
                    onToggle={onPlateToggle}
                    multiSelect={false}
                  />
                  {itemDraft.plate_id && (
                    <div className="mt-2 text-xs text-bambu-green">✓ Plate selected: #{itemDraft.plate_id}</div>
                  )}
                </>
              ) : (
                <div className="p-3 text-sm border border-dashed rounded-md border-bambu-border text-bambu-gray">
                  Select an archive or file-manager item to load its plates.
                </div>
              )}
            </div>

            <PrinterSelector
              printers={printers}
              selectedPrinterIds={itemSelectedPrinters}
              onMultiSelect={onSelectedPrintersChange}
              isLoading={isLoadingPrinters}
              allowMultiple={true}
              assignmentMode={itemAssignmentMode}
              onAssignmentModeChange={onAssignmentModeChange}
              targetModel={itemTargetModel}
              onTargetModelChange={onTargetModelChange}
              targetLocation={itemTargetLocation}
              onTargetLocationChange={onTargetLocationChange}
            />

            {printerStatusName && (
              <div className="mt-2 text-sm text-bambu-gray">Selected printer: <span className="text-white">{printerStatusName}</span></div>
            )}

            {itemAssignmentMode === 'printer' && itemSelectedPrinters.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-bambu-gray">
                <input
                  type="checkbox"
                  checked={itemCreateMultiple}
                  onChange={(e: { target: { checked: any } }) => onCreateMultipleChange(e.target.checked)}
                />
                {t('multiPrintTemplates.createMultipleQueues')}
              </label>
            )}

            <ScheduleOptionsPanel
              options={itemScheduleOptions}
              onChange={onScheduleOptionsChange}
              dateFormat={settings?.date_format || 'system'}
              timeFormat={settings?.time_format || 'system'}
              canControlPrinter={canControlPrinter}
              showStagger={false}
              hasGcodeSnippets={!!settings?.gcode_snippets}
            />

            <PrintOptionsPanel options={itemPrintOptions} onChange={onPrintOptionsChange} />

            {formErrors.length > 0 && (
              <div className="p-3 text-sm text-red-200 border rounded-lg border-red-500/40 bg-red-500/10">
                <ul className="space-y-1 list-disc list-inside">
                  {formErrors.map((error: any) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-bambu-dark-tertiary">
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={onSave}>
              {isEditing
                ? t('common.save')
                : t('multiPrintTemplates.addItem')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
