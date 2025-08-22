const express = require("express");
const cors = require("cors");
const productRoutes = require("./product");
const { MongoClient } = require("mongodb");

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", productRoutes);

=app.get("/", async (req, res) => {
const mongoUrl = process.env.MONGO_URI;
  const dbName = "product";

  let client;
  try {
    client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("pant");
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
