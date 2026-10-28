export const whatsappUrl = "https://wa.link/o13enw";

export const navLinks = [
  { href: "#somos", label: "Nosotros" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#planesfo", label: "Planes" },
  { href: "#contactanos", label: "Contacto" },
];

type Plan = {
  name: string;
  speed: number;
  /** Final monthly price in ARS, taxes included. `null` hides it on the card. */
  price: number | null;
  featured: boolean;
};

export const plans: Plan[] = [
  { name: "Basic", speed: 25, price: 10000, featured: false },
  { name: "Speed", speed: 50, price: 12000, featured: false },
  { name: "High Speed", speed: 100, price: 15000, featured: false },
  { name: "Full", speed: 300, price: 30000, featured: true },
];
