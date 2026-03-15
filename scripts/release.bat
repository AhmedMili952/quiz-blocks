@echo off
setlocal

set VERSION=%1

if "%VERSION%"=="" (
    echo Usage: npm run release -- v0.9.1-beta
    exit /b 1
)

echo [1/6] Build...
call npm run build
if errorlevel 1 exit /b 1

echo [2/6] Git add...
git add .
if errorlevel 1 exit /b 1

echo [3/6] Git commit...
git commit -m "release %VERSION%"
if errorlevel 1 (
    echo Aucun changement a commit.
    exit /b 1
)

echo [4/6] Git push...
git push
if errorlevel 1 exit /b 1

echo [5/6] Create tag...
git tag %VERSION%
if errorlevel 1 (
    echo Le tag %VERSION% existe deja ou la creation a echoue.
    exit /b 1
)

echo [6/6] Push tag...
git push origin %VERSION%
if errorlevel 1 exit /b 1

echo.
echo Version %VERSION% envoyee.
echo GitHub Actions va creer la release automatiquement.
endlocal