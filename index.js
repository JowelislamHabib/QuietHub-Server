require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const PORT = process.env.PORT;
const uri = process.env.MONGO_URI;
const cors = require("cors");
// const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// const JWKS = createRemoteJWKSet(
//   new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
// );

// const verifyToken = async (req, res, next) => {
//   const authHeader = req?.headers.authorization;
//   if (!authHeader) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }
//   const token = authHeader.split(" ")[1];
//   if (!token) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }

//   try {
//     const { payload } = await jwtVerify(token, JWKS);
//     console.log(payload);
//     next();
//   } catch (error) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }
// };

// async function run() {
//   try {
//     // await client.connect();
//     const db = client.db("Odessy");
//     const destinationCollection = db.collection("destinations");
//     const bookingCollection = db.collection("bookings");

//     app.get("/featured", async (req, res) => {
//       const result = await destinationCollection.find().limit(3).toArray();
//       res.json(result);
//     });

//     app.get("/destination", async (req, res) => {
//       const result = await destinationCollection.find().toArray();
//       res.json(result);
//     });

//     app.post("/destination", verifyToken, async (req, res) => {
//       const destinationData = req.body;
//       console.log(destinationData);
//       const result = await destinationCollection.insertOne(destinationData);

//       res.json(result);
//     });

//     app.get("/destination/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;

//       const result = await destinationCollection.findOne({
//         _id: new ObjectId(id),
//       });

//       res.json(result);
//     });

//     app.patch("/destination/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       const updateData = req.body;
//       // console.log(updateData);

//       const result = await destinationCollection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: updateData },
//       );
//       res.json(result);
//     });

//     app.delete("/destination/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;

//       const result = await destinationCollection.deleteOne({
//         _id: new ObjectId(id),
//       });

//       res.json(result);
//     });

//     app.post("/bookings", verifyToken, async (req, res) => {
//       const bookingData = req.body;
//       console.log(bookingData);
//       const result = await bookingCollection.insertOne(bookingData);
//       res.json(result);
//     });

//     app.get("/bookings", async (req, res) => {
//       const result = await bookingCollection.find().toArray();
//       res.json(result);
//     });

//     app.get("/bookings/:userId", verifyToken, async (req, res) => {
//       const { userId } = req.params;

//       const result = await bookingCollection.find({ userId: userId }).toArray();

//       res.json(result);
//     });

//     app.delete("/bookings/:bookingId", verifyToken, async (req, res) => {
//       const { bookingId } = req.params;

//       const result = await bookingCollection.deleteOne({
//         _id: new ObjectId(bookingId),
//       });

//       res.json(result);
//     });

//     // await client.db("admin").command({ ping: 1 });
//     console.log(
//       "Pinged your deployment. You successfully connected to MongoDB!",
//     );
//   } finally {
//     // await client.close();
//   }
// }
// run().catch(console.dir);

// app.get("/", (req, res) => {
//   res.send("Hello World!");
// });

// app.listen(PORT, () => {
//   console.log(`Example app listening on port ${PORT}`);
// });
