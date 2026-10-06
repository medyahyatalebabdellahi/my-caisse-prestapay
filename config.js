/* =========================================================
   MY CAISSE PRESTAPAY — Configuration File
   Version: 2.1.0
   Author : YAHYA TALEB ABDELLAHI
   ========================================================= */

const CONFIG = {

    /* ---------------------------------------------------------
       MODE SELECTION
       LOCAL_MODE: true  → Offline (browser storage)
       LOCAL_MODE: false → Google Apps Script + Google Sheets
       --------------------------------------------------------- */
    LOCAL_MODE: true,

    /* ---------------------------------------------------------
       SERVER API URL
       Your Google Apps Script Web App URL
       --------------------------------------------------------- */
    API_URL: "https://script.google.com/macros/s/AKfycbw-XRkHItMiD_IU_v2345sbCjDmTGhmiZPJNsGfyN_0AkJZiLRk8y23ctuJCjBQ96OE/exec",

    /* ---------------------------------------------------------
       LOCAL USERS (fallback if API is offline)
       --------------------------------------------------------- */
    LOCAL_USERS: {
        "YAHYA": {
            password:    "xx1234567",
            role:        "admin",
            permissions: ["all"]
        },
        "MMS": {
            password:    "xx1234567",
            role:        "user",
            permissions: ["view", "add", "export"]
        }
    },

    /* ---------------------------------------------------------
       DEFAULT CATEGORIES (only used in LOCAL mode)
       --------------------------------------------------------- */
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

    /* ---------------------------------------------------------
       APPLICATION METADATA
       --------------------------------------------------------- */
    APP_NAME:    "My Caisse Prestapay",
    APP_VERSION: "2.1.0",
    APP_AUTHOR:  "YAHYA TALEB ABDELLAHI",
    CURRENCY:    "MRU",
    SESSION_KEY: "mycaisse_session_v2"
};
