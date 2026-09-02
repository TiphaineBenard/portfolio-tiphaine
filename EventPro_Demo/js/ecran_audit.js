// ============================================================
// ÉCRAN : JOURNAL D'AUDIT (lecture uniquement, immuable)
// ============================================================

function rendreAudit(conteneur) {
  conteneur.innerHTML = `
    <div class="carte-titre aide-desktop"><h2 style="margin:0;">Journal d'audit</h2></div>
    <p style="color:var(--charbon-clair); font-size:0.9rem; margin-bottom:16px;">
      Historique immuable de toutes les actions effectuées dans l'application. Ce journal ne peut pas être modifié ou supprimé.
    </p>
    <div id="audit-liste"><div class="vide-etat">Chargement...</div></div>
  `;

  const desabonner = ecouterAuditLog((logs) => {
    const zone = document.getElementById("audit-liste");
    if (!zone) return;
    if (logs.length === 0) {
      zone.innerHTML = `<div class="vide-etat">Aucune action enregistrée.</div>`;
      return;
    }
    zone.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Horodatage</th><th>Utilisateur</th><th>Rôle</th><th>Action</th><th>Description</th></tr></thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td style="white-space:nowrap; font-family:var(--font-mono); font-size:0.82rem;">${formaterHorodatage(l.horodatage)}</td>
                <td>${l.utilisateur}</td>
                <td>${l.role}</td>
                <td><span class="badge" style="background:var(--charbon);">${l.action}</span></td>
                <td>${l.description}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  });
  ETAT.desabonnements.push(desabonner);
}

function formaterHorodatage(ts) {
  if (!ts) return "—";
  // Mode local : timestamp ISO string. Mode Firebase : objet Timestamp avec .toDate()
  const d = (typeof ts === "object" && typeof ts.toDate === "function") ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
