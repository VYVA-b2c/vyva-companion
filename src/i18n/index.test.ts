import { readdirSync, readFileSync, statSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getLanguage,
  getLanguageSnapshot,
  setAccountLanguage,
  setBootstrapLanguage,
  setLanguage,
  syncProfileLanguage,
  translate,
  LANGUAGE_STORAGE_KEY,
} from "./index";
import { HOME_FAST_HELP_REASON_FALLBACKS } from "../lib/contextualHomeFastHelp";

const LANGUAGE_SOURCE_STORAGE_KEY = "vyva_lang_source";
const SUPPORTED_TEST_LANGUAGES = ["en", "es", "fr", "de", "it", "pt"] as const;

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = `${dir}/${entry}`;
    return statSync(fullPath).isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

function flattenLocaleKeys(value: unknown, prefix = "", output: string[] = []): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return output;

  for (const [key, child] of Object.entries(value)) {
    const childKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenLocaleKeys(child, childKey, output);
    } else {
      output.push(childKey);
    }
  }

  return output;
}

function localeKeys(language: (typeof SUPPORTED_TEST_LANGUAGES)[number]) {
  return new Set(flattenLocaleKeys(JSON.parse(readFileSync(`src/i18n/locales/${language}.json`, "utf8"))));
}

describe("language persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    setAccountLanguage("es");
  });

  it("uses the account language as the persistent default", () => {
    setAccountLanguage("en");

    expect(getLanguage()).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY)).toBe("account");
  });

  it("does not let profile refreshes overwrite a language chosen from a selector", () => {
    setAccountLanguage("es");
    setLanguage("fr");

    syncProfileLanguage("es");

    expect(getLanguage()).toBe("fr");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("fr");
    expect(localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY)).toBe("user");
  });

  it("lets profile hydration replace a browser-detected default", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    localStorage.setItem(LANGUAGE_SOURCE_STORAGE_KEY, "browser");

    syncProfileLanguage("de");

    expect(getLanguage()).toBe("de");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("de");
    expect(localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY)).toBe("profile");
  });

  it("lets a later account login establish that account language", () => {
    setLanguage("de");

    setAccountLanguage("pt");

    expect(getLanguage()).toBe("pt");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("pt");
    expect(localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY)).toBe("account");
  });

  it("lets a different active profile become the master language", () => {
    syncProfileLanguage("es", "profile-a");
    setLanguage("fr");

    syncProfileLanguage("de", "profile-b");

    expect(getLanguage()).toBe("de");
    expect(getLanguageSnapshot()).toMatchObject({
      language: "de",
      source: "profile",
      profileId: "profile-b",
    });
  });

  it("keeps a current-session selector choice when the first active profile arrives", () => {
    setLanguage("it");

    syncProfileLanguage("en", "profile-a");

    expect(getLanguage()).toBe("it");
    expect(getLanguageSnapshot()).toMatchObject({
      language: "it",
      source: "user",
      profileId: "profile-a",
    });
  });

  it("does not let invite language override an account or profile language", () => {
    setAccountLanguage("en");
    setBootstrapLanguage("pt");

    expect(getLanguage()).toBe("en");
    expect(getLanguageSnapshot().source).toBe("account");
  });

  it("keeps health quick cards localized for supported account languages", () => {
    const expected = {
      en: ["Quick access", "Symptoms", "Medication", "Vitals", "Reports"],
      es: ["Acceso rápido", "Síntomas", "Medicación", "Constantes", "Informes"],
      fr: ["Accès rapide", "Symptômes", "Médicaments", "Constantes", "Rapports"],
      de: ["Schnellzugriff", "Symptome", "Medikamente", "Vitalwerte", "Berichte"],
      it: ["Accesso rapido", "Sintomi", "Farmaci", "Parametri", "Report"],
      pt: ["Acesso rápido", "Sintomas", "Medicação", "Sinais vitais", "Relatórios"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.quickAccess"),
        translate(language as keyof typeof expected, "health.quickTiles.symptoms.label"),
        translate(language as keyof typeof expected, "health.quickTiles.medication.label"),
        translate(language as keyof typeof expected, "health.quickTiles.status.label"),
        translate(language as keyof typeof expected, "health.quickTiles.reports.label"),
      ]).toEqual(labels);
    }
  });

  it("keeps the home-style Health page labels localized", () => {
    const expected = {
      en: ["or explore a topic", "My Symptoms", "My Medication", "My Vitals", "Longevity", "Fast help", "My Reports", "Visual Health Scan", "Ask Expert"],
      es: ["o explora un tema", "Mis sintomas", "Mi medicacion", "Mis signos vitales", "Mi plan de salud", "Ayuda rapida", "Mis informes", "Escaneo visual de salud", "Encontrar especialista"],
      fr: ["ou explorez un sujet", "Mes symptomes", "Mes medicaments", "Mes constantes", "Mon plan de sante", "Aide rapide", "Mes rapports", "Scan visuel de sante", "Trouver un specialiste"],
      de: ["oder ein Thema erkunden", "Meine Symptome", "Meine Medikamente", "Meine Vitalwerte", "Mein Gesundheitsplan", "Schnelle Hilfe", "Meine Berichte", "Visueller Gesundheitscheck", "Spezialisten finden"],
      it: ["oppure esplora un tema", "I miei sintomi", "I miei farmaci", "I miei parametri", "Il mio piano salute", "Aiuto rapido", "I miei report", "Scansione visiva salute", "Trova uno specialista"],
      pt: ["ou explore um tema", "Os meus sintomas", "A minha medicacao", "Os meus sinais vitais", "O meu plano de saude", "Ajuda rapida", "Os meus relatorios", "Analise visual de saude", "Encontrar especialista"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.whatNow"),
        translate(language as keyof typeof expected, "health.homeCards.symptoms.label"),
        translate(language as keyof typeof expected, "health.homeCards.medication.label"),
        translate(language as keyof typeof expected, "health.homeCards.vitals.label"),
        translate(language as keyof typeof expected, "health.homeCards.healthPlan.label"),
        translate(language as keyof typeof expected, "health.fastHelp.kicker"),
        translate(language as keyof typeof expected, "health.fastHelp.reports.label"),
        translate(language as keyof typeof expected, "health.fastHelp.visualScan.label"),
        translate(language as keyof typeof expected, "health.fastHelp.specialist.label"),
      ]).toEqual(labels);
    }
  });

  it("keeps compact Health mobile labels localized", () => {
    const expected = {
      en: ["Talk to doctor", "Symptoms", "Medication", "Vitals", "Longevity", "Need help now?", "Recent summaries", "Image review", "VYVA experts"],
      es: ["Hablar con medico", "Sintomas", "Medicacion", "Signos", "Plan salud", "Necesitas ayuda?", "Resumenes recientes", "Revision de imagen", "Experto adecuado"],
      fr: ["Parler au medecin", "Symptomes", "Medicaments", "Constantes", "Plan sante", "Besoin d'aide?", "Resumes recents", "Revue image", "Bon expert"],
      de: ["Arzt sprechen", "Symptome", "Medikamente", "Vitalwerte", "Plan", "Jetzt Hilfe?", "Aktuelle Berichte", "Bild prufen", "Passender Experte"],
      it: ["Parla col medico", "Sintomi", "Farmaci", "Parametri", "Piano salute", "Serve aiuto?", "Riepiloghi recenti", "Revisione immagine", "Esperto giusto"],
      pt: ["Falar com medico", "Sintomas", "Medicacao", "Sinais vitais", "Plano saude", "Precisa de ajuda?", "Resumos recentes", "Rever imagem", "Especialista certo"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.talkToDoctorMobile"),
        translate(language as keyof typeof expected, "health.homeCards.symptoms.mobileLabel"),
        translate(language as keyof typeof expected, "health.homeCards.medication.mobileLabel"),
        translate(language as keyof typeof expected, "health.homeCards.vitals.mobileLabel"),
        translate(language as keyof typeof expected, "health.homeCards.healthPlan.mobileLabel"),
        translate(language as keyof typeof expected, "health.fastHelp.titleMobile"),
        translate(language as keyof typeof expected, "health.fastHelp.reports.subMobile"),
        translate(language as keyof typeof expected, "health.fastHelp.visualScan.subMobile"),
        translate(language as keyof typeof expected, "health.fastHelp.specialist.subMobile"),
      ]).toEqual(labels);
    }
  });

  it("keeps bottom navigation labels localized for supported account languages", () => {
    const expected = {
      en: "My Reports",
      es: "Mis informes",
      fr: "Mes rapports",
      de: "Meine Berichte",
      it: "I miei report",
      pt: "Os meus relatórios",
    } as const;

    for (const [language, reportsLabel] of Object.entries(expected)) {
      expect(translate(language as keyof typeof expected, "nav.reports")).toBe(reportsLabel);
    }
  });

  it("keeps Relax & Breathe page copy localized without falling back to English", () => {
    const expected = {
      es: ["Relajarse y respirar", "Iniciar guia de Marco", "Respira despacio"],
      fr: ["Se detendre et respirer", "Demarrer le guide Marco", "Respirer lentement"],
      it: ["Rilassati e respira", "Avvia guida Marco", "Respira lentamente"],
      pt: ["Relaxe e respire", "Iniciar guia Marco", "Respirar devagar"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      const actual = [
        translate(language as keyof typeof expected, "activities.relaxBreathe.title"),
        translate(language as keyof typeof expected, "activities.relaxBreathe.startGuide"),
        translate(language as keyof typeof expected, "activities.relaxBreathe.stages.breathe.title"),
      ];

      expect(actual).toEqual(labels);
      expect(actual).not.toContain("Relax & Breathe");
      expect(actual).not.toContain("Start Marco guide");
      expect(actual).not.toContain("Breathe slowly");
    }
  });

  it("keeps SOS direct call actions localized for supported account languages", () => {
    const expected = {
      en: ["Need urgent help?", "Call {{number}} now", "Call {{name}}"],
      es: ["Necesitas ayuda urgente?", "Llamar a {{number}} ahora", "Llamar a {{name}}"],
      fr: ["Besoin d'aide urgente ?", "Appeler {{number}} maintenant", "Appeler {{name}}"],
      de: ["Brauchen Sie dringend Hilfe?", "{{number}} jetzt anrufen", "{{name}} anrufen"],
      it: ["Hai bisogno di aiuto urgente?", "Chiama {{number}} ora", "Chiama {{name}}"],
      pt: ["Precisa de ajuda urgente?", "Ligar para {{number}} agora", "Ligar a {{name}}"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "sos.title"),
        translate(language as keyof typeof expected, "sos.callEmergencyNumber"),
        translate(language as keyof typeof expected, "sos.callContact"),
      ]).toEqual(labels);
    }
  });

  it("keeps medication service actions localized for supported account languages", () => {
    const expected = {
      en: ["Check refill need", "Check interactions", "Doctor help"],
      es: ["Revisar necesidad de reposicion", "Revisar interacciones", "Ayuda medica"],
      fr: ["Verifier le besoin de renouvellement", "Verifier interactions", "Aide medecin"],
      de: ["Nachfuellbedarf pruefen", "Wechselwirkungen prufen", "Arzthilfe"],
      it: ["Verifica la necessita di rifornimento", "Controlla interazioni", "Aiuto medico"],
      pt: ["Verificar necessidade de reposicao", "Verificar interacoes", "Ajuda medica"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "meds.refillSupport"),
        translate(language as keyof typeof expected, "meds.interactionSupport"),
        translate(language as keyof typeof expected, "meds.doctorReview"),
      ]).toEqual(labels);
    }
  });

  it("keeps official medication update evidence and confirmation copy localized", () => {
    const expectedTitles = {
      en: "Medication updates",
      es: "Actualizaciones de medicacion",
      fr: "Actualites des medicaments",
      de: "Medikamenten-Aktualisierungen",
      it: "Aggiornamenti sui farmaci",
      pt: "Atualizacoes de medicamentos",
    } as const;

    for (const [language, title] of Object.entries(expectedTitles)) {
      const code = language as keyof typeof expectedTitles;
      expect(translate(code, "meds.updates.title")).toBe(title);
      expect(translate(code, "meds.updates.kind.recall")).not.toBe("meds.updates.kind.recall");
      expect(translate(code, "meds.updates.kind.safety_warning")).not.toBe("meds.updates.kind.safety_warning");
      expect(translate(code, "meds.updates.kind.availability_change")).not.toBe("meds.updates.kind.availability_change");
      expect(translate(code, "meds.updates.kind.general_information")).not.toBe("meds.updates.kind.general_information");
      expect(translate(code, "meds.updates.verification.not_verified")).not.toBe("meds.updates.verification.not_verified");
      expect(translate(code, "meds.updates.verificationReason.formulation_unconfirmed")).not.toBe("meds.updates.verificationReason.formulation_unconfirmed");
      expect(translate(code, "meds.updates.freshness.stale")).not.toBe("meds.updates.freshness.stale");
      expect(translate(code, "meds.updates.openSource")).not.toBe("meds.updates.openSource");
      expect(translate(code, "meds.updates.noMedicinesTitle")).not.toBe("meds.updates.noMedicinesTitle");
      expect(translate(code, "meds.updates.confirmText")).not.toBe("meds.updates.confirmText");
      expect(translate(code, "meds.updates.prepareAppointment")).not.toBe("meds.updates.prepareAppointment");
    }
  });

  it("keeps adherence report service actions localized for supported account languages", () => {
    const expected = {
      en: ["Medication help in one tap", "Check refill need", "Medication appointment"],
      es: ["Ayuda de medicacion en un toque", "Revisar necesidad de reposicion", "Cita de medicacion"],
      fr: ["Aide medicaments en un geste", "Verifier le besoin de renouvellement", "Rendez-vous medicaments"],
      de: ["Medikamentenhilfe mit einem Tipp", "Nachfuellbedarf pruefen", "Medikamententermin"],
      it: ["Aiuto farmaci in un tocco", "Verifica la necessita di rifornimento", "Appuntamento farmaci"],
      pt: ["Ajuda com medicacao num toque", "Verificar necessidade de reposicao", "Consulta de medicacao"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "meds.adherenceService.title"),
        translate(language as keyof typeof expected, "meds.adherenceService.refill"),
        translate(language as keyof typeof expected, "meds.adherenceService.appointment"),
      ]).toEqual(labels);
    }
  });

  it("keeps reports overview service actions localized for supported account languages", () => {
    const expected = {
      en: ["Fast service access", "Review vitals", "Check refill need", "Find transport"],
      es: ["Acceso rapido a servicios", "Revisar constantes", "Revisar necesidad de reposicion", "Buscar transporte"],
      fr: ["Acces rapide aux services", "Voir constantes", "Verifier le renouvellement", "Trouver transport"],
      de: ["Schneller Servicezugang", "Vitalwerte ansehen", "Nachfuellbedarf pruefen", "Transport finden"],
      it: ["Accesso rapido ai servizi", "Vedi parametri", "Verifica rifornimento", "Trova trasporto"],
      pt: ["Acesso rapido a servicos", "Ver sinais vitais", "Verificar necessidade de reposicao", "Encontrar transporte"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "informes.fastServiceAccess"),
        translate(language as keyof typeof expected, "informes.actions.reviewVitals"),
        translate(language as keyof typeof expected, "informes.actions.prepareRefill"),
        translate(language as keyof typeof expected, "informes.actions.bookRide"),
      ]).toEqual(labels);
    }
  });

  it("keeps safe-home service actions localized for supported account languages", () => {
    const expected = {
      en: ["Order safety aids", "Request quote"],
      es: ["Pedir ayudas de seguridad", "Pedir presupuesto"],
      fr: ["Commander aides securite", "Demander un devis"],
      de: ["Sicherheitshilfen bestellen", "Angebot anfragen"],
      it: ["Ordina aiuti sicurezza", "Richiedi preventivo"],
      pt: ["Encomendar ajudas de seguranca", "Pedir orcamento"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "safeHome.actions.orderAids"),
        translate(language as keyof typeof expected, "safeHome.actions.requestQuote"),
      ]).toEqual(labels);
    }
  });

  it("keeps visual scan service actions localized for supported account languages", () => {
    const expected = {
      en: ["Doctor help", "Appointment", "Find transport"],
      es: ["Ayuda medica", "Cita", "Buscar transporte"],
      fr: ["Aide medecin", "Rendez-vous", "Trouver transport"],
      de: ["Arzthilfe", "Termin", "Transport finden"],
      it: ["Aiuto medico", "Appuntamento", "Trova trasporto"],
      pt: ["Ajuda medica", "Consulta", "Encontrar transporte"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.scanWound.actions.doctorHelp"),
        translate(language as keyof typeof expected, "health.scanWound.actions.appointment"),
        translate(language as keyof typeof expected, "health.scanWound.actions.ride"),
      ]).toEqual(labels);
    }
  });

  it("keeps doctor quick service actions localized for supported account languages", () => {
    const expected = {
      en: ["Fast service access", "Call {{name}}", "Book appointment", "Find transport"],
      es: ["Acceso rapido a servicios", "Llamar a {{name}}", "Pedir cita", "Buscar transporte"],
      fr: ["Acces rapide aux services", "Appeler {{name}}", "Prendre rendez-vous", "Trouver transport"],
      de: ["Schneller Servicezugang", "{{name}} anrufen", "Termin buchen", "Transport finden"],
      it: ["Accesso rapido ai servizi", "Chiama {{name}}", "Prenota visita", "Trova trasporto"],
      pt: ["Acesso rapido a servicos", "Ligar a {{name}}", "Marcar consulta", "Encontrar transporte"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.doctorChoice.quickActions.title"),
        translate(language as keyof typeof expected, "health.doctorChoice.quickActions.callGp"),
        translate(language as keyof typeof expected, "health.doctorChoice.quickActions.bookAppointment"),
        translate(language as keyof typeof expected, "health.doctorChoice.quickActions.bookRide"),
      ]).toEqual(labels);
    }
  });

  it("keeps health-home doctor access actions localized for supported account languages", () => {
    const expected = {
      en: ["Doctor access", "Call GP", "Book appointment", "Find transport", "Add GP contact"],
      es: ["Acceso medico", "Llamar al medico", "Pedir cita", "Buscar transporte", "Anadir contacto medico"],
      fr: ["Acces medecin", "Appeler le medecin", "Prendre rendez-vous", "Trouver transport", "Ajouter contact medecin"],
      de: ["Arztzugang", "Arzt anrufen", "Termin buchen", "Transport finden", "Arztkontakt hinzufuegen"],
      it: ["Accesso medico", "Chiama medico", "Prenota visita", "Trova trasporto", "Aggiungi medico"],
      pt: ["Acesso medico", "Ligar ao medico", "Marcar consulta", "Encontrar transporte", "Adicionar medico"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.seeDoctor.actions.title"),
        translate(language as keyof typeof expected, "health.seeDoctor.actions.callGp"),
        translate(language as keyof typeof expected, "health.seeDoctor.actions.bookAppointment"),
        translate(language as keyof typeof expected, "health.seeDoctor.actions.bookTransport"),
        translate(language as keyof typeof expected, "health.seeDoctor.actions.addGp"),
      ]).toEqual(labels);
    }
  });

  it("keeps specialist service actions localized for supported account languages", () => {
    const expected = {
      en: ["Call", "Appointment", "Find transport", "Map", "Share", "Search local specialists"],
      es: ["Llamar", "Cita", "Buscar transporte", "Mapa", "Compartir", "Buscar especialistas"],
      fr: ["Appeler", "Rendez-vous", "Trouver transport", "Carte", "Partager", "Rechercher specialistes"],
      de: ["Anrufen", "Termin", "Transport finden", "Karte", "Teilen", "Fachaerzte suchen"],
      it: ["Chiama", "Appuntamento", "Trova trasporto", "Mappa", "Condividi", "Cerca specialisti"],
      pt: ["Ligar", "Consulta", "Encontrar transporte", "Mapa", "Partilhar", "Pesquisar especialistas"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.findSpecialist.call"),
        translate(language as keyof typeof expected, "health.findSpecialist.bookAppointment"),
        translate(language as keyof typeof expected, "health.findSpecialist.bookRide"),
        translate(language as keyof typeof expected, "health.findSpecialist.map"),
        translate(language as keyof typeof expected, "health.findSpecialist.share"),
        translate(language as keyof typeof expected, "health.findSpecialist.searchButton"),
      ]).toEqual(labels);
    }
  });

  it("keeps symptom report status labels localized for supported account languages", () => {
    const expected = {
      en: ["Report not saved", "Initial Assessment", "Monitor at home, with doctor access ready", "Share with doctor", "No doctor contact in profile"],
      es: ["Informe no guardado", "Evaluación inicial", "Vigila en casa, con medico disponible", "Compartir con medico", "Sin contacto medico en perfil"],
      fr: ["Rapport non enregistre", "Évaluation initiale", "Surveillez a domicile, avec un medecin pret a etre contacte", "Partager avec le medecin", "Aucun contact medecin dans le profil"],
      de: ["Bericht nicht gespeichert", "Erste Einschätzung", "Zu Hause beobachten, Arztkontakt bereithalten", "Mit Arzt teilen", "Kein Arztkontakt im Profil"],
      it: ["Report non salvato", "Valutazione iniziale", "Monitora a casa, con accesso al medico pronto", "Condividi col medico", "Nessun contatto medico nel profilo"],
      pt: ["Relatorio nao guardado", "Avaliação inicial", "Monitorize em casa, com acesso ao medico pronto", "Partilhar com medico", "Sem contacto medico no perfil"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.symptomCheck.report.saveFailed"),
        translate(language as keyof typeof expected, "health.symptomCheck.report.whyThisStep"),
        translate(language as keyof typeof expected, "health.symptomCheck.report.nextStepMonitorReady"),
        translate(language as keyof typeof expected, "health.symptomCheck.report.shareWithDoctor"),
        translate(language as keyof typeof expected, "health.symptomCheck.report.noDoctorToShare"),
      ]).toEqual(labels);
    }
  });

  it("localizes the completed voice-report recovery screen for every supported account language", () => {
    const expected = {
      en: ["Your check is complete", "Try loading again", "Open My Reports", "Done"],
      es: ["Tu revisión ha terminado", "Intentar cargar de nuevo", "Abrir Mis informes", "Terminar"],
      fr: ["Votre vérification est terminée", "Réessayer de charger", "Ouvrir Mes rapports", "Terminer"],
      de: ["Ihre Prüfung ist abgeschlossen", "Erneut laden", "Meine Berichte öffnen", "Fertig"],
      it: ["Il controllo è terminato", "Prova a caricare di nuovo", "Apri I miei rapporti", "Fine"],
      pt: ["A sua verificação terminou", "Tentar carregar novamente", "Abrir Os meus relatórios", "Concluir"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.symptomCheck.voiceReport.completeTitle"),
        translate(language as keyof typeof expected, "health.symptomCheck.voiceReport.retry"),
        translate(language as keyof typeof expected, "health.symptomCheck.voiceReport.openReports"),
        translate(language as keyof typeof expected, "health.symptomCheck.voiceReport.done"),
      ]).toEqual(labels);
    }
  });

  it("keeps every French Ask Dr. AI surface shown in the canonical flow localized", () => {
    const expected = {
      "health.symptomCheck.intro.emergencyTitle": "N’attendez pas en cas d’urgence",
      "health.symptomCheck.intro.emergencyCall": "Appeler les services d’urgence",
      "health.symptomCheck.intro.emergencyContinue": "Continuer avec Dr AI",
      "health.symptomCheck.presentation.severity.helper": "0 signifie aucune gêne. 10 correspond à l’intensité maximale imaginable.",
      "health.symptomCheck.chat.continue": "Continuer",
      "health.symptomCheck.chat.severityNone": "Aucune",
      "health.symptomCheck.chat.severityWorst": "Intensité maximale imaginable",
      "health.symptomCheck.chat.addQuickReading": "Ajouter une mesure rapide",
      "health.symptomCheck.chat.optional": "Facultatif",
      "health.symptomCheck.report.watchFor": "À surveiller",
      "health.symptomCheck.report.resultDetails": "Détails du résultat",
      "health.symptomCheck.report.resultDetailsSubCompact": "Raisons, contexte et partage",
      "health.symptomCheck.report.returnToHealth": "Retour à Ma santé",
      "health.symptomCheck.report.shareShort": "Partager",
    } as const;

    for (const [key, label] of Object.entries(expected)) {
      expect(translate("fr", key)).toBe(label);
    }
  });

  it("localizes the Ask Dr. AI flow title for every supported account language", () => {
    const expected = {
      en: "Ask Dr. AI",
      es: "Pregunta al Dr. IA",
      fr: "Demandez au Dr IA",
      de: "Dr. KI fragen",
      it: "Chiedi al Dr. IA",
      pt: "Pergunte ao Dr. IA",
    } as const;

    for (const [language, label] of Object.entries(expected)) {
      expect(translate(language as keyof typeof expected, "health.symptomCheck.title")).toBe(label);
    }
  });

  it("keeps symptom doctor contact action localized for supported account languages", () => {
    const expected = {
      en: "Add doctor contact",
      es: "Anadir contacto medico",
      fr: "Ajouter le contact medecin",
      de: "Arztkontakt hinzufuegen",
      it: "Aggiungi contatto medico",
      pt: "Adicionar contacto medico",
    } as const;

    for (const [language, label] of Object.entries(expected)) {
      expect(translate(language as keyof typeof expected, "health.symptomCheck.report.addDoctorContact")).toBe(label);
    }
  });

  it("keeps symptom confidence tracker localized for supported account languages", () => {
    const expected = {
      en: ["Confidence level", "Confidence improving", "VYVA is checking symptoms and safety signs", "Symptoms", "Safety check", "Next step"],
      es: ["Nivel de confianza", "La confianza mejora", "VYVA revisa sintomas y senales de seguridad", "Sintomas", "Control de seguridad", "Siguiente paso"],
      fr: ["Niveau de confiance", "La confiance augmente", "VYVA verifie les symptomes et les signes de securite", "Symptomes", "Controle securite", "Prochaine etape"],
      de: ["Vertrauensniveau", "Vertrauen steigt", "VYVA prueft Symptome und Sicherheitssignale", "Symptome", "Sicherheitscheck", "Naechster Schritt"],
      it: ["Livello di fiducia", "Fiducia in aumento", "VYVA controlla sintomi e segnali di sicurezza", "Sintomi", "Controllo sicurezza", "Prossimo passo"],
      pt: ["Nivel de confianca", "A confianca aumenta", "A VYVA verifica sintomas e sinais de seguranca", "Sintomas", "Verificacao seguranca", "Proximo passo"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.label"),
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.building"),
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.checking"),
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.listen"),
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.check"),
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.nextStep"),
      ]).toEqual(labels);
    }
  });

  it("keeps symptom chat confidence cues localized for supported account languages", () => {
    const expected = {
      en: ["One question at a time", "Current question", "{{count}} answers saved", "Choose the closest answer, or type in your own words."],
      es: ["Una pregunta cada vez", "Pregunta actual", "{{count}} respuestas guardadas", "Elige la respuesta mas cercana o escribe con tus palabras."],
      fr: ["Une question a la fois", "Question actuelle", "{{count}} reponses enregistrees", "Choisissez la reponse la plus proche ou ecrivez avec vos mots."],
      de: ["Eine Frage nach der anderen", "Aktuelle Frage", "{{count}} Antworten gespeichert", "Waehle die passendste Antwort oder schreibe mit eigenen Worten."],
      it: ["Una domanda alla volta", "Domanda attuale", "{{count}} risposte salvate", "Scegli la risposta piu vicina o scrivi con parole tue."],
      pt: ["Uma pergunta de cada vez", "Pergunta atual", "{{count}} respostas guardadas", "Escolha a resposta mais proxima ou escreva pelas suas palavras."],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.symptomCheck.chat.oneQuestion"),
        translate(language as keyof typeof expected, "health.symptomCheck.chat.currentQuestion"),
        translate(language as keyof typeof expected, "health.symptomCheck.chat.answersSaved"),
        translate(language as keyof typeof expected, "health.symptomCheck.chat.startAnswering"),
      ]).toEqual(labels);
    }
  });

  it("keeps symptom intro voice controls localized for supported account languages", () => {
    const expected = {
      en: ["Use voice input", "Stop voice input", "Listening... tap again to stop. It stops after 30 seconds.", "I couldn't use the microphone. Please try again or type instead."],
      es: ["Usar voz", "Detener voz", "Escuchando... toca otra vez para parar. Se detiene a los 30 segundos.", "No he podido usar el microfono. Intentalo de nuevo o escribe."],
      fr: ["Utiliser la voix", "Arreter la voix", "Ecoute... touchez encore pour arreter. Arret automatique apres 30 secondes.", "Je n'ai pas pu utiliser le micro. Reessayez ou ecrivez."],
      de: ["Spracheingabe verwenden", "Spracheingabe stoppen", "Hoere zu... erneut tippen zum Stoppen. Stoppt automatisch nach 30 Sekunden.", "Ich konnte das Mikrofon nicht verwenden. Bitte erneut versuchen oder tippen."],
      it: ["Usa voce", "Ferma voce", "Ascolto... tocca ancora per fermare. Si ferma dopo 30 secondi.", "Non sono riuscita a usare il microfono. Riprova o scrivi."],
      pt: ["Usar voz", "Parar voz", "A ouvir... toque outra vez para parar. Para apos 30 segundos.", "Nao consegui usar o microfone. Tente de novo ou escreva."],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.symptomCheck.intro.voiceStart"),
        translate(language as keyof typeof expected, "health.symptomCheck.intro.voiceStop"),
        translate(language as keyof typeof expected, "health.symptomCheck.intro.voiceRecording"),
        translate(language as keyof typeof expected, "health.symptomCheck.intro.voiceMicError"),
      ]).toEqual(labels);
    }
  });

  it("keeps symptom intro prompt copy concise across supported account languages", () => {
    const expected = {
      en: ["Say or type a few words.", "One question at a time", "Speak, type, or tap a suggestion."],
      es: ["Di o escribe unas palabras.", "Una pregunta cada vez", "Habla, escribe o toca una sugerencia."],
      fr: ["Dites ou ecrivez quelques mots.", "Une question a la fois", "Parlez, ecrivez ou touchez une suggestion."],
      de: ["Sag oder schreibe ein paar Worte.", "Eine Frage nach der anderen", "Sprich, tippe oder waehle einen Vorschlag."],
      it: ["Di o scrivi poche parole.", "Una domanda alla volta", "Parla, scrivi o tocca un suggerimento."],
      pt: ["Diga ou escreva algumas palavras.", "Uma pergunta de cada vez", "Fale, escreva ou toque numa sugestao."],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.symptomCheck.intro.clueSub"),
        translate(language as keyof typeof expected, "health.symptomCheck.intro.oneQuestionTitle"),
        translate(language as keyof typeof expected, "health.symptomCheck.intro.oneQuestionBody"),
      ]).toEqual(labels);
    }
  });

  it("keeps scam guard action buttons localized for supported account languages", () => {
    const expected = {
      en: ["Quick safe actions", "Call {{name}}", "Get safe help", "Call guidance"],
      es: ["Acciones seguras", "Llamar a {{name}}", "Ayuda segura", "Guia por llamada"],
      fr: ["Actions sures", "Appeler {{name}}", "Aide sure", "Aide par appel"],
      de: ["Sichere Schnellaktionen", "{{name}} anrufen", "Sichere Hilfe", "Anrufhilfe"],
      it: ["Azioni sicure", "Chiama {{name}}", "Aiuto sicuro", "Guida in chiamata"],
      pt: ["Acoes seguras", "Ligar a {{name}}", "Ajuda segura", "Orientacao por chamada"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "scamGuard.actions.title"),
        translate(language as keyof typeof expected, "scamGuard.actions.callTrusted"),
        translate(language as keyof typeof expected, "scamGuard.actions.safeHelp"),
        translate(language as keyof typeof expected, "scamGuard.actions.callGuidance"),
      ]).toEqual(labels);
    }
  });

  it("keeps Show VYVA follow-up actions localized for supported account languages", () => {
    const expected = {
      en: ["Next safe step", "Next scam-safe step", "Check company", "Compare nearby"],
      es: ["Siguiente paso seguro", "Siguiente paso contra estafas", "Revisar empresa", "Comparar cerca"],
      fr: ["Prochaine etape sure", "Prochaine etape anti-arnaque", "Verifier entreprise", "Comparer proche"],
      de: ["Nachster sicherer Schritt", "Nachster Betrugsschutz-Schritt", "Firma prufen", "Nahe vergleichen"],
      it: ["Prossimo passo sicuro", "Prossimo passo anti-truffa", "Controlla azienda", "Confronta vicino"],
      pt: ["Proximo passo seguro", "Proximo passo anti-burla", "Verificar empresa", "Comparar perto"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "showVyva.followUp.kicker"),
        translate(language as keyof typeof expected, "showVyva.followUp.title.scam"),
        translate(language as keyof typeof expected, "showVyva.followUp.action.check_company.label"),
        translate(language as keyof typeof expected, "showVyva.followUp.action.compare_proximity.label"),
      ]).toEqual(labels);
    }
  });

  it("keeps concierge card mobile labels compact across supported account languages", () => {
    const expected = {
      en: ["Help", "Ride", "Order", "Schedule"],
      es: ["Ayuda", "Taxi", "Pedido", "Cita"],
      fr: ["Aide", "Trajet", "Repas", "RDV"],
      de: ["Hilfe", "Fahrt", "Essen", "Termin"],
      it: ["Aiuto", "Taxi", "Ordine", "Visita"],
      pt: ["Ajuda", "Taxi", "Pedido", "Visita"],
    } as const;

    const keys = [
      "concierge.primaryCards.service.mobile",
      "concierge.primaryCards.ride.mobile",
      "concierge.primaryCards.delivery.mobile",
      "concierge.primaryCards.appointment.mobile",
    ];

    for (const [language, labels] of Object.entries(expected)) {
      expect(keys.map((key) => translate(language as keyof typeof expected, key))).toEqual(labels);
      expect(labels.every((label) => label.length <= 8)).toBe(true);
    }
  });

  it("keeps contextual Home Fast Help reasons localized in every supported language", () => {
    const reasonKeys = Object.keys(HOME_FAST_HELP_REASON_FALLBACKS);

    for (const language of SUPPORTED_TEST_LANGUAGES) {
      for (const reasonKey of reasonKeys) {
        const key = `home.contextualFastHelp.reasons.${reasonKey}`;
        const value = translate(language, key);
        expect(value).not.toBe(key);
        expect(value.trim().length).toBeGreaterThan(0);
        if (language !== "en") expect(value).not.toBe(translate("en", key));
      }
    }
  });

  it("keeps Home Fast Help outcome copy localized in every supported language", () => {
    const outcomeKeys = ["continue", "continueDetail", "blockedAlternative"];

    for (const language of SUPPORTED_TEST_LANGUAGES) {
      for (const outcomeKey of outcomeKeys) {
        const key = `home.contextualFastHelp.outcome.${outcomeKey}`;
        const value = translate(language, key);
        expect(value).not.toBe(key);
        expect(value.trim().length).toBeGreaterThan(0);
        if (language !== "en") expect(value).not.toBe(translate("en", key));
      }
    }
  });

  it("keeps daily check-in home card copy localized for supported account languages", () => {
    const expected = {
      en: ["Daily check-in", "Checked in today", "How are you today?", "VYVA has today's signal.", "Longevity", "Longevity"],
      es: ["Control diario", "Hecho hoy", "Como estas hoy?", "VYVA tiene la senal de hoy.", "Mi plan de salud", "Mi plan de salud"],
      fr: ["Contrôle quotidien", "Contrôle fait aujourd'hui", "Comment allez-vous ?", "VYVA a le signal du jour.", "Mon plan de sante", "Mon plan de sante"],
      de: ["Taglicher Check", "Heute erledigt", "Wie geht es dir heute?", "VYVA hat das heutige Signal.", "Mein Gesundheitsplan", "Mein Gesundheitsplan"],
      it: ["Check-in quotidiano", "Fatto oggi", "Come ti senti oggi?", "VYVA ha il segnale di oggi.", "Il mio piano salute", "Il mio piano salute"],
      pt: ["Check-in diario", "Feito hoje", "Como se sente hoje?", "A VYVA tem o sinal de hoje.", "Meu plano de saude", "Meu plano de saude"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.dailyCheckin.kicker"),
        translate(language as keyof typeof expected, "health.dailyCheckin.completed"),
        translate(language as keyof typeof expected, "health.dailyCheckin.title"),
        translate(language as keyof typeof expected, "health.dailyCheckin.messages.completed"),
        translate(language as keyof typeof expected, "health.dailyCheckin.history"),
        translate(language as keyof typeof expected, "health.dailyCheckin.actions.viewHistory"),
      ]).toEqual(labels);
    }
  });

  it("keeps settings home rows localized for supported account languages", () => {
    const keys = [
      "settings.home.rows.myAccount",
      "settings.home.rows.notifications",
      "settings.home.rows.scheduledSupport",
      "settings.home.rows.healthProfile",
      "settings.home.rows.privacyConsent",
    ];
    const expected = {
      en: ["My account", "Notifications & contact", "Scheduled support", "General Profile", "Privacy & consent"],
      es: ["Mi cuenta", "Notificaciones y contacto", "Mi apoyo programado", "Perfil general", "Privacidad y consentimiento"],
      fr: ["Mon compte", "Notifications et contact", "Mon soutien programmé", "Profil général", "Confidentialité et consentement"],
      de: ["Mein Konto", "Benachrichtigungen & Kontakt", "Geplante Unterstützung", "Allgemeines Profil", "Datenschutz & Einwilligung"],
      it: ["Il mio account", "Notifiche e contatti", "Supporto programmato", "Profilo generale", "Privacy e consenso"],
      pt: ["Minha conta", "Notificações e contato", "Apoio programado", "Perfil geral", "Privacidade e consentimento"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect(keys.map((key) => translate(language as keyof typeof expected, key))).toEqual(labels);
    }
  });

  it("keeps notification support mode labels localized for supported account languages", () => {
    const expected = {
      en: ["Support mode", "AI-powered", "Human-supported"],
      es: ["Modo de apoyo", "Con IA", "Con apoyo humano"],
      fr: ["Mode de soutien", "Avec IA", "Avec soutien humain"],
      de: ["Betreuungsmodus", "KI-gestützt", "Menschliche Unterstützung"],
      it: ["Modalità di supporto", "Con IA", "Con supporto umano"],
      pt: ["Modo de apoio", "Com IA", "Com apoio humano"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "settings.notifications.supportMode"),
        translate(language as keyof typeof expected, "settings.notifications.supportModeAi"),
        translate(language as keyof typeof expected, "settings.notifications.supportModeHuman"),
      ]).toEqual(labels);
    }
  });

  it("keeps lesson read-aloud controls localized for every supported app language", () => {
    const keys = [
      "learn.readAloud.play",
      "learn.readAloud.pause",
      "learn.readAloud.resume",
      "learn.readAloud.replay",
      "learn.readAloud.stop",
      "learn.readAloud.unavailableDetail",
      "learn.readAloud.reflectionIntro",
    ];

    for (const language of SUPPORTED_TEST_LANGUAGES) {
      for (const key of keys) {
        expect(translate(language, key), `${language} should translate ${key}`).not.toBe(key);
      }
    }
  });

  it("keeps the Concierge ride Canvas localized for every supported app language", () => {
    const keys = [
      "voiceCanvas.ride.destinationTitle",
      "voiceCanvas.ride.pickupTitle",
      "voiceCanvas.ride.timeTitle",
      "voiceCanvas.ride.mobilityTitle",
      "voiceCanvas.ride.providerTitle",
      "voiceCanvas.ride.confirmTitle",
      "voiceCanvas.ride.confirmContact",
      "voiceCanvas.ride.completedTitle",
    ];

    for (const language of SUPPORTED_TEST_LANGUAGES) {
      for (const key of keys) {
        expect(translate(language, key), `${language} should translate ${key}`).not.toBe(key);
      }
    }
  });

  it("keeps vitals and symptom-check health flows localized for supported account languages", () => {
    const namespaces = [
      "statusVitals",
      "health.symptomCheck.scan",
      "health.symptomCheck.report",
    ];
    const englishKeys = localeKeys("en");

    for (const language of SUPPORTED_TEST_LANGUAGES.filter((code) => code !== "en")) {
      const translatedKeys = localeKeys(language);
      const missingKeys = [...englishKeys].filter((key) => (
        namespaces.some((namespace) => key.startsWith(`${namespace}.`)) && !translatedKeys.has(key)
      ));

      expect(missingKeys, `${language} is missing health translation keys`).toEqual([]);
    }
  });

  it("keeps exposed locale JSON files complete against English", () => {
    const englishKeys = localeKeys("en");

    for (const language of SUPPORTED_TEST_LANGUAGES.filter((code) => code !== "en")) {
      const translatedKeys = localeKeys(language);
      const missingKeys = [...englishKeys].filter((key) => !translatedKeys.has(key));

      expect(missingKeys, `${language} is missing locale keys`).toEqual([]);
    }
  });

  it("keeps live user UI on the central language snapshot", () => {
    const files = [
      ...collectFiles("src/pages"),
      ...collectFiles("src/components"),
      ...collectFiles("src/hooks"),
      ...collectFiles("src/social"),
    ].filter((file) => (
      /\.(ts|tsx)$/.test(file) &&
      !file.includes("/admin/") &&
      !file.endsWith(".test.ts") &&
      !file.endsWith(".test.tsx")
    ));

    const offenders = files
      .filter((file) => readFileSync(file, "utf8").includes("i18n.language"))
      .map((file) => file.replace(/\\/g, "/"));

    expect(offenders).toEqual([]);
  });

  it("keeps settings pages on the shared app language store", () => {
    const settingsSource = collectFiles("src/pages/settings")
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const legacySettingsSource = readFileSync("src/pages/SettingsScreen.tsx", "utf8");

    expect(settingsSource).not.toContain("react-i18next");
    expect(settingsSource).not.toContain("useTranslation(");
    expect(legacySettingsSource).not.toContain("react-i18next");
    expect(legacySettingsSource).not.toContain("useTranslation(");
    expect(legacySettingsSource).not.toContain("i18n.changeLanguage");
    expect(legacySettingsSource).not.toContain("LANGUAGE_STORAGE_KEY");
  });

  it("keeps live health and social screens on the current app language", () => {
    const files = [
      "src/pages/HealthScreen.tsx",
      "src/pages/SignosScreen.tsx",
      "src/pages/CheckHowIFeelScreen.tsx",
      "src/pages/CheckinHistoryScreen.tsx",
      "src/social/SocialHub.tsx",
      "src/social/RoomScreen.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} should not use stale profile language for live UI`).not.toMatch(/profile\??\.language/);
    }
  });
});
