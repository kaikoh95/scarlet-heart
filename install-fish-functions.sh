#!/bin/bash

# Install Fish Functions
# Copies fish functions from project to user's fish config directory

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FISH_FUNCTIONS_SRC="${SCRIPT_DIR}/fish-functions"
FISH_FUNCTIONS_DEST="${HOME}/.config/fish/functions"

echo "🐟 Installing Fish Functions"
echo "=================================================="
echo "Source:      ${FISH_FUNCTIONS_SRC}"
echo "Destination: ${FISH_FUNCTIONS_DEST}"
echo ""

# Check if source directory exists
if [ ! -d "${FISH_FUNCTIONS_SRC}" ]; then
    echo "❌ Error: Source directory not found: ${FISH_FUNCTIONS_SRC}"
    exit 1
fi

# Count fish files
FISH_FILE_COUNT=$(find "${FISH_FUNCTIONS_SRC}" -maxdepth 1 -name "*.fish" | wc -l)

if [ "${FISH_FILE_COUNT}" -eq 0 ]; then
    echo "⚠️  Warning: No .fish files found in ${FISH_FUNCTIONS_SRC}"
    exit 0
fi

echo "📦 Found ${FISH_FILE_COUNT} fish function(s) to install"
echo ""

# Create destination directory if it doesn't exist
if [ ! -d "${FISH_FUNCTIONS_DEST}" ]; then
    echo "📁 Creating directory: ${FISH_FUNCTIONS_DEST}"
    mkdir -p "${FISH_FUNCTIONS_DEST}"
fi

# Copy fish functions
echo "📤 Copying fish functions..."
COPIED=0
SKIPPED=0

for fish_file in "${FISH_FUNCTIONS_SRC}"/*.fish; do
    if [ -f "${fish_file}" ]; then
        filename=$(basename "${fish_file}")
        dest_file="${FISH_FUNCTIONS_DEST}/${filename}"

        # Check if file already exists
        if [ -f "${dest_file}" ]; then
            # Compare files
            if cmp -s "${fish_file}" "${dest_file}"; then
                echo "  ⏭️  ${filename} (already up-to-date)"
                SKIPPED=$((SKIPPED + 1))
            else
                echo "  ♻️  ${filename} (updating)"
                cp "${fish_file}" "${dest_file}"
                COPIED=$((COPIED + 1))
            fi
        else
            echo "  ✅ ${filename} (new)"
            cp "${fish_file}" "${dest_file}"
            COPIED=$((COPIED + 1))
        fi
    fi
done

echo ""
echo "=================================================="
echo "✅ Installation complete!"
echo "   Copied:  ${COPIED} file(s)"
echo "   Skipped: ${SKIPPED} file(s) (already up-to-date)"
echo ""
echo "💡 Reload fish configuration:"
echo "   exec fish"
echo ""
echo "📋 Available functions:"
for fish_file in "${FISH_FUNCTIONS_SRC}"/*.fish; do
    if [ -f "${fish_file}" ]; then
        filename=$(basename "${fish_file}" .fish)
        echo "   - ${filename}"
    fi
done
