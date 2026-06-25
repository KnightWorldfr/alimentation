// ============================================================
// Module Thème — bascule clair/sombre, avec détection automatique
// de la préférence système au premier lancement et persistance
// du choix de l'utilisateur ensuite.
// ============================================================

const CLE_THEME = "alimentation_theme"; // valeurs possibles : "clair", "sombre"

function getThemeStocke() {
  return localStorage.getItem(CLE_THEME);
}

function detecterPreferenceSysteme() {
  const preferesombre = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return preferesombre ? "sombre" : "clair";
}

function appliquerThemeVisuel(theme) {
  document.documentElement.setAttribute("data-theme", theme === "sombre" ? "dark" : "light");
  rafraichirBoutonTheme();
}

function choisirTheme(theme) {
  // Choix explicite de l'utilisateur : on le fige, il ne suivra plus la
  // préférence système automatiquement après ça (cohérent avec le
  // comportement attendu d'un bouton de bascule manuel).
  localStorage.setItem(CLE_THEME, theme);
  appliquerThemeVisuel(theme);
}

function basculerTheme() {
  const actuel = getThemeStocke() || detecterPreferenceSysteme();
  choisirTheme(actuel === "sombre" ? "clair" : "sombre");
}

function rafraichirBoutonTheme() {
  const bouton = document.getElementById("btn-bascule-theme");
  if (!bouton) return;
  const theme = getThemeStocke() || detecterPreferenceSysteme();
  bouton.textContent = theme === "sombre" ? "☀️ Passer en thème clair" : "🌙 Passer en thème sombre";
}

function initTheme() {
  // Le thème initial est déjà appliqué par le script inline dans <head>
  // (évite le flash visuel). Ici on configure juste le bouton et l'écoute
  // des changements de préférence système.
  rafraichirBoutonTheme();

  const bouton = document.getElementById("btn-bascule-theme");
  if (bouton) bouton.addEventListener("click", basculerTheme);

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!getThemeStocke()) {
        appliquerThemeVisuel(e.matches ? "sombre" : "clair");
      }
    });
  }
}
