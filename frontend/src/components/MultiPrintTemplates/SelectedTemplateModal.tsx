import { useTranslation } from 'react-i18next';
import type { MultiPrintTemplate, MultiPrintTemplateItem } from '../../api/client';
import { Button } from '../Button';

interface SelectedTemplateModalProps {
  template: MultiPrintTemplate;
  onClose: () => void;
}

export function SelectedTemplateModal({ template, onClose }: SelectedTemplateModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-2xl p-6 border rounded-xl border-bambu-border bg-bambu-dark">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{template.name}</h3>
          <Button variant="ghost" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
        <p className="mb-4 text-sm text-bambu-gray">
          {template.description || t('multiPrintTemplates.noDescription')}
        </p>
        <div className="space-y-3">
          {template.items.map((item: MultiPrintTemplateItem, idx: number) => (
            <div key={item.id} className="p-3 border rounded-lg border-bambu-border bg-bambu-card">
              <div className="text-sm text-white">{item.label || t('multiPrintTemplates.itemLabel', { index: idx + 1 })}</div>
              <div className="text-xs text-bambu-gray">
                {item.archive_id ? t('multiPrintTemplates.sourceArchive', { id: item.archive_id }) : t('multiPrintTemplates.sourceLibrary', { id: item.library_file_id })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
