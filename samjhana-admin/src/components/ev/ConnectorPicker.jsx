import { Check, Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useLocaleFormat from '../../hooks/useLocaleFormat';

const CONNECTORS = [1, 2];

/**
 * The charger's connectors (nozzles) as tap cards, in the same style as the charger cards above
 * them. A connector with an open session is shown "in use" and can't be picked; nothing can be
 * picked until a charger is chosen.
 */
export default function ConnectorPicker({ labelId, value, occupied, disabled = false, onSelect }) {
  const { t } = useTranslation();
  const { num } = useLocaleFormat();

  return (
    <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-2 gap-2">
      {CONNECTORS.map((connectorId) => {
        const inUse = occupied.has(connectorId);
        const selected = !disabled && !inUse && Number(value) === connectorId;
        const name = t('evLive.connectorNumber', { number: num(connectorId) });
        const status = inUse ? t('evLive.connectorInUse') : t('evLive.connectorFree');
        return (
          <button
            key={connectorId}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${name}, ${status}`}
            disabled={disabled || inUse}
            onClick={() => onSelect(String(connectorId))}
            className={`relative flex min-h-[64px] items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
              selected ? 'border-ev-500 bg-ev-50' : 'border-gray-200 bg-white'
            } ${disabled || inUse ? 'cursor-not-allowed opacity-60' : 'active:scale-[0.97]'}`}
          >
            {selected && (
              <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ev-500 text-white">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
            <span
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                selected ? 'bg-ev-500 text-white' : inUse ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <Plug className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-tight text-gray-800">{name}</span>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  inUse ? 'bg-amber-100 text-amber-700' : 'bg-ev-100 text-ev-700'
                }`}
              >
                ● {status}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
