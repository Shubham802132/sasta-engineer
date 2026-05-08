# FIXGHAR Backend API

A comprehensive backend API for FIXGHAR home repair services platform built with Node.js, Express, and MongoDB.

## 🚀 Features

- **User Authentication**: Secure registration and login for users and fixers
- **Phone Verification**: OTP-based phone verification system
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Different permissions for users, fixers, and admins
- **MongoDB Integration**: Robust data storage with Mongoose ODM
- **Input Validation**: Comprehensive request validation using express-validator
- **Error Handling**: Centralized error handling middleware
- **Rate Limiting**: API rate limiting for security
- **File Upload Support**: Multer integration for file handling
- **SMS Service**: Mock SMS service for OTP delivery

## 🏗️ Architecture

```
backend/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── models/          # Database models
├── routes/          # API routes
├── utils/           # Utility functions
├── uploads/         # File uploads directory
├── server.js        # Main server file
├── package.json     # Dependencies
└── config.env       # Environment variables
```

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account
- SMS service (Twilio, AWS SNS, etc.) for production

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   - Copy `config.env.example` to `config.env`
   - Update the following variables:
     ```env
     MONGODB_URI=your_mongodb_connection_string
     JWT_SECRET=your_jwt_secret_key
     SMS_API_KEY=your_sms_api_key
     SMS_SENDER_ID=FIXGHAR
     ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register/user` - User registration
- `POST /api/auth/register/fixer` - Fixer registration
- `POST /api/auth/login/user` - User login
- `POST /api/auth/login/fixer` - Fixer login
- `POST /api/auth/verify-otp` - OTP verification
- `POST /api/auth/resend-otp` - Resend OTP
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/bookings` - Get user bookings

### Fixers
- `GET /api/fixers/profile` - Get fixer profile
- `PUT /api/fixers/profile` - Update fixer profile
- `GET /api/fixers/bookings` - Get fixer bookings
- `PUT /api/fixers/bookings/:id/status` - Update booking status

### Services
- `GET /api/services` - Get all services
- `GET /api/services/:id` - Get service by ID
- `GET /api/services/category/:category` - Get services by category
- `GET /api/services/search` - Search services

### Bookings
- `POST /api/bookings` - Create new booking
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/:id` - Get booking by ID
- `PUT /api/bookings/:id` - Update booking
- `POST /api/bookings/:id/review` - Add review

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## 📊 Database Models

### User
- Basic information (name, email, phone, username)
- Address details
- Phone verification status
- Account preferences

### Fixer
- Professional information
- Service category
- Business details
- Availability and pricing
- Rating and reviews

### Service
- Service details and description
- Pricing information
- Features and requirements
- Popularity metrics

### Booking
- User and fixer details
- Service information
- Scheduling and progress
- Communication and reviews
- Payment details

### OTP
- Phone verification tokens
- Expiration handling
- Attempt tracking

## 🛡️ Security Features

- **Password Hashing**: bcryptjs for secure password storage
- **JWT Tokens**: Secure authentication tokens
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Cross-origin resource sharing protection
- **Helmet**: Security headers middleware
- **Data Sanitization**: Input sanitization and validation

## 📱 SMS Service

The backend includes an SMS service for:
- Phone verification OTPs
- Welcome messages
- Password reset codes
- Booking confirmations
- Status updates

## 🚀 Deployment

### Environment Variables
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=your_production_mongodb_uri
JWT_SECRET=your_production_jwt_secret
SMS_API_KEY=your_sms_api_key
SMS_SENDER_ID=FIXGHAR
SMS_BASE_URL=your_sms_service_url
```

### Production Commands
```bash
npm install --production
npm start
```

## 🔧 Development

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (to be implemented)

### Code Style
- Use ES6+ features
- Follow RESTful API conventions
- Implement proper error handling
- Add comprehensive validation
- Use async/await for database operations

## 📝 API Documentation

The API follows RESTful conventions:
- **GET**: Retrieve data
- **POST**: Create new resources
- **PUT**: Update existing resources
- **DELETE**: Remove resources

### Response Format
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Format
```json
{
  "success": false,
  "error": "Error message",
  "stack": "Error stack trace (development only)"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔮 Future Enhancements

- [ ] Real-time notifications
- [ ] Payment gateway integration
- [ ] Push notifications
- [ ] Advanced search and filtering
- [ ] Analytics dashboard
- [ ] Multi-language support
- [ ] Mobile app API endpoints



