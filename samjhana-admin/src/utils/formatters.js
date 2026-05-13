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
export function formatIndianNumber(num, useNepaliNumerals = false) {
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
 * Alias for formatIndianNumber with Nepali numerals
 */
export function formatNepaliNumber(num) {
  return formatIndianNumber(num, true);
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

/**
 * Format as Nepali currency with Nepali numerals
 */
export function formatNepaliCurrency(amount) {
  return formatCurrency(amount, true, true);
}

/**
 * Parse formatted number back to raw number
 * 
 * @param {string} formatted - Formatted number string
 * @returns {number} Parsed number
 */
export function parseFormattedNumber(formatted) {
  if (!formatted) return 0;
  
  // Convert Nepali numerals to English
  let cleaned = toEnglishNumerals(formatted);
  
  // Remove currency symbol and commas
  cleaned = cleaned.replace(/[रु\s,]/g, '');
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format number in words (Nepali)
 * Useful for cheque amounts
 * 
 * @param {number} num - Number to convert
 * @returns {string} Number in Nepali words
 */
export function numberToNepaliWords(num) {
  if (num === 0) return 'शून्य';
  if (num < 0) return 'ऋणात्मक ' + numberToNepaliWords(-num);
  
  const ones = ['', 'एक', 'दुई', 'तीन', 'चार', 'पाँच', 'छ', 'सात', 'आठ', 'नौ'];
  const tens = ['', 'दश', 'बीस', 'तीस', 'चालीस', 'पचास', 'साठी', 'सत्तरी', 'अस्सी', 'नब्बे'];
  const hundreds = ['', 'एक सय', 'दुई सय', 'तीन सय', 'चार सय', 'पाँच सय', 'छ सय', 'सात सय', 'आठ सय', 'नौ सय'];
  
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = Math.floor((num % 1000) / 100);
  const ten = Math.floor((num % 100) / 10);
  const one = num % 10;
  
  let result = '';
  
  if (crore > 0) {
    result += numberToNepaliWords(crore) + ' करोड ';
  }
  if (lakh > 0) {
    result += numberToNepaliWords(lakh) + ' लाख ';
  }
  if (thousand > 0) {
    result += numberToNepaliWords(thousand) + ' हजार ';
  }
  if (hundred > 0) {
    result += hundreds[hundred] + ' ';
  }
  if (ten > 0) {
    result += tens[ten] + ' ';
  }
  if (one > 0) {
    result += ones[one];
  }
  
  return result.trim();
}

/**
 * Format date in Nepali style
 * 
 * @param {Date|string} date - Date to format
 * @param {boolean} useNepaliNumerals - Use Nepali numerals
 * @returns {string} Formatted date
 */
export function formatNepaliDate(date, useNepaliNumerals = true) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  const formatted = `${year}-${month}-${day}`;
  
  return useNepaliNumerals ? toNepaliNumerals(formatted) : formatted;
}

/**
 * Get relative time in Nepali
 * 
 * @param {Date|string} date - Date to compare
 * @returns {string} Relative time string
 */
export function getRelativeTimeNepali(date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'अहिले';
  if (diffMins < 60) return `${toNepaliNumerals(diffMins)} मिनेट अघि`;
  if (diffHours < 24) return `${toNepaliNumerals(diffHours)} घण्टा अघि`;
  if (diffDays === 1) return 'हिजो';
  if (diffDays < 7) return `${toNepaliNumerals(diffDays)} दिन अघि`;
  if (diffDays < 30) return `${toNepaliNumerals(Math.floor(diffDays / 7))} हप्ता अघि`;
  
  return formatNepaliDate(date);
}
