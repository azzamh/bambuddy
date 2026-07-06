import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../utils';
import { TemplateFormModal } from '../../components/MultiPrintTemplates/TemplateFormModal';

function createDefaultProps() {
  return {
    isOpen: true,
    isEditing: false,
    formName: 'Farm batch',
    onNameChange: vi.fn(),
    formDescription: 'Night run',
    onDescriptionChange: vi.fn(),
    formItems: [
      {
        label: 'Top plate run',
        archive_id: '10',
        library_file_id: '',
        plate_id: '2',
        printer_id: '1',
        target_model: '',
        target_location: '',
        ams_mapping: '',
        scheduled_time: '',
        manual_start: false,
        require_previous_success: false,
        auto_off_after: false,
        bed_levelling: true,
        flow_cali: false,
        vibration_cali: true,
        layer_inspect: false,
        timelapse: false,
        use_ams: true,
        gcode_injection: false,
      },
    ],
    onAddItem: vi.fn(),
    onEditItem: vi.fn(),
    onDuplicateItem: vi.fn(),
    onRemoveItem: vi.fn(),
    formErrors: [],
    archivesById: {
      10: {
        file_path: '/archives/farm-batch.3mf',
      },
    },
    libraryFilesById: {},
    printersById: {
      1: {
        name: 'P1S Farm 01',
      },
    },
    platesBySource: {
      'archive:10': {
        archive_id: 10,
        filename: 'farm-batch.3mf',
        is_multi_plate: true,
        plates: [
          {
            index: 2,
            name: 'Top Plate',
            objects: [],
            has_thumbnail: true,
            thumbnail_url: '/api/v1/archives/10/plate-thumbnail/2',
            print_time_seconds: null,
            filament_used_grams: null,
            filaments: [],
          },
        ],
      },
    },
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isSaving: false,
  };
}

describe('TemplateFormModal', () => {
  it('renders queue item plate details inside the modal', () => {
    render(<TemplateFormModal {...createDefaultProps()} />);

    expect(screen.getByRole('dialog', { name: /create new template/i })).toBeInTheDocument();
    expect(screen.getByText('Top plate run')).toBeInTheDocument();
    expect(screen.getByText('P1S Farm 01')).toBeInTheDocument();
    expect(screen.getByText('Plate to print')).toBeInTheDocument();
    expect(screen.getByText('Top Plate')).toBeInTheDocument();
    expect(screen.getByText('Plate #2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Plate #2 preview' })).toHaveAttribute(
      'src',
      expect.stringContaining('/api/v1/archives/10/plate-thumbnail/2')
    );
  });

  it('duplicates a queue item from the item actions', async () => {
    const user = userEvent.setup();
    const props = createDefaultProps();

    render(<TemplateFormModal {...props} />);

    await user.click(screen.getByRole('button', { name: /duplicate/i }));

    expect(props.onDuplicateItem).toHaveBeenCalledWith(0);
  });

  it('shows default plate text when an item has no specific plate', () => {
    const props = createDefaultProps();
    props.formItems = [
      {
        ...props.formItems[0],
        plate_id: '',
      },
    ];

    render(<TemplateFormModal {...props} />);

    expect(screen.getByText('Default plate')).toBeInTheDocument();
  });
});
