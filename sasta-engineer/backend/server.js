// FIXGHAR Backend Server Entry Point
// This file serves as the main entry point for the FIXGHAR backend server
// It imports and runs the actual server from http-server.js

const path = require('path');
const fs = require('fs');

// Check if http-server.js exists
const httpServerPath = path.join(__dirname, 'http-server.js');

if (fs.existsSync(httpServerPath)) {
    console.log('🚀 Starting FIXGHAR Backend Server...');
    console.log('📁 Loading server from http-server.js');
    
    // Import and run the actual server
    require('./http-server.js');
} else {
    console.error('❌ Error: http-server.js not found!');
    console.error('Please ensure http-server.js exists in the backend directory.');
    process.exit(1);
}




















