$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm is required. Install Node.js 22+ and run: corepack enable"
}
pnpm dev:up @args
