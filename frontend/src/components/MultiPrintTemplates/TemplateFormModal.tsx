import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '../Button';

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
  onRemoveItem: (index: number) => void;
  formErrors: string[];
  archivesById: Record<string, any>;
  libraryFilesById: Record<string, any>;
  printersById: Record<string, any>;
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
  onRemoveItem,
  formErrors,
  archivesById,
  libraryFilesById,
  printersById,
  onSave,
  onCancel,
  isSaving,
}: TemplateFormModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-3xl p-6 border rounded-xl border-bambu-border bg-bambu-dark max-h-[90vh] overflow-y-auto">
        <h3 className="mb-4 text-lg font-semibold text-white">
          {isEditing ? t('multiPrintTemplates.edit') : t('multiPrintTemplates.create')}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-sm text-bambu-gray">{t('multiPrintTemplates.nameLabel')}</label>
            <input
              className="w-full px-3 py-2 text-white border rounded-md border-bambu-border bg-bambu-card"
              value={formName}
              onChange={(e: { target: { value: any } }) => onNameChange(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-1 text-sm text-bambu-gray">{t('multiPrintTemplates.descriptionLabel')}</label>
            <textarea
              className="w-full px-3 py-2 text-white border rounded-md border-bambu-border bg-bambu-card"
              rows={3}
              value={formDescription}
              onChange={(e: { target: { value: any } }) => onDescriptionChange(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">{t('multiPrintTemplates.itemsTitle')}</h4>
              <Button variant="secondary" onClick={onAddItem}>
                {t('multiPrintTemplates.addItem')}
              </Button>
            </div>
            {formItems.length === 0 ? (
              <div className="p-4 text-sm border rounded-lg border-bambu-border bg-bambu-card text-bambu-gray">
                {t('multiPrintTemplates.itemRequired')}
              </div>
            ) : (
              formItems.map((item: FormItem, idx: number) => (
                <div key={`${idx}-${item.label}`} className="relative p-4 border rounded-lg border-bambu-border bg-bambu-card">
                  <div className="absolute flex gap-1 top-2 right-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditItem(idx)}
                      title={t('common.edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      color="red"
                      size="sm"
                      onClick={() => onRemoveItem(idx)}
                      title={t('multiPrintTemplates.removeItem')}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="pr-20">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-white">
                        {item.label || t('multiPrintTemplates.itemLabel', { index: idx + 1 })}
                      </div>
                      <div className="text-xs text-bambu-gray">
                        {item.archive_id
                          ? t('multiPrintTemplates.sourceArchive', { id: item.archive_id })
                          : t('multiPrintTemplates.sourceLibrary', { id: item.library_file_id })}
                      </div>
                      {item.archive_id && archivesById[Number(item.archive_id)]?.file_path && (
                        <div className="text-xs break-all text-bambu-gray">{archivesById[Number(item.archive_id)]?.file_path}</div>
                      )}
                      {item.library_file_id && libraryFilesById[Number(item.library_file_id)]?.file_path && (
                        <div className="text-xs break-all text-bambu-gray">{libraryFilesById[Number(item.library_file_id)]?.file_path.replace('/external/prints/', '')}</div>
                      )}
                      <div className="text-xs text-bambu-green">
                        {item.printer_id
                          ? (printersById[Number(item.printer_id)]?.name || t('multiPrintTemplates.targetPrinter', { id: item.printer_id }))
                          : t('multiPrintTemplates.targetModel', { model: item.target_model })}
                      </div>
                      {item.plate_id && (
                        <div className="text-xs text-bambu-gray">✓ Plate: #{item.plate_id}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {formErrors.length > 0 && (
            <div className="p-3 text-sm text-red-500 border rounded-lg border-red-500/40 bg-red-500/10">
              <ul className="space-y-1 list-disc list-inside">
                {formErrors.map((error: any) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onCancel}>
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
      </div>
    </div>
  );
}
