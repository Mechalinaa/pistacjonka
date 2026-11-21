/**
 * MIEJSCA NA WŁASNE GRAFIKI
 * =========================
 * Aplikacja nie zawiera żadnych wygenerowanych obrazów. Każde miejsce na grafikę
 * to „slot”. Aby podmienić placeholder na własny plik:
 *
 *   1. Wrzuć plik do katalogu `public/images/` (np. `public/images/pistacjonka.png`).
 *   2. Wpisz jego nazwę w polu `src` poniżej (np. `src: 'images/pistacjonka.png'`).
 *
 * Gotowe – placeholder zniknie, a w jego miejscu pojawi się grafika.
 * Zalecane formaty: PNG/WebP z przezroczystym tłem (dla pistacjonki) lub JPG (zdjęcia).
 */
export interface ImageSlotConfig {
  /** Ścieżka względna do pliku w `public/` lub null = placeholder. */
  src: string | null
  /** Tekst alternatywny (dostępność). */
  alt: string
  /** Podpowiedź widoczna na placeholderze. */
  hint: string
  /** Sugerowany rozmiar pliku. */
  size: string
}

export const IMAGE_SLOTS = {
  /** Pojedyncza upieczona pistacjonka – kolekcja, licznik, animacja po sesji. */
  pistacjonka: {
    src: null,
    alt: 'Upieczona pistacjonka',
    hint: 'pistacjonka.png',
    size: '512×512, przezroczyste tło',
  },
  /** Surowe ciasto w piekarniku – widok trwającej sesji Pomodoro. */
  ciasto: {
    src: null,
    alt: 'Pistacjonka w piekarniku',
    hint: 'ciasto.png',
    size: '512×512, przezroczyste tło',
  },
  /** Duża grafika powitalna na ekranie „Dziś”. */
  hero: {
    src: null,
    alt: 'Pistacjonki na talerzu',
    hint: 'hero.jpg',
    size: '1200×800',
  },
  /** Logo / sygnet w nawigacji. */
  logo: {
    src: null,
    alt: 'Pistacjonka',
    hint: 'logo.png',
    size: '128×128',
  },
  /** Ilustracja pustych list. */
  pusto: {
    src: null,
    alt: 'Pusty talerzyk',
    hint: 'pusto.png',
    size: '400×300',
  },
  /** Grafika gotowego planu (wszystko zrobione). */
  gotowe: {
    src: null,
    alt: 'Gotowa blacha pistacjonek',
    hint: 'gotowe.png',
    size: '400×300',
  },
} satisfies Record<string, ImageSlotConfig>

export type ImageSlotName = keyof typeof IMAGE_SLOTS
