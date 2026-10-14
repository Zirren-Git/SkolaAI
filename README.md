# Parvis — kombinatorisk kalkylator

En komplett, klientbaserad webbapp för att utforska kombinationer av talpar. Byggd med **React, TypeScript, Vite och TailwindCSS**, med ett Windows/WinUI-inspirerat gränssnitt på svenska.

## Windows: kör utan installation eller kompilering

Hämta **`Parvis-1.0.0-win-x64.exe`** från [releasen v1.0.0](https://github.com/Zirren-Git/SkolaAI/releases/tag/v1.0.0) och dubbelklicka på filen.

- Windows 10/11, **x64**. Ingen separat Node.js-, npm-, Electron- eller webbläsarinstallation krävs.
- En enda nedladdad körbar fil med hela appen och Electron inbyggt. Den packar automatiskt upp körfiler i en temporär katalog vid start; ingen installation eller administratörsbehörighet krävs.
- Alla beräkningar fungerar offline. Temainställningen sparas i användarens lokala programdata. CSV-exporten har en vanlig spara-dialog.
- Filen är **osignerad**. Windows SmartScreen eller antivirus kan varna. Kontrollera att den kommer från rätt GitHub-release innan du kör den.
- `SHA256SUMS.txt` finns i releasen. Kontrollera filens hash med PowerShell: `Get-FileHash .\Parvis-1.0.0-win-x64.exe -Algorithm SHA256`.
- Den versionsmärkta källkoden finns under **Source code (zip)** och **Source code (tar.gz)** i samma release.

## Bygg desktopversionen från källkod (endast för utvecklare)

På Windows, med Node.js 22.12 eller senare:

```bash
npm ci
npm test
npm run package:win
```

Den portabla filen skapas i `build/desktop/`. `npm run desktop` startar desktopappen från källkod. Slutanvändaren behöver **inte** utföra dessa steg.

GitHub Actions-flödet `.github/workflows/windows-release.yml` bygger på en Windows-runner, testar den paketerade appen och startar dessutom den portabla EXE-filen ensam från en tom katalog. Först därefter laddas EXE och SHA-256-kontrollsumman upp som byggartefakter. Releasen publiceras separat efter att testerna har godkänts.

## Kör lokalt

Kräver Node.js 22.12 eller senare och npm.

```bash
npm ci
npm run dev
```

Öppna adressen som Vite visar (normalt `http://localhost:5173`). Servern lyssnar på `0.0.0.0` och tillåter Arenas förhandsvisningsdomän. Inga API-nycklar, backendtjänster eller externa typsnitt behövs.

```bash
npm run build     # Typkontroll och produktionsbygge till dist/
npm run preview   # Förhandsvisa produktionsbygget
npm test          # 28 enhetstester av beräkningslogiken
```

Webbläsartester med Playwright:

```bash
npx playwright install chromium
npm run test:e2e
```

På en Linux-maskin utan webbläsarbibliotek kan `npx playwright install --with-deps chromium` behövas. E2E-testerna startar Vite automatiskt om det inte redan körs. `CHROMIUM_EXECUTABLE_PATH` kan användas för en befintlig Chromium-installation.

## Funktioner

- Mata in **ett par per rad**, med ett eget x-värde och y-värde. Lägg till eller ta bort rader med knapparna. Ett tal per fält; använd **punkt för decimaler**.
- Valfria, oberoende maxgränser för de två variablernas summor.
- Fyra sorteringslägen: lägst summa för respektive variabel, högst kvot åt båda håll.
- Filter på ett specifikt par och, som extra funktion, antal par per kombination.
- Omedelbar namnändring i rubriker, tabell, sortering, filter, hjälp och CSV-export. Tomma namn faller tillbaka på x/y.
- Expanderbara rader med parens värden och en förklaring av summorna.
- Paginering och CSV-export av **hela det filtrerade, sorterade resultatet**, inte bara den aktuella sidan.
- Mörkt tema som standard och ett ljust tema. Temavalet sparas lokalt. Reglage är gröna när de är aktiva och röda när de är avstängda, med textstatus och tillgängliga switch-roller.
- Responsiv layout, tangentbordsfokus, tillgängliga fältetiketter och hjälpdialog. Tabellen går att rulla horisontellt på små skärmar.
- Startklart exempel och återställningsknapp. Ändrade indata markeras tydligt tills en ny beräkning görs.
- All beräkning sker lokalt; inga användarvärden skickas till någon server.

## Matematisk tolkning

Begreppet kombination definieras uttryckligen i appens hjälp:

1. Läs de **färdiga paren från inmatningsraderna**. Varje rad är en egen uppsättning med två sammanhörande värden. Värden från olika rader korsas aldrig till nya par.
2. Generera varje **icke-tom delmängd** av dessa par. Ett par används högst en gång i ett urval. Ordningen saknar betydelse. Olika rader får innehålla samma x- och/eller y-värde; även identiska rader är separata valbara par.
3. Summera båda koordinaterna separat. Behåll endast delmängder som uppfyller alla aktiva gränser (`summa <= gräns`).
4. Filtrera och sortera de godkända resultaten.

Exempel: par 1 (A) = `(2, 3)` och par 2 (B) = `(4, 5)` ger **exakt tre kombinationer**: `{A}`, `{B}` och `{A, B}`. Den sista har summorna `(6, 8)`. Paren `(2, 5)` och `(4, 3)` skapas inte. En maxgräns på 4 för x utesluter kombinationen `{A, B}`.

### Noggrannhet och begränsningar

- För n par finns `2^n − 1` möjliga urval. Appen stöder **högst 18 inmatade par**, alltså 262 143 urval. För stora indata ger ett tydligt fel, inte ett tyst avklippt resultat.
- Indata får ha högst sex decimaler och ligga mellan −1 000 000 och 1 000 000. Rader med identiska värden behålls som separata par. Parens nummer ingår i CSV-exporten så att de kan särskiljas.
- Summeringen använder skalade heltal för att undvika att exempelvis `0.1 + 0.2` felaktigt överskrider gränsen `0.3`.
- Negativa värden tillåts. Motorn beskär därför inte en gren bara för att en partiell summa är för hög: ett senare negativt värde kan göra urvalet giltigt.
- Kvoter beräknas som kvoten av **totalsummorna**. Ett positivt/negativt tal delat med noll visas som `∞`/`−∞`. `0/0` visas som `—` och sorteras sist. Visade kvoter avrundas till högst sex decimaler; sorteringen använder den oavrundade kvoten.
- Lika sorteringsvärden får en deterministisk ordning baserad på delmängdens bitmask.

## Kodstruktur

| Fil                        | Ansvar                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/logic.ts`             | Parsning av inmatade par, delmängder, gränser, sortering, filtrering, talformat och CSV. Ingen React-koppling.                 |
| `src/calculator.worker.ts` | Kör den kombinatoriska beräkningen utanför UI-tråden.                                                                          |
| `src/App.tsx`              | UI, formulärstate, delade variabelnamn, resultatvisning, tema och hjälp.                                                       |
| `src/index.css`            | TailwindCSS samt temavariabler, WinUI-inspirerade komponentstilar och mobilanpassning.                                         |
| `src/logic.test.ts`        | 28 enhetstester, inklusive sammanhållna par, identiska rader, decimalgränser, negativa värden, nollkvoter och maximal sökrymd. |
| `e2e/calculator.spec.ts`   | Fem webbläsarflöden för parrader, namn, sortering, filter, export, gränser, mobilvy och teman.                                 |

Korta kommentarer i koden förklarar delmängdsalgoritmen, heltalsskalningen och varför delade namn uppdaterar hela gränssnittet utan omberäkning.

### Desktopstruktur

- `desktop/main.cjs`: sandboxat Electron-fönster och lokalt `parvis://`-protokoll. Renderaren har ingen Node.js-åtkomst och inga externa fönster eller behörigheter tillåts.
- `desktop/THIRD-PARTY-NOTICES.txt`: licensinformation för de paketerade biblioteken. Electron/Chromiums egna licensfiler följer också med i den portabla filen.
- `scripts/desktop-smoke.mjs`: kontrollerar den paketerade appen, Web Worker, par, filter, namn, hjälp, tema, CSV-export och isolering.
- `scripts/portable-smoke.mjs`: kontrollerar att den enda nedladdningsfilen kan startas och beräkna från en tom katalog.

Electron-versionen och paketeringsverktyget är pinnade i `package.json` och alla beroenden är låsta i `package-lock.json`. Uppdatera och säkerhetsgranska dessa inför framtida releaser. Ingen automatisk uppdatering är aktiverad.
