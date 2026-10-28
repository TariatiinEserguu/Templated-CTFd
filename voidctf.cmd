@echo off
rem VOID//CTF launcher for Command Prompt and PowerShell. Usage: voidctf.cmd up
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\voidctf.ps1" %*
