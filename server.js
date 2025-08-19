// server.js
const express = require("express");
const cors = require("cors");
const productRoutes = require("./product");
const { MongoClient } = require("mongodb");

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount /api routes
app.use("/api", productRoutes);

// Root route → fetch products and return them
app.get("/", async (req, res) => {
  const mongoUrl = "mongodb://127.0.0.1:27017";
  const dbName = "product";

  let client;
  try {
    client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("pant"); // default collection
    const products = await collection.find({}).toArray();
    res.json(products);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to load products", details: err.message });
  } finally {
    if (client) await client.close();
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
