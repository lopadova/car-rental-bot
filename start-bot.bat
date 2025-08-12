@echo off
echo 🚗 Avvio Car Rental Bot...
cd /d "C:\Users\lopad\OneDrive\Documents\DocLore\Visual Basic\Node\car-rental-bot"

REM Verifica se Node.js è installato
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js non trovato. Installa Node.js prima di continuare.
    pause
    exit /b 1
)

REM Verifica se le dipendenze sono installate
if not exist "node_modules" (
    echo 📦 Installazione dipendenze...
    npm install
    if errorlevel 1 (
        echo ❌ Errore durante l'installazione delle dipendenze.
        pause
        exit /b 1
    )
    
    echo 🌐 Installazione browser Playwright...
    npx playwright install
    if errorlevel 1 (
        echo ❌ Errore durante l'installazione dei browser Playwright.
        echo ⚠️ Prova a eseguire manualmente: npx playwright install
        pause
        exit /b 1
    )
)

REM Verifica se il file .env esiste
if not exist ".env" (
    echo ⚠️ File .env non trovato. Copia .env.example in .env e configura i parametri.
    copy .env.example .env
    echo ✅ File .env creato. MODIFICA il file .env con i tuoi parametri prima di continuare.
    pause
    exit /b 1
)

echo ✅ Avvio del bot...
node src/index.js

REM Se il bot si arresta, attendi input dell'utente
echo.
echo 🛑 Bot arrestato.
pause