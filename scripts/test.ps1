# Keycloak-Token holen, Claims prüfen, optional CouchDB-Smoke-Test.
# Couch-URL anpassen oder per Env setzen: $env:COUCH_URL = "https://..."

$KEYCLOAK_URL = "https://keycloak.protronic-gmbh.de"
$REALM = "openCloud"
$CLIENT_ID = "blockberry-editor-client"
$COUCH_URL = if ($env:COUCH_URL) { $env:COUCH_URL.TrimEnd("/") } else { "https://couch.protronic-gmbh.de/couchdb" }
$COUCH_DB = if ($env:COUCH_DB) { $env:COUCH_DB } else { "blockberry-projects" }

$ErrorActionPreference = "Stop"

$cred = Get-Credential -Message "Keycloak login (User + Passwort)"
$env:KEYCLOAK_URL = $KEYCLOAK_URL
$env:KEYCLOAK_REALM = $REALM
$env:KEYCLOAK_CLIENT_ID = $CLIENT_ID
$env:KEYCLOAK_USERNAME = $cred.UserName
$env:KEYCLOAK_PASSWORD = $cred.GetNetworkCredential().Password

Write-Host "`n=== Keycloak JWT ===" -ForegroundColor Cyan
$token = bun .\scripts\check-keycloak-jwt.ts --fetch --print-token
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
  throw "Keycloak JWT-Check fehlgeschlagen (Exit $LASTEXITCODE)."
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

$docId = "project:smoke-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$doc = @{
  format    = "blockberry"
  version   = 1
  name      = "smoke-test"
  savedAt   = (Get-Date).ToUniversalTime().ToString("o")
  workspace = @{}
} | ConvertTo-Json -Compress

Write-Host "`nPUT /$COUCH_DB/$docId ..."
$put = Invoke-RestMethod -Method Put -Headers $headers `
  -ContentType "application/json; charset=utf-8" `
  -Uri "$COUCH_URL/$COUCH_DB/$([uri]::EscapeDataString($docId))" `
  -Body $doc
$put | ConvertTo-Json -Depth 5

Write-Host "`nOK: CouchDB Smoke-Test erfolgreich." -ForegroundColor Green
