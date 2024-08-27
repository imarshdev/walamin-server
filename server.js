const express = require("express");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();

app.use(cors());
app.use(express.json());

const uri =
  "mongodb+srv://marshmansur004:zahara227..m@walamin.tg0bz.mongodb.net/?retryWrites=true&w=majority&appName=walamin";

const client = new MongoClient(uri);
const db = client.db("walamin_users");
const usersCollection = db.collection("users");


app.post("/users", async (req, res) => {
  try {
    const existingUser = await usersCollection.findOne({ name: req.body.name });
    if (existingUser) {
      return res
        .status(200)
        .send({ message: "User already exists, logged in successfully" });
    }
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = { name: req.body.name, password: hashedPassword };
    await usersCollection.insertOne(user);
    res.status(201).send({ message: "User created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/users/login", async (req, res) => {
  try {
    if (!req.body.name || !req.body.password) {
      return res.status(400).send("Name and password are required");
    }
    const user = await usersCollection.findOne({ name: req.body.name });
    if (!user) {
      return res.status(400).send("User not found");
    }
    if (await bcrypt.compare(req.body.password, user.password)) {
      res.send({ success: true });
    } else {
      res.send({ error: "Invalid password" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
