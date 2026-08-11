# Keycloak-Token holen, Claims prüfen, optional CouchDB-Smoke-Test.
# Couch-URL anpassen oder per Env setzen: $env:COUCH_URL = "https://..."
#
# Usage:
#   .\scripts\test.ps1
#   .\scripts\test.ps1 -OpenCloud
#   .\scripts\test.ps1 -Write
#   .\scripts\test.ps1 -OpenCloud -Write
#
# -OpenCloud: Token vom Keycloak-Client "web" (OpenCloud unter oc.protronic-gmbh.de),
#             um zu prüfen, ob _couchdb.roles auch dort im Access Token landet.
# -Write:     Opt-in für PUT eines Smoke-Dokuments in die Projekte-DB
#             (Standard: nur GET /_session und GET /$DB).

param(
  [switch]$OpenCloud,
  [switch]$Write
)

$KEYCLOAK_URL = "https://keycloak.protronic-gmbh.de"
$REALM = "openCloud"
$OPENCLOUD_URL = "https://oc.protronic-gmbh.de"
$CLIENT_ID = if ($OpenCloud) { "web" } else { "blockberry-editor-client" }
$COUCH_URL = if ($env:COUCH_URL) { $env:COUCH_URL.TrimEnd("/") } else { "https://couch.protronic-gmbh.de/couchdb" }
$COUCH_DB = if ($env:COUCH_DB) { $env:COUCH_DB } else { "blockberry-projects" }

$ErrorActionPreference = "Stop"

if ($OpenCloud) {
  Write-Host "Modus: OpenCloud" -ForegroundColor Cyan
  Write-Host "  Host:       $OPENCLOUD_URL"
  Write-Host "  Client-ID:  $CLIENT_ID"
  Write-Host "  Hinweis: Am Client 'web' muss Direct Access Grants aktiv sein (nur für diesen Smoke-Test),"
  Write-Host "           und der Client Scope mit Mapper _couchdb.roles zugewiesen sein.`n"
} else {
  Write-Host "Modus: Standalone (Client $CLIENT_ID)`n" -ForegroundColor Cyan
}

$cred = Get-Credential -Message "Keycloak login (User + Passwort)"
$env:KEYCLOAK_URL = $KEYCLOAK_URL
$env:KEYCLOAK_REALM = $REALM
$env:KEYCLOAK_CLIENT_ID = $CLIENT_ID
$env:KEYCLOAK_USERNAME = $cred.UserName
$env:KEYCLOAK_PASSWORD = $cred.GetNetworkCredential().Password

Write-Host "`n=== Keycloak JWT (client=$CLIENT_ID) ===" -ForegroundColor Cyan
$token = bun .\scripts\check-keycloak-jwt.ts --fetch --print-token
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
  throw "Keycloak JWT-Check fehlgeschlagen (Exit $LASTEXITCODE). Client='$CLIENT_ID'."
}
$token = $token.Trim()
Write-Host "Token empfangen ($($token.Length) Zeichen).`n"

if ($COUCH_URL -match "couch\.example") {
  Write-Host "COUCH_URL ist noch Platzhalter — Couch-Smoke-Test übersprungen." -ForegroundColor Yellow
  Write-Host 'Setze z.B.: $env:COUCH_URL = "https://couch.protronic-gmbh.de/couchdb"'
  exit 0
}

$headers = @{
  Authorization = "Bearer $token"
  Accept        = "application/json"
}

Write-Host "=== CouchDB Smoke ($COUCH_URL) ===" -ForegroundColor Cyan
if ($OpenCloud) {
  Write-Host "(Token stammt vom OpenCloud-Client 'web' / $OPENCLOUD_URL)`n"
}

Write-Host "GET /_session ..."
$session = Invoke-RestMethod -Headers $headers -Uri "$COUCH_URL/_session"
$session | ConvertTo-Json -Depth 5

Write-Host "`nGET /$COUCH_DB ..."
try {
  $db = Invoke-RestMethod -Headers $headers -Uri "$COUCH_URL/$COUCH_DB"
  $db | ConvertTo-Json -Depth 5
} catch {
  Write-Host "DB '$COUCH_DB' nicht lesbar: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Hinweis: DB anlegen und _security mit Role 'blockberry-editor' setzen."
  throw
}

if ($Write) {
  $docId = "project:smoke-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  $doc = @{
    format    = "blockberry"
    version   = 1
    name      = if ($OpenCloud) { "smoke-test-opencloud" } else { "smoke-test" }
    savedAt   = (Get-Date).ToUniversalTime().ToString("o")
    workspace = @{}
  } | ConvertTo-Json -Compress

  Write-Host "`nPUT /$COUCH_DB/$docId ..."
  $put = Invoke-RestMethod -Method Put -Headers $headers `
    -ContentType "application/json; charset=utf-8" `
    -Uri "$COUCH_URL/$COUCH_DB/$([uri]::EscapeDataString($docId))" `
    -Body $doc
  $put | ConvertTo-Json -Depth 5
} else {
  Write-Host "`nPUT übersprungen (opt-in mit -Write)." -ForegroundColor Yellow
}

Write-Host "`nOK: CouchDB Smoke-Test erfolgreich." -ForegroundColor Green
if ($OpenCloud) {
  Write-Host "OpenCloud-Client 'web' kann Couch mit demselben JWT-Pfad authentifizieren." -ForegroundColor Green
}
