import { useQuery, useQueries } from '@tanstack/react-query';
import { api } from '../api/client';

export function useMultiPrintTemplateQueries() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['multi-print-templates'],
    queryFn: api.getMultiPrintTemplates,
  });

  const { data: printers = [], isLoading: isLoadingPrinters } = useQuery({
    queryKey: ['printers'],
    queryFn: api.getPrinters,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  return {
    templates,
    isLoading,
    printers,
    isLoadingPrinters,
    settings,
  };
}

export function useBrowseQueries(isItemModalOpen: boolean, isBrowseModalOpen: boolean, itemSourceType: 'archive' | 'library', selectedLibraryFolderId: number | null) {
  const { data: browseArchives = [] } = useQuery({
    queryKey: ['multi-print-template-browse-archives'],
    queryFn: () => api.getArchives(undefined, undefined, 500),
    enabled: isItemModalOpen || isBrowseModalOpen,
  });

  const { data: browseLibraryFolders = [] } = useQuery({
    queryKey: ['multi-print-template-browse-library-folders'],
    queryFn: api.getLibraryFolders,
    enabled: isItemModalOpen || isBrowseModalOpen,
  });

  const { data: browseLibraryFiles = [] } = useQuery({
    queryKey: ['multi-print-template-browse-library-files', selectedLibraryFolderId],
    queryFn: () => api.getLibraryFiles(selectedLibraryFolderId, true),
    enabled: (isItemModalOpen || isBrowseModalOpen) && itemSourceType === 'library',
  });

  return {
    browseArchives,
    browseLibraryFolders,
    browseLibraryFiles,
  };
}

export function useItemDetailsQueries(isItemModalOpen: boolean, itemArchiveId?: string, itemLibraryFileId?: string, selectedPrinterId?: number | null) {
  // Fetch selected archive or library file details to show file_path
  const archiveDetailsQuery = useQuery({
    queryKey: ['multi-print-template-archive-details', itemArchiveId],
    queryFn: () => api.getArchive(Number(itemArchiveId)),
    enabled: isItemModalOpen && Boolean(itemArchiveId),
    select: (data) => data,
  });

  const libraryFileDetailsQuery = useQuery({
    queryKey: ['multi-print-template-libraryfile-details', itemLibraryFileId],
    queryFn: () => api.getLibraryFile(Number(itemLibraryFileId)),
    enabled: isItemModalOpen && Boolean(itemLibraryFileId),
    select: (data) => data,
  });

  const printerStatusQuery = useQuery({
    queryKey: ['multi-print-template-printer-status', selectedPrinterId],
    queryFn: () => (selectedPrinterId ? api.getPrinterStatus(selectedPrinterId) : Promise.resolve(null)),
    enabled: isItemModalOpen && Boolean(selectedPrinterId),
  });

  return {
    archiveDetailsQuery,
    libraryFileDetailsQuery,
    printerStatusQuery,
  };
}

export function useFormItemsDetailsQueries(formItems: any[]) {
  // Fetch details for items shown in the form list (archives, library files, printers)
  const archiveIds = Array.from(new Set(formItems.map((it) => it.archive_id).filter(Boolean).map((id) => Number(id))));
  const libraryFileIds = Array.from(new Set(formItems.map((it) => it.library_file_id).filter(Boolean).map((id) => Number(id))));
  const printerIds = Array.from(new Set(formItems.map((it) => it.printer_id).filter(Boolean).map((id) => Number(id))));

  const archiveQueries = useQueries({
    queries: archiveIds.map((id) => ({
      queryKey: ['multi-print-template-archive-details', id],
      queryFn: () => api.getArchive(id),
      enabled: Boolean(id),
    })),
  });

  const libraryFileQueries = useQueries({
    queries: libraryFileIds.map((id) => ({
      queryKey: ['multi-print-template-libraryfile-details', id],
      queryFn: () => api.getLibraryFile(id),
      enabled: Boolean(id),
    })),
  });

  const printerStatusQueries = useQueries({
    queries: printerIds.map((id) => ({
      queryKey: ['multi-print-template-printer-status', id],
      queryFn: () => api.getPrinterStatus(id),
      enabled: Boolean(id),
    })),
  });

  const archivesById = Object.fromEntries(archiveQueries.map((q, i) => [archiveIds[i], q.data]));
  const libraryFilesById = Object.fromEntries(libraryFileQueries.map((q, i) => [libraryFileIds[i], q.data]));
  const printersById = Object.fromEntries(printerStatusQueries.map((q, i) => [printerIds[i], q.data]));

  return {
    archivesById,
    libraryFilesById,
    printersById,
  };
}
