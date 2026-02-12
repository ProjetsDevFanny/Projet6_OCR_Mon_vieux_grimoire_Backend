// app.js: Fichier principal de l'application Node.js

const express = require('express');
const helmet = require('helmet');
require('dotenv').config();
const mongoose = require('mongoose');
const app = express();
const path = require('path');
const bookRoutes = require('./routes/book');
const userRoutes = require('./routes/user');

// Import des middlewares de sécurité rateLimit
const { generalLimiter } = require('./middleware/rateLimit');

// Helmet seulement pour les routes API, pas pour les images
app.use('/api', helmet());  // S'applique seulement aux routes /api/*

// Les images /images/* ne passent pas par Helmet

// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connexion à MongoDB réussie !'))
  .catch(err => console.log('❌ Connexion à MongoDB échouée !', err));

// Middlewares pour parser les requêtes JSON et URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware pour les headers CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content, Accept, Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware de limitation de taux pour les routes API seulement
app.use('/api/', generalLimiter);

// Middleware pour les routes
app.use('/api/books', bookRoutes);
app.use('/api/auth', userRoutes);

// Middleware pour les images (middleware "static") avec cache optimisé
app.use('/images', express.static(path.join(__dirname, 'images'), {
  setHeaders: (res, path) => {
    // Headers de cache public pour les images
    res.set('Cache-Control', 'public, max-age=31536000'); // 1 an
  }
}));

module.exports = app;