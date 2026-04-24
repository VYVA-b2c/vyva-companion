export type CardCategory = "Quote" | "Fact" | "Tip" | "Achievement" | "Did You Know";
export type SupportedLocale = "en" | "es" | "fr" | "de" | "it" | "pt" | "cy";

export interface CardTranslations {
  text: string;
  attribution?: string;
}

export interface InspirationCard {
  id: string;
  category: CardCategory;
  emoji: string;
  text: string;
  attribution?: string;
  translations?: Partial<Record<SupportedLocale, CardTranslations>>;
}

export const INSPIRATION_CARDS: InspirationCard[] = [
  // ── Quotes ────────────────────────────────────────────────────────────────
  {
    id: "q1",
    category: "Quote",
    emoji: "✨",
    text: "You don't stop laughing when you grow old — you grow old when you stop laughing.",
    attribution: "George Bernard Shaw",
    translations: {
      es: { text: "No dejas de reír cuando envejeces — envejeces cuando dejas de reír.", attribution: "George Bernard Shaw" },
      fr: { text: "On ne s'arrête pas de rire parce qu'on vieillit — on vieillit parce qu'on s'arrête de rire.", attribution: "George Bernard Shaw" },
      de: { text: "Man hört nicht auf zu lachen, wenn man alt wird — man wird alt, wenn man aufhört zu lachen.", attribution: "George Bernard Shaw" },
      it: { text: "Non smetti di ridere quando invecchi — invecchi quando smetti di ridere.", attribution: "George Bernard Shaw" },
      pt: { text: "Você não para de rir quando envelhece — envelhece quando para de rir.", attribution: "George Bernard Shaw" },
      cy: { text: "Nid ydych chi'n rhoi'r gorau i chwerthin pan fyddwch chi'n heneiddio — rydych chi'n heneiddio pan fyddwch chi'n rhoi'r gorau i chwerthin.", attribution: "George Bernard Shaw" },
    },
  },
  {
    id: "q2",
    category: "Quote",
    emoji: "🌿",
    text: "The secret of getting ahead is getting started.",
    attribution: "Mark Twain",
    translations: {
      es: { text: "El secreto para avanzar es empezar.", attribution: "Mark Twain" },
      fr: { text: "Le secret pour avancer, c'est de commencer.", attribution: "Mark Twain" },
      de: { text: "Das Geheimnis des Vorankommens ist der Anfang.", attribution: "Mark Twain" },
      it: { text: "Il segreto per andare avanti è cominciare.", attribution: "Mark Twain" },
      pt: { text: "O segredo para avançar é começar.", attribution: "Mark Twain" },
      cy: { text: "Cyfrinach mynd ymlaen yw dechrau.", attribution: "Mark Twain" },
    },
  },
  {
    id: "q3",
    category: "Quote",
    emoji: "🌅",
    text: "Every day may not be good, but there is something good in every day.",
    attribution: "Alice Morse Earle",
    translations: {
      es: { text: "Puede que no todos los días sean buenos, pero hay algo bueno en cada día.", attribution: "Alice Morse Earle" },
      fr: { text: "Chaque jour n'est peut-être pas bon, mais il y a quelque chose de bon dans chaque jour.", attribution: "Alice Morse Earle" },
      de: { text: "Vielleicht ist nicht jeder Tag gut, aber in jedem Tag steckt etwas Gutes.", attribution: "Alice Morse Earle" },
      it: { text: "Non ogni giorno può essere buono, ma c'è qualcosa di buono in ogni giorno.", attribution: "Alice Morse Earle" },
      pt: { text: "Nem todo dia pode ser bom, mas há algo de bom em cada dia.", attribution: "Alice Morse Earle" },
      cy: { text: "Efallai nad yw pob dydd yn dda, ond mae rhywbeth da ym mhob dydd.", attribution: "Alice Morse Earle" },
    },
  },
  {
    id: "q4",
    category: "Quote",
    emoji: "💛",
    text: "Age is an issue of mind over matter. If you don't mind, it doesn't matter.",
    attribution: "Mark Twain",
    translations: {
      es: { text: "La edad es una cuestión de mente sobre materia. Si no te importa, no importa.", attribution: "Mark Twain" },
      fr: { text: "L'âge est une question d'esprit sur la matière. Si cela ne vous dérange pas, cela ne compte pas.", attribution: "Mark Twain" },
      de: { text: "Das Alter ist eine Frage des Geistes über die Materie. Wenn es dir nichts ausmacht, macht es nichts aus.", attribution: "Mark Twain" },
      it: { text: "L'età è una questione di mente sulla materia. Se non te ne preoccupi, non conta.", attribution: "Mark Twain" },
      pt: { text: "A idade é uma questão de mente sobre matéria. Se você não se importa, não importa.", attribution: "Mark Twain" },
      cy: { text: "Mae oed yn fater o feddwl dros fater. Os nad yw'n poeni arnoch, nid yw'n bwysig.", attribution: "Mark Twain" },
    },
  },
  {
    id: "q5",
    category: "Quote",
    emoji: "🌸",
    text: "Wisdom comes from experience, and experience comes from living fully.",
    translations: {
      es: { text: "La sabiduría viene de la experiencia, y la experiencia de vivir plenamente." },
      fr: { text: "La sagesse vient de l'expérience, et l'expérience vient d'une vie pleinement vécue." },
      de: { text: "Weisheit kommt aus Erfahrung, und Erfahrung kommt vom vollen Leben." },
      it: { text: "La saggezza viene dall'esperienza, e l'esperienza dal vivere pienamente." },
      pt: { text: "A sabedoria vem da experiência, e a experiência vem de viver plenamente." },
      cy: { text: "Daw doethineb o brofiad, a daw profiad o fyw yn llawn." },
    },
  },
  {
    id: "q6",
    category: "Quote",
    emoji: "🕊️",
    text: "Life is not measured by the number of breaths we take, but by the moments that take our breath away.",
    attribution: "Maya Angelou",
    translations: {
      es: { text: "La vida no se mide por la cantidad de respiraciones que damos, sino por los momentos que nos quitan el aliento.", attribution: "Maya Angelou" },
      fr: { text: "La vie ne se mesure pas au nombre de respirations que nous prenons, mais aux moments qui nous coupent le souffle.", attribution: "Maya Angelou" },
      de: { text: "Das Leben wird nicht an der Anzahl der Atemzüge gemessen, die wir nehmen, sondern an den Momenten, die uns den Atem verschlagen.", attribution: "Maya Angelou" },
      it: { text: "La vita non si misura dal numero di respiri che prendiamo, ma dai momenti che ci tolgono il respiro.", attribution: "Maya Angelou" },
      pt: { text: "A vida não é medida pelo número de respirações que damos, mas pelos momentos que nos tiram o fôlego.", attribution: "Maya Angelou" },
      cy: { text: "Nid yw bywyd yn cael ei fesur gan nifer yr anadliadau a gymerwn, ond gan y eiliadau sy'n cymryd ein hanadl i ffwrdd.", attribution: "Maya Angelou" },
    },
  },
  {
    id: "q7",
    category: "Quote",
    emoji: "🌻",
    text: "Keep your face always toward the sunshine, and shadows will fall behind you.",
    attribution: "Walt Whitman",
    translations: {
      es: { text: "Mantén siempre tu rostro hacia el sol y las sombras caerán detrás de ti.", attribution: "Walt Whitman" },
      fr: { text: "Gardez toujours votre visage tourné vers le soleil, et les ombres tomberont derrière vous.", attribution: "Walt Whitman" },
      de: { text: "Halte dein Gesicht immer der Sonne zugewandt, und die Schatten fallen hinter dich.", attribution: "Walt Whitman" },
      it: { text: "Tieni sempre il viso verso il sole e le ombre cadranno dietro di te.", attribution: "Walt Whitman" },
      pt: { text: "Mantenha sempre o rosto voltado para o sol e as sombras ficarão atrás de você.", attribution: "Walt Whitman" },
      cy: { text: "Cadwch eich wyneb bob amser tua'r heulwen, a bydd cysgodion yn syrthio y tu ôl i chi.", attribution: "Walt Whitman" },
    },
  },
  {
    id: "q8",
    category: "Quote",
    emoji: "💪",
    text: "The greatest wealth is health.",
    attribution: "Virgil",
    translations: {
      es: { text: "La mayor riqueza es la salud.", attribution: "Virgilio" },
      fr: { text: "La plus grande richesse, c'est la santé.", attribution: "Virgile" },
      de: { text: "Der größte Reichtum ist Gesundheit.", attribution: "Vergil" },
      it: { text: "La ricchezza più grande è la salute.", attribution: "Virgilio" },
      pt: { text: "A maior riqueza é a saúde.", attribution: "Virgílio" },
      cy: { text: "Y cyfoeth mwyaf yw iechyd.", attribution: "Virgil" },
    },
  },
  {
    id: "q9",
    category: "Quote",
    emoji: "🌼",
    text: "It is not how old you are, but how you are old.",
    attribution: "Jules Renard",
    translations: {
      es: { text: "No importa cuántos años tienes, sino cómo los llevas.", attribution: "Jules Renard" },
      fr: { text: "Ce n'est pas l'âge que vous avez qui compte, c'est comment vous portez cet âge.", attribution: "Jules Renard" },
      de: { text: "Es kommt nicht darauf an, wie alt du bist, sondern wie du alt bist.", attribution: "Jules Renard" },
      it: { text: "Non importa quanti anni hai, ma come li porti.", attribution: "Jules Renard" },
      pt: { text: "Não importa quantos anos você tem, mas como você os carrega.", attribution: "Jules Renard" },
      cy: { text: "Nid pa mor hen ydych chi sy'n bwysig, ond sut rydych chi'n heneiddio.", attribution: "Jules Renard" },
    },
  },
  {
    id: "q10",
    category: "Quote",
    emoji: "🧡",
    text: "Difficult roads often lead to beautiful destinations.",
    translations: {
      es: { text: "Los caminos difíciles a menudo llevan a destinos hermosos." },
      fr: { text: "Les chemins difficiles mènent souvent à de belles destinations." },
      de: { text: "Schwierige Wege führen oft zu wunderschönen Zielen." },
      it: { text: "Le strade difficili portano spesso a destinazioni meravigliose." },
      pt: { text: "Caminhos difíceis muitas vezes levam a destinos belos." },
      cy: { text: "Mae ffyrdd anodd yn aml yn arwain at gyrchfannau hardd." },
    },
  },
  {
    id: "q11",
    category: "Quote",
    emoji: "🌟",
    text: "Do not go where the path may lead; go instead where there is no path and leave a trail.",
    attribution: "Ralph Waldo Emerson",
    translations: {
      es: { text: "No vayas a donde el camino te lleve; ve en cambio donde no hay camino y deja una huella.", attribution: "Ralph Waldo Emerson" },
      fr: { text: "N'allez pas là où le chemin mène ; allez plutôt là où il n'y a pas de chemin et laissez une trace.", attribution: "Ralph Waldo Emerson" },
      de: { text: "Geh nicht dorthin, wo der Weg hinführt; geh stattdessen dorthin, wo kein Weg ist, und hinterlasse eine Spur.", attribution: "Ralph Waldo Emerson" },
      it: { text: "Non andare dove il sentiero può portarti; vai invece dove non c'è sentiero e lascia una traccia.", attribution: "Ralph Waldo Emerson" },
      pt: { text: "Não vá onde o caminho pode levar; vá onde não há caminho e deixe um rastro.", attribution: "Ralph Waldo Emerson" },
      cy: { text: "Peidiwch â mynd i ble mae'r llwybr yn arwain; ewch yn hytrach i ble nad oes llwybr a gadewch ôl.", attribution: "Ralph Waldo Emerson" },
    },
  },
  {
    id: "q12",
    category: "Quote",
    emoji: "☀️",
    text: "The purpose of our lives is to be happy.",
    attribution: "Dalai Lama",
    translations: {
      es: { text: "El propósito de nuestra vida es ser felices.", attribution: "Dalái Lama" },
      fr: { text: "Le but de notre vie est d'être heureux.", attribution: "Dalaï-Lama" },
      de: { text: "Der Sinn unseres Lebens ist es, glücklich zu sein.", attribution: "Dalai Lama" },
      it: { text: "Lo scopo della nostra vita è essere felici.", attribution: "Dalai Lama" },
      pt: { text: "O propósito de nossas vidas é ser feliz.", attribution: "Dalai Lama" },
      cy: { text: "Pwrpas ein bywydau yw bod yn hapus.", attribution: "Dalai Lama" },
    },
  },
  // ── Facts ─────────────────────────────────────────────────────────────────
  {
    id: "f1",
    category: "Fact",
    emoji: "🧠",
    text: "Laughing for 15 minutes a day can burn up to 40 calories — and it's much more fun than exercise!",
    translations: {
      es: { text: "Reír durante 15 minutos al día puede quemar hasta 40 calorías — ¡y es mucho más divertido que el ejercicio!" },
      fr: { text: "Rire pendant 15 minutes par jour peut brûler jusqu'à 40 calories — et c'est bien plus amusant que l'exercice !" },
      de: { text: "15 Minuten Lachen am Tag können bis zu 40 Kalorien verbrennen — und macht viel mehr Spaß als Sport!" },
      it: { text: "Ridere per 15 minuti al giorno può bruciare fino a 40 calorie — ed è molto più divertente dell'esercizio fisico!" },
      pt: { text: "Rir por 15 minutos por dia pode queimar até 40 calorias — e é muito mais divertido do que exercício!" },
      cy: { text: "Gall chwerthin am 15 munud y dydd losgi hyd at 40 calori — ac mae'n llawer mwy o hwyl na ymarfer corff!" },
    },
  },
  {
    id: "f2",
    category: "Fact",
    emoji: "🎵",
    text: "Listening to music you love triggers the release of dopamine — the brain's feel-good chemical.",
    translations: {
      es: { text: "Escuchar música que amas desencadena la liberación de dopamina — el químico del bienestar del cerebro." },
      fr: { text: "Écouter de la musique que vous aimez déclenche la libération de dopamine — le produit chimique du bien-être du cerveau." },
      de: { text: "Musik zu hören, die du liebst, löst die Ausschüttung von Dopamin aus — dem Wohlfühlstoff des Gehirns." },
      it: { text: "Ascoltare la musica che ami innesca il rilascio di dopamina — la sostanza chimica del benessere del cervello." },
      pt: { text: "Ouvir música que você ama desencadeia a liberação de dopamina — o químico do bem-estar do cérebro." },
      cy: { text: "Mae gwrando ar gerddoriaeth rydych chi'n ei charu yn sbarduno rhyddhau dopamin — cemegyn lles yr ymennydd." },
    },
  },
  {
    id: "f3",
    category: "Fact",
    emoji: "🌳",
    text: "Spending just 20 minutes in nature can lower stress hormone levels significantly.",
    translations: {
      es: { text: "Pasar solo 20 minutos en la naturaleza puede reducir significativamente los niveles de hormonas del estrés." },
      fr: { text: "Passer seulement 20 minutes dans la nature peut réduire significativement les niveaux d'hormones de stress." },
      de: { text: "Schon 20 Minuten in der Natur können den Stresshormonspiel erheblich senken." },
      it: { text: "Trascorrere solo 20 minuti nella natura può ridurre significativamente i livelli di ormoni dello stress." },
      pt: { text: "Passar apenas 20 minutos na natureza pode reduzir significativamente os níveis de hormônios do estresse." },
      cy: { text: "Gall treulio dim ond 20 munud mewn natur ostwng lefelau hormonau straen yn sylweddol." },
    },
  },
  {
    id: "f4",
    category: "Fact",
    emoji: "😴",
    text: "A short 20-minute nap can boost alertness and mood for hours without affecting night sleep.",
    translations: {
      es: { text: "Una breve siesta de 20 minutos puede mejorar el estado de alerta y el ánimo durante horas sin afectar el sueño nocturno." },
      fr: { text: "Une courte sieste de 20 minutes peut améliorer la vigilance et l'humeur pendant des heures sans affecter le sommeil nocturne." },
      de: { text: "Ein kurzes 20-minütiges Nickerchen kann die Wachheit und Stimmung für Stunden verbessern, ohne den Nachtschlaf zu beeinträchtigen." },
      it: { text: "Un breve pisolino di 20 minuti può migliorare la vigilanza e l'umore per ore senza influire sul sonno notturno." },
      pt: { text: "Um breve cochilo de 20 minutos pode aumentar o estado de alerta e o humor por horas sem afetar o sono noturno." },
      cy: { text: "Gall cyntun byr o 20 munud hybu effroedd a hwyliau am oriau heb effeithio ar gwsg y nos." },
    },
  },
  {
    id: "f5",
    category: "Fact",
    emoji: "🫁",
    text: "Deep breathing for 5 minutes activates your body's relaxation response and lowers blood pressure.",
    translations: {
      es: { text: "La respiración profunda durante 5 minutos activa la respuesta de relajación del cuerpo y reduce la presión arterial." },
      fr: { text: "La respiration profonde pendant 5 minutes active la réponse de relaxation du corps et abaisse la tension artérielle." },
      de: { text: "Tiefes Atmen für 5 Minuten aktiviert die Entspannungsreaktion des Körpers und senkt den Blutdruck." },
      it: { text: "La respirazione profonda per 5 minuti attiva la risposta di rilassamento del corpo e abbassa la pressione sanguigna." },
      pt: { text: "A respiração profunda por 5 minutos ativa a resposta de relaxamento do corpo e reduz a pressão arterial." },
      cy: { text: "Mae anadlu dwfn am 5 munud yn actifadu ymateb ymlacio eich corff ac yn gostwng pwysedd gwaed." },
    },
  },
  {
    id: "f6",
    category: "Fact",
    emoji: "👥",
    text: "People with strong social connections live, on average, 7 years longer than those who are isolated.",
    translations: {
      es: { text: "Las personas con fuertes conexiones sociales viven, en promedio, 7 años más que las que están aisladas." },
      fr: { text: "Les personnes ayant de fortes connexions sociales vivent, en moyenne, 7 ans de plus que celles qui sont isolées." },
      de: { text: "Menschen mit starken sozialen Verbindungen leben im Durchschnitt 7 Jahre länger als isolierte Menschen." },
      it: { text: "Le persone con forti connessioni sociali vivono, in media, 7 anni in più rispetto a quelle che sono isolate." },
      pt: { text: "Pessoas com fortes conexões sociais vivem, em média, 7 anos a mais do que as que estão isoladas." },
      cy: { text: "Mae pobl â chysylltiadau cymdeithasol cryf yn byw, ar gyfartaledd, 7 mlynedd yn hirach na'r rhai sy'n ynysig." },
    },
  },
  {
    id: "f7",
    category: "Fact",
    emoji: "🐶",
    text: "Petting an animal for just 10 minutes can lower cortisol (stress hormone) by up to 37%.",
    translations: {
      es: { text: "Acariciar un animal durante solo 10 minutos puede reducir el cortisol (hormona del estrés) hasta en un 37%." },
      fr: { text: "Caresser un animal pendant seulement 10 minutes peut réduire le cortisol (hormone du stress) jusqu'à 37%." },
      de: { text: "Schon 10 Minuten ein Tier streicheln kann den Cortisol-Spiegel (Stresshormon) um bis zu 37% senken." },
      it: { text: "Accarezzare un animale per soli 10 minuti può abbassare il cortisolo (ormone dello stress) fino al 37%." },
      pt: { text: "Acariciar um animal por apenas 10 minutos pode reduzir o cortisol (hormônio do estresse) em até 37%." },
      cy: { text: "Gall anwylo anifail am ddim ond 10 munud ostwng cortisol (hormon straen) hyd at 37%." },
    },
  },
  {
    id: "f8",
    category: "Fact",
    emoji: "☕",
    text: "A cup of tea contains L-theanine, an amino acid that promotes calm focus without drowsiness.",
    translations: {
      es: { text: "Una taza de té contiene L-teanina, un aminoácido que promueve la concentración tranquila sin somnolencia." },
      fr: { text: "Une tasse de thé contient de la L-théanine, un acide aminé qui favorise la concentration calme sans somnolence." },
      de: { text: "Eine Tasse Tee enthält L-Theanin, eine Aminosäure, die ruhige Konzentration ohne Schläfrigkeit fördert." },
      it: { text: "Una tazza di tè contiene L-teanina, un aminoacido che promuove la concentrazione calma senza sonnolenza." },
      pt: { text: "Uma xícara de chá contém L-teanina, um aminoácido que promove foco calmo sem sonolência." },
      cy: { text: "Mae cwpan o de yn cynnwys L-theanin, asid amino sy'n hyrwyddo ffocws tawel heb gysglyd." },
    },
  },
  {
    id: "f9",
    category: "Fact",
    emoji: "🎶",
    text: "Singing — even humming to yourself — releases endorphins, oxytocin, and serotonin simultaneously.",
    translations: {
      es: { text: "Cantar — incluso tararear para uno mismo — libera endorfinas, oxitocina y serotonina simultáneamente." },
      fr: { text: "Chanter — même fredonner pour soi-même — libère des endorphines, de l'ocytocine et de la sérotonine simultanément." },
      de: { text: "Singen — sogar Summen für sich selbst — setzt gleichzeitig Endorphine, Oxytocin und Serotonin frei." },
      it: { text: "Cantare — anche canticchiare tra sé — rilascia endorfine, ossitocina e serotonina contemporaneamente." },
      pt: { text: "Cantar — mesmo cantarolar para si mesmo — libera endorfinas, ocitocina e serotonina simultaneamente." },
      cy: { text: "Mae canu — hyd yn oed hymian i chi eich hun — yn rhyddhau endorffinau, ocsitocin, a serotonin ar yr un pryd." },
    },
  },
  {
    id: "f10",
    category: "Fact",
    emoji: "🤸",
    text: "Stretching for just 10 minutes a day improves circulation, flexibility, and mental clarity.",
    translations: {
      es: { text: "Estirarse solo 10 minutos al día mejora la circulación, la flexibilidad y la claridad mental." },
      fr: { text: "S'étirer seulement 10 minutes par jour améliore la circulation, la souplesse et la clarté mentale." },
      de: { text: "Schon 10 Minuten Dehnen am Tag verbessern Durchblutung, Flexibilität und geistige Klarheit." },
      it: { text: "Fare stretching per soli 10 minuti al giorno migliora la circolazione, la flessibilità e la chiarezza mentale." },
      pt: { text: "Alongar-se por apenas 10 minutos por dia melhora a circulação, a flexibilidade e a clareza mental." },
      cy: { text: "Mae ymestyn am ddim ond 10 munud y dydd yn gwella cylchrediad, hyblygrwydd ac eglurder meddyliol." },
    },
  },
  // ── Tips ──────────────────────────────────────────────────────────────────
  {
    id: "t1",
    category: "Tip",
    emoji: "💧",
    text: "Drink a glass of water first thing in the morning — your body loses fluid overnight and rehydrating early boosts energy.",
    translations: {
      es: { text: "Beba un vaso de agua a primera hora de la mañana — su cuerpo pierde líquido durante la noche y rehidratarse temprano aumenta la energía." },
      fr: { text: "Buvez un verre d'eau dès le matin — votre corps perd des liquides la nuit et se réhydrater tôt booste l'énergie." },
      de: { text: "Trinken Sie morgens als Erstes ein Glas Wasser — Ihr Körper verliert über Nacht Flüssigkeit und frühes Rehydrieren gibt Energie." },
      it: { text: "Bevi un bicchiere d'acqua al mattino — il tuo corpo perde liquidi durante la notte e reidratarsi presto aumenta l'energia." },
      pt: { text: "Beba um copo de água logo de manhã — seu corpo perde líquido durante a noite e reidratar-se cedo aumenta a energia." },
      cy: { text: "Yfwch wydriad o ddŵr y peth cyntaf yn y bore — mae eich corff yn colli hylif dros nos ac mae ailhydradu'n gynnar yn rhoi egni." },
    },
  },
  {
    id: "t2",
    category: "Tip",
    emoji: "🚶",
    text: "A 10-minute walk after each meal helps regulate blood sugar and improves digestion.",
    translations: {
      es: { text: "Una caminata de 10 minutos después de cada comida ayuda a regular el azúcar en sangre y mejora la digestión." },
      fr: { text: "Une marche de 10 minutes après chaque repas aide à réguler la glycémie et améliore la digestion." },
      de: { text: "Ein 10-minütiger Spaziergang nach jeder Mahlzeit hilft, den Blutzucker zu regulieren und die Verdauung zu verbessern." },
      it: { text: "Una camminata di 10 minuti dopo ogni pasto aiuta a regolare la glicemia e migliora la digestione." },
      pt: { text: "Uma caminhada de 10 minutos após cada refeição ajuda a regular o açúcar no sangue e melhora a digestão." },
      cy: { text: "Mae cerdded am 10 munud ar ôl pob pryd bwyd yn helpu i reoli siwgr yn y gwaed ac yn gwella treuliad." },
    },
  },
  {
    id: "t3",
    category: "Tip",
    emoji: "📝",
    text: "Writing down 3 things you're grateful for each day can improve sleep and reduce anxiety within weeks.",
    translations: {
      es: { text: "Escribir 3 cosas por las que estás agradecido cada día puede mejorar el sueño y reducir la ansiedad en semanas." },
      fr: { text: "Écrire 3 choses pour lesquelles vous êtes reconnaissant chaque jour peut améliorer le sommeil et réduire l'anxiété en quelques semaines." },
      de: { text: "3 Dinge aufzuschreiben, für die Sie täglich dankbar sind, kann den Schlaf verbessern und Angst innerhalb von Wochen reduzieren." },
      it: { text: "Scrivere 3 cose per cui sei grato ogni giorno può migliorare il sonno e ridurre l'ansia in poche settimane." },
      pt: { text: "Escrever 3 coisas pelas quais você é grato todos os dias pode melhorar o sono e reduzir a ansiedade em semanas." },
      cy: { text: "Gall ysgrifennu 3 pheth rydych chi'n ddiolchgar amdanynt bob dydd wella cwsg a lleihau gorbryder o fewn wythnosau." },
    },
  },
  {
    id: "t4",
    category: "Tip",
    emoji: "🧩",
    text: "Try a new word puzzle or crossword today — keeping the mind active is one of the best ways to stay sharp.",
    translations: {
      es: { text: "Prueba un nuevo crucigrama o rompecabezas de palabras hoy — mantener la mente activa es una de las mejores formas de estar alerta." },
      fr: { text: "Essayez un nouveau jeu de mots ou une mots croisés aujourd'hui — garder l'esprit actif est l'un des meilleurs moyens de rester alerte." },
      de: { text: "Probieren Sie heute ein neues Wortspiel oder Kreuzworträtsel aus — den Geist aktiv zu halten ist einer der besten Wege, um geistig fit zu bleiben." },
      it: { text: "Prova un nuovo cruciverba o rompicapo oggi — mantenere la mente attiva è uno dei modi migliori per restare acuto." },
      pt: { text: "Experimente um novo quebra-cabeça de palavras ou palavras cruzadas hoje — manter a mente ativa é uma das melhores formas de se manter aguçado." },
      cy: { text: "Rhowch gynnig ar bos geiriau neu groesair newydd heddiw — mae cadw'r meddwl yn actif yn un o'r ffyrdd gorau i aros yn effro." },
    },
  },
  {
    id: "t5",
    category: "Tip",
    emoji: "🍎",
    text: "Eating colorful fruits and vegetables provides antioxidants that protect cells and support energy levels.",
    translations: {
      es: { text: "Comer frutas y verduras coloridas proporciona antioxidantes que protegen las células y apoyan los niveles de energía." },
      fr: { text: "Manger des fruits et légumes colorés fournit des antioxydants qui protègent les cellules et soutiennent les niveaux d'énergie." },
      de: { text: "Bunte Obst und Gemüse essen liefert Antioxidantien, die Zellen schützen und den Energiepegel unterstützen." },
      it: { text: "Mangiare frutta e verdura colorata fornisce antiossidanti che proteggono le cellule e supportano i livelli di energia." },
      pt: { text: "Comer frutas e vegetais coloridos fornece antioxidantes que protegem as células e apoiam os níveis de energia." },
      cy: { text: "Mae bwyta ffrwythau a llysiau lliwgar yn darparu gwrthosidyddion sy'n amddiffyn celloedd ac yn cynnal lefelau egni." },
    },
  },
  {
    id: "t6",
    category: "Tip",
    emoji: "📞",
    text: "Calling a friend or family member today counts as self-care — connection is medicine.",
    translations: {
      es: { text: "Llamar a un amigo o familiar hoy cuenta como autocuidado — la conexión es medicina." },
      fr: { text: "Appeler un ami ou un membre de la famille aujourd'hui compte comme soin personnel — la connexion est un médicament." },
      de: { text: "Heute einen Freund oder ein Familienmitglied anzurufen zählt als Selbstfürsorge — Verbindung ist Medizin." },
      it: { text: "Chiamare un amico o un familiare oggi conta come autocura — la connessione è medicina." },
      pt: { text: "Ligar para um amigo ou familiar hoje conta como autocuidado — a conexão é medicina." },
      cy: { text: "Mae ffonio ffrind neu aelod o'r teulu heddiw yn cyfrif fel hunanofal — mae cysylltiad yn feddyginiaeth." },
    },
  },
  {
    id: "t7",
    category: "Tip",
    emoji: "🌬️",
    text: "Try the 4-7-8 breathing technique: breathe in for 4 seconds, hold for 7, exhale for 8. Calms the mind instantly.",
    translations: {
      es: { text: "Prueba la técnica de respiración 4-7-8: inhala durante 4 segundos, mantén durante 7, exhala durante 8. Calma la mente al instante." },
      fr: { text: "Essayez la technique de respiration 4-7-8 : inspirez pendant 4 secondes, retenez pendant 7, expirez pendant 8. Calme l'esprit instantanément." },
      de: { text: "Probieren Sie die 4-7-8-Atemtechnik: 4 Sekunden einatmen, 7 Sekunden halten, 8 Sekunden ausatmen. Beruhigt den Geist sofort." },
      it: { text: "Prova la tecnica di respirazione 4-7-8: inspira per 4 secondi, trattieni per 7, espira per 8. Calma la mente istantaneamente." },
      pt: { text: "Experimente a técnica de respiração 4-7-8: inspire por 4 segundos, segure por 7, expire por 8. Acalma a mente instantaneamente." },
      cy: { text: "Rhowch gynnig ar y dechneg anadlu 4-7-8: anadlwch i mewn am 4 eiliad, daliwch am 7, anadlwch allan am 8. Mae'n tawelu'r meddwl yn syth." },
    },
  },
  {
    id: "t8",
    category: "Tip",
    emoji: "🧦",
    text: "Non-slip footwear at home is one of the simplest ways to prevent falls and stay confident on your feet.",
    translations: {
      es: { text: "El calzado antideslizante en casa es una de las formas más simples de prevenir caídas y sentirse seguro al caminar." },
      fr: { text: "Des chaussures antidérapantes à la maison est l'un des moyens les plus simples de prévenir les chutes et de rester confiant sur ses pieds." },
      de: { text: "Rutschfestes Schuhwerk zu Hause ist eine der einfachsten Möglichkeiten, Stürze zu vermeiden und sicher auf den Beinen zu bleiben." },
      it: { text: "Le calzature antiscivolo in casa è uno dei modi più semplici per prevenire le cadute e restare sicuri sui piedi." },
      pt: { text: "Calçados antiderrapantes em casa é uma das formas mais simples de prevenir quedas e se manter confiante nos pés." },
      cy: { text: "Mae esgidiau gwrthslip gartref yn un o'r ffyrdd symlaf o atal cwympiau a chadw'n hyderus ar eich traed." },
    },
  },
  {
    id: "t9",
    category: "Tip",
    emoji: "👁️",
    text: "Follow the 20-20-20 rule for eye comfort: every 20 minutes, look at something 20 feet away for 20 seconds.",
    translations: {
      es: { text: "Sigue la regla 20-20-20 para el confort ocular: cada 20 minutos, mira algo a 6 metros de distancia durante 20 segundos." },
      fr: { text: "Suivez la règle 20-20-20 pour le confort oculaire : toutes les 20 minutes, regardez quelque chose à 6 mètres de distance pendant 20 secondes." },
      de: { text: "Folgen Sie der 20-20-20-Regel für Augenkomfort: Alle 20 Minuten etwas 6 Meter entfernt für 20 Sekunden ansehen." },
      it: { text: "Segui la regola 20-20-20 per il comfort oculare: ogni 20 minuti, guarda qualcosa a 6 metri di distanza per 20 secondi." },
      pt: { text: "Siga a regra 20-20-20 para o conforto ocular: a cada 20 minutos, olhe para algo a 6 metros de distância por 20 segundos." },
      cy: { text: "Dilynwch y rheol 20-20-20 ar gyfer cysur llygaid: bob 20 munud, edrychwch ar rywbeth 6 metr i ffwrdd am 20 eiliad." },
    },
  },
  {
    id: "t10",
    category: "Tip",
    emoji: "🌙",
    text: "A consistent bedtime routine — same time each night — trains your body clock and dramatically improves sleep quality.",
    translations: {
      es: { text: "Una rutina de hora de acostarse consistente — la misma hora cada noche — entrena tu reloj biológico y mejora drásticamente la calidad del sueño." },
      fr: { text: "Une routine de coucher cohérente — à la même heure chaque soir — entraîne votre horloge biologique et améliore considérablement la qualité du sommeil." },
      de: { text: "Eine regelmäßige Schlafenszeit-Routine — jeden Abend zur gleichen Zeit — trainiert Ihre innere Uhr und verbessert die Schlafqualität erheblich." },
      it: { text: "Una routine costante all'ora di andare a letto — alla stessa ora ogni sera — addestra il tuo orologio biologico e migliora notevolmente la qualità del sonno." },
      pt: { text: "Uma rotina de hora de dormir consistente — no mesmo horário toda noite — treina seu relógio biológico e melhora dramaticamente a qualidade do sono." },
      cy: { text: "Mae trefn amser gwely gyson — yr un amser bob nos — yn hyfforddi eich cloc corff ac yn gwella ansawdd cwsg yn sylweddol." },
    },
  },
  {
    id: "t11",
    category: "Tip",
    emoji: "🫶",
    text: "Reach out to someone you haven't spoken to in a while. A short message can brighten both your days.",
    translations: {
      es: { text: "Contáctate con alguien con quien no hayas hablado en un tiempo. Un mensaje corto puede alegrar ambos días." },
      fr: { text: "Contactez quelqu'un à qui vous n'avez pas parlé depuis un moment. Un court message peut illuminer vos deux journées." },
      de: { text: "Melden Sie sich bei jemandem, mit dem Sie schon länger nicht gesprochen haben. Eine kurze Nachricht kann beiden den Tag erhellen." },
      it: { text: "Contatta qualcuno con cui non hai parlato da un po'. Un breve messaggio può illuminare entrambe le vostre giornate." },
      pt: { text: "Entre em contato com alguém com quem não conversou há algum tempo. Uma mensagem curta pode iluminar os dois dias." },
      cy: { text: "Cysylltwch â rhywun nad ydych chi wedi siarad â nhw ers peth amser. Gall neges fer oleuo dau ddiwrnod." },
    },
  },
  // ── Achievements ──────────────────────────────────────────────────────────
  {
    id: "a1",
    category: "Achievement",
    emoji: "🏅",
    text: "Every time you take your medication on schedule, you're giving your body the best chance to thrive.",
    translations: {
      es: { text: "Cada vez que tomas tu medicación a tiempo, le das a tu cuerpo la mejor oportunidad de prosperar." },
      fr: { text: "Chaque fois que vous prenez vos médicaments selon le calendrier, vous donnez à votre corps la meilleure chance de s'épanouir." },
      de: { text: "Jedes Mal, wenn Sie Ihre Medikamente pünktlich nehmen, geben Sie Ihrem Körper die beste Chance zu gedeihen." },
      it: { text: "Ogni volta che prendi i tuoi farmaci secondo il programma, stai dando al tuo corpo la migliore possibilità di prosperare." },
      pt: { text: "Cada vez que você toma sua medicação no horário, está dando ao seu corpo a melhor chance de prosperar." },
      cy: { text: "Bob tro rydych chi'n cymryd eich meddyginiaeth yn ôl yr amserlen, rydych chi'n rhoi'r cyfle gorau i'ch corff ffynnu." },
    },
  },
  {
    id: "a2",
    category: "Achievement",
    emoji: "🌟",
    text: "Opening this app today is an act of self-care. You showed up for yourself — that matters.",
    translations: {
      es: { text: "Abrir esta aplicación hoy es un acto de autocuidado. Te presentaste por ti mismo — eso importa." },
      fr: { text: "Ouvrir cette application aujourd'hui est un acte de soin personnel. Vous vous êtes montré pour vous-même — c'est important." },
      de: { text: "Diese App heute zu öffnen ist ein Akt der Selbstfürsorge. Sie haben sich für sich selbst eingesetzt — das zählt." },
      it: { text: "Aprire questa app oggi è un atto di autocura. Ti sei presentato per te stesso — questo conta." },
      pt: { text: "Abrir este aplicativo hoje é um ato de autocuidado. Você apareceu por si mesmo — isso importa." },
      cy: { text: "Mae agor yr ap hwn heddiw yn act o hunanofal. Fe wnaethoch chi ddangos i chi eich hun — mae hynny'n bwysig." },
    },
  },
  {
    id: "a3",
    category: "Achievement",
    emoji: "🎯",
    text: "Every step you take — even a short stroll — adds up. You're doing better than you think.",
    translations: {
      es: { text: "Cada paso que das — incluso un paseo corto — suma. Lo estás haciendo mejor de lo que crees." },
      fr: { text: "Chaque pas que vous faites — même une courte promenade — compte. Vous faites mieux que vous ne le pensez." },
      de: { text: "Jeder Schritt, den Sie machen — auch ein kurzer Spaziergang — zählt. Sie machen es besser als Sie denken." },
      it: { text: "Ogni passo che fai — anche una breve passeggiata — si accumula. Stai facendo meglio di quanto pensi." },
      pt: { text: "Cada passo que você dá — mesmo uma caminhada curta — conta. Você está se saindo melhor do que pensa." },
      cy: { text: "Mae pob cam rydych chi'n ei gymryd — hyd yn oed tro byr — yn adio. Rydych chi'n gwneud yn well nag yr ydych chi'n meddwl." },
    },
  },
  {
    id: "a4",
    category: "Achievement",
    emoji: "🧡",
    text: "Asking for help is a sign of strength, not weakness. You're ahead of so many just by reaching out.",
    translations: {
      es: { text: "Pedir ayuda es una señal de fortaleza, no de debilidad. Estás por delante de muchos solo por extender la mano." },
      fr: { text: "Demander de l'aide est un signe de force, pas de faiblesse. Vous avez une longueur d'avance sur beaucoup en tendant simplement la main." },
      de: { text: "Um Hilfe zu bitten ist ein Zeichen von Stärke, nicht von Schwäche. Sie sind vielen voraus, indem Sie einfach Kontakt aufnehmen." },
      it: { text: "Chiedere aiuto è un segno di forza, non di debolezza. Sei avanti a molti solo tendendo la mano." },
      pt: { text: "Pedir ajuda é um sinal de força, não de fraqueza. Você está à frente de muitos simplesmente por estender a mão." },
      cy: { text: "Mae gofyn am help yn arwydd o gryfder, nid gwendid. Rydych chi ar y blaen i lawer dim ond trwy gysylltu." },
    },
  },
  {
    id: "a5",
    category: "Achievement",
    emoji: "🎉",
    text: "Living with grace and curiosity at any age is an achievement worth celebrating every single day.",
    translations: {
      es: { text: "Vivir con gracia y curiosidad a cualquier edad es un logro que vale la pena celebrar cada día." },
      fr: { text: "Vivre avec grâce et curiosité à tout âge est une réalisation qui mérite d'être célébrée chaque jour." },
      de: { text: "Mit Anmut und Neugier in jedem Alter zu leben ist eine Leistung, die jeden Tag gefeiert werden sollte." },
      it: { text: "Vivere con grazia e curiosità a qualsiasi età è un risultato che vale la pena celebrare ogni singolo giorno." },
      pt: { text: "Viver com graça e curiosidade em qualquer idade é uma conquista que vale a pena celebrar todos os dias." },
      cy: { text: "Mae byw â gras a chwilfrydedd ar unrhyw oedran yn gyflawniad sy'n werth ei ddathlu bob dydd." },
    },
  },
  {
    id: "a6",
    category: "Achievement",
    emoji: "💎",
    text: "The wisdom you've accumulated over a lifetime is irreplaceable. It's one of your greatest strengths.",
    translations: {
      es: { text: "La sabiduría que has acumulado a lo largo de una vida es irremplazable. Es una de tus mayores fortalezas." },
      fr: { text: "La sagesse que vous avez accumulée au cours d'une vie est irremplaçable. C'est l'une de vos plus grandes forces." },
      de: { text: "Die Weisheit, die Sie in einem Leben angesammelt haben, ist unersetzlich. Es ist eine Ihrer größten Stärken." },
      it: { text: "La saggezza che hai accumulato nel corso di una vita è insostituibile. È uno dei tuoi maggiori punti di forza." },
      pt: { text: "A sabedoria que você acumulou ao longo de uma vida é insubstituível. É uma das suas maiores forças." },
      cy: { text: "Mae'r doethineb rydych chi wedi'i gronni dros oes yn amhrisiadwy. Mae'n un o'ch cryfderau mwyaf." },
    },
  },
  {
    id: "a7",
    category: "Achievement",
    emoji: "🌱",
    text: "Growth doesn't stop at any age. Every new thing you try or learn is proof of that.",
    translations: {
      es: { text: "El crecimiento no se detiene en ninguna edad. Cada cosa nueva que intentas o aprendes es prueba de eso." },
      fr: { text: "La croissance ne s'arrête à aucun âge. Chaque nouvelle chose que vous essayez ou apprenez en est la preuve." },
      de: { text: "Wachstum hört in keinem Alter auf. Jede neue Sache, die Sie ausprobieren oder lernen, ist ein Beweis dafür." },
      it: { text: "La crescita non si ferma a nessuna età. Ogni nuova cosa che provi o impari ne è la prova." },
      pt: { text: "O crescimento não para em nenhuma idade. Cada coisa nova que você tenta ou aprende é prova disso." },
      cy: { text: "Nid yw twf yn stopio ar unrhyw oedran. Mae pob peth newydd rydych chi'n ei roi cynnig arno neu'n ei ddysgu yn brawf o hynny." },
    },
  },
  {
    id: "a8",
    category: "Achievement",
    emoji: "🏆",
    text: "You've navigated every challenge life has thrown at you so far. That track record is extraordinary.",
    translations: {
      es: { text: "Has superado cada desafío que la vida te ha presentado hasta ahora. Ese historial es extraordinario." },
      fr: { text: "Vous avez surmonté chaque défi que la vie vous a lancé jusqu'à présent. Ce bilan est extraordinaire." },
      de: { text: "Sie haben jede Herausforderung gemeistert, die das Leben Ihnen bisher gestellt hat. Diese Bilanz ist außergewöhnlich." },
      it: { text: "Hai affrontato ogni sfida che la vita ti ha lanciato finora. Quel curriculum è straordinario." },
      pt: { text: "Você navegou por cada desafio que a vida jogou até agora. Esse histórico é extraordinário." },
      cy: { text: "Rydych chi wedi llywio pob her y mae bywyd wedi'i thaflu atoch chi hyd yn hyn. Mae'r cofnod hwnnw'n rhyfeddol." },
    },
  },
  // ── Did You Know ──────────────────────────────────────────────────────────
  {
    id: "d1",
    category: "Did You Know",
    emoji: "🔬",
    text: "Your heart beats around 100,000 times a day — that's over 2.5 billion times in an average lifetime.",
    translations: {
      es: { text: "Tu corazón late alrededor de 100.000 veces al día — eso es más de 2.500 millones de veces en una vida promedio." },
      fr: { text: "Votre cœur bat environ 100 000 fois par jour — c'est plus de 2,5 milliards de fois au cours d'une vie moyenne." },
      de: { text: "Ihr Herz schlägt rund 100.000 Mal täglich — das sind über 2,5 Milliarden Mal in einem durchschnittlichen Leben." },
      it: { text: "Il tuo cuore batte circa 100.000 volte al giorno — sono più di 2,5 miliardi di volte in una vita media." },
      pt: { text: "Seu coração bate cerca de 100.000 vezes por dia — isso é mais de 2,5 bilhões de vezes em uma vida média." },
      cy: { text: "Mae eich calon yn curo tua 100,000 o weithiau y dydd — mae hynny'n fwy na 2.5 biliwn o weithiau mewn oes gyfartalog." },
    },
  },
  {
    id: "d2",
    category: "Did You Know",
    emoji: "🌍",
    text: "The world's oldest verified person lived to 122 years old. The secret? Family, olive oil, and a good attitude.",
    translations: {
      es: { text: "La persona verificada más anciana del mundo vivió 122 años. ¿El secreto? Familia, aceite de oliva y buena actitud." },
      fr: { text: "La personne la plus âgée vérifiée du monde a vécu jusqu'à 122 ans. Le secret ? La famille, l'huile d'olive et une bonne attitude." },
      de: { text: "Die älteste verifizierte Person der Welt wurde 122 Jahre alt. Das Geheimnis? Familie, Olivenöl und eine gute Einstellung." },
      it: { text: "La persona verificata più anziana del mondo ha vissuto fino a 122 anni. Il segreto? Famiglia, olio d'oliva e un buon atteggiamento." },
      pt: { text: "A pessoa verificada mais velha do mundo viveu até 122 anos. O segredo? Família, azeite e uma boa atitude." },
      cy: { text: "Bu'r person hynaf y mae tystiolaeth amdano yn y byd yn fyw hyd at 122 oed. Y cyfrinach? Teulu, olew olewydd, ac agwedd dda." },
    },
  },
  {
    id: "d3",
    category: "Did You Know",
    emoji: "🎨",
    text: "Picking up a creative hobby like drawing or painting can slow cognitive decline by keeping new neural connections active.",
    translations: {
      es: { text: "Adoptar un pasatiempo creativo como dibujar o pintar puede ralentizar el deterioro cognitivo al mantener activas nuevas conexiones neuronales." },
      fr: { text: "Adopter un passe-temps créatif comme le dessin ou la peinture peut ralentir le déclin cognitif en maintenant actives de nouvelles connexions neuronales." },
      de: { text: "Ein kreatives Hobby wie Zeichnen oder Malen aufzunehmen kann den kognitiven Rückgang verlangsamen, indem neue neuronale Verbindungen aktiv gehalten werden." },
      it: { text: "Intraprendere un hobby creativo come il disegno o la pittura può rallentare il declino cognitivo mantenendo attive nuove connessioni neurali." },
      pt: { text: "Adotar um hobby criativo como desenho ou pintura pode retardar o declínio cognitivo mantendo novas conexões neurais ativas." },
      cy: { text: "Gall mabwysiadu hobi creadigol fel tynnu lluniau neu baentio arafu dirywiad gwybyddol trwy gadw cysylltiadau niwral newydd yn weithredol." },
    },
  },
  {
    id: "d4",
    category: "Did You Know",
    emoji: "🌙",
    text: "Your body does most of its cellular repair work while you sleep — quality sleep is one of the best investments in your health.",
    translations: {
      es: { text: "Tu cuerpo realiza la mayor parte de su trabajo de reparación celular mientras duermes — el sueño de calidad es una de las mejores inversiones en tu salud." },
      fr: { text: "Votre corps effectue la plupart de son travail de réparation cellulaire pendant que vous dormez — un sommeil de qualité est l'un des meilleurs investissements dans votre santé." },
      de: { text: "Ihr Körper leistet den Großteil seiner Zellreparaturarbeit während Sie schlafen — Qualitätsschlaf ist eine der besten Investitionen in Ihre Gesundheit." },
      it: { text: "Il tuo corpo svolge la maggior parte del suo lavoro di riparazione cellulare mentre dormi — il sonno di qualità è uno dei migliori investimenti nella tua salute." },
      pt: { text: "Seu corpo realiza a maior parte de seu trabalho de reparo celular enquanto você dorme — o sono de qualidade é um dos melhores investimentos na sua saúde." },
      cy: { text: "Mae eich corff yn gwneud y rhan fwyaf o'i waith atgyweirio cellog tra rydych chi'n cysgu — mae cwsg o ansawdd yn un o'r buddsoddiannau gorau yn eich iechyd." },
    },
  },
  {
    id: "d5",
    category: "Did You Know",
    emoji: "🫀",
    text: "Regularly eating fish rich in omega-3s can reduce the risk of heart disease by up to 36%.",
    translations: {
      es: { text: "Comer regularmente pescado rico en omega-3 puede reducir el riesgo de enfermedades cardíacas hasta en un 36%." },
      fr: { text: "Manger régulièrement du poisson riche en oméga-3 peut réduire le risque de maladie cardiaque jusqu'à 36%." },
      de: { text: "Regelmäßiger Verzehr von omega-3-reichem Fisch kann das Herzerkrankungsrisiko um bis zu 36% senken." },
      it: { text: "Mangiare regolarmente pesce ricco di omega-3 può ridurre il rischio di malattie cardiache fino al 36%." },
      pt: { text: "Comer regularmente peixes ricos em ômega-3 pode reduzir o risco de doenças cardíacas em até 36%." },
      cy: { text: "Gall fwyta pysgod yn gyson sy'n gyfoethog mewn omega-3 leihau'r risg o glefyd y galon hyd at 36%." },
    },
  },
  {
    id: "d6",
    category: "Did You Know",
    emoji: "🌿",
    text: "Turmeric contains curcumin, a natural compound with powerful anti-inflammatory properties — often called 'nature's ibuprofen.'",
    translations: {
      es: { text: "La cúrcuma contiene curcumina, un compuesto natural con poderosas propiedades antiinflamatorias — a menudo llamado 'el ibuprofeno de la naturaleza'." },
      fr: { text: "Le curcuma contient de la curcumine, un composé naturel aux puissantes propriétés anti-inflammatoires — souvent appelé 'l'ibuprofène de la nature'." },
      de: { text: "Kurkuma enthält Curcumin, eine natürliche Verbindung mit starken entzündungshemmenden Eigenschaften — oft als 'das Ibuprofen der Natur' bezeichnet." },
      it: { text: "La curcuma contiene curcumina, un composto naturale con potenti proprietà antinfiammatorie — spesso chiamato 'l'ibuprofene della natura'." },
      pt: { text: "A cúrcuma contém curcumina, um composto natural com poderosas propriedades anti-inflamatórias — frequentemente chamado de 'o ibuprofeno da natureza'." },
      cy: { text: "Mae tyrmerig yn cynnwys cwrcwmin, cyfansoddyn naturiol â phriodweddau gwrthlidiol pwerus — yn aml yn cael ei alw'n 'ibyproffen natur'." },
    },
  },
  {
    id: "d7",
    category: "Did You Know",
    emoji: "💬",
    text: "Speaking a second language — even learning one later in life — can delay the onset of dementia by 4–5 years.",
    translations: {
      es: { text: "Hablar un segundo idioma — incluso aprenderlo más tarde en la vida — puede retrasar el inicio de la demencia entre 4 y 5 años." },
      fr: { text: "Parler une deuxième langue — même en en apprenant une plus tard dans la vie — peut retarder l'apparition de la démence de 4 à 5 ans." },
      de: { text: "Eine zweite Sprache zu sprechen — auch wenn man sie später im Leben lernt — kann den Ausbruch von Demenz um 4–5 Jahre verzögern." },
      it: { text: "Parlare una seconda lingua — anche imparandola più tardi nella vita — può ritardare l'insorgenza della demenza di 4-5 anni." },
      pt: { text: "Falar um segundo idioma — mesmo aprendendo um mais tarde na vida — pode atrasar o início da demência em 4–5 anos." },
      cy: { text: "Gall siarad ail iaith — hyd yn oed dysgu un yn ddiweddarach mewn bywyd — oedi dechrau dementia am 4–5 mlynedd." },
    },
  },
  {
    id: "d8",
    category: "Did You Know",
    emoji: "🫐",
    text: "Blueberries are sometimes called 'brain berries' — regular consumption is linked to improved memory and cognitive function.",
    translations: {
      es: { text: "Los arándanos a veces se llaman 'bayas del cerebro' — el consumo regular está vinculado a una mejor memoria y función cognitiva." },
      fr: { text: "Les myrtilles sont parfois appelées 'baies du cerveau' — leur consommation régulière est liée à une amélioration de la mémoire et de la fonction cognitive." },
      de: { text: "Blaubeeren werden manchmal als 'Gehirnbeeren' bezeichnet — regelmäßiger Verzehr ist mit verbessertem Gedächtnis und kognitiver Funktion verbunden." },
      it: { text: "I mirtilli vengono a volte chiamati 'bacche del cervello' — il consumo regolare è associato a una migliore memoria e funzione cognitiva." },
      pt: { text: "Os mirtilos às vezes são chamados de 'frutos do cérebro' — o consumo regular está associado a melhor memória e função cognitiva." },
      cy: { text: "Weithiau gelwir llus yn 'ffrwythau'r ymennydd' — mae bwyta'n rheolaidd wedi'i gysylltu â gwell cof a gweithrediad gwybyddol." },
    },
  },
  {
    id: "d9",
    category: "Did You Know",
    emoji: "🏊",
    text: "Swimming is one of the gentlest full-body workouts — it builds strength and cardiovascular health with minimal joint stress.",
    translations: {
      es: { text: "Nadar es uno de los entrenamientos de cuerpo completo más suaves — desarrolla fuerza y salud cardiovascular con un estrés mínimo en las articulaciones." },
      fr: { text: "La natation est l'un des entraînements complets du corps les plus doux — elle développe la force et la santé cardiovasculaire avec un minimum de stress articulaire." },
      de: { text: "Schwimmen ist eines der sanftesten Ganzkörpertrainings — es stärkt Muskeln und Herz-Kreislauf-Gesundheit mit minimalem Gelenkstress." },
      it: { text: "Il nuoto è uno degli allenamenti per tutto il corpo più delicati — sviluppa forza e salute cardiovascolare con un minimo stress articolare." },
      pt: { text: "A natação é um dos treinos de corpo inteiro mais suaves — constrói força e saúde cardiovascular com estresse mínimo nas articulações." },
      cy: { text: "Nofio yw un o'r ymarferion corff llawnaf mwyaf tyner — mae'n adeiladu cryfder ac iechyd cardiofasgwlaidd â lleiafswm o straen ar gymalau." },
    },
  },
  {
    id: "d10",
    category: "Did You Know",
    emoji: "🤝",
    text: "Volunteering just 2 hours a week is linked to lower rates of depression and a stronger sense of purpose.",
    translations: {
      es: { text: "Hacer voluntariado solo 2 horas a la semana está relacionado con tasas más bajas de depresión y un sentido más fuerte de propósito." },
      fr: { text: "Faire du bénévolat seulement 2 heures par semaine est lié à des taux de dépression plus faibles et à un sentiment de but plus fort." },
      de: { text: "Nur 2 Stunden pro Woche ehrenamtlich tätig zu sein, ist mit niedrigeren Depressionsraten und einem stärkeren Sinn für Zweck verbunden." },
      it: { text: "Fare volontariato solo 2 ore a settimana è associato a tassi di depressione più bassi e a un senso di scopo più forte." },
      pt: { text: "Fazer voluntariado apenas 2 horas por semana está associado a taxas mais baixas de depressão e a um senso mais forte de propósito." },
      cy: { text: "Mae gwirfoddoli am ddim ond 2 awr yr wythnos yn gysylltiedig â chyfraddau is o iselder a synnwyr cryfach o bwrpas." },
    },
  },
  {
    id: "d11",
    category: "Did You Know",
    emoji: "🌺",
    text: "The scent of lavender has been clinically shown to reduce anxiety and improve sleep quality in older adults.",
    translations: {
      es: { text: "Se ha demostrado clínicamente que el aroma de la lavanda reduce la ansiedad y mejora la calidad del sueño en adultos mayores." },
      fr: { text: "Il a été cliniquement démontré que l'odeur de lavande réduit l'anxiété et améliore la qualité du sommeil chez les personnes âgées." },
      de: { text: "Der Duft von Lavendel wurde klinisch belegt, Angst zu reduzieren und die Schlafqualität bei älteren Erwachsenen zu verbessern." },
      it: { text: "È stato clinicamente dimostrato che il profumo di lavanda riduce l'ansia e migliora la qualità del sonno negli anziani." },
      pt: { text: "Foi clinicamente demonstrado que o aroma de lavanda reduz a ansiedade e melhora a qualidade do sono em adultos mais velhos." },
      cy: { text: "Mae wedi'i ddangos yn glinigol bod arogl lafant yn lleihau gorbryder ac yn gwella ansawdd cwsg mewn oedolion hŷn." },
    },
  },
  {
    id: "d12",
    category: "Did You Know",
    emoji: "🎭",
    text: "People who regularly attend cultural events like concerts or theatre visits report higher life satisfaction and lower rates of depression.",
    translations: {
      es: { text: "Las personas que asisten regularmente a eventos culturales como conciertos o teatro reportan mayor satisfacción con la vida y menores tasas de depresión." },
      fr: { text: "Les personnes qui assistent régulièrement à des événements culturels comme des concerts ou des visites au théâtre rapportent une plus grande satisfaction de vie et des taux de dépression plus faibles." },
      de: { text: "Menschen, die regelmäßig Kulturveranstaltungen wie Konzerte oder Theaterbesuche besuchen, berichten von höherer Lebenszufriedenheit und niedrigeren Depressionsraten." },
      it: { text: "Le persone che partecipano regolarmente a eventi culturali come concerti o visite a teatro riportano una maggiore soddisfazione di vita e tassi di depressione più bassi." },
      pt: { text: "Pessoas que frequentam regularmente eventos culturais como concertos ou visitas ao teatro relatam maior satisfação com a vida e taxas mais baixas de depressão." },
      cy: { text: "Mae pobl sy'n mynychu digwyddiadau diwylliannol yn rheolaidd fel cyngherddau neu ymweliadau theatr yn adrodd boddhad bywyd uwch a chyfraddau is o iselder." },
    },
  },
];

export const CATEGORY_STYLE: Record<
  CardCategory,
  { badge: string; badgeText: string; iconBg: string; iconColor: string }
> = {
  Quote:          { badge: "#F5F3FF", badgeText: "#6B21A8", iconBg: "#EDE9FE", iconColor: "#7C3AED" },
  Fact:           { badge: "#EFF6FF", badgeText: "#1D4ED8", iconBg: "#DBEAFE", iconColor: "#2563EB" },
  Tip:            { badge: "#ECFDF5", badgeText: "#065F46", iconBg: "#D1FAE5", iconColor: "#059669" },
  Achievement:    { badge: "#FFFBEB", badgeText: "#92400E", iconBg: "#FEF3C7", iconColor: "#B45309" },
  "Did You Know": { badge: "#FFF1F2", badgeText: "#9F1239", iconBg: "#FFE4E6", iconColor: "#BE185D" },
};

/** Simple seeded PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convert a date string like "2026-04-21" to a numeric seed. */
function dateSeed(dateStr: string): number {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (Math.imul(31, h) + dateStr.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** Returns today's date as "YYYY-MM-DD". */
export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Fisher-Yates shuffle seeded by the current date.
 * Returns the same order for a full calendar day; a fresh order starts at midnight.
 */
export function dateSeededDeck(): InspirationCard[] {
  const deck = [...INSPIRATION_CARDS];
  const rand = mulberry32(dateSeed(todayDateString()));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** @deprecated Use dateSeededDeck instead. */
export function shuffledDeck(): InspirationCard[] {
  return dateSeededDeck();
}
