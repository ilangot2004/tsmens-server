const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const multer = require("multer");

const router = express.Router();
const mongoUrl = process.env.MONGO_URI;
const dbName = "product";

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper function to convert buffer to base64
const bufferToBase64 = (buffer) => {
  return buffer.toString('base64');
};

// POST endpoint for saving products
router.post(
  "/saveProduct",
  upload.array("ProductImages", 5),
  async (req, res) => {
    let client;
    try {
      client = new MongoClient(mongoUrl);
      await client.connect();
      console.log("Backend: Connected successfully to MongoDB server");

      const db = client.db(dbName);
      const collectionName = req.query.collection || "pant";
      const collection = db.collection(collectionName);
      console.log(`Backend: Saving product to collection: ${collectionName}`);

      const {
        ProductName,
        ProductPrice,
        ProductActualprice,
        ProductDescription,
        ProductMaterial,
        ProductColor,
        ProductClothType,
        ProductAvailability,
        selectedSizes,
        selectedNumbers,
      } = req.body;

      const productDocument = {
        productname: ProductName,
        productprice: parseFloat(ProductPrice),
        productactualprice: parseFloat(ProductActualprice),
        productdescription: ProductDescription,
        productmaterial: ProductMaterial,
        productcolor: ProductColor,
        productclothtype: ProductClothType,
        productavailability: ProductAvailability,
        productsizes: selectedSizes ? selectedSizes.split(",") : [],
        productnumbers: selectedNumbers
          ? selectedNumbers.split(",").map(Number)
          : [],
        createdAt: new Date(),
      };

      if (req.files && req.files.length > 0) {
        productDocument.productImages = req.files.map((file) => ({
          data: bufferToBase64(file.buffer), // Convert to base64 string
          contentType: file.mimetype,
        }));
        console.log(`Backend: Received ${req.files.length} files`);
      } else {
        console.log("Backend: No image files uploaded.");
      }

      const result = await collection.insertOne(productDocument);
      console.log(
        `Backend: Document inserted successfully with _id: ${result.insertedId}`
      );

      res.status(201).json({
        message: "Product saved successfully!",
        productId: result.insertedId,
        insertedData: productDocument,
      });
    } catch (error) {
      console.error("Backend Error: Failed to save product:", error);
      res.status(500).json({
        error: "Failed to save product",
        details: error.message,
      });
    } finally {
      if (client) {
        await client.close();
        console.log("MongoDB connection closed.");
      }
    }
  }
);

// GET endpoint to fetch all products with base64 images
router.get("/getProducts", async (req, res) => {
  let client;
  try {
    client = new MongoClient(mongoUrl);
    await client.connect();
    console.log(
      "Backend: Connected successfully to MongoDB server for fetching products"
    );

    const db = client.db(dbName);
    const collectionName = req.query.collection || "pant";
    const collection = db.collection(collectionName);
    console.log(
      `Backend: Fetching products from collection: ${collectionName}`
    );

    const products = await collection.find({}).toArray();
    console.log(`Backend: Fetched ${products.length} products.`);

    res.status(200).json(products);
  } catch (error) {
    console.error("Backend Error: Failed to fetch products:", error);
    res.status(500).json({
      error: "Failed to fetch products",
      details: error.message,
    });
  } finally {
    if (client) {
      await client.close();
      console.log("MongoDB connection closed after fetching.");
    }
  }
});

// PUT endpoint for updating products
// PUT endpoint for updating products
router.put(
  "/updateProduct/:id",
  upload.array("ProductImages", 5),
  async (req, res) => {
    const { id } = req.params;
    const oldCollectionName = req.query.collection || "pant";
    const newCollectionName = req.body.selectedCollectionToSave || oldCollectionName;

    let client;
    try {
      client = new MongoClient(mongoUrl);
      await client.connect();
      const db = client.db(dbName);
      
      // Get the old collection
      const oldCollection = db.collection(oldCollectionName);
      
      // Find the product in the old collection
      const existingProduct = await oldCollection.findOne({ _id: new ObjectId(id) });
      
      if (!existingProduct) {
        return res.status(404).json({
          error: "Product not found",
          debug: {
            id,
            oldCollectionName,
            newCollectionName,
          },
        });
      }

      const updateData = {
        productname: req.body.ProductName,
        productprice: parseFloat(req.body.ProductPrice),
        productactualprice: parseFloat(req.body.ProductActualprice),
        productdescription: req.body.ProductDescription,
        productmaterial: req.body.ProductMaterial,
        productcolor: req.body.ProductColor,
        productclothtype: req.body.ProductClothType,
        productavailability: req.body.ProductAvailability,
        productsizes: req.body.selectedSizes
          ? req.body.selectedSizes.split(",")
          : [],
        productnumbers: req.body.selectedNumbers
          ? req.body.selectedNumbers.split(",").map(Number)
          : [],
      };

      // Update images if new ones uploaded
      if (req.files && req.files.length > 0) {
        updateData.productImages = req.files.map((file) => ({
          data: bufferToBase64(file.buffer),
          contentType: file.mimetype,
        }));
      } else {
        // Keep existing images if no new ones uploaded
        updateData.productImages = existingProduct.productImages || [];
      }

      // If collection is changing, delete from old and insert to new
      if (oldCollectionName !== newCollectionName) {
        console.log(`Moving product from ${oldCollectionName} to ${newCollectionName}`);
        
        // Delete from old collection
        await oldCollection.deleteOne({ _id: new ObjectId(id) });
        
        // Insert into new collection
        const newCollection = db.collection(newCollectionName);
        const result = await newCollection.insertOne({
          ...updateData,
          _id: new ObjectId(id), // Keep the same ID
          createdAt: existingProduct.createdAt,
          updatedAt: new Date(),
        });
        
        console.log("Product moved successfully:", result);
        res.status(200).json({ 
          message: "Product updated and moved successfully",
          moved: true,
          oldCollection: oldCollectionName,
          newCollection: newCollectionName
        });
      } else {
        // Same collection, just update
        const result = await oldCollection.updateOne(
          { _id: new ObjectId(id) },
          { 
            $set: {
              ...updateData,
              updatedAt: new Date()
            }
          }
        );

        console.log("Update Result:", result);
        if (result.matchedCount === 1) {
          res.status(200).json({ message: "Product updated successfully" });
        } else {
          res.status(404).json({
            error: "Product not found",
            debug: {
              id,
              collectionName: oldCollectionName,
              matchedCount: result.matchedCount,
              modifiedCount: result.modifiedCount,
            },
          });
        }
      }
    } catch (error) {
      console.error("PUT /updateProduct Error:", error);
      res.status(500).json({ error: "Failed to update product" });
    } finally {
      if (client) await client.close();
    }
  }
);

// DELETE product by ID and collection
router.delete("/deleteProduct/:id", async (req, res) => {
  const { id } = req.params;
  const collectionName = req.query.collection || "pant";

  let client;
  try {
    client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Product deleted successfully" });
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ error: "Failed to delete product" });
  } finally {
    if (client) await client.close();
  }
});

module.exports = router;