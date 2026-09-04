import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

/** One AMS slot as offered in the dropdown. */
export interface SlotOption {
  value: number;
  /** CSS colour of the loaded filament, e.g. "#A020F0" */
  color: string;
  /** Slot and material, e.g. "A2: PLA Basic" */
  label: string;
  /** Colour name and any extra hints, e.g. "(Brown) - 210g left" */
  detail?: string;
}

interface SlotSelectProps {
  value: number | '';
  options: SlotOption[];
  placeholder: string;
  onChange: (value: string) => void;
  /** Border / text colour classes reflecting the match status */
  className?: string;
  title?: string;
}

/**
 * Slot picker with a filament colour swatch beside every entry.
 *
 * A native <select> cannot do this: browsers render <option> text only, and
 * macOS ignores option styling outright, so the colour could never be shown
 * next to the name.
 *
 * The list is portalled to the body and positioned from the trigger's rect —
 * the per-plate configuration panel is `overflow-hidden`, which would clip a
 * dropdown rendered in place.
 */
export function SlotSelect({ value, options, placeholder, onChange, className = '', title }: SlotSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; openUpward: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  // Index 0 is the "no slot" entry, so options are offset by one
  const entries = [null, ...options];

  const position = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(entries.length * 32 + 8, 260);
    const spaceBelow = window.innerHeight - r.bottom;
    const openUpward = spaceBelow < estimatedHeight && r.top > spaceBelow;
    setRect({
      left: r.left,
      top: openUpward ? r.top : r.bottom,
      width: r.width,
      openUpward,
    });
  }, [entries.length]);

  useLayoutEffect(() => {
    if (open) position();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    // Any scroll or resize invalidates the anchor, and re-measuring on every
    // scroll frame is not worth it for a small picker — just close.
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const commit = (next: number | '') => {
    onChange(next === '' ? '' : String(next));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActiveIndex(Math.max(0, entries.findIndex((o) => (o?.value ?? '') === value)));
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(entries.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(entries.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const entry = entries[activeIndex];
      commit(entry ? entry.value : '');
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        title={title}
        className={`flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 rounded border text-xs bg-bambu-dark-secondary focus:outline-none focus:ring-1 focus:ring-bambu-green ${className}`}
      >
        {selected ? (
          <>
            <span
              className="w-3 h-3 rounded-full border shrink-0 border-white/20"
              style={{ backgroundColor: selected.color }}
            />
            <span className="truncate">{selected.label}</span>
            {selected.detail && <span className="truncate text-bambu-gray">{selected.detail}</span>}
          </>
        ) : (
          <span className="truncate text-bambu-gray">{placeholder}</span>
        )}
        <ChevronDown className="w-3 h-3 ml-auto shrink-0" />
      </button>

      {open && rect && createPortal(
        <>
          <div
            data-testid="slot-select-backdrop"
            className="fixed inset-0 z-[200]"
            onClick={() => setOpen(false)}
          />
          <div
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="fixed z-[201] py-1 overflow-y-auto border rounded-lg shadow-xl max-h-64 bg-bambu-dark-secondary border-bambu-dark-tertiary"
            style={{
              left: rect.left,
              width: Math.max(rect.width, 200),
              ...(rect.openUpward
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.top + 4 }),
            }}
          >
            {entries.map((entry, index) => {
              const isSelected = (entry?.value ?? '') === value;
              const isActive = index === activeIndex;
              return (
                <button
                  key={entry?.value ?? 'none'}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(entry ? entry.value : '')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isActive ? 'bg-bambu-dark' : ''
                  } ${isSelected ? 'text-bambu-green' : 'text-white'}`}
                >
                  <Check className={`w-3 h-3 shrink-0 ${isSelected ? '' : 'opacity-0'}`} />
                  {entry ? (
                    <>
                      <span
                        className="w-3.5 h-3.5 rounded-full border shrink-0 border-white/20"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="truncate">{entry.label}</span>
                      {entry.detail && <span className="truncate text-bambu-gray">{entry.detail}</span>}
                    </>
                  ) : (
                    <span className="text-bambu-gray">{placeholder}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
