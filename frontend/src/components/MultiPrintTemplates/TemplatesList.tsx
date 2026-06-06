import { useTranslation } from 'react-i18next';
import { Pencil, Play, Trash2 } from 'lucide-react';
import type { MultiPrintTemplate } from '../../api/client';
import { Button } from '../Button';
import { Card, CardContent, CardHeader } from '../Card';

interface TemplatesListProps {
  templates: MultiPrintTemplate[];
  isLoading: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onView: (template: MultiPrintTemplate) => void;
  onEdit: (template: MultiPrintTemplate) => void;
  onRun: (template: MultiPrintTemplate) => void;
  onDelete: (template: MultiPrintTemplate) => void;
  canManageTemplates: boolean;
  canRunTemplates: boolean;
}

export function TemplatesList({
  templates,
  isLoading,
  searchTerm,
  onSearchChange,
  onEdit,
  onRun,
  onDelete,
  canManageTemplates,
  canRunTemplates,
}: TemplatesListProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-white">{t('multiPrintTemplates.listTitle')}</h2>
          <div className="w-full sm:max-w-sm">
            <label className="block mb-1 text-xs text-bambu-gray">{t('common.search')}</label>
            <input
              className="w-full px-3 py-2 text-white border rounded-md border-bambu-border bg-bambu-dark"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search templates by name"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-bambu-gray">{t('multiPrintTemplates.loading')}</div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-bambu-gray">{t('multiPrintTemplates.empty')}</div>
        ) : (
          <div className="divide-y divide-bambu-border">
            {templates.map((template: MultiPrintTemplate) => (
              <div key={template.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-white">{template.name}</div>
                  <div className="text-sm text-bambu-gray">
                    {t('multiPrintTemplates.itemsCount', { count: template.items.length })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => onEdit(template)}
                    disabled={!canManageTemplates}
                    title={!canManageTemplates ? t('multiPrintTemplates.noEditPermission') : undefined}
                  >
                    <Pencil className="w-4 h-4" />
                    {t('multiPrintTemplates.edit')}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => onRun(template)}
                    disabled={!canRunTemplates}
                    title={!canRunTemplates ? t('multiPrintTemplates.noRunPermission') : undefined}
                  >
                    <Play className="w-4 h-4" />
                    {t('multiPrintTemplates.run')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => onDelete(template)}
                    disabled={!canManageTemplates}
                    title={!canManageTemplates ? t('multiPrintTemplates.noDeletePermission') : undefined}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('multiPrintTemplates.delete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
