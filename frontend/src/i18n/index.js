import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * i18n Configuration for Samjhana Ventures OS
 * 
 * Supports:
 * - English (en) - for Son in USA
 * - Nepali (ne) - default for Dad in Nepal
 * 
 * Number formatting:
 * - Lakhs/Crores system (1,00,000 instead of 100,000)
 * - Nepali numerals (१,२,३) option
 */

const resources = {
  en: {
    translation: {
      // Common
      common: {
        save: 'Save Entry',
        saving: 'Saving...',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        view: 'View',
        back: 'Back',
        next: 'Next',
        submit: 'Submit',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        takePhoto: 'Tap to take photo',
        today: 'Today',
        yesterday: 'Yesterday',
        thisWeek: 'This Week',
        thisMonth: 'This Month',
      },

      // Navigation
      nav: {
        home: 'Home',
        dashboard: 'Dashboard',
        records: 'Records',
        reports: 'Reports',
        settings: 'Settings',
        logout: 'Logout',
      },

      // Business Names
      business: {
        petrol: 'Petrol Pump',
        ev: 'EV Charging',
        furniture: 'Furniture',
        rental: 'House Rental',
        loan: 'Bank Loan',
      },

      // Petrol Pump
      petrol: {
        liters: 'Liters',
        density: 'Density',
        fuelType: 'Fuel Type',
        petrol: 'Petrol',
        diesel: 'Diesel',
        ratePerLiter: 'Rate per Liter',
        purchaseRate: 'Purchase Rate',
        openingStock: 'Opening Stock',
        closingStock: 'Closing Stock',
        sale: 'Fuel Sale',
        purchase: 'Fuel Purchase',
      },

      // EV Charging
      ev: {
        openingMeter: 'Opening Meter',
        closingMeter: 'Closing Meter',
        unitRate: 'Rate per Unit (kWh)',
        unitsCharged: 'Units Charged',
        neaBillRef: 'NEA Bill Reference',
        chargerType: 'Charger Type',
        dcFast: 'DC Fast',
        acSlow: 'AC Slow',
      },

      // Rental
      rental: {
        roomNo: 'Room Number',
        tenantName: 'Tenant Name',
        monthlyRent: 'Monthly Rent',
        lastPaidDate: 'Last Paid Date',
        paidUntil: 'Paid Until',
        advanceDeposit: 'Advance Deposit',
        dueAmount: 'Due Amount',
      },

      // Loan
      loan: {
        borrowerName: 'Borrower Name',
        principal: 'Principal Amount',
        interestRate: 'Interest Rate (%)',
        startDate: 'Start Date',
        termDays: 'Term (Days)',
        accruedInterest: 'Accrued Interest',
        remainingBalance: 'Remaining Balance',
        payment: 'Payment Received',
      },

      // Furniture
      furniture: {
        itemName: 'Item Name',
        category: 'Category',
        quantity: 'Quantity',
        qtyIn: 'Quantity In',
        qtyOut: 'Quantity Out',
        purchasePrice: 'Purchase Price',
        sellingPrice: 'Selling Price',
        currentStock: 'Current Stock',
      },

      // Transaction Types
      transactionType: {
        sale: 'Sale',
        purchase: 'Purchase',
        expense: 'Expense',
        income: 'Income',
        payment: 'Payment',
        disbursement: 'Disbursement',
        adjustment: 'Adjustment',
      },

      // Status
      status: {
        pendingReview: 'Pending Review',
        approved: 'Approved',
        rejected: 'Rejected',
      },

      // Dashboard
      dashboard: {
        totalCash: 'Total Cash Position',
        pendingReviews: 'Pending Reviews',
        todayTransactions: "Today's Transactions",
        monthlyRevenue: 'Monthly Revenue',
        businessBreakdown: 'Business Breakdown',
      },

      // Messages
      messages: {
        saveSuccess: 'Entry saved successfully!',
        saveError: 'Failed to save entry. Please try again.',
        approveSuccess: 'Transaction approved!',
        rejectSuccess: 'Transaction rejected.',
        syncComplete: 'Data synchronized.',
      },
    },
  },

  ne: {
    translation: {
      // Common
      common: {
        save: 'सेभ गर्नुहोस्',
        saving: 'सेभ हुँदैछ...',
        cancel: 'रद्द गर्नुहोस्',
        delete: 'मेट्नुहोस्',
        edit: 'सम्पादन',
        view: 'हेर्नुहोस्',
        back: 'पछाडि',
        next: 'अर्को',
        submit: 'पठाउनुहोस्',
        loading: 'लोड हुँदैछ...',
        error: 'त्रुटि',
        success: 'सफल',
        takePhoto: 'फोटो खिच्न ट्याप गर्नुहोस्',
        today: 'आज',
        yesterday: 'हिजो',
        thisWeek: 'यो हप्ता',
        thisMonth: 'यो महिना',
      },

      // Navigation
      nav: {
        home: 'गृह पृष्ठ',
        dashboard: 'ड्यासबोर्ड',
        records: 'रेकर्डहरू',
        reports: 'रिपोर्टहरू',
        settings: 'सेटिंग्स',
        logout: 'लग आउट',
      },

      // Business Names
      business: {
        petrol: 'पेट्रोल पम्प',
        ev: 'EV चार्जिंग',
        furniture: 'फर्निचर पसल',
        rental: 'घर भाडा',
        loan: 'बैंक ऋण',
      },

      // Petrol Pump
      petrol: {
        liters: 'लिटर',
        density: 'घनत्व',
        fuelType: 'इन्धन प्रकार',
        petrol: 'पेट्रोल',
        diesel: 'डिजेल',
        ratePerLiter: 'प्रति लिटर दर',
        purchaseRate: 'खरिद दर',
        openingStock: 'सुरुको स्टक',
        closingStock: 'अन्तिम स्टक',
        sale: 'इन्धन बिक्री',
        purchase: 'इन्धन खरिद',
      },

      // EV Charging
      ev: {
        openingMeter: 'सुरुको मिटर',
        closingMeter: 'अन्तिम मिटर',
        unitRate: 'प्रति युनिट दर (kWh)',
        unitsCharged: 'चार्ज युनिट',
        neaBillRef: 'NEA बिल सन्दर्भ',
        chargerType: 'चार्जर प्रकार',
        dcFast: 'DC फास्ट',
        acSlow: 'AC स्लो',
      },

      // Rental
      rental: {
        roomNo: 'कोठा नम्बर',
        tenantName: 'भाडावालको नाम',
        monthlyRent: 'मासिक भाडा',
        lastPaidDate: 'अन्तिम भुक्तानी मिति',
        paidUntil: 'भुक्तानी मिति सम्म',
        advanceDeposit: 'अग्रिम धरौटी',
        dueAmount: 'बाँकी रकम',
      },

      // Loan
      loan: {
        borrowerName: 'ऋणीको नाम',
        principal: 'सावाँ रकम',
        interestRate: 'ब्याज दर (%)',
        startDate: 'सुरु मिति',
        termDays: 'अवधि (दिन)',
        accruedInterest: 'जम्मा ब्याज',
        remainingBalance: 'बाँकी रकम',
        payment: 'भुक्तानी प्राप्त',
      },

      // Furniture
      furniture: {
        itemName: 'सामानको नाम',
        category: 'वर्ग',
        quantity: 'मात्रा',
        qtyIn: 'भित्रिएको',
        qtyOut: 'बाहिरिएको',
        purchasePrice: 'खरिद मूल्य',
        sellingPrice: 'बिक्री मूल्य',
        currentStock: 'हालको स्टक',
      },

      // Transaction Types
      transactionType: {
        sale: 'बिक्री',
        purchase: 'खरिद',
        expense: 'खर्च',
        income: 'आम्दानी',
        payment: 'भुक्तानी',
        disbursement: 'वितरण',
        adjustment: 'समायोजन',
      },

      // Status
      status: {
        pendingReview: 'समीक्षा पर्खँदै',
        approved: 'स्वीकृत',
        rejected: 'अस्वीकृत',
      },

      // Dashboard
      dashboard: {
        totalCash: 'कुल नगद',
        pendingReviews: 'पेन्डिङ समीक्षा',
        todayTransactions: 'आजका कारोबार',
        monthlyRevenue: 'मासिक आम्दानी',
        businessBreakdown: 'व्यापार विवरण',
      },

      // Messages
      messages: {
        saveSuccess: 'सफलतापूर्वक सेभ भयो!',
        saveError: 'सेभ गर्न असफल। फेरि प्रयास गर्नुहोस्।',
        approveSuccess: 'कारोबार स्वीकृत!',
        rejectSuccess: 'कारोबार अस्वीकृत।',
        syncComplete: 'डाटा सिंक भयो।',
      },
    },
  },
};

// Get saved language preference or default to Nepali
const getSavedLanguage = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('preferredLanguage') || 'ne';
  }
  return 'ne';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getSavedLanguage(), // Use saved preference or default to Nepali for Dad
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
