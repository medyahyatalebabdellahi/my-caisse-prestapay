/* =========================================================
   MY CAISSE PRESTAPAY — Configuration File
   Version: 2.4.0
   Author: YAHYA TALEB ABDELLAHI
   ========================================================= */

const CONFIG = {

    /* -------------------------------------------------
       MODE D'EXÉCUTION
       false = utilise Google Sheets (API_URL)
       true  = stockage local navigateur uniquement
       ------------------------------------------------- */
    LOCAL_MODE: false,

    /* -------------------------------------------------
       API GOOGLE APPS SCRIPT
       ------------------------------------------------- */
    API_URL: "https://script.google.com/macros/s/AKfycbwOPdEUPjqaCGmO6wCy2rSC_JwqKd2qrN6pG41hpPtjwM0j6Eb3g0NBpAxhOx84iP9A/exec",

    /* -------------------------------------------------
       UTILISATEURS (mode LOCAL_MODE uniquement)
       ------------------------------------------------- */
    LOCAL_USERS: {
        "YAHYA": { password: "452760", role: "admin", permissions: ["all"] },
        "MMS":   { password: "452760", role: "user",  permissions: ["view", "add", "export"] }
    },

    /* -------------------------------------------------
       CATÉGORIES PAR DÉFAUT
       ------------------------------------------------- */
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

    /* -------------------------------------------------
       MÉTADONNÉES DE L'APPLICATION
       ------------------------------------------------- */
    APP_NAME:    "My Caisse Prestapay",
    APP_VERSION: "2.4.0",
    APP_AUTHOR:  "YAHYA TALEB ABDELLAHI",
    CURRENCY:    "MRU",
    SESSION_KEY: "mycaisse_session_v2"
};
