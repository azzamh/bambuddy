import { useTranslation } from 'react-i18next';
import type { MultiPrintTemplate, MultiPrintTemplateRunResponse } from '../../api/client';
import { Button } from '../Button';

interface RunConfirmModalProps {
  template: MultiPrintTemplate;
  runResult: MultiPrintTemplateRunResponse | null;
  runOverrides: {
    scheduled_time: string;
    override_printer_id: string;
    override_target_model: string;
  };
  onOverridesChange: (overrides: { scheduled_time: string; override_printer_id: string; override_target_model: string }) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

export function RunConfirmModal({
  template,
  runResult,
  runOverrides,
  onOverridesChange,
  onConfirm,
  onCancel,
  isPending,
}: RunConfirmModalProps) {
  const { t } = useTranslation();

  const canRun = !(!!runOverrides.override_printer_id && !!runOverrides.override_target_model);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg p-6 border rounded-xl border-bambu-border bg-bambu-dark">
        <h3 className="mb-4 text-lg font-semibold text-white">{t('multiPrintTemplates.runConfirmTitle')}</h3>
        <p className="mb-4 text-sm text-bambu-gray">
          {t('multiPrintTemplates.runConfirmMessage', { name: template.name })}
        </p>
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-sm text-bambu-gray">{t('multiPrintTemplates.runScheduled')}</label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 text-white border rounded-md border-bambu-border bg-bambu-card"
              value={runOverrides.scheduled_time}
              onChange={(e: { target: { value: any; } }) => onOverridesChange({ ...runOverrides, scheduled_time: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block mb-1 text-sm text-bambu-gray">{t('multiPrintTemplates.runPrinterId')}</label>
              <input
                className="w-full px-3 py-2 text-white border rounded-md border-bambu-border bg-bambu-card"
                value={runOverrides.override_printer_id}
                onChange={(e: { target: { value: any; } }) => onOverridesChange({ ...runOverrides, override_printer_id: e.target.value })}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm text-bambu-gray">{t('multiPrintTemplates.runTargetModel')}</label>
              <input
                className="w-full px-3 py-2 text-white border rounded-md border-bambu-border bg-bambu-card"
                value={runOverrides.override_target_model}
                onChange={(e: { target: { value: any; } }) => onOverridesChange({ ...runOverrides, override_target_model: e.target.value })}
              />
            </div>
          </div>
        </div>

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
            disabled={isPending || !canRun}
            onClick={onConfirm}
          >
            {t('multiPrintTemplates.run')}
          </Button>
        </div>
      </div>
    </div>
  );
}
