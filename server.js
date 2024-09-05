const express = require("express");
const bcrypt = require("bcryptjs");
const { MongoClient } = require("mongodb");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
app.use(express.json());
app.use(cors());

dotenv.config();
const port = process.env.PORT || 4000;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGO_URI);

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
      rides: [],
    };
    await usersCollection.insertOne(user);
    res.status(201).send({ message: "User created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/ride", async (req, res) => {
  try {
    const {
      username,
      token,
      rideCategory,
      pickupLocation,
      dropoffLocation,
      rideDate,
      rideTime,
    } = req.body;

    if (
      !username ||
      !token ||
      !rideCategory ||
      !pickupLocation ||
      !dropoffLocation ||
      !rideDate ||
      !rideTime
    ) {
      return res.status(400).send("All fields are required");
    }

    const user = await usersCollection.findOne({ username });

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (!(await bcrypt.compare(token, user.token))) {
      return res.status(401).send("Invalid token");
    }

    if (!user.rides) {
      user.rides = [];
    }

    user.rides.push({
      rideCategory,
      pickupLocation,
      dropoffLocation,
      rideDate,
      rideTime,
      rideStatus: "booked",
    });

    await usersCollection.updateOne({ username }, { $set: user });

    res.send({ message: "Ride booked successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});


app.get("/rides", async (req, res) => {
  try {
    const { username, token } = req.query;

    if (!username || !token) {
      return res.status(400).send("Username and token are required");
    }

    const user = await usersCollection.findOne({ username });

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (!(await bcrypt.compare(token, user.token))) {
      return res.status(401).send("Invalid token");
    }

    res.json(user.rides);
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
