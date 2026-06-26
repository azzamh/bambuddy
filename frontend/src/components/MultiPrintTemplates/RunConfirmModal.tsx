import { useTranslation } from 'react-i18next';
import type { MultiPrintTemplate, MultiPrintTemplateRunResponse } from '../../api/client';
import { Button } from '../Button';

interface RunConfirmModalProps {
  template: MultiPrintTemplate;
  runResult: MultiPrintTemplateRunResponse | null;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

export function RunConfirmModal({
  template,
  runResult,
  onConfirm,
  onCancel,
  isPending,
}: RunConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg p-6 border rounded-xl border-bambu-border bg-bambu-dark">
        <h3 className="mb-4 text-lg font-semibold text-white">{t('multiPrintTemplates.runConfirmTitle')}</h3>
        <p className="mb-4 text-sm text-bambu-gray">
          {t('multiPrintTemplates.runConfirmMessage', { name: template.name })}
        </p>

        {runResult && (
          <div className="p-3 mt-4 text-sm border rounded-lg border-bambu-border bg-bambu-card text-bambu-gray">
            <div className="font-medium text-white">
              {t('multiPrintTemplates.runSummary', { count: runResult.created_queue_ids.length })}
            </div>
            {runResult.failed_items.length > 0 && (
              <div className="mt-2 text-red-200">
                {t('multiPrintTemplates.runSummaryFailed', { count: runResult.failed_items.length })}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={isPending}
            onClick={onConfirm}
          >
            {t('multiPrintTemplates.run')}
          </Button>
        </div>
      </div>
    </div>
  );
}
