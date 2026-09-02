// ============================================================
// ÉTIQUETTES (impression format Zebra)
// Gabarit basé sur les modèles existants Vanbaelinghem :
// en-tête fixe, date + code magasin, produit, instructions de
// cuisson si renseignées, et en option n° commande + client.
// ============================================================

/**
 * Construit le HTML d'UNE étiquette.
 * @param {Object} opts
 * @param {string} opts.dateRetrait - format YYYY-MM-DD
 * @param {string} opts.magasinId
 * @param {string} opts.nomProduit
 * @param {string} [opts.poidsTexte] - ex: "1.5 KG"
 * @param {string} [opts.personnesTexte] - ex: "2 PERSONNES" (pierrades)
 * @param {string} [opts.varianteTexte] - ex: "NATURE" / "MARINÉE" (pierrades)
 * @param {string} [opts.plateauTexte] - ex: "1/2"
 * @param {string} [opts.instructionsCuisson] - texte multiligne
 * @param {string} [opts.specification] - ex: "Sans porc"
 * @param {string} [opts.numeroCommande]
 * @param {string} [opts.nomClient]
 * @param {boolean} [opts.afficherNumeroCommande]
 * @param {boolean} [opts.afficherNomClient]
 * @param {string} [opts.periodeNom] - ex: "NOEL" (affiché comme dans les modèles)
 */
function etiquetteHTML(opts) {
  const ligneDateMagasin = `${formaterDateCourte(opts.dateRetrait)} ${codeMagasin(opts.magasinId)}`;
  const ligneInstructions = (opts.instructionsCuisson || "")
    .split("\n").filter(Boolean)
    .map(l => `<div class="etq-instruction-ligne">- ${l}</div>`).join("");

  let contenuPrincipal = "";
  if (opts.varianteTexte) {
    // Étiquette type pierrade
    contenuPrincipal = `
      <div class="etq-variante">${opts.varianteTexte}</div>
      ${opts.personnesTexte ? `<div class="etq-personnes">${opts.personnesTexte}</div>` : ""}
      <div class="etq-type-produit">PIERRADE${opts.plateauTexte ? ` (${opts.plateauTexte})` : ""}</div>
    `;
  } else {
    contenuPrincipal = `
      <div class="etq-produit">${opts.poidsTexte ? opts.poidsTexte + " " : ""}${(opts.periodeNom || "").toUpperCase()}</div>
      <div class="etq-nom-produit">${opts.nomProduit.toUpperCase()}</div>
      ${opts.farceTexte ? `<div class="etq-farce">${opts.farceTexte.toUpperCase()}</div>` : ""}
    `;
  }

  return `
    <div class="etiquette">
      <div class="etq-entete">
        <div class="etq-marque">VANBAELINGHEM</div>
        <div class="etq-souligne"></div>
        <div class="etq-tagline">Maison artisanale de confiance depuis 1950.</div>
      </div>
      <div class="etq-cadre">
        <div class="etq-date-magasin">${ligneDateMagasin}</div>
        ${contenuPrincipal}
      </div>
      ${ligneInstructions ? `<div class="etq-instructions">${ligneInstructions}</div>` : ""}
      ${opts.specification ? `<div class="etq-specification">⚠ ${opts.specification}</div>` : ""}
      ${(opts.afficherNumeroCommande || opts.afficherNomClient) ? `
        <div class="etq-bas">
          ${opts.afficherNumeroCommande ? `<span>N° ${opts.numeroCommande}</span>` : ""}
          ${opts.afficherNomClient ? `<span>${opts.nomClient}</span>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

function formaterDateCourte(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/**
 * Construit la liste des étiquettes à générer pour une commande, en
 * respectant la config d'affichage (n° commande / client) par catégorie.
 * Une étiquette par ligne de commande (les pierrades découpées en
 * plusieurs plateaux génèrent une étiquette par plateau/variante).
 */
function genererEtiquettesCommande(commande, configEtiquettes) {
  const parId = Object.fromEntries(ETAT.catalogue.map(p => [p.id, p]));
  const periode = (ETAT.parametres.periodes || []).find(p => p.id === commande.periodeId);
  const etiquettes = [];

  (commande.lignes || []).forEach(l => {
    if (!l.produitId) return; // lignes libres ("Autre") : pas d'étiquette catalogue
    const produit = parId[l.produitId];
    if (!produit) return;
    if (produit.genereEtiquette === false) return; // désactivé par l'admin
    const categorieImpression = produit.imprimerDans || "traiteur";
    const config = (configEtiquettes && configEtiquettes[categorieImpression]) || { afficherNumeroCommande: true, afficherNomClient: true };

    const optsBase = {
      dateRetrait: commande.dateRetrait,
      magasinId: commande.magasinId,
      numeroCommande: commande.numero,
      nomClient: commande.client,
      afficherNumeroCommande: config.afficherNumeroCommande,
      afficherNomClient: config.afficherNomClient,
      specification: l.specification || "",
      farceTexte: l.farce || "",
      periodeNom: periode ? periode.nom : ""
    };

    if (l.typeVente === "pierrade") {
      etiquettes.push(etiquetteHTML({
        ...optsBase,
        nomProduit: produit.nom,
        varianteTexte: l.produitId === "pierrade_nature" ? "NATURE" : "MARINÉE",
        personnesTexte: `${l.quantite} PERSONNE${l.quantite > 1 ? "S" : ""}`,
        plateauTexte: l.plateauNumero ? `${l.plateauNumero}/${l.plateauTotal}` : null
      }));
    } else if (l.typeVente === "poids") {
      etiquettes.push(etiquetteHTML({
        ...optsBase,
        nomProduit: produit.nom,
        poidsTexte: (l.poidsKg || 0).toLocaleString("fr-FR") + " KG",
        instructionsCuisson: produit.instructionsCuisson || ""
      }));
    } else {
      // Une étiquette par unité commandée (ex: 3 Ballotins -> 3 étiquettes identiques)
      for (let i = 0; i < l.quantite; i++) {
        etiquettes.push(etiquetteHTML({
          ...optsBase,
          nomProduit: produit.nom,
          instructionsCuisson: produit.instructionsCuisson || ""
        }));
      }
    }
  });

  return etiquettes;
}

/**
 * Imprime les étiquettes d'une ou plusieurs commandes, via la zone
 * d'impression dédiée déjà utilisée ailleurs dans l'app.
 */
async function imprimerEtiquettesCommandes(commandes) {
  const parametres = await recupererParametres();
  const configEtiquettes = parametres.configEtiquettes || CONFIG_ETIQUETTES_DEFAUT;

  let toutesEtiquettes = [];
  commandes.forEach(c => {
    toutesEtiquettes = toutesEtiquettes.concat(genererEtiquettesCommande(c, configEtiquettes));
  });

  if (toutesEtiquettes.length === 0) {
    afficherToast("Aucune étiquette à imprimer pour cette sélection", "erreur");
    return;
  }

  let zone = document.getElementById("zone-impression-dediee");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zone-impression-dediee";
  zone.className = "zone-impression-dediee zone-etiquettes";
  zone.innerHTML = toutesEtiquettes.join("");
  document.body.appendChild(zone);
  document.body.classList.add("mode-impression-dediee");

  // Injecter la taille de page Zebra uniquement pendant cette impression
  let stylePageEtiquette = document.getElementById("style-page-etiquette");
  if (!stylePageEtiquette) {
    stylePageEtiquette = document.createElement("style");
    stylePageEtiquette.id = "style-page-etiquette";
    document.head.appendChild(stylePageEtiquette);
  }
  const etqL = parseFloat(sessionStorage.getItem("eventpro_demo_etq_largeur") || "60.80").toFixed(2);
  const etqH = parseFloat(sessionStorage.getItem("eventpro_demo_etq_hauteur")  || "57.15").toFixed(2);
  stylePageEtiquette.textContent = `@page { size: ${etqL}mm ${etqH}mm; margin: 0; } .etiquette { width: ${etqL}mm !important; height: ${etqH}mm !important; }`;

  function nettoyer() {
    window.removeEventListener("afterprint", nettoyer);
