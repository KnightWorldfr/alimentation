// ============================================================
// Module Consommation — ex-onglet "Recette", renommé et étendu.
// Deux modes : "Recette" (structurée, ingrédients + parts attribuées)
// et "Libre" (snack/boisson ponctuel attribué à un profil).
// ============================================================

let modeConsommationActuel = "recette"; // 'recette' ou 'libre'
let ingredientsRecetteEnCours = []; // [{code_barres, nom, quantite_g}]
let stockDisponibleCache = [];

async function initVueConsommation() {
  await chargerProfils();
  await rafraichirStockDisponiblePourSelects();
  basculerModeConsommation(modeConsommationActuel);
  await chargerListeRecettes();
}

async function rafraichirStockDisponiblePourSelects() {
  try {
    stockDisponibleCache = await API.stock("nom");
  } catch (e) {
    stockDisponibleCache = [];
  }
}

function basculerModeConsommation(mode) {
  modeConsommationActuel = mode;
  document.querySelectorAll(".bascule-mode button").forEach(b => {
    b.classList.toggle("actif", b.dataset.mode === mode);
  });
  document.getElementById("panneau-mode-recette").style.display = mode === "recette" ? "block" : "none";
  document.getElementById("panneau-mode-libre").style.display = mode === "libre" ? "block" : "none";

  if (mode === "libre") {
    remplirSelectProduitLibre();
    remplirSelectProfilLibre();
  }
}

// ---------- Mode RECETTE : construction ----------

function ajouterLigneIngredient() {
  const conteneur = document.getElementById("liste-lignes-ingredients");
  const ligneId = `ligne-ing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const div = document.createElement("div");
  div.className = "ligne-ingredient";
  div.id = ligneId;
  div.innerHTML = `
    <select class="select-ingredient">
      <option value="">Choisir un produit en stock…</option>
      ${stockDisponibleCache.map(item =>
        `<option value="${item.code_barres}" data-unite="${item.unite_mesure}" data-restant="${item.total_restant_g}">${echapperHtml(item.nom)} (${Math.round(item.total_restant_g)} ${item.unite_mesure} dispo)</option>`
      ).join("")}
    </select>
    <input type="number" class="input-quantite-ingredient" placeholder="Quantité">
    <button class="btn-retirer" title="Retirer cet ingrédient">✕</button>
  `;
  conteneur.appendChild(div);

  div.querySelector(".btn-retirer").addEventListener("click", () => div.remove());
}

function lireIngredientsSaisis() {
  const lignes = document.querySelectorAll("#liste-lignes-ingredients .ligne-ingredient");
  const ingredients = [];
  for (const ligne of lignes) {
    const select = ligne.querySelector(".select-ingredient");
    const input = ligne.querySelector(".input-quantite-ingredient");
    const codeBarres = select.value;
    const quantite = parseFloat(input.value);
    if (codeBarres && quantite > 0) {
      ingredients.push({ code_barres: codeBarres, quantite_g: quantite });
    }
  }
  return ingredients;
}

async function validerCreationRecette() {
  const nom = document.getElementById("nouvelle-recette-nom").value.trim();
  const nbParts = parseInt(document.getElementById("nouvelle-recette-parts").value) || 1;
  const etapes = document.getElementById("nouvelle-recette-cuisson").value.trim();
  const ingredients = lireIngredientsSaisis();
  const zone = document.getElementById("zone-resultat-consommation");

  if (!nom) {
    zone.innerHTML = `<div class="resultat erreur">Donne un nom à la recette.</div>`;
    return;
  }
  if (ingredients.length === 0) {
    zone.innerHTML = `<div class="resultat erreur">Ajoute au moins un ingrédient.</div>`;
    return;
  }

  try {
    const recette = await API.creerRecette({
      nom, nb_parts: nbParts, etapes_cuisson: etapes || null, ingredients,
    });
    zone.innerHTML = `<div class="resultat">✓ Recette "${echapperHtml(recette.nom)}" créée et ingrédients décomptés du stock.</div>`;
    // Réinitialise le formulaire
    document.getElementById("nouvelle-recette-nom").value = "";
    document.getElementById("nouvelle-recette-cuisson").value = "";
    document.getElementById("liste-lignes-ingredients").innerHTML = "";
    await rafraichirStockDisponiblePourSelects();
    await chargerListeRecettes();
  } catch (e) {
    zone.innerHTML = `<div class="resultat erreur">${e.message}</div>`;
  }
}

// ---------- Mode LIBRE : snack/boisson ponctuel ----------

function remplirSelectProduitLibre() {
  const select = document.getElementById("libre-select-produit");
  if (!select) return;
  select.innerHTML = `<option value="">Choisir un produit en stock…</option>` +
    stockDisponibleCache.map(item =>
      `<option value="${item.code_barres}">${echapperHtml(item.nom)} (${Math.round(item.total_restant_g)} ${item.unite_mesure} dispo)</option>`
    ).join("");
}

function remplirSelectProfilLibre() {
  const select = document.getElementById("libre-profil");
  if (!select) return;
  const profilActifId = getProfilActifId();
  select.innerHTML = `<option value="">Sans profil</option>` +
    profilsCache.map(p =>
      `<option value="${p.id}" ${p.id === profilActifId ? "selected" : ""}>${echapperHtml(p.nom)}</option>`
    ).join("");
}

async function validerConsommationLibre() {
  const codeBarres = document.getElementById("libre-select-produit").value;
  const quantite = parseFloat(document.getElementById("libre-quantite").value);
  const profilId = document.getElementById("libre-profil").value || null;
  const contexte = document.getElementById("libre-contexte").value.trim();
  const zone = document.getElementById("zone-resultat-consommation");

  if (!codeBarres || !quantite || quantite <= 0) {
    zone.innerHTML = `<div class="resultat erreur">Choisis un produit et une quantité valide.</div>`;
    return;
  }

  try {
    const resultat = await API.consommerStock(
      codeBarres, quantite, contexte || "Consommation libre", profilId ? parseInt(profilId) : null
    );
    const m = resultat.macros_consommees;
    zone.innerHTML = `
      <div class="resultat">
        ✓ ${resultat.message}<br>
        <strong>${m.energie_kcal ?? '?'} kcal</strong>
        ${m.proteines_g != null ? ` · ${m.proteines_g}g protéines` : ""}
      </div>
    `;
    document.getElementById("libre-quantite").value = "";
    document.getElementById("libre-contexte").value = "";
    await rafraichirStockDisponiblePourSelects();
    remplirSelectProduitLibre();
  } catch (e) {
    zone.innerHTML = `<div class="resultat erreur">${e.message}</div>`;
  }
}

// ---------- Liste des recettes existantes + attribution de parts ----------

async function chargerListeRecettes() {
  const conteneur = document.getElementById("liste-recettes-existantes");
  if (!conteneur) return;
  try {
    const recettes = await API.recettes();
    if (recettes.length === 0) {
      conteneur.innerHTML = `<div class="vide">Aucune recette créée pour l'instant.</div>`;
      return;
    }
    conteneur.innerHTML = `<div class="liste-cartes-recettes">${recettes.map(carteRecetteHtml).join("")}</div>`;

    recettes.forEach(r => {
      const btnAttribuer = document.getElementById(`btn-attribuer-${r.id}`);
      if (btnAttribuer) btnAttribuer.addEventListener("click", () => ouvrirAttributionParts(r));
      const btnTerminer = document.getElementById(`btn-terminer-${r.id}`);
      if (btnTerminer) btnTerminer.addEventListener("click", () => terminerRecetteAvecConfirmation(r));
      const btnSuppr = document.getElementById(`btn-suppr-recette-${r.id}`);
      if (btnSuppr) btnSuppr.addEventListener("click", () => supprimerRecetteAvecConfirmation(r));
    });
  } catch (e) {
    conteneur.innerHTML = `<div class="vide">Erreur de chargement des recettes.</div>`;
  }
}

function carteRecetteHtml(r) {
  const proportionAttribuee = r.nb_parts ? (r.parts_attribuees / r.nb_parts) * 100 : 0;
  return `
    <div class="carte-recette ${r.statut === 'terminee' ? 'terminee' : ''}">
      <div class="nom-recette">${echapperHtml(r.nom)}</div>
      <div class="meta-recette">
        ${r.nb_parts} part(s) · ${r.statut === 'terminee' ? 'Terminée' : 'En cours'}
        ${r.etapes_cuisson ? `<br>${echapperHtml(r.etapes_cuisson)}` : ""}
      </div>
      <div class="barre-attribution-parts">
        <div class="jauge"><div class="rempli" style="width:${proportionAttribuee}%"></div></div>
        <span style="font-size:0.72rem;white-space:nowrap;">${r.parts_attribuees}/${r.nb_parts}</span>
      </div>
      <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
        ${r.parts_restantes > 0 ? `<button class="action petit" id="btn-attribuer-${r.id}">Attribuer une part</button>` : ""}
        ${r.statut !== 'terminee' ? `<button class="action petit secondaire" id="btn-terminer-${r.id}">Terminer</button>` : ""}
        <button class="action petit danger" id="btn-suppr-recette-${r.id}">Supprimer</button>
      </div>
    </div>
  `;
}

async function ouvrirAttributionParts(recette) {
  const recetteComplete = await API.recette(recette.id);
  const profilActifId = getProfilActifId();

  ouvrirModale(`Attribuer une part : ${echapperHtml(recette.nom)}`, `
    <div class="resultat">
      ${recetteComplete.parts_restantes}/${recetteComplete.nb_parts} part(s) restante(s)
      ${recetteComplete.energie_kcal_par_part ? ` · ${recetteComplete.energie_kcal_par_part} kcal/part` : ""}
    </div>

    <label for="attrib-profil">Qui ?</label>
    <select id="attrib-profil">
      <option value="">Sans profil</option>
      ${profilsCache.map(p => `<option value="${p.id}" ${p.id === profilActifId ? "selected" : ""}>${echapperHtml(p.nom)}</option>`).join("")}
    </select>

    <label for="attrib-nb-parts">Nombre de parts</label>
    <input type="number" id="attrib-nb-parts" value="1" min="0.1" step="0.5" max="${recetteComplete.parts_restantes}">

    <button class="action" id="btn-valider-attribution">Attribuer</button>
  `);

  document.getElementById("btn-valider-attribution").addEventListener("click", async () => {
    const profilId = document.getElementById("attrib-profil").value || null;
    const nbParts = parseFloat(document.getElementById("attrib-nb-parts").value);
    if (!nbParts || nbParts <= 0) {
      afficherToastModale("Indique un nombre de parts valide.", true);
      return;
    }
    try {
      await API.attribuerParts(recette.id, profilId ? parseInt(profilId) : null, nbParts);
      fermerModale();
      chargerListeRecettes();
    } catch (e) {
      afficherToastModale(e.message, true);
    }
  });
}

async function terminerRecetteAvecConfirmation(r) {
  try {
    await API.terminerRecette(r.id);
    chargerListeRecettes();
  } catch (e) {
    alert(e.message);
  }
}

async function supprimerRecetteAvecConfirmation(r) {
  if (!confirm(`Supprimer la recette "${r.nom}" ? Les parts non attribuées seront perdues (les ingrédients déjà décomptés du stock ne seront pas remis).`)) return;
  try {
    await API.supprimerRecette(r.id);
    chargerListeRecettes();
  } catch (e) {
    alert(e.message);
  }
}
