# Registra (ou atualiza) a tarefa "NobregaQuestoes - Producao noturna" no Agendador de Tarefas do
# Windows: todo dia às 23h, roda scripts\questoes\rodar-noite.ps1 com o usuário atual.
# Não precisa de administrador (tarefa do próprio usuário). Roda com o usuário conectado e o PC ligado.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\questoes\agendar-noite.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\questoes\agendar-noite.ps1 -Remover
param([switch]$Remover, [string]$Hora = "23:00", [int]$Teto = 6)

$nome = "NobregaQuestoes - Producao noturna"
if ($Remover) {
  Unregister-ScheduledTask -TaskName $nome -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output "Tarefa removida: $nome"
  exit 0
}

$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script = Join-Path $raiz "scripts\questoes\rodar-noite.ps1"
$acao = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Teto $Teto" -WorkingDirectory $raiz
$gatilho = New-ScheduledTaskTrigger -Daily -At $Hora
# Roda mesmo na bateria, não para no meio por tempo antes das 9 h, e não inicia duas vezes ao mesmo tempo.
$config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 9) -MultipleInstances IgnoreNew -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config -Principal $principal -Description "Gera questões e flashcards com o Claude Code (local.db) e manda o resumo pelo ntfy." -Force | Out-Null
$t = Get-ScheduledTask -TaskName $nome
Write-Output "Tarefa registrada: $nome | estado: $($t.State) | próxima execução: $((Get-ScheduledTaskInfo -TaskName $nome).NextRunTime)"
