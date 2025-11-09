# Cursor 对话记录恢复脚本
# 使用方法：在PowerShell中运行此脚本

Write-Host "=== Cursor 对话记录恢复工具 ===" -ForegroundColor Green
Write-Host ""

$globalStoragePath = "$env:APPDATA\Cursor\User\globalStorage"
$stateFile = Join-Path $globalStoragePath "state.vscdb"
$backupFile = Join-Path $globalStoragePath "state.vscdb.backup"

# 检查文件是否存在
if (-not (Test-Path $stateFile)) {
    Write-Host "错误: 找不到 state.vscdb 文件" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $backupFile)) {
    Write-Host "警告: 找不到备份文件 state.vscdb.backup" -ForegroundColor Yellow
} else {
    Write-Host "找到备份文件: $backupFile" -ForegroundColor Green
    $backupInfo = Get-Item $backupFile
    Write-Host "  备份时间: $($backupInfo.LastWriteTime)" -ForegroundColor Cyan
    Write-Host "  文件大小: $([math]::Round($backupInfo.Length / 1KB, 2)) KB" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "当前状态文件: $stateFile" -ForegroundColor Green
$stateInfo = Get-Item $stateFile
Write-Host "  修改时间: $($stateInfo.LastWriteTime)" -ForegroundColor Cyan
Write-Host "  文件大小: $([math]::Round($stateInfo.Length / 1KB, 2)) KB" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== 恢复选项 ===" -ForegroundColor Yellow
Write-Host "1. 从备份文件恢复 (会覆盖当前文件)"
Write-Host "2. 创建当前文件的备份"
Write-Host "3. 仅查看文件信息"
Write-Host ""

$choice = Read-Host "请选择操作 (1/2/3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "警告: 这将覆盖当前的 state.vscdb 文件!" -ForegroundColor Red
        $confirm = Read-Host "确认要从备份恢复吗? (yes/no)"
        
        if ($confirm -eq "yes") {
            # 先备份当前文件
            $currentBackup = "$stateFile.manual-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            Copy-Item $stateFile $currentBackup
            Write-Host "已创建当前文件的备份: $currentBackup" -ForegroundColor Green
            
            # 从备份恢复
            Copy-Item $backupFile $stateFile -Force
            Write-Host "已从备份文件恢复!" -ForegroundColor Green
            Write-Host ""
            Write-Host "请重启 Cursor 以查看恢复的对话记录" -ForegroundColor Yellow
        } else {
            Write-Host "操作已取消" -ForegroundColor Yellow
        }
    }
    "2" {
        $backupName = "$stateFile.manual-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $stateFile $backupName
        Write-Host "已创建备份: $backupName" -ForegroundColor Green
    }
    "3" {
        Write-Host ""
        Write-Host "=== 文件信息 ===" -ForegroundColor Cyan
        Write-Host "主文件: $stateFile"
        Write-Host "  大小: $([math]::Round($stateInfo.Length / 1KB, 2)) KB"
        Write-Host "  时间: $($stateInfo.LastWriteTime)"
        
        if (Test-Path $backupFile) {
            Write-Host ""
            Write-Host "备份文件: $backupFile"
            Write-Host "  大小: $([math]::Round($backupInfo.Length / 1KB, 2)) KB"
            Write-Host "  时间: $($backupInfo.LastWriteTime)"
        }
    }
    default {
        Write-Host "无效的选择" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "提示: 在 Cursor 中按 Alt+Ctrl+' 可以打开聊天历史面板" -ForegroundColor Cyan




