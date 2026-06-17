import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Normalizes a phone number for use in WhatsApp APIs (wa.me)
 * @param phone Raw phone number string from input
 * @param defaultPrefix Optional fallback country prefix (e.g. '52' for Mexico)
 */
export const cleanWhatsAppNumber = (phone: string, defaultPrefix = '52'): string => {
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // Standard Mexico/Latin American mobile phone number has 10 digits
  if (digits.length === 10) {
    return defaultPrefix + digits;
  }
  
  // Spain/Peru etc. might have 9 digits
  if (digits.length === 9) {
    return defaultPrefix + digits;
  }

  // Otherwise return the digits as is (if it already has a country prefix e.g. starts with 52 and is 12 digits)
  return digits;
};

/**
 * Generates a ready-to-use WhatsApp link with a custom message
 */
export const getWhatsAppLink = (phone: string, message: string, defaultPrefix = '52'): string => {
  const cleanNumber = cleanWhatsAppNumber(phone, defaultPrefix);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
};
