import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { MultiPrintTemplate, MultiPrintTemplateCreate, MultiPrintTemplateItem, MultiPrintTemplateRunResponse } from '../api/client';
import { api } from '../api/client';
import type { ArchivePlatesResponse, LibraryFilePlatesResponse } from '../types/plates';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { BrowseModal } from '../components/MultiPrintTemplates/BrowseModal';
import { ItemModal } from '../components/MultiPrintTemplates/ItemModal';
import { RunConfirmModal } from '../components/MultiPrintTemplates/RunConfirmModal';
import { SelectedTemplateModal } from '../components/MultiPrintTemplates/SelectedTemplateModal';
import { TemplateFormModal } from '../components/MultiPrintTemplates/TemplateFormModal';
import { TemplatesList } from '../components/MultiPrintTemplates/TemplatesList';
import {
  DEFAULT_PRINT_OPTIONS,
  DEFAULT_SCHEDULE_OPTIONS,
  type AssignmentMode,
  type PrintOptions,
  type ScheduleOptions,
} from '../components/PrintModal/types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useBrowseQueries, useFormItemsDetailsQueries, useItemDetailsQueries, useMultiPrintTemplateQueries } from '../hooks/useMultiPrintTemplateQueries';
import { useMultiPrintTemplateMutations } from '../hooks/useMultiPrintTemplateMutations';

export function MultiPrintTemplatesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();

  const { templates, isLoading, printers, isLoadingPrinters, settings } = useMultiPrintTemplateQueries();
  const { deleteMutation, runMutation, createMutation, updateMutation } = useMultiPrintTemplateMutations();

  const [selectedTemplate, setSelectedTemplate] = useState<MultiPrintTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<MultiPrintTemplate | null>(null);
  const [runTemplate, setRunTemplate] = useState<MultiPrintTemplate | null>(null);
  const [runResult, setRunResult] = useState<MultiPrintTemplateRunResponse | null>(null);
  const [runOverrides, setRunOverrides] = useState({
    scheduled_time: '',
    override_printer_id: '',
    override_target_model: '',
  });
  const [formTemplate, setFormTemplate] = useState<MultiPrintTemplate | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState<FormItem | null>(null);
  const [itemAssignmentMode, setItemAssignmentMode] = useState<AssignmentMode>('printer');
  const [itemSelectedPrinters, setItemSelectedPrinters] = useState<number[]>([]);
  const [itemTargetModel, setItemTargetModel] = useState<string | null>(null);
  const [itemTargetLocation, setItemTargetLocation] = useState<string | null>(null);
  const [itemScheduleOptions, setItemScheduleOptions] = useState<ScheduleOptions>(DEFAULT_SCHEDULE_OPTIONS);
  const [itemPrintOptions, setItemPrintOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);
  const [itemCreateMultiple, setItemCreateMultiple] = useState(true);
  const [itemSourceType, setItemSourceType] = useState<'archive' | 'library'>('library');
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false);
  const [browseSearch, setBrowseSearch] = useState('');
  const [selectedLibraryFolderId, setSelectedLibraryFolderId] = useState<number | null>(null);
  const [fileWithPlates, setFileWithPlates] = useState<ArchivePlatesResponse | LibraryFilePlatesResponse | null>(null);
  const [selectedPlates, setSelectedPlates] = useState<Set<number>>(new Set());
  const [folderSearch, setFolderSearch] = useState('');
  const [fileSearch, setFileSearch] = useState('');
  // Filament mapping for the item modal
  const [itemManualMappings, setItemManualMappings] = useState<Record<number, number>>({});

  type FormItem = {
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
  };

  type FormItemPayload = MultiPrintTemplateCreate['items'][number];

  const emptyItem = (): FormItem => ({
    label: '',
    archive_id: '',
    library_file_id: '',
    plate_id: '',
    printer_id: '',
    target_model: '',
    target_location: '',
    ams_mapping: '',
    scheduled_time: '',
    manual_start: false,
    require_previous_success: false,
    auto_off_after: false,
    bed_levelling: DEFAULT_PRINT_OPTIONS.bed_levelling,
    flow_cali: DEFAULT_PRINT_OPTIONS.flow_cali,
    vibration_cali: DEFAULT_PRINT_OPTIONS.vibration_cali,
    layer_inspect: DEFAULT_PRINT_OPTIONS.layer_inspect,
    timelapse: DEFAULT_PRINT_OPTIONS.timelapse,
    use_ams: false,
    gcode_injection: false,
  });

  const [formItems, setFormItems] = useState<FormItem[]>([emptyItem()]);

  const { browseArchives, browseLibraryFolders, browseLibraryFiles } = useBrowseQueries(
    isItemModalOpen,
    isBrowseModalOpen,
    itemSourceType,
    selectedLibraryFolderId
  );

  const selectedPrinterId = itemSelectedPrinters.length === 1 ? itemSelectedPrinters[0] : itemDraft?.printer_id ? Number(itemDraft.printer_id) : null;
  const { archiveDetailsQuery, libraryFileDetailsQuery, printerStatusQuery } = useItemDetailsQueries(
    isItemModalOpen,
    itemDraft?.archive_id,
    itemDraft?.library_file_id,
    selectedPrinterId
  );

  // The selected plate for filament mapping queries
  const itemSelectedPlate = selectedPlates.size === 1 ? [...selectedPlates][0] : (itemDraft?.plate_id ? Number(itemDraft.plate_id) : null);

  // Fetch filament requirements for the selected item
  const { data: itemFilamentReqs } = useQuery({
    queryKey: ['multi-print-template-filament-reqs', itemDraft?.archive_id || itemDraft?.library_file_id, itemSelectedPlate],
    queryFn: async () => {
      if (itemDraft?.archive_id) {
        const data = await api.getArchiveFilamentRequirements(Number(itemDraft.archive_id), itemSelectedPlate ?? undefined);
        return { filaments: data.filaments } as { filaments: Array<{ slot_id: number; type: string; color: string; used_grams: number; used_meters: number; nozzle_id?: number }> };
      }
      if (itemDraft?.library_file_id) {
        const data = await api.getLibraryFileFilamentRequirements(Number(itemDraft.library_file_id), itemSelectedPlate ?? undefined);
        return { filaments: data.filaments } as { filaments: Array<{ slot_id: number; type: string; color: string; used_grams: number; used_meters: number; nozzle_id?: number }> };
      }
      return null;
    },
    enabled: isItemModalOpen && Boolean(itemDraft?.archive_id || itemDraft?.library_file_id),
  });

  const { archivesById, libraryFilesById, printersById } = useFormItemsDetailsQueries(formItems);

  const canManageTemplates = hasPermission('queue:update_all');
  const canRunTemplates = hasPermission('queue:create');

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name)),
    [templates]
  );

  const filteredTemplates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sortedTemplates;
    return sortedTemplates.filter((template) => template.name.toLowerCase().includes(term));
  }, [sortedTemplates, searchTerm]);

  const openCreateForm = () => {
    setFormTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormItems([]);
    setFormErrors([]);
    setIsFormOpen(true);
  };

  const openEditForm = (template: MultiPrintTemplate) => {
    setFormTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description || '');
    setFormItems(
      template.items.map((item: MultiPrintTemplateItem) => ({
        label: item.label || '',
        archive_id: item.archive_id ? String(item.archive_id) : '',
        library_file_id: item.library_file_id ? String(item.library_file_id) : '',
        plate_id: item.plate_id ? String(item.plate_id) : '',
        printer_id: item.printer_id ? String(item.printer_id) : '',
        target_model: item.target_model || '',
        target_location: item.target_location || '',
        ams_mapping: item.ams_mapping ? item.ams_mapping.join(',') : '',
        scheduled_time: item.scheduled_time ? item.scheduled_time.slice(0, 16) : '',
        manual_start: item.manual_start,
        require_previous_success: item.require_previous_success,
        auto_off_after: item.auto_off_after,
        bed_levelling: item.bed_levelling,
        flow_cali: item.flow_cali,
        vibration_cali: item.vibration_cali,
        layer_inspect: item.layer_inspect,
        timelapse: item.timelapse,
        use_ams: item.use_ams,
        gcode_injection: item.gcode_injection,
      }))
    );
    setFormErrors([]);
    setIsFormOpen(true);
  };

  const buildItemsPayload = (): FormItemPayload[] =>
    formItems.map((item: FormItem) => ({
      label: item.label ? item.label : null,
      archive_id: item.archive_id ? Number(item.archive_id) : null,
      library_file_id: item.library_file_id ? Number(item.library_file_id) : null,
      plate_id: item.plate_id ? Number(item.plate_id) : null,
      printer_id: item.printer_id ? Number(item.printer_id) : null,
      target_model: item.target_model || null,
      target_location: item.target_location || null,
      filament_overrides: null,
      ams_mapping: item.ams_mapping
        ? item.ams_mapping
            .split(',')
            .map((value: string) => value.trim())
            .filter(Boolean)
            .map((value: string) => Number(value))
        : null,
      scheduled_time: item.scheduled_time ? new Date(item.scheduled_time).toISOString() : null,
      manual_start: item.manual_start,
      require_previous_success: item.require_previous_success,
      auto_off_after: item.auto_off_after,
      bed_levelling: item.bed_levelling,
      flow_cali: item.flow_cali,
      vibration_cali: item.vibration_cali,
      layer_inspect: item.layer_inspect,
      timelapse: item.timelapse,
      use_ams: item.use_ams,
      gcode_injection: item.gcode_injection,
      project_id: null,
    }));

  const loadPlatesForItem = async (sourceType: 'archive' | 'library', sourceId: string, plateId?: string) => {
    if (!sourceId) {
      setFileWithPlates(null);
      setSelectedPlates(new Set());
      return;
    }

    const selectedId = Number(sourceId);
    const platesData = sourceType === 'archive'
      ? await api.getArchivePlates(selectedId)
      : await api.getLibraryFilePlates(selectedId);

    setFileWithPlates(platesData);

    if (platesData.plates.length === 0) {
      setSelectedPlates(new Set());
      return;
    }

    const existingPlate = plateId ? Number(plateId) : null;
    const matchingPlate = existingPlate && platesData.plates.some((plate) => plate.index === existingPlate)
      ? existingPlate
      : platesData.plates[0].index;

    setSelectedPlates(new Set([matchingPlate]));
    setItemDraft((prev) => (prev ? { ...prev, plate_id: String(matchingPlate) } : null));
  };

  const openItemModal = async (index?: number) => {
    setFormErrors([]);
    setFileWithPlates(null);
    setSelectedPlates(new Set());
    if (index !== undefined) {
      const item = formItems[index];
      setEditingItemIndex(index);
      setItemDraft({ ...item });
      setItemSourceType(item.archive_id ? 'archive' : 'library');
      const scheduleType = item.manual_start
        ? 'manual'
        : item.scheduled_time
        ? 'scheduled'
        : 'asap';
      setItemScheduleOptions({
        ...DEFAULT_SCHEDULE_OPTIONS,
        scheduleType,
        scheduledTime: item.scheduled_time,
        requirePreviousSuccess: item.require_previous_success,
        autoOffAfter: item.auto_off_after,
        gcodeInjection: item.gcode_injection,
      });
      setItemPrintOptions({
        bed_levelling: item.bed_levelling,
        flow_cali: item.flow_cali,
        vibration_cali: item.vibration_cali,
        layer_inspect: item.layer_inspect,
        timelapse: item.timelapse,
      });
      if (item.target_model) {
        setItemAssignmentMode('model');
        setItemTargetModel(item.target_model);
        setItemTargetLocation(item.target_location || null);
        setItemSelectedPrinters([]);
      } else {
        setItemAssignmentMode('printer');
        setItemSelectedPrinters(item.printer_id ? [Number(item.printer_id)] : []);
        setItemTargetModel(null);
        setItemTargetLocation(null);
      }

      const sourceType = item.archive_id ? 'archive' : 'library';
      const sourceId = item.archive_id || item.library_file_id;
      if (sourceId) {
        try {
          await loadPlatesForItem(sourceType, sourceId, item.plate_id || undefined);
        } catch (error) {
          console.error('Error loading plates for edit item:', error);
          showToast('Failed to load plates', 'error');
        }
      }
    } else {
      setEditingItemIndex(null);
      setItemDraft(emptyItem());
      setItemAssignmentMode('printer');
      setItemSelectedPrinters([]);
      setItemTargetModel(null);
      setItemTargetLocation(null);
      setItemSourceType('library');
      setItemScheduleOptions(DEFAULT_SCHEDULE_OPTIONS);
      setItemPrintOptions(DEFAULT_PRINT_OPTIONS);
      setItemCreateMultiple(true);
    }
    setIsItemModalOpen(true);
  };

  const openBrowseModal = (sourceType: 'archive' | 'library') => {
    setItemSourceType(sourceType);
    setBrowseSearch('');
    setFolderSearch('');
    setFileSearch('');
    setSelectedLibraryFolderId(null);
    setIsBrowseModalOpen(true);
  };

  const selectLibraryFolder = (folderId: number) => {
    setSelectedLibraryFolderId(folderId);
    setBrowseSearch('');
  };

  const selectBrowseItem = async (selectedId: number) => {
    if (!itemDraft) return;
    
    try {
      let platesData: ArchivePlatesResponse | LibraryFilePlatesResponse | null = null;

      if (itemSourceType === 'archive') {
        platesData = await api.getArchivePlates(selectedId);
        setItemDraft({
          ...itemDraft,
          archive_id: String(selectedId),
          library_file_id: '',
          plate_id: '',
        });
      } else {
        platesData = await api.getLibraryFilePlates(selectedId);
        setItemDraft({
          ...itemDraft,
          archive_id: '',
          library_file_id: String(selectedId),
          plate_id: '',
        });
      }

      setFileWithPlates(platesData);
      if (platesData && platesData.plates.length > 0) {
        const firstPlate = platesData.plates[0].index;
        setSelectedPlates(new Set([firstPlate]));
        setItemDraft((prev) => (prev ? { ...prev, plate_id: String(firstPlate) } : null));
      } else {
        setSelectedPlates(new Set());
      }

      setIsBrowseModalOpen(false);
    } catch (error) {
      showToast('Failed to load plates', 'error');
      console.error('Error loading plates:', error);
    }
  };

  const handlePlateToggle = (plateIndex: number) => {
    const nextSelected = selectedPlates.has(plateIndex) ? new Set<number>() : new Set<number>([plateIndex]);
    setSelectedPlates(nextSelected);
    setItemDraft((prev) => (prev ? { ...prev, plate_id: nextSelected.size > 0 ? String(plateIndex) : '' } : null));
  };

  const closeItemModal = () => {
    setIsItemModalOpen(false);
    setEditingItemIndex(null);
    setItemDraft(null);
    setFormErrors([]);
    setFileWithPlates(null);
    setSelectedPlates(new Set());
  };

  const applyItemDraft = () => {
    if (!itemDraft) return;
    const errors: string[] = [];

    const hasArchive = !!itemDraft.archive_id.trim();
    const hasLibrary = !!itemDraft.library_file_id.trim();
    if (hasArchive === hasLibrary) {
      errors.push(t('multiPrintTemplates.validation.sourceRequired', { index: 1 }));
    }
    if (itemDraft.plate_id.trim() && Number(itemDraft.plate_id) < 1) {
      errors.push(t('multiPrintTemplates.validation.plateInvalid', { index: 1 }));
    }
    if (itemAssignmentMode === 'printer' && itemSelectedPrinters.length === 0) {
      errors.push(t('multiPrintTemplates.validation.printerRequired'));
    }
    if (itemAssignmentMode === 'model' && !itemTargetModel) {
      errors.push(t('multiPrintTemplates.validation.targetModelRequired'));
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    const scheduleType = itemScheduleOptions.scheduleType;
    const scheduledTime = scheduleType === 'scheduled' ? itemScheduleOptions.scheduledTime : '';

    const baseItem: FormItem = {
      ...itemDraft,
      scheduled_time: scheduledTime,
      manual_start: scheduleType === 'manual',
      require_previous_success: itemScheduleOptions.requirePreviousSuccess,
      auto_off_after: itemScheduleOptions.autoOffAfter,
      gcode_injection: itemScheduleOptions.gcodeInjection,
      bed_levelling: itemPrintOptions.bed_levelling,
      flow_cali: itemPrintOptions.flow_cali,
      vibration_cali: itemPrintOptions.vibration_cali,
      layer_inspect: itemPrintOptions.layer_inspect,
      timelapse: itemPrintOptions.timelapse,
    };

    const newItems: FormItem[] = [];
    if (itemAssignmentMode === 'model') {
      newItems.push({
        ...baseItem,
        printer_id: '',
        target_model: itemTargetModel || '',
        target_location: itemTargetLocation || '',
      });
    } else {
      const printerIds = itemCreateMultiple ? itemSelectedPrinters : itemSelectedPrinters.slice(0, 1);
      printerIds.forEach((printerId: number) => {
        newItems.push({
          ...baseItem,
          printer_id: String(printerId),
          target_model: '',
          target_location: '',
        });
      });
    }

    setFormItems((prev: FormItem[]) => {
      if (editingItemIndex === null) {
        return [...prev, ...newItems];
      }
      const next = [...prev];
      next.splice(editingItemIndex, 1, ...newItems);
      return next;
    });

    setFormErrors([]);
    closeItemModal();
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (!formName.trim()) {
      errors.push(t('multiPrintTemplates.validation.nameRequired'));
    }
    if (formItems.length === 0) {
      errors.push(t('multiPrintTemplates.validation.itemRequired'));
    }
    formItems.forEach((item: FormItem, index: number) => {
      const hasArchive = !!item.archive_id.trim();
      const hasLibrary = !!item.library_file_id.trim();
      if (hasArchive === hasLibrary) {
        errors.push(t('multiPrintTemplates.validation.sourceRequired', { index: index + 1 }));
      }
      if (item.printer_id.trim() && item.target_model.trim()) {
        errors.push(t('multiPrintTemplates.validation.printerTargetConflict', { index: index + 1 }));
      }
      if (item.plate_id.trim() && Number(item.plate_id) < 1) {
        errors.push(t('multiPrintTemplates.validation.plateInvalid', { index: index + 1 }));
      }
      if (item.ams_mapping.trim()) {
        const parsed = item.ams_mapping
          .split(',')
          .map((value: string) => value.trim())
          .filter(Boolean)
          .map((value: string) => Number(value));
        if (parsed.some((value: number) => Number.isNaN(value))) {
          errors.push(t('multiPrintTemplates.validation.amsInvalid', { index: index + 1 }));
        }
      }
    });
    setFormErrors(errors);
    return errors.length === 0;
  };

  const handleFormSave = () => {
    if (!validateForm()) return;
    const payload = {
      name: formName.trim(),
      description: formDescription.trim(),
      items: buildItemsPayload(),
    };
    if (formTemplate) {
      updateMutation.mutate({ id: formTemplate.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
    setFormTemplate(null);
    setIsFormOpen(false);
  };

  const resetRunState = () => {
    setRunOverrides({ scheduled_time: '', override_printer_id: '', override_target_model: '' });
    setRunResult(null);
    setRunTemplate(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t('multiPrintTemplates.title')}</h1>
          <p className="text-sm text-bambu-gray">{t('multiPrintTemplates.subtitle')}</p>
        </div>
        <Button
          variant="primary"
          onClick={openCreateForm}
          disabled={!canManageTemplates}
          title={!canManageTemplates ? t('multiPrintTemplates.noEditPermission') : undefined}
        >
          {t('multiPrintTemplates.create')}
        </Button>
      </div>

      <TemplatesList
        templates={filteredTemplates}
        isLoading={isLoading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onView={setSelectedTemplate}
        onEdit={openEditForm}
        onRun={setRunTemplate}
        onDelete={setDeleteTemplate}
        canManageTemplates={canManageTemplates}
        canRunTemplates={canRunTemplates}
      />

      {selectedTemplate && !isFormOpen && !isItemModalOpen && !isBrowseModalOpen && !runTemplate && (
        <SelectedTemplateModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      <TemplateFormModal
        isOpen={isFormOpen && !isItemModalOpen && !isBrowseModalOpen}
        isEditing={!!formTemplate}
        formName={formName}
        onNameChange={setFormName}
        formDescription={formDescription}
        onDescriptionChange={setFormDescription}
        formItems={formItems}
        onAddItem={() => openItemModal()}
        onEditItem={openItemModal}
        onRemoveItem={(idx) => setFormItems(formItems.filter((_: FormItem, i: number) => i !== idx))}
        formErrors={formErrors}
        archivesById={archivesById}
        libraryFilesById={libraryFilesById}
        printersById={printersById}
        onSave={handleFormSave}
        onCancel={() => {
          setFormTemplate(null);
          setIsFormOpen(false);
        }}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      {deleteTemplate && (
        <ConfirmModal
          title={t('multiPrintTemplates.deleteConfirmTitle')}
          message={t('multiPrintTemplates.deleteConfirmMessage', { name: deleteTemplate.name })}
          confirmText={t('common.delete')}
          variant="danger"
          onCancel={() => setDeleteTemplate(null)}
          onConfirm={() => {
            deleteMutation.mutate(deleteTemplate.id);
            setDeleteTemplate(null);
          }}
        />
      )}

      <ItemModal
        isOpen={isItemModalOpen && !isBrowseModalOpen}
        isEditing={editingItemIndex !== null}
        itemDraft={itemDraft}
        onItemDraftChange={setItemDraft}
        itemSourceType={itemSourceType}
        onSourceTypeChange={setItemSourceType}
        onBrowseClick={openBrowseModal}
        fileWithPlates={fileWithPlates}
        selectedPlates={selectedPlates}
        onPlateToggle={handlePlateToggle}
        archiveDetails={archiveDetailsQuery.data}
        libraryFileDetails={libraryFileDetailsQuery.data}
        itemSelectedPrinters={itemSelectedPrinters}
        onSelectedPrintersChange={setItemSelectedPrinters}
        itemAssignmentMode={itemAssignmentMode}
        onAssignmentModeChange={setItemAssignmentMode}
        itemTargetModel={itemTargetModel}
        onTargetModelChange={setItemTargetModel}
        itemTargetLocation={itemTargetLocation}
        onTargetLocationChange={setItemTargetLocation}
        printerStatusName={printerStatusQuery.data?.name}
        itemCreateMultiple={itemCreateMultiple}
        onCreateMultipleChange={setItemCreateMultiple}
        itemScheduleOptions={itemScheduleOptions}
        onScheduleOptionsChange={setItemScheduleOptions}
        itemPrintOptions={itemPrintOptions}
        onPrintOptionsChange={setItemPrintOptions}
        printers={printers}
        isLoadingPrinters={isLoadingPrinters}
        settings={settings}
        canControlPrinter={hasPermission('printers:control')}
        formErrors={formErrors}
        onClose={closeItemModal}
        onSave={applyItemDraft}
        itemFilamentReqs={itemFilamentReqs}
        itemManualMappings={itemManualMappings}
        onItemManualMappingsChange={setItemManualMappings}
      />

      {isBrowseModalOpen && !runTemplate && (
        <BrowseModal
          sourceType={itemSourceType}
          browseSearch={browseSearch}
          onSearchChange={setBrowseSearch}
          browseArchives={browseArchives}
          browseLibraryFolders={browseLibraryFolders}
          selectedLibraryFolderId={selectedLibraryFolderId}
          onSelectLibraryFolder={selectLibraryFolder}
          onClearLibraryFolder={() => setSelectedLibraryFolderId(null)}
          browseLibraryFiles={browseLibraryFiles}
          onSelectItem={selectBrowseItem}
          onClose={() => setIsBrowseModalOpen(false)}
          folderSearch={folderSearch}
          onFolderSearchChange={setFolderSearch}
          fileSearch={fileSearch}
          onFileSearchChange={setFileSearch}
        />
      )}

      {runTemplate && (
        <RunConfirmModal
          template={runTemplate}
          runResult={runResult}
          runOverrides={runOverrides}
          onOverridesChange={setRunOverrides}
          onConfirm={() => {
            setRunResult({
              created_queue_ids: [],
              failed_items: [],
            });
            runMutation.mutate({
              id: runTemplate.id,
              data: {
                scheduled_time: runOverrides.scheduled_time
                  ? new Date(runOverrides.scheduled_time).toISOString()
                  : null,
                override_printer_id: runOverrides.override_printer_id
                  ? Number(runOverrides.override_printer_id)
                  : null,
                override_target_model: runOverrides.override_target_model || null,
              },
            });
          }}
          onCancel={resetRunState}
          isPending={runMutation.isPending}
        />
      )}
    </div>
  );
}
