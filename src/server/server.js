const express = require('express');
const mysql = require('mysql');

const app = express();
const port = 3001;

// Create a MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '941211',
  database: 'tistory'
});

// Connect to the MySQL database
connection.connect();

// Define a route to fetch data from the database
app.get('/api/data', (req, res) => {
  const query = 'SELECT * FROM tistory';

  // Execute the query
  connection.query(query, (error, results) => {
    if (error) {
      res.status(500).json({ error });
    } else {
      res.json(results);
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});