#!/bin/bash

# Loomiss Setup & Installer Script for Linux/macOS/Git Bash

set -e

echo "============================================="
echo "   🌀 Loomiss Dynamic Visualizer Installer   "
echo "============================================="

# 1. Check Prerequisites
echo "Checking prerequisites..."
if ! command -v go &> /dev/null; then
    echo "❌ Error: Go is not installed. Please install Go (1.22+) and try again."
    exit 1
fi
echo "✅ Go is installed: $(go version)"

if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js (v18+) and try again."
    exit 1
fi
echo "✅ Node.js is installed: $(node -v)"

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install npm and try again."
    exit 1
fi
echo "✅ npm is installed: $(npm -v)"

# 2. Build Frontend
echo ""
echo "Building Frontend assets..."
cd frontend
npm install
npm run build
cd ..
echo "✅ Frontend built successfully."

# 3. Build Backend Go Daemon
echo ""
echo "Building Backend Go binary..."

# Stop any running loomiss processes to release file locks
echo "Stopping any running Loomiss daemon processes..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    taskkill //F //IM loomiss.exe 2>/dev/null || true
    sleep 1
else
    pkill -f loomiss 2>/dev/null || true
    sleep 1
fi

cd backend

# Determine executable name based on OS type
EXEC_NAME="loomiss"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    EXEC_NAME="loomiss.exe"
fi

go build -o ../$EXEC_NAME main.go
cd ..
echo "✅ Backend binary compiled: ./$EXEC_NAME"

# 4. Add to PATH automatically based on shell config
echo ""
echo "Setting up global PATH variables..."
WORKSPACE_DIR=$(pwd)

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows under Git Bash / MSYS
    echo "Windows platform detected under Git Bash/MSYS."
    echo "To add Loomiss to your global Windows PATH variable permanently, please run:"
    echo "  PowerShell -ExecutionPolicy Bypass -File ./setup.ps1"
    echo ""
    echo "For the current Git Bash shell session, running:"
    echo "  export PATH=\$PATH:$WORKSPACE_DIR"
    export PATH="$PATH:$WORKSPACE_DIR"
else
    # Linux / macOS Unix platforms
    SHELL_CONFIG=""
    if [[ "$SHELL" == */zsh ]]; then
        SHELL_CONFIG="$HOME/.zshrc"
    elif [[ "$SHELL" == */bash ]]; then
        SHELL_CONFIG="$HOME/.bashrc"
    fi

    if [ -n "$SHELL_CONFIG" ] && [ -f "$SHELL_CONFIG" ]; then
        if ! grep -q "loomiss" "$SHELL_CONFIG"; then
            echo "" >> "$SHELL_CONFIG"
            echo "# Loomiss Global Path" >> "$SHELL_CONFIG"
            echo "export PATH=\"\$PATH:$WORKSPACE_DIR\"" >> "$SHELL_CONFIG"
            echo "✅ Added Loomiss path to $SHELL_CONFIG."
            echo "Please run: source $SHELL_CONFIG to load the changes."
        else
            echo "ℹ️ Loomiss path is already added to $SHELL_CONFIG."
        fi
    else
        echo "⚠️ Shell config file (.bashrc/.zshrc) not found automatically."
        echo "To run 'loomiss' globally, manually append this line to your shell configuration:"
        echo "  export PATH=\"\$PATH:$WORKSPACE_DIR\""
    fi
fi

echo ""
echo "============================================="
echo "🎉 Setup complete! You can now start Loomiss:"
echo "   Command: ./$EXEC_NAME start"
echo "============================================="
