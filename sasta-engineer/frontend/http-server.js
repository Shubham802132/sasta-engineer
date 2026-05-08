const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3030;

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);
    
    // Parse URL to get pathname only (remove query parameters and fragments)
    let pathname = req.url;
    if (pathname.includes('?')) {
        pathname = pathname.split('?')[0];
    }
    if (pathname.includes('#')) {
        pathname = pathname.split('#')[0];
    }
    
    let filePath = '';
    
    // Handle different routes
    console.log('Processing request for pathname:', pathname);
    
    if (pathname === '/' || pathname === '/index.html') {
        filePath = path.join(__dirname, 'index.html');
    } else if (pathname === '/dashboard') {
        filePath = path.join(__dirname, 'pages', 'user-dashboard.html');
        console.log('Dashboard route accessed:', pathname, '->', filePath);
    } else if (pathname === '/fixer-dashboard') {
        filePath = path.join(__dirname, 'pages', 'fixer-dashboard.html');
        console.log('Fixer Dashboard route accessed:', pathname, '->', filePath);
    } else if (pathname === '/user-dashboard.html') {
        filePath = path.join(__dirname, 'pages', 'user-dashboard.html');
    } else if (pathname === '/fixer-dashboard.html') {
        filePath = path.join(__dirname, 'pages', 'fixer-dashboard.html');
    } else if (pathname === '/test-dashboard') {
        filePath = path.join(__dirname, 'pages', 'user-dashboard.html');
    } else if (pathname === '/test-login') {
        filePath = path.join(__dirname, 'pages', 'user-dashboard.html');
    } else if (pathname === '/direct-test.html') {
        filePath = path.join(__dirname, 'pages', 'user-dashboard.html');
    } else if (pathname === '/test') {
        filePath = path.join(__dirname, 'pages', 'user-dashboard.html');
    } else if (pathname.endsWith('.js')) {
        // Check if it's in js directory first
        if (pathname.startsWith('/js/')) {
            filePath = path.join(__dirname, pathname);
        } else if (pathname.startsWith('/scripts/')) {
            filePath = path.join(__dirname, pathname);
        } else {
            filePath = path.join(__dirname, pathname);
        }
    } else if (pathname.endsWith('.css')) {
        // Check if it's in css directory first
        if (pathname.startsWith('/css/')) {
            filePath = path.join(__dirname, pathname);
        } else {
            filePath = path.join(__dirname, pathname);
        }
    } else if (pathname.startsWith('/asset/')) {
        // Handle asset files (images, etc.)
        filePath = path.join(__dirname, pathname);
    } else if (pathname.endsWith('.png') || pathname.endsWith('.jpg') || pathname.endsWith('.jpeg') || pathname.endsWith('.gif') || pathname.endsWith('.svg')) {
        // Handle image files in root or other directories
        filePath = path.join(__dirname, pathname);
    } else {
        filePath = path.join(__dirname, pathname);
    }
    
    // Check if file exists
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        let contentType = 'text/html';
        
        if (ext === '.js') contentType = 'text/javascript';
        else if (ext === '.css') contentType = 'text/css';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.gif') contentType = 'image/gif';
        else if (ext === '.svg') contentType = 'image/svg+xml';
        else if (ext === '.ico') contentType = 'image/x-icon';
        else if (ext === '.json') contentType = 'application/json';
        
        res.writeHead(200, { 
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
        fileStream.on('error', (err) => {
            console.error('File read error:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        });
        
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`
            <h1>404 - File Not Found</h1>
            <p>Requested URL: ${req.url}</p>
            <p>Available pages:</p>
            <ul>
                <li><a href="/">Home Page</a></li>
                <li><a href="/dashboard">User Dashboard</a></li>
                <li><a href="/fixer-dashboard">Fixer Dashboard</a></li>
                <li><a href="/user-dashboard.html">User Dashboard (Direct)</a></li>
                <li><a href="/fixer-dashboard.html">Fixer Dashboard (Direct)</a></li>
                <li><a href="/index.html">Main Page</a></li>
            </ul>
            <p>Available assets:</p>
            <ul>
                <li><a href="/css/style.css">Main CSS</a></li>
                <li><a href="/js/script.js">Main JS</a></li>
                <li><a href="/scripts/dashboard-script.js">Dashboard Script</a></li>
                <li><a href="/asset/logo.png">Logo</a></li>
            </ul>
        `);
    }
});

server.listen(PORT, () => {
    console.log('🚀 FIXGHAR Frontend HTTP Server Running!');
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`🏠 Main Page: http://localhost:${PORT}/`);
    console.log(`📊 User Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`🔧 Fixer Dashboard: http://localhost:${PORT}/fixer-dashboard`);
    console.log(`📊 User Dashboard (Direct): http://localhost:${PORT}/user-dashboard.html`);
    console.log(`🔧 Fixer Dashboard (Direct): http://localhost:${PORT}/fixer-dashboard.html`);
    console.log('');
    console.log('✅ Frontend is now accessible via HTTP protocol');
    console.log('✅ No more CORS issues with file:// protocol');
    console.log('✅ Backend connection should work now!');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
});

// Handle server errors
server.on('error', (err) => {
    console.error('❌ Server error:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});