/**
 * TixNaija Business & Contact Details
 * Single source of truth for public-facing contact information across web pages and communications.
 *
 * NOTE ON LEGAL / REGISTRATION FIELDS:
 * Optional legal entity fields (e.g. Registered Legal Entity Name, CAC/RC Number,
 * Registered Office Address, DPO Email) are intentionally omitted for now as
 * the business is not yet registered. When registration is completed,
 * add those fields here and export them.
 */

export const BUSINESS_DETAILS = {
  platformName: "TixNaija",
  supportEmail: "tixnaijaapp@gmail.com",
  supportPhone: "+234 901 127 5275",
  whatsappPhone: "+234 901 127 5275",
  // Optional legal fields to be added post-registration:
  // legalName: undefined,
  // rcNumber: undefined,
  // registeredAddress: undefined,
  // dpoEmail: undefined,
} as const;

export default BUSINESS_DETAILS;
