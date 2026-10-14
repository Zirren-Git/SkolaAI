# Parvis 1.0.0

Första releasen av Parvis: en kombinatorisk kalkylator med fasta par.

## Kör direkt på Windows

1. Ladda ned **Parvis-1.0.0-win-x64.exe** under Assets.
2. Dubbelklicka på filen. Ingen installation, Node.js, npm eller kompilering behövs.

**Plattform:** Windows 10/11, x64. En enda portabel EXE med Electron och hela appen inbyggt. Programmet packar upp sina körfiler temporärt vid start och kräver inte administratörsbehörighet. Beräkningarna fungerar offline.

**Obs:** EXE-filen är osignerad; Windows SmartScreen kan därför visa en varning. Hämta bara filen från denna release. `SHA256SUMS.txt` innehåller filens SHA-256-kontrollsumma, som kan jämföras med `Get-FileHash` i PowerShell.

## Funktioner

- En rad per par, med ett eget x- och y-värde. Värden från olika rader korsas aldrig.
- Alla icke-tomma urval av par, utan återanvändning av samma par i ett urval.
- Valfria maxgränser för båda summorna.
- Fyra sorteringslägen, parfilter och filter på antal par.
- Egna variabelnamn som uppdateras omedelbart i gränssnitt och export.
- Mörkt/ljust tema, resultatdetaljer, paginering och CSV-export.
- Negativa tal, decimaler, nollkvoter och tomma resultat hanteras.
- Högst 18 inmatade par (262 143 möjliga urval).

## Källkod och verifiering

Källkoden för exakt denna version finns under **Source code (zip)** och **Source code (tar.gz)**. README beskriver matematiken, utvecklingsmiljön och hur appen byggs.

28 logiktester och fem webbläsarflöden täcker beräkningsmotorn och gränssnittet. Windows-bygget testar dessutom den paketerade desktopappen, inklusive Web Worker, export och sandbox, samt start av den portabla EXE-filen ensam från en tom katalog.
