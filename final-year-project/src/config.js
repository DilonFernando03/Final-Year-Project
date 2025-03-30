const isDevelopment = process.env.NODE_ENV === 'development';

// API base URL - switches between local and production automatically
const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5000' 
  : 'https://final-year-project-1-pd2c.onrender.com'; // Replace with your actual Render URL

export { API_BASE_URL };