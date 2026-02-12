// @ts-check

const Book = require('../models/book');
const fs = require('fs');

// Fonction de création d'un livre
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
exports.createBook = (req, res, next) => {
  const baseUrl = process.env.BACKEND_URL;  // PAS REACT_APP_API_URL car c'est dans le frontend
  const bookObject = JSON.parse(req.body.book);
  delete bookObject._id;
  delete bookObject._userId;
  if (!req.file) {
    return res.status(400).json({ message: 'Aucune image fournie.' });
  }

  // Conversion des notes en objet
  let ratings = (bookObject.ratings || []).map((ratingEntry) => ({
    userId: ratingEntry.userId,
    grade: Number(ratingEntry.grade),
  }));

  // Si le créateur donne une note initiale (étoiles), l'ajouter
  if (bookObject.rating !== undefined && bookObject.rating >= 0 && bookObject.rating <= 5) {
    ratings.push({
      userId: req.auth.userId,
      grade: Number(bookObject.rating),
    });
  }

  // Calcul de la moyenne des notes
  const averageRating = ratings.length
    ? Number((ratings.reduce((acc, objectRating) => acc + objectRating.grade, 0) / ratings.length).toFixed(1))
    : 0;

  // Création du livre
  const book = new Book({
    ...bookObject,
    userId: req.auth.userId,
    ratings,
    averageRating,
    imageUrl: `${baseUrl}/images/${req.file.filename}`
  });
  return book.save()
    .then((book) => res.status(201).json({
      message: 'Livre enregistré !',
      book: {
        _id: book._id,
        title: book.title,
        author: book.author
      }
    }))
    .catch(error => res.status(400).json({ error }));
};
                  
// Fonction de récupération d'un livre
exports.getOneBook = (req, res, next) => {
  // console.log('req.params.id', req.params.id);
  Book.findOne({
    _id: req.params.id
  }).then(
    (book) => {
      res.status(200).json(book);
    }
  ).catch(
    (error) => {
      res.status(404).json({
        error: error
      });
    }
  );
};

// Fonction de modification d'un livre
exports.modifyBook = (req, res, next) => {
  const baseUrl = process.env.BACKEND_URL;  // PAS REACT_APP_API_URL car c'est dans le frontend
  // console.log pour vérifier les données reçues
  const bookObject = req.file
    ? {
        ...JSON.parse(req.body.book),
        imageUrl: `${baseUrl}/images/${req.file.filename}`
      }
      : req.body.book ? JSON.parse(req.body.book) : { ...req.body };

  delete bookObject._userId;

  Book.findOne({ _id: req.params.id })
    .then((book) => {
      // Seul l'utilisateur propriétaire du livre peut le modifier
      if (book.userId != req.auth.userId) {
        res.status(401).json({ message: 'Not authorized' });
      } else {
        // Si un nouvel image est fournie, on supprime l'ancienne
        if (req.file && book.imageUrl) {
          const filename = book.imageUrl.split('/images/')[1];
          fs.unlink(`images/${filename}`, () => {});
        }
        Book.updateOne({ _id: req.params.id }, { ...bookObject })
          .then(() => res.status(200).json({
            message: 'Livre modifié !',
            book: bookObject
          }))
          .catch(error => res.status(401).json({ error }));
      }
    })
    .catch((error) => {
      res.status(400).json({ error });
    });  
};

// Fonction de suppression d'un livre
exports.deleteBook = (req, res, next) => {
  Book.findOne({ _id: req.params.id })
    .then(book => {
      if (book.userId != req.auth.userId) {
        res.status(401).json({ message: 'Not authorized' });
      } else {
        const filename = book.imageUrl.split('/images/')[1];
        fs.unlink(`images/${filename}`, () => {
          Book.deleteOne({ _id: req.params.id })
            .then(() => { res.status(200).json({ message: 'Livre supprimé !', title: book.title, id: book._id }) })
            .catch(error => res.status(401).json({ error }));
        });
      }
    })
    .catch(error => {
      res.status(500).json({ error });
    });
};

// Fonction de récupération de tous les livres
exports.getAllBook = (req, res, next) => {
  Book.find()
    .then((books) => res.status(200).json(books))
    .catch((error) => res.status(400).json({ error }));
};

// Fonction de récupération des livres les mieux notés
exports.getBestRatedBooks = (req, res) => {
  Book.find()
    .sort({ averageRating: -1 })
    .limit(3)
    .then((books) => res.status(200).json(books))
    .catch((error) => res.status(400).json({ error }));
};

// Fonction de notation d'un livre
exports.rateBook = (req, res) => {
  const { rating } = req.body;
  const grade = parseInt(rating, 10);

  // Vérification de la note
  if (Number.isNaN(grade) || grade < 0 || grade > 5) {
    return res.status(400).json({ message: 'La note doit être comprise entre 0 et 5.' });
  }

  // Récupération du livre
  return Book.findOne({ _id: req.params.id })
    .then((book) => {
      if (!book) {
        return res.status(404).json({ message: 'Livre introuvable.' });
      }

      // Vérification si l'utilisateur est le créateur du livre
      if (book.userId === req.auth.userId) {
        return res.status(403).json({ message: 'Vous ne pouvez pas noter votre propre livre.' });
      }

      // Vérification si l'utilisateur a déjà noté le livre
      const existingRating = book.ratings.find((objectRating) => objectRating.userId === req.auth.userId);
      if (existingRating) {
        return res.status(403).json({ message: 'Vous avez déjà noté ce livre.' });
      } else {
        // Première et unique notation
        book.ratings.push({
          userId: req.auth.userId,
          grade,
        });
      }

      // Calcul de la moyenne des notes
      const total = book.ratings.reduce((acc, objectRating) => acc + objectRating.grade, 0);
      book.averageRating = Number((total / book.ratings.length).toFixed(1));

      // Enregistrement du livre
      return book.save()
        .then((updatedBook) => res.status(200).json(updatedBook))
        .catch((error) => res.status(400).json({ error }));
    })
    .catch((error) => res.status(400).json({ error }));
};