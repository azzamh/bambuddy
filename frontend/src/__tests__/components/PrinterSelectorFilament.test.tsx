/**
 * Tests for restricting printer choice to those that can actually run the
 * plate: a printer with no PETG spool cannot print a PETG plate, so offering
 * it only leads to a job that stalls or comes out in the wrong material.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { render } from '../utils';
import { server } from '../mocks/server';
import { PrinterSelector } from '../../components/PrintModal/PrinterSelector';
import type { Printer } from '../../api/client';

const printers = [
  { id: 1, name: 'Has PETG', model: 'A1 Mini', ip_address: '192.168.1.1', is_active: true },
  { id: 2, name: 'Only PLA', model: 'A1 Mini', ip_address: '192.168.1.2', is_active: true },
] as unknown as Printer[];

/** Slot 1 needs PETG; printer 1 has it loaded, printer 2 does not. */
function mockStatuses() {
  server.use(
    http.get('/api/v1/printers/:id/status', ({ params }) => {
      const id = Number(params.id);
      const type = id === 1 ? 'PETG' : 'PLA';
      return HttpResponse.json({
        id,
        connected: true,
        state: 'IDLE',
        ams: [{ id: 0, tray: [{ id: 0, tray_type: type, tray_color: 'FFFFFF' }] }],
        vt_tray: [],
        ams_extruder_map: {},
      });
    }),
  );
}

const petgPlate = {
  filaments: [{ slot_id: 1, type: 'PETG', color: '#00FF00', used_grams: 25, used_meters: 8.5 }],
};

function renderSelector(props: Record<string, unknown> = {}) {
  const onMultiSelect = vi.fn();
  render(
    <PrinterSelector
      printers={printers}
      selectedPrinterIds={[]}
      onMultiSelect={onMultiSelect}
      allowMultiple
      filamentReqs={petgPlate}
      {...props}
    />,
  );
  return { onMultiSelect };
}

describe('PrinterSelector — filament availability', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lists only printers that have the plate’s filament loaded', async () => {
    mockStatuses();
    renderSelector();

    // Statuses arrive asynchronously; until they do every printer is offered,
    // since hiding on missing data would be worse than a late correction
    await waitFor(() => expect(screen.queryByText('Only PLA')).not.toBeInTheDocument());
    expect(screen.getByText('Has PETG')).toBeInTheDocument();
  });

  it('says which filament is missing rather than just "hidden"', async () => {
    mockStatuses();
    renderSelector();

    await waitFor(() => expect(screen.getByText(/PETG not loaded/)).toBeInTheDocument());
  });

  it('reveals the incompatible printer on "show all", but not for selecting', async () => {
    mockStatuses();
    const { onMultiSelect } = renderSelector();

    await waitFor(() => expect(screen.getByText(/show all/)).toBeInTheDocument());
    await userEvent.click(screen.getByText(/show all/));

    const row = await screen.findByText('Only PLA');
    expect(row).toBeInTheDocument();
    // The badge names the missing material
    expect(screen.getByText('No PETG')).toBeInTheDocument();

    await userEvent.click(row);
    expect(onMultiSelect).not.toHaveBeenCalled();
  });

  it('still allows selecting a printer that has the filament', async () => {
    mockStatuses();
    const { onMultiSelect } = renderSelector();

    const row = await screen.findByText('Has PETG');
    await userEvent.click(row);

    expect(onMultiSelect).toHaveBeenCalledWith([1]);
  });

  it('leaves every printer available when the plate needs nothing specific', async () => {
    mockStatuses();
    renderSelector({ filamentReqs: undefined });

    await waitFor(() => expect(screen.getByText('Has PETG')).toBeInTheDocument());
    expect(screen.getByText('Only PLA')).toBeInTheDocument();
  });

  it('still lets you schedule when no printer has the filament loaded yet', async () => {
    // Restricting is only useful when there is a better choice to steer towards.
    // With no PETG anywhere, blocking every row would make the plate
    // unschedulable — the spool can be loaded before the job runs.
    server.use(
      http.get('/api/v1/printers/:id/status', ({ params }) =>
        HttpResponse.json({
          id: Number(params.id),
          connected: true,
          state: 'IDLE',
          ams: [{ id: 0, tray: [{ id: 0, tray_type: 'PLA', tray_color: 'FFFFFF' }] }],
          vt_tray: [],
          ams_extruder_map: {},
        }),
      ),
    );
    const { onMultiSelect } = renderSelector();

    await waitFor(() => expect(screen.getByText('Has PETG')).toBeInTheDocument());
    expect(screen.getByText('Only PLA')).toBeInTheDocument();

    // Flagged as missing, but still selectable
    await waitFor(() => expect(screen.getAllByText('No PETG')).toHaveLength(2));
    await userEvent.click(screen.getByText('Only PLA'));
    expect(onMultiSelect).toHaveBeenCalledWith([2]);
  });

  it('treats a printer whose status has not arrived as available', async () => {
    // Hiding printers on missing data would look like the fleet vanished
    server.use(
      http.get('/api/v1/printers/:id/status', () => new Promise(() => {})),
    );
    const { onMultiSelect } = renderSelector();

    const row = await screen.findByText('Only PLA');
    await userEvent.click(row);
    expect(onMultiSelect).toHaveBeenCalledWith([2]);
  });
});
