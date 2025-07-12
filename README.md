# FbResponse - Full Stack Web Application

A modern full-stack web application built with React.js, Node.js, and MongoDB.

## 🚀 Tech Stack

- **Frontend**: React.js with TypeScript
- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT
- **Styling**: Tailwind CSS

## 📁 Project Structure

```
FbResponse/
├── client/          # React.js frontend
├── server/          # Node.js backend
├── shared/          # Shared types and utilities
├── package.json     # Root package.json
└── README.md        # This file
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB (local or MongoDB Atlas)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd FbResponse
   ```

2. **Install all dependencies**
   ```bash
   npm run install-all
   ```

3. **Environment Setup**
   - Copy `.env.example` to `.env` in the server directory
   - Update the environment variables with your configuration

4. **Start the development servers**
   ```bash
   npm run dev
   ```

This will start both the frontend (port 3000) and backend (port 5000) servers concurrently.

## 📝 Available Scripts

- `npm run dev` - Start both client and server in development mode
- `npm run server` - Start only the backend server
- `npm run client` - Start only the frontend client
- `npm run build` - Build the React app for production
- `npm run install-all` - Install dependencies for all packages

## 🌐 API Endpoints

The backend API will be available at `http://localhost:5000/api`

## 📦 Features

- Modern React.js frontend with TypeScript
- RESTful API with Express.js
- MongoDB database integration
- JWT authentication
- Responsive design with Tailwind CSS
- Hot reloading for development

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 