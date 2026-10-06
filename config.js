/* =========================================================
   MY CAISSE PRESTAPAY — Configuration File
   Version: 2.0.0
   Author : YAHYA TALEB ABDELLAHI
   ========================================================= */

const CONFIG = {

    /* ---------------------------------------------------------
       MODE SELECTION
       ---------------------------------------------------------
       LOCAL_MODE: true  → Offline (browser storage)
       LOCAL_MODE: false → Uses Google Apps Script + Sheets
       --------------------------------------------------------- */
    LOCAL_MODE: false,

    /* ---------------------------------------------------------
       SERVER API URL
       ---------------------------------------------------------
       Your Google Apps Script Web App URL
       --------------------------------------------------------- */
    API_URL: "https://script.google.com/macros/s/AKfycbyQD-vilJjsz6fy8gM_X87tP6wITGWHbB34QDLm5g-QicaqfRHpcfdFN2TgfD84KmuW/exec",

    /* ---------------------------------------------------------
       LOCAL USERS (fallback when offline)
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
       APPLICATION METADATA
       --------------------------------------------------------- */
    APP_NAME:    "My Caisse Prestapay",
    APP_VERSION: "2.0.0",
    APP_AUTHOR:  "YAHYA TALEB ABDELLAHI",
    CURRENCY:    "MRU",

    /* ---------------------------------------------------------
       SESSION STORAGE KEY
       --------------------------------------------------------- */
    SESSION_KEY: "mycaisse_session_v2"
};
