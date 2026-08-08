@echo off
title WorkHub RAG Server (Bronze Storage)
color 0A
echo ========================================================
echo        KHOI DONG WORKHUB RAG BACKEND SERVER
echo ========================================================
echo.

cd /d "%~dp0"

if not exist venv (
    echo [INFO] Tao moi Virtual Environment...
    python -m venv venv
    call venv\Scripts\activate
    echo [INFO] Cai dat cac thu vien can thiet...
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate
)

echo [INFO] Dang khoi dong FastAPI Server tai http://localhost:8000 ...
python app.py
pause
