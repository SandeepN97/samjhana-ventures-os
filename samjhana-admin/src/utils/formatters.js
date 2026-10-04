/**
 * Formatters for Samjhana Ventures OS
 * 
 * Supports:
 * - Nepali numerals (१, २, ३, ४, ५, ६, ७, ८, ९, ०)
 * - Lakhs/Crores formatting (1,00,000 instead of 100,000)
 * - NPR currency formatting
 */

// Nepali numeral mapping
const NEPALI_NUMERALS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const ENGLISH_NUMERALS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Convert English numerals to Nepali numerals
 * @param {string|number} num - Number to convert
 * @returns {string} Number with Nepali numerals
 */
export function toNepaliNumerals(num) {
  if (num === null || num === undefined) return '';
  return String(num).replace(/[0-9]/g, (digit) => NEPALI_NUMERALS[parseInt(digit)]);
}

/**
 * Convert Nepali numerals to English numerals
 * @param {string} str - String with Nepali numerals
 * @returns {string} String with English numerals
 */
export function toEnglishNumerals(str) {
  if (!str) return '';
  return String(str).replace(/[०-९]/g, (digit) => {
    const idx = NEPALI_NUMERALS.indexOf(digit);
    return idx >= 0 ? ENGLISH_NUMERALS[idx] : digit;
  });
}

/**
 * Format number with Indian numbering system (Lakhs/Crores)
 * 1,00,000 for 1 Lakh
 * 1,00,00,000 for 1 Crore
 * 
 * @param {number|string} num - Number to format
 * @param {boolean} useNepaliNumerals - Use Nepali numerals
 * @returns {string} Formatted number
 */
function formatIndianNumber(num, useNepaliNumerals = false) {
  if (num === null || num === undefined || num === '') return '';
  
  // Parse the number
  const number = typeof num === 'string' ? parseFloat(toEnglishNumerals(num)) : num;
  if (isNaN(number)) return '';
  
  // Handle negative numbers
  const isNegative = number < 0;
  const absNumber = Math.abs(number);
  
  // Split into integer and decimal parts
  const [intPart, decPart] = absNumber.toString().split('.');
  
  // Format the integer part with Indian grouping
  let formattedInt = '';
  const len = intPart.length;
  
  if (len <= 3) {
    formattedInt = intPart;
  } else {
    // Last 3 digits
    formattedInt = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    
    // Group remaining digits in pairs
    while (remaining.length > 0) {
      const chunk = remaining.slice(-2);
      formattedInt = chunk + ',' + formattedInt;
      remaining = remaining.slice(0, -2);
    }
  }
  
  // Add decimal part if exists
  let result = decPart ? `${formattedInt}.${decPart}` : formattedInt;
  
  // Add negative sign
  if (isNegative) {
    result = '-' + result;
  }
  
  // Convert to Nepali numerals if requested
  if (useNepaliNumerals) {
    result = toNepaliNumerals(result);
  }
  
  return result;
}

/**
 * Format as currency (NPR)
 * 
 * @param {number|string} amount - Amount to format
 * @param {boolean} showSymbol - Show "रु" symbol
 * @param {boolean} useNepaliNumerals - Use Nepali numerals
 * @returns {string} Formatted currency
 */
export function formatCurrency(amount, showSymbol = true, useNepaliNumerals = false) {
  if (amount === null || amount === undefined || amount === '') return '';
  
  const number = typeof amount === 'string' ? parseFloat(toEnglishNumerals(amount)) : amount;
  if (isNaN(number)) return '';
  
  // Round to 2 decimal places
  const rounded = Math.round(number * 100) / 100;
  
  // Format with Indian numbering
  const formatted = formatIndianNumber(rounded.toFixed(2), useNepaliNumerals);
  
  // Remove trailing zeros after decimal
  const cleaned = formatted.replace(/\.00$/, '');
  
  return showSymbol ? `रु ${cleaned}` : cleaned;
}
