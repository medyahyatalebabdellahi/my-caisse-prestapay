/* =========================================================
   MY CAISSE PRESTAPAY — Configuration File
   Version: 2.4.0
   Author: YAHYA TALEB ABDELLAHI
   ========================================================= */

const CONFIG = {

    LOCAL_MODE: true,

    API_URL: "https://script.google.com/macros/s/AKfycbwOPdEUPjqaCGmO6wCy2rSC_JwqKd2qrN6pG41hpPtjwM0j6Eb3g0NBpAxhOx84iP9A/exec",

    LOCAL_USERS: {
        "YAHYA": { password: "452760",     role: "admin", permissions: ["all"] },
        "MMS":   { password: "Xx12345678", role: "user",  permissions: ["view", "add", "edit", "export"] },
        "USER":  { password: "presta1234", role: "user",  permissions: ["view", "add"] }
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
