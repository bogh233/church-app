// Gemeinsame Datei für alle Seiten. Sie prüft selbst, auf welcher Seite sie läuft.

const SUPABASE_URL = "https://fhcqrvvlgzbxyblqifsp.supabase.co";
const SUPABASE_KEY = "sb_publishable_oa2kssb2EK-h7lUY4rPtKg_gIGm7Jkh";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Name der aktuellen Seite, z. B. "index.html"
const seite = window.location.pathname.split("/").pop() || "index.html";

// Kleine Abkürzung: Element anhand der id holen
const el = (id) => document.getElementById(id);

// ---------- Anmeldeseite ----------
if (seite === "login.html") {
  el("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({
      email: el("email").value,
      password: el("passwort").value
    });
    if (error) { el("meldung").textContent = "Anmeldung fehlgeschlagen: " + error.message; return; }
    window.location.href = "index.html";
  });

  el("registrieren").addEventListener("click", async () => {
    const { data, error } = await sb.auth.signUp({
      email: el("email").value,
      password: el("passwort").value
    });
    if (error) { el("meldung").textContent = "Registrierung fehlgeschlagen: " + error.message; return; }
    if (data.session) { window.location.href = "index.html"; return; }
    el("meldung").textContent = "Fast fertig: Bitte bestätige den Link in der E-Mail, die wir dir geschickt haben.";
  });
}

// ---------- Alle anderen Seiten: erst prüfen, wer angemeldet ist ----------
async function start() {
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {                       // nicht angemeldet -> zur Anmeldung
    if (seite !== "login.html") window.location.href = "login.html";
    return;
  }
  if (seite === "login.html") { window.location.href = "index.html"; return; }

  // Eigenes Profil holen (enthält die Rolle: "mitglied" oder "admin")
  const { data: profil } = await sb.from("profile").select("*").eq("id", session.user.id).single();
  const istAdmin = !!profil && profil.rolle === "admin";

  // Abmelden-Link
  el("abmelden").addEventListener("click", async (e) => {
    e.preventDefault();
    await sb.auth.signOut();
    window.location.href = "login.html";
  });

  // "Neue Mitteilung" nur für Admins sichtbar
  if (istAdmin) el("nav-neu").classList.remove("versteckt");

  if (seite === "index.html") anzeigen(istAdmin);
  if (seite === "neu.html") neuSeite(istAdmin);
  if (seite === "profil.html") profilSeite(profil, session.user.email);
}
start();

// ---------- Startseite: Mitteilungen anzeigen ----------
async function anzeigen(istAdmin) {
  const behaelter = el("liste");
  behaelter.textContent = "Lade Mitteilungen …";

  const { data: liste, error } = await sb.from("mitteilungen")
    .select("*").order("erstellt_am", { ascending: false });
  if (error) { behaelter.textContent = "Fehler: " + error.message; return; }

  behaelter.innerHTML = "";
  if (liste.length === 0) {
    const hinweis = document.createElement("p");
    hinweis.textContent = "Noch keine Mitteilungen.";
    behaelter.appendChild(hinweis);
    return;
  }

  for (const eintrag of liste) {
    const karte = document.createElement("article");
    karte.className = "mitteilung" + (eintrag.wichtig ? " wichtig" : "");

    const titel = document.createElement("h3");
    titel.textContent = eintrag.titel; // textContent: sicher gegen eingeschleusten Code

    const datum = document.createElement("time");
    datum.textContent = new Date(eintrag.erstellt_am).toLocaleDateString("de-DE", {
      day: "numeric", month: "long", year: "numeric"
    });

    const text = document.createElement("p");
    text.textContent = eintrag.text;

    karte.append(titel, datum, text);

    if (istAdmin) { // Löschen-Knopf nur für Admins
      const knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "loeschen";
      knopf.textContent = "Löschen";
      knopf.addEventListener("click", async () => {
        const { error } = await sb.from("mitteilungen").delete().eq("id", eintrag.id);
        if (error) { alert(error.message); return; }
        anzeigen(istAdmin);
      });
      karte.appendChild(knopf);
    }
    behaelter.appendChild(karte);
  }
}

// ---------- Neue Mitteilung (nur Admins) ----------
function neuSeite(istAdmin) {
  if (!istAdmin) { window.location.href = "index.html"; return; }

  el("neue-mitteilung").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await sb.from("mitteilungen").insert({
      titel: el("titel").value,
      text: el("text").value,
      wichtig: el("wichtig").checked
    });
    if (error) { alert(error.message); return; }
    window.location.href = "index.html";
  });
}

// ---------- Profilseite ----------
function profilSeite(profil, email) {
  el("email").value = email;
  if (profil) {
    el("name").value = profil.name || "";
    el("telefon").value = profil.telefon || "";
    el("gruppe").value = profil.gruppe || "Keine Angabe";
  }

  el("profil").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("profile").update({
      name: el("name").value,
      telefon: el("telefon").value,
      gruppe: el("gruppe").value
    }).eq("id", user.id);
    el("bestaetigung").textContent = error ? "Fehler: " + error.message : "Profil gespeichert.";
  });
}
