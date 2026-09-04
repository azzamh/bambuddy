/**
 * Tests for the AMS slot picker.
 *
 * It replaces a native <select> specifically so a filament colour swatch can
 * sit beside each slot name — native <option> renders text only. These tests
 * therefore assert on the swatch colours as much as on the labels.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlotSelect, type SlotOption } from '../../components/PrintModal/SlotSelect';

const options: SlotOption[] = [
  { value: 0, color: '#000000', label: 'A1: PETG', detail: '(Black)' },
  { value: 1, color: '#8B4513', label: 'A2: PLA', detail: '(Brown)' },
  { value: 2, color: '#FFFFFF', label: 'A3: PLA', detail: '(Jade White)' },
];

function setup(props: Partial<React.ComponentProps<typeof SlotSelect>> = {}) {
  const onChange = vi.fn();
  render(
    <SlotSelect
      value={props.value ?? ''}
      options={options}
      placeholder="-- Select slot --"
      onChange={props.onChange ?? onChange}
      {...props}
    />,
  );
  return { onChange: props.onChange ?? onChange };
}

/** The rendered background colour of a swatch, as the browser normalizes it. */
function swatchColors(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('span[style*="background-color"]'))
    .map((el) => el.style.backgroundColor);
}

describe('SlotSelect', () => {
  afterEach(cleanup);

  it('shows the placeholder when no slot is chosen', () => {
    setup();
    expect(screen.getByRole('combobox')).toHaveTextContent('-- Select slot --');
  });

  it('shows the chosen slot with its colour swatch', () => {
    setup({ value: 1 });
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('A2: PLA');
    expect(swatchColors(trigger)).toEqual(['rgb(139, 69, 19)']);
  });

  it('gives every slot in the list its own colour swatch', async () => {
    setup();
    await userEvent.click(screen.getByRole('combobox'));

    const list = screen.getByRole('listbox');
    expect(swatchColors(list)).toEqual([
      'rgb(0, 0, 0)',
      'rgb(139, 69, 19)',
      'rgb(255, 255, 255)',
    ]);
  });

  it('lists the placeholder plus every option', async () => {
    setup();
    await userEvent.click(screen.getByRole('combobox'));

    const entries = screen.getAllByRole('option');
    expect(entries).toHaveLength(options.length + 1);
    expect(entries[0]).toHaveTextContent('-- Select slot --');
    expect(entries[2]).toHaveTextContent('A2: PLA');
    expect(entries[2]).toHaveTextContent('(Brown)');
  });

  it('reports the chosen slot and closes', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /A3: PLA/ }));

    expect(onChange).toHaveBeenCalledWith('2');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('reports an empty value when the placeholder is picked', async () => {
    const { onChange } = setup({ value: 1 });
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /Select slot/ }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('marks the current slot as selected', async () => {
    setup({ value: 1 });
    await userEvent.click(screen.getByRole('combobox'));

    const entries = screen.getAllByRole('option');
    expect(entries[2]).toHaveAttribute('aria-selected', 'true');
    expect(entries[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('can be driven from the keyboard', async () => {
    const { onChange } = setup();
    const trigger = screen.getByRole('combobox');
    trigger.focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Placeholder -> first slot
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('0');
  });

  it('closes on Escape without choosing anything', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes when clicking away', async () => {
    setup();
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // The picker closes via a full-screen backdrop, so click that rather than
    // the body — a bare body click has nothing to propagate to in jsdom.
    await userEvent.click(screen.getByTestId('slot-select-backdrop'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
