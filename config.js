/* =========================================================
   MY CAISSE PRESTAPAY — Configuration File
   Version: 2.0.0
   Author : YAHYA TALEB ABDELLAHI
   ========================================================= */

const CONFIG = {

    /* ---------------------------------------------------------
       MODE SELECTION
       ---------------------------------------------------------
       LOCAL_MODE: true  → Works offline (browser storage)
       LOCAL_MODE: false → Uses Google Apps Script + Sheets
       --------------------------------------------------------- */
    LOCAL_MODE: true,

    /* ---------------------------------------------------------
       SERVER API URL
       ---------------------------------------------------------
       Only required when LOCAL_MODE = false
       Paste your Google Apps Script Web App URL here
       Example: "https://script.google.com/macros/s/XXXXX/exec"
       --------------------------------------------------------- */
    API_URL: "",

    /* ---------------------------------------------------------
       LOCAL USERS (used only when LOCAL_MODE = true)
       ---------------------------------------------------------
       Each user has: password, role, permissions
       Roles: "admin" or "user"
       Permissions: view, add, edit, delete, export, manage_users, all
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
