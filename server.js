const express = require("express");
const bcrypt = require("bcryptjs");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const cors = require("cors");
app.use(express.json());
app.use(cors());

const port = process.env.PORT || 4000;

const uri = process.env.MONGO_URI

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db();
const usersCollection = db.collection("users");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/users", async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/users", async (req, res) => {
  try {
    const { username, password, token, firstName, lastName } = req.body;
    if (!username || !password || !token || !firstName || !lastName) {
      return res.status(400).send("All fields are required");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedToken = await bcrypt.hash(token, 10);
    const user = {
      username,
      password: hashedPassword,
      token: hashedToken,
      firstName,
      lastName,
    };
    await usersCollection.insertOne(user);
    res.status(201).send({ message: "User created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/users/login", async (req, res) => {
  try {
    const { username, token } = req.body;
    if (!username || !token) {
      return res.status(400).send("Username and token are required");
    }
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return res.status(404).send("User not found");
    }
    if (await bcrypt.compare(token, user.token)) {
      res.send({ success: true });
    } else {
      res.send({ success: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
