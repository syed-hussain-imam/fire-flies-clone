#!/bin/bash

echo "Setting up Whisper.cpp for real-time transcription..."

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Error: git is required but not installed. Please install git first."
    exit 1
fi

# Check if cmake is installed
if ! command -v cmake &> /dev/null; then
    echo "Error: cmake is required but not installed. Please install cmake first."
    echo "On macOS: brew install cmake"
    echo "On Ubuntu/Debian: sudo apt-get install cmake"
    exit 1
fi

# Clone whisper.cpp if it doesn't exist
if [ ! -d "whisper.cpp" ]; then
    echo "Cloning whisper.cpp repository..."
    git clone https://github.com/ggerganov/whisper.cpp.git
else
    echo "whisper.cpp directory already exists, updating..."
    cd whisper.cpp
    git pull
    cd ..
fi

# Build whisper.cpp
echo "Building whisper.cpp..."
cd whisper.cpp
mkdir -p build
cd build
cmake ..
make -j4

# Check if build was successful
if [ ! -f "bin/main" ]; then
    echo "Error: Failed to build whisper.cpp"
    exit 1
fi

cd ..

# Create models directory
mkdir -p models

# Download the base English model if it doesn't exist
if [ ! -f "models/ggml-base.en.bin" ]; then
    echo "Downloading Whisper base English model..."
    curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" -o "models/ggml-base.en.bin"
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to download Whisper model"
        exit 1
    fi
else
    echo "Whisper model already exists"
fi

# Create temp directory for audio processing
mkdir -p temp

echo "✅ Whisper.cpp setup complete!"
echo "The whisper executable is located at: ./whisper.cpp/build/bin/main"
echo "The model is located at: ./models/ggml-base.en.bin"
echo ""
echo "You can now start the server with real-time transcription support." 