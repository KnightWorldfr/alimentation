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
  restaurerEtatRecetteEnCoursSiPresent();
}

// ---------- Sauvegarde/restauration du formulaire en cours ----------
// Permet d'aller scanner ou ajouter un produit manquant depuis le
// sélecteur sans jamais perdre la recette en cours de saisie : l'état
// complet (nom, parts, étapes, ingrédients déjà choisis) est sauvegardé
// avant de quitter l'écran, puis restauré automatiquement au retour.

const CLE_BROUILLON_RECETTE = "alimentation_brouillon_recette";

function sauvegarderEtatRecetteEnCours() {
  const lignes = document.querySelectorAll("#liste-lignes-ingredients .ligne-ingredient");
  const ingredients = [...lignes].map(ligne => ({
    codeBarres: ligne.dataset.codeBarres || null,
    nomAffiche: ligne.querySelector(".btn-choisir-produit-ingredient")?.textContent || "",
    unite: ligne.dataset.unite || "",
    poidsPiece: ligne.dataset.poidsPiece || "",
    quantite: ligne.querySelector(".input-quantite-ingredient")?.value || "",
  }));

  const etat = {
    mode: modeConsommationActuel,
    nom: document.getElementById("nouvelle-recette-nom")?.value || "",
    parts: document.getElementById("nouvelle-recette-parts")?.value || "",
    cuisson: document.getElementById("nouvelle-recette-cuisson")?.value || "",
    ingredients,
  };
  localStorage.setItem(CLE_BROUILLON_RECETTE, JSON.stringify(etat));
}

function restaurerEtatRecetteEnCoursSiPresent() {
  const brut = localStorage.getItem(CLE_BROUILLON_RECETTE);
  if (!brut) return;
  localStorage.removeItem(CLE_BROUILLON_RECETTE); // à usage unique, évite une restauration fantôme plus tard

  let etat;
  try {
    etat = JSON.parse(brut);
  } catch (e) {
    return;
  }

  basculerModeConsommation(etat.mode || "recette");
  if (etat.nom) document.getElementById("nouvelle-recette-nom").value = etat.nom;
  if (etat.parts) document.getElementById("nouvelle-recette-parts").value = etat.parts;
  if (etat.cuisson) document.getElementById("nouvelle-recette-cuisson").value = etat.cuisson;

  (etat.ingredients || []).forEach(ing => {
    ajouterLigneIngredient();
    const lignes = document.querySelectorAll("#liste-lignes-ingredients .ligne-ingredient");
    const ligne = lignes[lignes.length - 1];
    if (ing.codeBarres) {
      ligne.dataset.codeBarres = ing.codeBarres;
      ligne.dataset.unite = ing.unite;
      ligne.dataset.poidsPiece = ing.poidsPiece;
      const bouton = ligne.querySelector(".btn-choisir-produit-ingredient");
      bouton.textContent = ing.nomAffiche;
      bouton.classList.add("rempli");
      const input = ligne.querySelector(".input-quantite-ingredient");
      input.disabled = false;
      input.value = ing.quantite;
    }
  });

  if ((etat.ingredients || []).length > 0) {
    afficherToastConsommation("Ta recette en cours a été restaurée après l'ajout du produit.");
  }
}

function afficherToastConsommation(message) {
  const zone = document.getElementById("zone-resultat-consommation");
  if (zone) zone.innerHTML = `<div class="resultat">${message}</div>`;
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
    <button type="button" class="btn-choisir-produit-ingredient">Choisir un produit en stock…</button>
    <input type="number" class="input-quantite-ingredient" placeholder="Quantité (g)" disabled>
    <button class="btn-retirer" title="Retirer cet ingrédient">✕</button>
  `;
  conteneur.appendChild(div);

  const btnChoisir = div.querySelector(".btn-choisir-produit-ingredient");
  const input = div.querySelector(".input-quantite-ingredient");

  btnChoisir.addEventListener("click", () => {
    ouvrirSelecteurProduitStock((item) => {
      div.dataset.codeBarres = item.code_barres;
      div.dataset.unite = item.unite_mesure;
      div.dataset.poidsPiece = item.poids_unite_g || "";
      const uniteAffichee = item.unite_mesure === "unite" ? "pièce(s)" : item.unite_mesure;
      btnChoisir.textContent = item.nom;
      btnChoisir.classList.add("rempli");
      input.disabled = false;
      input.placeholder = item.unite_mesure === "unite" ? "Quantité (pièces)" : `Quantité (${uniteAffichee})`;
      input.focus();
    }, "Choisir un ingrédient");
  });

  div.querySelector(".btn-retirer").addEventListener("click", () => div.remove());
}

function lireIngredientsSaisis() {
  const lignes = document.querySelectorAll("#liste-lignes-ingredients .ligne-ingredient");
  const ingredients = [];
  for (const ligne of lignes) {
    const input = ligne.querySelector(".input-quantite-ingredient");
    const codeBarres = ligne.dataset.codeBarres;
    const quantiteSaisie = parseFloat(input.value);
    if (codeBarres && quantiteSaisie > 0) {
      const unite = ligne.dataset.unite;
      const poidsPiece = parseFloat(ligne.dataset.poidsPiece);

      // Si le produit est en "unite" et qu'on connaît le poids d'une pièce,
      // la quantité saisie (en pièces) est convertie en grammes internes
      // avant l'envoi — le backend raisonne toujours en grammes.
      let quantiteG = quantiteSaisie;
      if (unite === "unite" && poidsPiece > 0) {
        quantiteG = quantiteSaisie * poidsPiece;
      }
      ingredients.push({ code_barres: codeBarres, quantite_g: quantiteG });
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
  const zone = document.getElementById("libre-zone-produit");
  if (!zone) return;
  zone.innerHTML = `
    <button type="button" class="btn-choisir-produit-ingredient" id="btn-choisir-produit-libre">Choisir un produit en stock…</button>
  `;
  document.getElementById("btn-choisir-produit-libre").addEventListener("click", () => {
    ouvrirSelecteurProduitStock((item) => {
      zone.dataset.codeBarres = item.code_barres;
      zone.dataset.unite = item.unite_mesure;
      zone.dataset.poidsPiece = item.poids_unite_g || "";
      const bouton = document.getElementById("btn-choisir-produit-libre");
      bouton.textContent = item.nom;
      bouton.classList.add("rempli");
      const champQuantite = document.getElementById("libre-quantite");
      champQuantite.disabled = false;
      champQuantite.placeholder = item.unite_mesure === "unite" ? "ex: 1 (pièce)" : `ex: 30 (${item.unite_mesure || "g"})`;
      champQuantite.focus();
    }, "Choisir un produit");
  });
}

function remplirSelectProfilLibre() {
  const zone = document.getElementById("libre-zone-profils");
  if (!zone) return;
  const profilActifId = getProfilActifId();
  zone.innerHTML = `
    <label class="case-profil-libre">
      <input type="checkbox" value="" ${!profilActifId ? "checked" : ""}> Sans profil
    </label>
    ${profilsCache.map(p => `
      <label class="case-profil-libre">
        <input type="checkbox" value="${p.id}" ${p.id === profilActifId ? "checked" : ""}>
        <span class="pastille-profil" style="background:${p.couleur}; width:18px; height:18px; font-size:0.6rem;">${initiale(p.nom)}</span>
        ${echapperHtml(p.nom)}
      </label>
    `).join("")}
  `;
  // "Sans profil" est exclusif avec les profils réels — cocher l'un
  // décoche l'autre, pour éviter une combinaison qui n'a pas de sens.
  const caseSansProfil = zone.querySelector('input[value=""]');
  const casesProfils = [...zone.querySelectorAll('input[value]:not([value=""])')];
  caseSansProfil.addEventListener("change", () => {
    if (caseSansProfil.checked) casesProfils.forEach(c => c.checked = false);
  });
  casesProfils.forEach(c => c.addEventListener("change", () => {
    if (c.checked) caseSansProfil.checked = false;
  }));
}

async function validerConsommationLibre() {
  const zoneProduit = document.getElementById("libre-zone-produit");
  const codeBarres = zoneProduit?.dataset.codeBarres;
  const quantiteSaisie = parseFloat(document.getElementById("libre-quantite").value);
  const contexte = document.getElementById("libre-contexte").value.trim();
  const zone = document.getElementById("zone-resultat-consommation");

  if (!codeBarres || !quantiteSaisie || quantiteSaisie <= 0) {
    zone.innerHTML = `<div class="resultat erreur">Choisis un produit et une quantité valide.</div>`;
    return;
  }

  // Conversion pièces -> grammes internes si le produit est en "unite".
  const unite = zoneProduit.dataset.unite;
  const poidsPiece = parseFloat(zoneProduit.dataset.poidsPiece);
  const quantite = (unite === "unite" && poidsPiece > 0) ? quantiteSaisie * poidsPiece : quantiteSaisie;

  // Profils sélectionnés (peut être vide = "sans profil", ou plusieurs
  // personnes qui partagent ce produit). Le stock n'est décompté qu'UNE
  // fois pour la quantité totale ; les calories sont réparties à parts
  // égales entre les profils sélectionnés pour ne pas les compter en double.
  const casesProfils = [...document.querySelectorAll('#libre-zone-profils input[value]:not([value=""]):checked')];
  const profilsSelectionnes = casesProfils.map(c => parseInt(c.value));

  try {
    if (profilsSelectionnes.length <= 1) {
      const profilId = profilsSelectionnes[0] || null;
      const resultat = await API.consommerStock(codeBarres, quantite, contexte || "Consommation libre", profilId);
      const m = resultat.macros_consommees;
      zone.innerHTML = `
        <div class="resultat">
          ✓ ${resultat.message}<br>
          <strong>${m.energie_kcal ?? '?'} kcal</strong>
          ${m.proteines_g != null ? ` · ${m.proteines_g}g protéines` : ""}
        </div>
      `;
    } else {
      // Partagé entre plusieurs profils : un seul décompte réel du stock
      // (sur le premier profil, qui sert juste de "porteur" du mouvement),
      // puis une part égale de calories attribuée à chacun des autres via
      // des entrées d'historique à quantité nulle pour le stock mais
      // proportionnelles pour les macros — voir note ci-dessous.
      const part = quantite / profilsSelectionnes.length;
      const resultats = [];
      for (let i = 0; i < profilsSelectionnes.length; i++) {
        const r = await API.consommerStock(
          codeBarres,
          i === 0 ? quantite - part * (profilsSelectionnes.length - 1) : part,
          contexte || "Consommation libre (partagé)",
          profilsSelectionnes[i]
        );
        resultats.push(r);
      }
      const totalKcal = resultats.reduce((s, r) => s + (r.macros_consommees.energie_kcal || 0), 0);
      const noms = profilsSelectionnes.map(id => profilsCache.find(p => p.id === id)?.nom || "?").join(", ");
      zone.innerHTML = `
        <div class="resultat">
          ✓ Partagé entre ${noms} (${Math.round(part)}g chacun)<br>
          <strong>${Math.round(totalKcal)} kcal au total</strong>
        </div>
      `;
    }

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
