type LanguageCode = "es" | "de" | "en";
type RoomCategory = "activity" | "social" | "useful" | "connection";
type ActivityType = "discussion" | "quiz" | "challenge" | "recipe" | "game" | "story" | "advice";

export type SocialRoomSeed = {
  slug: string;
  names: Record<LanguageCode, string>;
  category: RoomCategory;
  agentSlug: string;
  agentFullName: string;
  agentColour: string;
  agentCredential: Record<LanguageCode, string>;
  ctaLabel: Record<LanguageCode, string>;
  topicTags: string[];
  timeSlots: string[];
  featured: boolean;
  dailyTopics: Array<{
    topic: Record<LanguageCode, string>;
    opener: Record<LanguageCode, string>;
    quote: Record<LanguageCode, string>;
    activityType: ActivityType;
    contentTag: Record<LanguageCode, string>;
    contentTitle: Record<LanguageCode, string>;
    contentBody: Record<LanguageCode, string>;
    options?: Record<LanguageCode, string[]>;
  }>;
};

function localize<T>(value: Record<LanguageCode, T>, language: LanguageCode): T {
  return value[language] ?? value.es;
}

export const socialRoomSeeds: SocialRoomSeed[] = [
  {
    slug: "garden-chat",
    names: { es: "El Rincón del Jardín", de: "Der Gartenchat", en: "Garden Corner" },
    category: "activity",
    agentSlug: "rosa",
    agentFullName: "Rosa Villanueva",
    agentColour: "#059669",
    agentCredential: {
      es: "Botánica · 40 años cultivando",
      de: "Botanikerin · 40 Jahre Gärtnern",
      en: "Botanist · 40 years gardening",
    },
    ctaLabel: {
      es: "Preguntar a Rosa",
      de: "Rosa fragen",
      en: "Ask Rosa",
    },
    topicTags: ["gardening", "plants", "seasons", "balcony"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    dailyTopics: [
      {
        topic: {
          es: "Plantas alegres para una ventana luminosa",
          de: "Fröhliche Pflanzen für ein helles Fenster",
          en: "Happy plants for a sunny window",
        },
        opener: {
          es: "Buenos días. Hoy hablamos de plantas que agradecen la luz suave. ¿Cuál te acompaña en casa?",
          de: "Guten Morgen. Heute sprechen wir über Pflanzen für sanftes Licht. Welche begleitet dich zu Hause?",
          en: "Good morning. Today we’re talking about plants that love gentle light. Which one keeps you company at home?",
        },
        quote: {
          es: "Una hoja nueva siempre trae una pequeña alegría.",
          de: "Ein neues Blatt bringt immer eine kleine Freude.",
          en: "A new leaf always brings a small joy.",
        },
        activityType: "advice",
        contentTag: { es: "Consejo de experta", de: "Expertinnen-Tipp", en: "Expert tip" },
        contentTitle: {
          es: "Tres señales de que tu planta está contenta",
          de: "Drei Zeichen, dass deine Pflanze zufrieden ist",
          en: "Three signs your plant feels happy",
        },
        contentBody: {
          es: "Color vivo, hojas firmes y brotes pequeños suelen indicar que recibe la luz y el agua adecuadas.",
          de: "Kräftige Farbe, feste Blätter und kleine Triebe zeigen oft, dass Licht und Wasser gut passen.",
          en: "Strong colour, firm leaves, and small new shoots often mean the light and water are just right.",
        },
      },
      {
        topic: {
          es: "Cómo cuidar hierbas en macetas pequeñas",
          de: "Kräuter in kleinen Töpfen pflegen",
          en: "Caring for herbs in small pots",
        },
        opener: {
          es: "Hoy miramos hierbas sencillas en una cocina tranquila. ¿Te gusta tener albahaca o romero a mano?",
          de: "Heute schauen wir auf einfache Kräuter in der Küche. Hast du gern Basilikum oder Rosmarin in der Nähe?",
          en: "Today we’re looking at simple herbs for a calm kitchen. Do you like keeping basil or rosemary nearby?",
        },
        quote: {
          es: "Las hierbas también alegran la casa con su aroma.",
          de: "Kräuter machen ein Zuhause auch mit ihrem Duft freundlicher.",
          en: "Herbs brighten a home with their scent too.",
        },
        activityType: "challenge",
        contentTag: { es: "Reto suave", de: "Sanfte Aufgabe", en: "Gentle challenge" },
        contentTitle: {
          es: "Riega sólo cuando la tierra esté seca arriba",
          de: "Gieße erst, wenn die Erde oben trocken ist",
          en: "Water only when the top soil feels dry",
        },
        contentBody: {
          es: "Toca la tierra con un dedo. Si está fresca, espera. Si está seca arriba, dale un poco de agua.",
          de: "Berühre die Erde mit einem Finger. Ist sie frisch, warte. Ist sie oben trocken, gib etwas Wasser.",
          en: "Touch the soil with one finger. If it feels cool, wait. If it feels dry on top, add a little water.",
        },
      },
      {
        topic: {
          es: "Flores de balcón que resisten bien",
          de: "Balkonblumen, die viel aushalten",
          en: "Balcony flowers that cope well",
        },
        opener: {
          es: "Hay flores muy agradecidas incluso en balcones pequeños. ¿Qué color te gusta ver al abrir la ventana?",
          de: "Es gibt dankbare Blumen sogar für kleine Balkone. Welche Farbe siehst du gern am Fenster?",
          en: "Some flowers do beautifully even on small balconies. What colour do you enjoy seeing at the window?",
        },
        quote: {
          es: "Un balcón pequeño también puede sentirse como un jardín.",
          de: "Auch ein kleiner Balkon kann sich wie ein Garten anfühlen.",
          en: "Even a small balcony can feel like a garden.",
        },
        activityType: "discussion",
        contentTag: { es: "Idea del día", de: "Idee des Tages", en: "Idea of the day" },
        contentTitle: {
          es: "Geranios, lavanda y alegrías",
          de: "Geranien, Lavendel und Fleißige Lieschen",
          en: "Geraniums, lavender, and busy lizzies",
        },
        contentBody: {
          es: "Son opciones amables y resistentes para empezar sin complicaciones.",
          de: "Sie sind freundliche und robuste Möglichkeiten, um ohne Druck zu beginnen.",
          en: "They’re gentle, resilient choices when you want a simple place to start.",
        },
      },
    ],
  },
  {
    slug: "chess-corner",
    names: { es: "El Club de Ajedrez", de: "Die Schachecke", en: "Chess Corner" },
    category: "activity",
    agentSlug: "lorenzo",
    agentFullName: "Lorenzo García",
    agentColour: "#1E1B4B",
    agentCredential: {
      es: "Maestro FIDE · Árbitro nacional",
      de: "FIDE-Meister · Nationaler Schiedsrichter",
      en: "FIDE Master · National referee",
    },
    ctaLabel: { es: "Analizar con Lorenzo", de: "Mit Lorenzo analysieren", en: "Analyse with Lorenzo" },
    topicTags: ["chess", "strategy", "puzzles", "logic"],
    timeSlots: ["afternoon", "evening"],
    featured: true,
    dailyTopics: [
      {
        topic: { es: "Mate en una jugada", de: "Matt in einem Zug", en: "Mate in one move" },
        opener: {
          es: "Tengo un reto breve y elegante. Hoy buscamos una jugada ganadora. ¿Te apetece pensar conmigo?",
          de: "Ich habe eine kurze, elegante Aufgabe. Heute suchen wir einen Gewinnzug. Denkst du mit mir?",
          en: "I have a short, elegant challenge. Today we’re hunting for one winning move. Shall we think together?",
        },
        quote: {
          es: "Una jugada clara vale más que diez apresuradas.",
          de: "Ein klarer Zug ist mehr wert als zehn hastige.",
          en: "One clear move is worth more than ten hurried ones.",
        },
        activityType: "quiz",
        contentTag: { es: "Análisis experto", de: "Expertenanalyse", en: "Expert analysis" },
        contentTitle: {
          es: "Busca la jugada más tranquila",
          de: "Suche den ruhigsten Zug",
          en: "Look for the calmest move",
        },
        contentBody: {
          es: "A veces la mejor idea no captura nada. Sólo mejora una pieza y prepara el ataque.",
          de: "Manchmal schlägt die beste Idee nichts. Sie verbessert nur eine Figur und bereitet den Angriff vor.",
          en: "Sometimes the best idea captures nothing. It simply improves a piece and prepares the attack.",
        },
        options: {
          es: ["Mover la dama", "Desarrollar un caballo", "Dar jaque inmediato"],
          de: ["Die Dame ziehen", "Einen Springer entwickeln", "Sofort Schach geben"],
          en: ["Move the queen", "Develop a knight", "Give check immediately"],
        },
      },
      {
        topic: { es: "El poder de las columnas abiertas", de: "Die Kraft offener Linien", en: "The power of open files" },
        opener: {
          es: "Una torre feliz necesita espacio. Hoy hablamos de columnas abiertas. ¿Te has fijado en ellas al jugar?",
          de: "Ein fröhlicher Turm braucht Raum. Heute sprechen wir über offene Linien. Achteest du darauf beim Spielen?",
          en: "A happy rook needs space. Today we’re talking about open files. Do you notice them while playing?",
        },
        quote: {
          es: "Las torres agradecen el aire libre.",
          de: "Türme lieben freie Luft.",
          en: "Rooks love fresh air.",
        },
        activityType: "advice",
        contentTag: { es: "Clave práctica", de: "Praktischer Schlüssel", en: "Practical key" },
        contentTitle: {
          es: "Doblar torres con calma",
          de: "Türme ruhig verdoppeln",
          en: "Doubling rooks calmly",
        },
        contentBody: {
          es: "Si una columna está libre, dos torres juntas suelen mandar mucho más que una sola.",
          de: "Ist eine Linie frei, wirken zwei Türme zusammen oft viel stärker als einer allein.",
          en: "When a file is open, two rooks together usually have far more authority than one.",
        },
      },
      {
        topic: { es: "Peones pasados", de: "Freibauern", en: "Passed pawns" },
        opener: {
          es: "Un peón pequeño puede convertirse en héroe. Hoy miramos el valor de un peón pasado. ¿Te gusta empujarlo?",
          de: "Ein kleiner Bauer kann zum Helden werden. Heute schauen wir auf Freibauern. Schiebst du sie gern vor?",
          en: "A small pawn can become the hero. Today we’re looking at passed pawns. Do you enjoy pushing them forward?",
        },
        quote: {
          es: "Los peones también cuentan historias valientes.",
          de: "Auch Bauern erzählen mutige Geschichten.",
          en: "Pawns tell brave stories too.",
        },
        activityType: "discussion",
        contentTag: { es: "Idea estratégica", de: "Strategische Idee", en: "Strategic idea" },
        contentTitle: {
          es: "Empujar con apoyo",
          de: "Mit Unterstützung vorrücken",
          en: "Advance with support",
        },
        contentBody: {
          es: "Un peón pasado es más fuerte cuando una pieza amiga lo acompaña y despeja el camino.",
          de: "Ein Freibauer ist stärker, wenn ihn eine Figur begleitet und den Weg freimacht.",
          en: "A passed pawn is stronger when a friendly piece walks beside it and clears the path.",
        },
      },
    ],
  },
  {
    slug: "creative-studio",
    names: { es: "El Estudio Creativo", de: "Das Kreativstudio", en: "Creative Studio" },
    category: "activity",
    agentSlug: "carmen",
    agentFullName: "Carmen Ruiz",
    agentColour: "#9D174D",
    agentCredential: {
      es: "Artista plástica · Terapia creativa",
      de: "Bildende Künstlerin · Kreativtherapie",
      en: "Visual artist · Creative therapy",
    },
    ctaLabel: { es: "Explorar con Carmen", de: "Mit Carmen gestalten", en: "Create with Carmen" },
    topicTags: ["art", "drawing", "craft", "creativity"],
    timeSlots: ["morning", "afternoon"],
    featured: false,
    dailyTopics: [
      {
        topic: { es: "Dibujar con formas suaves", de: "Mit sanften Formen zeichnen", en: "Drawing with gentle shapes" },
        opener: {
          es: "No hace falta saber dibujar perfecto. Hoy jugamos con círculos y líneas suaves. ¿Te animas?",
          de: "Man muss nicht perfekt zeichnen. Heute spielen wir mit Kreisen und weichen Linien. Machst du mit?",
          en: "You don’t need perfect drawing skills. Today we’ll play with circles and gentle lines. Shall we begin?",
        },
        quote: {
          es: "Crear también es una forma de respirar.",
          de: "Gestalten ist auch eine Art zu atmen.",
          en: "Creating is another way of breathing.",
        },
        activityType: "challenge",
        contentTag: { es: "Propuesta creativa", de: "Kreative Idee", en: "Creative prompt" },
        contentTitle: { es: "Una taza, una flor, una sombra", de: "Eine Tasse, eine Blume, ein Schatten", en: "A cup, a flower, a shadow" },
        contentBody: {
          es: "Elige un objeto cercano y dibuja sólo su silueta con calma.",
          de: "Wähle einen Gegenstand in deiner Nähe und zeichne nur seine Silhouette in Ruhe.",
          en: "Pick one nearby object and draw only its outline, slowly and calmly.",
        },
      },
      {
        topic: { es: "Colores que dan calma", de: "Farben, die Ruhe geben", en: "Colours that bring calm" },
        opener: {
          es: "Hay colores que descansan la mirada. Hoy hablamos de combinaciones tranquilas. ¿Cuál te serena más?",
          de: "Manche Farben beruhigen den Blick. Heute sprechen wir über ruhige Kombinationen. Welche beruhigt dich?",
          en: "Some colours let the eyes rest. Today we’re exploring calm combinations. Which one soothes you most?",
        },
        quote: {
          es: "El color puede cuidar el ánimo sin hacer ruido.",
          de: "Farbe kann die Stimmung still trösten.",
          en: "Colour can comfort the mood without making a sound.",
        },
        activityType: "discussion",
        contentTag: { es: "Mirada experta", de: "Expertinnenblick", en: "Expert eye" },
        contentTitle: { es: "Azules suaves y tierras claras", de: "Sanfte Blautöne und helle Erde", en: "Soft blues and light earth tones" },
        contentBody: {
          es: "Prueba unir un azul apagado con un beige cálido para una sensación serena.",
          de: "Verbinde ein gedämpftes Blau mit warmem Beige für ein ruhiges Gefühl.",
          en: "Try pairing a muted blue with warm beige for a peaceful feeling.",
        },
      },
      {
        topic: { es: "Collage de recuerdos bonitos", de: "Collage schöner Erinnerungen", en: "A collage of sweet memories" },
        opener: {
          es: "Crear con recuerdos puede ser muy tierno. ¿Qué imagen o palabra guardarías hoy en un collage?",
          de: "Mit Erinnerungen zu gestalten kann sehr zart sein. Welches Bild oder Wort würdest du heute aufheben?",
          en: "Creating with memories can feel wonderfully tender. What image or word would you save in a collage today?",
        },
        quote: {
          es: "A veces una tijera abre una conversación preciosa.",
          de: "Manchmal öffnet eine Schere ein wunderschönes Gespräch.",
          en: "Sometimes a pair of scissors opens a beautiful conversation.",
        },
        activityType: "story",
        contentTag: { es: "Memoria creativa", de: "Kreative Erinnerung", en: "Creative memory" },
        contentTitle: { es: "Tres palabras para hoy", de: "Drei Wörter für heute", en: "Three words for today" },
        contentBody: {
          es: "Elige tres palabras amables y dales un lugar visible en una hoja o cuaderno.",
          de: "Wähle drei freundliche Wörter und gib ihnen einen sichtbaren Platz auf Papier oder im Heft.",
          en: "Choose three gentle words and give them a visible place on a page or in a notebook.",
        },
      },
    ],
  },
  {
    slug: "book-club",
    names: { es: "El Club del Libro", de: "Der Buchclub", en: "Book Club" },
    category: "activity",
    agentSlug: "isabel",
    agentFullName: "Isabel Ferrer",
    agentColour: "#7C2D12",
    agentCredential: {
      es: "Filóloga · Literatura española",
      de: "Philologin · Spanische Literatur",
      en: "Philologist · Spanish literature",
    },
    ctaLabel: { es: "Comentar con Isabel", de: "Mit Isabel entdecken", en: "Explore with Isabel" },
    topicTags: ["books", "reading", "literature", "stories"],
    timeSlots: ["afternoon", "evening"],
    featured: false,
    dailyTopics: [
      {
        topic: { es: "Un personaje que se queda contigo", de: "Eine Figur, die bei dir bleibt", en: "A character who stays with you" },
        opener: {
          es: "Hoy hablamos de personajes inolvidables. ¿Hay alguno que te haya acompañado durante años?",
          de: "Heute sprechen wir über unvergessliche Figuren. Gibt es eine, die dich seit Jahren begleitet?",
          en: "Today we’re talking about unforgettable characters. Is there one that has stayed with you for years?",
        },
        quote: {
          es: "Leer también es sentarse a charlar con otra época.",
          de: "Lesen heißt auch, sich mit einer anderen Zeit zu unterhalten.",
          en: "Reading is also a conversation with another time.",
        },
        activityType: "discussion",
        contentTag: { es: "Lectura guiada", de: "Geführte Lektüre", en: "Guided reading" },
        contentTitle: { es: "Busca una frase que te acompañe", de: "Finde einen Satz, der bei dir bleibt", en: "Find one sentence that stays with you" },
        contentBody: {
          es: "No tiene que ser famosa. Basta con que te suene verdadera.",
          de: "Sie muss nicht berühmt sein. Es reicht, wenn sie sich wahr anfühlt.",
          en: "It doesn’t need to be famous. It only needs to feel true to you.",
        },
      },
      {
        topic: { es: "Poemas cortos para una tarde tranquila", de: "Kurze Gedichte für einen ruhigen Nachmittag", en: "Short poems for a calm afternoon" },
        opener: {
          es: "Un poema breve puede abrir una ventana entera. ¿Te gusta leer versos despacio?",
          de: "Ein kurzes Gedicht kann ein ganzes Fenster öffnen. Liest du Verse gern langsam?",
          en: "A short poem can open an entire window. Do you enjoy reading verse slowly?",
        },
        quote: {
          es: "Un verso pequeño puede acompañar todo el día.",
          de: "Ein kleiner Vers kann den ganzen Tag begleiten.",
          en: "A small line of verse can accompany the whole day.",
        },
        activityType: "story",
        contentTag: { es: "Pista literaria", de: "Literarischer Hinweis", en: "Literary note" },
        contentTitle: { es: "Lee en voz baja una vez más", de: "Lies es noch einmal leise", en: "Read it softly once more" },
        contentBody: {
          es: "La segunda lectura suele revelar la emoción escondida.",
          de: "Beim zweiten Lesen zeigt sich oft das verborgene Gefühl.",
          en: "The second reading often reveals the hidden feeling.",
        },
      },
      {
        topic: { es: "Historias que huelen a casa", de: "Geschichten, die nach Zuhause riechen", en: "Stories that smell like home" },
        opener: {
          es: "Hay libros que saben a cocina y verano. ¿Qué lectura te recuerda a casa?",
          de: "Manche Bücher schmecken nach Küche und Sommer. Welche Lektüre erinnert dich an Zuhause?",
          en: "Some books taste like kitchens and summer. Which one reminds you of home?",
        },
        quote: {
          es: "La literatura también guarda aromas.",
          de: "Auch Literatur bewahrt Düfte.",
          en: "Literature keeps hold of scents too.",
        },
        activityType: "story",
        contentTag: { es: "Pregunta abierta", de: "Offene Frage", en: "Open question" },
        contentTitle: { es: "Un recuerdo lector", de: "Eine Leseerinnerung", en: "A reading memory" },
        contentBody: {
          es: "Piensa en un libro que te acompañó en una etapa importante.",
          de: "Denke an ein Buch, das dich in einer wichtigen Zeit begleitet hat.",
          en: "Think of one book that kept you company during an important season of life.",
        },
      },
    ],
  },
  {
    slug: "morning-circle",
    names: { es: "Círculo de la Mañana", de: "Der Morgenkreis", en: "Morning Circle" },
    category: "social",
    agentSlug: "vyva",
    agentFullName: "VYVA",
    agentColour: "#5B21B6",
    agentCredential: {
      es: "Tu compañera de cada día",
      de: "Deine tägliche Begleiterin",
      en: "Your daily companion",
    },
    ctaLabel: { es: "Compartir con VYVA", de: "Mit VYVA teilen", en: "Share with VYVA" },
    topicTags: ["check-in", "mood", "morning", "wellbeing"],
    timeSlots: ["morning"],
    featured: true,
    dailyTopics: [
      {
        topic: { es: "Cómo amanece tu ánimo", de: "Wie dein Morgen sich anfühlt", en: "How your morning feels" },
        opener: {
          es: "Buenos días. Me alegra encontrarte aquí. ¿Cómo te está recibiendo esta mañana?",
          de: "Guten Morgen. Ich freue mich, dich hier zu sehen. Wie empfängt dich dieser Morgen?",
          en: "Good morning. I’m glad to find you here. How is this morning greeting you?",
        },
        quote: {
          es: "Un buen día empieza mejor cuando alguien te escucha.",
          de: "Ein guter Tag beginnt besser, wenn jemand zuhört.",
          en: "A day starts better when someone is listening.",
        },
        activityType: "discussion",
        contentTag: { es: "Chequeo amable", de: "Sanfter Check-in", en: "Gentle check-in" },
        contentTitle: { es: "Nombra una cosa buena", de: "Nenne eine gute Sache", en: "Name one good thing" },
        contentBody: {
          es: "Puede ser pequeña: una luz bonita, un café rico o un momento de calma.",
          de: "Es darf klein sein: schönes Licht, guter Kaffee oder ein stiller Moment.",
          en: "It can be small: kind light, good coffee, or a quiet moment.",
        },
      },
      {
        topic: { es: "Una intención sencilla para hoy", de: "Eine einfache Absicht für heute", en: "One simple intention for today" },
        opener: {
          es: "Hoy no buscamos perfección, sólo dirección. ¿Qué te gustaría cuidar un poco más?",
          de: "Heute suchen wir keine Perfektion, nur Richtung. Was möchtest du heute etwas mehr pflegen?",
          en: "Today we’re not chasing perfection, only direction. What would you like to care for a little more?",
        },
        quote: {
          es: "Las intenciones pequeñas también cambian el día.",
          de: "Auch kleine Absichten verändern einen Tag.",
          en: "Small intentions can change a whole day too.",
        },
        activityType: "challenge",
        contentTag: { es: "Idea práctica", de: "Praktische Idee", en: "Practical idea" },
        contentTitle: { es: "Elige una sola prioridad", de: "Wähle nur eine Priorität", en: "Choose just one priority" },
        contentBody: {
          es: "Una tarea amable hecha con calma suele valer más que tres apresuradas.",
          de: "Eine freundliche Aufgabe in Ruhe ist oft mehr wert als drei hektische.",
          en: "One kind task done calmly often matters more than three hurried ones.",
        },
      },
      {
        topic: { es: "Lo que te hizo sonreír ayer", de: "Was dich gestern lächeln ließ", en: "What made you smile yesterday" },
        opener: {
          es: "A veces la memoria más útil es la amable. ¿Qué detalle te hizo sonreír ayer?",
          de: "Manchmal ist die hilfreichste Erinnerung die freundliche. Was ließ dich gestern lächeln?",
          en: "Sometimes the most helpful memory is the gentle one. What made you smile yesterday?",
        },
        quote: {
          es: "Recordar algo bonito ya es una forma de cuidarse.",
          de: "Etwas Schönes zu erinnern ist schon eine Form der Fürsorge.",
          en: "Remembering something lovely is already a form of care.",
        },
        activityType: "story",
        contentTag: { es: "Recuerdo del día", de: "Erinnerung des Tages", en: "Memory of the day" },
        contentTitle: { es: "Guarda una imagen bonita", de: "Bewahre ein schönes Bild", en: "Keep one lovely image" },
        contentBody: {
          es: "Si quieres, puedes llevar ese recuerdo contigo durante el resto del día.",
          de: "Wenn du magst, kannst du diese Erinnerung durch den Tag mitnehmen.",
          en: "If you like, you can carry that memory with you through the rest of the day.",
        },
      },
    ],
  },
  {
    slug: "memory-lane",
    names: { es: "Camino de Recuerdos", de: "Die Erinnerungsstraße", en: "Memory Lane" },
    category: "social",
    agentSlug: "sofia",
    agentFullName: "Sofía Montoya",
    agentColour: "#6D6352",
    agentCredential: {
      es: "Historiadora · Memoria oral",
      de: "Historikerin · Mündliche Erinnerung",
      en: "Historian · Oral memory",
    },
    ctaLabel: { es: "Recordar con Sofía", de: "Mit Sofía erinnern", en: "Remember with Sofía" },
    topicTags: ["memories", "history", "storytelling", "nostalgia"],
    timeSlots: ["afternoon", "evening"],
    featured: true,
    dailyTopics: [
      {
        topic: { es: "La primera casa que recuerdas", de: "Das erste Haus, an das du dich erinnerst", en: "The first home you remember" },
        opener: {
          es: "Las casas también guardan biografías. ¿Qué detalle de tu primera casa vuelve primero a tu memoria?",
          de: "Auch Häuser bewahren Biografien. Welches Detail deines ersten Zuhauses fällt dir zuerst ein?",
          en: "Homes keep biographies too. What detail of your first home returns to you first?",
        },
        quote: {
          es: "Cada recuerdo cotidiano tiene valor histórico.",
          de: "Jede alltägliche Erinnerung trägt historischen Wert.",
          en: "Every everyday memory carries historical value.",
        },
        activityType: "story",
        contentTag: { es: "Memoria oral", de: "Mündliche Erinnerung", en: "Oral memory" },
        contentTitle: { es: "Empieza por una puerta o una ventana", de: "Beginne mit einer Tür oder einem Fenster", en: "Begin with a door or a window" },
        contentBody: {
          es: "Los detalles concretos suelen abrir recuerdos completos con mucha ternura.",
          de: "Konkrete Details öffnen oft ganze Erinnerungen mit viel Wärme.",
          en: "Concrete details often open complete memories with surprising tenderness.",
        },
      },
      {
        topic: { es: "Canciones que marcaron una época", de: "Lieder einer Lebenszeit", en: "Songs that marked an era" },
        opener: {
          es: "Una canción puede traer de vuelta una calle entera. ¿Cuál te devuelve a otra época?",
          de: "Ein Lied kann eine ganze Straße zurückbringen. Welches führt dich in eine andere Zeit?",
          en: "A song can bring back an entire street. Which one takes you to another time?",
        },
        quote: {
          es: "La memoria también tiene ritmo.",
          de: "Erinnerung hat auch Rhythmus.",
          en: "Memory has rhythm too.",
        },
        activityType: "discussion",
        contentTag: { es: "Pregunta evocadora", de: "Erinnerungsfrage", en: "Evocative question" },
        contentTitle: { es: "Piensa en una voz", de: "Denke an eine Stimme", en: "Think of one voice" },
        contentBody: {
          es: "A veces basta con recordar una voz o un estribillo para reconstruir el momento.",
          de: "Manchmal reicht eine Stimme oder ein Refrain, um einen Moment wiederaufzubauen.",
          en: "Sometimes one voice or one chorus is enough to rebuild the whole moment.",
        },
      },
      {
        topic: { es: "Oficios y manos de otra generación", de: "Berufe und Hände einer anderen Generation", en: "Trades and hands from another generation" },
        opener: {
          es: "Los oficios cuentan mucho sobre una vida. ¿Qué trabajo o tarea hacían tus mayores con orgullo?",
          de: "Berufe erzählen viel über ein Leben. Welche Arbeit machten deine Älteren mit Stolz?",
          en: "Trades tell us so much about a life. What work did your elders do with pride?",
        },
        quote: {
          es: "Detrás de cada oficio hay una memoria familiar.",
          de: "Hinter jedem Beruf liegt eine Familienerinnerung.",
          en: "Behind every trade there is a family memory.",
        },
        activityType: "story",
        contentTag: { es: "Historia compartida", de: "Geteilte Geschichte", en: "Shared story" },
        contentTitle: { es: "Describe unas manos en acción", de: "Beschreibe Hände bei der Arbeit", en: "Describe hands at work" },
        contentBody: {
          es: "Las manos suelen contar detalles que la memoria general olvida.",
          de: "Hände erzählen oft Details, die die große Erinnerung vergisst.",
          en: "Hands often tell the details that broad memory forgets.",
        },
      },
    ],
  },
  {
    slug: "evening-wind-down",
    names: { es: "La Hora de la Calma", de: "Die Ruhestunde", en: "Evening Wind-Down" },
    category: "social",
    agentSlug: "marco",
    agentFullName: "Marco Reyes",
    agentColour: "#1D4ED8",
    agentCredential: {
      es: "Psicólogo · Mindfulness clínico",
      de: "Psychologe · Klinisches Mindfulness",
      en: "Psychologist · Clinical mindfulness",
    },
    ctaLabel: { es: "Respirar con Marco", de: "Mit Marco atmen", en: "Breathe with Marco" },
    topicTags: ["meditation", "calm", "evening", "breathing"],
    timeSlots: ["evening"],
    featured: true,
    dailyTopics: [
      {
        topic: { es: "Una respiración más lenta", de: "Ein etwas langsamerer Atem", en: "A slightly slower breath" },
        opener: {
          es: "Estoy aquí para bajar el ritmo contigo. ¿Te acompaño en tres respiraciones tranquilas?",
          de: "Ich bin hier, um gemeinsam langsamer zu werden. Begleite ich dich durch drei ruhige Atemzüge?",
          en: "I’m here to help the pace soften. Shall I keep you company through three calm breaths?",
        },
        quote: {
          es: "No hay nada que conseguir, sólo un poco de alivio.",
          de: "Es gibt nichts zu erreichen, nur etwas Entlastung.",
          en: "There is nothing to achieve, only a little relief.",
        },
        activityType: "advice",
        contentTag: { es: "Beneficio probado", de: "Bewährter Nutzen", en: "Proven benefit" },
        contentTitle: { es: "Exhala un segundo más", de: "Atme einen Sekunden länger aus", en: "Let the exhale last one second longer" },
        contentBody: {
          es: "Una exhalación ligeramente más larga suele ayudar al cuerpo a sentirse más seguro.",
          de: "Eine etwas längere Ausatmung hilft dem Körper oft, sich sicherer zu fühlen.",
          en: "A slightly longer exhale often helps the body feel safer.",
        },
      },
      {
        topic: { es: "La mejor parte del día", de: "Der beste Teil des Tages", en: "The best part of the day" },
        opener: {
          es: "Antes de cerrar el día, busquemos una pequeña luz. ¿Qué ha sido amable contigo hoy?",
          de: "Bevor wir den Tag schließen, suchen wir ein kleines Licht. Was war heute freundlich zu dir?",
          en: "Before we close the day, let’s look for one small light. What felt kind to you today?",
        },
        quote: {
          es: "La calma también se construye recordando lo bueno.",
          de: "Ruhe wächst auch aus dem Erinnern des Guten.",
          en: "Calm can also grow from remembering what was good.",
        },
        activityType: "discussion",
        contentTag: { es: "Reflexión guiada", de: "Geführte Reflexion", en: "Guided reflection" },
        contentTitle: { es: "Una imagen amable", de: "Ein freundliches Bild", en: "One gentle image" },
        contentBody: {
          es: "Quédate unos segundos con ese momento antes de seguir adelante.",
          de: "Bleibe ein paar Sekunden bei diesem Moment, bevor du weitergehst.",
          en: "Stay with that moment for a few seconds before moving on.",
        },
      },
      {
        topic: { es: "Aflojar hombros y mandíbula", de: "Schultern und Kiefer entspannen", en: "Softening shoulders and jaw" },
        opener: {
          es: "El cansancio suele quedarse arriba del cuerpo. ¿Te ayudo a soltar hombros y mandíbula?",
          de: "Müdigkeit bleibt oft im oberen Körper. Soll ich dir helfen, Schultern und Kiefer zu lösen?",
          en: "Tiredness often settles in the upper body. Shall I help you soften your shoulders and jaw?",
        },
        quote: {
          es: "A veces descansar empieza por soltar un músculo.",
          de: "Manchmal beginnt Ruhe damit, einen Muskel loszulassen.",
          en: "Sometimes rest begins by letting one muscle go.",
        },
        activityType: "challenge",
        contentTag: { es: "Movimiento suave", de: "Sanfte Bewegung", en: "Gentle movement" },
        contentTitle: { es: "Baja los hombros al exhalar", de: "Senke die Schultern beim Ausatmen", en: "Let the shoulders drop as you exhale" },
        contentBody: {
          es: "No hace falta fuerza. Sólo espacio y permiso para aflojar.",
          de: "Es braucht keine Kraft. Nur Raum und Erlaubnis, weich zu werden.",
          en: "No force is needed. Just space and permission to soften.",
        },
      },
    ],
  },
  {
    slug: "kitchen-table",
    names: { es: "La Mesa de la Cocina", de: "Der Küchentisch", en: "Kitchen Table" },
    category: "useful",
    agentSlug: "lola",
    agentFullName: "Lola Martínez",
    agentColour: "#C2410C",
    agentCredential: {
      es: "Chef · Cocina mediterránea",
      de: "Köchin · Mediterrane Küche",
      en: "Chef · Mediterranean cuisine",
    },
    ctaLabel: { es: "Cocinar con Lola", de: "Mit Lola kochen", en: "Cook with Lola" },
    topicTags: ["cooking", "recipes", "food", "nutrition"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    dailyTopics: [
      {
        topic: { es: "Sopa rápida y reconfortante", de: "Schnelle tröstliche Suppe", en: "A quick comforting soup" },
        opener: {
          es: "Una sopa sencilla puede cuidar mucho. ¿Te apetece una idea calentita para hoy?",
          de: "Eine einfache Suppe kann viel fürs Wohlgefühl tun. Hättest du gern eine warme Idee für heute?",
          en: "A simple soup can be wonderfully caring. Would you like a warm idea for today?",
        },
        quote: {
          es: "La cocina también puede abrazar.",
          de: "Küche kann auch umarmen.",
          en: "Cooking can feel like a hug too.",
        },
        activityType: "recipe",
        contentTag: { es: "Receta de hoy", de: "Rezept des Tages", en: "Today’s recipe" },
        contentTitle: { es: "Caldo, verduras y un toque de limón", de: "Brühe, Gemüse und etwas Zitrone", en: "Broth, vegetables, and a touch of lemon" },
        contentBody: {
          es: "Con pocos ingredientes puedes preparar algo ligero, sabroso y muy amable con el cuerpo.",
          de: "Mit wenigen Zutaten lässt sich etwas Leichtes, Schmackhaftes und Freundliches für den Körper kochen.",
          en: "With just a few ingredients, you can make something light, tasty, and very kind to the body.",
        },
      },
      {
        topic: { es: "Desayunos mediterráneos sin complicación", de: "Mediterranes Frühstück ohne Aufwand", en: "Easy Mediterranean breakfasts" },
        opener: {
          es: "El desayuno no necesita ser complicado para ser delicioso. ¿Eres más de pan, fruta o yogur?",
          de: "Frühstück muss nicht kompliziert sein, um gut zu schmecken. Bist du eher Brot, Obst oder Joghurt?",
          en: "Breakfast doesn’t need to be complicated to feel lovely. Are you more bread, fruit, or yoghurt?",
        },
        quote: {
          es: "Las cosas sencillas suelen ser las más agradecidas.",
          de: "Die einfachen Dinge sind oft die dankbarsten.",
          en: "The simple things are often the most rewarding.",
        },
        activityType: "advice",
        contentTag: { es: "Consejo sabroso", de: "Leckerer Tipp", en: "Tasty tip" },
        contentTitle: { es: "Aceite, tomate y pan tostado", de: "Öl, Tomate und geröstetes Brot", en: "Olive oil, tomato, and toast" },
        contentBody: {
          es: "Una base simple puede sentirse especial con buen pan y un tomate maduro.",
          de: "Eine einfache Grundlage fühlt sich mit gutem Brot und reifer Tomate besonders an.",
          en: "A simple base can feel special with good bread and a ripe tomato.",
        },
      },
      {
        topic: { es: "Postres con fruta de temporada", de: "Desserts mit Obst der Saison", en: "Desserts with seasonal fruit" },
        opener: {
          es: "La fruta madura ya trae medio postre hecho. ¿Cuál te gusta más cuando está en su punto?",
          de: "Reifes Obst bringt schon die halbe Nachspeise mit. Welche magst du am liebsten, wenn sie perfekt ist?",
          en: "Ripe fruit has already done half the dessert work. Which one do you love most at its best?",
        },
        quote: {
          es: "La dulzura natural merece protagonismo.",
          de: "Natürliche Süße verdient ihren Auftritt.",
          en: "Natural sweetness deserves the spotlight.",
        },
        activityType: "recipe",
        contentTag: { es: "Idea de cocina", de: "Küchenidee", en: "Kitchen idea" },
        contentTitle: { es: "Compota suave con canela", de: "Sanftes Kompott mit Zimt", en: "Soft fruit compote with cinnamon" },
        contentBody: {
          es: "Cocer fruta unos minutos puede llenarla de aroma y volverla muy tierna.",
          de: "Obst wenige Minuten zu kochen schenkt Duft und macht es wunderbar weich.",
          en: "Cooking fruit for a few minutes brings out its aroma and makes it beautifully tender.",
        },
      },
    ],
  },
  {
    slug: "walking-club",
    names: { es: "El Club de los Pasos", de: "Der Wanderclub", en: "Walking Club" },
    category: "useful",
    agentSlug: "pedro",
    agentFullName: "Pedro Navarro",
    agentColour: "#0F766E",
    agentCredential: {
      es: "Fisioterapeuta · Movimiento suave",
      de: "Physiotherapeut · Sanfte Bewegung",
      en: "Physiotherapist · Gentle movement",
    },
    ctaLabel: { es: "Moverte con Pedro", de: "Mit Pedro bewegen", en: "Move with Pedro" },
    topicTags: ["walking", "movement", "outdoors", "exercise"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    dailyTopics: [
      {
        topic: { es: "Cinco minutos sí cuentan", de: "Fünf Minuten zählen", en: "Five minutes count" },
        opener: {
          es: "No hace falta una gran caminata para notar el beneficio. ¿Te acompaño a empezar pequeño?",
          de: "Es braucht keinen langen Spaziergang, um Nutzen zu spüren. Soll ich dir helfen, klein zu beginnen?",
          en: "You don’t need a long walk to feel the benefit. Shall I help you start small?",
        },
        quote: {
          es: "Todo movimiento tiene valor.",
          de: "Jede Bewegung hat Wert.",
          en: "Every bit of movement matters.",
        },
        activityType: "challenge",
        contentTag: { es: "Beneficio probado", de: "Bewährter Nutzen", en: "Proven benefit" },
        contentTitle: { es: "Salir o caminar por casa", de: "Draußen oder im Haus gehen", en: "Walk outside or around the house" },
        contentBody: {
          es: "Lo importante es activar el cuerpo con suavidad, no la distancia.",
          de: "Wichtig ist die sanfte Aktivierung des Körpers, nicht die Strecke.",
          en: "The goal is to wake the body gently, not to chase distance.",
        },
      },
      {
        topic: { es: "Cómo notar un buen ritmo", de: "Ein gutes Tempo spüren", en: "Feeling a good pace" },
        opener: {
          es: "Un ritmo bueno te deja hablar sin ahogarte. ¿Sueles encontrar ese paso cómodo?",
          de: "Ein gutes Tempo lässt dich sprechen, ohne außer Atem zu geraten. Findest du dieses angenehme Tempo?",
          en: "A good pace still lets you talk without strain. Do you usually find that comfortable rhythm?",
        },
        quote: {
          es: "Caminar bien no siempre es caminar rápido.",
          de: "Gut gehen heißt nicht immer schnell gehen.",
          en: "Walking well is not always walking fast.",
        },
        activityType: "advice",
        contentTag: { es: "Consejo de Pedro", de: "Pedros Tipp", en: "Pedro’s tip" },
        contentTitle: { es: "Mantén hombros sueltos", de: "Halte die Schultern locker", en: "Keep the shoulders easy" },
        contentBody: {
          es: "Si aflojas hombros y brazos, el paso suele salir más natural.",
          de: "Wenn Schultern und Arme locker sind, wird der Schritt oft natürlicher.",
          en: "When shoulders and arms soften, the walk usually feels more natural.",
        },
      },
      {
        topic: { es: "Paseo con pausa bonita", de: "Spaziergang mit schöner Pause", en: "A walk with one lovely pause" },
        opener: {
          es: "Caminar también puede incluir mirar, respirar y disfrutar. ¿Dónde te gusta detenerte un momento?",
          de: "Spazieren kann auch bedeuten zu schauen, zu atmen und zu genießen. Wo hältst du gern kurz an?",
          en: "Walking can also mean looking, breathing, and enjoying. Where do you like to pause for a moment?",
        },
        quote: {
          es: "La pausa también forma parte del movimiento.",
          de: "Auch die Pause gehört zur Bewegung.",
          en: "The pause is part of the movement too.",
        },
        activityType: "discussion",
        contentTag: { es: "Pregunta amable", de: "Freundliche Frage", en: "Gentle question" },
        contentTitle: { es: "Busca un banco o una sombra", de: "Suche eine Bank oder einen Schatten", en: "Look for a bench or a little shade" },
        contentBody: {
          es: "Elegir un buen lugar para descansar hace más agradable volver a caminar.",
          de: "Ein guter Ruheplatz macht den weiteren Weg meist angenehmer.",
          en: "Choosing a good place to rest makes the next few steps feel easier too.",
        },
      },
    ],
  },
  {
    slug: "news-cafe",
    names: { es: "El Café de las Noticias", de: "Das Nachrichtencafé", en: "News Café" },
    category: "useful",
    agentSlug: "elena",
    agentFullName: "Elena Castillo",
    agentColour: "#92400E",
    agentCredential: {
      es: "Periodista · Noticias positivas",
      de: "Journalistin · Positive Nachrichten",
      en: "Journalist · Positive news",
    },
    ctaLabel: { es: "Entender con Elena", de: "Mit Elena verstehen", en: "Explore with Elena" },
    topicTags: ["news", "world", "current-events", "culture"],
    timeSlots: ["morning", "afternoon"],
    featured: false,
    dailyTopics: [
      {
        topic: { es: "Una noticia que inspira", de: "Eine Nachricht, die inspiriert", en: "One story that inspires" },
        opener: {
          es: "Hoy traigo una noticia luminosa y tranquila. ¿Te apetece empezar el día con algo esperanzador?",
          de: "Heute bringe ich eine helle, ruhige Nachricht mit. Möchtest du den Tag hoffnungsvoll beginnen?",
          en: "Today I’m bringing a bright, gentle story. Would you like to start the day with something hopeful?",
        },
        quote: {
          es: "Estar informado también puede sentirse bien.",
          de: "Informiert zu sein kann sich auch gut anfühlen.",
          en: "Being informed can feel good too.",
        },
        activityType: "story",
        contentTag: { es: "Noticia del día", de: "Nachricht des Tages", en: "Story of the day" },
        contentTitle: { es: "Una comunidad que cuida un jardín", de: "Eine Gemeinschaft pflegt einen Garten", en: "A community caring for a garden" },
        contentBody: {
          es: "Las historias pequeñas de colaboración suelen devolver confianza en lo cercano.",
          de: "Kleine Geschichten der Zusammenarbeit geben oft Vertrauen in das Nahe zurück.",
          en: "Small stories of cooperation often restore faith in the people nearby.",
        },
      },
      {
        topic: { es: "Cultura que viaja sin moverse", de: "Kultur, die reist ohne zu reisen", en: "Culture that travels without moving" },
        opener: {
          es: "A veces una buena noticia viene de la cultura. ¿Te gusta descubrir tradiciones de otros lugares?",
          de: "Manchmal kommt eine gute Nachricht aus der Kultur. Entdeckst du gern Traditionen anderer Orte?",
          en: "Sometimes the good story of the day comes from culture. Do you enjoy discovering traditions from other places?",
        },
        quote: {
          es: "Una noticia cultural también puede ampliar el corazón.",
          de: "Auch eine Kulturmeldung kann das Herz erweitern.",
          en: "A cultural story can widen the heart too.",
        },
        activityType: "discussion",
        contentTag: { es: "Mirada abierta", de: "Offener Blick", en: "Open perspective" },
        contentTitle: { es: "Una fiesta, un oficio, una costumbre", de: "Ein Fest, ein Handwerk, eine Gewohnheit", en: "A festival, a craft, a custom" },
        contentBody: {
          es: "Un detalle cultural puede abrir una conversación preciosa.",
          de: "Ein kulturelles Detail kann ein schönes Gespräch öffnen.",
          en: "One cultural detail can open a beautiful conversation.",
        },
      },
      {
        topic: { es: "Inventos discretos que ayudan", de: "Stille Erfindungen, die helfen", en: "Quiet inventions that help" },
        opener: {
          es: "Hoy traigo una idea ingeniosa que mejora la vida cotidiana. ¿Te gustan las soluciones sencillas?",
          de: "Heute habe ich eine kluge Idee dabei, die den Alltag verbessert. Magst du einfache Lösungen?",
          en: "Today I’m bringing a clever idea that improves daily life. Do you enjoy simple solutions?",
        },
        quote: {
          es: "La innovación también puede ser amable.",
          de: "Innovation kann auch freundlich sein.",
          en: "Innovation can be gentle too.",
        },
        activityType: "advice",
        contentTag: { es: "Idea útil", de: "Nützliche Idee", en: "Useful idea" },
        contentTitle: { es: "Pequeñas mejoras, gran comodidad", de: "Kleine Verbesserungen, großer Komfort", en: "Small improvements, big comfort" },
        contentBody: {
          es: "Las buenas ideas suelen resolver un problema sin complicar nada más.",
          de: "Gute Ideen lösen oft ein Problem, ohne etwas anderes schwerer zu machen.",
          en: "Good ideas often solve one problem without making anything else harder.",
        },
      },
    ],
  },
  {
    slug: "pen-pals",
    names: { es: "Amigos por Correspondencia", de: "Die Brieffreunde", en: "Pen Pals" },
    category: "connection",
    agentSlug: "vyva",
    agentFullName: "VYVA Conecta",
    agentColour: "#5B21B6",
    agentCredential: {
      es: "Matching por intereses",
      de: "Matching nach Interessen",
      en: "Matching by interests",
    },
    ctaLabel: { es: "Conocer a alguien", de: "Jemanden kennenlernen", en: "Meet someone" },
    topicTags: ["friendship", "matching", "conversation"],
    timeSlots: ["morning", "afternoon", "evening"],
    featured: false,
    dailyTopics: [
      {
        topic: { es: "Empezar una conversación amable", de: "Ein freundliches Gespräch beginnen", en: "Starting a warm conversation" },
        opener: {
          es: "Puedo ayudarte a encontrar a alguien con intereses parecidos. ¿Te gustaría empezar por una afición compartida?",
          de: "Ich kann dir helfen, jemanden mit ähnlichen Interessen zu finden. Möchtest du mit einer gemeinsamen Vorliebe beginnen?",
          en: "I can help you meet someone with similar interests. Would you like to begin with a shared hobby?",
        },
        quote: {
          es: "A veces una buena amistad empieza con una pregunta sencilla.",
          de: "Manchmal beginnt eine gute Freundschaft mit einer einfachen Frage.",
          en: "Sometimes a good friendship begins with one simple question.",
        },
        activityType: "discussion",
        contentTag: { es: "Conexión sugerida", de: "Vorgeschlagene Verbindung", en: "Suggested connection" },
        contentTitle: { es: "Hablar de aficiones favoritas", de: "Über Lieblingshobbys sprechen", en: "Talk about favourite hobbies" },
        contentBody: {
          es: "Las conversaciones resultan más fáciles cuando nacen de algo que ambos disfrutan.",
          de: "Gespräche sind leichter, wenn sie aus etwas entstehen, das beide mögen.",
          en: "Conversation feels easier when it grows from something both people already enjoy.",
        },
      },
      {
        topic: { es: "Una pregunta para romper el hielo", de: "Eine Frage zum Eisbrechen", en: "A question to break the ice" },
        opener: {
          es: "Una buena pregunta abre muchas puertas. ¿Cuál es un tema amable con el que te gusta empezar?",
          de: "Eine gute Frage öffnet viele Türen. Mit welchem freundlichen Thema beginnst du gern?",
          en: "One good question opens many doors. What gentle topic do you like to start with?",
        },
        quote: {
          es: "La curiosidad amable hace sitio a la amistad.",
          de: "Freundliche Neugier macht Platz für Freundschaft.",
          en: "Kind curiosity makes space for friendship.",
        },
        activityType: "challenge",
        contentTag: { es: "Primer paso", de: "Erster Schritt", en: "First step" },
        contentTitle: { es: "Comparte una rutina que disfrutas", de: "Teile eine schöne Gewohnheit", en: "Share one routine you enjoy" },
        contentBody: {
          es: "Las rutinas cotidianas suelen ser un buen puente entre personas.",
          de: "Alltägliche Gewohnheiten sind oft eine gute Brücke zwischen Menschen.",
          en: "Everyday routines are often a lovely bridge between people.",
        },
      },
      {
        topic: { es: "La conversación como compañía", de: "Gespräch als Begleitung", en: "Conversation as companionship" },
        opener: {
          es: "No buscamos perfección, sólo una charla agradable. ¿Qué te hace sentir cómodo al conocer a alguien?",
          de: "Wir suchen keine Perfektion, nur ein angenehmes Gespräch. Was lässt dich beim Kennenlernen wohlfühlen?",
          en: "We’re not looking for perfection, only a pleasant chat. What helps you feel comfortable meeting someone new?",
        },
        quote: {
          es: "La buena compañía puede empezar despacio.",
          de: "Gute Gesellschaft darf langsam beginnen.",
          en: "Good company is allowed to begin slowly.",
        },
        activityType: "advice",
        contentTag: { es: "VYVA sugiere", de: "VYVA empfiehlt", en: "VYVA suggests" },
        contentTitle: { es: "Empieza con algo sencillo", de: "Beginne mit etwas Einfachem", en: "Begin with something simple" },
        contentBody: {
          es: "Una afición, una comida favorita o un paseo bonito suelen bastar.",
          de: "Ein Hobby, ein Lieblingsessen oder ein schöner Spaziergang reichen oft völlig aus.",
          en: "A hobby, a favourite food, or a lovely walk is often more than enough.",
        },
      },
    ],
  },
  {
    slug: "heritage-exchange",
    names: { es: "El Intercambio Cultural", de: "Der Kulturaustausch", en: "Heritage Exchange" },
    category: "connection",
    agentSlug: "vyva",
    agentFullName: "VYVA Conecta",
    agentColour: "#5B21B6",
    agentCredential: {
      es: "Matching por intereses",
      de: "Matching nach Interessen",
      en: "Matching by interests",
    },
    ctaLabel: { es: "Compartir cultura", de: "Kultur teilen", en: "Share culture" },
    topicTags: ["culture", "heritage", "traditions", "travel"],
    timeSlots: ["afternoon", "evening"],
    featured: false,
    dailyTopics: [
      {
        topic: { es: "Tradiciones que merece la pena contar", de: "Traditionen, die erzählt werden wollen", en: "Traditions worth sharing" },
        opener: {
          es: "Las costumbres familiares conectan mucho. ¿Qué tradición te gustaría contar hoy a otra persona?",
          de: "Familientraditionen verbinden stark. Welche Tradition würdest du heute gern jemand anderem erzählen?",
          en: "Family traditions connect people beautifully. Which tradition would you enjoy sharing today?",
        },
        quote: {
          es: "Compartir una costumbre es compartir una parte de ti.",
          de: "Eine Gewohnheit zu teilen heißt, einen Teil von dir zu teilen.",
          en: "Sharing a tradition is sharing a part of yourself.",
        },
        activityType: "discussion",
        contentTag: { es: "Tema puente", de: "Brückenthema", en: "Bridge topic" },
        contentTitle: { es: "Una comida, una canción, una fiesta", de: "Ein Essen, ein Lied, ein Fest", en: "A meal, a song, a celebration" },
        contentBody: {
          es: "Estos temas suelen unir rápido porque despiertan recuerdos felices.",
          de: "Diese Themen verbinden schnell, weil sie glückliche Erinnerungen wecken.",
          en: "These themes connect quickly because they wake happy memories.",
        },
      },
      {
        topic: { es: "Un lugar que llevas contigo", de: "Ein Ort, den du in dir trägst", en: "A place you carry with you" },
        opener: {
          es: "Hay lugares que siguen viviendo dentro de nosotros. ¿Cuál te gustaría describir a alguien nuevo?",
          de: "Es gibt Orte, die in uns weiterleben. Welchen würdest du jemand Neuem gern beschreiben?",
          en: "Some places keep living inside us. Which one would you enjoy describing to someone new?",
        },
        quote: {
          es: "Los lugares también pueden presentarnos a otras personas.",
          de: "Auch Orte können uns einander vorstellen.",
          en: "Places can introduce us to one another too.",
        },
        activityType: "story",
        contentTag: { es: "Intercambio abierto", de: "Offener Austausch", en: "Open exchange" },
        contentTitle: { es: "Describe lo que se veía y se olía", de: "Beschreibe, was man sah und roch", en: "Describe what you could see and smell" },
        contentBody: {
          es: "Los sentidos suelen volver la historia más viva y cercana.",
          de: "Sinne machen eine Geschichte oft lebendiger und näher.",
          en: "The senses often make the story feel closer and more alive.",
        },
      },
      {
        topic: { es: "Objetos con historia", de: "Gegenstände mit Geschichte", en: "Objects with a story" },
        opener: {
          es: "A veces un objeto pequeño guarda un mundo entero. ¿Hay alguno con historia especial para ti?",
          de: "Manchmal bewahrt ein kleiner Gegenstand eine ganze Welt. Gibt es einen mit besonderer Geschichte für dich?",
          en: "Sometimes a small object holds an entire world. Is there one with a special story for you?",
        },
        quote: {
          es: "Los objetos también saben conversar.",
          de: "Auch Gegenstände wissen zu erzählen.",
          en: "Objects know how to start conversations too.",
        },
        activityType: "story",
        contentTag: { es: "Historia compartida", de: "Geteilte Geschichte", en: "Shared story" },
        contentTitle: { es: "Cuenta de quién era y por qué sigue contigo", de: "Erzähle, wem es gehörte und warum es blieb", en: "Say who it belonged to and why it stayed" },
        contentBody: {
          es: "Un objeto querido puede ser una preciosa puerta a la conversación.",
          de: "Ein geliebter Gegenstand ist oft eine wunderschöne Tür zum Gespräch.",
          en: "A treasured object can be a beautiful doorway into conversation.",
        },
      },
    ],
  },
];

export function getTimeSlotFromDate(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function getSocialRoomBySlug(slug: string) {
  return socialRoomSeeds.find((room) => room.slug === slug) ?? null;
}

export function buildDailyRoomSession(room: SocialRoomSeed, language: LanguageCode, date = new Date()) {
  const index = Math.abs(date.getDay()) % room.dailyTopics.length;
  const topic = room.dailyTopics[index];

  return {
    sessionDate: date.toISOString().slice(0, 10),
    topic: localize(topic.topic, language),
    opener: localize(topic.opener, language),
    quote: localize(topic.quote, language),
    activityType: topic.activityType,
    contentTag: localize(topic.contentTag, language),
    contentTitle: localize(topic.contentTitle, language),
    contentBody: localize(topic.contentBody, language),
    options: topic.options ? localize(topic.options, language) : [],
  };
}

export function localizeRoom(room: SocialRoomSeed, language: LanguageCode) {
  return {
    slug: room.slug,
    name: localize(room.names, language),
    category: room.category,
    agentSlug: room.agentSlug,
    agentFullName: room.agentFullName,
    agentColour: room.agentColour,
    agentCredential: localize(room.agentCredential, language),
    ctaLabel: localize(room.ctaLabel, language),
    topicTags: room.topicTags,
    timeSlots: room.timeSlots,
    featured: room.featured,
  };
}
