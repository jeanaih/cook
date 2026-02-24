/**
 * 🛠️ GAME CONFIGURATION & SERVER SWITCHER
 */

// I-load ang preference mula sa localStorage para hindi bumabalik sa default
const savedEnv = localStorage.getItem("GAME_ENV") || "render";

window.GAME_CONFIG = {
    ENV: savedEnv,
    BACKEND_URL: savedEnv === "production"
        ? "https://cook-server-production-db71.up.railway.app"
        : savedEnv === "render"
            ? "https://cook-server-uiqt.onrender.com"
            : "http://localhost:3000",

    // Helper function para mag-switch ng server
    switchServer: function (newEnv) {
        localStorage.setItem("GAME_ENV", newEnv);
        window.location.reload(); // I-reload ang page para mag-apply ang bagong connection
    }
};

console.log(`🚀 Environment: ${window.GAME_CONFIG.ENV} | Server: ${window.GAME_CONFIG.BACKEND_URL}`);

// Set the correct selected option in dropdown when page loads
document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('server-select-floating');
    if (serverSelect) {
        serverSelect.value = savedEnv;
    }
});
