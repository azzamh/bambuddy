import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { Copy, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react';
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
  onDuplicate: (template: MultiPrintTemplate) => void;
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
  onDuplicate,
  canManageTemplates,
  canRunTemplates,
}: TemplatesListProps) {
  const { t } = useTranslation();
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId !== null) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [openMenuId]);

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
          <div className="divide-y divide-bambu-dark-tertiary">
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
                    variant="ghost"
                    onClick={() => onEdit(template)}
                    disabled={!canManageTemplates}
                    title={!canManageTemplates ? t('multiPrintTemplates.noEditPermission') : undefined}
                  >
                    <Pencil className="w-4 h-4" />
                    {/* {t('multiPrintTemplates.edit')} */}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => onRun(template)}
                    disabled={!canRunTemplates}
                    title={!canRunTemplates ? t('multiPrintTemplates.noRunPermission') : undefined}
                  >
                    <Play className="w-4 h-4" />
                    {/* {t('multiPrintTemplates.run')} */}
                  </Button>

                  {/* 3-dot menu: Duplicate & Delete */}
                  <div className="relative" ref={openMenuId === template.id ? menuRef : undefined}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenMenuId(openMenuId === template.id ? null : template.id)}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                    {openMenuId === template.id && (
                      <div className="absolute right-0 z-50 mt-1 border rounded-lg shadow-lg bg-bambu-dark-secondary border-bambu-dark-tertiary min-w-35">
                        <button
                          type="button"
                          className="flex items-center w-full gap-2 px-3 py-2 text-sm text-left transition-colors rounded-t-lg text-bambu-gray hover:bg-bambu-dark-tertiary hover:text-white"
                          onClick={() => {
                            onDuplicate(template);
                            setOpenMenuId(null);
                          }}
                          disabled={!canManageTemplates}
                        >
                          <Copy className="w-4 h-4" />
                          {t('multiPrintTemplates.duplicate')}
                        </button>
                        <button
                          type="button"
                          className="flex items-center w-full gap-2 px-3 py-2 text-sm text-left text-red-400 transition-colors rounded-b-lg hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => {
                            onDelete(template);
                            setOpenMenuId(null);
                          }}
                          disabled={!canManageTemplates}
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('multiPrintTemplates.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
