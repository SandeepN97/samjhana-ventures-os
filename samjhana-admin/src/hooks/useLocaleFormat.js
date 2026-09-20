import { useTranslation } from 'react-i18next';
import { formatCurrency, toNepaliNumerals } from '../utils/formatters';

/**
 * Locale-aware number helpers: Devanagari numerals in Nepali, and Lakhs/Crores grouping
 * for money (1,00,000 not 100,000). The currency symbol follows the language too:
 * "Rs" in English, "रु" in Nepali.
 */
export default function useLocaleFormat() {
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const currency = isNepali ? 'रु' : 'Rs';
  return {
    isNepali,
    currency,
    num: (value) => (isNepali ? toNepaliNumerals(value) : String(value)),
    money: (amount) => {
      const formatted = formatCurrency(amount, false, isNepali);
      return formatted === '' ? '' : `${currency} ${formatted}`;
    },
  };
}
