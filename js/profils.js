// ============================================================
// Module Profils — gestion du profil actif (sélecteur en header)
// et CRUD complet des profils (onglet Réglages).
// ============================================================

let profilsCache = [];
const COULEURS_DISPONIBLES = ["#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444"];

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

function getProfilActifId() {
  const v = localStorage.getItem("alimentation_profil_actif");
  return v ? parseInt(v, 10) : null;
}
function setProfilActifId(id) {
  if (id === null) localStorage.removeItem("alimentation_profil_actif");
  else localStorage.setItem("alimentation_profil_actif", id);
  rafraichirSelecteurProfilActif();

  // Si le dashboard est actuellement affiché, on le recharge avec le
  // nouveau profil sélectionné (sinon il resterait figé sur l'ancien).
  const vueHistoActive = document.getElementById("vue-historique")?.classList.contains("actif");
  const sousVueDashboard = document.getElementById("panneau-dashboard")?.style.display !== "none";
  if (vueHistoActive && sousVueDashboard && typeof initVueDashboard === "function") {
    initVueDashboard();
  }
}

async function chargerProfils() {
  try {
    profilsCache = await API.profils();
  } catch (e) {
    profilsCache = [];
  }
  return profilsCache;
}

function trouverProfil(id) {
  return profilsCache.find(p => p.id === id) || null;
}

// ---------- Sélecteur de profil actif (dans le header, partout) ----------

function rafraichirSelecteurProfilActif() {
  const zone = document.getElementById("selecteur-profil-actif");
  if (!zone) return;

  const actifId = getProfilActifId();
  const actif = trouverProfil(actifId);

  if (profilsCache.length === 0) {
    zone.innerHTML = "";
    return;
  }

  zone.innerHTML = `
    <select id="select-profil-actif">
      <option value="">Sans profil</option>
      ${profilsCache.map(p => `<option value="${p.id}" ${p.id === actifId ? "selected" : ""}>${echapperHtml(p.nom)}</option>`).join("")}
    </select>
  `;
  document.getElementById("select-profil-actif").addEventListener("change", (e) => {
    const val = e.target.value;
    setProfilActifId(val ? parseInt(val, 10) : null);
  });
}

// ---------- Vue Réglages : liste + création + édition ----------

async function chargerVueProfilsReglages() {
  const conteneur = document.getElementById("liste-profils-reglages");
  if (!conteneur) return;
  conteneur.innerHTML = `<div class="vide">Chargement…</div>`;
  await chargerProfils();

  if (profilsCache.length === 0) {
    conteneur.innerHTML = `<div class="vide">Aucun profil créé.<br>Crée un profil pour suivre les calories de chacun.</div>`;
    return;
  }

  conteneur.innerHTML = `<div class="grille-profils">${profilsCache.map(profilCarteHtml).join("")}</div>`;

  profilsCache.forEach(p => {
    const btnSuppr = document.getElementById(`btn-suppr-profil-${p.id}`);
    if (btnSuppr) btnSuppr.addEventListener("click", () => supprimerProfilAvecConfirmation(p));
    const carte = document.getElementById(`carte-profil-${p.id}`);
    if (carte) carte.addEventListener("click", (e) => {
      if (e.target.closest(".btn-suppr-profil-reglages")) return;
      ouvrirEditionProfil(p);
    });
  });
}

function profilCarteHtml(p) {
  return `
    <div class="carte-profil" id="carte-profil-${p.id}" style="cursor:pointer;">
      <div class="pastille-profil" style="background:${p.couleur}">${initiale(p.nom)}</div>
      <div class="infos-profil">
        <div class="nom-profil">${echapperHtml(p.nom)}</div>
        <div class="meta-profil">
          ${p.poids_kg ? `${p.poids_kg} kg` : "Poids non renseigné"}
          ${p.objectif_kcal_jour ? ` · objectif ${p.objectif_kcal_jour} kcal/j` : ""}
        </div>
      </div>
              <button class="btn-suppr-profil-reglages" id="btn-suppr-profil-${p.id}">✕</button>
    </div>
  `;
}

function ouvrirFormulaireNouveauProfil() {
  ouvrirModale("Nouveau profil", `
    <label for="nv-profil-nom">Nom</label>
    <input type="text" id="nv-profil-nom" placeholder="ex: Thomas">

    <label>Couleur</label>
    <div class="swatches-couleur">
      ${COULEURS_DISPONIBLES.map((c, i) => `<div class="swatch-couleur ${i === 0 ? 'selectionne' : ''}" data-couleur="${c}" style="background:${c}"></div>`).join("")}
    </div>

    <label for="nv-profil-poids">Poids (kg, optionnel)</label>
    <input type="number" id="nv-profil-poids" placeholder="ex: 70">

    <label for="nv-profil-objectif">Objectif calories/jour (optionnel)</label>
    <input type="number" id="nv-profil-objectif" placeholder="ex: 2200">

    <button class="action" id="btn-creer-profil">Créer le profil</button>
  `);

  let couleurChoisie = COULEURS_DISPONIBLES[0];
  document.querySelectorAll(".swatch-couleur").forEach(sw => {
    sw.addEventListener("click", () => {
      document.querySelectorAll(".swatch-couleur").forEach(s => s.classList.remove("selectionne"));
      sw.classList.add("selectionne");
      couleurChoisie = sw.dataset.couleur;
    });
  });

  document.getElementById("btn-creer-profil").addEventListener("click", async () => {
    const nom = document.getElementById("nv-profil-nom").value.trim();
    if (!nom) { afficherToastModale("Le nom est obligatoire.", true); return; }
    const poids = parseFloat(document.getElementById("nv-profil-poids").value) || null;
    const objectif = parseFloat(document.getElementById("nv-profil-objectif").value) || null;
    try {
      await API.creerProfil({ nom, couleur: couleurChoisie, poids_kg: poids, objectif_kcal_jour: objectif });
      fermerModale();
      await chargerVueProfilsReglages();
      rafraichirSelecteurProfilActif();
    } catch (e) {
      afficherToastModale(e.message, true);
    }
  });
}

function ouvrirEditionProfil(p) {
  ouvrirModale(`Modifier ${p.nom}`, `
    <label for="ed-profil-nom">Nom</label>
    <input type="text" id="ed-profil-nom" value="${echapperHtml(p.nom)}">

    <label>Couleur</label>
    <div class="swatches-couleur">
      ${COULEURS_DISPONIBLES.map(c => `<div class="swatch-couleur ${c === p.couleur ? 'selectionne' : ''}" data-couleur="${c}" style="background:${c}"></div>`).join("")}
    </div>

    <label for="ed-profil-poids">Poids (kg)</label>
    <input type="number" id="ed-profil-poids" value="${p.poids_kg ?? ''}">

    <label for="ed-profil-objectif">Objectif calories/jour</label>
    <input type="number" id="ed-profil-objectif" value="${p.objectif_kcal_jour ?? ''}">

    <button class="action" id="btn-sauver-profil">Enregistrer</button>
  `);

  let couleurChoisie = p.couleur;
  document.querySelectorAll(".swatch-couleur").forEach(sw => {
    sw.addEventListener("click", () => {
      document.querySelectorAll(".swatch-couleur").forEach(s => s.classList.remove("selectionne"));
      sw.classList.add("selectionne");
      couleurChoisie = sw.dataset.couleur;
    });
  });

  document.getElementById("btn-sauver-profil").addEventListener("click", async () => {
    const nom = document.getElementById("ed-profil-nom").value.trim();
    if (!nom) { afficherToastModale("Le nom est obligatoire.", true); return; }
    const poids = parseFloat(document.getElementById("ed-profil-poids").value) || null;
    const objectif = parseFloat(document.getElementById("ed-profil-objectif").value) || null;
    try {
      await API.modifierProfil(p.id, { nom, couleur: couleurChoisie, poids_kg: poids, objectif_kcal_jour: objectif });
      fermerModale();
      await chargerVueProfilsReglages();
      rafraichirSelecteurProfilActif();
    } catch (e) {
      afficherToastModale(e.message, true);
    }
  });
}

async function supprimerProfilAvecConfirmation(p) {
  if (!confirm(`Supprimer le profil "${p.nom}" ? L'historique lié sera conservé mais ne sera plus attribué à personne.`)) return;
  try {
    await API.supprimerProfil(p.id);
    if (getProfilActifId() === p.id) setProfilActifId(null);
    await chargerVueProfilsReglages();
    rafraichirSelecteurProfilActif();
  } catch (e) {
    alert(e.message);
  }
}

function echapperHtml(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}
