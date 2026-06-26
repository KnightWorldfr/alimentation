// ============================================================
// Module API — centralise tous les appels au backend.
// L'adresse du serveur est configurable (Réglages), stockée en
// localStorage, lue dynamiquement à chaque appel.
// ============================================================

function getApiUrl() {
  return localStorage.getItem("alimentation_api_url") || "";
}
function setApiUrl(url) {
  localStorage.setItem("alimentation_api_url", url.replace(/\/$/, ""));
}

const API = {
  get url() { return getApiUrl(); },

  async _appel(methode, chemin, corps) {
    const options = { method: methode, headers: {} };
    if (corps !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(corps);
    }
    const resp = await fetch(`${this.url}${chemin}`, options);
    let data = null;
    try { data = await resp.json(); } catch (e) { /* corps vide, ex: 204 */ }
    if (!resp.ok) {
      const message = (data && data.detail) || `Erreur ${resp.status}`;
      throw new Error(message);
    }
    return data;
  },

  get(chemin) { return this._appel("GET", chemin); },
  post(chemin, corps) { return this._appel("POST", chemin, corps ?? {}); },
  put(chemin, corps) { return this._appel("PUT", chemin, corps ?? {}); },
  delete(chemin) { return this._appel("DELETE", chemin); },

  // ---------- Produits ----------
  produit(codeBarres) { return this.get(`/produit/${codeBarres}`); },
  majProduit(codeBarres, payload) { return this.put(`/produit/${codeBarres}`, payload); },

  // ---------- Stock ----------
  stock(tri = "nom", recherche = "") {
    const params = new URLSearchParams({ tri });
    if (recherche) params.set("recherche", recherche);
    return this.get(`/stock?${params}`);
  },
  ajouterStock(codeBarres, quantiteG) {
    return this.post("/stock/ajouter", { code_barres: codeBarres, quantite_g: quantiteG });
  },
  consommerStock(codeBarres, quantiteG, contexte, profilId) {
    return this.post("/stock/consommer", {
      code_barres: codeBarres, quantite_g: quantiteG, contexte, profil_id: profilId,
    });
  },
  corrigerStock(codeBarres, nouvelleQuantiteG, motif) {
    return this.post("/stock/corriger", {
      code_barres: codeBarres, nouvelle_quantite_g: nouvelleQuantiteG, motif,
    });
  },

  // ---------- Historique ----------
  historique(limite = 50, profilId = null, typeMouvement = null) {
    const params = new URLSearchParams({ limite });
    if (profilId) params.set("profil_id", profilId);
    if (typeMouvement) params.set("type_mouvement", typeMouvement);
    return this.get(`/historique?${params}`);
  },

  // ---------- Profils ----------
  profils() { return this.get("/profils"); },
  creerProfil(payload) { return this.post("/profils", payload); },
  modifierProfil(id, payload) { return this.put(`/profils/${id}`, payload); },
  supprimerProfil(id) { return this.delete(`/profils/${id}`); },
  dashboardProfil(id, jours = 7) { return this.get(`/profils/${id}/dashboard?jours=${jours}`); },
  releesPoids(id, jours = 90) { return this.get(`/profils/${id}/poids?jours=${jours}`); },
  ajouterReleveePoids(id, poidsKg) { return this.post(`/profils/${id}/poids`, { poids_kg: poidsKg }); },
  supprimerReleveePoids(profilId, releveId) { return this.delete(`/profils/${profilId}/poids/${releveId}`); },
  previsualiserObjectif(payload) { return this.post("/calculs/objectif-kcal", payload); },
  poidsSante(tailleCm) { return this.get(`/calculs/poids-sante?taille_cm=${tailleCm}`); },
  purgerHistorique() { return this.delete("/historique"); },
  categories() { return this.get("/categories"); },
  catalogueFruitsLegumes() { return this.get("/catalogue/fruits-legumes"); },
  ajouterFruitLegumeAuStock(identifiant, quantite) {
    return this.post(`/catalogue/fruits-legumes/${identifiant}/ajouter-stock?quantite=${quantite}`);
  },

  // ---------- Recettes ----------
  recettes(statut = null) {
    const params = statut ? `?statut=${statut}` : "";
    return this.get(`/recettes${params}`);
  },
  recette(id) { return this.get(`/recettes/${id}`); },
  creerRecette(payload) { return this.post("/recettes", payload); },
  terminerRecette(id) { return this.post(`/recettes/${id}/terminer`); },
  attribuerParts(id, profilId, nbParts) {
    return this.post(`/recettes/${id}/attribuer`, { profil_id: profilId, nb_parts: nbParts });
  },
  supprimerRecette(id) { return this.delete(`/recettes/${id}`); },

  // ---------- Courses ----------
  courses() { return this.get("/courses"); },
  ajouterCourse(payload) { return this.post("/courses", payload); },
  ajouterCoursesDepuisStock() { return this.post("/courses/depuis-stock"); },
  majCourse(id, payload) { return this.put(`/courses/${id}`, payload); },
  validerAchats() { return this.post("/courses/valider-achats"); },
};
