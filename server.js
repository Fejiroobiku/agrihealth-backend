
# .env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/agrihealth?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=90d
JWT_COOKIE_EXPIRES_IN=90
FRONTEND_URL=http://localhost:3000
EMAIL_USERNAME=your_email@example.com
EMAIL_PASSWORD=your_email_password
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587


// middleware/auth.js
const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // 1) Get token from header
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }

    // 2) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      );
    }

    // 4) Grant access to protected route
    req.user = currentUser;
    next();
  } catch (err) {
    next(err);
  }
};

// Role-based access control
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};


// controllers/articleController.js
const Article = require('../models/Article');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAllArticles = catchAsync(async (req, res, next) => {
  const { category, language } = req.query;
  
  const filter = {};
  if (category) filter.category = category;
  if (language) filter.language = language;

  const articles = await Article.find(filter).sort('-createdAt');
  
  res.status(200).json({
    status: 'success',
    results: articles.length,
    data: {
      articles
    }
  });
});

exports.getArticle = catchAsync(async (req, res, next) => {
  const article = await Article.findById(req.params.id);
  
  if (!article) {
    return next(new AppError('No article found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      article
    }
  });
});

exports.createArticle = catchAsync(async (req, res, next) => {
  const newArticle = await Article.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      article: newArticle
    }
  });
});

exports.updateArticle = catchAsync(async (req, res, next) => {
  const article = await Article.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!article) {
    return next(new AppError('No article found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      article
    }
  });
});

exports.deleteArticle = catchAsync(async (req, res, next) => {
  const article = await Article.findByIdAndDelete(req.params.id);

  if (!article) {
    return next(new AppError('No article found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});


// models/Article.js
const mongoose = require('mongoose');
const validator = require('validator');

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a title'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  content: {
    type: String,
    required: [true, 'Please provide content'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Please select a category'],
    enum: {
      values: ['Chemical Safety', 'Nutrition', 'First Aid', 'Mental Health', 'Hygiene'],
      message: 'Please select a valid category'
    }
  },
  readTime: {
    type: Number,
    required: [true, 'Please provide estimated read time']
  },
  language: {
    type: String,
    required: [true, 'Please select language'],
    enum: ['English', 'Français', 'Kinyarwanda', 'Swahili']
  },
  imageUrl: {
    type: String,
    validate: [validator.isURL, 'Please provide a valid URL']
  },
  externalLink: {
    type: String,
    validate: [validator.isURL, 'Please provide a valid URL']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
});

module.exports = mongoose.model('Article', articleSchema);


// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectDB;


// app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Import routes
const articleRoutes = require('./routes/articleRoutes');
const videoRoutes = require('./routes/videoRoutes');
const tipRoutes = require('./routes/tipRoutes');
const contactRoutes = require('./routes/contactRoutes');
const authRoutes = require('./routes/authRoutes');

// Connect to database
require('./config/db');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Data sanitization
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Routes
app.use('/api/articles', articleRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/tips', tipRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/auth', authRoutes);

// Error handling middleware
app.use(require('./middleware/error'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


backend/
├── app.js
├── config/
│   ├── db.js
│   └── auth.js
├── controllers/
│   ├── articleController.js
│   ├── videoController.js
│   ├── tipController.js
│   ├── contactController.js
│   └── authController.js
├── models/
│   ├── Article.js
│   ├── Video.js
│   ├── Tip.js
│   ├── Contact.js
│   └── User.js
├── routes/
│   ├── articleRoutes.js
│   ├── videoRoutes.js
│   ├── tipRoutes.js
│   ├── contactRoutes.js
│   └── authRoutes.js
├── middleware/
│   ├── auth.js
│   ├── error.js
│   └── validation.js
└── .env

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AgriHealth Africa - Farmer Wellness Platform</title>
    <script>
      const API_BASE_URL = 'http://localhost:5000/api';
      
      async function fetchArticles() {
        try {
          const response = await fetch(`${API_BASE_URL}/articles`);
          return await response.json();
        } catch (error) {
          console.error('Error fetching articles:', error);
          return [];
        }
      }

      async function fetchVideos() {
        try {
          const response = await fetch(`${API_BASE_URL}/videos`);
          return await response.json();
        } catch (error) {
          console.error('Error fetching videos:', error);
          return [];
        }
      }

      async function fetchTips() {
        try {
          const response = await fetch(`${API_BASE_URL}/tips`);
          return await response.json();
        } catch (error) {
          console.error('Error fetching tips:', error);
          return [];
        }
      }
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap');
        
        body {
            font-family: 'Ubuntu', sans-serif;
            background-color: #f8f9fa;
        }
        
        .hero-pattern {
            background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxkZWZzPjxwYXR0ZXJuIGlkPSJwYXR0ZXJuIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHBhdHRlcm5UcmFuc2Zvcm09InJvdGF0ZSg0NSkiPjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0icmdiYSgyNDksIDI0OSwgMjQ5LCAwLjEpIj48L3JlY3Q+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3BhdHRlcm4pIj48L3JlY3Q+PC9zdmc+');
        }
        
        .card-hover:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        
        .language-selector {
            transition: all 0.3s ease;
        }
        
        .language-selector:hover {
            transform: scale(1.05);
        }
        
        .health-tip {
            animation: fadeIn 1s ease-in-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .africa-flag-colors {
            background: linear-gradient(90deg, #E43C14 25%, #000000 25%, #000000 50%, #FFC72C 50%, #FFC72C 75%, #009E49 75%);
        }
        
        .video-placeholder {
            background: linear-gradient(135deg, #f6f7f9 0%, #e5e7eb 100%);
        }
        
        .floating-btn {
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
        }
        
        .floating-btn:hover {
            transform: translateY(-3px) scale(1.05);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
        }
        
        /* Low bandwidth optimization */
        .low-bandwidth-img {
            background-color: #e5e7eb;
            background-size: cover;
            background-position: center;
        }
        
        /* Search bar styling */
        .search-bar {
            transition: all 0.3s ease;
        }
        
        .search-bar:focus {
            box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5);
        }
        
        /* Category filter chips */
        .category-chip {
            transition: all 0.2s ease;
        }
        
        .category-chip:hover {
            transform: translateY(-2px);
        }
        
        /* Admin panel specific styles */
        .admin-panel {
            background-color: #1a365d;
        }
    </style>
</head>
<body class="min-h-screen flex flex-col">
    <!-- Header with Language Selector and Search -->
    <header class="bg-white shadow-md sticky top-0 z-50">
        <div class="container mx-auto px-4 py-3">
            <div class="flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0">
                <div class="flex items-center space-x-2">
                    <div class="w-10 h-10 rounded-full africa-flag-colors flex items-center justify-center">
                        <i class="fas fa-leaf text-white"></i>
                    </div>
                    <h1 class="text-xl font-bold text-green-800">AgriHealth <span class="text-blue-600">Africa</span></h1>
                </div>
                
                <div class="relative w-full md:w-1/3">
                    <input type="text" placeholder="Search health topics..." 
                           class="search-bar w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500">
                    <button class="absolute right-3 top-2 text-gray-500">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
                
                <div class="flex items-center space-x-4">
                    <div class="relative group">
                        <button class="flex items-center space-x-1 px-3 py-2 bg-gray-100 rounded-full language-selector">
                            <i class="fas fa-globe text-gray-600"></i>
                            <span class="text-sm font-medium">English</span>
                            <i class="fas fa-chevron-down text-xs text-gray-600"></i>
                        </button>
                        <div class="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg py-1 hidden group-hover:block z-10">
                            <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Français</a>
                            <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Kinyarwanda</a>
                            <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Swahili</a>
                        </div>
                    </div>
                    
                    <button class="md:hidden text-gray-600">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                </div>
            </div>
            
            <!-- Navigation -->
          <nav class="mt-4 hidden md:block">
    <ul class="flex space-x-6">
        <li><a href="index.html" class="text-green-600 font-medium border-b-2 border-green-600 pb-1">Home</a></li>
        <li><a href="Articles.html" class="text-gray-600 hover:text-green-600 transition">Articles</a></li>
        <li><a href="videos.html" class="text-gray-600 hover:text-green-600 transition">Videos</a></li>
        <li><a href="#" class="text-gray-600 hover:text-green-600 transition">Health Tips</a></li>
        <li><a href="#" class="text-gray-600 hover:text-green-600 transition">Services</a></li>
        <li><a href="#" class="text-gray-600 hover:text-green-600 transition">About</a></li>
        <li><a href="/admin/login" class="text-gray-600 hover:text-green-600 transition">Admin</a></li>
    </ul>
</nav>
    <!-- Main Content -->
    <main class="flex-grow">
        <!-- Hero Section -->
        <section class="hero-pattern py-16 md:py-24">
            <div class="container mx-auto px-4">
                <div class="flex flex-col md:flex-row items-center">
                    <div class="md:w-1/2 mb-10 md:mb-0">
                        <h1 class="text-4xl md:text-5xl font-bold text-gray-800 leading-tight mb-4">
                            Empowering <span class="text-green-600">African Farmers</span> with Health Knowledge
                        </h1>
                        <p class="text-lg text-gray-600 mb-8">
                            Practical health education resources tailored for African farmers. Learn about first aid, nutrition, pesticide safety, mental health and more in multiple languages.
                        </p>
                        <div class="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                            <button class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition duration-300 flex items-center justify-center">
                                <i class="fas fa-book-open mr-2"></i> Browse Articles
                            </button>
                            <button class="border-2 border-green-600 text-green-600 hover:bg-green-50 px-6 py-3 rounded-lg font-medium transition duration-300 flex items-center justify-center">
                                <i class="fas fa-video mr-2"></i> Watch Videos
                            </button>
                        </div>
                    </div>
                    <div class="md:w-1/2 flex justify-center">
                        <div class="relative">
                            <div class="low-bandwidth-img rounded-xl shadow-xl w-full max-w-md h-64 md:h-80" 
                                 style="background-image: url('https://images.unsplash.com/photo-1605000797499-2059b27138d2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80')">
                            </div>
                            <div class="absolute -bottom-5 -right-5 bg-white p-4 rounded-lg shadow-md">
                                <div class="flex items-center">
                                    <div class="bg-yellow-100 p-2 rounded-full mr-3">
                                        <i class="fas fa-heartbeat text-yellow-500 text-xl"></i>
                                    </div>
                                    <div>
                                        <p class="text-xs text-gray-500">Health Tip</p>
                                        <p class="text-sm font-medium">Stay hydrated while working in the sun</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Stats Section -->
        <section class="bg-green-700 text-white py-10">
            <div class="container mx-auto px-4">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                    <div class="p-4">
                        <div class="text-3xl font-bold mb-2">70%</div>
                        <div class="text-sm">Of Africans rely on agriculture</div>
                    </div>
                    <div class="p-4">
                        <div class="text-3xl font-bold mb-2">65%</div>
                        <div class="text-sm">Farmers face health risks at work</div>
                    </div>
                    <div class="p-4">
                        <div class="text-3xl font-bold mb-2">4x</div>
                        <div class="text-sm">Higher injury rate than other sectors</div>
                    </div>
                    <div class="p-4">
                        <div class="text-3xl font-bold mb-2">85%</div>
                        <div class="text-sm">Preventable with proper education</div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Category Filter -->
        <section class="py-8 bg-gray-50">
            <div class="container mx-auto px-4">
                <div class="flex flex-wrap justify-center gap-3">
                    <button class="category-chip bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                        All Topics
                    </button>
                    <button class="category-chip bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100">
                        <i class="fas fa-biohazard mr-1"></i> Chemical Safety
                    </button>
                    <button class="category-chip bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100">
                        <i class="fas fa-utensils mr-1"></i> Nutrition
                    </button>
                    <button class="category-chip bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100">
                        <i class="fas fa-first-aid mr-1"></i> First Aid
                    </button>
                    <button class="category-chip bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100">
                        <i class="fas fa-brain mr-1"></i> Mental Health
                    </button>
                    <button class="category-chip bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100">
                        <i class="fas fa-hand-holding-water mr-1"></i> Hygiene
                    </button>
                </div>
            </div>
        </section>

       <!-- Health Article Library -->
<section class="py-16 bg-white">
    <div class="container mx-auto px-4">
        <div class="flex justify-between items-center mb-12">
            <h2 class="text-3xl font-bold text-gray-800">Health Article Library</h2>
            <a href="#" class="text-green-600 font-medium flex items-center">
                View All <i class="fas fa-arrow-right ml-2"></i>
            </a>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" id="articles-container">
            <!-- Articles will be loaded here dynamically -->
        </div>
        <script>
          document.addEventListener('DOMContentLoaded', async () => {
            const articles = await fetchArticles();
            const container = document.getElementById('articles-container');
            
            articles.data.articles.forEach(article => {
              const categoryColors = {
                'Chemical Safety': 'blue',
                'Nutrition': 'green',
                'First Aid': 'red',
                'Mental Health': 'purple',
                'Hygiene': 'yellow'
              };
              
              const articleEl = document.createElement('div');
              articleEl.className = 'bg-white rounded-xl shadow-md overflow-hidden card-hover transition duration-300';
              articleEl.innerHTML = `
                <div class="low-bandwidth-img h-48" style="background-image: url('${article.imageUrl || 'https://images.unsplash.com/photo-1605000797499-2059b27138d2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'}')"></div>
                <div class="p-6">
                  <div class="flex items-center mb-3">
                    <span class="bg-${categoryColors[article.category]}-100 text-${categoryColors[article.category]}-800 text-xs px-3 py-1 rounded-full">${article.category}</span>
                    <span class="text-gray-500 text-sm ml-auto"><i class="far fa-clock mr-1"></i> ${article.readTime} min read</span>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">${article.title}</h3>
                  <p class="text-gray-600 mb-4">${article.content.substring(0, 100)}...</p>
                  <a href="/article.html?id=${article._id}" class="text-${categoryColors[article.category]}-600 font-medium flex items-center">
                    Read Article <i class="fas fa-arrow-right ml-2"></i>
                  </a>
                </div>
              `;
              container.appendChild(articleEl);
            });
          });
        </script>
    </div>
</section>

        <!-- Health Tips Carousel -->
        <section class="py-16 bg-gray-50">
            <div class="container mx-auto px-4">
                <div class="text-center mb-12">
                    <h2 class="text-3xl font-bold text-gray-800 mb-4">Daily Health Tips</h2>
                    <p class="text-lg text-gray-600">Practical advice for African farmers</p>
                </div>
                
                <div class="max-w-4xl mx-auto">
                    <div class="bg-white rounded-xl shadow-md p-6 health-tip">
                        <div class="flex items-start">
                            <div class="bg-green-100 p-3 rounded-full mr-4">
                                <i class="fas fa-sun text-green-500 text-xl"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-gray-800 mb-2">Sun Protection</h3>
                                <p class="text-gray-600 mb-4">Wear wide-brimmed hats and long-sleeved clothing to protect against sunburn and heat stroke. Apply shea butter or other natural moisturizers to protect exposed skin.</p>
                                <div class="flex items-center text-sm text-gray-500">
                                    <i class="fas fa-map-marker-alt mr-1"></i> Relevant for: All regions
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-center mt-6 space-x-2">
                        <button class="w-3 h-3 rounded-full bg-gray-300"></button>
                        <button class="w-3 h-3 rounded-full bg-green-500"></button>
                        <button class="w-3 h-3 rounded-full bg-gray-300"></button>
                    </div>
                </div>
            </div>
        </section>

<!-- Video Resources -->
<section class="py-16 bg-white">
    <div class="container mx-auto px-4">
        <div class="text-center mb-12">
            <h2 class="text-3xl font-bold text-gray-800 mb-4">Video Learning Center</h2>
            <p class="text-lg text-gray-600 max-w-2xl mx-auto">Watch health education videos in multiple African languages</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Video 1: Safe Use & Handling of Agro-chemicals -->
            <div class="bg-gray-100 rounded-xl overflow-hidden">
                <div class="relative pt-[56.25%]">
                    <iframe class="absolute top-0 left-0 w-full h-full rounded-xl"
                        src="https://www.youtube.com/embed/WT7hL3r2N7c"
                        title="Guide To Safe Use and Handling of Agricultural Chemicals"
                        frameborder="0" allowfullscreen></iframe>
                </div>
                <div class="p-6">
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Safe Use & Handling of Agro‑chemicals</h3>
                    <p class="text-gray-600 mb-4">Detailed guide for safe pesticide handling and protection.</p>
                    <div class="flex items-center text-sm text-gray-500">
                        <i class="fas fa-clock mr-2"></i> ~9 min • <span class="ml-2">English (add subtitles manually)</span>
                    </div>
                </div>
            </div>

            <!-- Video 2: Back Injury Prevention for Farmworkers -->
            <div class="bg-gray-100 rounded-xl overflow-hidden">
                <div class="relative pt-[56.25%]">
                    <iframe class="absolute top-0 left-0 w-full h-full rounded-xl"
                        src="https://www.youtube.com/embed/1gF15PcyqDk"
                        title="Back Injury Prevention for Farmworkers"
                        frameborder="0" allowfullscreen></iframe>
                </div>
                <div class="p-6">
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Back Injury Prevention for Farmers</h3>
                    <p class="text-gray-600 mb-4">Practical tips to reduce back strain and work safely.</p>
                    <div class="flex items-center text-sm text-gray-500">
                        <i class="fas fa-clock mr-2"></i> ~4 min • <span class="ml-2">English (add subtitles manually)</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="text-center mt-10">
            <button class="border-2 border-green-600 text-green-600 hover:bg-green-50 px-8 py-3 rounded-lg font-medium transition duration-300">
                View All Videos <i class="fas fa-arrow-right ml-2"></i>
            </button>
        </div>
    </div>
</section>
                
                <div class="text-center mt-10">
                    <button class="border-2 border-green-600 text-green-600 hover:bg-green-50 px-8 py-3 rounded-lg font-medium transition duration-300">
                        View All Videos <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                </div>
            </div>
        </section>

        <!-- Local Services -->
        <section class="py-16 bg-green-50">
            <div class="container mx-auto px-4">
                <div class="text-center mb-12">
                    <h2 class="text-3xl font-bold text-gray-800 mb-4">Local Health Services</h2>
                    <p class="text-lg text-gray-600">Find healthcare providers and resources in your area</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <div class="flex items-center mb-4">
                            <div class="bg-blue-100 p-3 rounded-full mr-4">
                                <i class="fas fa-clinic-medical text-blue-500 text-xl"></i>
                            </div>
                            <h3 class="text-xl font-bold text-gray-800">Clinics & Hospitals</h3>
                        </div>
                        <p class="text-gray-600 mb-4">Find the nearest medical facilities with agricultural health expertise.</p>
                        <button class="text-blue-600 font-medium flex items-center">
                            Search Nearby <i class="fas fa-arrow-right ml-2"></i>
                        </button>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <div class="flex items-center mb-4">
                            <div class="bg-green-100 p-3 rounded-full mr-4">
                                <i class="fas fa-phone-alt text-green-500 text-xl"></i>
                            </div>
                            <h3 class="text-xl font-bold text-gray-800">Helplines</h3>
                        </div>
                        <p class="text-gray-600 mb-4">Emergency numbers and counseling services available in your region.</p>
                        <button class="text-green-600 font-medium flex items-center">
                            View Numbers <i class="fas fa-arrow-right ml-2"></i>
                        </button>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <div class="flex items-center mb-4">
                            <div class="bg-purple-100 p-3 rounded-full mr-4">
                                <i class="fas fa-users text-purple-500 text-xl"></i>
                            </div>
                            <h3 class="text-xl font-bold text-gray-800">Support Groups</h3>
                        </div>
                        <p class="text-gray-600 mb-4">Connect with other farmers facing similar health challenges.</p>
                        <button class="text-purple-600 font-medium flex items-center">
                            Find Groups <i class="fas fa-arrow-right ml-2"></i>
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- Inquiry Form -->
        <section class="py-16 bg-white">
            <div class="container mx-auto px-4">
                <div class="max-w-3xl mx-auto bg-gray-50 rounded-xl shadow-md p-8">
                    <h2 class="text-3xl font-bold text-gray-800 mb-6">Have Questions? Ask Our Health Experts</h2>
                    <form id="contact-form">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                                <input type="text" id="name" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                            </div>
                            <div>
                                <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                <input type="email" id="email" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                            </div>
                        </div>
                        <div class="mb-6">
                            <label for="subject" class="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                            <select id="subject" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option>Select a topic</option>
                                <option>Chemical Safety</option>
                                <option>Nutrition</option>
                                <option>First Aid</option>
                                <option>Mental Health</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div class="mb-6">
                            <label for="message" class="block text-sm font-medium text-gray-700 mb-1">Your Question</label>
                            <textarea id="message" rows="4" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"></textarea>
                        </div>
                        <button type="submit" class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium w-full transition duration-300">
                            Submit Question
                        </button>
                    </form>
                    <script>
                      document.getElementById('contact-form').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        
                        const formData = {
                          name: document.getElementById('name').value,
                          email: document.getElementById('email').value,
                          subject: document.getElementById('subject').value,
                          message: document.getElementById('message').value
                        };
                        
                        try {
                          const response = await fetch(`${API_BASE_URL}/contact`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(formData)
                          });
                          
                          if (response.ok) {
                            alert('Your question has been submitted successfully!');
                            document.getElementById('contact-form').reset();
                          } else {
                            alert('There was an error submitting your question.');
                          }
                        } catch (error) {
                          console.error('Error:', error);
                          alert('Network error - please try again later.');
                        }
                      });
                    </script>
                </div>
            </div>
        </section>

        <!-- Testimonials -->
        <section class="py-16 bg-green-100">
            <div class="container mx-auto px-4">
                <div class="text-center mb-12">
                    <h2 class="text-3xl font-bold text-gray-800 mb-4">Voices from the Fields</h2>
                    <p class="text-lg text-gray-600">What African farmers say about our health resources</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                    <div class="bg-white rounded-xl shadow-md p-8">
                        <div class="flex items-center mb-6">
                            <img src="https://images.unsplash.com/photo-1564564321837-a57b1120bbeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Farmer testimonial" class="w-16 h-16 rounded-full object-cover mr-4">
                            <div>
                                <h4 class="font-bold text-gray-800">Jean de Dieu N.</h4>
                                <p class="text-sm text-gray-600">Coffee Farmer, Rwanda</p>
                            </div>
                        </div>
                        <p class="text-gray-700 italic mb-6">
                            "After watching the chemical safety videos, I started wearing gloves and a mask when spraying. My coughing has stopped and I feel much healthier. My wife says I smell better too!"
                        </p>
                        <div class="flex space-x-1 text-yellow-400">
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                        </div>
                    </div>
                    
                    <div class="bg-white rounded-xl shadow-md p-8">
                        <div class="flex items-center mb-6">
                            <img src="https://images.unsplash.com/photo-1580894732444-8ecded7900cd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Farmer testimonial" class="w-16 h-16 rounded-full object-cover mr-4">
                            <div>
                                <h4 class="font-bold text-gray-800">Amina J.</h4>
                                <p class="text-sm text-gray-600">Vegetable Farmer, Kenya</p>
                            </div>
                        </div>
                        <p class="text-gray-700 italic mb-6">
                            "The nutrition guides helped me improve my family's meals using what we grow. My children are healthier and have more energy for school. I've even started selling surplus to neighbors!"
                        </p>
                        <div class="flex space-x-1 text-yellow-400">
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star-half-alt"></i>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Call to Action -->
        <section class="py-16 bg-green-700 text-white">
            <div class="container mx-auto px-4">
                <div class="max-w-4xl mx-auto text-center">
                    <h2 class="text-3xl font-bold mb-6">Join Our Farmer Health Network</h2>
                    <p class="text-xl mb-8">Receive weekly health tips via SMS - no smartphone needed</p>
                    
                    <div class="max-w-md mx-auto">
                        <div class="flex">
                            <select class="bg-white text-gray-800 px-3 py-3 rounded-l-lg focus:outline-none border-r border-gray-300">
                                <option>+250</option>
                                <option>+254</option>
                                <option>+234</option>
                                <
<a href="Articles.html" target="_blank" style="text-decoration: none; color: green;">Go to Articles Page</a>
                                </html>