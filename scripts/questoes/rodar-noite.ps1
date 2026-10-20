# Produção automática da noite: chama o Claude Code sem tela (/gerar-lote) em rodadas até as 7h,
# esperando quando bate no limite de uso do plano. No fim, gera o relatório e manda a notificação.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\questoes\rodar-noite.ps1
#   ... -Teste -Teto 3     uma rodada só, com 3 lotes (o ciclo de teste)
#
# As permissões do Claude nesta execução vêm de .claude/settings.json (modo dontAsk: o que não está
# liberado lá é negado). Tudo acontece no local.db; nada vai para a produção.
param(
  [int]$Teto = 6,
  [switch]$Teste
)

$ErrorActionPreference = "Continue"
$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $raiz

$agora = Get-Date
$fim = (Get-Date).Date.AddHours(7)
if ($agora -ge $fim) { $fim = $fim.AddDays(1) }
if ($Teste) { $fim = $agora.AddHours(3) }
$pastaLog = Join-Path $raiz "data\relatorios"
New-Item -ItemType Directory -Force $pastaLog | Out-Null

function Anotar([string]$texto) {
  # Linha no log da noite (o relatório conta as pausas por limite a partir dele).
  npx tsx scripts/questoes/producao.ts log $texto | Out-Null
  Write-Output "$(Get-Date -Format 'HH:mm') $texto"
}

Anotar "INICIO teto=$Teto teste=$Teste ate=$($fim.ToString('dd/MM HH:mm'))"
$rodada = 0
while ((Get-Date) -lt $fim) {
  $rodada++
  $saida = (& claude -p "/gerar-lote $Teto" --permission-mode dontAsk 2>&1 | Out-String)
  # Guarda o fim da conversa de cada rodada para diagnóstico.
  $cauda = ($saida -split "`n" | Select-Object -Last 15) -join "`n"
  Add-Content -Encoding utf8 (Join-Path $pastaLog "saida-claude.log") "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm') rodada $rodada =====`n$cauda"

  # Limite do plano. A mensagem varia ("You've hit your session limit · resets 10:10am", "usage limit"...).
  if ($saida -match "(?i)usage limit|session limit|weekly limit|limit reached|hit your (\w+ )?limit|limite de uso|rate.?limit|resets\s+\d") {
    $espera = 1800
    # Se a mensagem diz a hora em que o limite renova, espera até ela (e para de vez se for depois do fim da janela).
    if ($saida -match "(?i)resets\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)") {
      $h = [int]$Matches[1] % 12; if ($Matches[3] -ieq "pm") { $h += 12 }
      $min = if ($Matches[2]) { [int]$Matches[2] } else { 0 }
      $renova = (Get-Date).Date.AddHours($h).AddMinutes($min)
      if ($renova -le (Get-Date)) { $renova = $renova.AddDays(1) }
      if ($renova -ge $fim) {
        Anotar "LIMITE de uso do plano na rodada ${rodada}: renova as $($renova.ToString('HH:mm')), depois do fim da janela; encerrando a noite"
        break
      }
      $espera = [int]($renova - (Get-Date)).TotalSeconds + 120
    }
    Anotar "LIMITE de uso do plano na rodada ${rodada}: aguardando $([int]($espera / 60)) min"
    Start-Sleep -Seconds $espera
    continue
  }
  if ($saida -match "FIM: nada pendente") { Anotar "FIM: nada pendente"; break }
  if ($saida -match "FIM:") {
    Anotar "Rodada $rodada concluida"
  } else {
    Anotar "ERRO rodada $rodada terminou sem FIM (ver data/relatorios/saida-claude.log)"
    Start-Sleep -Seconds 300
  }
  if ($Teste) { break }
}

Anotar "ENCERRADO apos $rodada rodada(s)"
if ($Teste) { npx tsx scripts/questoes/producao.ts notificar --teste } else { npx tsx scripts/questoes/producao.ts notificar }
