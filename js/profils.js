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

// Formulaire unique pour création ET édition — seul ce qui se passe à la
// soumission change (profilExistant === null -> création, sinon -> édition).
function ouvrirFormulaireProfil(profilExistant) {
  const p = profilExistant || {};
  const titre = profilExistant ? `Modifier ${p.nom}` : "Nouveau profil";

  ouvrirModale(titre, `
    <label for="pf-nom">Nom</label>
    <input type="text" id="pf-nom" value="${profilExistant ? echapperHtml(p.nom) : ''}" placeholder="ex: Thomas">

    <label>Couleur</label>
    <div class="swatches-couleur">
      ${COULEURS_DISPONIBLES.map(c => `<div class="swatch-couleur ${c === (p.couleur || COULEURS_DISPONIBLES[0]) ? 'selectionne' : ''}" data-couleur="${c}" style="background:${c}"></div>`).join("")}
    </div>

    <div style="display:flex; gap:8px;">
      <div style="flex:1;">
        <label for="pf-poids">Poids actuel (kg)</label>
        <input type="number" id="pf-poids" step="0.1" value="${p.poids_kg ?? ''}" placeholder="ex: 93">
      </div>
      <div style="flex:1;">
        <label for="pf-taille">Taille (cm)</label>
        <input type="number" id="pf-taille" value="${p.taille_cm ?? ''}" placeholder="ex: 175">
      </div>
    </div>

    <div style="display:flex; gap:8px;">
      <div style="flex:1;">
        <label for="pf-age">Âge</label>
        <input type="number" id="pf-age" value="${p.age ?? ''}" placeholder="ex: 25">
      </div>
      <div style="flex:1;">
        <label for="pf-sexe">Sexe</label>
        <select id="pf-sexe">
          <option value="homme" ${p.sexe === 'homme' ? 'selected' : ''}>Homme</option>
          <option value="femme" ${p.sexe === 'femme' ? 'selected' : ''}>Femme</option>
        </select>
      </div>
    </div>

    <label for="pf-activite">Niveau d'activité</label>
    <select id="pf-activite">
      <option value="sedentaire" ${(!p.niveau_activite || p.niveau_activite === 'sedentaire') ? 'selected' : ''}>Sédentaire (peu/pas d'exercice)</option>
      <option value="leger" ${p.niveau_activite === 'leger' ? 'selected' : ''}>Légèrement actif (1-3x/semaine)</option>
      <option value="modere" ${p.niveau_activite === 'modere' ? 'selected' : ''}>Modérément actif (3-5x/semaine)</option>
      <option value="actif" ${p.niveau_activite === 'actif' ? 'selected' : ''}>Très actif (6-7x/semaine)</option>
      <option value="tres_actif" ${p.niveau_activite === 'tres_actif' ? 'selected' : ''}>Athlète / travail physique</option>
    </select>

    <div style="display:flex; gap:8px;">
      <div style="flex:1;">
        <label for="pf-poids-cible">Poids visé (kg)</label>
        <input type="number" id="pf-poids-cible" step="0.1" value="${p.poids_cible_kg ?? ''}" placeholder="ex: 83">
      </div>
      <div style="flex:1;">
        <label for="pf-duree">En combien de jours ?</label>
        <input type="number" id="pf-duree" value="${p.duree_objectif_jours ?? ''}" placeholder="ex: 180">
      </div>
    </div>

    <div id="zone-apercu-calcul"></div>

    <label for="pf-objectif">Objectif calories/jour</label>
    <input type="number" id="pf-objectif" value="${p.objectif_kcal_jour ?? ''}" placeholder="calculé automatiquement, ou saisis ta propre valeur">
    <p style="font-size:0.74rem; color:var(--texte-faible); margin-top:-10px;">
      Laisse ce champ tel qu'il est rempli par le calcul automatique, ou modifie-le pour fixer ta propre valeur.
    </p>

    <button class="action" id="btn-valider-profil">${profilExistant ? "Enregistrer" : "Créer le profil"}</button>
  `);

  let couleurChoisie = p.couleur || COULEURS_DISPONIBLES[0];
  document.querySelectorAll(".swatch-couleur").forEach(sw => {
    sw.addEventListener("click", () => {
      document.querySelectorAll(".swatch-couleur").forEach(s => s.classList.remove("selectionne"));
      sw.classList.add("selectionne");
      couleurChoisie = sw.dataset.couleur;
    });
  });

  // Préremplit le poids visé automatiquement via l'IMC dès que la taille
  // est connue, mais seulement si le poids visé n'a pas déjà été saisi
  // (on ne veut pas écraser une valeur que l'utilisateur a déjà choisie).
  const champTaille = document.getElementById("pf-taille");
  const champPoidsCible = document.getElementById("pf-poids-cible");
  champTaille.addEventListener("change", async () => {
    const taille = parseFloat(champTaille.value);
    if (taille > 0 && !champPoidsCible.value) {
      try {
        const res = await API.poidsSante(taille);
        champPoidsCible.value = res.poids_suggere_kg;
        declencherApercuCalcul();
      } catch (e) { /* silencieux : c'est juste une suggestion */ }
    }
  });

  // Recalcule l'aperçu en direct à chaque changement de champ pertinent.
  const champsADeclencher = ["pf-poids", "pf-taille", "pf-age", "pf-sexe", "pf-activite", "pf-poids-cible", "pf-duree"];
  champsADeclencher.forEach(id => {
    document.getElementById(id).addEventListener("input", declencherApercuCalcul);
    document.getElementById(id).addEventListener("change", declencherApercuCalcul);
  });

  let debounceApercu = null;
  function declencherApercuCalcul() {
    clearTimeout(debounceApercu);
    debounceApercu = setTimeout(afficherApercuCalcul, 350);
  }

  async function afficherApercuCalcul() {
    const valeur = (id) => parseFloat(document.getElementById(id).value) || null;
    const poids = valeur("pf-poids");
    const taille = valeur("pf-taille");
    const age = valeur("pf-age");
    const sexe = document.getElementById("pf-sexe").value;
    const activite = document.getElementById("pf-activite").value;
    const poidsCible = valeur("pf-poids-cible");
    const duree = valeur("pf-duree");

    const zone = document.getElementById("zone-apercu-calcul");
    if (!poids || !taille || !age || !poidsCible || !duree) {
      zone.innerHTML = "";
      return;
    }

    try {
      const res = await API.previsualiserObjectif({
        poids_actuel_kg: poids, poids_cible_kg: poidsCible, taille_cm: taille,
        age, sexe, niveau_activite: activite, duree_jours: duree,
      });
      const champObjectif = document.getElementById("pf-objectif");
      // Ne préremplit que si l'utilisateur n'a pas déjà tapé sa propre valeur.
      if (!champObjectif.dataset.modifieParUtilisateur) {
        champObjectif.value = res.objectif_kcal_jour;
      }

      zone.innerHTML = `
        <div class="resultat" style="margin-bottom:10px;">
          Métabolisme de base : <strong>${res.metabolisme_base} kcal</strong> ·
          Dépense totale estimée : <strong>${res.tdee} kcal</strong> ·
          Rythme visé : <strong>${res.rythme_kg_semaine} kg/semaine</strong>
        </div>
        ${res.alertes.map(a => `<div class="resultat erreur" style="margin-bottom:6px;">${a}</div>`).join("")}
      `;
    } catch (e) {
      zone.innerHTML = "";
    }
  }

  // Marque le champ objectif comme "modifié manuellement" dès que
  // l'utilisateur y tape quelque chose lui-même, pour ne plus l'écraser.
  document.getElementById("pf-objectif").addEventListener("input", (e) => {
    e.target.dataset.modifieParUtilisateur = "1";
  });

  if (profilExistant) afficherApercuCalcul();

  document.getElementById("btn-valider-profil").addEventListener("click", async () => {
    const nom = document.getElementById("pf-nom").value.trim();
    if (!nom) { afficherToastModale("Le nom est obligatoire.", true); return; }

    const valeur = (id) => {
      const v = document.getElementById(id).value;
      return v === "" ? null : parseFloat(v);
    };

    const payload = {
      nom,
      couleur: couleurChoisie,
      poids_kg: valeur("pf-poids"),
      taille_cm: valeur("pf-taille"),
      age: valeur("pf-age"),
      sexe: document.getElementById("pf-sexe").value,
      niveau_activite: document.getElementById("pf-activite").value,
      poids_cible_kg: valeur("pf-poids-cible"),
      duree_objectif_jours: valeur("pf-duree"),
      objectif_kcal_jour: valeur("pf-objectif"),
    };

    try {
      if (profilExistant) {
        await API.modifierProfil(profilExistant.id, payload);
      } else {
        await API.creerProfil(payload);
      }
      fermerModale();
      await chargerVueProfilsReglages();
      rafraichirSelecteurProfilActif();
    } catch (e) {
      afficherToastModale(e.message, true);
    }
  });
}

function ouvrirFormulaireNouveauProfil() {
  ouvrirFormulaireProfil(null);
}

function ouvrirEditionProfil(p) {
  ouvrirFormulaireProfil(p);
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
