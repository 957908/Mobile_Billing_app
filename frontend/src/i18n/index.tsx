import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'en' | 'hi';
const KEY = 'lotus_lang';

const dict: Record<Lang, Record<string, string>> = {
  en: {
    'hello': 'Hello',
    'welcome_back': 'Welcome back',
    'sign_in': 'Sign In',
    'sign_in_subtitle': 'Sign in to manage your business',
    'email': 'Email',
    'password': 'Password',
    'create_account': 'Create account',
    'new_here': 'New here?',
    'today_sales': "Today's Sales",
    'profit': 'Profit',
    'expenses': 'Expenses',
    'health': 'Health',
    'monthly_sales': 'Monthly Sales',
    'monthly_profit': 'Monthly Profit',
    'inventory_value': 'Inventory Value',
    'pending_receivable': 'Pending Recv.',
    'low_stock': 'Low Stock',
    'products': 'Products',
    'quick_actions': 'Quick Actions',
    'new_bill': 'New Bill',
    'add_product': 'Add Product',
    'add_party': 'Add Party',
    'add_expense': 'Add Expense',
    'reports': 'Reports',
    'custom_orders': 'Custom Orders',
    'manufacturing': 'Manufacturing',
    'rolls': 'Fabric Rolls',
    'delivery': 'Delivery',
    'settings': 'Settings',
    'sales_trend': '7-Day Sales Trend',
    'top_products': 'Top Products (Month)',
    'recent_invoices': 'Recent Invoices',
    'dashboard': 'Dashboard',
    'inventory': 'Inventory',
    'parties': 'Parties',
    'billing': 'Billing',
    'customers': 'Customers',
    'suppliers': 'Suppliers',
    'save': 'Save',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'search': 'Search',
    'scan_barcode': 'Scan Barcode',
    'total': 'Total',
    'subtotal': 'Subtotal',
    'gst': 'GST',
    'generate_invoice': 'Generate Invoice',
    'add_item': 'Add Item',
    'select_customer': 'Select Customer',
    'payment_method': 'Payment Method',
    'share_pdf': 'Share PDF',
    'whatsapp': 'WhatsApp',
    'language': 'Language',
    'english': 'English',
    'hindi': 'हिन्दी (Hindi)',
    'logout': 'Log out',
    'pending_sync': 'Pending Sync',
    'sync_now': 'Sync Now',
    'offline': 'Offline',
    'online': 'Online',
  },
  hi: {
    'hello': 'नमस्ते',
    'welcome_back': 'वापसी पर स्वागत है',
    'sign_in': 'साइन इन',
    'sign_in_subtitle': 'अपना व्यवसाय प्रबंधित करें',
    'email': 'ईमेल',
    'password': 'पासवर्ड',
    'create_account': 'खाता बनाएं',
    'new_here': 'नए यहां?',
    'today_sales': 'आज की बिक्री',
    'profit': 'लाभ',
    'expenses': 'खर्च',
    'health': 'स्वास्थ्य',
    'monthly_sales': 'मासिक बिक्री',
    'monthly_profit': 'मासिक लाभ',
    'inventory_value': 'स्टॉक मूल्य',
    'pending_receivable': 'बकाया',
    'low_stock': 'कम स्टॉक',
    'products': 'उत्पाद',
    'quick_actions': 'त्वरित क्रियाएं',
    'new_bill': 'नया बिल',
    'add_product': 'उत्पाद जोड़ें',
    'add_party': 'पार्टी जोड़ें',
    'add_expense': 'खर्च जोड़ें',
    'reports': 'रिपोर्ट',
    'custom_orders': 'कस्टम ऑर्डर',
    'manufacturing': 'निर्माण',
    'rolls': 'कपड़ा रोल',
    'delivery': 'डिलीवरी',
    'settings': 'सेटिंग्स',
    'sales_trend': '7 दिन की बिक्री',
    'top_products': 'शीर्ष उत्पाद',
    'recent_invoices': 'हाल के बिल',
    'dashboard': 'डैशबोर्ड',
    'inventory': 'स्टॉक',
    'parties': 'पार्टियां',
    'billing': 'बिलिंग',
    'customers': 'ग्राहक',
    'suppliers': 'आपूर्तिकर्ता',
    'save': 'सहेजें',
    'cancel': 'रद्द करें',
    'delete': 'हटाएं',
    'search': 'खोजें',
    'scan_barcode': 'बारकोड स्कैन करें',
    'total': 'कुल',
    'subtotal': 'उप-योग',
    'gst': 'जीएसटी',
    'generate_invoice': 'बिल बनाएं',
    'add_item': 'आइटम जोड़ें',
    'select_customer': 'ग्राहक चुनें',
    'payment_method': 'भुगतान का तरीका',
    'share_pdf': 'PDF साझा करें',
    'whatsapp': 'व्हाट्सएप',
    'language': 'भाषा',
    'english': 'English',
    'hindi': 'हिन्दी',
    'logout': 'लॉग आउट',
    'pending_sync': 'लंबित सिंक',
    'sync_now': 'अभी सिंक करें',
    'offline': 'ऑफ़लाइन',
    'online': 'ऑनलाइन',
  },
};

type Ctx = { lang: Lang; t: (key: string) => string; setLang: (l: Lang) => Promise<void> };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === 'en' || v === 'hi') setLangState(v); });
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem(KEY, l);
  }, []);

  const t = useCallback((key: string) => dict[lang]?.[key] || dict.en[key] || key, [lang]);

  return <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('I18nProvider missing');
  return ctx;
}
