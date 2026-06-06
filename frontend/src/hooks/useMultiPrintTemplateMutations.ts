import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type MultiPrintTemplate, type MultiPrintTemplateCreate, type MultiPrintTemplateRunRequest, type MultiPrintTemplateRunResponse } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

export function useMultiPrintTemplateMutations() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteMultiPrintTemplate(id),
    onSuccess: () => {
      showToast(t('multiPrintTemplates.toast.deleted'), 'success');
      queryClient.invalidateQueries({ queryKey: ['multi-print-templates'] });
    },
    onError: () => {
      showToast(t('multiPrintTemplates.toast.deleteFailed'), 'error');
    },
  });

  const runMutation = useMutation<MultiPrintTemplateRunResponse, Error, { id: number; data: MultiPrintTemplateRunRequest }>({
    mutationFn: (payload: { id: number; data: MultiPrintTemplateRunRequest }) =>
      api.runMultiPrintTemplate(payload.id, payload.data),
    onSuccess: (data: MultiPrintTemplateRunResponse) => {
      showToast(t('multiPrintTemplates.toast.runSuccess', { count: data.created_queue_ids.length }), 'success');
      if (data.failed_items.length > 0) {
        showToast(t('multiPrintTemplates.toast.runPartial', { count: data.failed_items.length }), 'warning');
      }
    },
    onError: () => {
      showToast(t('multiPrintTemplates.toast.runFailed'), 'error');
    },
  });

  const createMutation = useMutation<MultiPrintTemplate, Error, { name: string; description: string; items: MultiPrintTemplateCreate['items'] }>({
    mutationFn: (payload: { name: string; description: string; items: MultiPrintTemplateCreate['items'] }) =>
      api.createMultiPrintTemplate({ name: payload.name, description: payload.description, items: payload.items }),
    onSuccess: () => {
      showToast(t('multiPrintTemplates.toast.created'), 'success');
      queryClient.invalidateQueries({ queryKey: ['multi-print-templates'] });
    },
    onError: () => {
      showToast(t('multiPrintTemplates.toast.createFailed'), 'error');
    },
  });

  const updateMutation = useMutation<MultiPrintTemplate, Error, { id: number; name: string; description: string; items: MultiPrintTemplateCreate['items'] }>({
    mutationFn: (payload: { id: number; name: string; description: string; items: MultiPrintTemplateCreate['items'] }) =>
      api.updateMultiPrintTemplate(payload.id, { name: payload.name, description: payload.description, items: payload.items }),
    onSuccess: () => {
      showToast(t('multiPrintTemplates.toast.updated'), 'success');
      queryClient.invalidateQueries({ queryKey: ['multi-print-templates'] });
    },
    onError: () => {
      showToast(t('multiPrintTemplates.toast.updateFailed'), 'error');
    },
  });

  return {
    deleteMutation,
    runMutation,
    createMutation,
    updateMutation,
  };
}
