/* =========================================================
   MY CAISSE PRESTAPAY — Configuration File
   Version: 2.4.0
   ========================================================= */

const CONFIG = {
    LOCAL_MODE: false,

    API_URL: "https://script.google.com/macros/s/AKfycbyQD-vilJjsz6fy8gM_X87tP6wITGWHbB34QDLm5g-QicaqfRHpcfdFN2TgfD84KmuW/exec",

    LOCAL_USERS: {
        "YAHYA": { password: "xx1234567", role: "admin", permissions: ["all"] },
        "MMS":   { password: "xx1234567", role: "user",  permissions: ["view", "add", "export"] }
    },

    DEFAULT_CATEGORIES: [
        { name: "SALAIRES",               kind: "Dépenses" },
        { name: "TÉLÉPHONE",              kind: "Dépenses" },
        { name: "SERVICES PUBLICS",       kind: "Dépenses" },
        { name: "AVANCES SUR SALAIRE",    kind: "Dépenses" },
        { name: "PROSPECTEURS LOCAUX",    kind: "Dépenses" },
        { name: "PRIMES AIDE",            kind: "Dépenses" },
        { name: "DONATIONS & MOTIVATION", kind: "Dépenses" },
        { name: "AUTRES DÉPENSES",        kind: "Dépenses" },
        { name: "RECETTES DIVERSES",      kind: "Recettes" },
        { name: "VENTES",                 kind: "Recettes" }
    ],

    APP_NAME:    "My Caisse Prestapay",
    APP_VERSION: "2.4.0",
    APP_AUTHOR:  "YAHYA TALEB ABDELLAHI",
    CURRENCY:    "MRU",
    SESSION_KEY: "mycaisse_session_v2"
};
