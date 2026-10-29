export const whatsappUrl = "https://wa.link/o13enw";
/** Same number wa.link points to; used to open a chat with a prefilled message. */
export const whatsappNumber = "542616577260";

export const office = {
  building: "Galería San Marcos",
  street: "Sarmiento 133, Local 18",
  city: "Mendoza",
  /** Google Business Profile share link. */
  mapsUrl: "https://share.google/a2dy5Q96VbijmgYba",
};

export const navLinks = [
  { href: "#planesfo", label: "Planes" },
  { href: "#somos", label: "Nosotros" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#preguntas", label: "Preguntas" },
  { href: "#contactanos", label: "Contacto" },
];

type Stat = {
  /** Numbers count up when scrolled into view; strings render as-is. */
  value: number | string;
  prefix?: string;
  unit?: string;
  label: string;
};

export const stats: Stat[] = [
  { value: 7000, prefix: "+", label: "Clientes que ya navegan con Bigway" },
  { value: 5, prefix: "+", unit: "años", label: "En el mercado" },
  {
    value: "Gran Mendoza",
    label: "Disponibilidad en toda el área metropolitana",
  },
];

/** Snapshot of the Google Business Profile; update by hand when it changes. */
export const reviewSummary = { rating: 4.2, count: 153 };

/** Curated Google reviews, quoted verbatim. Authors shown as first name + initial for privacy. */
export const reviews = [
  {
    author: "Zahír A.",
    text: "Perfecto el técnico que vino se tomó todo el tiempo para dejar bien el servicio, muy buena experiencia",
  },
  {
    author: "Cintia P.",
    text: "Agustin. Muy eficiente. Hizo todo lo que tenia a su alcance para arreglar, no hizo todo rápido y se fue sin más. Verificó todo perfectamente",
  },
  {
    author: "Martín M.",
    text: "Muchas gracias por la atencion, cada vez que tengo un problema me lo solucionan rapido, buena relacion precio calidad!",
  },
  {
    author: "Lorena P.",
    text: "Muy rápido y bueno el servicio. Explicaciones que no sabíamos. Excelente",
  },
  {
    author: "Diego D.",
    text: "Muy buen servicio muy atento muy educado agradezco su servicio",
  },
];

export type Technology = "fibra" | "wireless";

export const technologyLabels: Record<Technology, string> = {
  fibra: "Fibra óptica",
  wireless: "Wireless",
};

type Plan = {
  speed: number;
  technology: Technology;
  /** Promotional monthly price in ARS, IVA included. */
  price: number;
  /** Monthly price in ARS once the promotion ends, IVA included. */
  regularPrice: number;
};

type PlanGroup = {
  id: string;
  label: string;
  /** Short line shown on every card of the group. */
  caption: string;
  /** Bundles Noova IPTV with the internet plan. */
  noova: boolean;
  /** Optional help card that fills the row when the group has few plans. */
  note?: { title: string; text: string };
  plans: Plan[];
};

export const planGroups: PlanGroup[] = [
  {
    id: "fibra",
    label: "Fibra óptica",
    caption: "Velocidad simétrica",
    noova: false,
    plans: [
      { speed: 100, technology: "fibra", price: 17929, regularPrice: 32599 },
      { speed: 300, technology: "fibra", price: 19029, regularPrice: 34599 },
      { speed: 500, technology: "fibra", price: 20404, regularPrice: 37099 },
      { speed: 600, technology: "fibra", price: 20954, regularPrice: 38099 },
    ],
  },
  {
    id: "wireless",
    label: "Wireless",
    caption: "Velocidad de bajada",
    noova: false,
    note: {
      title: "¿Fibra o wireless?",
      text: "La tecnología disponible depende de tu zona. Dejanos tus datos y te decimos qué llega a tu domicilio.",
    },
    plans: [
      { speed: 15, technology: "wireless", price: 16939, regularPrice: 30799 },
      { speed: 25, technology: "wireless", price: 17874, regularPrice: 32499 },
    ],
  },
  {
    id: "noova",
    label: "Combos con Noova",
    caption: "Incluye TV por Internet (IPTV)",
    noova: true,
    plans: [
      { speed: 100, technology: "fibra", price: 36099, regularPrice: 48132 },
      { speed: 300, technology: "fibra", price: 37199, regularPrice: 49598 },
      { speed: 500, technology: "fibra", price: 36399, regularPrice: 51998 },
      { speed: 25, technology: "wireless", price: 38999, regularPrice: 51998 },
    ],
  },
];
