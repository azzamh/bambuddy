import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Layers, ListTodo, Pencil, Plus, Trash2, X } from 'lucide-react';
import { withStreamToken } from '../../api/client';
import type { Archive, LibraryFile, PrinterStatus } from '../../api/client';
import type { ArchivePlatesResponse, LibraryFilePlatesResponse } from '../../types/plates';
import { Button } from '../Button';
import { Card, CardContent } from '../Card';

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

interface TemplateFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formName: string;
  onNameChange: (name: string) => void;
  formDescription: string;
  onDescriptionChange: (description: string) => void;
  formItems: FormItem[];
  onAddItem: () => void;
  onEditItem: (index: number) => void;
  onDuplicateItem: (index: number) => void;
  onRemoveItem: (index: number) => void;
  formErrors: string[];
  archivesById: Record<string, Pick<Archive, 'file_path'> | undefined>;
  libraryFilesById: Record<string, Pick<LibraryFile, 'file_path'> | undefined>;
  printersById: Record<string, Pick<PrinterStatus, 'name'> | undefined>;
  platesBySource: Record<string, ArchivePlatesResponse | LibraryFilePlatesResponse | undefined>;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function TemplateFormModal({
  isOpen,
  isEditing,
  formName,
  onNameChange,
  formDescription,
  onDescriptionChange,
  formItems,
  onAddItem,
  onEditItem,
  onDuplicateItem,
  onRemoveItem,
  formErrors,
  archivesById,
  libraryFilesById,
  printersById,
  platesBySource,
  onSave,
  onCancel,
  isSaving,
}: TemplateFormModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const getSourceKey = (item: FormItem) => {
    if (item.archive_id) return `archive:${item.archive_id}`;
    if (item.library_file_id) return `library:${item.library_file_id}`;
    return null;
  };

  const getPlateSummary = (item: FormItem) => {
    const parsedPlateId = Number(item.plate_id);
    const plateId = item.plate_id && Number.isFinite(parsedPlateId) ? parsedPlateId : null;
    const sourceKey = getSourceKey(item);
    const plate = sourceKey && plateId
      ? platesBySource[sourceKey]?.plates.find((candidate) => candidate.index === plateId)
      : null;

    if (!plateId) {
      return {
        label: 'Default plate',
        detail: null,
        thumbnailUrl: null as string | null,
      };
    }

    return {
      label: plate?.name || `Plate #${plateId}`,
      detail: `Plate #${plateId}`,
      thumbnailUrl: plate?.has_thumbnail && plate.thumbnail_url ? withStreamToken(plate.thumbnail_url) : null,
    };
  };

  const getTargetSummary = (item: FormItem) => {
    if (item.printer_id) {
      return printersById[Number(item.printer_id)]?.name || t('multiPrintTemplates.targetPrinter', { id: item.printer_id });
    }

    if (item.target_model) {
      return t('multiPrintTemplates.targetModel', { model: item.target_model });
    }

    return t('common.unassigned');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onCancel}>
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-form-title"
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b border-bambu-dark-tertiary">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-bambu-green/10 text-bambu-green">
                <ListTodo className="w-5 h-5" />
              </div>
              <div>
                <h3 id="template-form-title" className="text-lg font-semibold text-white">
                  {isEditing ? t('multiPrintTemplates.edit') : t('multiPrintTemplates.create')}
                </h3>
                <p className="text-xs text-bambu-gray">{t('multiPrintTemplates.subtitle')}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              aria-label={t('common.close')}
              disabled={isSaving}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4 space-y-5">
            <div>
                <label className="block mb-1 text-sm text-bambu-gray">{t('multiPrintTemplates.nameLabel')}</label>
              <input
                className="w-full px-3 py-2 text-white border rounded-lg border-bambu-dark-tertiary bg-bambu-dark focus:outline-none focus:ring-1 focus:ring-bambu-green"
                value={formName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onNameChange(event.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 text-sm text-bambu-gray">{t('multiPrintTemplates.descriptionLabel')}</label>
              <textarea
                className="w-full px-3 py-2 text-white border rounded-lg border-bambu-dark-tertiary bg-bambu-dark focus:outline-none focus:ring-1 focus:ring-bambu-green"
                rows={3}
                value={formDescription}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onDescriptionChange(event.target.value)}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">{t('multiPrintTemplates.itemsTitle')}</h4>
                  <p className="text-xs text-bambu-gray">{t('multiPrintTemplates.itemModalSubtitle')}</p>
                </div>
                <Button variant="secondary" onClick={onAddItem}>
                  <Plus className="w-4 h-4" />
                  {t('multiPrintTemplates.addItem')}
                </Button>
              </div>

              {formItems.length === 0 ? (
                <div className="p-4 text-sm border rounded-lg border-bambu-dark-tertiary bg-bambu-dark text-bambu-gray">
                  {t('multiPrintTemplates.itemRequired')}
                </div>
              ) : (
                <div className="space-y-3">
                  {formItems.map((item: FormItem, idx: number) => {
                    const itemName = item.label || t('multiPrintTemplates.itemLabel', { index: idx + 1 });
                    const plateSummary = getPlateSummary(item);
                    const sourcePath = item.archive_id
                      ? archivesById[Number(item.archive_id)]?.file_path
                      : libraryFilesById[Number(item.library_file_id)]?.file_path?.replace('/external/prints/', '');

                    return (
                      <div
                        key={`${idx}-${item.label}-${item.archive_id}-${item.library_file_id}-${item.plate_id}`}
                        className="p-4 border rounded-xl border-bambu-dark-tertiary bg-bambu-dark"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2 min-w-0">
                            <div className="text-sm font-medium text-white">{itemName}</div>
                            <div className="text-xs text-bambu-gray">
                              {item.archive_id
                                ? t('multiPrintTemplates.sourceArchive', { id: item.archive_id })
                                : t('multiPrintTemplates.sourceLibrary', { id: item.library_file_id })}
                            </div>
                            {sourcePath && (
                              <div className="text-xs break-all text-bambu-gray">{sourcePath}</div>
                            )}
                            <div className="text-xs font-medium text-bambu-green">{getTargetSummary(item)}</div>
                          </div>

                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditItem(idx)}
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDuplicateItem(idx)}
                              title={t('common.duplicate')}
                              aria-label={t('common.duplicate')}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemoveItem(idx)}
                              title={t('multiPrintTemplates.removeItem')}
                              aria-label={t('multiPrintTemplates.removeItem')}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 rounded-lg border border-bambu-green/20 bg-bambu-green/5 px-3 py-2">
                          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-bambu-green/80">
                            <Layers className="w-3.5 h-3.5" />
                            Plate to print
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            {plateSummary.thumbnailUrl ? (
                              <img
                                src={plateSummary.thumbnailUrl}
                                alt={plateSummary.detail ? `${plateSummary.detail} preview` : 'Plate preview'}
                                className="h-14 w-14 shrink-0 rounded-lg bg-bambu-dark-tertiary object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-bambu-dark-tertiary">
                                <Layers className="w-5 h-5 text-bambu-gray" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm text-white">{plateSummary.label}</div>
                              {plateSummary.detail && (
                                <div className="mt-1 text-xs text-bambu-gray">{plateSummary.detail}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {formErrors.length > 0 && (
              <div className="p-3 text-sm text-red-500 border rounded-lg border-red-500/40 bg-red-500/10">
                <ul className="space-y-1 list-disc list-inside">
                  {formErrors.map((error: string) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-bambu-dark-tertiary">
            <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={onSave}
              disabled={isSaving}
            >
              {t('common.save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
