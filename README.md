# AgriHealth Africa – Backend

This is the backend for **AgriHealth Africa**, a web-based platform designed to support African farmers by providing access to health content through an admin dashboard. This server handles data storage, authentication, and API endpoints for articles, videos, and users.

## 🌐 Live API URL

👉 [https://agrihealth-backend.onrender.com](https://agrihealth-backend.onrender.com)

## 🧰 Technologies Used

- Node.js
- Express.js
- MongoDB (via Mongoose)
- CORS for frontend-backend communication
- Environment configuration with `.env`
- Hosted on **Render**

## 🚀 How to Run Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Fejiroobiku/agrihealth-backend.git
   cd agrihealth-backend
Install dependencies:

bash
Copy
Edit
npm install
Create a .env file in the root of the project and add:

env
Copy
Edit
PORT=5000
MONGO_URI=your_mongodb_connection_string
Start the server:

bash
Copy
Edit
npm start
The backend should now be running on http://localhost:5000

📡 API Endpoints
Method	Endpoint	Description
POST	/login	Admin login
GET	/articles	Get all articles
POST	/articles	Add a new article
GET	/videos	Get all videos
POST	/videos	Upload a new video
GET	/users	Get all registered users

Note: These routes assume authentication is handled server-side.

🔐 Security Notes
Passwords should be hashed before saving to the database

Authentication tokens (JWT) or sessions should be implemented for secure routes

CORS is configured to allow frontend access from Netlify

🛠️ Tools Used
MongoDB Atlas for cloud database storage

Postman for testing API endpoints

Render for deployment

🔗 Frontend Project
You can view the frontend code and interface here:
👉 Frontend Repository
(https://github.com/Fejiroobiku/agrihealth-frontend.git)

🙋‍♂️ Author
Fejiro Obiku

Backend GitHub Repository
