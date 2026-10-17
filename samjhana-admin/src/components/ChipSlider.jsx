import { useEffect, useRef } from 'react';

/**
 * A row of choice chips the operator swipes sideways, for phones and tablets. Same look
 * and feel as the business filter on the Records page. One chip is selected at a time.
 * items: [{ value, label, icon?: Component, dot?: 'bg-…' class, count?: string }]
 */
export default function ChipSlider({ label, items, value, onChange, className = '' }) {
  const selectedRef = useRef(null);

  useEffect(() => {
    // Keep the chosen chip in view when the page opens on, or changes to, a far-right choice.
    selectedRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [value]);

  return (
    <div className={`-mx-1 overflow-x-auto px-1 pb-1 ${className}`} role="group" aria-label={label}>
      <div className="flex min-w-max gap-2">
        {items.map((item) => {
          const active = item.value === value;
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.value}
              ref={active ? selectedRef : null}
              onClick={() => onChange(item.value)}
              aria-pressed={active}
              className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500 focus-visible:ring-offset-2 ${
                active ? 'bg-core-800 text-white' : 'bg-core-100 text-core-700 hover:bg-core-200'
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
              {item.dot ? <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} aria-hidden="true" /> : null}
              {item.label}
              {item.count !== undefined ? (
                <span aria-hidden="true" className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/15 text-white' : 'bg-white text-core-500 ring-1 ring-core-200'}`}>{item.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
