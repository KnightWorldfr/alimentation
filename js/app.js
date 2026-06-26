// ============================================================
// Module App — orchestrateur : navigation entre vues, init au
// chargement, câblage des boutons globaux non spécifiques à un module.
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  initTheme();

  // Enregistrement du service worker (PWA installable + mises à jour auto).
  // Dès qu'une nouvelle version est détectée et activée, on recharge la
  // page automatiquement — sinon le navigateur continuerait d'exécuter
  // l'ancien JS déjà chargé en mémoire, même avec le nouveau cache prêt.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});

    let rechargementDejaDeclenche = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (rechargementDejaDeclenche) return; // évite une boucle de rechargement
      rechargementDejaDeclenche = true;
      window.location.reload();
    });
  }

  // Vérifie que l'adresse de l'API est configurée avant toute chose
  if (!getApiUrl()) {
    afficherVueReglagesAvecMessage("Configure d'abord l'adresse de ton serveur pour commencer.");
    document.getElementById("input-api-url").value = "";
  } else {
    document.getElementById("input-api-url").value = getApiUrl();
  }

  await chargerProfils();
  rafraichirSelecteurProfilActif();

  initNavigation();
  initReglages();
  initBarreOutilsStock();
  initBoutonsConsommation();
  initBoutonsCourses();
}

// ---------- Navigation entre vues ----------

function initNavigation() {
  document.querySelectorAll("nav button[data-vue]").forEach(btn => {
    btn.addEventListener("click", () => activerVue(btn.dataset.vue));
  });
}

async function activerVue(nomVue) {
  if (nomVue !== "reglages" && !getApiUrl()) {
    activerVue("reglages");
    return;
  }

  document.querySelectorAll("nav button[data-vue]").forEach(b => b.classList.toggle("actif", b.dataset.vue === nomVue));
  document.querySelectorAll(".vue").forEach(v => v.classList.toggle("actif", v.id === `vue-${nomVue}`));

  switch (nomVue) {
    case "stock": await chargerStock(); break;
    case "consommation": await initVueConsommation(); break;
    case "historique": await initVueHistorique(); break;
    case "courses": await initVueCourses(); break;
    case "reglages": await chargerVueProfilsReglages(); break;
  }
}

function afficherVueReglagesAvecMessage(message) {
  activerVue("reglages");
  const zone = document.getElementById("zone-resultat-reglages");
  if (zone) zone.innerHTML = `<div class="resultat erreur">${message}</div>`;
}

// ---------- Réglages : adresse API + profils ----------

function initReglages() {
  const btnSauver = document.getElementById("btn-sauver-api");
  if (btnSauver) {
    btnSauver.addEventListener("click", () => {
      const valeur = document.getElementById("input-api-url").value.trim();
      const zone = document.getElementById("zone-resultat-reglages");
      if (!valeur) {
        zone.innerHTML = `<div class="resultat erreur">Merci de renseigner une adresse.</div>`;
        return;
      }
      setApiUrl(valeur);
      zone.innerHTML = `<div class="resultat">✓ Adresse enregistrée : ${getApiUrl()}</div>`;
    });
  }

  const btnNouveauProfil = document.getElementById("btn-nouveau-profil");
  if (btnNouveauProfil) {
    btnNouveauProfil.addEventListener("click", ouvrirFormulaireNouveauProfil);
  }

  const btnPurger = document.getElementById("btn-purger-historique");
  if (btnPurger) {
    btnPurger.addEventListener("click", async () => {
      const zone = document.getElementById("zone-resultat-purge");
      if (!confirm("Vider tout le journal des consommations ? Cette action est irréversible. Tes produits enregistrés et ton stock actuel ne seront pas touchés.")) {
        return;
      }
      try {
        const resultat = await API.purgerHistorique();
        zone.innerHTML = `<div class="resultat">✓ ${resultat.message}</div>`;
      } catch (e) {
        zone.innerHTML = `<div class="resultat erreur">${e.message}</div>`;
      }
    });
  }
}

// ---------- Consommation : boutons globaux ----------

function initBoutonsConsommation() {
  document.querySelectorAll(".bascule-mode button[data-mode]").forEach(btn => {
    btn.addEventListener("click", () => basculerModeConsommation(btn.dataset.mode));
  });

  const btnAjoutIngredient = document.getElementById("btn-ajouter-ligne-ingredient");
  if (btnAjoutIngredient) btnAjoutIngredient.addEventListener("click", ajouterLigneIngredient);

  const btnCreerRecette = document.getElementById("btn-creer-recette");
  if (btnCreerRecette) btnCreerRecette.addEventListener("click", validerCreationRecette);

  const btnValiderLibre = document.getElementById("btn-valider-libre");
  if (btnValiderLibre) btnValiderLibre.addEventListener("click", validerConsommationLibre);
}

// ---------- Courses : boutons globaux ----------

function initBoutonsCourses() {
  const btnAjouter = document.getElementById("btn-ajouter-article-course");
  if (btnAjouter) btnAjouter.addEventListener("click", ajouterArticleCoursesManuel);

  const inputNouvelArticle = document.getElementById("input-nouvel-article-course");
  if (inputNouvelArticle) {
    inputNouvelArticle.addEventListener("keydown", (e) => {
      if (e.key === "Enter") ajouterArticleCoursesManuel();
    });
  }

  const btnSuggerer = document.getElementById("btn-suggerer-courses");
  if (btnSuggerer) btnSuggerer.addEventListener("click", suggererArticlesEpuises);

  const btnValider = document.getElementById("btn-valider-achats");
  if (btnValider) btnValider.addEventListener("click", validerAchatsCourses);
}
