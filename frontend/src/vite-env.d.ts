/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the FastAPI service. Defaults to the relative "/api" path. */
  readonly VITE_API_BASE_URL?: string;
  /** ISO 4217 currency code used for every monetary value in the UI. */
  readonly VITE_CURRENCY?: string;
  /** BCP-47 locale used for number and date formatting (en-IN gives lakh grouping). */
  readonly VITE_LOCALE?: string;
  /** Display label for the value axis, e.g. "INR" or "$". */
  readonly VITE_CURRENCY_SYMBOL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
