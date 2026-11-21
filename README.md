# Pistacjonka – smart planner dla studentów

> Planuj, skupiaj się, piecz pistacjonki.

**Pistacjonka** to planer zadań (to-do) dla studentów, inspirowany cynamonką z kremem pistacjowym, czyli *pistacjonką*. Nie jest zwykłą listą: sam proponuje, czym zająć się dziś, pilnuje terminów i obciążenia dnia, uczy się, jak trafnie szacujesz czas, a każda ukończona sesja skupienia (Pomodoro) to jedna **upieczona pistacjonka** w Twojej kolekcji.

Projekt na zadanie eliminacyjne **SmartApp**.

---

## Spis treści

- [Uruchomienie](#uruchomienie)
- [Wymagania konkursowe – status](#wymagania-konkursowe--status)
- [Import i eksport JSON](#import-i-eksport-json)
- [Co dodaliśmy od siebie i dlaczego](#co-dodaliśmy-od-siebie-i-dlaczego)
- [Wszystkie funkcje](#wszystkie-funkcje)
- [Technologie i architektura](#technologie-i-architektura)
- [Własne grafiki](#własne-grafiki)
- [Co działa, a czego nie zdążyliśmy](#co-działa-a-czego-nie-zdążyliśmy)

---

## Uruchomienie

Wymagany **Node.js 20+** (testowane na Node 22 LTS) i npm.

```bash
npm install
npm run dev
```

Aplikacja wystartuje pod adresem **http://localhost:5173**.

Inne komendy:

```bash
npm run build     # wersja produkcyjna do katalogu dist/
npm run preview   # podgląd zbudowanej wersji (http://localhost:4173)
npm test          # testy jednostkowe (import/eksport JSON, sugestie, timer, statystyki)
```

Zbudowana aplikacja (`dist/`) to statyczna strona – można ją wrzucić na GitHub Pages, Netlify itp. (używamy `HashRouter` i ścieżek względnych, więc działa z dowolnego podkatalogu).

**Pierwsze kroki:** na ekranie startowym kliknij *„Wczytaj zadania z pliku JSON”* (Wasz plik `zadania.json`) albo *„Wypróbuj na przykładowych zadaniach”* (plik `public/zadania-przyklad.json` w tym samym formacie).

---

## Wymagania konkursowe – status

| Wymaganie | Status | Gdzie |
|---|---|---|
| Lista zadań | ✅ | Backlog, Dziś, Kanban, Kalendarz, Oś czasu |
| Dodawanie zadania | ✅ | Przycisk „Nowe zadanie”, szybkie dodawanie w każdym widoku |
| Edycja zadania | ✅ | Kliknięcie zadania → panel szczegółów (wszystkie pola edytowalne) |
| Wykreślanie jako zrobione i cofanie | ✅ | Okrągły „checkbox”, Kanban, panel szczegółów; toast z „Cofnij” |
| Usuwanie zadania | ✅ | Panel szczegółów → „Usuń” (z potwierdzeniem) |
| Wczytanie zadań z pliku JSON | ✅ | Backlog / Ustawienia / ekran startowy → „Importuj JSON” |
| Zapis zadań do JSON w tym samym formacie | ✅ | Backlog / Ustawienia → „Eksportuj JSON” |
| README: uruchomienie, co działa, co dodaliśmy | ✅ | ten plik |

---

## Import i eksport JSON

Format zgodny 1:1 z zadaniem:

```json
{
  "wersja": 1,
  "zadania": [
    { "id": 1, "tytul": "Kolokwium z sieci komputerowych", "opis": "Rozdziały 3–5",
      "termin": "2026-11-18", "priorytet": "wysoki", "wykonane": false, "tagi": ["studia"] }
  ]
}
```

**Eksport** (`src/lib/contestJson.ts`) zapisuje *dokładnie* pola `wersja` i `zadania[]` z kluczami `id, tytul, opis, termin, priorytet, wykonane, tagi`, w tej kolejności. Nie dodajemy żadnych innych pól. Wszystko, co aplikacja wie ponad format (podzadania, planowana data, szacowany czas, sesje Pomodoro, kolory tagów), trzymamy osobno w `localStorage`. Można to też pobrać jako osobną **pełną kopię zapasową** (Ustawienia → Dane).

**Import:**

- wybór pliku → walidacja → okno z podsumowaniem (liczba zadań, wykonanych, z terminem, tagów) i listą ostrzeżeń;
- obsługuje: pusty opis, pustą listę tagów, `termin: null`, pustą listę zadań, BOM na początku pliku;
- toleruje drobne błędy i opisuje je w oknie: `"Średni"`/`"SREDNI"` → `sredni`, `"wykonane": "true"`, `opis: null`, niepoprawną datę (→ brak terminu), zdublowane lub brakujące `id` (→ nowe, unikalne id);
- odrzuca z czytelnym komunikatem: niepoprawny JSON, brak tablicy `zadania`, zadania bez tytułu;
- dwa tryby:
  - **Zastąp listę zadań**: lista staje się dokładnie taka jak w pliku, a **id zostają bez zmian**, więc import → eksport daje identyczny plik. Zadania o tym samym id i tytule zachowują podzadania, plan i historię czasu.
  - **Dołącz do obecnych**: konfliktujące id dostają nowe numery, a identyczne zadania (ten sam tytuł i termin) są pomijane.
- nieznane tagi z pliku tworzą się automatycznie (z kolorem).

Poprawność sprawdzają testy (`npm test`): import przykładowego pliku bez ostrzeżeń, **round-trip import → eksport = identyczny JSON**, brak dodatkowych pól w eksporcie, obsługa błędnych danych.

---

## Co dodaliśmy od siebie i dlaczego

Lista zadań sama nie mówi studentowi, **od czego zacząć** ani **czy da radę**. Chcieliśmy planera, który myśli razem z nim, ale nie decyduje za niego. Do tego motyw naszej drużyny: pistacjonka. Sesje skupienia to wypieki, a kolekcja ma motywować bardziej niż suchy licznik.

### 1. Sugestie na dziś – przejrzysty algorytm punktowy
`src/lib/suggestions.ts`. Każde niewykonane zadanie dostaje punkty, a **użytkownik widzi, za co**, np. *„Po terminie od 3 dni +62 · Wysoki priorytet +25”*:

| Reguła | Punkty |
|---|---|
| po terminie | +50 i +4 za każdy dzień (max +30) |
| deadline dziś / jutro / ≤3 dni / ≤7 dni | +40 / +30 / +20 / +10 |
| priorytet wysoki / średni / niski | +25 / +12 / +4 |
| już w trakcie (In Progress) | +15 |
| „wypadło” z wcześniejszego planu | +15 |
| zaplanowane na później | −15 |
| część podzadań zrobiona | +6 |
| szybkie (≤30 min, po korekcie) | +8 |
| duże (≥2 h) i deadline ≤5 dni – „zacznij wcześniej” | +12 |
| nie zmieści się w pozostałej pojemności dnia | −20 |
| czeka w backlogu ≥14 dni bez dat | +5 |

Wykonane zadania i te już zaplanowane na dziś są wykluczone. Liczba propozycji maleje, gdy dzień się zapełnia. Nic nie jest planowane automatycznie: sugestię przyjmujesz przyciskiem **„Do planu”** albo odrzucasz **„Nie dziś”** (do jutra).

### 2. Deadline ≠ planowana data
Każde zadanie ma **termin** (do kiedy) i osobną **planowaną datę realizacji** (kiedy zamierzam to zrobić). Plan dnia, tydzień w kalendarzu i oś czasu opierają się na planie, a ostrzeżenia na terminie. Gdy zaplanujesz coś po deadlinie, aplikacja o tym powie.

### 3. Pojemność dnia i obciążenie
W ustawieniach ustawiasz, ile realnie chcesz pracować dziennie (domyślnie 4 h, maks. 6 zadań). Każdy dzień w tygodniowym planerze ma pasek obciążenia. Ekran „Dziś” pokazuje, ile już zaplanowano, a sugestie karzą zadania, które się nie zmieszczą.

### 4. Osobisty współczynnik estymacji
Studenci notorycznie nie doszacowują czasu. Pistacjonka porównuje szacowany czas z rzeczywistym (z timera i wpisów ręcznych) na ukończonych zadaniach i liczy współczynnik, np. **×1.4**. Używa go przy obciążeniu dnia i sugestiach. W szczegółach zadania pokazuje: *„Twoja historia: realnie ~70 min”*.

### 5. Pieczenie pistacjonek (Pomodoro)
- **1 ukończona sesja pracy = 1 pistacjonka.** Przerwa ani przerwana sesja nie dają pistacjonki (przerwana sesja zapisuje jednak przepracowany czas w statystykach).
- Timer **liczy czas ze znaczników czasu**, a nie przez odliczanie w interfejsie. Stan (start, pauzy, zebrany czas) jest w `localStorage`, więc odświeżenie strony, zamknięcie karty czy uśpienie komputera nic nie psuje. Po powrocie sesja domyka się z poprawną godziną zakończenia.
- Pauza i wznowienie, krótka i długa przerwa (co N sesji), dzwonek z Web Audio, opcjonalne powiadomienia systemowe, pozostały czas w tytule karty, pływający mini-timer w każdym widoku.
- Start sesji z poziomu zadania („Upiecz pistacjonkę”) automatycznie przenosi je do *In Progress*.
- **Witryna**: kolekcja pistacjonek pogrupowana po dniach (z zadaniem i godziną), seria dni z rzędu, animacja „wyjęcia z pieca” po sesji.

### 6. Szybkie dodawanie z mini-składnią
`Lab 7 z PO #studia !wysoki @piątek ~45m` → tytuł, tag, priorytet, deadline (dziś/jutro/pojutrze/dni tygodnia/`25.11`/`2026-11-25`) i szacowany czas. Podgląd rozpoznanych elementów pojawia się na bieżąco.

### 7. Statystyki z prawdziwych danych
Żadnych przykładowych liczb: wszystko wynika z zadań (`completedAt`) i sesji. Do każdego dnia (z kalendarza, mapy aktywności, wykresu albo wybieraka dat) są **szczegółowe statystyki**: czas pracy, sesje, pistacjonki, wykonane zadania, co zostało.

---

## Wszystkie funkcje

**Dziś (dashboard):** powitanie i data, pierścień postępu planu dnia, czas pracy i pistacjonki dziś, „najważniejsze dziś”, plan dnia z szybkim dodawaniem, obciążenie vs pojemność, zadania po terminie (z „zaplanuj na dziś”), sugestie z uzasadnieniem, terminy w najbliższych 7 dniach, komunikaty motywacyjne zależne od postępu.

**Zadania:** tytuł, opis, deadline, planowana data, priorytet (niski/średni/wysoki), status (To Do / In Progress / Done), wiele tagów, podzadania z paskiem postępu (np. 2/4 – 50%), szacowany i rzeczywisty czas, dopisywanie czasu ręcznie, data utworzenia i ukończenia, historia sesji Pomodoro.

**Backlog:** wyszukiwanie (tytuł, opis, tagi, podzadania; bez polskich znaków też działa), filtry: status, priorytet, tagi (wiele naraz), niezaplanowane / po terminie / bez terminu; sortowanie: priorytet, deadline, data utworzenia, nazwa (+ odwrócenie); szybkie dodawanie; import/eksport.

**Kanban:** trzy kolumny, **drag & drop** (mysz i dotyk) oraz strzałki jako alternatywa z klawiatury; zmiana statusu działa w całej aplikacji; „Cofnij” po oznaczeniu jako zrobione.

**Kalendarz:**
- *Miesiąc*: deadline’y, zaplanowane, wykonane i przeterminowane zadania z kolorami priorytetów; liczba pistacjonek w danym dniu; klik w dzień otwiera panel dnia; dwuklik dodaje zadanie na ten dzień.
- *Tydzień (planowanie dniami)*: przeciąganie zadań z „Niezaplanowanych” na dni i między dniami (oraz z powrotem), pasek obciążenia dnia, deadline’y w nagłówkach, nawigacja w przeszłość i przyszłość.
- *Dzień*: pełny panel dnia ze statystykami i dodawaniem zadań.

**Oś czasu (Gantt):** pasek od planowanego startu do deadline’u, kolor priorytetu, ikona terminu, kreskowanie przy planie po terminie. **Przeciąganie paska** przesuwa obie daty, lewy uchwyt zmienia planowany start, prawy zmienia deadline. Zakres 2/4/6 tygodni, linia „dziś”, klik otwiera szczegóły.

**Statystyki:** dziś (czas, wykonane, sesje, pistacjonki, co zostało), wykresy aktywności dla 7 i 30 dni (minuty skupienia, wykonane zadania; klik w słupek otwiera dzień), mapa aktywności z 18 tygodni, rozkład statusów, szacowany vs rzeczywisty czas (z osobistym współczynnikiem), czas wg tagów, sumy (czas, zadania, pistacjonki), panel dowolnego dnia.

**Ustawienia:** imię, pojemność dnia, limit zadań, długości sesji i przerw, długa przerwa co N sesji, auto-start przerwy, dźwięk, powiadomienia; zarządzanie tagami (tworzenie, zmiana nazwy, kolor, usuwanie); import/eksport JSON, pełna kopia zapasowa i przywracanie, czyszczenie danych; lista miejsc na grafiki.

**UX:** animacje przejść, toasty z „Cofnij”, potwierdzenia usuwania, puste stany, ostrzeżenia o terminach, paski postępu, responsywny układ (boczne menu na desktopie, dolna nawigacja na telefonie), obsługa klawiatury (Enter, Esc, fokus), `prefers-reduced-motion`.

---

## Technologie i architektura

- **React 19 + TypeScript + Vite**
- **Tailwind CSS 4**: własny system kolorów (pistacja, krem, beż, karmel, cynamon) w `src/index.css`
- **zustand** (+ `persist`): stan aplikacji zapisywany w `localStorage`
- **@dnd-kit/core**: drag & drop (Kanban, planer tygodnia)
- **recharts**: wykresy (ładowane dopiero w widoku statystyk)
- **date-fns** (lokalizacja `pl`), **lucide-react** (ikony), **react-router** (HashRouter)
- Fonty **Fraunces** i **Manrope** dołączone lokalnie (działa offline)
- **Vitest**: testy logiki

```
src/
  types.ts                 – model danych
  lib/                     – logika biznesowa (bez Reacta, testowalna)
    contestJson.ts         – import/eksport formatu konkursowego + walidacja
    suggestions.ts         – algorytm sugestii i obciążenie dnia
    pomodoro.ts            – timer oparty na znacznikach czasu
    stats.ts               – statystyki dzienne, serie, seria dni
    quickAdd.ts            – parser szybkiego dodawania
    taskUtils.ts, dates.ts, backup.ts, sound.ts
    logic.test.ts          – testy
  store/                   – useStore (dane, trwałe), useUI (modale, toasty)
  components/              – UI: ui/, task/, layout/, ImportExport, DayPanel
  pages/                   – Today, Backlog, Kanban, Calendar, Timeline, Bakery, Stats, Settings
  config/images.ts         – miejsca na własne grafiki
public/
  zadania-przyklad.json    – przykładowe zadania w formacie konkursowym
  images/                  – tu trafiają Wasze grafiki
```

---

## Własne grafiki

Aplikacja **nie zawiera żadnych wygenerowanych obrazów**. W miejscach na grafiki są placeholdery (kreskowana ramka z nazwą pliku albo abstrakcyjny „żeton” pistacjonki z gradientów CSS). Podmiana:

1. Wrzuć plik do `public/images/`, np. `public/images/pistacjonka.png`.
2. W `src/config/images.ts` ustaw `src: 'images/pistacjonka.png'` przy odpowiednim slocie.

| Slot | Gdzie | Sugerowany plik |
|---|---|---|
| `pistacjonka` | kolekcja, liczniki, animacja po sesji, piekarnik w przerwie | 512×512 PNG, przezroczyste tło |
| `ciasto` | piekarnik podczas sesji, mini-timer | 512×512 PNG, przezroczyste tło |
| `hero` | ekran „Dziś” i ekran powitalny | 1200×800 JPG |
| `logo` | nawigacja | 128×128 PNG |
| `pusto` | puste listy | 400×300 PNG |
| `gotowe` | ekran „Dziś”, gdy cały plan dnia jest wykonany | 400×300 PNG |

---

## Co działa, a czego nie zdążyliśmy

**Działa i jest przetestowane** (ręcznie w przeglądarce + `npm test`):
dodawanie, edycja, usuwanie, oznaczanie i cofanie wykonania; import (z walidacją i obu trybami) i eksport JSON zgodny ze schematem; podzadania z postępem; tagi z kolorami; filtrowanie i sortowanie; sugestie; planowanie dniami z przeciąganiem; kalendarz (miesiąc, tydzień, dzień); Kanban z drag & drop; oś czasu z przeciąganiem; timer Pomodoro odporny na odświeżenie (pistacjonka tylko za pełną sesję); statystyki dzienne, historyczne i dla dowolnego dnia; trwałość danych po odświeżeniu; widok mobilny (375 px) bez poziomego przewijania.

**Ograniczenia / czego nie zdążyliśmy:**
- Dane są lokalne (`localStorage` w przeglądarce), bez kont i synchronizacji między urządzeniami. Przenoszenie danych: pełna kopia zapasowa.
- Kolejność kart w obrębie kolumny Kanbana wynika z priorytetu i terminu; ręczne sortowanie przeciąganiem nie jest zapisywane.
- Nie ma zadań cyklicznych ani przypomnień o terminach poza aplikacją (powiadomienia działają tylko dla timera).
- Brak trybu ciemnego: celowo trzymamy się kremowej, „cukierniczej” estetyki.
- Grafiki pistacjonek dodamy sami (placeholdery są gotowe).
- Pomysły na dalszy rozwój: automatyczne rozłożenie dużego zadania na kilka dni przed deadlinem (na podstawie szacunku i pojemności dni), eksport planu do kalendarza (.ics), wspólne „piekarnie” dla grup projektowych.
