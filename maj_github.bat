@echo off
cd /d "%~dp0"
git add .
git commit -m "Mise a jour depuis script"
git push
echo.
echo Termine. Le site sera a jour sur GitHub Pages dans 1-2 minutes.
pause