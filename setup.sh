#!/bin/bash

# FbResponse Setup Script
echo "🚀 Setting up FbResponse Full-Stack Application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install
cd ..

# Create environment file for server
echo "🔧 Setting up environment configuration..."
if [ ! -f "server/.env" ]; then
    cp server/env.example server/.env
    echo "✅ Created server/.env file from template"
    echo "⚠️  Please update server/.env with your configuration"
else
    echo "✅ server/.env already exists"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update server/.env with your MongoDB connection string and JWT secret"
echo "2. Start MongoDB (local or use MongoDB Atlas)"
echo "3. Run 'npm run dev' to start both client and server"
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "📚 Available commands:"
echo "  npm run dev      - Start both client and server"
echo "  npm run server   - Start only the backend server"
echo "  npm run client   - Start only the frontend client"
echo "  npm run build    - Build the React app for production"
echo "" 