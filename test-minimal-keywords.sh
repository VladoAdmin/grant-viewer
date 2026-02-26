#!/bin/bash
# Testovanie searchu s minimalnymi keywords

API_URL="https://api.stormlevel.com/api/chat"

declare -A QUERIES=(
  ["kyberneticka bezpecnost obec"]='Kybernetická bezpečnosť v samospráve'
  ["policia environment"]='Posilnenie kapacít Policajného zboru'
  ["operacna podpora"]='Operačná podpora MPSVaR'
  ["osameli rodicia"]='Podpora osamelých rodičov'
  ["poradenstvo zamestnanie"]='Individualizovaný prístup - poradenstvo'
  ["prievidza obchvat"]='I/64 Prievidza – obchvat'
  ["invazne druhy"]='Riešenie inváznych nepôvodných druhov'
  ["bratislava stanica"]='Bratislava hlavná stanica – rekonštrukcia'
  ["stropkov cesta"]='I/15 Stropkov, preložka cesty'
  ["oscadnica cadca"]='D3 Oščadnica – Čadca'
  ["ikt deti socialna"]='Rozvoj IKT nástrojov - sociálnoprávna ochrana detí'
  ["pomoc deti nasilie"]='Vybudovanie domov komplexnej pomoci pre deti ohrozené násilím'
  ["slovensko 2040"]='Vízia a stratégia rozvoja Slovenska do roku 2040'
  ["energeticka chudoba"]='Systém podpory domácností ohrozených energetickou chudobou'
  ["financne nastroje"]='Finančné nástroje - FST'
  ["udrzatelna mobilita"]='Podpora rozvoja udržateľnej mobility BSK'
  ["odpady"]='Odpady (C)'
  ["stokova siet"]='Obnova verejnej stokovej siete'
  ["kompostery"]='Podpora nákupu kompostérov'
  ["vody"]='Vody – Výzva (B)'
)

echo "Testovanie searchu s minimalnymi keywords"
echo "=========================================="
echo ""

PASS=0
FAIL=0

for query in "${!QUERIES[@]}"; do
  expected="${QUERIES[$query]}"
  echo "---"
  echo "Query: '$query'"
  echo "Očakávaná výzva: $expected"
  
  # Call API
  result=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$query\"}" \
    -w "\nTIME:%{time_total}")
  
  time=$(echo "$result" | grep "TIME:" | cut -d: -f2)
  grants=$(echo "$result" | grep -o '"grants":\[[^]]*\]' | head -1)
  
  # Check if response contains expected grant
  if echo "$result" | grep -qi "$(echo "$expected" | cut -d' ' -f1-2)"; then
    echo "✅ PASS (nájdené v odpovedi)"
    ((PASS++))
  else
    echo "❌ FAIL (nenájdené)"
    echo "Odpoveď: $(echo "$result" | jq -r '.reply' 2>/dev/null | head -c 200)"
    ((FAIL++))
  fi
  echo "Čas: ${time}s"
  echo ""
done

echo "=========================================="
echo "Výsledky: $PASS PASS, $FAIL FAIL"
